import pkg from 'pg';
const { Client } = pkg;

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  try {
    await client.connect();
    console.log('✓ Connected to database');

    // Check current schema
    console.log('\n📋 Current schema for journal_thoughts:');
    const thoughtsInfo = await client.query(`
      SELECT column_name, is_nullable, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'journal_thoughts'
    `);
    console.log(thoughtsInfo.rows);

    // Delete entries without skillId
    console.log('\n🗑️  Deleting entries without skillId...');
    
    const thoughtsDeleted = await client.query('DELETE FROM journal_thoughts WHERE skill_id IS NULL;');
    console.log(`Deleted ${thoughtsDeleted.rowCount} thoughts without skillId`);
    
    const learningsDeleted = await client.query('DELETE FROM journal_learnings WHERE skill_id IS NULL;');
    console.log(`Deleted ${learningsDeleted.rowCount} learnings without skillId`);
    
    const toolsDeleted = await client.query('DELETE FROM journal_tools WHERE skill_id IS NULL;');
    console.log(`Deleted ${toolsDeleted.rowCount} tools without skillId`);

    // Add NOT NULL constraint
    console.log('\n🔧 Adding NOT NULL constraint to skill_id...');
    
    await client.query('ALTER TABLE journal_thoughts ALTER COLUMN skill_id SET NOT NULL;');
    console.log('✓ Updated journal_thoughts');
    
    await client.query('ALTER TABLE journal_learnings ALTER COLUMN skill_id SET NOT NULL;');
    console.log('✓ Updated journal_learnings');
    
    await client.query('ALTER TABLE journal_tools ALTER COLUMN skill_id SET NOT NULL;');
    console.log('✓ Updated journal_tools');

    console.log('\n✅ Migration complete!');
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
