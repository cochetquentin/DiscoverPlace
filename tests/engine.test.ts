import { generateTrip } from "@/lib/engine";
import { describe, expect, it } from "vitest";

describe("trip engine integration", () => {
  it("returns a round trip within the requested duration in demo mode", async () => {
    const { plan } = await generateTrip(
      {
        origin: { lat: 35.681236, lng: 139.767125 },
        durationMinutes: 240,
        mood: "surprise",
        walking: "medium"
      }
    );
    expect(plan.stops.length).toBeGreaterThanOrEqual(2);
    expect(plan.totalMinutes + plan.safetyMarginMinutes).toBe(240);
    expect(plan.legs.at(0)?.mode).toBe("TRANSIT");
    expect(plan.legs.at(-1)?.mode).toBe("TRANSIT");
  });
});
