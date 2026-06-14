import { config } from "@/lib/config";
import { CompositeDiscoveryProvider } from "@/lib/providers/composite";
import {
  DemoDiscoveryProvider,
  DemoRoutingProvider,
  DeterministicReranker,
  PassthroughVerifier
} from "@/lib/providers/demo";
import {
  GoogleDiscoveryProvider,
  GooglePlaceVerifier,
  GoogleRoutingProvider
} from "@/lib/providers/google";
import { OpenAiRouteReranker } from "@/lib/providers/openai";
import type { ProviderBundle } from "@/lib/providers/interfaces";

export function createProviders(): ProviderBundle {
  if (config.demoProviders) {
    return {
      discovery: new DemoDiscoveryProvider(),
      verifier: new PassthroughVerifier(),
      routing: new DemoRoutingProvider(),
      reranker: new DeterministicReranker()
    };
  }

  const google = new GoogleDiscoveryProvider();
  return {
    discovery: new CompositeDiscoveryProvider(google, [google]),
    verifier: new GooglePlaceVerifier(),
    routing: new GoogleRoutingProvider(),
    reranker: config.openAiKey ? new OpenAiRouteReranker() : new DeterministicReranker()
  };
}
