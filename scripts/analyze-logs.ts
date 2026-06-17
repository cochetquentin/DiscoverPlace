/**
 * Analyse les logs de trip_logs dans Supabase.
 * Usage: npx tsx scripts/analyze-logs.ts
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis dans .env.local");
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  const { data, error } = await supabase
    .from("trip_logs")
    .select("id,trip_id,created_at,mood,walking,duration_minutes,stop_count,walking_minutes,transit_minutes,visit_minutes,success,stops,warnings")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Erreur:", error.message);
    process.exit(1);
  }

  if (!data?.length) {
    console.log("Aucun log trouvé.");
    process.exit(0);
  }

  // Charger les ratings pour les trips trouvés (trip_ratings.trip_id = trip_logs.trip_id, pas id)
  const planIds = data.filter((r) => r.success && r.trip_id).map((r) => r.trip_id as string);
  const { data: ratingsData } = await supabase
    .from("trip_ratings")
    .select("trip_id,rating,comment")
    .in("trip_id", planIds.length ? planIds : ["__none__"]);
  const ratingMap = new Map((ratingsData ?? []).map((r) => [r.trip_id, { rating: r.rating as "like" | "dislike", comment: r.comment as string | null }]));

  console.log(`\n=== ${data.length} derniers trips ===\n`);

  for (const row of data) {
    const date = new Date(row.created_at).toLocaleString("fr-FR", { timeZone: "Asia/Tokyo" });
    const status = row.success ? "✓" : "✗";
    const ratingEntry = ratingMap.get(row.trip_id);
    const ratingStr = ratingEntry?.rating === "like" ? " [like]" : ratingEntry?.rating === "dislike" ? " [dislike]" : "";
    const commentStr = ratingEntry?.comment ? ` "${ratingEntry.comment}"` : "";
    console.log(`${status} [${date} JST] ${row.mood} / walk=${row.walking} / ${row.duration_minutes}min${ratingStr}${commentStr}`);
    if (row.success) {
      console.log(`   stops=${row.stop_count}  transit=${row.transit_minutes}min  walk=${row.walking_minutes}min  visit=${row.visit_minutes}min`);
      if (row.stops?.length) {
        for (const s of row.stops) {
          console.log(`   • ${s.name} (${s.category}, ${s.visitMinutes}min)`);
        }
      }
      if (row.warnings?.length) {
        console.log(`   ⚠ ${row.warnings.join(", ")}`);
      }

      // Anchors pour ce trip
      const { data: anchors } = await supabase
        .from("trip_anchors")
        .select("anchor_name,outbound_minutes,within_transit_limit,nearby_count,routes_built")
        .eq("trip_log_id", row.id)
        .order("outbound_minutes", { ascending: true });
      if (anchors?.length) {
        console.log(`   anchors (${anchors.length}) :`);
        for (const a of anchors) {
          const eligible = a.within_transit_limit ? "✓" : "✗";
          const detail = a.within_transit_limit
            ? a.nearby_count !== null
              ? ` → nearby=${a.nearby_count} routes=${a.routes_built ?? 0}`
              : " → non traité"
            : "";
          console.log(`     ${eligible} ${a.anchor_name} (${a.outbound_minutes ?? "?"}min)${detail}`);
        }
      }
    }
    console.log();
  }

  // Résumé par combo mood/walking
  console.log("=== Moyennes par walking level ===\n");
  const groups: Record<string, { walkMins: number[]; stopCounts: number[] }> = {};
  for (const row of data) {
    if (!row.success) continue;
    const groupKey = `${row.walking} / ${row.duration_minutes}min`;
    groups[groupKey] ??= { walkMins: [], stopCounts: [] };
    groups[groupKey].walkMins.push(row.walking_minutes ?? 0);
    groups[groupKey].stopCounts.push(row.stop_count ?? 0);
  }
  for (const [label, g] of Object.entries(groups)) {
    const avgWalk = Math.round(g.walkMins.reduce((a, b) => a + b, 0) / g.walkMins.length);
    const avgStops = (g.stopCounts.reduce((a, b) => a + b, 0) / g.stopCounts.length).toFixed(1);
    console.log(`  ${label} → avg walk=${avgWalk}min, avg stops=${avgStops}`);
  }

  // Résumé ratings
  const allRatings = [...ratingMap.values()];
  if (allRatings.length) {
    const likes = allRatings.filter((r) => r.rating === "like").length;
    const dislikes = allRatings.filter((r) => r.rating === "dislike").length;
    console.log(`\n=== Ratings (${allRatings.length} notés sur ${data.length}) ===`);
    console.log(`  👍 ${likes}  👎 ${dislikes}`);
  }
}

main();
