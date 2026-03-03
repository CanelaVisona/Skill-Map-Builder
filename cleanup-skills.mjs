import { db } from "./server/db.ts";
import { globalSkills } from "./shared/schema.ts";
import { eq, isNull } from "drizzle-orm";

async function cleanupDuplicates() {
  try {
    console.log("Buscando duplicados de 'Guitarra'...");
    
    // Buscar todos los skills llamados "Guitarra"
    const guitarras = await db
      .select()
      .from(globalSkills)
      .where(eq(globalSkills.name, "Guitarra"));
    
    console.log(`Encontrados ${guitarras.length} skill(s) llamado "Guitarra":`);
    guitarras.forEach((skill, idx) => {
      console.log(`  ${idx + 1}. ID: ${skill.id}`);
      console.log(`     areaId: ${skill.areaId || "null"}`);
      console.log(`     projectId: ${skill.projectId || "null"}`);
      console.log(`     createdAt: ${skill.createdAt}`);
    });
    
    // Eliminar los que NO tengan areaId ni projectId
    const toDelete = guitarras.filter(s => !s.areaId && !s.projectId);
    
    if (toDelete.length > 0) {
      console.log(`\nEliminando ${toDelete.length} skill(s) sin areaId/projectId...`);
      for (const skill of toDelete) {
        await db
          .delete(globalSkills)
          .where(eq(globalSkills.id, skill.id));
        console.log(`  ✓ Eliminado: ${skill.id}`);
      }
      console.log("✓ Limpieza completada");
    } else {
      console.log("\nNo hay duplicados para limpiar. Todos los 'Guitarra' tienen areaId o projectId.");
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

cleanupDuplicates().then(() => {
  console.log("\nHecho.");
  process.exit(0);
});
