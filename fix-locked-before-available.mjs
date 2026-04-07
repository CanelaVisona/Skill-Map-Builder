import { neon } from '@neondatabase/serverless';

const dbUrl = 'postgresql://neondb_owner:npg_QOqBSy0zVt5R@ep-rapid-band-ahn7lyss-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = neon(dbUrl);

console.log('��� FIXING LOCKED-BEFORE-AVAILABLE ISSUES\n');

const brokenLevels = [
  { area: 'casa_limpia', level: 4 },
  { area: 'escribir', level: 2 },
  { area: 'ftbol', level: 3 },
  { area: 'intelectual', level: 3 },
  { area: 'intelectual', level: 6 },
  { area: 'laburo', level: 2 },
  { area: 'life', level: 2 },
  { area: 'life', level: 3 },
  { area: 'life', level: 4 },
  { area: 'meditacin', level: 6 },
  { area: 'meditacin', level: 9 },
  { area: 'mindset', level: 1 },
  { area: 'msica', level: 2 },
  { area: 'programacin', level: 4 },
  { area: 'programacin', level: 7 },
  { area: 'social', level: 2 },
  { area: 'surf', level: 4 },
  { area: 'viajando', level: 2 }
];

let fixedCount = 0;

try {
  for (const { area, level } of brokenLevels) {
    // Get all skills in this level, ordered by position
    const skills = await sql`
      SELECT id, level_position, status
      FROM skills
      WHERE area_id = ${area}
        AND level = ${level}
      ORDER BY level_position;
    `;

    if (skills.length === 0) {
      console.log(`⚠️  No skills found for ${area}, Level ${level}`);
      continue;
    }

    // Identify the correct sequence:
    // 1. Consecutive mastered from start
    // 2. First non-mastered becomes available
    // 3. Rest become locked

    let lastMasteredIdx = -1;
    for (let i = 0; i < skills.length; i++) {
      if (skills[i].status === 'mastered') {
        lastMasteredIdx = i;
      } else {
        break;
      }
    }

    // The node right after last mastered should be available
    const availableIdx = lastMasteredIdx + 1;

    if (availableIdx >= skills.length) {
      // All mastered - nothing to fix
      console.log(`⏭️  ${area}, Level ${level} - all mastered`);
      continue;
    }

    // Update the node that should be available
    await sql`
      UPDATE skills
      SET status = 'available'
      WHERE id = ${skills[availableIdx].id};
    `;

    // Update all other non-mastered nodes to locked
    for (let i = availableIdx + 1; i < skills.length; i++) {
      if (skills[i].status !== 'mastered') {
        await sql`
          UPDATE skills
          SET status = 'locked'
          WHERE id = ${skills[i].id};
        `;
      }
    }

    fixedCount++;
    console.log(`✅ Fixed ${area}, Level ${level}`);
  }

  console.log(`\n✨ Fixed ${fixedCount} levels\n`);
  process.exit(0);
} catch (err) {
  console.error('❌ Error:', err.message);
  process.exit(1);
}
