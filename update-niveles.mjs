import pg from 'pg';

const { Client } = pg;
const connectionString = 'postgresql://neondb_owner:npg_QOqBSy0zVt5R@ep-rapid-band-ahn7lyss-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function updateLevels() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('✓ Conectado a la base de datos\n');
    
    await client.query('BEGIN');
    console.log('[TX] Iniciando transacción...\n');
    
    const areaUpdates = [
      ['Viajar', 2],
      ['Relaciones', 2],
      ['Escribir y leer', 2],
      ['Intelectual', 2],
      ['Programación', 2],
      ['Life', 2],
      ['Casa', 4],
      ['Finanzas', 3],
      ['Laburo', 2],
      ['Meditación', 5],
      ['Música', 3],
      ['Fútbol', 3],
      ['Mindset y carácter', 2],
      ['Surf', 4],
      ['Facultad', 2]
    ];

    console.log('[ÁREAS] Actualizando...');
    for (const [name, level] of areaUpdates) {
      await client.query(
        'UPDATE areas SET unlocked_level = $1 WHERE name = $2',
        [level, name]
      );
      console.log(`  ✓ ${name}: unlocked_level = ${level}`);
    }

    console.log('\n[PROYECTOS] Actualizando...');
    const projectUpdates = [
      ['Proyecto de alfabetización', 1],
      ['El proyecto de IA en educación', 1],
      ['Lavadero', 1],
      ['La humedad en la habitación', 1]
    ];
    
    for (const [name, level] of projectUpdates) {
      await client.query(
        'UPDATE projects SET unlocked_level = $1 WHERE name = $2',
        [level, name]
      );
      console.log(`  ✓ ${name}: unlocked_level = ${level}`);
    }
    
    await client.query('COMMIT');
    console.log('\n✓ COMMIT completado exitosamente\n');
    
    // Verify
    console.log('[VERIFICACIÓN] Estado final:');
    const verify = await client.query(`
      SELECT 'AREA' as tipo, name, unlocked_level FROM areas WHERE archived = 0
      UNION ALL
      SELECT 'PROJECT', name, unlocked_level FROM projects WHERE archived = 0
      ORDER BY tipo DESC, name ASC
    `);
    
    verify.rows.forEach(row => {
      console.log(`  ${row.tipo.padEnd(8)} | ${row.name.padEnd(40)} | ${row.unlocked_level}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    try {
      await client.query('ROLLBACK');
      console.log('ROLLBACK completado');
    } catch (e) {}
    process.exit(1);
  } finally {
    await client.end();
  }
}

updateLevels();
