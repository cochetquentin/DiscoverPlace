export const config = {
  demoProviders:
    process.env.DEMO_PROVIDERS === "true" || !process.env.GOOGLE_MAPS_SERVER_API_KEY,
  googleServerKey: process.env.GOOGLE_MAPS_SERVER_API_KEY ?? "",
  openAiKey: process.env.OPENAI_API_KEY ?? "",
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
  overpassEndpoint:
    process.env.OVERPASS_ENDPOINT ?? "https://overpass-api.de/api/interpreter"
};
