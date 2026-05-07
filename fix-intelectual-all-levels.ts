import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './shared/schema';
import { eq, and, asc } from 'drizzle-orm';

const { areas, skills } = schema;

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool, { schema });

async function recalculateAvailableStatus(areaId: string, level: number) {
  const levelSkills = await db.select().from(skills).where(
    and(eq(skills.areaId, areaId), eq(skills.level, level))
  ).orderBy(asc(skills.levelPosition));

  if (levelSkills.length === 0) return;

  // Get area to check unlockedLevel
  const areaData = await db.select().from(areas).where(eq(areas.id, areaId));
  const unlockedLevel = areaData[0]?.unlockedLevel || 999;

  // CRITICAL RULE: Skeleton (position 1) MUST ALWAYS be mastered
  if (levelSkills[0].levelPosition === 1) {
    if (levelSkills[0].status !== "mastered") {
      await db.update(skills).set({ status: "mastered" }).where(eq(skills.id, levelSkills[0].id));
    }
  }

  // Ensure auto-complete nodes are always mastered
  for (const skill of levelSkills) {
    if (skill.isAutoComplete === 1 && skill.status !== "mastered") {
      await db.update(skills).set({ status: "mastered" }).where(eq(skills.id, skill.id));
    }
  }

  // If level is blocked, all non-skeleton nodes must be locked
  if (level > unlockedLevel) {
    for (let i = 1; i < levelSkills.length; i++) {
      const skill = levelSkills[i];
      if (skill.status !== "locked") {
        await db.update(skills).set({ status: "locked" }).where(eq(skills.id, skill.id));
      }
    }
    return;
  }

  // For unlocked levels: Find first non-mastered
  let firstNonMasteredIndex = -1;
  for (let i = 1; i < levelSkills.length; i++) {
    if (levelSkills[i].status !== "mastered") {
      firstNonMasteredIndex = i;
      break;
    }
  }

  // Update statuses
  for (let i = 0; i < levelSkills.length; i++) {
    const skill = levelSkills[i];
    let newStatus: "mastered" | "available" | "locked";
    
    if (i === 0) {
      newStatus = "mastered";
    } else if (firstNonMasteredIndex === -1) {
      // All nodes are mastered (level complete) - keep them all mastered
      newStatus = "mastered";
    } else if (i === firstNonMasteredIndex) {
      newStatus = "available";
    } else {
      newStatus = "locked";
    }

    if (skill.status !== newStatus) {
      await db.update(skills).set({ status: newStatus }).where(eq(skills.id, skill.id));
    }
  }
}

(async () => {
  try {
    console.log('🔧 FIXING INTELECTUAL AREA\n');

    // Get all levels in Intelectual
    const allSkills = await db.select().from(skills)
      .where(eq(skills.areaId, 'intelectual'))
      .orderBy(asc(skills.level));

    const levels = new Set(allSkills.map(s => s.level));

    console.log(`📍 Found ${levels.size} levels in Intelectual\n`);

    // Recalculate for each level
    for (const level of Array.from(levels).sort((a, b) => a - b)) {
      console.log(`  Level ${level}: Recalculating...`);
      await recalculateAvailableStatus('intelectual', level);
    }

    console.log('\n✅ Intelectual area fixed!\n');

    // Verify
    console.log('📊 VERIFICATION:\n');
    const fixedSkills = await db.select().from(skills)
      .where(eq(skills.areaId, 'intelectual'))
      .orderBy(asc(skills.level), asc(skills.levelPosition));

    const levelMap = new Map<number, typeof fixedSkills>();
    for (const skill of fixedSkills) {
      if (!levelMap.has(skill.level)) {
        levelMap.set(skill.level, []);
      }
      levelMap.get(skill.level)!.push(skill);
    }

    const areaData = await db.select().from(areas).where(eq(areas.id, 'intelectual'));
    const unlockedLevel = areaData[0]?.unlockedLevel || 999;

    let hasProblems = false;
    for (const [level, levelSkills] of Array.from(levelMap.entries()).sort((a, b) => a[0] - b[0])) {
      const isUnlocked = level <= unlockedLevel;
      const availableCount = levelSkills.filter(s => s.status === 'available').length;
      
      const status = isUnlocked
        ? availableCount === 1 ? '✅' : '❌'
        : availableCount === 0 ? '✅' : '❌';

      console.log(`  Level ${level} ${isUnlocked ? '🔓' : '🔒'}: ${availableCount} available - ${status}`);

      if (isUnlocked && availableCount !== 1) {
        hasProblems = true;
        levelSkills.filter(s => s.status === 'available').forEach(s => {
          console.log(`      Problem: Pos ${s.levelPosition} "${s.title.substring(0, 40)}"`);
        });
      } else if (!isUnlocked && availableCount !== 0) {
        hasProblems = true;
        levelSkills.filter(s => s.status === 'available').forEach(s => {
          console.log(`      Problem: Pos ${s.levelPosition} "${s.title.substring(0, 40)}" should be locked`);
        });
      }
    }

    if (!hasProblems) {
      console.log('\n🎉 All levels are now correct!');
    } else {
      console.log('\n⚠️  Some problems remain');
    }

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
