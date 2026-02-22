import pg from 'pg';

const { Client } = pg;

const connectionString = 'postgresql://neondb_owner:npg_QOqBSy0zVt5R@ep-rapid-band-ahn7lyss-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function applyMigration() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('✓ Connected to database');
    
    // Execute the migration SQL
    const migrationSQL = `
      ALTER TABLE "journal_learnings" ADD COLUMN "skill_id" varchar;
      ALTER TABLE "journal_thoughts" ADD COLUMN "skill_id" varchar;
      ALTER TABLE "journal_tools" ADD COLUMN "skill_id" varchar;
    `;
    
    console.log('\n[1] Applying migration SQL...');
    await client.query(migrationSQL);
    console.log('✓ Migration applied successfully!');
    
    // Create user_skills_progress table if not exists
    console.log('\n[1.5] Creating user_skills_progress table...');
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS "user_skills_progress" (
        "id" varchar PRIMARY KEY NOT NULL,
        "user_id" varchar NOT NULL,
        "skill_name" text NOT NULL,
        "current_xp" integer DEFAULT 0 NOT NULL,
        "level" integer DEFAULT 1 NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade
      );
    `;
    
    try {
      await client.query(createTableSQL);
      console.log('✓ user_skills_progress table created/verified!');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('✓ user_skills_progress table already exists');
      } else {
        throw error;
      }
    }
    
    // Verify the columns were added
    console.log('\n[2] Verifying columns...');
    
    const checkLearnings = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'journal_learnings' AND column_name = 'skill_id'
    `);
    console.log(`  - journal_learnings.skill_id: ${checkLearnings.rows.length > 0 ? '✓' : '✗'}`);
    
    const checkThoughts = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'journal_thoughts' AND column_name = 'skill_id'
    `);
    console.log(`  - journal_thoughts.skill_id: ${checkThoughts.rows.length > 0 ? '✓' : '✗'}`);
    
    const checkTools = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'journal_tools' AND column_name = 'skill_id'
    `);
    console.log(`  - journal_tools.skill_id: ${checkTools.rows.length > 0 ? '✓' : '✗'}`);
    
    // Check if user_skills_progress table exists
    console.log('\n[3] Verifying user_skills_progress table...');
    const checkTable = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'user_skills_progress'
      );
    `);
    console.log(`  - user_skills_progress table: ${checkTable.rows[0].exists ? '✓' : '✗'}`);
    
    console.log('\n✓ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.detail) console.error('Detail:', error.detail);
  } finally {
    await client.end();
  }
}

applyMigration();
