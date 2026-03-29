import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
  const result = await client.query(`
    SELECT DISTINCT x FROM skills WHERE area_id IS NOT NULL ORDER BY x
  `);
  console.log("Unique x coordinates in area skills:", result.rows.map(r => r.x).join(", "));
  process.exit(0);
} catch (err) {
  console.error("Error:", err.message);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
