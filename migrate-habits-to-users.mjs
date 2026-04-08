import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Open the database
const db = new Database(join(__dirname, "skills.db"));
db.pragma("journal_mode = WAL");

try {
  console.log("🔍 Buscando usuario 'cane'...");
  
  // Find the "cane" user
  const caneUser = db
    .prepare(`SELECT id, email FROM users WHERE email = 'cane' OR email LIKE '%cane%' LIMIT 1`)
    .get();

  if (!caneUser) {
    console.error("❌ No se encontró usuario 'cane'. Usuarios existentes:");
    const allUsers = db.prepare("SELECT id, email FROM users").all();
    console.log(allUsers);
    process.exit(1);
  }

  console.log(`✅ Usuario encontrado: ${caneUser.email} (ID: ${caneUser.id})`);

  // Get all habits and check their userId
  console.log("\n📊 Verificando hábitos...");
  const allHabits = db.prepare("SELECT id, name, user_id FROM habits").all();
  console.log(`Total de hábitos: ${allHabits.length}`);

  // Check habits with null or wrong userId
  const habitsSQLCheck = db
    .prepare(`SELECT id, name, user_id FROM habits WHERE user_id IS NULL OR user_id = ''`)
    .all();
  console.log(`Hábitos sin usuario: ${habitsSQLCheck.length}`);

  if (habitsSQLCheck.length > 0) {
    console.log("Hábitos sin usuario:", habitsSQLCheck);
  }

  // List all unique userIds in habits table
  const habitUserIds = db.prepare("SELECT DISTINCT user_id FROM habits").all();
  console.log("UserIds únicos en tabla de hábitos:", habitUserIds);

  // List all users
  const allUsersInDb = db.prepare("SELECT id, email FROM users").all();
  console.log("\nTodos los usuarios en BD:", allUsersInDb);

  // Assign orphaned habits to cane user
  if (habitsSQLCheck.length > 0) {
    console.log(`\n⚙️ Asignando ${habitsSQLCheck.length} hábitos al usuario cane...`);
    
    const updateHabits = db.prepare(`
      UPDATE habits 
      SET user_id = ? 
      WHERE user_id IS NULL OR user_id = ''
    `);
    
    const result = updateHabits.run(caneUser.id);
    console.log(`✅ Actualizados ${result.changes} hábitos`);
  }

  // Check habitRecords without user_id
  console.log("\n📋 Verificando registros de hábitos...");
  const orphanedRecords = db.prepare("SELECT COUNT(*) as count FROM habit_records WHERE user_id IS NULL OR user_id = ''").get();
  console.log(`Registros sin usuario: ${orphanedRecords.count}`);

  if (orphanedRecords.count > 0) {
    console.log(`⚙️ Asignando ${orphanedRecords.count} registros de hábitos...`);
    
    const updateRecords = db.prepare(`
      UPDATE habit_records 
      SET user_id = ? 
      WHERE user_id IS NULL OR user_id = ''
    `);
    
    const result = updateRecords.run(caneUser.id);
    console.log(`✅ Actualizados ${result.changes} registros`);
  }

  // Verify all habits now have a user_id
  console.log("\n✔️ Verificación final...");
  const habitsWithoutUser = db
    .prepare("SELECT COUNT(*) as count FROM habits WHERE user_id IS NULL OR user_id = ''")
    .get();
  
  if (habitsWithoutUser.count === 0) {
    console.log("✅ Todos los hábitos tienen un usuario asignado");
  } else {
    console.error(`❌ Aún hay ${habitsWithoutUser.count} hábitos sin usuario`);
  }

  // Show final habits summary
  console.log("\n📊 Resumen final de hábitos por usuario:");
  const habitsByUser = db
    .prepare(`
      SELECT u.email, COUNT(h.id) as count 
      FROM users u 
      LEFT JOIN habits h ON u.id = h.user_id 
      GROUP BY u.id 
      ORDER BY count DESC
    `)
    .all();
  
  habitsByUser.forEach(row => {
    console.log(`  ${row.email}: ${row.count} hábitos`);
  });

  console.log("\n✅ Migración completada");
} catch (error) {
  console.error("❌ Error durante la migración:", error);
  process.exit(1);
} finally {
  db.close();
}
