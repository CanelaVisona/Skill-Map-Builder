// Cómo se refleja un rewiring en las "tareas del día" de un día puntual.
//
// - Rewiring clásico (sin "veces por día"): cuenta como una única tarea el día en que se
//   registró cualquier acción.
// - Rewiring "veces por día" (timesPerDay = N): aparece una fila con un contador
//   "repeticiones hechas / N". La fila se muestra en la franja horaria del momento en que se
//   registró la última repetición del día.
// - Rewiring "veces por día" linkeado a un hábito: las primeras N-1 repeticiones se muestran
//   como fila de rewiring (1/N, 2/N, ...). La última (la que completa la cuota) NO se muestra
//   como rewiring: en su lugar aparece el propio hábito, que ya cae en las tareas del día por
//   sí mismo, con el contador N/N encima.

export interface RewiringTaskTracker {
  id?: string;
  name?: string;
  archivedAt?: string | null;
  timesPerDay?: number | null;
  habitId?: string | null;
  history?: { timestamp: string; date?: string }[];
}

function entryDayStr(entry: { timestamp: string; date?: string }): string {
  if (entry.date) return entry.date;
  const d = new Date(entry.timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface RewiringDayTask {
  // "none":     ese día no hay ninguna repetición registrada — no aparece nada.
  // "rewiring": se muestra una fila de rewiring con el contador `reps`/`timesPerDay`.
  // "habit":    la cuota del día está completa y el rewiring está linkeado a un hábito — no va
  //             fila de rewiring; el hábito aparece por sí mismo con el contador N/N.
  kind: "none" | "rewiring" | "habit";
  reps: number;
  timesPerDay: number;
  habitId: string | null;
  // Momento de la última repetición del día (para derivar la franja horaria de la fila).
  lastRepAt?: string;
}

export function rewiringDayTask(tracker: RewiringTaskTracker, dateStr: string): RewiringDayTask {
  const timesPerDay = tracker.timesPerDay && tracker.timesPerDay >= 1 ? tracker.timesPerDay : 1;
  const habitId = tracker.habitId ?? null;

  if (tracker.archivedAt) return { kind: "none", reps: 0, timesPerDay, habitId };

  const repsOnDay = (tracker.history || []).filter((h) => entryDayStr(h) === dateStr);
  const reps = repsOnDay.length;
  if (reps === 0) return { kind: "none", reps: 0, timesPerDay, habitId };

  const lastRepAt = repsOnDay.reduce(
    (latest, h) => (new Date(h.timestamp) > new Date(latest) ? h.timestamp : latest),
    repsOnDay[0].timestamp
  );

  // Linkeado a un hábito y con la cuota del día ya cerrada: el hábito ocupa el lugar de la
  // última repetición, así que acá no va ninguna fila de rewiring.
  if (habitId && reps >= timesPerDay) {
    return { kind: "habit", reps: timesPerDay, timesPerDay, habitId, lastRepAt };
  }

  // El contador de la fila nunca pasa de timesPerDay (repeticiones de más no lo suben).
  return { kind: "rewiring", reps: Math.min(reps, timesPerDay), timesPerDay, habitId, lastRepAt };
}
