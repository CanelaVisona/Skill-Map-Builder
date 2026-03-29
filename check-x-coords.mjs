import "dotenv/config";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const client = await pool.connect();

try {
  // Check x coordinates of existing skills in old areas
  const result = await client.query(`
    SELECT 
      area_id,
      level,
      level_position,
      x,
      y,
      title
    FROM skills
    WHERE area_id IN (SELECT id FROM areas WHERE archived = 0 LIMIT 3)
    ORDER BY area_id, level, level_position
  `);

  const grouped = {};
  for (const row of result.rows) {
    const key = `${row.area_id}-L${row.level}`;
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push({
      pos: row.level_position,
      x: row.x,
      y: row.y,
      title: row.title
    });
  }

  console.log("X COORDINATE PATTERNS IN EXISTING LEVELS:\n");
  for (const [key, skills] of Object.entries(grouped)) {
    console.log(`${key}:`);
    console.log(skills.map(s => `  Pos ${s.pos}: x=${s.x}, y=${s.y}`).join('\n'));
    console.log("");
  }

  process.exit(0);
} catch (err) {
  console.error("Error:", err);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
