import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { count: logsCount } = await supabase
    .from("trip_logs")
    .select("*", { count: "exact", head: true });

  const { count: feedbackCount } = await supabase
    .from("trip_feedback")
    .select("*", { count: "exact", head: true });

  // trip_stops supprimés automatiquement via ON DELETE CASCADE
  const { error: e1 } = await supabase.from("trip_logs").delete().not("id", "is", null);
  const { error: e2 } = await supabase.from("trip_feedback").delete().not("trip_id", "is", null);

  if (e1 ?? e2) {
    console.error("Erreur lors du nettoyage:", e1?.message ?? e2?.message);
    process.exit(1);
  }

  console.log(`DB nettoyée — ${logsCount ?? 0} trips, ${feedbackCount ?? 0} feedbacks supprimés.`);
}

main();
