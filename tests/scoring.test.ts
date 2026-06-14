import { deduplicatePlaces, scorePlace } from "@/lib/domain/scoring";
import type { PlaceCandidate } from "@/lib/types";
import { describe, expect, it } from "vitest";

const candidate = (id: string, name = id): PlaceCandidate => ({
  id,
  source: "osm",
  name,
  coordinate: { lat: 35.68 + id.length / 1000, lng: 139.76 },
  category: "micro",
  types: ["historic"],
  description: "Une curiosité locale.",
  signals: { unusual: 1, quality: 0.7, descriptive: 0.8, chainPenalty: 0 }
});

describe("scoring", () => {
  it("penalizes visited and rejected places", () => {
    const fresh = scorePlace(candidate("fresh"), {
      mood: "unusual",
      visitedIds: new Set(),
      rejectedIds: new Set(),
      existingCategories: new Set()
    });
    const stale = scorePlace(candidate("stale"), {
      mood: "unusual",
      visitedIds: new Set(["stale"]),
      rejectedIds: new Set(["stale"]),
      existingCategories: new Set(["micro"])
    });
    expect(fresh).toBeGreaterThan(stale);
  });

  it("deduplicates by normalized name", () => {
    expect(deduplicatePlaces([candidate("a", "Même lieu"), candidate("b", "Même lieu")])).toHaveLength(1);
  });
});
