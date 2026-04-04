import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";

const { areas, skills } = schema;

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool, { schema });

(async () => {
  try {
    // Get Intelectual and Programación
    const allAreas = await db.select().from(areas);
    const targetAreas = allAreas.filter(a => 
      a.name === "Intelectual" || a.name === "Programación"
    );
    
    console.log("=== VERIFICACIÓN COMPLETA DE BASE DE DATOS ===\n");
    
    for (const area of targetAreas) {
      const allSkills = await db.select().from(skills).where(eq(skills.areaId, area.id));
      
      console.log(`\n📍 ÁREA: ${area.name}`);
      console.log(`   Total skills: ${allSkills.length}\n`);
      
      // Group by levelPosition
      const byPosition = new Map<number, any[]>();
      allSkills.forEach(s => {
        const pos = s.levelPosition || 0;
        if (!byPosition.has(pos)) byPosition.set(pos, []);
        byPosition.get(pos)!.push(s);
      });
      
      // Show levelPosition 1 nodes (should all be empty)
      console.log("   🔴 NODOS CON levelPosition=1:");
      const pos1Nodes = byPosition.get(1) || [];
      if (pos1Nodes.length === 0) {
        console.log("      ❌ NINGUNO ENCONTRADO - error grave!");
      } else {
        pos1Nodes.forEach(node => {
          const problemático = node.title !== "" || node.isAutoComplete !== 1;
          const icon = problemático ? "❌" : "✅";
          console.log(`      ${icon} Nivel ${node.level}: title="${node.title}" isAutoComplete=${node.isAutoComplete}`);
        });
      }
      
      // Show levelPosition 2 nodes (esto ones should be "Nodo 2")
      console.log("\n   🟡 NODOS CON levelPosition=2:");
      const pos2Nodes = byPosition.get(2) || [];
      if (pos2Nodes.length === 0) {
        console.log("      ⚠️  NINGUNO ENCONTRADO");
      } else {
        pos2Nodes.forEach(node => {
          const icon = node.title === "Nodo 2" ? "✅" : "❌";
          console.log(`      ${icon} Nivel ${node.level}: title="${node.title}"`);
        });
      }
    }
    
    await pool.end();
    console.log("\n✅ Verificación completada\n");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    await pool.end();
    process.exit(1);
  }
})();
