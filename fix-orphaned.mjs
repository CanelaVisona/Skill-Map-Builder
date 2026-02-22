import pg from 'pg';

const { Client } = pg;

const connectionString = 'postgresql://neondb_owner:npg_QOqBSy0zVt5R@ep-rapid-band-ahn7lyss-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function fixOrphanedReferences() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('✓ Connected');
    
    // Find skills with orphaned area_id
    const orphanResult = await client.query(`
      SELECT s.id, s.area_id FROM skills s 
      WHERE s.area_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM areas a WHERE a.id = s.area_id)
    `);
    
    if (orphanResult.rows.length > 0) {
      console.log(`\nFound ${orphanResult.rows.length} orphaned skills:`);
      orphanResult.rows.forEach(row => console.log(`  - Skill ${row.id} -> area ${row.area_id}`));
      
      // Delete orphaned skills
      console.log('\nDeleting orphaned skills...');
      for (const skill of orphanResult.rows) {
        await client.query('DELETE FROM skills WHERE id = $1', [skill.id]);
        console.log(`  ✓ Deleted skill ${skill.id}`);
      }
    } else {
      console.log('✓ No orphaned skills found');
    }
    
    console.log('\n✓ Done!');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

fixOrphanedReferences();
