import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { skills } from './shared/schema';
import { eq, and, asc } from 'drizzle-orm';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

async function recalculateAvailableStatus(
  level: number,
  options: { areaId?: string; projectId?: string; parentSkillId?: string }
) {
  const { areaId, projectId, parentSkillId } = options;
  const levelSkills = await db.select().from(skills).where(
    and(
      eq(skills.level, level),
      areaId ? eq(skills.areaId, areaId) : undefined,
      projectId ? eq(skills.projectId, projectId) : undefined,
      parentSkillId ? eq(skills.parentSkillId, parentSkillId) : undefined
    )
  ).orderBy(asc(skills.levelPosition));

  if (levelSkills.length === 0) {
    console.log(`  No skills found`);
    return;
  }

  console.log(`  Found ${levelSkills.length} skills`);

  // Ensure auto-complete are mastered
  for (const skill of levelSkills) {
    if (skill.isAutoComplete === 1 && skill.status !== "mastered") {
      console.log(`    Fixing pos ${skill.levelPosition}: ${skill.status} → mastered (auto-complete)`);
      await db.update(skills).set({ status: "mastered" }).where(eq(skills.id, skill.id));
    }
  }

  // Find first non-mastered
  let firstNonMasteredIndex = -1;
  for (let i = 0; i < levelSkills.length; i++) {
    if (levelSkills[i].status !== "mastered") {
      firstNonMasteredIndex = i;
      break;
    }
  }

  console.log(`  First non-mastered index: ${firstNonMasteredIndex} (pos ${firstNonMasteredIndex >= 0 ? levelSkills[firstNonMasteredIndex].levelPosition : 'N/A'})`);

  // Update all statuses
  for (let i = 0; i < levelSkills.length; i++) {
    const skill = levelSkills[i];
    let newStatus: "mastered" | "available" | "locked";
    
    if (skill.status === "mastered") {
      newStatus = "mastered";
    } else if (i === firstNonMasteredIndex && firstNonMasteredIndex !== -1) {
      newStatus = "available";
    } else {
      newStatus = "locked";
    }

    if (skill.status !== newStatus) {
      console.log(`    Updating pos ${skill.levelPosition} "${skill.title?.substring(0, 30)}...": ${skill.status} → ${newStatus}`);
      await db.update(skills).set({ status: newStatus }).where(eq(skills.id, skill.id));
    } else {
      console.log(`    Keeping pos ${skill.levelPosition}: ${skill.status} (no change)`);
    }
  }
}

async function fixBugs() {
  console.log('=== FIXING BUG 5: Intelectual Level 3 ===');
  await recalculateAvailableStatus(3, { areaId: 'intelectual' });

  console.log('\n=== FIXING BUG 6: Finanzas Level 4 ===');
  await recalculateAvailableStatus(4, { areaId: 'finanzas' });

  console.log('\n✅ Done!');
  process.exit(0);
}

fixBugs().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
