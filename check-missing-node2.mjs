import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
  const result = await client.query(`
    SELECT area_id, level, array_agg(level_position ORDER BY level_position) as positions
    FROM skills
    WHERE area_id IS NOT NULL
    GROUP BY area_id, level
    HAVING NOT (1 = ANY(array_agg(level_position)) AND 2 = ANY(array_agg(level_position)))
    ORDER BY area_id, level;
  `);
  
  console.log('Missing Node 2 results:');
  console.log('=====================================');
  if (result.rows.length === 0) {
    console.log('✓ No missing Node 2 - all levels have positions 1 and 2');
  } else {
    console.log(`⚠ Found ${result.rows.length} level(s) with missing Node 2:\n`);
    result.rows.forEach(row => {
      console.log(`Area: ${row.area_id}, Level: ${row.level}, Positions: [${row.positions.join(', ')}]`);
    });
  }
  console.log('=====================================');
  process.exit(0);
} catch (err) {
  console.error("Error:", err.message);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
