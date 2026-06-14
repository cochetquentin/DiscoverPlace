import type { Mood, PlaceCandidate } from "@/lib/types";
import { moodFit } from "@/lib/domain/trip-rules";

type ScoreContext = {
  mood: Mood;
  visitedIds: Set<string>;
  rejectedIds: Set<string>;
  existingCategories: Set<string>;
  travelPenalty?: number;
};

export function scorePlace(place: PlaceCandidate, context: ScoreContext): number {
  const novelty = context.visitedIds.has(place.id) ? 0 : 1;
  const rejectedPenalty = context.rejectedIds.has(place.id) ? 0.55 : 0;
  const diversity = context.existingCategories.has(place.category) ? 0.25 : 1;
  const signals = place.signals;

  const score =
    signals.unusual * 30 +
    moodFit(place, context.mood) * 20 +
    novelty * 15 +
    signals.quality * 15 +
    diversity * 10 +
    signals.descriptive * 10 -
    signals.chainPenalty * 30 -
    rejectedPenalty * 30 -
    (context.travelPenalty ?? 0);

  return Math.round(score * 100) / 100;
}

// Bucket de ~75m pour détecter le même lieu reporté par plusieurs sources
function coordinateBucket(lat: number, lng: number): string {
  return `${Math.round(lat / 0.0007)}:${Math.round(lng / 0.0007)}`;
}

export function deduplicatePlaces(places: PlaceCandidate[]): PlaceCandidate[] {
  const seen = new Set<string>();
  const coordinates = new Set<string>();

  return places.filter((place) => {
    const nameKey = place.name.trim().toLocaleLowerCase("ja");
    const coordKey = coordinateBucket(place.coordinate.lat, place.coordinate.lng);
    const duplicate = seen.has(nameKey) || coordinates.has(coordKey);

    seen.add(nameKey);
    coordinates.add(coordKey);
    return !duplicate;
  });
}
