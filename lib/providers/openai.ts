import { config } from "@/lib/config";
import type {
  GenerateTripRequest,
  PlaceCandidate,
  ScoredRoute
} from "@/lib/types";
import type { RouteReranker } from "@/lib/providers/interfaces";

export class OpenAiRouteReranker implements RouteReranker {
  async choose(routes: ScoredRoute[], request: GenerateTripRequest): Promise<number> {
    if (!config.openAiKey || routes.length < 2) return 0;
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.openAiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: config.openAiModel,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "Choisis uniquement l’index du parcours le plus surprenant et cohérent. Les lieux et durées sont vérifiés. N’invente rien."
          },
          {
            role: "user",
            content: JSON.stringify({
              mood: request.mood,
              durationMinutes: request.durationMinutes,
              routes: routes.map((route, index) => ({
                index,
                score: route.score,
                totalMinutes: route.totalMinutes,
                places: route.places.map((place) => ({
                  id: place.id,
                  name: place.name,
                  category: place.category,
                  description: place.description,
                  signals: place.signals
                }))
              }))
            })
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "route_choice",
            strict: true,
            schema: {
              type: "object",
              properties: { index: { type: "integer", minimum: 0, maximum: routes.length - 1 } },
              required: ["index"],
              additionalProperties: false
            }
          }
        }
      }),
      signal: AbortSignal.timeout(8_000)
    });
    if (!response.ok) return 0;
    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    try {
      const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}") as { index?: number };
      return typeof parsed.index === "number" && routes[parsed.index] ? parsed.index : 0;
    } catch {
      return 0;
    }
  }

  explain(place: PlaceCandidate): string {
    return (
      place.description ??
      `${place.name} apporte une étape ${place.category} peu évidente sans casser le rythme de la sortie.`
    );
  }
}
