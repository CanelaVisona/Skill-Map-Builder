import pg from 'pg';

const { Client } = pg;

const connectionString = 'postgresql://neondb_owner:npg_QOqBSy0zVt5R@ep-rapid-band-ahn7lyss-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function fixUnlockedLevels() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('✓ Connected to database\n');
    
    // Define the correct unlocked levels from the spreadsheet
    const areaUpdates = [
      { name: 'Viajar', level: 2 },
      { name: 'Relaciones', level: 2 },
      { name: 'Escribir y leer', level: 2 },
      { name: 'Intelectual', level: 2 },
      { name: 'Programación', level: 2 },
      { name: 'Life', level: 2 },
      { name: 'Casa', level: 4 },
      { name: 'Finanzas', level: 3 },
      { name: 'Laburo', level: 2 },
      { name: 'Meditación', level: 5 },
      { name: 'Música', level: 3 },
      { name: 'Fútbol', level: 3 },
      { name: 'Mindset y carácter', level: 2 },
      { name: 'Surf', level: 4 },
      { name: 'Facultad', level: 2 }
    ];

    const projectUpdates = [
      { name: 'Proyecto de alfabetización', level: 1 },
      { name: 'El proyecto de IA en educación', level: 1 },
      { name: 'Lavadero', level: 1 },
      { name: 'La humedad en la habitación', level: 1 }
    ];

    console.log('[AREAS] Actualizando niveles desbloqueados...');
    for (const update of areaUpdates) {
      const result = await client.query(
        'UPDATE areas SET unlocked_level = $1 WHERE name = $2 RETURNING name, unlocked_level',
        [update.level, update.name]
      );
      if (result.rows.length > 0) {
        console.log(`✓ ${update.name}: unlocked_level = ${update.level}`);
      }
    }

    console.log('\n[PROJECTS] Actualizando niveles desbloqueados...');
    for (const update of projectUpdates) {
      const result = await client.query(
        'UPDATE projects SET unlocked_level = $1 WHERE name = $2 RETURNING name, unlocked_level',
        [update.level, update.name]
      );
      if (result.rows.length > 0) {
        console.log(`✓ ${update.name}: unlocked_level = ${update.level}`);
      }
    }

    console.log('\n✓ Actualización completada!');
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

fixUnlockedLevels();
