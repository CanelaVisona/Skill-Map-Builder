import postgres from 'postgres';
import { config } from 'dotenv';

config();

const sql = postgres(process.env.DATABASE_URL);

const areas = [
  "escribir", "facultad", "finanzas", "intelectual",
  "laburo", "life", "meditacin", "mindset", "msica",
  "programacin", "social", "surf", "viajando"
];

async function fixArea(areaId) {
  try {
    const result = await sql.unsafe(`
      WITH numbered_skills AS (
        SELECT 
          id,
          level,
          ROW_NUMBER() OVER (PARTITION BY level ORDER BY y) as pos_in_level,
          100 + (level - 1) * 300 + (ROW_NUMBER() OVER (PARTITION BY level ORDER BY y) - 1) * 50 as new_y
        FROM skills
        WHERE area_id = '${areaId}'
      )
      UPDATE skills
      SET y = numbered_skills.new_y
      FROM numbered_skills
      WHERE skills.id = numbered_skills.id;
    `);
    
    return result.count || 0;
  } catch (error) {
    console.error(`Error fixing ${areaId}:`, error.message);
    return 0;
  }
}

async function main() {
  console.log('Fixing y-coordinates...\n');
  let totalFixed = 0;

  for (const area of areas) {
    try {
      const fixed = await fixArea(area);
      console.log(`✓ ${area}: fixed`);
      totalFixed++;
    } catch (error) {
      console.error(`✗ ${area}: ${error.message}`);
    }
  }

  console.log(`\n✓ All ${totalFixed} areas processed`);
  await sql.end();
}

main();
