import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./shared/schema";
import { eq, and, gte } from "drizzle-orm";

const { areas, skills } = schema;

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool, { schema });

async function checkFirstNodes() {
  try {
    // Obtener todas las √°reas
    const allAreas = await db.select().from(areas);
    console.log("\nÌ≥ç √ÅREAS disponibles:");
    allAreas.forEach(a => console.log(`  - ${a.name} (ID: ${a.id})`));
    
    // Obtener Intelectual y Programaci√≥n
    const targetAreas = allAreas.filter(a => 
      a.name === "Intelectual" || a.name === "Programaci√≥n"
    );
    
    console.log(`\n‚úì √Åreas objetivo: ${targetAreas.map(a => a.name).join(", ")}\n`);
    
    for (const area of targetAreas) {
      console.log(`\n==== √ÅREA: ${area.name} (ID: ${area.id}) ====`);
      
      // Mostrar TODOS los nodos con levelPosition=1
      const allFirstNodes = await db.select().from(skills)
        .where(eq(skills.areaId, area.id))
        .then(skills => skills.filter(s => s.levelPosition === 1));
      
      if (allFirstNodes.length === 0) {
        console.log("  ‚ùå No hay nodos con levelPosition=1");
      } else {
        console.log(`  Ì≥ä Total nodos con levelPosition=1: ${allFirstNodes.length}\n`);
        allFirstNodes.forEach(node => {
          console.log(`    Nivel ${node.level}:`);
          console.log(`      - ID: ${node.id}`);
          console.log(`      - Title: "${node.title}"`);
          console.log(`      - Status: ${node.status}`);
          console.log(`      - isAutoComplete: ${node.isAutoComplete}`);
          console.log(`      - levelPosition: ${node.levelPosition}`);
          console.log();
        });
      }
    }
    
    await pool.end();
  } catch (error) {
    console.error("‚ùå Error:", error);
    await pool.end();
    process.exit(1);
  }
}

checkFirstNodes();
