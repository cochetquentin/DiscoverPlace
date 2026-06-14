import { distanceMeters, walkingMinutes } from "@/lib/domain/geo";
import { scorePlace } from "@/lib/domain/scoring";
import type {
  Coordinate,
  GenerateTripRequest,
  Mood,
  PlaceCandidate,
  RouteLeg,
  ScoredRoute
} from "@/lib/types";
import type {
  DiscoveryProvider,
  PlaceVerifier,
  RouteReranker,
  RoutingProvider
} from "@/lib/providers/interfaces";

const place = (
  id: string,
  name: string,
  lat: number,
  lng: number,
  category: PlaceCandidate["category"],
  description: string,
  unusual: number,
  quality = 0.8
): PlaceCandidate => ({
  id,
  source: "demo",
  name,
  coordinate: { lat, lng },
  category,
  types: [category],
  description,
  googleMapsUri: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
  rating: 4.4,
  ratingCount: 120,
  openingHours: ["cafe", "restaurant", "museum", "attraction"].includes(category)
    ? {
        openNow: true,
        nextCloseTime: new Date(Date.now() + 8 * 60 * 60_000).toISOString()
      }
    : undefined,
  signals: {
    unusual,
    quality,
    descriptive: description.length > 40 ? 1 : 0.6,
    chainPenalty: 0
  }
});

const DEMO_PLACES = [
  place(
    "demo-yanaka",
    "Yanaka Ginza et ses ruelles",
    35.7274,
    139.7656,
    "attraction",
    "Un quartier ancien, vivant et compact où le trajet vaut autant que la destination.",
    0.72
  ),
  place(
    "demo-asakura",
    "Musée de sculpture Asakura",
    35.7271,
    139.7684,
    "museum",
    "Ancienne maison-atelier avec jardin intérieur et architecture inattendue.",
    0.86
  ),
  place(
    "demo-himalaya",
    "Himalaya Cedar",
    35.7247,
    139.7645,
    "micro",
    "Un immense cèdre devenu repère du vieux quartier de Yanaka.",
    0.96
  ),
  place(
    "demo-nezujinja",
    "Nezu-jinja",
    35.7202,
    139.7605,
    "temple",
    "Sanctuaire paisible connu pour son petit chemin de torii rouges.",
    0.7
  ),
  place(
    "demo-kayaba",
    "Kayaba Coffee",
    35.7233,
    139.7669,
    "cafe",
    "Café rétro installé dans une maison de quartier historique.",
    0.83
  ),
  place(
    "demo-kagurazaka",
    "Ruelles de Kagurazaka",
    35.7017,
    139.7381,
    "attraction",
    "Escaliers, passages étroits et traces de l’ancien quartier de geishas.",
    0.82
  ),
  place(
    "demo-akagi",
    "Akagi-jinja",
    35.7042,
    139.7348,
    "temple",
    "Un sanctuaire reconstruit dans un style contemporain très tokyoïte.",
    0.88
  ),
  place(
    "demo-printing",
    "Musée de l’imprimerie",
    35.7083,
    139.7458,
    "museum",
    "Petit musée spécialisé qui raconte comment les idées ont pris forme sur papier.",
    0.9
  ),
  place(
    "demo-koishikawa",
    "Koishikawa Korakuen",
    35.7055,
    139.7498,
    "park",
    "Jardin historique aux paysages miniatures caché près du Tokyo Dome.",
    0.7
  ),
  place(
    "demo-todoroki",
    "Vallée de Todoroki",
    35.605,
    139.6474,
    "park",
    "Un ravin boisé surprenant au milieu de l’ouest tokyoïte.",
    0.92
  ),
  place(
    "demo-gotokuji",
    "Gotokuji",
    35.6487,
    139.647,
    "temple",
    "Temple calme célèbre pour ses centaines de maneki-neko.",
    0.86
  ),
  place(
    "demo-setagaya-line",
    "Ligne Setagaya",
    35.6468,
    139.6531,
    "attraction",
    "Petit tramway local qui donne au trajet une ambiance de voyage miniature.",
    0.88
  )
];

export class DemoDiscoveryProvider implements DiscoveryProvider {
  async findAnchors(request: GenerateTripRequest): Promise<PlaceCandidate[]> {
    return DEMO_PLACES.map((candidate) => ({
      ...candidate,
      signals: {
        ...candidate.signals,
        quality: Math.min(
          1,
          scorePlace(candidate, {
            mood: request.mood,
            visitedIds: new Set(),
            rejectedIds: new Set(),
            existingCategories: new Set()
          }) / 100
        )
      }
    }));
  }

  async findNearby(center: Coordinate, radiusMeters: number, mood: Mood) {
    void mood;
    return DEMO_PLACES.filter(
      (candidate) =>
        candidate.coordinate !== center &&
        distanceMeters(center, candidate.coordinate) <= Math.max(radiusMeters, 2200)
    );
  }
}

export class PassthroughVerifier implements PlaceVerifier {
  async verify(places: PlaceCandidate[]) {
    return places;
  }
}

export class DemoRoutingProvider implements RoutingProvider {
  async matrix(origin: Coordinate, destinations: PlaceCandidate[], mode: "TRANSIT" | "WALK", _departureTime?: Date) {
    return new Map(
      destinations.map((destination) => {
        const distance = distanceMeters(origin, destination.coordinate);
        const duration =
          mode === "WALK"
            ? walkingMinutes(origin, destination.coordinate)
            : Math.max(12, Math.ceil(distance / 430) + 8);
        return [destination.id, duration];
      })
    );
  }

  async route(
    from: Coordinate,
    to: Coordinate,
    mode: "TRANSIT" | "WALK",
    fromName: string,
    toName: string,
    _departureTime?: Date
  ): Promise<RouteLeg> {
    const duration =
      mode === "WALK"
        ? walkingMinutes(from, to)
        : Math.max(12, Math.ceil(distanceMeters(from, to) / 430) + 8);
    return {
      mode,
      from: fromName,
      to: toName,
      durationMinutes: duration,
      distanceMeters: distanceMeters(from, to),
      instructions:
        mode === "TRANSIT"
          ? ["Rejoins la gare la plus proche", "Suis l’itinéraire proposé dans Google Maps"]
          : [`Marche vers ${toName}`]
    };
  }
}

export class DeterministicReranker implements RouteReranker {
  async choose(routes: ScoredRoute[]): Promise<number> {
    return routes.reduce(
      (best, route, index) => (route.score > routes[best].score ? index : best),
      0
    );
  }

  explain(placeCandidate: PlaceCandidate): string {
    return (
      placeCandidate.description ??
      `${placeCandidate.name} ajoute une étape ${placeCandidate.category} cohérente au parcours.`
    );
  }
}
