import {
  isOpenForVisit,
  maxTransitLeg,
  safetyMargin,
  visitDuration,
  walkingBudget
} from "@/lib/domain/trip-rules";
import type { PlaceCandidate } from "@/lib/types";
import { describe, expect, it } from "vitest";

const commercialPlace = (nextCloseTime?: string): PlaceCandidate => ({
  id: "cafe",
  source: "demo",
  name: "Café",
  coordinate: { lat: 35.68, lng: 139.76 },
  category: "cafe",
  types: ["cafe"],
  openingHours: { openNow: true, nextCloseTime },
  signals: { unusual: 0.5, quality: 0.5, descriptive: 0.5, chainPenalty: 0 }
});

describe("trip rules", () => {
  it("reserves the requested safety margin", () => {
    expect(safetyMargin(120)).toBe(12);
    expect(safetyMargin(240)).toBe(24);
    expect(safetyMargin(360)).toBe(30);
  });

  it("caps each transit leg", () => {
    expect(maxTransitLeg(120)).toBe(30);
    expect(maxTransitLeg(360)).toBe(90);
  });

  it("uses stable visit and walking budgets", () => {
    expect(visitDuration("micro")).toBe(15);
    expect(visitDuration("museum")).toBe(75);
    expect(walkingBudget("high", 240)).toBe(180);
  });

  it("rejects a business that closes before visit plus buffer", () => {
    const arrival = new Date("2026-06-07T10:00:00Z");
    expect(
      isOpenForVisit(commercialPlace("2026-06-07T10:50:00Z"), arrival, 45).allowed
    ).toBe(false);
    expect(
      isOpenForVisit(commercialPlace("2026-06-07T11:00:00Z"), arrival, 45).allowed
    ).toBe(true);
  });
});
