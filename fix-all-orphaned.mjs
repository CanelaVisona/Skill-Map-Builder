import pg from 'pg';

const { Client } = pg;

const connectionString = 'postgresql://neondb_owner:npg_QOqBSy0zVt5R@ep-rapid-band-ahn7lyss-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function fixAllOrphanedReferences() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('✓ Connected');
    
    // Find skills with orphaned project_id
    const orphanProjectResult = await client.query(`
      SELECT s.id, s.project_id FROM skills s 
      WHERE s.project_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = s.project_id)
    `);
    
    if (orphanProjectResult.rows.length > 0) {
      console.log(`\nFound ${orphanProjectResult.rows.length} skills with orphaned project_id:`);
      orphanProjectResult.rows.forEach(row => console.log(`  - Skill ${row.id} -> project ${row.project_id}`));
      
      // Set project_id to NULL for orphaned skills
      console.log('\nSetting project_id to NULL for orphaned skills...');
      await client.query(`
        UPDATE skills SET project_id = NULL 
        WHERE project_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM projects p WHERE p.id = skills.project_id)
      `);
      console.log(`  ✓ Updated ${orphanProjectResult.rows.length} skills`);
    } else {
      console.log('✓ No skills with orphaned project_id found');
    }
    
    // Find skills with orphaned area_id
    const orphanAreaResult = await client.query(`
      SELECT s.id, s.area_id FROM skills s 
      WHERE s.area_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM areas a WHERE a.id = s.area_id)
    `);
    
    if (orphanAreaResult.rows.length > 0) {
      console.log(`\nFound ${orphanAreaResult.rows.length} skills with orphaned area_id:`);
      orphanAreaResult.rows.forEach(row => console.log(`  - Skill ${row.id} -> area ${row.area_id}`));
      
      // Delete these skills
      console.log('\nDeleting skills with orphaned area_id...');
      for (const skill of orphanAreaResult.rows) {
        await client.query('DELETE FROM skills WHERE id = $1', [skill.id]);
        console.log(`  ✓ Deleted skill ${skill.id}`);
      }
    } else {
      console.log('✓ No skills with orphaned area_id found');
    }
    
    console.log('\n✓ Done!');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

fixAllOrphanedReferences();
