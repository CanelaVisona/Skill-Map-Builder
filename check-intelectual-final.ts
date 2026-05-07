import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './shared/schema';
import { eq, asc } from 'drizzle-orm';

const { areas, skills } = schema;
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

(async () => {
  try {
    console.log('🔍 INTELECTUAL FINAL STATUS\n');
    const area = await db.select().from(areas).where(eq(areas.id, 'intelectual'));
    const allSkills = await db.select().from(skills)
      .where(eq(skills.areaId, 'intelectual'))
      .orderBy(asc(skills.level), asc(skills.levelPosition));

    const levels = new Map<number, typeof allSkills>();
    for (const skill of allSkills) {
      if (!levels.has(skill.level)) levels.set(skill.level, []);
      levels.get(skill.level)!.push(skill);
    }

    for (const [level, levelSkills] of Array.from(levels).sort((a, b) => a[0] - b[0])) {
      const unlockedLevel = area[0]!.unlockedLevel;
      const isUnlocked = level <= unlockedLevel;
      const available = levelSkills.filter(s => s.status === 'available').length;
      const mastered = levelSkills.filter(s => s.status === 'mastered').length;

      if (isUnlocked && available === 1) {
        const availNode = levelSkills.find(s => s.status === 'available');
        console.log(`✅ Level ${level}: 1 available ⭐ Pos ${availNode?.levelPosition} "${availNode?.title.substring(0, 40)}"`);
      } else if (!isUnlocked && available === 0) {
        console.log(`✅ Level ${level}: 0 available (blocked) 🔒`);
      } else {
        console.log(`❌ Level ${level}: ${available} available (error)`);
      }
    }

    process.exit(0);
  } catch (error: any) {
    console.error('❌', error.message);
    process.exit(1);
  }
})();
