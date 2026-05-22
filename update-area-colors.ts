import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { eq } from 'drizzle-orm';
import * as schema from './shared/schema';

const { areas } = schema;

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool, { schema });

function getAreaColor(name: string): string {
  const lowerName = name.toLowerCase();
  
  if (lowerName.includes("música") || lowerName.includes("musica") || lowerName.includes("guitarra") || lowerName.includes("piano")) {
    return "#c85a2a"; // Orange
  }
  if (lowerName.includes("meditación") || lowerName.includes("meditacion") || lowerName.includes("yoga") || lowerName.includes("zen")) {
    return "#7F77DD"; // Purple
  }
  if (lowerName.includes("surf") || lowerName.includes("ola") || lowerName.includes("agua") || lowerName.includes("natación") || lowerName.includes("natacion")) {
    return "#378ADD"; // Blue
  }
  if (lowerName.includes("intelecto") || lowerName.includes("intelectual") || lowerName.includes("lectura") || lowerName.includes("literatura") || lowerName.includes("conocimiento") || lowerName.includes("aprendizaje")) {
    return "#1D9E75"; // Green
  }
  if (lowerName.includes("casa") || lowerName.includes("hogar") || lowerName.includes("cocina") || lowerName.includes("limpieza")) {
    return "#BA7517"; // Brown
  }
  
  return "#c85a2a"; // Default to orange
}

(async () => {
  try {
    console.log('🔄 Actualizando colores de áreas...\n');

    const allAreas = await db.select().from(areas);
    
    if (allAreas.length === 0) {
      console.log('❌ No hay áreas en la BD');
      process.exit(0);
    }

    let updated = 0;
    for (const area of allAreas) {
      const newColor = getAreaColor(area.name);
      
      if (area.color !== newColor) {
        await db.update(areas)
          .set({ color: newColor })
          .where(eq(areas.id, area.id));
        
        console.log(`✅ "${area.name}": "${area.color}" → "${newColor}"`);
        updated++;
      } else {
        console.log(`⏭️  "${area.name}": ya tiene color "${newColor}"`);
      }
    }

    console.log(`\n📊 Total: ${updated} áreas actualizadas de ${allAreas.length}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
})();
