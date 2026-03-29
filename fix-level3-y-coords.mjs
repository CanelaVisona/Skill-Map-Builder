import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function fixLevel3Coordinates() {
  const client = await pool.connect();

  try {
    console.log("Fixing Level 3 y coordinates for ftbol area...\n");

    // Get Level 2 max y
    const level2Query = await client.query(
      `SELECT MAX(y) as max_y FROM skills WHERE area_id = 'ftbol' AND level = 2`
    );
    const level2MaxY = level2Query.rows[0]?.max_y || 1300;
    console.log(`Level 2 max y: ${level2MaxY}`);

    const level3StartY = level2MaxY + 150;
    console.log(`Level 3 should start at y: ${level3StartY}\n`);

    // Get current Level 3 nodes
    console.log("Current Level 3 nodes (before fix):");
    const beforeQuery = await client.query(
      `SELECT level_position as pos, y FROM skills 
       WHERE area_id = 'ftbol' AND level = 3 
       ORDER BY level_position ASC`
    );
    beforeQuery.rows.forEach((row) => {
      console.log(`  Pos ${row.pos}: y=${row.y}`);
    });

    // Update Level 3 y coordinates
    console.log("\nUpdating Level 3 y coordinates...");
    const updateResult = await client.query(
      `UPDATE skills 
       SET y = $1 + ((level_position - 1) * 150)
       WHERE area_id = 'ftbol' AND level = 3`,
      [level3StartY]
    );
    console.log(`✓ Updated ${updateResult.rowCount} rows\n`);

    // Verify the fix
    console.log("Level 3 nodes after fix:");
    const afterQuery = await client.query(
      `SELECT level_position as pos, y, title FROM skills 
       WHERE area_id = 'ftbol' AND level = 3 
       ORDER BY level_position ASC`
    );
    afterQuery.rows.forEach((row) => {
      const expectedY = level3StartY + (row.pos - 1) * 150;
      const correct = row.y === expectedY ? "✓" : "✗";
      console.log(`  Pos ${row.pos}: y=${row.y} (expected ${expectedY}) ${correct}`);
    });

    // Show all ftbol levels for context
    console.log("\nAll ftbol levels for context:");
    const allQuery = await client.query(
      `SELECT DISTINCT level FROM skills WHERE area_id = 'ftbol' ORDER BY level ASC`
    );
    const levels = allQuery.rows.map((r) => r.level);

    for (const lvl of levels) {
      const levelQuery = await client.query(
        `SELECT MIN(y) as min_y, MAX(y) as max_y FROM skills WHERE area_id = 'ftbol' AND level = $1`,
        [lvl]
      );
      const { min_y, max_y } = levelQuery.rows[0];
      console.log(`  Level ${lvl}: y range ${min_y} - ${max_y}`);
    }

    console.log("\n✅ Level 3 coordinates fixed!");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    client.release();
    await pool.end();
  }
}

fixLevel3Coordinates();
