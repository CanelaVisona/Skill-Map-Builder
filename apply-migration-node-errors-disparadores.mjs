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
    console.log("Applying migration: node_errors.disparadores + node_error_records.disparador...");

    const sql = readFileSync("./migrations/0045_node_errors_disparadores.sql", "utf-8");
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
