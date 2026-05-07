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
    const areaId = 'casa_limpia'; // Casa is failing
    
    console.log(`🔍 DEEP ANALYSIS OF CASA AREA\n`);

    const area = await db.select().from(areas).where(eq(areas.id, areaId));
    console.log(`📍 Area: ${area[0]?.name}`);
    console.log(`   ID: ${areaId}`);
    console.log(`   unlockedLevel: ${area[0]?.unlockedLevel}\n`);

    const allSkills = await db.select().from(skills)
      .where(eq(skills.areaId, areaId))
      .orderBy(asc(skills.level), asc(skills.levelPosition));

    console.log(`📊 ALL SKILLS BY LEVEL:\n`);

    const levels = new Map<number, typeof allSkills>();
    for (const skill of allSkills) {
      if (!levels.has(skill.level)) {
        levels.set(skill.level, []);
      }
      levels.get(skill.level)!.push(skill);
    }

    for (const [level, levelSkills] of Array.from(levels.entries()).sort((a, b) => a[0] - b[0])) {
      const isUnlocked = level <= area[0]!.unlockedLevel;
      const mark = isUnlocked ? '🔓' : '🔒';
      const mastered = levelSkills.filter(s => s.status === 'mastered').length;
      const available = levelSkills.filter(s => s.status === 'available').length;
      const locked = levelSkills.filter(s => s.status === 'locked').length;

      console.log(`Level ${level} ${mark} (Expected: ${isUnlocked ? '1 available' : '0 available'})`);
      console.log(`  Status Distribution: mastered=${mastered}, available=${available}, locked=${locked}`);

      for (const skill of levelSkills) {
        const statusIcon = skill.status === 'mastered' ? '✅' : skill.status === 'available' ? '⭐' : '🔒';
        console.log(`    ${statusIcon} Pos ${skill.levelPosition}: [${skill.status}] "${skill.title.substring(0, 40)}"`);
      }
      console.log();
    }

    // Try to understand why the recalculation didn't work
    console.log(`\n🔧 DIAGNOSIS:\n`);
    
    let allMasteredInLevel = true;
    let problem = '';

    for (const [level, levelSkills] of Array.from(levels.entries()).sort((a, b) => a[0] - b[0])) {
      const isUnlocked = level <= area[0]!.unlockedLevel;
      const available = levelSkills.filter(s => s.status === 'available').length;
      
      // Check if ALL non-pos1 nodes are mastered
      const allOthersMastered = levelSkills.slice(1).every(s => s.status === 'mastered');
      
      if (isUnlocked && available === 0 && allOthersMastered) {
        problem = `✅ Level ${level}: All nodes mastered (level completed)`;
        console.log(problem);
      } else if (isUnlocked && available !== 1) {
        problem = `❌ Level ${level}: ${available} available (expected 1)`;
        console.log(problem);
        
        // Check if first non-mastered is truly marked as available
        let firstNonMastered = -1;
        for (let i = 1; i < levelSkills.length; i++) {
          if (levelSkills[i].status !== 'mastered') {
            firstNonMastered = i;
            break;
          }
        }
        
        if (firstNonMastered !== -1) {
          const node = levelSkills[firstNonMastered];
          console.log(`   └─ First non-mastered: Pos ${node.levelPosition} [${node.status}] (should be available)`);
        } else {
          console.log(`   └─ No non-mastered nodes found (all should be mastered if level is complete)`);
        }
      } else if (!isUnlocked && available !== 0) {
        problem = `❌ Level ${level} (blocked): ${available} available (expected 0)`;
        console.log(problem);
        levelSkills
          .filter(s => s.status === 'available')
          .forEach(s => {
            console.log(`   └─ Pos ${s.levelPosition} [available] should be locked`);
          });
      }
    }

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
})();
