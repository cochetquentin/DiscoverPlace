import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data } = await supabase
    .from("trip_logs")
    .select("id,created_at,mood,walking,duration_minutes,anchor_count,nearby_count,routes_considered,stop_count,success")
    .order("created_at", { ascending: false })
    .limit(10);

  console.log("\n=== Stats moteur (10 derniers) ===\n");
  for (const r of data ?? []) {
    const t = new Date(r.created_at).toLocaleTimeString("fr-FR", { timeZone: "Asia/Tokyo" });
    const ok = r.success ? "✓" : "✗";
    console.log(`${ok} [${t}] ${r.mood}/${r.walking}/${r.duration_minutes}min`);
    console.log(`   anchors=${r.anchor_count ?? "?"} nearby=${r.nearby_count ?? "?"} routes=${r.routes_considered ?? "?"} → stops=${r.stop_count ?? "?"}`);
  }

  // Stats des anchors : taux d'éligibilité et efficacité
  const tripIds = (data ?? []).map((r) => r.id);
  if (tripIds.length) {
    const { data: anchors } = await supabase
      .from("trip_anchors")
      .select("within_transit_limit,nearby_count,routes_built")
      .in("trip_log_id", tripIds);
    if (anchors?.length) {
      const eligible = anchors.filter((a) => a.within_transit_limit);
      const withRoutes = eligible.filter((a) => (a.routes_built ?? 0) > 0);
      const avgNearby = eligible.length
        ? Math.round(eligible.reduce((s, a) => s + (a.nearby_count ?? 0), 0) / eligible.length)
        : 0;
      console.log(`\n=== Anchors (${anchors.length} total sur ces trips) ===`);
      console.log(`   éligibles=${eligible.length}/${anchors.length}  avec_routes=${withRoutes.length}  avg_nearby=${avgNearby}`);
    }

    // Stats des lieux nearby : taux de sélection
    const { data: nearby } = await supabase
      .from("trip_nearby_places")
      .select("was_selected,signal_unusual,signal_quality")
      .in("trip_log_id", tripIds);
    if (nearby?.length) {
      const selected = nearby.filter((p) => p.was_selected);
      const avgUnusualAll = (nearby.reduce((s, p) => s + (p.signal_unusual ?? 0), 0) / nearby.length).toFixed(2);
      const avgUnusualSelected = selected.length
        ? (selected.reduce((s, p) => s + (p.signal_unusual ?? 0), 0) / selected.length).toFixed(2)
        : "n/a";
      console.log(`\n=== Nearby places (${nearby.length} total) ===`);
      console.log(`   sélectionnés=${selected.length}/${nearby.length} (${Math.round(selected.length / nearby.length * 100)}%)`);
      console.log(`   unusual moyen : tous=${avgUnusualAll}  sélectionnés=${avgUnusualSelected}`);
    }
  }

  // Stats ratings globaux
  const { data: ratings } = await supabase
    .from("trip_ratings")
    .select("rating,mood,walking")
    .order("created_at", { ascending: false })
    .limit(100);
  if (ratings?.length) {
    const likes = ratings.filter((r) => r.rating === "like").length;
    const dislikes = ratings.filter((r) => r.rating === "dislike").length;
    console.log(`\n=== Ratings (${ratings.length} total) ===`);
    console.log(`   👍 ${likes}  👎 ${dislikes}`);
    // Dislikes par mood
    const dislikesByMood: Record<string, number> = {};
    for (const r of ratings.filter((r) => r.rating === "dislike")) {
      dislikesByMood[r.mood] = (dislikesByMood[r.mood] ?? 0) + 1;
    }
    if (Object.keys(dislikesByMood).length) {
      console.log("   👎 par mood :", Object.entries(dislikesByMood).map(([k, v]) => `${k}=${v}`).join("  "));
    }
  }
}

main();
