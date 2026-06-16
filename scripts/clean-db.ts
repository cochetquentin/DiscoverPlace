import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const [{ count: logsCount }, { count: feedbackCount }, { count: ratingsCount }] = await Promise.all([
    supabase.from("trip_logs").select("*", { count: "exact", head: true }),
    supabase.from("trip_feedback").select("*", { count: "exact", head: true }),
    supabase.from("trip_ratings").select("*", { count: "exact", head: true })
  ]);

  // trip_stops, trip_anchors, trip_nearby_places supprimés automatiquement via ON DELETE CASCADE
  const [{ error: e1 }, { error: e2 }, { error: e3 }] = await Promise.all([
    supabase.from("trip_logs").delete().not("id", "is", null),
    supabase.from("trip_feedback").delete().not("trip_id", "is", null),
    supabase.from("trip_ratings").delete().not("trip_id", "is", null)
  ]);

  if (e1 ?? e2 ?? e3) {
    console.error("Erreur lors du nettoyage:", e1?.message ?? e2?.message ?? e3?.message);
    process.exit(1);
  }

  console.log(`DB nettoyée — ${logsCount ?? 0} trips, ${feedbackCount ?? 0} feedbacks, ${ratingsCount ?? 0} ratings supprimés.`);
  console.log("(trip_stops, trip_anchors, trip_nearby_places supprimés en cascade)");
}

main();
