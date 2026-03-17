import { db } from "./server/db.ts";
import { globalSkills } from "./shared/schema.ts";
import { eq } from "drizzle-orm";

async function fixMusicSkills() {
  try {
    console.log("Actualizando estructura de skills de música...\n");
    
    // Find the "Reconocer las notas sobre el mástil" skill
    const subskill = await db
      .select()
      .from(globalSkills)
      .where(eq(globalSkills.name, "Reconocer las notas sobre el mástil"));
    
    if (subskill.length === 0) {
      console.log("❌ No se encontró 'Reconocer las notas sobre el mástil'");
      process.exit(1);
    }
    
    const skill = subskill[0];
    console.log(`Encontrado: "${skill.name}"`);
    console.log(`  Actual areaId: ${skill.areaId || "null"}`);
    console.log(`  Actual parentSkillId: ${skill.parentSkillId || "null"}\n`);
    
    // Update to be a direct skill of the área, not a subskill
    await db
      .update(globalSkills)
      .set({
        areaId: "msica",
        parentSkillId: null,
        updatedAt: new Date()
      })
      .where(eq(globalSkills.id, skill.id));
    
    console.log(`✓ Actualizado: "${skill.name}"`);
    console.log(`  Nuevo areaId: msica`);
    console.log(`  Nuevo parentSkillId: null\n`);
    
    // Verify both skills exist now
    const finalSkills = await db
      .select()
      .from(globalSkills)
      .where(eq(globalSkills.areaId, "msica"));
    
    console.log(`✓ Verificación final: ${finalSkills.length} skill(s) en el área música:`);
    finalSkills.forEach((s) => {
      console.log(`  - "${s.name}"`);
    });
    
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

fixMusicSkills().then(() => {
  console.log("\n✓ Proceso completado");
  process.exit(0);
});
