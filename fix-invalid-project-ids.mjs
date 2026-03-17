import { config } from "dotenv";
import pkg from "pg";

config();

const { Client } = pkg;
const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function fixInvalidProjectIds() {
  try {
    await client.connect();

    // Find skills with invalid project_ids
    const result = await client.query(`
      SELECT s.id, s.project_id 
      FROM skills s
      LEFT JOIN projects p ON s.project_id = p.id
      WHERE s.project_id IS NOT NULL AND p.id IS NULL
    `);

    console.log(`Found ${result.rows.length} skills with invalid project_ids:`, result.rows);

    if (result.rows.length > 0) {
      // Delete invalid skills
      await client.query(`
        DELETE FROM skills 
        WHERE project_id IS NOT NULL 
        AND project_id NOT IN (SELECT id FROM projects)
      `);
      console.log("Deleted skills with invalid project_ids");
    }

    console.log("✓ Cleanup complete");
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

fixInvalidProjectIds();
