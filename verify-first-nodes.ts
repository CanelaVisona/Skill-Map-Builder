import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import { eq, or, and } from "drizzle-orm";

const { areas, skills } = schema;

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool, { schema });

(async () => {
  try {
    console.log("Buscando nodos con levelPosition=1...\n");
    
    // Buscar TODOS los nodos con levelPosition=1 en Intelectual y Programación
    const allSkills = await db.select().from(skills);
    const targetSkills = allSkills.filter(s => 
      s.levelPosition === 1 && 
      (s.areaId === 'intelectual' || s.areaId === 'programacion')
    );
    
    console.log(`Total encontrados: ${targetSkills.length}\n`);
    
    targetSkills.forEach(s => {
      console.log(`Nivel ${s.level}:`);
      console.log(`  ID: ${s.id}`);
      console.log(`  Área: ${s.areaId}`);
      console.log(`  Title: "${s.title}"`);
      console.log(`  Status: ${s.status}`);
      console.log(`  isAutoComplete: ${s.isAutoComplete}`);
      console.log();
    });
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    await pool.end();
    process.exit(1);
  }
})();
