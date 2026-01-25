import { db } from "./server/db";
import { profileValues } from "@shared/schema";
import { eq } from "drizzle-orm";

const id = "a750c0f2-4671-4e93-b075-2f2618f468fb";

async function deleteValue() {
  try {
    const result = await db.delete(profileValues).where(eq(profileValues.id, id));
    console.log("Item eliminado correctamente:", result);
    process.exit(0);
  } catch (error) {
    console.error("Error al eliminar:", error);
    process.exit(1);
  }
}

deleteValue();
