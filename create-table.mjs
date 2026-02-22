#!/usr/bin/env node

// Simple script to create the user_skills_progress table

import pg from "pg";

const { Client } = pg;

const connectionString = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_QOqBSy0zVt5R@ep-rapid-band-ahn7lyss-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function createTable() {
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log("✓ Connected to PostgreSQL");

    // Check if table exists
    const checkTable = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'user_skills_progress'
      );
    `);

    if (checkTable.rows[0].exists) {
      console.log("✓ Table user_skills_progress already exists");
      return;
    }

    console.log("Creating user_skills_progress table...");
    
    const createSQL = `
      CREATE TABLE IF NOT EXISTS "user_skills_progress" (
        "id" varchar PRIMARY KEY NOT NULL,
        "user_id" varchar NOT NULL,
        "skill_name" text NOT NULL,
        "current_xp" integer DEFAULT 0 NOT NULL,
        "level" integer DEFAULT 1 NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade
      );
    `;

    await client.query(createSQL);
    console.log("✓ Table user_skills_progress created successfully");

    // Also create an index on (user_id, skill_name) for faster queries
    try {
      await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_user_skill_unique 
        ON "user_skills_progress"("user_id", "skill_name");
      `);
      console.log("✓ Index created on (user_id, skill_name)");
    } catch (e) {
      console.log("ℹ Index already exists or couldn't be created");
    }

  } catch (error: any) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

createTable();
