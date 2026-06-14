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
    .select("created_at,mood,walking,duration_minutes,stop_count,walking_minutes,transit_minutes,visit_minutes,success,stops,warnings")
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

  console.log(`\n=== ${data.length} derniers trips ===\n`);

  for (const row of data) {
    const date = new Date(row.created_at).toLocaleString("fr-FR", { timeZone: "Asia/Tokyo" });
    const status = row.success ? "✓" : "✗";
    console.log(`${status} [${date} JST] ${row.mood} / walk=${row.walking} / ${row.duration_minutes}min`);
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
}

main();
