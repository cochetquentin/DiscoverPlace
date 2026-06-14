import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data } = await supabase
    .from("trip_logs")
    .select("created_at,mood,walking,duration_minutes,anchor_count,nearby_count,routes_considered,stop_count,success")
    .order("created_at", { ascending: false })
    .limit(10);

  console.log("\n=== Stats moteur (10 derniers) ===\n");
  for (const r of data ?? []) {
    const t = new Date(r.created_at).toLocaleTimeString("fr-FR", { timeZone: "Asia/Tokyo" });
    const ok = r.success ? "✓" : "✗";
    console.log(`${ok} [${t}] ${r.mood}/${r.walking}/${r.duration_minutes}min`);
    console.log(`   anchors=${r.anchor_count ?? "?"} nearby=${r.nearby_count ?? "?"} routes=${r.routes_considered ?? "?"} → stops=${r.stop_count ?? "?"}`);
  }
}

main();
