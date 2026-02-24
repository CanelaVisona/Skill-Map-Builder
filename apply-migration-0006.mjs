import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const connectionString = 'postgresql://neondb_owner:npg_QOqBSy0zVt5R@ep-rapid-band-ahn7lyss-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function applyMigration() {
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('✓ Connected to database');
    
    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', '0006_source_area_project_fields.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('\n[1] Applying migration...');
    console.log(migrationSQL);
    
    // Split into statements and execute each
    const statements = migrationSQL.split(';').filter(s => s.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await client.query(statement);
          console.log('✓ Executed:', statement.substring(0, 60) + '...');
        } catch (error) {
          if (error.message.includes('already exists') || error.message.includes('duplicate column')) {
            console.log('⚠ Already exists, skipping:', statement.substring(0, 60) + '...');
          } else {
            throw error;
          }
        }
      }
    }
    
    console.log('\n✓ Migration 0006 applied successfully!');
    
  } catch (error) {
    console.error('Error applying migration:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
