import type {
  Coordinate,
  GenerateTripRequest,
  Mood,
  PlaceCandidate,
  RouteLeg,
  ScoredRoute
} from "@/lib/types";

export interface DiscoveryProvider {
  findAnchors(request: GenerateTripRequest): Promise<PlaceCandidate[]>;
  findNearby(center: Coordinate, radiusMeters: number, mood: Mood): Promise<PlaceCandidate[]>;
}

export interface PlaceVerifier {
  verify(places: PlaceCandidate[]): Promise<PlaceCandidate[]>;
}

export interface RoutingProvider {
  matrix(
    origin: Coordinate,
    destinations: PlaceCandidate[],
    mode: "TRANSIT" | "WALK",
    departureTime?: Date,
    arrivalTime?: Date
  ): Promise<Map<string, number>>;
  route(
    from: Coordinate,
    to: Coordinate,
    mode: "TRANSIT" | "WALK",
    fromName: string,
    toName: string,
    departureTime?: Date
  ): Promise<RouteLeg>;
}

export interface RouteReranker {
  choose(routes: ScoredRoute[], request: GenerateTripRequest): Promise<number>;
  explain(place: PlaceCandidate, request: GenerateTripRequest): string;
}

export type ProviderBundle = {
  discovery: DiscoveryProvider;
  verifier: PlaceVerifier;
  routing: RoutingProvider;
  reranker: RouteReranker;
};
