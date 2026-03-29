import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function fixCoordinates() {
  const client = await pool.connect();

  try {
    console.log("Starting x-coordinate fixes...\n");

    // Fix 1: Level 3 for ftbol area
    console.log("1. Fixing Level 3 nodes for ftbol area (x=50)...");
    const result1 = await client.query(
      `UPDATE skills SET x = 50 
       WHERE area_id = 'ftbol' AND level = 3`
    );
    console.log(`   ✓ Updated ${result1.rowCount} rows\n`);

    // Fix 2: Broader cleanup for all wrong spread coordinates
    console.log("2. Cleaning up all nodes with spread x coordinates (x IN 200, 350, 500, 650)...");
    const result2 = await client.query(
      `UPDATE skills SET x = 50 
       WHERE x IN (200, 350, 500, 650) AND area_id IS NOT NULL`
    );
    console.log(`   ✓ Updated ${result2.rowCount} rows\n`);

    // Verify the fixes
    console.log("3. Verifying fixes...");
    const verify = await client.query(
      `SELECT area_id, level, COUNT(*) as count, ARRAY_AGG(DISTINCT x) as x_values
       FROM skills
       WHERE area_id IS NOT NULL AND (area_id = 'ftbol' OR x != 50)
       GROUP BY area_id, level
       ORDER BY area_id, level`
    );

    if (verify.rows.length === 0) {
      console.log("   ✓ All area skills now have x=50!\n");
    } else {
      console.log("   Remaining non-50 x values:");
      verify.rows.forEach((row) => {
        console.log(
          `   - ${row.area_id} Level ${row.level}: ${row.count} skills, x values: ${row.x_values.join(", ")}`
        );
      });
      console.log();
    }

    // Show ftbol Level 3 specifically
    console.log("4. FTbol Level 3 nodes after fix:");
    const ftbolLevel3 = await client.query(
      `SELECT title, level, level_position as pos, x, y FROM skills
       WHERE area_id = 'ftbol' AND level = 3
       ORDER BY y ASC`
    );
    ftbolLevel3.rows.forEach((s) => {
      console.log(`   - Pos ${s.pos}: "${s.title}" @ x=${s.x}, y=${s.y}`);
    });

    console.log("\n✅ Coordinate fixes complete!");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    client.release();
    await pool.end();
  }
}

fixCoordinates();
