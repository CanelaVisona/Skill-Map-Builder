import { db } from "./db";
import { journalShadows } from "@shared/schema";
import { sql } from "drizzle-orm";

async function cleanup() {
  console.log("Cleaning up all shadows...");
  
  try {
    const result = await db.delete(journalShadows);
    console.log("All shadows deleted successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error cleaning up shadows:", error);
    process.exit(1);
  }
}

cleanup();
