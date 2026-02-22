import pg from 'pg';

const { Client } = pg;

const connectionString = 'postgresql://neondb_owner:npg_QOqBSy0zVt5R@ep-rapid-band-ahn7lyss-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function checkDatabase() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('✓ Connected');
    
    // Get all areas with their IDs
    const areasResult = await client.query('SELECT id, name FROM areas');
    console.log('\nAll areas:');
    areasResult.rows.forEach(row => console.log(`  - ${row.id}: ${row.name}`));
    
    // Get skills that might be orphaned
    const orphanResult = await client.query(`
      SELECT DISTINCT s.area_id FROM skills s 
      WHERE NOT EXISTS (SELECT 1 FROM areas a WHERE a.id = s.area_id)
    `);
    
    if (orphanResult.rows.length > 0) {
      console.log('\n⚠ Orphaned area_ids in skills table:');
      orphanResult.rows.forEach(row => console.log(`  - ${row.area_id}`));
    } else {
      console.log('\n✓ No orphaned references found');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

checkDatabase();
