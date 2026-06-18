export const DURATIONS = [120, 240, 360] as const;
export const MOODS = ["surprise", "unusual", "nature", "culture", "food"] as const;
export const WALKING_LEVELS = ["low", "medium", "high"] as const;

export type DurationMinutes = (typeof DURATIONS)[number];
export type Mood = (typeof MOODS)[number];
export type WalkingLevel = (typeof WALKING_LEVELS)[number];
export type Coordinate = { lat: number; lng: number };

export type GenerateTripRequest = {
  origin: Coordinate;
  destination?: Coordinate;  // point d'arrivée optionnel — la marche se termine ici
  durationMinutes: DurationMinutes;
  mood: Mood;
  walking: WalkingLevel;
  excludeTripId?: string;
  excludedPlaceIds?: string[];
  departureAt?: string;  // ISO 8601 — heure de départ explicite
  arrivalBy?: string;    // ISO 8601 — heure de retour souhaitée
};

export type PlaceCategory =
  | "micro"
  | "art"
  | "viewpoint"
  | "temple"
  | "park"
  | "cafe"
  | "restaurant"
  | "museum"
  | "attraction";

export type PlaceSource = "google" | "osm" | "wikidata" | "wikipedia" | "demo";

export type PlaceCandidate = {
  id: string;
  source: PlaceSource;
  externalId?: string;
  name: string;
  coordinate: Coordinate;
  category: PlaceCategory;
  types: string[];
  description?: string;
  googleMapsUri?: string;
  rating?: number;
  ratingCount?: number;
  businessStatus?: string;
  openingHours?: {
    openNow?: boolean;
    nextCloseTime?: string;
  };
  signals: {
    unusual: number;
    quality: number;
    descriptive: number;
    chainPenalty: number;
  };
};

export type RouteLeg = {
  mode: "TRANSIT" | "WALK";
  from: string;
  to: string;
  durationMinutes: number;
  distanceMeters?: number;
  polyline?: string;
  stepPolylines?: string[];
  instructions?: string[];
};

export type TripStop = {
  place: PlaceCandidate;
  arrivalAt: string;
  departureAt: string;
  visitMinutes: number;
  reason: string;
  warning?: string;
};

export type TripPlan = {
  id: string;
  createdAt: string;
  request: GenerateTripRequest;
  title: string;
  summary: string;
  startsAt: string;
  returnsAt: string;
  totalMinutes: number;
  safetyMarginMinutes: number;
  transitMinutes: number;
  walkingMinutes: number;
  visitMinutes: number;
  stops: TripStop[];
  legs: RouteLeg[];
  warnings: string[];
  score: number;
  status?: "suggested" | "completed" | "rejected";
};

export type TripHistoryItem = {
  id: string;
  createdAt: string;
  title: string;
  totalMinutes: number;
  stopCount: number;
  status: "suggested" | "completed" | "rejected";
};

export type AnchorLog = {
  anchorId: string;
  anchorName: string;
  lat: number;
  lng: number;
  outboundMinutes: number | null;
  returnMinutes: number | null;
  withinTransitLimit: boolean;
  nearbyCount: number | null;
  routesBuilt: number | null;
};

export type NearbyPlaceLog = {
  anchorId: string;
  placeId: string;
  placeName: string;
  category: string;
  lat: number;
  lng: number;
  signalUnusual: number;
  signalQuality: number;
  signalDescriptive: number;
  signalChainPenalty: number;
  wasSelected: boolean;
};

export type EngineStats = {
  anchorCount: number;
  nearbyCount: number;
  routesConsidered: number;
  anchors: AnchorLog[];
  nearbyPlaces: NearbyPlaceLog[];
};

export type ScoredRoute = {
  places: PlaceCandidate[];
  outboundMinutes: number;
  returnMinutes: number;
  walkingMinutes: number;
  visitMinutes: number;
  totalMinutes: number;
  score: number;
};
