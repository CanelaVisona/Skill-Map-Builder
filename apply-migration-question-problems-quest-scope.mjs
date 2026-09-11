import { config } from "dotenv";
import pkg from "pg";
import { readFileSync } from "fs";

config();

const { Client } = pkg;
const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function applyMigration() {
  try {
    await client.connect();
    console.log("Applying migration: question_problems quest (project) scope...");

    const sql = readFileSync("./migrations/0054_question_problems_quest_scope.sql", "utf-8");
    const statements = sql.split("--> statement-breakpoint");

    for (const statement of statements) {
      const trimmed = statement.trim();
      if (!trimmed) continue;
      await client.query(trimmed);
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
