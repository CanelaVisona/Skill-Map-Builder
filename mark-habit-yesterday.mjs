import { db } from "./server/db";
import { habits, habitRecords, users } from "./shared/schema";
import { eq, and } from "drizzle-orm";

async function markHabitYesterday() {
  try {
    // Get the habit by name
    const userHabits = await db.query.habits.findMany({
      where: (h, { like }) => like(h.name, "%Meditar las sombras%"),
      limit: 1,
    });

    if (!userHabits || userHabits.length === 0) {
      console.log("❌ No se encontró el hábito 'Meditar las sombras'");
      return;
    }

    const habit = userHabits[0];
    console.log(`✅ Hábito encontrado: ${habit.name} (ID: ${habit.id})`);

    // Yesterday's date (March 19, 2026)
    const yesterday = "2026-03-19";

    // Check if record already exists
    const existingRecord = await db.query.habitRecords.findFirst({
      where: (hr) =>
        and(eq(hr.habitId, habit.id), eq(hr.date, yesterday)),
    });

    if (existingRecord) {
      // Update existing record
      await db
        .update(habitRecords)
        .set({ completed: 1 })
        .where(
          and(eq(habitRecords.habitId, habit.id), eq(habitRecords.date, yesterday))
        );
      console.log(`✅ Registro actualizado para ${yesterday}`);
    } else {
      // Create new record
      const newId = crypto.randomUUID();
      await db.insert(habitRecords).values({
        id: newId,
        habitId: habit.id,
        userId: habit.userId,
        date: yesterday,
        completed: 1,
      });
      console.log(`✅ Nuevo registro creado para ${yesterday}`);
    }

    console.log(`✅ Hábito 'Meditar las sombras' marcado como completado para jueves 19 de marzo`);
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

markHabitYesterday();
