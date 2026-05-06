import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { skills } from './shared/schema';
import { eq, and, asc } from 'drizzle-orm';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

async function recalculateAvailableStatus(areaId: string, level: number) {
  const levelSkills = await db.select().from(skills).where(
    and(eq(skills.areaId, areaId), eq(skills.level, level))
  ).orderBy(asc(skills.levelPosition));

  if (levelSkills.length === 0) return;

  // RULE: Skeleton (Pos 1) MUST be mastered
  if (levelSkills[0].levelPosition === 1) {
    if (levelSkills[0].status !== "mastered") {
      await db.update(skills).set({ status: "mastered" }).where(eq(skills.id, levelSkills[0].id));
    }
  }

  // Find first non-mastered node (starting from Pos 2, because Pos 1 is always mastered)
  let firstNonMasteredIndex = -1;
  for (let i = 1; i < levelSkills.length; i++) {  // Start from index 1 (Pos 2)
    if (levelSkills[i].status !== "mastered") {
      firstNonMasteredIndex = i;
      break;
    }
  }

  // Update all statuses
  for (let i = 0; i < levelSkills.length; i++) {
    const skill = levelSkills[i];
    let newStatus: "mastered" | "available" | "locked";
    
    if (i === 0) {
      // Position 1 is ALWAYS mastered
      newStatus = "mastered";
    } else if (i === firstNonMasteredIndex && firstNonMasteredIndex !== -1) {
      // First non-mastered (after skeleton) becomes available
      newStatus = "available";
    } else {
      // Everything else is locked
      newStatus = "locked";
    }

    if (skill.status !== newStatus) {
      await db.update(skills).set({ status: newStatus }).where(eq(skills.id, skill.id));
    }
  }
}

async function fixFinanzasCorrect() {
  console.log('=== FIXING FINANZAS AREA (CORRECTED) ===\n');

  const finanzasSkills = await db.select().from(skills).where(
    eq(skills.areaId, 'finanzas')
  ).orderBy(asc(skills.level), asc(skills.levelPosition));

  // Group by level
  const levelGroups = new Map<number, typeof finanzasSkills>();
  for (const skill of finanzasSkills) {
    if (!levelGroups.has(skill.level)) {
      levelGroups.set(skill.level, []);
    }
    levelGroups.get(skill.level)!.push(skill);
  }

  for (const level of Array.from(levelGroups.keys()).sort((a, b) => a - b)) {
    console.log(`Level ${level}: Recalculating...`);
    await recalculateAvailableStatus('finanzas', level);
  }

  console.log('\n✅ Finanzas area fixed!\n');

  // Verify
  console.log('=== VERIFICATION ===\n');
  const finanzasSkillsAfter = await db.select().from(skills).where(
    eq(skills.areaId, 'finanzas')
  ).orderBy(asc(skills.level), asc(skills.levelPosition));

  const levelGroupsAfter = new Map<number, typeof finanzasSkillsAfter>();
  for (const skill of finanzasSkillsAfter) {
    if (!levelGroupsAfter.has(skill.level)) {
      levelGroupsAfter.set(skill.level, []);
    }
    levelGroupsAfter.get(skill.level)!.push(skill);
  }

  let allValid = true;
  for (const [level, levelSkills] of levelGroupsAfter.entries()) {
    console.log(`Level ${level}:`);
    levelSkills.forEach((s) => {
      const statusEmoji = s.status === 'mastered' ? '✓' : s.status === 'available' ? '⭐' : '🔒';
      console.log(`  Pos ${s.levelPosition} | ${statusEmoji} ${s.status.padEnd(10)}`);
    });

    const availableCount = levelSkills.filter(s => s.status === 'available').length;
    const skeleton = levelSkills[0];
    
    let valid = availableCount <= 1 && skeleton?.status === 'mastered';
    if (valid) {
      console.log(`  ✅ Valid (${availableCount} available, skeleton mastered)\n`);
    } else {
      console.log(`  ❌ INVALID\n`);
      allValid = false;
    }
  }

  if (allValid) {
    console.log('🎉 All levels are valid!');
  }

  process.exit(0);
}

fixFinanzasCorrect().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
