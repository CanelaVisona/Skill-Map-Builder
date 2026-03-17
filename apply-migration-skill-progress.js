require("dotenv").config();
const { Client } = require("pg");

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function applyMigration() {
  try {
    await client.connect();

    console.log("Applying migration: Adding skill_progress_id column to habits table...");

    // Add new column for skill_progress_id
    await client.query(`
      ALTER TABLE habits ADD COLUMN IF NOT EXISTS skill_progress_id varchar;
    `);
    console.log("✓ Added skill_progress_id column");

    // Add new foreign key constraint
    try {
      await client.query(`
        ALTER TABLE habits ADD CONSTRAINT habits_skill_progress_id_user_skills_progress_id_fk
          FOREIGN KEY (skill_progress_id) REFERENCES user_skills_progress(id) ON DELETE SET NULL;
      `);
      console.log("✓ Added foreign key constraint");
    } catch (err) {
      if (err.message.includes("already exists")) {
        console.log("✓ Constraint already exists, skipping");
      } else {
        throw err;
      }
    }

    console.log("✓ Migration completed successfully");
  } catch (error) {
    console.error("Error during migration:", error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
