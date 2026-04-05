import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function fixCorruptNodes() {
  try {
    console.log("[FixCorruptNodes] Starting migration...");

    // First, count the corrupt nodes
    const countResult = await db.execute(sql`
      SELECT COUNT(*) as corrupt_count
      FROM skills
      WHERE level_position > 1
        AND area_id IS NOT NULL
        AND (title = '' OR title IS NULL)
        AND is_auto_complete != 1;
    `);

    const corruptCount = (countResult.rows[0] as any).corrupt_count || 0;
    console.log(`[FixCorruptNodes] Found ${corruptCount} corrupt nodes to fix`);

    if (corruptCount === 0) {
      console.log("[FixCorruptNodes] No corrupt nodes to fix");
      return;
    }

    // Fix the corrupt nodes by assigning them titles
    const fixResult = await db.execute(sql`
      UPDATE skills
      SET title = CONCAT('Nodo ', level_position)
      WHERE level_position > 1
        AND area_id IS NOT NULL
        AND (title = '' OR title IS NULL)
        AND is_auto_complete != 1
        AND status = 'locked';
    `);

    console.log(`[FixCorruptNodes] Fixed ${fixResult.rowCount} nodes`);

    // Verify the fix
    const verifyResult = await db.execute(sql`
      SELECT 
        area_id, 
        level, 
        level_position, 
        id, 
        title
      FROM skills
      WHERE level_position > 1
        AND area_id IS NOT NULL
        AND title LIKE 'Nodo%'
        AND is_auto_complete != 1
      LIMIT 10;
    `);

    console.log("[FixCorruptNodes] Sample of fixed nodes:");
    console.log(JSON.stringify(verifyResult.rows, null, 2));

    console.log("[FixCorruptNodes] ✅ Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("[FixCorruptNodes] ❌ Migration failed:", error);
    process.exit(1);
  }
}

fixCorruptNodes();
