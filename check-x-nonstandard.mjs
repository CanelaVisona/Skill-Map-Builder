import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
  const result = await client.query(`
    SELECT area_id, level, level_position, x FROM skills 
    WHERE area_id IS NOT NULL AND x != 50
    ORDER BY area_id, level, level_position
    LIMIT 30
  `);
  
  console.log("Nodes with x != 50:");
  const grouped = {};
  for (const r of result.rows) {
    const key = `${r.area_id}-L${r.level}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(`Pos ${r.level_position}=x${r.x}`);
  }
  
  for (const [key, items] of Object.entries(grouped)) {
    console.log(`  ${key}: ${items.join(", ")}`);
  }
  
  process.exit(0);
} catch (err) {
  console.error("Error:", err.message);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
