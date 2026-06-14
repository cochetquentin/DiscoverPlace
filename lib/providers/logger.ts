import { createClient } from "@supabase/supabase-js";
import type { EngineStats, GenerateTripRequest, TripPlan } from "@/lib/types";

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function logTrip(
  request: GenerateTripRequest,
  result?: TripPlan,
  error?: unknown,
  stats?: EngineStats
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.log("[logger] Supabase non configuré (env vars manquantes)");
    return;
  }

  const success = !!result && !error;

  const { data: logRow, error: insertError } = await supabase
    .from("trip_logs")
    .insert({
      duration_minutes: request.durationMinutes,
      mood: request.mood,
      walking: request.walking,

      trip_id: result?.id ?? null,
      success,
      total_minutes: result?.totalMinutes ?? null,
      transit_minutes: result?.transitMinutes ?? null,
      walking_minutes: result?.walkingMinutes ?? null,
      visit_minutes: result?.visitMinutes ?? null,
      stop_count: result?.stops?.length ?? null,
      score: result?.score ?? null,

      anchor_count: stats?.anchorCount ?? null,
      nearby_count: stats?.nearbyCount ?? null,
      routes_considered: stats?.routesConsidered ?? null,

      stops: result?.stops?.map((s) => ({
        name: s.place.name,
        category: s.place.category,
        visitMinutes: s.visitMinutes
      })) ?? null,

      warnings: result?.warnings ?? null,

      request_payload: request,
      response_payload: result ?? null,
      error_message: error instanceof Error ? error.message : error ? String(error) : null
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("[logger] Supabase insert error:", insertError.message, insertError.details);
    return;
  }

  console.log("[logger] Trip logged OK");

  // Insérer les stops détaillés
  if (result?.stops?.length && logRow?.id) {
    const walkLegs = result.legs.filter((l) => l.mode === "WALK");
    const stopsPayload = result.stops.map((stop, index) => ({
      trip_log_id: logRow.id,
      position: index,
      place_name: stop.place.name,
      place_source: stop.place.source,
      category: stop.place.category,
      visit_minutes: stop.visitMinutes,
      signal_unusual: stop.place.signals.unusual,
      signal_quality: stop.place.signals.quality,
      score: null as number | null, // score par stop non disponible directement
      walking_from_previous: index > 0 ? (walkLegs[index - 1]?.durationMinutes ?? null) : 0
    }));

    const { error: stopsError } = await supabase.from("trip_stops").insert(stopsPayload);
    if (stopsError) {
      console.error("[logger] trip_stops insert error:", stopsError.message);
    }
  }
}

export async function logFeedback(
  tripId: string,
  status: "completed" | "rejected",
  request: Pick<GenerateTripRequest, "mood" | "walking" | "durationMinutes">
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase.from("trip_feedback").upsert({
    trip_id: tripId,
    status,
    mood: request.mood,
    walking: request.walking,
    duration_minutes: request.durationMinutes
  });

  if (error) console.error("[logger] trip_feedback upsert error:", error.message);
}
