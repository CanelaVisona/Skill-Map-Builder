import "dotenv/config";
import pg from "pg";
import fs from "fs";
import path from "path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigration() {
  const client = await pool.connect();
  try {
    // Read the migration SQL file
    const migrationPath = path.join(process.cwd(), "migrations", "0003_user_skills_progress.sql");
    const sql = fs.readFileSync(migrationPath, "utf-8");
    
    console.log("Running migration: 0003_user_skills_progress.sql");
    console.log("SQL:", sql);
    
    await client.query(sql);
    console.log("✓ Migration completed successfully");
  } catch (error) {
    console.error("✗ Migration failed:", error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
