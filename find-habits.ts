import { db } from "./server/db.js";
import { habits, users } from "./shared/schema.js";
import { eq } from "drizzle-orm";

async function findHabits() {
  try {
    console.log("Buscando hábitos con esos nombres...\n");
    
    // Buscar los hábitos por nombre
    const allHabits = await db.select({
      id: habits.id,
      name: habits.name,
      emoji: habits.emoji,
      userId: habits.userId,
    }).from(habits);
    
    console.log("=== TODOS LOS HÁBITOS EN LA BASE DE DATOS ===\n");
    allHabits.forEach(habit => {
      console.log(`ID: ${habit.id}`);
      console.log(`Nombre: ${habit.name}`);
      console.log(`Emoji: ${habit.emoji}`);
      console.log(`UserId: ${habit.userId}`);
      console.log("---");
    });
    
    // Traer información del usuario
    console.log("\n=== USUARIOS EN LA BASE DE DATOS ===\n");
    const allUsers = await db.select({
      id: users.id,
      username: users.username,
    }).from(users);
    
    allUsers.forEach(user => {
      console.log(`ID: ${user.id}`);
      console.log(`Username: ${user.username}`);
      console.log("---");
    });
    
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

findHabits();
