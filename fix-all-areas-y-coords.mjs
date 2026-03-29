import { config } from 'dotenv';
import postgres from 'postgres';

config();

const sql = postgres(process.env.DATABASE_URL);

async function fixAreaYCoordinates(areaId) {
  try {
    // Get all levels and their skills in order
    const levels = await sql`
      SELECT DISTINCT level 
      FROM skills 
      WHERE area_id = ${areaId}
      ORDER BY level
    `;

    let currentY = 100;
    let fixedCount = 0;

    for (const { level } of levels) {
      // Get all skills in this level
      const skills = await sql`
        SELECT id, y 
        FROM skills 
        WHERE area_id = ${areaId} AND level = ${level}
        ORDER BY y
      `;

      // Calculate new y-coordinates
      for (let i = 0; i < skills.length; i++) {
        const newY = currentY + (i * 50); // 50px vertical spacing within level
        
        if (skills[i].y !== newY) {
          await sql`
            UPDATE skills 
            SET y = ${newY}
            WHERE id = ${skills[i].id}
          `;
          fixedCount++;
        }
      }

      // Move to next level (150px gap)
      const maxY = Math.max(...skills.map(s => s.y || 0));
      currentY = (currentY + skills.length * 50) + 100; // level height + gap
    }

    return fixedCount;
  } catch (error) {
    console.error(`Error fixing ${areaId}:`, error.message);
    return 0;
  }
}

async function run() {
  const affectedAreas = [
    'casa_limpia', 'escribir', 'facultad', 'finanzas', 'intelectual',
    'laburo', 'life', 'meditacin', 'mindset', 'msica',
    'programacin', 'social', 'surf', 'viajando'
  ];

  console.log('Fixing y-coordinates for all affected areas...\n');
  let totalFixed = 0;

  for (const areaId of affectedAreas) {
    const fixed = await fixAreaYCoordinates(areaId);
    console.log(`✓ ${areaId}: ${fixed} skills updated`);
    totalFixed += fixed;
  }

  console.log(`\n✓ Total skills updated: ${totalFixed}`);
  await sql.end();
}

run().catch(console.error);
