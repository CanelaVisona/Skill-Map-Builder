import "dotenv/config";
import pg from "pg";

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
});

async function testConnection() {
  try {
    await client.connect();
    console.log("✅ Conexión a la base de datos exitosa");
    
    // Verificar si las tablas existen
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_name IN ('users', 'sessions', 'areas', 'skills')
      ORDER BY table_name;
    `);
    
    console.log("📊 Tablas encontradas:", result.rows.map(r => r.table_name));
    
    if (result.rows.length === 0) {
      console.log("❌ No se encontraron tablas. ¿Ejecutaste 'npx drizzle-kit push'?");
    }
    
  } catch (error) {
    console.error("❌ Error de conexión:", error.message);
  } finally {
    await client.end();
  }
}

testConnection();