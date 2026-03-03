import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { globalSkills } from "./shared/schema";
import { eq } from "drizzle-orm";

const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL or NEON_DATABASE_URL not set");
  process.exit(1);
}

const client = postgres(connectionString);
const db = drizzle(client);

async function cleanupDuplicates() {
  try {
    console.log("🔍 Buscando duplicados de 'Guitarra'...");
    
    const guitarras = await db
      .select()
      .from(globalSkills)
      .where(eq(globalSkills.name, "Guitarra"));
    
    console.log(`\n📊 Encontrados ${guitarras.length} skill(s) llamado "Guitarra":\n`);
    guitarras.forEach((skill, idx) => {
      console.log(`  ${idx + 1}. ID: ${skill.id}`);
      console.log(`     areaId: ${skill.areaId || "❌ null"}`);
      console.log(`     projectId: ${skill.projectId || "❌ null"}`);
      console.log(`     createdAt: ${new Date(skill.createdAt).toLocaleString()}`);
      console.log();
    });
    
    const toDelete = guitarras.filter(s => !s.areaId && !s.projectId);
    
    if (toDelete.length > 0) {
      console.log(`\n🗑️  Eliminando ${toDelete.length} skill(s) sin areaId/projectId...\n`);
      for (const skill of toDelete) {
        await db.delete(globalSkills).where(eq(globalSkills.id, skill.id));
        console.log(`  ✅ Eliminado: ${skill.id}`);
      }
      console.log("\n✅ Limpieza completada\n");
    } else {
      console.log("\n✅ No hay duplicados para limpiar. Todos tienen areaId o projectId.\n");
    }
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

cleanupDuplicates().then(() => {
  process.exit(0);
});
