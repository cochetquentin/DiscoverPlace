import { distanceMeters, walkingMinutes } from "@/lib/domain/geo";
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
    isScheduled
  } = input;
  const usableMinutes = request.durationMinutes - safetyMargin(request.durationMinutes);
  const maxWalking = walkingBudget(request.walking, request.durationMinutes);
  const candidates = [anchor, ...nearby].filter(
    (place) => !visitedIds.has(place.id) && !rejectedIds.has(place.id)
  );

  const anchorVisit = effectiveVisitDuration(anchor.category, request.walking);
  const anchorOpening = isOpenForVisit(
    anchor,
    new Date(now.getTime() + outboundMinutes * 60_000),
    anchorVisit,
    isScheduled
  );
  if (!anchorOpening.allowed) return [];

  let beam: ScoredRoute[] = [
    {
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
    }
  ];
  const completed: ScoredRoute[] = beam[0].totalMinutes <= usableMinutes ? [...beam] : [];

  for (let depth = 1; depth < MAX_STOPS; depth += 1) {
    const expanded: ScoredRoute[] = [];

    for (const route of beam) {
      for (const place of candidates) {
        if (route.places.some((existing) => existing.id === place.id)) continue;
        // Rejeter les lieux trop proches d'un stop existant (sous-sections du même parc, etc.)
        if (route.places.some((existing) => distanceMeters(existing.coordinate, place.coordinate) < 400)) continue;

        const previous = route.places.at(-1)?.coordinate ?? anchor.coordinate;
        // Correction pour la marche réelle : les chemins piétons sont ~1.4x la distance
        // euclidienne, et Google marche à 60 m/min vs notre estimation à 75 m/min.
        // Facteur = 1.4 × (75/60) = 1.75 → les estimations reflètent le temps réel.
        const walk = route.places.length === 0 ? 0 : Math.ceil(walkingMinutes(previous, place.coordinate) * 1.75);
        const visit = effectiveVisitDuration(place.category, request.walking);
        const arrival = new Date(
          now.getTime() +
            (outboundMinutes + route.walkingMinutes + route.visitMinutes + walk) * 60_000
        );
        const opening = isOpenForVisit(place, arrival, visit, isScheduled);
        if (!opening.allowed) continue;

        const nextWalking = route.walkingMinutes + walk;
        const nextVisit = route.visitMinutes + visit;
        const total = outboundMinutes + returnMinutes + nextWalking + nextVisit;
        if (nextWalking > maxWalking || total > usableMinutes) continue;

        const existingCategories = new Set(route.places.map((item) => item.category));
        const next: ScoredRoute = {
          places: [...route.places, place],
          outboundMinutes,
          returnMinutes,
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
              travelPenalty: request.walking === "high" ? 0 : walk * 0.25
            })
        };
        expanded.push(next);
        if (next.places.length >= 2) completed.push(next);
      }
    }

    beam = expanded.sort((a, b) => b.score - a.score).slice(0, BEAM_WIDTH);
    if (beam.length === 0) break;
  }

  const minStops = minStopsRequired(request.walking, request.durationMinutes);
  const minWalk = minWalkingRequired(request.walking, maxWalking);

  // Progressive filtering: prioritise routes meeting walk + stop requirements
  // Fallback to just min stops, then to all completed routes
  let filtered = completed.filter(
    (r) => r.places.length >= minStops && r.walkingMinutes >= minWalk
  );
  if (filtered.length === 0) filtered = completed.filter((r) => r.places.length >= minStops);
  if (filtered.length === 0) filtered = completed;

  const walkWeight = request.walking === "high" ? 2.0 : request.walking === "medium" ? 0.3 : 0;
  return filtered
    .sort(
      (a, b) =>
        b.score - a.score +
        walkWeight * (b.walkingMinutes - a.walkingMinutes) ||
        b.places.length - a.places.length
    )
    .slice(0, 3);
}
