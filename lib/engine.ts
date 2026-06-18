import { buildRoutes } from "@/lib/domain/beam-search";
import { walkingMinutes } from "@/lib/domain/geo";
import {
  effectiveVisitDuration,
  nearbyRadius,
  safetyMargin,
  walkingBudget
} from "@/lib/domain/trip-rules";
import { createProviders } from "@/lib/providers/factory";
import { GoogleApiError } from "@/lib/providers/google";
import type {
  AnchorLog,
  EngineStats,
  GenerateTripRequest,
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

  // Leg aller : depuis l'origine, sauf en mode arrivée où le user rejoint le 1er stop par ses propres moyens
  const first = route.places[0];
  if (!request.destination) {
    const outbound = await routing.route(
      request.origin,
      first.coordinate,
      "WALK",
      "Position actuelle",
      first.name,
      isScheduled ? now : undefined
    ).catch((error) => {
      if (error instanceof GoogleApiError) throw error;
      throw new NoReliableTripError(error instanceof Error ? error.message : "Aucun itinéraire disponible.");
    });
    legs.push(outbound);
    cursor = addMinutes(cursor, outbound.durationMinutes);
  }

  // Stops et legs inter-stops
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
    const visitMins = effectiveVisitDuration(place.category, request.walking);
    const arrival = cursor;
    cursor = addMinutes(cursor, visitMins);
    stops.push({
      place,
      arrivalAt: arrival.toISOString(),
      departureAt: cursor.toISOString(),
      visitMinutes: visitMins,
      reason: reranker.explain(place, request),
      warning: isScheduled && ["cafe", "restaurant", "museum"].includes(place.category)
        ? "Horaires à vérifier pour la date planifiée"
        : place.openingHours ? undefined : "Horaires non vérifiés"
    });
  }

  // Leg final : vers destination si définie — sinon la balade se termine au dernier stop
  if (request.destination) {
    const last = route.places.at(-1)!;
    const final = await routing.route(
      last.coordinate,
      request.destination,
      "WALK",
      last.name,
      "Destination",
      isScheduled ? cursor : undefined
    ).catch((error) => {
      if (error instanceof GoogleApiError) throw error;
      throw new NoReliableTripError(error instanceof Error ? error.message : "Impossible d'atteindre la destination.");
    });
    legs.push(final);
  }

  return { stops, legs };
}

export async function generateTrip(
  request: GenerateTripRequest
): Promise<{ plan: TripPlan; stats: EngineStats }> {
  const providers = createProviders();
  const now = resolveNow(request);
  const visitedIds = new Set(request.excludedPlaceIds ?? []);
  const rejectedIds = new Set(request.excludedPlaceIds ?? []);
  const isScheduled = Boolean(request.departureAt || request.arrivalBy);

  const radius = nearbyRadius(request.walking, request.durationMinutes);
  // Mode arrivée : chercher près de la destination, pas de l'origine
  const searchCenter = request.destination ?? request.origin;
  const nearby = await providers.discovery.findNearby(searchCenter, radius, request.mood);
  const candidates = await providers.verifier.verify(nearby);
  console.log(`[trip] nearby from ${request.destination ? "destination" : "origin"}: ${candidates.length} places (radius=${radius}m, walking=${request.walking})`);

  if (candidates.length === 0) {
    throw new NoReliableTripError("Aucun lieu trouvé à proximité pour une balade.");
  }

  // Chaque candidat peut être le premier stop — exclure les lieux déjà vus/rejetés comme anchor
  const anchorCandidates = candidates.filter((c) => !visitedIds.has(c.id));
  const anchorData = await Promise.all(
    anchorCandidates.map(async (anchor) => {
      // Mode arrivée : pas d'outbound walk depuis l'origine, le user se débrouille pour arriver au 1er stop
      const outboundMinutes = request.destination
        ? 0
        : Math.ceil(walkingMinutes(request.origin, anchor.coordinate) * 1.75);
      const secondaryPool = candidates.filter((p) => p.id !== anchor.id);

      const routes = buildRoutes({
        request,
        anchor,
        nearby: secondaryPool,
        outboundMinutes,
        returnMinutes: 0, // pas de boucle retour
        visitedIds,
        rejectedIds,
        now,
        isScheduled,
        destination: request.destination
      });

      console.log(`[trip] anchor "${anchor.name}": outbound=${outboundMinutes}min, routes=${routes.length}`);
      return { routes, anchor, outboundMinutes };
    })
  );

  const allRoutes = anchorData.flatMap((d) => d.routes);
  const walkTarget = walkingBudget(request.walking, request.durationMinutes);
  const withWalkScore = (route: ScoredRoute) =>
    route.score + (Math.min(route.walkingMinutes, walkTarget) / walkTarget) * 100;
  const candidates3 = allRoutes.sort((a, b) => withWalkScore(b) - withWalkScore(a)).slice(0, 3);
  console.log(`[trip] allRoutes=${allRoutes.length}, candidates=${candidates3.length}`);

  if (candidates3.length === 0) {
    throw new NoReliableTripError("Aucune balade disponible pour ces contraintes.");
  }

  const chosenIndex = await providers.reranker.choose(candidates3, request);
  const chosen = candidates3[chosenIndex] ?? candidates3[0];

  const { stops, legs } = await makeStopsAndLegs(chosen, request, now, providers.reranker, providers.routing);

  const walkingMinutesTotal = legs
    .filter((leg) => leg.mode === "WALK")
    .reduce((sum, leg) => sum + leg.durationMinutes, 0);
  const visitMinutes = stops.reduce((sum, stop) => sum + stop.visitMinutes, 0);
  const totalMinutes = walkingMinutesTotal + visitMinutes;
  const margin = safetyMargin(request.durationMinutes);
  console.log(`[trip] final: total=${totalMinutes}min, budget=${request.durationMinutes - margin}min (margin=${margin}min)`);

  if (totalMinutes > request.durationMinutes - margin) {
    throw new NoReliableTripError("La balade dépasse le temps disponible.");
  }

  const anchorLogs: AnchorLog[] = anchorData.map((d) => ({
    anchorId: d.anchor.id,
    anchorName: d.anchor.name,
    lat: d.anchor.coordinate.lat,
    lng: d.anchor.coordinate.lng,
    outboundMinutes: d.outboundMinutes,
    returnMinutes: 0,
    withinTransitLimit: true,
    nearbyCount: candidates.length - 1,
    routesBuilt: d.routes.length
  }));

  const selectedIds = new Set(chosen.places.map((p) => p.id));
  const stats: EngineStats = {
    anchorCount: candidates.length,
    nearbyCount: candidates.length,
    routesConsidered: allRoutes.length,
    anchors: anchorLogs,
    nearbyPlaces: candidates.map((p) => ({
      anchorId: "",
      placeId: p.id,
      placeName: p.name,
      category: p.category,
      lat: p.coordinate.lat,
      lng: p.coordinate.lng,
      signalUnusual: p.signals.unusual,
      signalQuality: p.signals.quality,
      signalDescriptive: p.signals.descriptive,
      signalChainPenalty: p.signals.chainPenalty,
      wasSelected: selectedIds.has(p.id)
    }))
  };

  const plan: TripPlan = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    request,
    title: titleFor(chosen, request),
    summary: request.destination
      ? `${stops.length} étapes à pied vers ta destination.`
      : `${stops.length} étapes à pied depuis ta position.`,
    startsAt: now.toISOString(),
    returnsAt: addMinutes(now, totalMinutes).toISOString(),
    totalMinutes,
    safetyMarginMinutes: request.durationMinutes - totalMinutes,
    transitMinutes: 0,
    walkingMinutes: walkingMinutesTotal,
    visitMinutes,
    stops,
    legs,
    warnings: stops.flatMap((stop) => (stop.warning ? [`${stop.place.name} : ${stop.warning}`] : [])),
    score: chosen.score,
    status: "suggested"
  };
  return { plan, stats };
}
