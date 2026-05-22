import { db } from './server/db.js';
import { areas } from './shared/schema.js';

async function checkColors() {
  try {
    const result = await db.select().from(areas).limit(5);
    console.log('Area colors:');
    result.forEach(area => {
      console.log(`${area.name}: "${area.color}"`);
    });
  } catch (err) {
    console.error('Error:', err.message);
  }
  process.exit(0);
}

checkColors();
