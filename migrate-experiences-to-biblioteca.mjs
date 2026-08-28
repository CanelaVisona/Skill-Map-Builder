import { config } from "dotenv";
import pkg from "pg";
import { randomUUID } from "crypto";

config();

const { Client } = pkg;
const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  try {
    await client.connect();
    console.log("Moving archived books (Experiencias) -> book_wishlist (Biblioteca)...");

    const { rows } = await client.query(
      `SELECT id, user_id, title, author FROM books_library WHERE archived_at IS NOT NULL`
    );
    console.log(`Found ${rows.length} archived book(s).`);

    for (const b of rows) {
      const id = randomUUID();
      await client.query(
        `INSERT INTO book_wishlist (id, user_id, title, author, status)
         VALUES ($1, $2, $3, $4, 'leido')`,
        [id, b.user_id, b.title, b.author || ""]
      );
      // Sesiones de lectura caen por ON DELETE cascade
      await client.query(`DELETE FROM books_library WHERE id = $1`, [b.id]);
      console.log(`  moved: "${b.title}"`);
    }

    console.log("✓ Done");
  } catch (error) {
    console.error("Error during migration:", error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
