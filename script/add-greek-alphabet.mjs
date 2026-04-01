import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

async function addGreekAlphabet() {
  try {
    // Obtener userId del usuario "cane"
    const users = await sql(
      `SELECT id FROM users WHERE username = $1 LIMIT 1`,
      ["cane"]
    );
    
    if (!users || users.length === 0) {
      console.error("❌ Usuario 'cane' no encontrado");
      process.exit(1);
    }

    const userId = users[0].id;
    console.log(`✅ Usuario encontrado: cane (ID: ${userId})`);
    
    // Ayer
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const startDate = yesterday.toISOString().split("T")[0];

    const result = await sql(
      `
      INSERT INTO space_repetition_practices (
        id,
        user_id,
        name,
        emoji,
        start_date,
        completed_intervals,
        archived,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW(), NOW()
      )
      RETURNING *;
      `,
      [userId, "El alfabeto griego", "🇬🇷", startDate, "[0]", 0]
    );

    console.log("✅ Práctica agregada correctamente:");
    console.log(`   Nombre: ${result[0].name}`);
    console.log(`   Emoji: ${result[0].emoji}`);
    console.log(`   Start Date: ${result[0].startDate}`);
    console.log(`   Usuario: cane (${result[0].userId})`);
    console.log(`\n✨ La práctica está lista en el modal de Space-Repetition!`);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

addGreekAlphabet();
