import pg from 'pg';

const { Client } = pg;

const connectionString = 'postgresql://neondb_owner:npg_QOqBSy0zVt5R@ep-rapid-band-ahn7lyss-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function verifyMigration() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('✓ Connected');
    
    // Check all three tables for skill_id column
    const checkLearnings = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns 
      WHERE table_name = 'journal_learnings' AND column_name = 'skill_id'
    `);
    
    const checkThoughts = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns 
      WHERE table_name = 'journal_thoughts' AND column_name = 'skill_id'
    `);
    
    const checkTools = await client.query(`
      SELECT column_name, data_type FROM information_schema.columns 
      WHERE table_name = 'journal_tools' AND column_name = 'skill_id'
    `);
    
    console.log('\nColumn Status:');
    console.log(`  - journal_learnings.skill_id: ${checkLearnings.rows.length > 0 ? '✓' : '✗'} ${checkLearnings.rows[0] ? `(${checkLearnings.rows[0].data_type})` : ''}`);
    console.log(`  - journal_thoughts.skill_id: ${checkThoughts.rows.length > 0 ? '✓' : '✗'} ${checkThoughts.rows[0] ? `(${checkThoughts.rows[0].data_type})` : ''}`);
    console.log(`  - journal_tools.skill_id: ${checkTools.rows.length > 0 ? '✓' : '✗'} ${checkTools.rows[0] ? `(${checkTools.rows[0].data_type})` : ''}`);
    
    if (checkLearnings.rows.length > 0 && checkThoughts.rows.length > 0 && checkTools.rows.length > 0) {
      console.log('\n✅ Migration is complete! All columns added successfully.');
    } else {
      console.log('\n⚠ Some columns are still missing');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await client.end();
  }
}

verifyMigration();
