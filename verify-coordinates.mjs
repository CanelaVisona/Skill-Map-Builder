import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function verifyCoordinates() {
  const client = await pool.connect();

  try {
    console.log("Verifying coordinates after fixes...\n");

    // Check ftbol Area with all levels
    console.log("=== FTbol Area - All Levels ===\n");
    const ftbolQuery = await client.query(
      `SELECT level, level_position as pos, x, y, title
       FROM skills
       WHERE area_id = 'ftbol'
       ORDER BY level ASC, y ASC
       LIMIT 30`
    );

    const byLevel = {};
    ftbolQuery.rows.forEach((row) => {
      if (!byLevel[row.level]) byLevel[row.level] = [];
      byLevel[row.level].push(row);
    });

    Object.keys(byLevel)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .forEach((level) => {
        const skills = byLevel[level];
        console.log(`Level ${level}:`);
        skills.forEach((s) => {
          console.log(
            `  Pos ${s.pos}: "${s.title}" @ x=${s.x}, y=${s.y} ${
              s.x === 50 ? "✓" : "✗ WRONG"
            }`
          );
        });
        console.log();
      });

    // Summary statistics
    console.log("=== Coordinate Summary ===\n");
    const summary = await client.query(
      `SELECT 
         COUNT(*) as total_skills,
         SUM(CASE WHEN x = 50 THEN 1 ELSE 0 END) as x_50_count,
         SUM(CASE WHEN x IN (200, 350, 500, 650) THEN 1 ELSE 0 END) as spread_count,
         SUM(CASE WHEN x NOT IN (50, 200, 350, 500, 650) THEN 1 ELSE 0 END) as other_count
       FROM skills
       WHERE area_id IS NOT NULL`
    );

    const stats = summary.rows[0];
    console.log(`Total area skills: ${stats.total_skills}`);
    console.log(`Skills with x=50: ${stats.x_50_count} ${stats.x_50_count === stats.total_skills ? "✓" : ""}`);
    console.log(`Skills with spread x (200, 350, 500, 650): ${stats.spread_count}`);
    console.log(`Skills with other x values: ${stats.other_count}`);

    if (stats.spread_count === 0 && stats.other_count === 0) {
      console.log("\n✅ All coordinates verified - all area skills have x=50!");
    } else {
      console.log("\n⚠️  Warning: Found unexpected x values");
    }

    await client.end();
  } catch (error) {
    console.error("Error:", error);
  } finally {
    try {
      client.release();
    } catch (e) {}
    await pool.end();
  }
}

verifyCoordinates();
