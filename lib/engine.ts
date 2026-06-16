import { buildRoutes } from "@/lib/domain/beam-search";
import { deduplicatePlaces } from "@/lib/domain/scoring";
import {
  effectiveVisitDuration,
  maxTransitLeg,
  nearbyRadius,
  safetyMargin
} from "@/lib/domain/trip-rules";
import { createProviders } from "@/lib/providers/factory";
import { GoogleApiError } from "@/lib/providers/google";
import type {
  EngineStats,
  GenerateTripRequest,
  PlaceCandidate,
  RouteLeg,
  ScoredRoute,
  TripPlan,
  TripStop
} from "@/lib/types";

export class NoReliableTripError extends Error {}

const addMinutes = (date: Date, minutes: number) =>
  new Date(date.getTime() + minutes * 60_000);

function planningNow() {
  return new Date();
}

function resolveNow(request: GenerateTripRequest): Date {
  if (request.departureAt) return new Date(request.departureAt);
  if (request.arrivalBy) {
    return new Date(new Date(request.arrivalBy).getTime() - request.durationMinutes * 60_000);
  }
  return planningNow();
}

function titleFor(route: ScoredRoute, request: GenerateTripRequest) {
  const mood = {
    surprise: "Surprise locale",
    unusual: "Tokyo inattendu",
    nature: "Respiration verte",
    culture: "Curiosités culturelles",
    food: "Escapade gourmande"
  }[request.mood];
  return `${mood} vers ${route.places[0].name}`;
}

async function makeStopsAndLegs(
  route: ScoredRoute,
  request: GenerateTripRequest,
  now: Date,
  reranker: ReturnType<typeof createProviders>["reranker"],
  routing: ReturnType<typeof createProviders>["routing"]
): Promise<{ stops: TripStop[]; legs: RouteLeg[] }> {
  const stops: TripStop[] = [];
  const legs: RouteLeg[] = [];
  let cursor = now;
  const isScheduled = Boolean(request.departureAt || request.arrivalBy);

  const first = route.places[0];
  const outbound = await routing.route(
    request.origin,
    first.coordinate,
    "TRANSIT",
    "Position actuelle",
    first.name,
    isScheduled ? now : undefined
  ).catch((error) => {
    if (error instanceof GoogleApiError) throw error;
    throw new NoReliableTripError(error instanceof Error ? error.message : "Aucun itinéraire disponible.");
  });
  legs.push(outbound);
  cursor = addMinutes(cursor, outbound.durationMinutes);

  for (let index = 0; index < route.places.length; index += 1) {
    const place = route.places[index];
    if (index > 0) {
      const previous = route.places[index - 1];
      const leg = await routing.route(
        previous.coordinate,
        place.coordinate,
        "WALK",
        previous.name,
        place.name
      );
      legs.push(leg);
      cursor = addMinutes(cursor, leg.durationMinutes);
    }
    const visitMinutes = effectiveVisitDuration(place.category, request.walking);
    const arrival = cursor;
    cursor = addMinutes(cursor, visitMinutes);
    stops.push({
      place,
      arrivalAt: arrival.toISOString(),
      departureAt: cursor.toISOString(),
      visitMinutes,
      reason: reranker.explain(place, request),
      warning: isScheduled && ["cafe", "restaurant", "museum"].includes(place.category)
        ? "Horaires à vérifier pour la date planifiée"
        : place.openingHours ? undefined : "Horaires non vérifiés"
    });
  }

  const last = route.places.at(-1)!;
  const inbound = await routing.route(
    last.coordinate,
    request.origin,
    "TRANSIT",
    last.name,
    "Position actuelle",
    isScheduled ? cursor : undefined
  ).catch((error) => {
    if (error instanceof GoogleApiError) throw error;
    throw new NoReliableTripError(error instanceof Error ? error.message : "Aucun itinéraire de retour disponible.");
  });
  legs.push(inbound);
  return { stops, legs };
}

async function returnMinutesFor(
  routing: ReturnType<typeof createProviders>["routing"],
  origin: GenerateTripRequest["origin"],
  anchor: PlaceCandidate,
  departureTime?: Date,
  arrivalTime?: Date
) {
  const originCandidate: PlaceCandidate = {
    id: "origin",
    source: "demo",
    name: "Position actuelle",
    coordinate: origin,
    category: "micro",
    types: [],
    signals: { unusual: 0, quality: 0, descriptive: 0, chainPenalty: 0 }
  };
  return (await routing.matrix(anchor.coordinate, [originCandidate], "TRANSIT", departureTime, arrivalTime)).get("origin");
}

export async function generateTrip(
  request: GenerateTripRequest
): Promise<{ plan: TripPlan; stats: EngineStats }> {
  const providers = createProviders();
  const now = resolveNow(request);
  const transitLimit = maxTransitLeg(request.durationMinutes);
  const visitedIds = new Set(request.excludedPlaceIds ?? []);
  const rejectedIds = new Set(request.excludedPlaceIds ?? []);

  const rawAnchors = await providers.discovery.findAnchors(request);
  const anchors = await providers.verifier.verify(deduplicatePlaces(rawAnchors));
  const anchorCount = anchors.length;
  const anchorsForRouting = anchors.slice(0, 12);
  console.log(`[trip] anchors: ${rawAnchors.length} raw → ${anchors.length} verified`);
  const isScheduled = Boolean(request.departureAt || request.arrivalBy);
  const outbound = await providers.routing.matrix(
    request.origin,
    anchorsForRouting,
    "TRANSIT",
    isScheduled ? now : undefined
  );
  console.log(`[trip] matrix: ${outbound.size}/${anchorsForRouting.length} reachable, transitLimit=${transitLimit}min`);
  if (anchorsForRouting.length === 0) {
    throw new NoReliableTripError("Google n’a renvoyé aucun lieu exploitable pour cette recherche.");
  }

  const eligible = anchorsForRouting
    .filter((anchor) => (outbound.get(anchor.id) ?? Infinity) <= transitLimit)
    .sort((a, b) => (outbound.get(a.id) ?? Infinity) - (outbound.get(b.id) ?? Infinity))
    .slice(0, 10);

  console.log(`[trip] eligible: ${eligible.length} anchors (transitLimit=${transitLimit}min)`);
  if (eligible.length === 0) {
    const minOutbound = Math.min(...Array.from(outbound.values()));
    throw new NoReliableTripError(
      `J’ai trouvé ${anchors.length} lieux, mais aucun n’est atteignable avec la limite de transport actuelle. Le plus proche semble à ${Number.isFinite(minOutbound) ? minOutbound : "?"} min. Essaie 4h/6h ou vérifie ta position de départ.`
    );
  }

  let nearbyCount = 0;
  const anchorData = await Promise.all(
    eligible.slice(0, 3).map(async (anchor) => {
      const [nearby, returnMinutes] = await Promise.all([
        providers.discovery.findNearby(anchor.coordinate, nearbyRadius(request.walking), request.mood),
        returnMinutesFor(
          providers.routing,
          request.origin,
          anchor,
          undefined,
          // departureAt : le deadline est l'heure d'arrivée souhaitée à l'origine (now + durationMinutes)
          // arrivalBy : idem, on cherche un trajet arrivant avant la deadline
          isScheduled
            ? new Date(
                request.arrivalBy
                  ? new Date(request.arrivalBy).getTime()
                  : now.getTime() + request.durationMinutes * 60_000
              )
            : undefined
        )
      ]);
      if (returnMinutes === undefined || returnMinutes > transitLimit) {
        console.log(`[trip] anchor "${anchor.name}": return=${returnMinutes ?? "n/a"}min > limit, skipped`);
        return [];
      }
      const verifiedNearby = await providers.verifier.verify(nearby);
      nearbyCount += verifiedNearby.length;
      const builtRoutes = buildRoutes({
        request,
        anchor,
        nearby: verifiedNearby,
        outboundMinutes: outbound.get(anchor.id)!,
        returnMinutes,
        visitedIds,
        rejectedIds,
        now,
        isScheduled
      });
      console.log(`[trip] anchor "${anchor.name}": return=${returnMinutes}min, nearby=${verifiedNearby.length}, routes=${builtRoutes.length}`);
      return builtRoutes;
    })
  );

  const allRoutes = anchorData.flat();
  const candidates = allRoutes.sort((a, b) => b.score - a.score).slice(0, 3);
  console.log(`[trip] allRoutes=${allRoutes.length}, candidates=${candidates.length}`);
  if (candidates.length === 0) {
    throw new NoReliableTripError("Aucune sortie fiable n’est disponible pour ces contraintes.");
  }

  const chosenIndex = await providers.reranker.choose(candidates, request);
  const chosen = candidates[chosenIndex] ?? candidates[0];
  const { stops, legs } = await makeStopsAndLegs(
    chosen,
    request,
    now,
    providers.reranker,
    providers.routing
  );
  const transitMinutes = legs
    .filter((leg) => leg.mode === "TRANSIT")
    .reduce((sum, leg) => sum + leg.durationMinutes, 0);
  const walkingMinutes = legs
    .filter((leg) => leg.mode === "WALK")
    .reduce((sum, leg) => sum + leg.durationMinutes, 0);
  const visitMinutes = stops.reduce((sum, stop) => sum + stop.visitMinutes, 0);
  const totalMinutes = transitMinutes + walkingMinutes + visitMinutes;
  const margin = safetyMargin(request.durationMinutes);
  console.log(`[trip] final: total=${totalMinutes}min, budget=${request.durationMinutes - margin}min (margin=${margin}min)`);
  if (totalMinutes > request.durationMinutes - margin) {
    throw new NoReliableTripError("Le trajet final ne laisse pas assez de marge pour rentrer.");
  }

  const stats: EngineStats = {
    anchorCount,
    nearbyCount,
    routesConsidered: allRoutes.length
  };

  const plan: TripPlan = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    request,
    title: titleFor(chosen, request),
    summary: `${stops.length} étapes choisies pour privilégier la surprise sans dépasser ton temps.`,
    startsAt: now.toISOString(),
    returnsAt: addMinutes(now, totalMinutes).toISOString(),
    totalMinutes,
    safetyMarginMinutes: request.durationMinutes - totalMinutes,
    transitMinutes,
    walkingMinutes,
    visitMinutes,
    stops,
    legs,
    warnings: stops.flatMap((stop) => (stop.warning ? [`${stop.place.name} : ${stop.warning}`] : [])),
    score: chosen.score,
    status: "suggested"
  };
  return { plan, stats };
}
