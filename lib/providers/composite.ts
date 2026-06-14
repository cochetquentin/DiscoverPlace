import { deduplicatePlaces } from "@/lib/domain/scoring";
import type { DiscoveryProvider } from "@/lib/providers/interfaces";
import type {
  Coordinate,
  GenerateTripRequest,
  Mood,
  PlaceCandidate
} from "@/lib/types";

export class CompositeDiscoveryProvider implements DiscoveryProvider {
  constructor(
    private readonly anchorProvider: DiscoveryProvider,
    private readonly nearbyProviders: Pick<DiscoveryProvider, "findNearby">[]
  ) {}

  findAnchors(request: GenerateTripRequest): Promise<PlaceCandidate[]> {
    return this.anchorProvider.findAnchors(request);
  }

  async findNearby(center: Coordinate, radiusMeters: number, mood: Mood) {
    const settled = await Promise.allSettled(
      this.nearbyProviders.map((provider) => provider.findNearby(center, radiusMeters, mood))
    );
    for (const result of settled) {
      if (result.status === "rejected") {
        console.error("[nearby] provider failed:", result.reason?.message ?? result.reason);
      }
    }
    return deduplicatePlaces(
      settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    );
  }
}
