// Cómo se reflejan los rewirings en las "tareas del día" de un día puntual.
//
// - Rewiring clásico (sin "veces por día"): una única fila el día en que se registró
//   cualquier acción.
// - Rewiring "veces por día" (timesPerDay = N): UNA fila por cada repetición registrada ese
//   día, todas con el mismo nombre y un contador "índice/N" (1/N, 2/N, …). Cada fila cae en la
//   franja horaria del momento en que se registró esa repetición.
// - Rewiring "veces por día" linkeado a un hábito: se muestran las filas de las primeras N-1
//   repeticiones (1/N … (N-1)/N). La última (la que cierra la cuota) NO se muestra como
//   rewiring: en su lugar el propio hábito —que ya cae en las tareas del día por sí mismo—
//   lleva el contador N/N.

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

export interface RewiringDayRow {
  // Nº de repetición (1-based) que representa esta fila.
  repIndex: number;
  timesPerDay: number;
  // Timestamp de esa repetición (para derivar la franja horaria de la fila).
  at: string;
}

export interface RewiringDayResult {
  // Filas de rewiring a mostrar (una por repetición visible).
  rows: RewiringDayRow[];
  // Si está seteado, la fila del hábito indicado debe llevar el contador done/total.
  habitBadge: { habitId: string; done: number; total: number } | null;
}

export function rewiringDayRows(tracker: RewiringTaskTracker, dateStr: string): RewiringDayResult {
  const timesPerDay = tracker.timesPerDay && tracker.timesPerDay >= 1 ? tracker.timesPerDay : 1;
  const habitId = tracker.habitId ?? null;
  const empty: RewiringDayResult = { rows: [], habitBadge: null };

  if (tracker.archivedAt) return empty;

  const repsOnDay = (tracker.history || [])
    .filter((h) => entryDayStr(h) === dateStr)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const reps = repsOnDay.length;
  if (reps === 0) return empty;

  // Cuántas repeticiones se muestran como fila de rewiring: todas (hasta la cuota), salvo que
  // haya un hábito linkeado, en cuyo caso la última queda para el hábito.
  const maxRows = habitId ? timesPerDay - 1 : timesPerDay;
  const visibleReps = Math.min(reps, Math.max(0, maxRows));

  const rows: RewiringDayRow[] = [];
  for (let i = 1; i <= visibleReps; i++) {
    rows.push({ repIndex: i, timesPerDay, at: repsOnDay[i - 1].timestamp });
  }

  const habitBadge =
    habitId && reps >= timesPerDay
      ? { habitId, done: timesPerDay, total: timesPerDay }
      : null;

  return { rows, habitBadge };
}
