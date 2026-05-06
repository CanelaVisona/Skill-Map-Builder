import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { skills } from './shared/schema';
import { eq, and, or } from 'drizzle-orm';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

async function queryBugAreas() {
  const result = await db
    .select({
      area_id: skills.areaId,
      level: skills.level,
      level_position: skills.levelPosition,
      title: skills.title,
      status: skills.status,
    })
    .from(skills)
    .where(
      or(
        and(eq(skills.areaId, 'intelectual'), eq(skills.level, 3)),
        and(eq(skills.areaId, 'finanzas'), eq(skills.level, 4))
      )
    )
    .orderBy(skills.areaId, skills.level, skills.levelPosition);

  console.log('=== INTELECTUAL LEVEL 3 & FINANZAS LEVEL 4 SKILLS ===\n');
  console.log(JSON.stringify(result, null, 2));
  
  process.exit(0);
}

queryBugAreas().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
