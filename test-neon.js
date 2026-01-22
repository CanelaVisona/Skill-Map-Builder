import "dotenv/config";
import pg from "pg";

async function testNeon() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log("🔄 Conectando a Neon...");
    await client.connect();
    console.log("✅ Conexión exitosa a Neon!");
    
    // Verificar que las tablas existan
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    console.log("📊 Tablas encontradas:", result.rows.map(r => r.table_name));
    
    if (result.rows.length === 0) {
      console.log("🔧 No hay tablas. Necesitas ejecutar: npx drizzle-kit push");
    } else {
      // Verificar si hay usuarios
      try {
        const users = await client.query('SELECT COUNT(*) as count FROM users');
        console.log("👥 Usuarios en la base de datos:", users.rows[0].count);
      } catch (e) {
        console.log("🔧 Tablas existen pero pueden necesitar datos del backup");
      }
    }
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await client.end();
  }
}

testNeon();