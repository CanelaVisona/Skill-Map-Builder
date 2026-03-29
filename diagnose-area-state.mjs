import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const client = await pool.connect();

try {
  // Get 2-3 areas with content
  const areasResult = await client.query(`
    SELECT 
      id, 
      name, 
      unlocked_level, 
      next_level_to_assign, 
      end_of_area_level
    FROM areas
    WHERE archived = 0
    LIMIT 3
  `);

  const areas = areasResult.rows;
  console.log("=== AREA STATE DIAGNOSIS ===\n");
  console.log(`Found ${areas.length} areas to diagnose:\n`);

  for (const area of areas) {
    console.log(`\n📍 AREA: ${area.name} (ID: ${area.id})`);
    console.log(`   Unlocked Level: ${area.unlocked_level}`);
    console.log(`   Next Level to Assign: ${area.next_level_to_assign}`);
    console.log(`   End of Area Level: ${area.end_of_area_level || "NULL"}`);
    console.log(`   ─────────────────────────────────────────`);

    // Get all levels and skills in this area
    const skillsResult = await client.query(`
      SELECT 
        level,
        COUNT(*) as total_skills,
        SUM(CASE WHEN status = 'mastered' THEN 1 ELSE 0 END) as mastered_count,
        STRING_AGG(
          CASE WHEN is_final_node = 1 THEN title ELSE NULL END,
          ', '
        ) as final_node_title
      FROM skills
      WHERE area_id = $1
      GROUP BY level
      ORDER BY level
    `, [area.id]);

    const levels = skillsResult.rows;
    
    for (const level of levels) {
      console.log(`   Level ${level.level}:`);
      console.log(`     Total skills: ${level.total_skills}`);
      console.log(`     Mastered: ${level.mastered_count}/${level.total_skills}`);
      console.log(`     Final node: ${level.final_node_title || "NONE"}`);
    }

    // Determine unlocked state
    console.log(`\n   📊 STATE ANALYSIS:`);
    const lastLevel = levels[levels.length - 1];
    const allMastered = lastLevel && lastLevel.mastered_count === lastLevel.total_skills;
    
    if (allMastered && area.end_of_area_level === lastLevel.level) {
      console.log(`     ✅ Area complete: All levels mastered to end_of_area_level`);
    } else if (allMastered && !area.end_of_area_level) {
      console.log(`     ⚠️  All levels mastered but end_of_area_level not set`);
    } else {
      console.log(`     ⏳ Area in progress`);
    }
    
    console.log("");
  }

  console.log("\n=== DIAGNOSTIC COMPLETE ===\n");
  process.exit(0);

} catch (err) {
  console.error("Database query error:", err);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
