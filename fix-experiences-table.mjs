import pg from 'pg';

const { Client } = pg;

const connectionString = 'postgresql://neondb_owner:npg_QOqBSy0zVt5R@ep-rapid-band-ahn7lyss-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function createTables() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('✓ Connected to database');
    
    // Create profile_experiences table
    console.log('\n[1] Creating profile_experiences table...');
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS "profile_experiences" (
          "id" varchar PRIMARY KEY NOT NULL,
          "user_id" varchar,
          "name" text NOT NULL,
          "description" text DEFAULT '' NOT NULL,
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade
        );
      `);
      console.log('✓ profile_experiences table created/verified');
    } catch (e) {
      console.log('Error:', e.message);
    }
    
    // Create profile_contributions table
    console.log('\n[2] Creating profile_contributions table...');
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS "profile_contributions" (
          "id" varchar PRIMARY KEY NOT NULL,
          "user_id" varchar,
          "name" text NOT NULL,
          "description" text DEFAULT '' NOT NULL,
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade
        );
      `);
      console.log('✓ profile_contributions table created/verified');
    } catch (e) {
      console.log('Error:', e.message);
    }
    
    // Verify tables
    console.log('\n[3] Verifying tables...');
    const result = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_name IN ('profile_experiences', 'profile_contributions')
    `);
    console.log('Tables found:', result.rows.map(r => r.table_name).join(', ') || 'none');
    
    console.log('\n✓ Done!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.detail) console.error('Detail:', error.detail);
  } finally {
    await client.end();
  }
}

createTables();
