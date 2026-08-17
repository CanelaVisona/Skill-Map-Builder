// One-off repair: recompute y coordinates for every area/project/sub-skill tree,
// using the exact same global cumulative formula the app already uses everywhere
// (server/storage.ts -> recalculateYCoordinates). This is what /api/skills/:id/change-level
// failed to call before the fix, which is what caused level 2's nodes to land on
// top of level 1's nodes on the canvas.
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function recalc(whereClause, params, label) {
  const sql = `
    WITH skill_ranking AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY level ASC, level_position ASC) as cumulative_pos
      FROM skills
      WHERE ${whereClause}
    )
    UPDATE skills
    SET y = 100 + (sr.cumulative_pos - 1) * 150
    FROM skill_ranking sr
    WHERE skills.id = sr.id
    AND skills.y IS DISTINCT FROM 100 + (sr.cumulative_pos - 1) * 150
    RETURNING skills.id;
  `;
  const result = await pool.query(sql, params);
  if (result.rowCount > 0) {
    console.log(`  fixed ${result.rowCount} rows for ${label}`);
  }
}

async function main() {
  const areas = await pool.query(`SELECT id, name FROM areas`);
  for (const area of areas.rows) {
    await recalc(`area_id = $1`, [area.id], `area "${area.name}" (${area.id})`);
  }

  const projects = await pool.query(`SELECT id, name FROM projects`);
  for (const project of projects.rows) {
    await recalc(`project_id = $1`, [project.id], `project "${project.name}" (${project.id})`);
  }

  const parents = await pool.query(
    `SELECT DISTINCT parent_skill_id FROM skills WHERE parent_skill_id IS NOT NULL`
  );
  for (const row of parents.rows) {
    await recalc(`parent_skill_id = $1`, [row.parent_skill_id], `sub-skill tree ${row.parent_skill_id}`);
  }

  console.log("Done.");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
