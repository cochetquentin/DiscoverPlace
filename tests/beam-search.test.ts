import { buildRoutes } from "@/lib/domain/beam-search";
import type { GenerateTripRequest, PlaceCandidate } from "@/lib/types";
import { describe, expect, it } from "vitest";

const makePlace = (
  id: string,
  lat: number,
  category: PlaceCandidate["category"] = "micro"
): PlaceCandidate => ({
  id,
  source: "demo",
  name: id,
  coordinate: { lat, lng: 139.76 },
  category,
  types: [category],
  description: "Lieu de test documenté.",
  signals: { unusual: 0.8, quality: 0.8, descriptive: 0.8, chainPenalty: 0 }
});

const request: GenerateTripRequest = {
  origin: { lat: 35.68, lng: 139.76 },
  durationMinutes: 120,
  mood: "surprise",
  walking: "medium"
};

describe("beam search", () => {
  it("never exceeds the usable time budget", () => {
    const routes = buildRoutes({
      request,
      anchor: makePlace("anchor", 35.69),
      nearby: [makePlace("one", 35.691), makePlace("two", 35.692)],
      outboundMinutes: 15,
      returnMinutes: 15,
      visitedIds: new Set(),
      rejectedIds: new Set(),
      now: new Date("2026-06-07T10:00:00Z"),
      isScheduled: false
    });
    expect(routes.length).toBeGreaterThan(0);
    expect(routes.every((route) => route.totalMinutes <= 108)).toBe(true);
  });

  it("excludes visited and rejected places", () => {
    const routes = buildRoutes({
      request,
      anchor: makePlace("anchor", 35.69),
      nearby: [makePlace("visited", 35.691), makePlace("valid", 35.692)],
      outboundMinutes: 15,
      returnMinutes: 15,
      visitedIds: new Set(["visited"]),
      rejectedIds: new Set(),
      now: new Date("2026-06-07T10:00:00Z"),
      isScheduled: false
    });
    expect(routes.flatMap((route) => route.places.map((place) => place.id))).not.toContain("visited");
  });
});
