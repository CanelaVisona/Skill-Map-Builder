import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './shared/schema';
import { eq, asc } from 'drizzle-orm';

const { areas, skills } = schema;

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool, { schema });

(async () => {
  try {
    console.log('🔍 VERIFYING ALL AREAS\n');

    // Get all areas
    const allAreas = await db.select().from(areas);

    for (const area of allAreas.sort((a, b) => a.name.localeCompare(b.name))) {
      const unlockedLevel = area.unlockedLevel;
      
      // Get all levels in this area
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

      let hasProblems = false;
      const levelStats = [];

      for (const [level, levelSkills] of Array.from(levels.entries()).sort((a, b) => a[0] - b[0])) {
        const isUnlocked = level <= unlockedLevel;
        const availableCount = levelSkills.filter(s => s.status === 'available').length;
        const lockedCount = levelSkills.filter(s => s.status === 'locked').length;
        const masteredCount = levelSkills.filter(s => s.status === 'mastered').length;
        
        let isValid = true;
        if (isUnlocked) {
          // Unlocked levels should have exactly 1 available
          if (availableCount !== 1) isValid = false;
        } else {
          // Blocked levels should have 0 available
          if (availableCount !== 0) isValid = false;
        }

        levelStats.push({
          level,
          isUnlocked,
          available: availableCount,
          locked: lockedCount,
          mastered: masteredCount,
          isValid
        });

        if (!isValid) hasProblems = true;
      }

      // Print area summary
      const allValid = levelStats.every(s => s.isValid);
      const icon = allValid ? '✅' : '❌';
      console.log(`${icon} ${area.name.padEnd(20)} (${allAreas.indexOf(area) + 1}/${allAreas.length})`);

      if (!allValid) {
        for (const stat of levelStats) {
          if (!stat.isValid) {
            const mark = stat.isUnlocked ? '🔓' : '🔒';
            console.log(`   ${mark} Level ${stat.level}: ${stat.available} available (should be ${stat.isUnlocked ? 1 : 0})`);
          }
        }
      }
    }

    console.log('\n✨ Verification complete!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
