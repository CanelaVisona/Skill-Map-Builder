require("dotenv").config();
const { Client } = require("pg");

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function applyMigration() {
  try {
    await client.connect();
    console.log("Adding skill_tree_skill_id column to habits table...");

    await client.query(`
      ALTER TABLE habits ADD COLUMN IF NOT EXISTS skill_tree_skill_id varchar
        REFERENCES skills(id) ON DELETE SET NULL;
    `);
    console.log("✓ Migration completed");
  } catch (error) {
    if (!error.message.includes("already exists")) {
      console.error("Error:", error.message);
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

applyMigration();
