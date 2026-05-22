import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./shared/schema";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool, { schema });

async function checkColors() {
  try {
    const result = await db.select().from(schema.areas).limit(5);
    console.log('Area colors:');
    result.forEach((area: any) => {
      console.log(`${area.name}: "${area.color}"`);
    });
  } catch (err: any) {
    console.error('Error:', err.message);
  }
  process.exit(0);
}

checkColors();
