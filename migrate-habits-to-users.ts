import { Client } from "pg";
import "dotenv/config";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ DATABASE_URL no está configurada");
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function migrate() {
  try {
    await client.connect();
    console.log("✅ Conectado a la base de datos...\n");

    // Find the "cane" user
    console.log("🔍 Buscando usuario 'cane'...");
    const caneUserResult = await client.query(
      "SELECT id, username FROM users WHERE username = $1 OR username LIKE $2 LIMIT 1",
      ["cane", "%cane%"]
    );

    if (caneUserResult.rows.length === 0) {
      console.error("❌ No se encontró usuario 'cane'. Usuarios existentes:");
      const allUsersResult = await client.query("SELECT id, username FROM users");
      console.log(allUsersResult.rows);
      process.exit(1);
    }

    const caneUser = caneUserResult.rows[0];
    console.log(`✅ Usuario encontrado: ${caneUser.username} (ID: ${caneUser.id})\n`);

    // Get all habits and check their userId
    console.log("📊 Verificando hábitos...");
    const allHabitsResult = await client.query("SELECT id, name, user_id FROM habits");
    console.log(`Total de hábitos: ${allHabitsResult.rows.length}`);

    // Check habits with null or wrong userId
    const orphanedHabitsResult = await client.query(
      "SELECT id, name, user_id FROM habits WHERE user_id IS NULL OR user_id = ''"
    );
    console.log(`Hábitos sin usuario: ${orphanedHabitsResult.rows.length}`);

    if (orphanedHabitsResult.rows.length > 0) {
      console.log("Hábitos sin usuario:", orphanedHabitsResult.rows);
    }

    // List all unique userIds in habits table
    const habitUserIdsResult = await client.query(
      "SELECT DISTINCT user_id FROM habits WHERE user_id IS NOT NULL AND user_id != ''"
    );
    console.log("UserIds únicos en tabla de hábitos:", habitUserIdsResult.rows);

    // List all users
    const allUsersInDb = await client.query("SELECT id, username FROM users");
    console.log("\nTodos los usuarios en BD:");
    allUsersInDb.rows.forEach((u: any) => console.log(`  - ${u.username} (${u.id}`));

    // Assign orphaned habits to cane user
    if (orphanedHabitsResult.rows.length > 0) {
      console.log(`\n⚙️ Asignando ${orphanedHabitsResult.rows.length} hábitos al usuario cane...`);

      const updateResult = await client.query(
        "UPDATE habits SET user_id = $1 WHERE user_id IS NULL OR user_id = ''",
        [caneUser.id]
      );

      console.log(`✅ Actualizados ${updateResult.rowCount} hábitos`);
    }

    // Check habitRecords without user_id
    console.log("\n📋 Verificando registros de hábitos...");
    const orphanedRecordsResult = await client.query(
      "SELECT COUNT(*) as count FROM habit_records WHERE user_id IS NULL OR user_id = ''"
    );
    const orphanedCount = parseInt(orphanedRecordsResult.rows[0].count, 10);
    console.log(`Registros sin usuario: ${orphanedCount}`);

    if (orphanedCount > 0) {
      console.log(`⚙️ Asignando ${orphanedCount} registros de hábitos...`);

      const updateRecordsResult = await client.query(
        "UPDATE habit_records SET user_id = $1 WHERE user_id IS NULL OR user_id = ''",
        [caneUser.id]
      );

      console.log(`✅ Actualizados ${updateRecordsResult.rowCount} registros`);
    }

    // Verify all habits now have a user_id
    console.log("\n✔️ Verificación final...");
    const habitsWithoutUserResult = await client.query(
      "SELECT COUNT(*) as count FROM habits WHERE user_id IS NULL OR user_id = ''"
    );
    const habitWithoutUserCount = parseInt(habitsWithoutUserResult.rows[0].count, 10);

    if (habitWithoutUserCount === 0) {
      console.log("✅ Todos los hábitos tienen un usuario asignado");
    } else {
      console.error(
        `❌ Aún hay ${habitWithoutUserCount} hábitos sin usuario`
      );
    }

    // Show final habits summary
    console.log("\n📊 Resumen final de hábitos por usuario:");
    const habitsByUserResult = await client.query(`
      SELECT u.username, COUNT(h.id) as count 
      FROM users u 
      LEFT JOIN habits h ON u.id = h.user_id 
      GROUP BY u.id, u.username
      ORDER BY count DESC
    `);

    habitsByUserResult.rows.forEach((row: any) => {
      console.log(`  ${row.username}: ${row.count} hábitos`);
    });

    console.log("\n✅ Migración completada");
  } catch (error) {
    console.error("❌ Error durante la migración:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
