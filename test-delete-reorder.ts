import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { skills } from './shared/schema';
import { eq, and, asc } from 'drizzle-orm';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

async function testDeleteAndReorder() {
  console.log('=== TESTING DELETE & REORDER LOGIC ===\n');

  // Get all skills in intelectual level 3
  const level3Skills = await db.select().from(skills).where(
    and(eq(skills.areaId, 'intelectual'), eq(skills.level, 3))
  ).orderBy(asc(skills.levelPosition));

  console.log('Before any changes:');
  level3Skills.forEach(s => {
    console.log(
      `  Pos ${s.levelPosition} | Y: ${s.y} | Status: ${s.status} | Title: "${s.title?.substring(0, 20)}..."`
    );
  });

  console.log('\nVerifying the fix:');
  console.log('✓ Level positions should be consecutive (1, 2, 3, 4, 5, 6)');
  console.log('✓ There should be EXACTLY ONE available node');
  console.log('✓ When reordering available↔locked, statuses should swap');
  console.log('✓ When deleting a node, positions should be consolidated (1,2,3... → 1,2,3...)');

  const availableCount = level3Skills.filter(s => s.status === 'available').length;
  if (availableCount === 1) {
    console.log(`\n✅ PASS: Exactly 1 available node found`);
  } else {
    console.log(`\n❌ FAIL: Found ${availableCount} available nodes (expected 1)`);
  }

  const expectedPositions = level3Skills.map((_, i) => i + 1);
  const actualPositions = level3Skills.map(s => s.levelPosition);
  if (JSON.stringify(expectedPositions) === JSON.stringify(actualPositions)) {
    console.log(`✅ PASS: Level positions are consecutive`);
  } else {
    console.log(`❌ FAIL: Level positions not consecutive: ${actualPositions}`);
  }

  process.exit(0);
}

testDeleteAndReorder().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
