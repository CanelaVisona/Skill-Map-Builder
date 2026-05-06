import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { skills } from './shared/schema';
import { eq, and, asc } from 'drizzle-orm';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

async function consolidateLevelPositions(areaId: string, level: number) {
  // Get all skills in this level sorted by Y
  const levelSkills = await db.select().from(skills).where(
    and(eq(skills.areaId, areaId), eq(skills.level, level))
  ).orderBy(asc(skills.y));

  // Update each with consecutive position
  for (let i = 0; i < levelSkills.length; i++) {
    const newPos = i + 1;
    if (levelSkills[i].levelPosition !== newPos) {
      await db.update(skills).set({ levelPosition: newPos }).where(eq(skills.id, levelSkills[i].id));
    }
  }
}

async function recalculateAvailableStatus(areaId: string, level: number) {
  const levelSkills = await db.select().from(skills).where(
    and(eq(skills.areaId, areaId), eq(skills.level, level))
  ).orderBy(asc(skills.levelPosition));

  if (levelSkills.length === 0) return;

  // Step 1: Ensure skeleton (Pos 1) is ALWAYS mastered
  const skeleton = levelSkills[0];
  if (skeleton.levelPosition === 1 && skeleton.status !== "mastered") {
    console.log(`    Fixing skeleton Pos 1: ${skeleton.status} → mastered`);
    await db.update(skills).set({ status: "mastered" }).where(eq(skills.id, skeleton.id));
  }

  // Step 2: Find first non-mastered
  let firstNonMasteredIndex = -1;
  for (let i = 0; i < levelSkills.length; i++) {
    if (levelSkills[i].status !== "mastered") {
      firstNonMasteredIndex = i;
      break;
    }
  }

  // Step 3: Update all statuses
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
      console.log(`    Pos ${skill.levelPosition}: ${skill.status} → ${newStatus}`);
      await db.update(skills).set({ status: newStatus }).where(eq(skills.id, skill.id));
    }
  }
}

async function fixFinanzas() {
  console.log('=== FIXING FINANZAS AREA STRUCTURE ===\n');

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
    const levelSkills = levelGroups.get(level)!;
    console.log(`Level ${level}:`);

    // Step 1: Consolidate positions
    await consolidateLevelPositions('finanzas', level);
    console.log(`  ✓ Consolidated positions`);

    // Step 2: Fix availability
    await recalculateAvailableStatus('finanzas', level);
    console.log();
  }

  console.log('✅ Finanzas area fixed!\n');

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

  for (const [level, levelSkills] of levelGroupsAfter.entries()) {
    console.log(`Level ${level}:`);
    levelSkills.forEach((s) => {
      const statusEmoji = s.status === 'mastered' ? '✓' : s.status === 'available' ? '⭐' : '🔒';
      console.log(`  Pos ${s.levelPosition} | ${statusEmoji} ${s.status.padEnd(10)}`);
    });

    const availableCount = levelSkills.filter(s => s.status === 'available').length;
    if (availableCount <= 1) {
      console.log(`  ✅ Valid (${availableCount} available)\n`);
    } else {
      console.log(`  ❌ INVALID (${availableCount} available!)\n`);
    }
  }

  process.exit(0);
}

fixFinanzas().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
