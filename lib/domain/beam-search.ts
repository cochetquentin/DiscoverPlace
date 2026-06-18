import { backtrackPenalty, distanceMeters, walkingMinutes } from "@/lib/domain/geo";
import { scorePlace } from "@/lib/domain/scoring";
import {
  BEAM_WIDTH,
  effectiveVisitDuration,
  isOpenForVisit,
  MAX_STOPS,
  minStopsRequired,
  minWalkingRequired,
  safetyMargin,
  walkingBudget
} from "@/lib/domain/trip-rules";
import type {
  Coordinate,
  GenerateTripRequest,
  PlaceCandidate,
  ScoredRoute
} from "@/lib/types";

type BeamSearchInput = {
  request: GenerateTripRequest;
  anchor: PlaceCandidate;
  nearby: PlaceCandidate[];
  outboundMinutes: number;
  returnMinutes: number;
  visitedIds: Set<string>;
  rejectedIds: Set<string>;
  now: Date;
  isScheduled: boolean;
  destination?: Coordinate; // défini = marche finale vers destination ; undefined = pas de retour
};

export function buildRoutes(input: BeamSearchInput): ScoredRoute[] {
  const {
    request,
    anchor,
    nearby,
    outboundMinutes,
    returnMinutes,
    visitedIds,
    rejectedIds,
    now,
    isScheduled,
    destination
  } = input;
  const usableMinutes = request.durationMinutes - safetyMargin(request.durationMinutes);
  const maxWalking = walkingBudget(request.walking, request.durationMinutes);
  const minStops = minStopsRequired(request.walking, request.durationMinutes);
  const candidates = [anchor, ...nearby].filter(
    (place) => !visitedIds.has(place.id) && !rejectedIds.has(place.id)
  );

  const anchorVisit = effectiveVisitDuration(anchor.category, request.walking, request.durationMinutes);
  const anchorOpening = isOpenForVisit(
    anchor,
    new Date(now.getTime() + outboundMinutes * 60_000),
    anchorVisit,
    isScheduled
  );
  if (!anchorOpening.allowed) return [];

  const initialRoute: ScoredRoute = {
    places: [anchor],
    outboundMinutes,
    returnMinutes,
    walkingMinutes: 0,
    visitMinutes: anchorVisit,
    totalMinutes: outboundMinutes + returnMinutes + anchorVisit,
    score: scorePlace(anchor, {
      mood: request.mood,
      visitedIds,
      rejectedIds,
      existingCategories: new Set()
    })
  };
  let beam: ScoredRoute[] = [initialRoute];
  // Ne pas inclure la route 1-stop d'emblée : évite le fallback systématique vers 0 min de marche.
  // Elle sera réintroduite seulement si aucune route multi-stop n'est trouvée.
  const completed: ScoredRoute[] = [];

  for (let depth = 1; depth < MAX_STOPS; depth += 1) {
    const expanded: ScoredRoute[] = [];

    for (const route of beam) {
      for (const place of candidates) {
        if (route.places.some((existing) => existing.id === place.id)) continue;
        // Rejeter les lieux trop proches d'un stop existant (sous-sections du même parc, etc.)
        if (route.places.some((existing) => distanceMeters(existing.coordinate, place.coordinate) < 200)) continue;

        const previous = route.places.at(-1)?.coordinate ?? anchor.coordinate;
        // Correction pour la marche réelle : les chemins piétons sont ~1.4x la distance
        // euclidienne, et Google marche à 60 m/min vs notre estimation à 75 m/min.
        // Facteur = 1.4 × (75/60) = 1.75 → les estimations reflètent le temps réel.
        const walk = route.places.length === 0 ? 0 : Math.ceil(walkingMinutes(previous, place.coordinate) * 1.75);
        const visit = effectiveVisitDuration(place.category, request.walking, request.durationMinutes);
        const arrival = new Date(
          now.getTime() +
            (outboundMinutes + route.walkingMinutes + route.visitMinutes + walk) * 60_000
        );
        const opening = isOpenForVisit(place, arrival, visit, isScheduled);
        if (!opening.allowed) continue;

        const nextWalking = route.walkingMinutes + walk;
        const nextVisit = route.visitMinutes + visit;
        // Destination définie → réserver le temps de marche finale vers elle
        // Pas de destination → trip one-way, pas de retour requis
        const dynamicReturn = destination
          ? Math.ceil(walkingMinutes(place.coordinate, destination) * 1.75)
          : 0;
        const total = outboundMinutes + dynamicReturn + nextWalking + nextVisit;
        if (nextWalking > maxWalking || total > usableMinutes) continue;

        const existingCategories = new Set(route.places.map((item) => item.category));
        // Point qui précédait `previous` : origin pour le 2e stop, avant-dernier sinon
        const from =
          route.places.length >= 2
            ? route.places.at(-2)!.coordinate
            : request.origin;
        const next: ScoredRoute = {
          places: [...route.places, place],
          outboundMinutes,
          returnMinutes: dynamicReturn,
          walkingMinutes: nextWalking,
          visitMinutes: nextVisit,
          totalMinutes: total,
          score:
            route.score +
            scorePlace(place, {
              mood: request.mood,
              visitedIds,
              rejectedIds,
              existingCategories,
              travelPenalty: request.walking === "high" ? walk * -0.15 : walk * 0.25
            }) -
            backtrackPenalty(from, previous, place.coordinate)
        };
        expanded.push(next);
        if (next.places.length >= 2) completed.push(next);
      }
    }

    // Pruning : priorité marche (walk deficit), puis score — aligne le beam sur le tri final
    beam = expanded
      .sort((a, b) => {
        const aWalkDef = Math.max(0, maxWalking - a.walkingMinutes);
        const bWalkDef = Math.max(0, maxWalking - b.walkingMinutes);
        if (aWalkDef !== bWalkDef) return aWalkDef - bWalkDef;
        return b.score - a.score;
      })
      .slice(0, BEAM_WIDTH);
    if (beam.length === 0) break;
  }

  // Dernier recours : si aucune route multi-stop n'a été trouvée, accepter la route 1-stop
  if (completed.length === 0 && initialRoute.totalMinutes <= usableMinutes) {
    completed.push(initialRoute);
  }

  const minWalk = minWalkingRequired(request.walking, maxWalking);
  const walkTarget = walkingBudget(request.walking, request.durationMinutes);

  // Progressive filtering: prioritise routes meeting walk + stop requirements
  // Fallback to just min stops, then to all completed routes
  let filtered = completed.filter(
    (r) => r.places.length >= minStops && r.walkingMinutes >= minWalk
  );
  if (filtered.length === 0) filtered = completed.filter((r) => r.places.length >= minStops);
  if (filtered.length === 0) filtered = completed;

  // Sort lexicographique : stops manquants → walk manquante → marge inutilisée → score contenu
  return filtered
    .sort((a, b) => {
      const aStopDef = Math.max(0, minStops - a.places.length);
      const bStopDef = Math.max(0, minStops - b.places.length);
      if (aStopDef !== bStopDef) return aStopDef - bStopDef;
      const aWalkDef = Math.max(0, walkTarget - a.walkingMinutes);
      const bWalkDef = Math.max(0, walkTarget - b.walkingMinutes);
      if (aWalkDef !== bWalkDef) return aWalkDef - bWalkDef;
      const aSlack = usableMinutes - a.totalMinutes;
      const bSlack = usableMinutes - b.totalMinutes;
      if (aSlack !== bSlack) return aSlack - bSlack;
      return b.score - a.score;
    })
    .slice(0, 3);
}
