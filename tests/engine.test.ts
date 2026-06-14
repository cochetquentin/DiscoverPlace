import { generateTrip } from "@/lib/engine";
import { describe, expect, it } from "vitest";

describe("trip engine integration", () => {
  it("returns a round trip within the requested duration in demo mode", async () => {
    const trip = await generateTrip(
      {
        origin: { lat: 35.681236, lng: 139.767125 },
        durationMinutes: 240,
        mood: "surprise",
        walking: "medium"
      }
    );
    expect(trip.stops.length).toBeGreaterThanOrEqual(2);
    expect(trip.totalMinutes + trip.safetyMarginMinutes).toBe(240);
    expect(trip.legs.at(0)?.mode).toBe("TRANSIT");
    expect(trip.legs.at(-1)?.mode).toBe("TRANSIT");
  });
});
