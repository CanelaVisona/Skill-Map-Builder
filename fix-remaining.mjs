import { neon } from '@neondatabase/serverless';

const dbUrl = 'postgresql://neondb_owner:npg_QOqBSy0zVt5R@ep-rapid-band-ahn7lyss-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = neon(dbUrl);

const remaining = [
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

let count = 0;

try {
  for (const { area, level } of remaining) {
    const skills = await sql`
      SELECT id, level_position, status
      FROM skills
      WHERE area_id = ${area} AND level = ${level}
      ORDER BY level_position;
    `;

    let lastMasteredIdx = -1;
    for (let i = 0; i < skills.length; i++) {
      if (skills[i].status === 'mastered') {
        lastMasteredIdx = i;
      } else {
        break;
      }
    }

    const availableIdx = lastMasteredIdx + 1;
    if (availableIdx < skills.length) {
      await sql`UPDATE skills SET status = 'available' WHERE id = ${skills[availableIdx].id};`;
      for (let i = availableIdx + 1; i < skills.length; i++) {
        if (skills[i].status !== 'mastered') {
          await sql`UPDATE skills SET status = 'locked' WHERE id = ${skills[i].id};`;
        }
      }
      count++;
      console.log(`✅ Fixed ${area}, Level ${level}`);
    }
  }

  console.log(`\n✨ Fixed ${count} more levels`);
  process.exit(0);
} catch (err) {
  console.error('❌ Error:', err.message);
  process.exit(1);
}
