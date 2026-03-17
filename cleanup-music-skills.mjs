import { db } from "./server/db.ts";
import { globalSkills } from "./shared/schema.ts";
import { eq } from "drizzle-orm";

async function cleanupMusicSkills() {
  try {
    console.log("Buscando todos los skills del área música...\n");
    
    // Find all skills for music area
    const musicSkills = await db
      .select()
      .from(globalSkills)
      .where(eq(globalSkills.areaId, "msica"));
    
    console.log(`Encontrados ${musicSkills.length} skill(s) en el área música:`);
    musicSkills.forEach((skill, idx) => {
      console.log(`  ${idx + 1}. "${skill.name}"`);
      console.log(`     ID: ${skill.id}`);
      console.log(`     parentSkillId: ${skill.parentSkillId || "null"}`);
      console.log(`     createdAt: ${skill.createdAt}\n`);
    });
    
    // Keep only these skills
    const correctSkillNames = ["Aprender sobre música", "Reconocer las notas sobre el mástil"];
    const skillsToDelete = musicSkills.filter(s => !correctSkillNames.includes(s.name));
    
    if (skillsToDelete.length > 0) {
      console.log(`\n⚠️  Eliminando ${skillsToDelete.length} skill(s) duplicado(s)...\n`);
      for (const skill of skillsToDelete) {
        await db.delete(globalSkills).where(eq(globalSkills.id, skill.id));
        console.log(`  ✓ Eliminado: "${skill.name}" (ID: ${skill.id})`);
      }
      console.log("\n✓ Limpieza completada");
    } else {
      console.log("\n✓ No hay duplicados. Solo existen los 2 skills correctos.");
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

cleanupMusicSkills().then(() => {
  console.log("\nProceso finalizado.");
  process.exit(0);
});
