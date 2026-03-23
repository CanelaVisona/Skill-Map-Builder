import { db } from "./server/db.js";
import { sql } from "drizzle-orm";

async function main() {
  try {
    console.log("Removing old skill columns from habits table...");
    
    // Drop the old columns
    await db.execute(sql`ALTER TABLE "habits" DROP COLUMN IF EXISTS "skill_progress_id"`);
    console.log("✓ Removed skill_progress_id column");
    
    await db.execute(sql`ALTER TABLE "habits" DROP COLUMN IF EXISTS "skill_tree_skill_id"`);
    console.log("✓ Removed skill_tree_skill_id column");
    
    // Now add the scheduledDays column with default value
    await db.execute(sql`ALTER TABLE "habits" ADD COLUMN IF NOT EXISTS "scheduled_days" jsonb DEFAULT '[0,1,2,3,4,5,6]'`);
    console.log("✓ Added scheduled_days column");
    
    console.log("\nMigration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error during migration:", error);
    process.exit(1);
  }
}

main();
