import pkg from 'pg';
import { config } from 'dotenv';

const { Client } = pkg;
config();

const areas = [
  "escribir", "facultad", "finanzas", "intelectual",
  "laburo", "life", "meditacin", "mindset", "msica",
  "programacin", "social", "surf", "viajando"
];

async function fixArea(client, areaId) {
  try {
    const query = `
      WITH numbered_skills AS (
        SELECT 
          id,
          level,
          ROW_NUMBER() OVER (PARTITION BY level ORDER BY y) as pos_in_level,
          100 + (level - 1) * 300 + (ROW_NUMBER() OVER (PARTITION BY level ORDER BY y) - 1) * 50 as new_y
        FROM skills
        WHERE area_id = $1
      )
      UPDATE skills
      SET y = numbered_skills.new_y
      FROM numbered_skills
      WHERE skills.id = numbered_skills.id;
    `;
    
    await client.query(query, [areaId]);
    return true;
  } catch (error) {
    console.error(`Error fixing ${areaId}:`, error.message);
    return false;
  }
}

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Fixing y-coordinates...\n');
    let fixed = 0;

    for (const area of areas) {
      const success = await fixArea(client, area);
      if (success) {
        console.log(`✓ ${area}`);
        fixed++;
      }
    }

    console.log(`\n✓ All ${fixed}/${areas.length} areas processed`);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
