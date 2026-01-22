import "dotenv/config";
import pg from "pg";

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function checkUserData() {
  try {
    await client.connect();
    console.log('🔍 Verificando datos del usuario "cane"...\n');
    
    // Buscar usuario cane
    const user = await client.query('SELECT * FROM users WHERE username = $1', ['cane']);
    if (user.rows.length === 0) {
      console.log('❌ Usuario "cane" no encontrado');
      return;
    }
    
    console.log('👤 Usuario encontrado:');
    console.log(`ID: ${user.rows[0].id}`);
    console.log(`Username: ${user.rows[0].username}`);
    console.log(`Email: ${user.rows[0].email}`);
    
    const userId = user.rows[0].id;
    
    // Verificar areas
    const areas = await client.query('SELECT * FROM areas WHERE user_id = $1', [userId]);
    console.log('\n📍 Áreas del usuario cane:');
    if (areas.rows.length === 0) {
      console.log('   No tiene áreas asignadas');
    } else {
      areas.rows.forEach(area => {
        console.log(`   - ${area.name} (ID: ${area.id})`);
      });
    }
    
    // Verificar skills
    const skills = await client.query('SELECT * FROM skills WHERE user_id = $1', [userId]);
    console.log('\n🎯 Skills del usuario cane:');
    if (skills.rows.length === 0) {
      console.log('   No tiene skills asignados');
    } else {
      skills.rows.forEach(skill => {
        console.log(`   - ${skill.name} (Level: ${skill.level}, Area: ${skill.area_id})`);
      });
    }
    
    // Verificar todas las areas para comparar
    console.log('\n📊 Todas las áreas en la base de datos:');
    const allAreas = await client.query('SELECT a.*, u.username FROM areas a LEFT JOIN users u ON a.user_id = u.id ORDER BY u.username');
    allAreas.rows.forEach(area => {
      console.log(`   - ${area.name} (Usuario: ${area.username || 'sin usuario'})`);
    });
    
    // Verificar todos los skills para comparar
    console.log('\n📊 Todos los skills en la base de datos:');
    const allSkills = await client.query('SELECT s.*, u.username FROM skills s LEFT JOIN users u ON s.user_id = u.id ORDER BY u.username LIMIT 20');
    allSkills.rows.forEach(skill => {
      console.log(`   - ${skill.name} (Usuario: ${skill.username || 'sin usuario'})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkUserData();