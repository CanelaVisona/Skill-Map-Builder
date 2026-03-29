import { db } from "./db";
import { sql } from "drizzle-orm";

/**
 * Data migration to normalize old data before the refactor
 * 
 * This migration runs automatically on server startup and:
 * 1. Sets isFinalNode = 1 on the node with highest levelPosition in each level
 * 2. Sets isAutoComplete = 1 on the node with levelPosition = 1 in each level
 * 3. Recalculates unlocked_level from actual completion (highest level where ALL skills mastered)
 * 4. Recalculates next_level_to_assign = unlocked_level + 3
 * 5. Never overwrites existing data (idempotent)
 * 6. Handles null/undefined safely - treats missing fields as 0
 * 
 * NOTE: endOfAreaLevel remains NULL to allow auto-generation.
 */
export async function runOldDataMigration(): Promise<void> {
  const startTime = Date.now();
  let areaSkillsProcessed = 0;
  let projectSkillsProcessed = 0;
  let subSkillsProcessed = 0;

  try {
    console.log("[migration] Starting skill node normalization...");

    // MIGRATION 1: Normalize isFinalNode and isAutoComplete for area skills
    console.log("[migration] Step 1: Normalizing area skills...");
    
    // Get all (areaId, level) combinations with skills
    const areaLevels = await db.execute(sql`
      SELECT DISTINCT area_id, level FROM skills 
      WHERE area_id IS NOT NULL 
      ORDER BY area_id, level
    `);

    for (const row of areaLevels.rows as any[]) {
      const { area_id, level } = row;
      
      if (!area_id || level === null || level === undefined) continue;

      // Get max levelPosition for this level
      const maxResult = await db.execute(sql`
        SELECT COALESCE(MAX(level_position), 0) as max_pos FROM skills
        WHERE area_id = ${area_id} AND level = ${level}
      `);
      
      const maxLevelPosition = (maxResult.rows[0] as any)?.max_pos ?? 1;

      // Update: isFinalNode = 1 for max levelPosition, else 0
      await db.execute(sql`
        UPDATE skills SET is_final_node = CASE 
          WHEN level_position = ${maxLevelPosition} THEN 1 
          ELSE 0 
        END
        WHERE area_id = ${area_id} AND level = ${level}
      `);

      // Update: isAutoComplete = 1 for levelPosition = 1, else 0
      await db.execute(sql`
        UPDATE skills SET is_auto_complete = CASE 
          WHEN level_position = 1 THEN 1 
          ELSE 0 
        END
        WHERE area_id = ${area_id} AND level = ${level}
      `);

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as cnt FROM skills
        WHERE area_id = ${area_id} AND level = ${level}
      `);
      areaSkillsProcessed += (countResult.rows[0] as any)?.cnt ?? 0;
    }
    console.log(`[migration] ✓ Processed ${areaSkillsProcessed} area skills`);

    // MIGRATION 2: Normalize isFinalNode and isAutoComplete for project skills
    console.log("[migration] Step 2: Normalizing project skills...");
    
    const projectLevels = await db.execute(sql`
      SELECT DISTINCT project_id, level FROM skills 
      WHERE project_id IS NOT NULL 
      ORDER BY project_id, level
    `);

    for (const row of projectLevels.rows as any[]) {
      const { project_id, level } = row;
      
      if (!project_id || level === null || level === undefined) continue;

      // Get max levelPosition for this level
      const maxResult = await db.execute(sql`
        SELECT COALESCE(MAX(level_position), 0) as max_pos FROM skills
        WHERE project_id = ${project_id} AND level = ${level}
      `);
      
      const maxLevelPosition = (maxResult.rows[0] as any)?.max_pos ?? 1;

      // Update both fields
      await db.execute(sql`
        UPDATE skills SET 
          is_final_node = CASE WHEN level_position = ${maxLevelPosition} THEN 1 ELSE 0 END,
          is_auto_complete = CASE WHEN level_position = 1 THEN 1 ELSE 0 END
        WHERE project_id = ${project_id} AND level = ${level}
      `);

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as cnt FROM skills
        WHERE project_id = ${project_id} AND level = ${level}
      `);
      projectSkillsProcessed += (countResult.rows[0] as any)?.cnt ?? 0;
    }
    console.log(`[migration] ✓ Processed ${projectSkillsProcessed} project skills`);

    // MIGRATION 3: Normalize isFinalNode and isAutoComplete for sub-skills
    console.log("[migration] Step 3: Normalizing sub-skills...");
    
    const subSkillLevels = await db.execute(sql`
      SELECT DISTINCT parent_skill_id, level FROM skills 
      WHERE parent_skill_id IS NOT NULL 
      ORDER BY parent_skill_id, level
    `);

    for (const row of subSkillLevels.rows as any[]) {
      const { parent_skill_id, level } = row;
      
      if (!parent_skill_id || level === null || level === undefined) continue;

      // Get max levelPosition for this level
      const maxResult = await db.execute(sql`
        SELECT COALESCE(MAX(level_position), 0) as max_pos FROM skills
        WHERE parent_skill_id = ${parent_skill_id} AND level = ${level}
      `);
      
      const maxLevelPosition = (maxResult.rows[0] as any)?.max_pos ?? 1;

      // Update both fields
      await db.execute(sql`
        UPDATE skills SET 
          is_final_node = CASE WHEN level_position = ${maxLevelPosition} THEN 1 ELSE 0 END,
          is_auto_complete = CASE WHEN level_position = 1 THEN 1 ELSE 0 END
        WHERE parent_skill_id = ${parent_skill_id} AND level = ${level}
      `);

      const countResult = await db.execute(sql`
        SELECT COUNT(*) as cnt FROM skills
        WHERE parent_skill_id = ${parent_skill_id} AND level = ${level}
      `);
      subSkillsProcessed += (countResult.rows[0] as any)?.cnt ?? 0;
    }
    console.log(`[migration] ✓ Processed ${subSkillsProcessed} sub-skills`);

    // MIGRATION 4: Fix unlocked_level and next_level_to_assign for all areas
    console.log("[migration] Step 4: Recalculating area state (unlocked_level, next_level_to_assign)...");
    
    // Get all areas
    const areasResult = await db.execute(sql`
      SELECT id FROM areas WHERE archived = 0
    `);
    
    let areasFixed = 0;
    
    for (const row of areasResult.rows as any[]) {
      const areaId = row.id;
      if (!areaId) continue;

      // Find the highest level where ALL skills are mastered
      // For each level, count total and mastered, then find highest complete level
      const levelCompletionResult = await db.execute(sql`
        SELECT 
          level,
          COUNT(*) as total_count,
          SUM(CASE WHEN status = 'mastered' THEN 1 ELSE 0 END) as mastered_count
        FROM skills
        WHERE area_id = ${areaId}
        GROUP BY level
        ORDER BY level DESC
      `);

      let unlockedLevel = 1; // Default: if no level is fully complete, start at 1
      
      // Find highest level where all skills are mastered
      for (const levelRow of levelCompletionResult.rows as any[]) {
        const { level, total_count, mastered_count } = levelRow;
        
        // If this level has all skills mastered
        if (mastered_count === total_count && mastered_count > 0) {
          unlockedLevel = level;
          break; // Found the highest complete level
        }
      }

      // Calculate next_level_to_assign = unlocked_level + 3
      const nextLevelToAssign = unlockedLevel + 3;

      // Update the area
      await db.execute(sql`
        UPDATE areas
        SET unlocked_level = ${unlockedLevel}, next_level_to_assign = ${nextLevelToAssign}
        WHERE id = ${areaId}
      `);

      areasFixed++;
    }
    
    console.log(`[migration] ✓ Fixed ${areasFixed} areas (unlocked_level + next_level_to_assign)`);

    const duration = Date.now() - startTime;
    const totalSkills = areaSkillsProcessed + projectSkillsProcessed + subSkillsProcessed;
    console.log(
      `[migration] ✓ Complete old data migration in ${duration}ms\n` +
      `[migration] Summary:\n` +
      `  - ${areaSkillsProcessed} area skills normalized (isFinalNode, isAutoComplete)\n` +
      `  - ${projectSkillsProcessed} project skills normalized\n` +
      `  - ${subSkillsProcessed} sub-skills normalized\n` +
      `  - ${totalSkills} total skills updated\n` +
      `  - ${areasFixed} areas recalculated (unlocked_level, next_level_to_assign)\n` +
      `[migration] ✓ endOfAreaLevel left as NULL (allows auto-generation)`
    );
  } catch (error: any) {
    console.error("[migration] ✗ Failed:", error.message);
    console.error("[migration] Stack trace:", error.stack);
    // Don't fail server startup - log and continue
    // This allows debugging and manual cleanup if needed
  }
}
