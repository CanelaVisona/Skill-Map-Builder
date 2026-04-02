import { db } from "./server/db.js";
import { areas, skills } from "@shared/schema.js";
import { eq, and, gte } from "drizzle-orm";

async function fixFirstNodesLevel3() {
  console.log("🔧 Iniciando corrección de primeros nodos (levelPosition=1) en nivel 3+...\n");
  
  try {
    // Obtener todas las áreas primero
    const allAreas = await db.select().from(areas);
    console.log(`Áreas disponibles: ${allAreas.map(a => a.name).join(", ")}\n`);
    
    // Obtener las áreas Intelectual y Programación
    const targetAreas = allAreas.filter(a => 
      a.name === "Intelectual" || a.name === "Programación"
    );
    
    if (targetAreas.length === 0) {
      console.log("❌ No se encontraron las áreas 'Intelectual' o 'Programación'");
      process.exit(1);
    }
    
    console.log(`✓ Áreas objetivo encontradas: ${targetAreas.map(a => a.name).join(", ")}\n`);
    
    let totalFixed = 0;
    
    for (const area of targetAreas) {
      console.log(`\n📍 Procesando área: ${area.name} (ID: ${area.id})`);
      
      // Obtener todos los nodos con levelPosition=1 en nivel 3+
      const firstNodesLevel3Plus = await db.select().from(skills)
        .where(
          and(
            eq(skills.areaId, area.id),
            eq(skills.levelPosition, 1),
            gte(skills.level, 3)
          )
        );
      
      if (firstNodesLevel3Plus.length === 0) {
        console.log(`  → No hay nodos con levelPosition=1 en nivel 3+`);
        continue;
      }
      
      console.log(`  → Encontrados ${firstNodesLevel3Plus.length} nodos a corregir:`);
      
      for (const skill of firstNodesLevel3Plus) {
        console.log(`    - Nivel ${skill.level}, levelPosition ${skill.levelPosition}: "${skill.title}" → ""`);
        
        // Actualizar: título vacío, mastered, y marcar como auto-complete
        await db.update(skills).set({
          title: "",
          status: "mastered",
          isAutoComplete: 1
        }).where(eq(skills.id, skill.id));
        
        totalFixed++;
      }
    }
    
    console.log(`\n✅ Corrección completada!`);
    console.log(`   Total de nodos corregidos: ${totalFixed}`);
    
    // Verificación: mostrar los nodos corregidos
    console.log(`\n📋 Verificación de cambios:\n`);
    
    for (const area of targetAreas) {
      const correctedNodes = await db.select().from(skills)
        .where(
          and(
            eq(skills.areaId, area.id),
            eq(skills.levelPosition, 1),
            gte(skills.level, 3)
          )
        );
      
      if (correctedNodes.length > 0) {
        console.log(`${area.name}:`);
        for (const node of correctedNodes) {
          console.log(`  ✓ Nivel ${node.level}: title="${node.title}", status="${node.status}", isAutoComplete=${node.isAutoComplete}`);
        }
        console.log();
      }
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error("❌ Error durante la corrección:", error);
    process.exit(1);
  }
}

fixFirstNodesLevel3().catch(error => {
  console.error("Error fatal:", error);
  process.exit(1);
});
