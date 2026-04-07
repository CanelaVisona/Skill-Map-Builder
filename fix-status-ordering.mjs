import { neon } from '@neondatabase/serverless';

const dbUrl = 'postgresql://neondb_owner:npg_QOqBSy0zVt5R@ep-rapid-band-ahn7lyss-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = neon(dbUrl);

console.log('Ì¥ß FIXING DATABASE STATUS ORDERING\n');

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

const pos1Issues = [
  { area: 'finanzas', level: 4 },
  { area: 'finanzas', level: 5 },
  { area: 'finanzas', level: 6 },
  { area: 'finanzas', level: 7 }
];

let fixedCount = 0;

try {
  // Fix levels with locked before available
  for (const { area, level } of brokenLevels) {
    // Get all skills in this level
    const skills = await sql`
      SELECT id, level_position, status
      FROM skills
      WHERE area_id = ${area}
        AND level = ${level}
      ORDER BY level_position;
    `;

    // Find the locked that comes before available
    let availablePos = -1;
    let firstLockedPos = -1;
    
    for (let i = 0; i < skills.length; i++) {
      if (skills[i].status === 'available' && availablePos === -1) {
        availablePos = i;
      }
      if (skills[i].status === 'locked' && firstLockedPos === -1 && i < availablePos) {
        firstLockedPos = i;
      }
    }

    if (availablePos > -1 && firstLockedPos > -1 && firstLockedPos < availablePos) {
      // Find what should be available: first non-mastered after consecutive mastered from pos 1
      let expectedAvailableIdx = 0;
      for (let i = 0; i < skills.length; i++) {
        if (skills[i].status === 'mastered') {
          expectedAvailableIdx = i + 1;
        } else {
          break;
        }
      }

      // Make node at expectedAvailableIdx available
      if (expectedAvailableIdx < skills.length) {
        const nodeToMakeAvailable = skills[expectedAvailableIdx];
        await sql`
          UPDATE skills
          SET status = 'available'
          WHERE id = ${nodeToMakeAvailable.id};
        `;
        
        // Make any other available nodes in this level locked
        await sql`
          UPDATE skills
          SET status = 'locked'
          WHERE area_id = ${area}
            AND level = ${level}
            AND status = 'available'
            AND id != ${nodeToMakeAvailable.id};
        `;
        
        fixedCount++;
        console.log(`‚úÖ Fixed ${area}, Level ${level}`);
      }
    }
  }

  // Fix levels where position 1 is not mastered
  for (const { area, level } of pos1Issues) {
    await sql`
      UPDATE skills
      SET status = 'mastered'
      WHERE area_id = ${area}
        AND level = ${level}
        AND level_position = 1;
    `;

    // Get all skills in this level to fix the rest
    const skills = await sql`
      SELECT id, level_position, status
      FROM skills
      WHERE area_id = ${area}
        AND level = ${level}
      ORDER BY level_position;
    `;

    // Find first non-mastered position
    let availableIdx = 0;
    for (let i = 0; i < skills.length; i++) {
      if (skills[i].status !== 'mastered') {
        availableIdx = i;
        break;
      }
    }

    // Make it available, rest locked
    if (availableIdx < skills.length) {
      const nodeToMakeAvailable = skills[availableIdx];
      await sql`
        UPDATE skills
        SET status = 'available'
        WHERE id = ${nodeToMakeAvailable.id};
      `;

      await sql`
        UPDATE skills
        SET status = 'locked'
        WHERE area_id = ${area}
          AND level = ${level}
          AND level_position > ${nodeToMakeAvailable.level_position}
          AND status != 'mastered';
      `;

      fixedCount++;
      console.log(`‚úÖ Fixed ${area}, Level ${level} (position 1)`);
    }
  }

  console.log(`\n‚ú® Fixed ${fixedCount} levels\n`);
  process.exit(0);
} catch (err) {
  console.error('‚ùå Error:', err.message);
  process.exit(1);
}
