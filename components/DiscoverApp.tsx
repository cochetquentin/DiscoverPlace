"use client";

import { TripMap } from "@/components/TripMap";
import type {
  DurationMinutes,
  GenerateTripRequest,
  Mood,
  TripHistoryItem,
  TripPlan,
  WalkingLevel
} from "@/lib/types";
import { useEffect, useState } from "react";

const TOKYO_STATION = { lat: 35.681236, lng: 139.767125 };
const HISTORY_KEY = "discover-place-history";
type LocalHistoryItem = TripHistoryItem & { placeIds: string[] };

const moodOptions: { value: Mood; label: string; icon: string }[] = [
  { value: "surprise", label: "Surprends-moi", icon: "✦" },
  { value: "unusual", label: "Insolite", icon: "?" },
  { value: "nature", label: "Nature", icon: "⌁" },
  { value: "culture", label: "Culture", icon: "◎" },
  { value: "food", label: "Gourmand", icon: "◒" }
];

const walkingOptions: { value: WalkingLevel; label: string }[] = [
  { value: "low", label: "Tranquille" },
  { value: "medium", label: "Normale" },
  { value: "high", label: "J’aime marcher" }
];

const formatTime = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

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
    return "Position trop lente à répondre. Tokyo Station utilisée pour éviter d’attendre comme devant une administration.";
  }
  return "Position impossible à récupérer : Tokyo Station utilisée.";
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
  const [durationMinutes, setDuration] = useState<DurationMinutes>(240);
  const [mood, setMood] = useState<Mood>("surprise");
  const [walking, setWalking] = useState<WalkingLevel>("medium");
  const [origin, setOrigin] = useState(TOKYO_STATION);
  const [locationState, setLocationState] = useState("Position de démonstration : Tokyo Station");
  const [trip, setTrip] = useState<TripPlan | null>(null);
  const [history, setHistory] = useState<LocalHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationState("Géolocalisation non supportée : Tokyo Station utilisée");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setOrigin({ lat: coords.latitude, lng: coords.longitude });
        setLocationState("Position actuelle détectée");
      },
      (geolocationError) => setLocationState(geolocationErrorMessage(geolocationError)),
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
    const input: GenerateTripRequest = {
      origin,
      durationMinutes,
      mood,
      walking,
      excludeTripId,
      excludedPlaceIds: [...new Set(excludedPlaceIds)]
    };
    try {
      const response = await fetch("/api/trips/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Impossible de générer une sortie.");
      }
      setTrip(data);
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

  const feedback = async (status: "completed" | "rejected") => {
    if (!trip) return;
    const updated = { ...trip, status };
    setTrip(updated);
    saveHistory(history.map((item) => (item.id === trip.id ? { ...item, status } : item)));
    fetch("/api/trips/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tripId: trip.id,
        status,
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
              <p className="eyebrow">Pars maintenant · retour {formatTime(trip.returnsAt)}</p>
              <h1>{trip.title}</h1>
              <p className="lede">{trip.summary}</p>
            </div>
            <div className="score-stamp">
              <strong>{Math.round(trip.score)}</strong>
              <span>indice découverte</span>
            </div>
          </div>

          <TripMap trip={trip} />

          <div className="metrics">
            <Metric value={`${trip.transitMinutes} min`} label="transport" />
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
                    <span>{formatTime(stop.arrivalAt)}–{formatTime(stop.departureAt)}</span>
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

          <div className="action-dock">
            <button className="button secondary" disabled={loading} onClick={() => generate(trip.id)}>
              Autre idée
            </button>
            <button className="button ghost" onClick={() => feedback("rejected")}>Pas pour moi</button>
            <button className="button primary" onClick={() => feedback("completed")}>
              J’ai fait cette sortie
            </button>
          </div>
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
                {[60, 120, 240, 360].map((duration) => (
                  <button
                    className={durationMinutes === duration ? "choice active" : "choice"}
                    key={duration}
                    onClick={() => setDuration(duration as DurationMinutes)}
                  >
                    <strong>{duration < 60 ? duration : duration / 60}</strong>
                    <span>{duration === 60 ? "heure" : "heures"}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="planner-section">
              <div className="section-heading">
                <span>02</span>
                <h2>Envie du moment</h2>
              </div>
              <div className="chip-grid">
                {moodOptions.map((option) => (
                  <button
                    className={mood === option.value ? "chip active" : "chip"}
                    key={option.value}
                    onClick={() => setMood(option.value)}
                  >
                    <span>{option.icon}</span>{option.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="planner-section">
              <div className="section-heading">
                <span>03</span>
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

            <div className="location-line">
              <span>⌖</span>
              <span>{locationState}</span>
              <button className="mini-button" type="button" onClick={requestLocation}>
                Réessayer
              </button>
            </div>
            {error && <div className="error-card">{error}</div>}
            <button className="button primary generate" disabled={loading} onClick={() => generate()}>
              {loading ? <><span className="spinner" /> Je construis ta sortie…</> : "Trouve-moi une sortie"}
            </button>
            <p className="promise">Retour garanti dans le créneau, marge incluse.</p>
          </div>
        </section>
      )}
    </main>
  );
}
