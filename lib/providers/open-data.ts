import { config } from "@/lib/config";
import type { Coordinate, Mood, PlaceCandidate, PlaceCategory } from "@/lib/types";
import type { DiscoveryProvider } from "@/lib/providers/interfaces";

const tagCategory = (tags: Record<string, string>): PlaceCategory => {
  if (tags.tourism === "museum") return "museum";
  if (tags.leisure === "park" || tags.leisure === "garden") return "park";
  if (tags.amenity === "place_of_worship" || tags.historic === "shrine") return "temple";
  if (tags.tourism === "viewpoint") return "viewpoint";
  if (tags.tourism === "artwork") return "art";
  return "micro";
};

export class OverpassDiscoveryProvider implements Pick<DiscoveryProvider, "findNearby"> {
  async findNearby(center: Coordinate, radiusMeters: number, mood: Mood): Promise<PlaceCandidate[]> {
    void mood;
    const query = `[out:json][timeout:25];(nwr(around:${radiusMeters},${center.lat},${center.lng})["tourism"~"artwork|viewpoint|museum|attraction"];nwr(around:${radiusMeters},${center.lat},${center.lng})["historic"~"monument|memorial|castle|ruins|archaeological_site"];nwr(around:${radiusMeters},${center.lat},${center.lng})["leisure"~"garden|park"];nwr(around:${radiusMeters},${center.lat},${center.lng})["amenity"="place_of_worship"]["religion"="shinto"];nwr(around:${radiusMeters},${center.lat},${center.lng})["amenity"="place_of_worship"]["religion"="buddhist"];);out center tags 50;`;
    const response = await fetch(config.overpassEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json", "User-Agent": "DiscoverPlace/1.0 (jok3.power@gmail.com)" },
      body: new URLSearchParams({ data: query }),
      signal: AbortSignal.timeout(30_000)
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "(unreadable)");
      console.error(`[Overpass] ${response.status} — ${body.slice(0, 300)}`);
      throw new Error(`Overpass ${response.status}`);
    }
    const data = (await response.json()) as {
      elements?: {
        id: number;
        lat?: number;
        lon?: number;
        center?: { lat: number; lon: number };
        tags?: Record<string, string>;
      }[];
    };

    return (data.elements ?? []).flatMap((element): PlaceCandidate[] => {
      const tags = element.tags ?? {};
      const lat = element.lat ?? element.center?.lat;
      const lng = element.lon ?? element.center?.lon;
      const name = tags["name:fr"] ?? tags.name ?? tags["name:ja"];
      if (!lat || !lng || !name) return [];
      const description = tags.description ?? tags["description:fr"] ?? tags["description:ja"];
      return [
        {
          id: `osm:${element.id}`,
          externalId: String(element.id),
          source: "osm",
          name,
          coordinate: { lat, lng },
          category: tagCategory(tags),
          types: Object.entries(tags)
            .filter(([key]) => ["tourism", "historic", "leisure", "amenity"].includes(key))
            .map(([, value]) => value),
          description,
          signals: {
            unusual: 0.88,
            quality: 0.55,
            descriptive: description ? 0.9 : 0.45,
            chainPenalty: 0
          }
        }
      ];
    });
  }
}

export class WikipediaDiscoveryProvider implements Pick<DiscoveryProvider, "findNearby"> {
  async findNearby(center: Coordinate, radiusMeters: number, mood: Mood): Promise<PlaceCandidate[]> {
    void mood;
    const url = new URL("https://ja.wikipedia.org/w/api.php");
    url.search = new URLSearchParams({
      action: "query",
      format: "json",
      origin: "*",
      list: "geosearch",
      gscoord: `${center.lat}|${center.lng}`,
      gsradius: String(Math.min(radiusMeters, 10_000)),
      gslimit: "20"
    }).toString();
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error(`Wikipedia ${response.status}`);
    const data = (await response.json()) as {
      query?: { geosearch?: { pageid: number; title: string; lat: number; lon: number }[] };
    };
    return (data.query?.geosearch ?? []).map((page) => ({
      id: `wikipedia:${page.pageid}`,
      externalId: String(page.pageid),
      source: "wikipedia",
      name: page.title,
      coordinate: { lat: page.lat, lng: page.lon },
      category: "attraction",
      types: ["wikipedia"],
      description: `Un lieu documenté sur Wikipédia, signe qu’il possède une histoire à découvrir.`,
      googleMapsUri: `https://www.google.com/maps/search/?api=1&query=${page.lat},${page.lon}`,
      signals: {
        unusual: 0.7,
        quality: 0.6,
        descriptive: 0.8,
        chainPenalty: 0
      }
    }));
  }
}
