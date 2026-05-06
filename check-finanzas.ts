import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { skills } from './shared/schema';
import { eq, and, asc } from 'drizzle-orm';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

async function checkFinanzas() {
  console.log('=== CHECKING FINANZAS AREA ===\n');

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

  for (const [level, levelSkills] of levelGroups.entries()) {
    console.log(`Level ${level}:`);
    levelSkills.forEach((s, idx) => {
      const statusEmoji = s.status === 'mastered' ? '✓' : s.status === 'available' ? '⭐' : '🔒';
      console.log(
        `  Pos ${s.levelPosition} | ${statusEmoji} ${s.status.padEnd(10)} | isFinal: ${s.isFinalNode} | Title: "${s.title?.substring(0, 30) || '(empty)'}"`
      );
    });

    const availableCount = levelSkills.filter(s => s.status === 'available').length;
    const masteredCount = levelSkills.filter(s => s.status === 'mastered').length;
    console.log(`  Summary: ${masteredCount} mastered, ${availableCount} available\n`);
  }

  process.exit(0);
}

checkFinanzas().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
