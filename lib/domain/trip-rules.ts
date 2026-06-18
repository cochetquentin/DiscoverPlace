import type {
  DurationMinutes,
  Mood,
  PlaceCandidate,
  PlaceCategory,
  WalkingLevel
} from "@/lib/types";

export const MAX_STOPS = 7;
export const BEAM_WIDTH = 20;

const VISIT_DURATIONS: Record<PlaceCategory, number> = {
  micro: 15,
  art: 20,
  viewpoint: 15,
  temple: 15,
  park: 30,
  cafe: 45,
  restaurant: 60,
  museum: 75,
  attraction: 20
};

const moodCategoryFit: Record<Mood, Partial<Record<PlaceCategory, number>>> = {
  surprise: {
    micro: 1,
    art: 0.9,
    viewpoint: 0.8,
    temple: 0.7,
    park: 0.6,
    cafe: 0.6,
    restaurant: 0.5,
    museum: 0.7,
    attraction: 0.6
  },
  unusual: { micro: 1, art: 1, viewpoint: 0.8, temple: 0.7, museum: 0.7 },
  nature: { park: 1, viewpoint: 0.9, temple: 0.7, micro: 0.4 },
  culture: { museum: 1, temple: 0.95, art: 0.9, attraction: 0.8 },
  food: { restaurant: 1, cafe: 0.9, micro: 0.4 }
};

export function safetyMargin(duration: DurationMinutes): number {
  return Math.min(30, Math.max(10, Math.ceil(duration * 0.1)));
}

export function maxTransitLeg(duration: DurationMinutes): number {
  return Math.min(90, Math.floor(duration * 0.25));
}

export function visitDuration(category: PlaceCategory): number {
  return VISIT_DURATIONS[category];
}

export function effectiveVisitDuration(category: PlaceCategory, walking: WalkingLevel, duration?: DurationMinutes): number {
  void duration;
  const base = visitDuration(category);
  if (walking === "high") return Math.min(base, 20);
  if (walking === "medium") return Math.min(base, 30);
  return base;
}

export function walkingBudget(level: WalkingLevel, duration: DurationMinutes): number {
  const ratio = level === "low" ? 0.20 : level === "medium" ? 0.50 : 0.75;
  return Math.max(15, Math.floor(duration * ratio));
}

export function minStopsRequired(level: WalkingLevel, duration: DurationMinutes): number {
  if (level === "low") return Math.max(1, Math.ceil(duration / 120)); // 120→1, 240→2, 360→3
  if (level === "medium") return Math.max(2, Math.ceil(duration / 120));
  return Math.max(2, Math.ceil(duration / 75)); // high: 120→2, 240→4, 360→5
}

export function minWalkingRequired(level: WalkingLevel, budget: number): number {
  // Minimum strict = 60% du budget cible (25/50/75% de la durée)
  // Si non atteignable, le fallback progressif retourne le mieux disponible
  return Math.floor(budget * 0.60);
}

export function nearbyRadius(level: WalkingLevel, duration: DurationMinutes = 240): number {
  if (level === "low") return 1500;
  if (level === "medium") return 3500;
  // high: réduire pour les trips courts — sinon l'outbound mange tout le budget
  if (duration <= 120) return 2500;
  if (duration <= 240) return 4000;
  return 6000;
}

export function moodFit(place: PlaceCandidate, mood: Mood): number {
  return moodCategoryFit[mood][place.category] ?? (mood === "surprise" ? 0.5 : 0.15);
}

export function isOpenForVisit(
  place: PlaceCandidate,
  arrival: Date,
  visitMinutes: number,
  isScheduled = false
): { allowed: boolean; warning?: string } {
  if (!["cafe", "restaurant", "museum"].includes(place.category)) {
    return {
      allowed: true,
      warning: place.openingHours ? undefined : "Horaires non vérifiés"
    };
  }

  // Heuristique nocturne : uniquement les heures de nuit profonde (Tokyo = ville tardive)
  // Musées : vraiment fermés 21h-9h. Cafés/restaurants : seulement nuit profonde (2h-7h/10h).
  if (!isScheduled && !place.openingHours) {
    const hourJST = (arrival.getUTCHours() + 9) % 24;
    if (place.category === "museum" && (hourJST >= 21 || hourJST < 9)) {
      return { allowed: false };
    }
    if (place.category === "cafe" && hourJST >= 2 && hourJST < 7) {
      return { allowed: false };
    }
    if (place.category === "restaurant" && hourJST >= 2 && hourJST < 10) {
      return { allowed: false };
    }
  }

  if (isScheduled) {
    // Pour un départ lointain (> 4h), les données horaires actuelles ne sont pas pertinentes.
    if (arrival.getTime() - Date.now() > 4 * 3_600_000) {
      return { allowed: true, warning: "Horaires à vérifier pour la date planifiée" };
    }
    // Near-term planifié : openNow indique l'état *actuel*, pas l'état à l'arrivée.
    // Un café fermé à 8h peut très bien ouvrir à 10h avant qu'on y arrive à 11h.
    // On laisse passer avec un avertissement plutôt que de rejeter.
    if (place.openingHours?.openNow === false) {
      return { allowed: true, warning: "Horaires non vérifiés pour l'heure planifiée" };
    }
    if (!place.openingHours?.nextCloseTime) {
      return { allowed: true, warning: "Horaires de fermeture non confirmés" };
    }
    // nextCloseTime = fin de la période *actuelle*, pas de la période de la visite planifiée.
    // Si la visite est après la fermeture courante, le lieu peut rouvrir (ex: service du soir).
    // On ne peut pas déterminer les horaires futurs ici → warning au lieu de rejet.
    const requiredOpenUntil = new Date(arrival.getTime() + (visitMinutes + 10) * 60_000);
    if (new Date(place.openingHours.nextCloseTime) < requiredOpenUntil) {
      return { allowed: true, warning: "Horaires de fermeture à vérifier pour la visite planifiée" };
    }
    return { allowed: true };
  }

  if (place.openingHours?.openNow === false) {
    return { allowed: false };
  }

  if (!place.openingHours?.nextCloseTime) {
    return { allowed: true, warning: "Horaires de fermeture non confirmés" };
  }

  const requiredOpenUntil = new Date(arrival.getTime() + (visitMinutes + 10) * 60_000);
  return {
    allowed: new Date(place.openingHours.nextCloseTime) >= requiredOpenUntil
  };
}
