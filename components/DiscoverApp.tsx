"use client";

import { LocationPicker } from "@/components/LocationPicker";
import { TripMap } from "@/components/TripMap";
import type {
  DurationMinutes,
  TripHistoryItem,
  TripPlan,
  WalkingLevel
} from "@/lib/types";
import { useEffect, useRef, useState } from "react";

const TOKYO_STATION = { lat: 35.681236, lng: 139.767125 };
const HISTORY_KEY = "discover-place-history";
type LocalHistoryItem = TripHistoryItem & { placeIds: string[] };

const walkingOptions: { value: WalkingLevel; label: string }[] = [
  { value: "low", label: "Tranquille" },
  { value: "medium", label: "Normale" },
  { value: "high", label: "J’aime marcher" }
];

const TZ = "Asia/Tokyo";

const formatTime = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(new Date(iso));

const formatDatetime = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", timeZone: TZ
  }).format(new Date(iso));

const tokyoDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { timeZone: TZ });

// Interpréter la valeur datetime-local en JST (UTC+9), timezone fixe de l'app
function datetimeToISO(value: string): string {
  return new Date(`${value}:00+09:00`).toISOString();
}

// Valeur minimum/maximum pour les inputs datetime-local en JST
function nowJSTLocal(offsetMs = 0): string {
  return new Date(Date.now() + offsetMs).toLocaleString("sv-SE", { timeZone: TZ }).replace(" ", "T").slice(0, 16);
}

function maxJSTLocal(): string {
  return nowJSTLocal(100 * 24 * 60 * 60 * 1000);
}

function isTimeInBounds(value: string, mode: "departure" | "arrival", durationMs: number): boolean {
  if (!value) return false;
  const ts = new Date(`${value}:00+09:00`).getTime();
  const now = Date.now();
  const HORIZON_MS = 100 * 24 * 60 * 60 * 1000;
  if (mode === "departure") {
    return ts > now - 60_000 && ts + durationMs < now + HORIZON_MS;
  }
  return ts > now + durationMs - 60_000 && ts < now + HORIZON_MS;
}

function directionsUrl(origin: { lat: number; lng: number }, destination: { lat: number; lng: number }) {
  const query = new URLSearchParams({
    api: "1",
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    travelmode: "walking"
  });
  return `https://www.google.com/maps/dir/?${query.toString()}`;
}

function geolocationErrorMessage(error: GeolocationPositionError) {
  if (!window.isSecureContext) {
    return "Position bloquée : ouvre l’app en HTTPS. Sur mobile, une URL locale en http://192.168.x.x ne peut pas demander ta position.";
  }
  if (error.code === error.PERMISSION_DENIED) {
    return "Position refusée par le navigateur. Vérifie l’autorisation de localisation pour ce site.";
  }
  if (error.code === error.POSITION_UNAVAILABLE) {
    return "Position indisponible pour l’instant. GPS ou réseau capricieux, classique.";
  }
  if (error.code === error.TIMEOUT) {
    return "Position trop lente à répondre. Choisis un point sur la carte ou réessaie.";
  }
  return "Position impossible à récupérer. Choisis un point sur la carte ou réessaie.";
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export function DiscoverApp() {
  const [durationMinutes, setDuration] = useState<DurationMinutes>(120);
  const [walking, setWalking] = useState<WalkingLevel>("medium");
  // Mode Départ : point de départ indépendant du mode Arrivée
  const [departureOrigin, setDepartureOrigin] = useState(TOKYO_STATION);
  const [locationState, setLocationState] = useState("Position de démonstration : Tokyo Station");
  // Mode Arrivée : point d'arrivée indépendant du mode Départ
  const [arrivalDestination, setArrivalDestination] = useState<{ lat: number; lng: number } | null>(null);
  const [trip, setTrip] = useState<TripPlan | null>(null);
  const [tripRating, setTripRating] = useState<"like" | "dislike" | null>(null);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [history, setHistory] = useState<LocalHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [timeMode, setTimeMode] = useState<"departure" | "arrival">("departure");
  const [departureNow, setDepartureNow] = useState(true);
  const [selectedTime, setSelectedTime] = useState("");
  const ignoreGeolocationRef = useRef(false);

  const requestLocation = () => {
    ignoreGeolocationRef.current = false;
    if (!navigator.geolocation) {
      setLocationState("Géolocalisation non supportée. Choisis un point sur la carte.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (ignoreGeolocationRef.current) return;
        setDepartureOrigin({ lat: coords.latitude, lng: coords.longitude });
        setLocationState("Position actuelle détectée");
      },
      (geolocationError) => {
        if (ignoreGeolocationRef.current) return;
        setLocationState(geolocationErrorMessage(geolocationError));
      },
      { enableHighAccuracy: true, timeout: 8_000 }
    );
  };

  useEffect(() => {
    const saved = localStorage.getItem(HISTORY_KEY);
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch {
        localStorage.removeItem(HISTORY_KEY);
      }
    }
    requestLocation();
  }, []);

  const saveHistory = (next: LocalHistoryItem[]) => {
    setHistory(next);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next.slice(0, 50)));
  };

  const generate = async (excludeTripId?: string) => {
    // Re-valider au moment de la soumission : le bouton peut rester actif alors que l'heure a expiré
    if (selectedTime && !isTimeInBounds(selectedTime, timeMode, durationMinutes * 60_000)) {
      setError("L'heure sélectionnée n'est plus valide. Choisis une nouvelle heure.");
      return;
    }
    setLoading(true);
    setError("");
    const excludedPlaceIds = history
      .filter(
        (item) =>
          item.status === "completed" ||
          item.status === "rejected" ||
          item.id === excludeTripId
      )
      .flatMap((item) => item.placeIds);
    // Mode Départ : origin imposée, pas de destination
    // Mode Arrivée : destination imposée, origin = dummy (même coord), jamais réutilisée depuis le mode Départ
    const input = timeMode === "departure"
      ? { origin: departureOrigin, durationMinutes, walking, excludeTripId, excludedPlaceIds: [...new Set(excludedPlaceIds)] }
      : { origin: arrivalDestination!, destination: arrivalDestination!, durationMinutes, walking, excludeTripId, excludedPlaceIds: [...new Set(excludedPlaceIds)] };
    const finalInput = {
      ...input,
      ...(timeMode === "departure" && !departureNow && selectedTime
        ? { departureAt: datetimeToISO(selectedTime) }
        : {}),
      ...(timeMode === "arrival" && selectedTime
        ? { arrivalBy: datetimeToISO(selectedTime) }
        : {})
    };
    try {
      const response = await fetch("/api/trips/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finalInput)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Impossible de générer une sortie.");
      }
      setTrip(data);
      setTripRating(null);
      setRatingComment("");
      setRatingSubmitted(false);
      saveHistory([
        {
          id: data.id,
          createdAt: data.createdAt,
          title: data.title,
          totalMinutes: data.totalMinutes,
          stopCount: data.stops.length,
          status: data.status ?? "suggested",
          placeIds: data.stops.map((stop: TripPlan["stops"][number]) => stop.place.id)
        },
        ...history
      ]);
      setShowHistory(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  const submitRating = (rating: "like" | "dislike", comment?: string) => {
    if (!trip) return;
    setRatingSubmitted(true);
    fetch("/api/trips/rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tripId: trip.id,
        rating,
        comment: comment || undefined,
        mood: trip.request.mood,
        walking: trip.request.walking,
        durationMinutes: trip.request.durationMinutes
      })
    }).catch(console.error);
  };

  return (
    <main>
      <header className="topbar">
        <button className="brand" onClick={() => setTrip(null)} aria-label="Accueil">
          <span className="brand-mark">D</span>
          <span>DiscoverPlace</span>
        </button>
        <button
          className="text-button"
          onClick={() => {
            setShowHistory(!showHistory);
          }}
        >
          Historique
        </button>
      </header>

      {showHistory ? (
        <section className="history-screen">
          <p className="eyebrow">Tes échappées</p>
          <h1>Les endroits que tu ne connaissais pas encore.</h1>
          <div className="history-grid">
            {history.length === 0 ? (
              <div className="empty-card">Aucune sortie pour l’instant. Il faut bien commencer quelque part.</div>
            ) : (
              history.map((item) => (
                <article
                  className="history-card"
                  key={item.id}
                >
                  <span className={`status ${item.status}`}>{item.status ?? "suggested"}</span>
                  <strong>{item.title}</strong>
                  <span>{item.stopCount} étapes · {item.totalMinutes} min</span>
                </article>
              ))
            )}
          </div>
        </section>
      ) : trip ? (
        <section className="result-screen">
          <div className="result-hero">
            <div>
              <p className="eyebrow">
                {trip.request.departureAt || trip.request.arrivalBy
                  ? `Départ ${formatDatetime(trip.startsAt)} · retour ${formatDatetime(trip.returnsAt)}`
                  : `Pars maintenant · retour ${formatTime(trip.returnsAt)}`}
              </p>
              <h1>{trip.title}</h1>
              <p className="lede">{trip.summary}</p>
              <div className="trip-params">
                <span className="chip active">{trip.request.durationMinutes / 60}h</span>
                <span className="chip active">{{ low: "Tranquille", medium: "Normale", high: "Intense" }[trip.request.walking]}</span>
                <span className="chip active">{{ surprise: "Surprise", unusual: "Inattendu", nature: "Nature", culture: "Culture", food: "Gourmand" }[trip.request.mood]}</span>
              </div>
            </div>
            <div className="result-hero-side">
              <div className="action-dock action-dock--hero">
                <button
                  className={`button liked${tripRating === "like" ? " active" : ""}`}
                  onClick={() => { setTripRating("like"); setRatingSubmitted(false); }}
                >
                  Bonne idée 👍
                </button>
                <button
                  className={`button disliked${tripRating === "dislike" ? " active" : ""}`}
                  onClick={() => { setTripRating("dislike"); setRatingSubmitted(false); }}
                >
                  Pas terrible 👎
                </button>
              </div>
            </div>
          </div>

          {tripRating !== null && !ratingSubmitted && (
            <div className="rating-comment rating-comment--full">
              <textarea
                className="rating-textarea"
                placeholder="Pourquoi ? (optionnel)"
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                rows={3}
              />
              <button className="button primary" onClick={() => submitRating(tripRating, ratingComment)}>
                Envoyer
              </button>
            </div>
          )}
          {ratingSubmitted && <p className="rating-thanks">Merci pour ton retour !</p>}

          <div className="result-body">
            <div className="result-map-col">
              <TripMap trip={trip} />
            </div>
            <div className="result-content-col">
          <div className="metrics">
            <Metric value={`${trip.walkingMinutes} min`} label="marche" />
            <Metric value={`${trip.visitMinutes} min`} label="sur place" />
            <Metric value={`${trip.safetyMarginMinutes} min`} label="de marge" />
          </div>

          <div className="timeline">
            {trip.stops.map((stop, index) => (
              <article className="stop" key={stop.place.id}>
                <div className="stop-index">{index + 1}</div>
                <div className="stop-card">
                  <div className="stop-meta">
                    <span>
                      {tokyoDate(stop.arrivalAt) !== tokyoDate(trip.startsAt)
                        ? formatDatetime(stop.arrivalAt)
                        : formatTime(stop.arrivalAt)}
                      –{tokyoDate(stop.departureAt) !== tokyoDate(stop.arrivalAt)
                        ? formatDatetime(stop.departureAt)
                        : formatTime(stop.departureAt)}
                    </span>
                    <span>{stop.visitMinutes} min</span>
                  </div>
                  <h2>{stop.place.name}</h2>
                  <p>{stop.reason}</p>
                  {stop.warning && <p className="warning">{stop.warning}</p>}
                  {stop.place.googleMapsUri && (
                    <a href={stop.place.googleMapsUri} target="_blank" rel="noreferrer">
                      Ouvrir dans Google Maps ↗
                    </a>
                  )}
                  <div className="stop-actions">
                    <a
                      href={directionsUrl(
                        index === 0 ? trip.request.origin : trip.stops[index - 1].place.coordinate,
                        stop.place.coordinate
                      )}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Itinéraire vers cette étape ↗
                    </a>
                  </div>
                </div>
              </article>
            ))}
            <article className="stop return-stop">
              <div className="stop-index">✓</div>
              <div className="stop-card">
                <div className="stop-meta"><span>{formatTime(trip.returnsAt)}</span></div>
                <h2>Retour au point de départ</h2>
                <p>Le temps de retour et la marge sont déjà comptés.</p>
              </div>
            </article>
          </div>
            </div>
          </div>

          <div className="action-dock action-dock--bottom">
            <button
              className={`button liked${tripRating === "like" ? " active" : ""}`}
              onClick={() => { setTripRating("like"); setRatingSubmitted(false); }}
            >
              Bonne idée 👍
            </button>
            <button
              className={`button disliked${tripRating === "dislike" ? " active" : ""}`}
              onClick={() => { setTripRating("dislike"); setRatingSubmitted(false); }}
            >
              Pas terrible 👎
            </button>
          </div>
          {ratingSubmitted && <p className="rating-thanks">Merci pour ton retour !</p>}
        </section>
      ) : (
        <section className="home-screen">
          <div className="hero">
            <p className="eyebrow">Tokyo est plus grand que tes habitudes.</p>
            <h1>Combien de temps veux-tu perdre intelligemment ?</h1>
            <p className="lede">
              Une sortie crédible, un retour à l’heure, et aucun scroll infini pour choisir.
            </p>
          </div>

          <div className="planner">
            <section className="planner-section">
              <div className="section-heading">
                <span>01</span>
                <h2>Temps disponible</h2>
              </div>
              <div className="duration-grid">
                {[120, 240, 360].map((duration) => (
                  <button
                    className={durationMinutes === duration ? "choice active" : "choice"}
                    key={duration}
                    onClick={() => setDuration(duration as DurationMinutes)}
                  >
                    <strong>{duration / 60}</strong>
                    <span>heures</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="planner-section">
              <div className="section-heading">
                <span>02</span>
                <h2>Rythme</h2>
              </div>
              <div className="segmented">
                {walkingOptions.map((option) => (
                  <button
                    className={walking === option.value ? "active" : ""}
                    key={option.value}
                    onClick={() => setWalking(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="planner-section">
              <div className="section-heading">
                <span>03</span>
                <h2>Horaire</h2>
              </div>
              <div className="segmented" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: "12px" }}>
                <button
                  className={timeMode === "departure" ? "active" : ""}
                  onClick={() => { setTimeMode("departure"); setDepartureNow(true); setSelectedTime(""); }}
                >
                  Départ
                </button>
                <button
                  className={timeMode === "arrival" ? "active" : ""}
                  onClick={() => { setTimeMode("arrival"); setDepartureNow(false); setSelectedTime(""); }}
                >
                  Arrivée
                </button>
              </div>
              {timeMode === "departure" && (
                <>
                  <div className="segmented" style={{ gridTemplateColumns: "1fr 1fr" }}>
                    <button
                      className={departureNow ? "active" : ""}
                      onClick={() => { setDepartureNow(true); setSelectedTime(""); }}
                    >
                      Maintenant
                    </button>
                    <button
                      className={!departureNow ? "active" : ""}
                      onClick={() => setDepartureNow(false)}
                    >
                      Choisir l'heure
                    </button>
                  </div>
                  {!departureNow && (
                    <input
                      type="datetime-local"
                      value={selectedTime}
                      min={nowJSTLocal()}
                      max={nowJSTLocal(100 * 24 * 60 * 60 * 1000 - durationMinutes * 60_000)}
                      onChange={(e) => setSelectedTime(e.target.value)}
                      style={{ marginTop: "10px", width: "100%", padding: "10px 12px", border: "1px solid var(--line)", borderRadius: "10px", background: "var(--card)", fontSize: "0.9rem", color: "inherit", boxSizing: "border-box" }}
                    />
                  )}
                </>
              )}
              {timeMode === "arrival" && (
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ color: "var(--muted)", fontSize: "0.82rem", fontWeight: 600, whiteSpace: "nowrap" }}>
                    Rentrer avant
                  </span>
                  <input
                    type="datetime-local"
                    value={selectedTime}
                    min={nowJSTLocal(durationMinutes * 60_000)}
                    max={maxJSTLocal()}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    style={{ flex: 1, padding: "10px 12px", border: "1px solid var(--line)", borderRadius: "10px", background: "var(--card)", fontSize: "0.9rem", color: "inherit" }}
                  />
                </div>
              )}
            </section>

            <div className="location-line">
              <span>⌖</span>
              <span>{timeMode === "departure" ? locationState : (arrivalDestination ? "Point d'arrivée défini" : "Non défini")}</span>
              {timeMode === "departure" && (
                <button className="mini-button" type="button" onClick={requestLocation}>Réessayer</button>
              )}
              {timeMode === "arrival" && arrivalDestination && (
                <button className="mini-button" type="button" onClick={() => setArrivalDestination(null)}>Supprimer</button>
              )}
              <button className="mini-button" type="button" onClick={() => setShowPicker(true)}>
                Choisir sur la carte
              </button>
            </div>
            {showPicker && (
              <LocationPicker
                initialPosition={timeMode === "departure" ? departureOrigin : (arrivalDestination ?? TOKYO_STATION)}
                label={timeMode === "departure" ? "Choisir un point de départ" : "Choisir un point d'arrivée"}
                onConfirm={(pos) => {
                  if (timeMode === "departure") {
                    ignoreGeolocationRef.current = true;
                    setDepartureOrigin(pos);
                    setLocationState("Position choisie sur la carte");
                  } else {
                    setArrivalDestination(pos);
                  }
                  setShowPicker(false);
                }}
                onCancel={() => setShowPicker(false)}
              />
            )}
            {error && <div className="error-card">{error}</div>}
            <button
              className="button primary generate"
              disabled={
                loading ||
                (timeMode === "arrival" && !arrivalDestination) ||
                (timeMode === "departure" && !departureNow && !selectedTime) ||
                (selectedTime !== "" && !isTimeInBounds(selectedTime, timeMode, durationMinutes * 60_000))
              }
              onClick={() => generate()}
            >
              {loading ? <><span className="spinner" /> Je construis ta sortie…</> : "Trouve-moi une sortie"}
            </button>
            <p className="promise">Retour garanti dans le créneau, marge incluse.</p>
          </div>
        </section>
      )}
    </main>
  );
}
