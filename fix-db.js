const { Client } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_QOqBSy0zVt5R@ep-rapid-band-ahn7lyss-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function fixDatabase() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('✓ Connected to database');
    
    console.log('\n[1] Checking for duplicate IDs in areas table...');
    const duplicatesResult = await client.query(`
      SELECT id, COUNT(*) as count 
      FROM areas 
      GROUP BY id 
      HAVING COUNT(*) > 1
    `);
    
    if (duplicatesResult.rows.length > 0) {
      console.log('Found duplicate IDs:', duplicatesResult.rows);
      
      for (const dup of duplicatesResult.rows) {
        console.log(`\nFixing duplicate ID: ${dup.id}`);
        
        const rowsResult = await client.query(
          'SELECT ctid, * FROM areas WHERE id = $1 ORDER BY created_at DESC',
          [dup.id]
        );
        
        console.log(`  Found ${rowsResult.rows.length} rows with ID ${dup.id}`);
        
        if (rowsResult.rows.length > 1) {
          const rowsToDelete = rowsResult.rows.slice(1);
          
          for (const row of rowsToDelete) {
            await client.query('DELETE FROM areas WHERE ctid = $1', [row.ctid]);
            console.log(`  Deleted duplicate row`);
          }
        }
      }
      
      console.log('\n[2] Verifying duplicates are fixed...');
      const verifyResult = await client.query(`
        SELECT id, COUNT(*) as count 
        FROM areas 
        GROUP BY id 
        HAVING COUNT(*) > 1
      `);
      
      if (verifyResult.rows.length === 0) {
        console.log('✓ All duplicates removed!');
      } else {
        console.log('⚠ Some duplicates still exist:', verifyResult.rows);
      }
    } else {
      console.log('✓ No duplicate IDs found');
    }
    
    console.log('\n✓ Database check complete!');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

fixDatabase();
