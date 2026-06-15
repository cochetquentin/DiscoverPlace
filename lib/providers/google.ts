import { config } from "@/lib/config";
import { distanceMeters, walkingMinutes } from "@/lib/domain/geo";
import type {
  Coordinate,
  GenerateTripRequest,
  Mood,
  PlaceCandidate,
  PlaceCategory,
  RouteLeg
} from "@/lib/types";
import type {
  DiscoveryProvider,
  PlaceVerifier,
  RoutingProvider
} from "@/lib/providers/interfaces";

const GOOGLE_PLACES = "https://places.googleapis.com/v1";
const GOOGLE_ROUTES = "https://routes.googleapis.com";

const queryByMood: Record<Mood, string[]> = {
  surprise: ["東京 穴場 観光", "東京 面白い場所", "東京 レトロ 散歩"],
  unusual: ["東京 珍スポット", "東京 不思議な場所", "東京 隠れた名所"],
  nature: ["東京 庭園 穴場", "東京 自然 散歩", "東京 渓谷"],
  culture: ["東京 小さな博物館", "東京 建築 見学", "東京 歴史 散歩"],
  food: ["東京 個性的 カフェ", "東京 老舗 食堂", "東京 レトロ 喫茶"]
};

function mapCategory(primaryType = "", types: string[] = []): PlaceCategory {
  const all = [primaryType, ...types].join(" ");
  if (/restaurant|food/.test(all)) return "restaurant";
  if (/cafe|coffee/.test(all)) return "cafe";
  if (/museum|gallery/.test(all)) return "museum";
  if (/park|garden|natural/.test(all)) return "park";
  if (/shrine|temple|place_of_worship/.test(all)) return "temple";
  if (/viewpoint/.test(all)) return "viewpoint";
  if (/art/.test(all)) return "art";
  return "attraction";
}

function normalizePlace(raw: Record<string, unknown>): PlaceCandidate | null {
  const location = raw.location as { latitude?: number; longitude?: number } | undefined;
  const displayName = raw.displayName as { text?: string } | undefined;
  if (!location?.latitude || !location.longitude || !displayName?.text) return null;
  const id = String(raw.id ?? raw.name ?? displayName.text);
  const types = Array.isArray(raw.types) ? raw.types.map(String) : [];
  const primaryType = String(raw.primaryType ?? "");
  const rating = typeof raw.rating === "number" ? raw.rating : undefined;
  const ratingCount = typeof raw.userRatingCount === "number" ? raw.userRatingCount : undefined;
  const hours = raw.currentOpeningHours as
    | { openNow?: boolean; nextCloseTime?: string }
    | undefined;

  return {
    id: `google:${id}`,
    externalId: id,
    source: "google",
    name: displayName.text,
    coordinate: { lat: location.latitude, lng: location.longitude },
    category: mapCategory(primaryType, types),
    types,
    googleMapsUri: typeof raw.googleMapsUri === "string" ? raw.googleMapsUri : undefined,
    rating,
    ratingCount,
    businessStatus: typeof raw.businessStatus === "string" ? raw.businessStatus : undefined,
    openingHours: hours,
    signals: {
      unusual: Math.max(0.25, 1 - Math.log10((ratingCount ?? 20) + 1) / 5),
      quality: rating ? Math.max(0, (rating - 3.2) / 1.8) : 0.5,
      descriptive: primaryType ? 0.55 : 0.3,
      chainPenalty: 0
    }
  };
}

export class GoogleApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly service: string,
    message: string
  ) {
    super(`${service} : ${message}`);
  }
}

async function googleFetch<T>(
  path: string,
  body: unknown,
  fieldMask: string,
  service: string
): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": config.googleServerKey,
      "X-Goog-FieldMask": fieldMask
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8_000)
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: { message?: string; status?: string } }
      | null;
    const reason =
      payload?.error?.message ??
      payload?.error?.status ??
      `requête refusée avec le statut HTTP ${response.status}`;
    throw new GoogleApiError(response.status, service, reason);
  }
  return response.json() as Promise<T>;
}

export class GoogleDiscoveryProvider implements DiscoveryProvider {
  async findAnchors(request: GenerateTripRequest): Promise<PlaceCandidate[]> {
    const allQueries = [...queryByMood[request.mood]].sort(() => Math.random() - 0.5);
    const queries = allQueries.slice(0, 2);
    const results = await Promise.all(
      queries.map((textQuery) =>
        googleFetch<{ places?: Record<string, unknown>[] }>(
          `${GOOGLE_PLACES}/places:searchText`,
          {
            textQuery,
            languageCode: "fr",
            regionCode: "JP",
            pageSize: 8,
            locationBias: {
              circle: {
                center: {
                  latitude: request.origin.lat,
                  longitude: request.origin.lng
                },
                radius: request.durationMinutes <= 120 ? 12_000 : 35_000
              }
            }
          },
          "places.id,places.displayName,places.location,places.primaryType,places.types,places.googleMapsUri,places.businessStatus,places.rating,places.userRatingCount,places.currentOpeningHours",
          "Places API Text Search"
        )
      )
    );
    return results.flatMap((result) => result.places ?? []).map(normalizePlace).filter(Boolean) as PlaceCandidate[];
  }

  async findNearby(center: Coordinate, radiusMeters: number, mood: Mood): Promise<PlaceCandidate[]> {
    void mood;
    const response = await googleFetch<{ places?: Record<string, unknown>[] }>(
      `${GOOGLE_PLACES}/places:searchNearby`,
      {
        languageCode: "fr",
        regionCode: "JP",
        maxResultCount: 20,
        rankPreference: radiusMeters >= 3000 ? "POPULARITY" : "DISTANCE",
        locationRestriction: {
          circle: {
            center: { latitude: center.lat, longitude: center.lng },
            radius: Math.min(radiusMeters, 50_000)
          }
        },
        includedTypes: [
          "tourist_attraction",
          "museum",
          "park",
          "cafe",
          "restaurant",
          "art_gallery",
          "amusement_park",
          "aquarium",
          "zoo"
        ]
      },
      "places.id,places.displayName,places.location,places.primaryType,places.types,places.googleMapsUri,places.businessStatus,places.rating,places.userRatingCount,places.currentOpeningHours",
      "Places API Nearby Search"
    );
    return (response.places ?? []).map(normalizePlace).filter(Boolean) as PlaceCandidate[];
  }
}

export class GooglePlaceVerifier implements PlaceVerifier {
  async verify(places: PlaceCandidate[]): Promise<PlaceCandidate[]> {
    return places.filter((place) => place.businessStatus !== "CLOSED_PERMANENTLY");
  }
}

const durationMinutes = (value?: string) => Math.ceil(Number(value?.replace("s", "") ?? 0) / 60);

function estimatedTransitMinutes(from: Coordinate, to: Coordinate): number {
  return Math.max(12, Math.ceil(distanceMeters(from, to) / 430) + 8);
}

export class GoogleRoutingProvider implements RoutingProvider {
  async matrix(origin: Coordinate, destinations: PlaceCandidate[], mode: "TRANSIT" | "WALK", departureTime?: Date, arrivalTime?: Date) {
    if (destinations.length === 0) return new Map<string, number>();
    const isScheduledTransit = mode === "TRANSIT" && (!!departureTime || !!arrivalTime);
    const response = await googleFetch<
      { destinationIndex?: number; duration?: string; condition?: string }[]
    >(
      `${GOOGLE_ROUTES}/distanceMatrix/v2:computeRouteMatrix`,
      {
        origins: [{ waypoint: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } } }],
        destinations: destinations.map((destination) => ({
          waypoint: {
            location: {
              latLng: {
                latitude: destination.coordinate.lat,
                longitude: destination.coordinate.lng
              }
            }
          }
        })),
        travelMode: mode,
        ...(mode === "TRANSIT" && departureTime ? { departureTime: departureTime.toISOString() } : {}),
        ...(mode === "TRANSIT" && arrivalTime && !departureTime ? { arrivalTime: arrivalTime.toISOString() } : {})
      },
      "destinationIndex,duration,condition",
      "Routes API Compute Route Matrix"
    ).catch((error) => {
      // Pour un transit planifié, ne jamais substituer des estimations géométriques
      // à des données de trafic réelles — même en cas de 429.
      if (error instanceof GoogleApiError && error.status === 429 && !isScheduledTransit) {
        return destinations.map((destination, destinationIndex) => ({
          destinationIndex,
          duration: `${(mode === "WALK"
            ? walkingMinutes(origin, destination.coordinate)
            : estimatedTransitMinutes(origin, destination.coordinate)) * 60}s`,
          condition: "ROUTE_EXISTS"
        }));
      }
      throw error;
    });
    const durations = new Map(
      response
        .filter(
          (item) =>
            item.destinationIndex !== undefined &&
            item.duration &&
            (!item.condition || item.condition === "ROUTE_EXISTS")
        )
        .map((item) => [destinations[item.destinationIndex!].id, durationMinutes(item.duration)])
    );
    if (durations.size > 0) return durations;
    // Pour un transit planifié à une heure précise, une réponse vide signifie
    // aucun service disponible — ne pas estimer géométriquement.
    if (isScheduledTransit) return new Map<string, number>();

    return new Map(
      destinations.map((destination) => [
        destination.id,
        mode === "WALK"
          ? walkingMinutes(origin, destination.coordinate)
          : estimatedTransitMinutes(origin, destination.coordinate)
      ])
    );
  }

  async route(
    from: Coordinate,
    to: Coordinate,
    mode: "TRANSIT" | "WALK",
    fromName: string,
    toName: string,
    departureTime?: Date
  ): Promise<RouteLeg> {
    const response = await googleFetch<{
      routes?: {
        duration?: string;
        distanceMeters?: number;
        polyline?: { encodedPolyline?: string };
      }[];
    }>(
      `${GOOGLE_ROUTES}/directions/v2:computeRoutes`,
      {
        origin: { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
        destination: { location: { latLng: { latitude: to.lat, longitude: to.lng } } },
        travelMode: mode,
        languageCode: "fr-FR",
        units: "METRIC",
        ...(mode === "TRANSIT" && departureTime ? { departureTime: departureTime.toISOString() } : {})
      },
      "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
      "Routes API Compute Routes"
    ).catch((error) => {
      // Pour un transit planifié, ne pas substituer des estimations géométriques — même en cas de 429.
      if (error instanceof GoogleApiError && error.status === 429 && !(mode === "TRANSIT" && departureTime)) {
        return {
          routes: [
            {
              duration: `${(mode === "WALK" ? walkingMinutes(from, to) : estimatedTransitMinutes(from, to)) * 60}s`,
              distanceMeters: distanceMeters(from, to),
              polyline: undefined
            }
          ]
        };
      }
      throw error;
    });
    const firstRoute = response.routes?.[0];
    // Pour un transit planifié, une réponse vide = aucun service à cette heure
    if (!firstRoute && mode === "TRANSIT" && departureTime) {
      throw new Error("Aucun itinéraire de transport disponible à l'heure planifiée.");
    }
    const route = firstRoute ?? {
      duration: `${(mode === "WALK" ? walkingMinutes(from, to) : estimatedTransitMinutes(from, to)) * 60}s`,
      distanceMeters: distanceMeters(from, to),
      polyline: undefined
    };
    return {
      mode,
      from: fromName,
      to: toName,
      durationMinutes: durationMinutes(route.duration),
      distanceMeters: route.distanceMeters,
      polyline: route.polyline?.encodedPolyline
    };
  }
}
