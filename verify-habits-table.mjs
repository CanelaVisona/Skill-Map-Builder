import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config();

const sql = neon(process.env.DATABASE_URL);

async function checkAndCreateHabits() {
  try {
    console.log("Checking habits table...");
    
    // Check if table exists
    const tableCheck = await sql(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'habits'
      )`
    );
    
    if (!tableCheck[0].exists) {
      console.log("❌ Habits table does not exist. Creating...");
      
      // Create habits table
      await sql(`
        CREATE TABLE IF NOT EXISTS "habits" (
          "id" varchar PRIMARY KEY NOT NULL,
          "user_id" varchar NOT NULL,
          "emoji" text NOT NULL,
          "name" text NOT NULL,
          "description" text DEFAULT '',
          "best_streak" integer DEFAULT 0 NOT NULL,
          "created_at" timestamp DEFAULT NOW() NOT NULL,
          "updated_at" timestamp DEFAULT NOW() NOT NULL,
          FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
        )
      `);
      
      // Create habit_records table
      await sql(`
        CREATE TABLE IF NOT EXISTS "habit_records" (
          "id" varchar PRIMARY KEY NOT NULL,
          "habit_id" varchar NOT NULL,
          "user_id" varchar NOT NULL,
          "date" varchar NOT NULL,
          "completed" integer NOT NULL DEFAULT 0,
          "created_at" timestamp DEFAULT NOW() NOT NULL,
          FOREIGN KEY ("habit_id") REFERENCES "habits" ("id") ON DELETE CASCADE,
          FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
        )
      `);
      
      // Create indexes
      await sql(`CREATE INDEX IF NOT EXISTS "habits_user_id_idx" ON "habits"("user_id")`);
      await sql(`CREATE INDEX IF NOT EXISTS "habit_records_habit_id_idx" ON "habit_records"("habit_id")`);
      await sql(`CREATE INDEX IF NOT EXISTS "habit_records_user_id_idx" ON "habit_records"("user_id")`);
      await sql(`CREATE INDEX IF NOT EXISTS "habit_records_habit_date_idx" ON "habit_records"("habit_id", "date")`);
      
      console.log("✅ Habits tables created successfully!");
    } else {
      console.log("✅ Habits table already exists");
      
      // Check if habit_records exists
      const recordsCheck = await sql(
        `SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_name = 'habit_records'
        )`
      );
      
      if (!recordsCheck[0].exists) {
        console.log("❌ habit_records table does not exist. Creating...");
        
        await sql(`
          CREATE TABLE IF NOT EXISTS "habit_records" (
            "id" varchar PRIMARY KEY NOT NULL,
            "habit_id" varchar NOT NULL,
            "user_id" varchar NOT NULL,
            "date" varchar NOT NULL,
            "completed" integer NOT NULL DEFAULT 0,
            "created_at" timestamp DEFAULT NOW() NOT NULL,
            FOREIGN KEY ("habit_id") REFERENCES "habits" ("id") ON DELETE CASCADE,
            FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
          )
        `);
        console.log("✅ habit_records table created!");
      } else {
        console.log("✅ habit_records table already exists");
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

checkAndCreateHabits();
