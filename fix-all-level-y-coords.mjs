import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function fixAllLevelCoordinates() {
  const client = await pool.connect();

  try {
    console.log("Fixing all overlapping level coordinates for ftbol area...\n");

    // Get all levels
    const levelsQuery = await client.query(
      `SELECT DISTINCT level FROM skills WHERE area_id = 'ftbol' ORDER BY level ASC`
    );
    const levels = levelsQuery.rows.map((r) => r.level);

    console.log(`Levels in ftbol: ${levels.join(", ")}\n`);

    // For each level starting from level 2, ensure it starts after the previous level
    for (let i = 1; i < levels.length; i++) {
      const currentLevel = levels[i];
      const prevLevel = levels[i - 1];

      // Get max y of previous level
      const prevMaxQuery = await client.query(
        `SELECT MAX(y) as max_y FROM skills WHERE area_id = 'ftbol' AND level = $1`,
        [prevLevel]
      );
      const prevMaxY = prevMaxQuery.rows[0]?.max_y || 700;
      const newStartY = prevMaxY + 150;

      console.log(`Level ${currentLevel}:`);
      console.log(`  Previous level (${prevLevel}) max y: ${prevMaxY}`);
      console.log(`  New start y: ${newStartY}`);

      // Get current level nodes
      const beforeQuery = await client.query(
        `SELECT level_position as pos, y FROM skills 
         WHERE area_id = 'ftbol' AND level = $1 
         ORDER BY level_position ASC`,
        [currentLevel]
      );

      if (beforeQuery.rows.length > 0) {
        // Update this level
        const updateResult = await client.query(
          `UPDATE skills 
           SET y = $1 + ((level_position - 1) * 150)
           WHERE area_id = 'ftbol' AND level = $2`,
          [newStartY, currentLevel]
        );

        // Verify
        const afterQuery = await client.query(
          `SELECT MIN(y) as min_y, MAX(y) as max_y FROM skills 
           WHERE area_id = 'ftbol' AND level = $1`,
          [currentLevel]
        );
        const { min_y, max_y } = afterQuery.rows[0];
        console.log(`  ✓ Updated, new y range: ${min_y} - ${max_y}\n`);
      }
    }

    // Final summary
    console.log("=== Final Summary ===\n");
    const summaryQuery = await client.query(
      `SELECT level, MIN(y) as min_y, MAX(y) as max_y 
       FROM skills WHERE area_id = 'ftbol' 
       GROUP BY level 
       ORDER BY level ASC`
    );

    summaryQuery.rows.forEach((row) => {
      console.log(`Level ${row.level}: y ${row.min_y} - ${row.max_y}`);
    });

    console.log("\n✅ All level coordinates fixed!");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    client.release();
    await pool.end();
  }
}

fixAllLevelCoordinates();
