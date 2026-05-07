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

async function recalculateLevelStatuses(areaId: string, level: number) {
  const levelSkills = await db.select().from(skills).where(
    and(eq(skills.areaId, areaId), eq(skills.level, level))
  ).orderBy(asc(skills.levelPosition));

  if (levelSkills.length === 0) return;

  // Get area to check unlockedLevel
  const areaData = await db.select().from(areas).where(eq(areas.id, areaId));
  const unlockedLevel = areaData[0]?.unlockedLevel || 999;

  // Position 1 MUST be mastered
  if (levelSkills[0].levelPosition === 1) {
    if (levelSkills[0].status !== "mastered") {
      await db.update(skills).set({ status: "mastered" }).where(eq(skills.id, levelSkills[0].id));
    }
  }

  // Auto-complete nodes always mastered
  for (const skill of levelSkills) {
    if (skill.isAutoComplete === 1 && skill.status !== "mastered") {
      await db.update(skills).set({ status: "mastered" }).where(eq(skills.id, skill.id));
    }
  }

  // If level is blocked, lock all non-skeleton nodes
  if (level > unlockedLevel) {
    for (let i = 1; i < levelSkills.length; i++) {
      if (levelSkills[i].status !== "locked") {
        await db.update(skills).set({ status: "locked" }).where(eq(skills.id, levelSkills[i].id));
      }
    }
    return;
  }

  // For unlocked levels: find first non-mastered
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
      // All mastered - keep as mastered
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
    console.log('🔧 FIXING ALL AREAS\n');

    const allAreas = await db.select().from(areas);
    let fixed = 0;

    for (const area of allAreas) {
      // Get all levels in area
      const allSkills = await db.select().from(skills)
        .where(eq(skills.areaId, area.id));

      if (allSkills.length === 0) continue;

      const levels = new Set(allSkills.map(s => s.level));
      
      console.log(`  📍 ${area.name}: ${levels.size} levels`);

      for (const level of Array.from(levels).sort((a, b) => a - b)) {
        await recalculateLevelStatuses(area.id, level);
      }

      fixed++;
    }

    console.log(`\n✅ Fixed ${fixed} areas!\n`);

    // Verify
    console.log('📊 VERIFICATION:\n');

    let allValid = true;
    let validCount = 0;

    for (const area of allAreas.sort((a, b) => a.name.localeCompare(b.name))) {
      const allSkills = await db.select().from(skills)
        .where(eq(skills.areaId, area.id))
        .orderBy(asc(skills.level), asc(skills.levelPosition));

      if (allSkills.length === 0) continue;

      const levels = new Map<number, typeof allSkills>();
      for (const skill of allSkills) {
        if (!levels.has(skill.level)) {
          levels.set(skill.level, []);
        }
        levels.get(skill.level)!.push(skill);
      }

      let areaValid = true;
      const unlockedLevel = area.unlockedLevel;

      for (const [level, levelSkills] of levels) {
        const availableCount = levelSkills.filter(s => s.status === 'available').length;
        const isUnlocked = level <= unlockedLevel;
        const expectedAvailable = isUnlocked ? 1 : 0;

        if (availableCount !== expectedAvailable) {
          areaValid = false;
          allValid = false;
        }
      }

      const icon = areaValid ? '✅' : '❌';
      console.log(`${icon} ${area.name}`);
      
      if (areaValid) validCount++;
    }

    console.log(`\n📈 ${validCount}/${allAreas.length} areas are valid`);

    if (allValid) {
      console.log('🎉 ALL AREAS FIXED!');
    } else {
      console.log('⚠️  Some areas still have issues');
    }

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
