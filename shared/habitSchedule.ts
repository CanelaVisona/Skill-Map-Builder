// Cuándo toca un hábito: días de la semana (por defecto), cada X días o una vez por mes.
export type HabitRepeatMode = "weekly" | "interval" | "monthly";

export interface HabitScheduleLike {
  scheduledDays?: number[] | null;
  repeatMode?: HabitRepeatMode | string | null;
  repeatInterval?: number | null;
  repeatMonthDay?: number | null;
  repeatStartDate?: string | null;
  createdAt?: Date | string | null;
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const DAY_LABELS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

function anchorDate(habit: HabitScheduleLike): Date {
  if (habit.repeatStartDate) return new Date(habit.repeatStartDate + "T00:00:00");
  if (habit.createdAt) {
    const c = new Date(habit.createdAt);
    if (!isNaN(c.getTime())) return new Date(c.getFullYear(), c.getMonth(), c.getDate());
  }
  return new Date(2000, 0, 1);
}

// Acepta un Date o un string YYYY-MM-DD.
export function isHabitScheduledOn(habit: HabitScheduleLike, date: Date | string): boolean {
  const d = typeof date === "string" ? new Date(date + "T00:00:00") : new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const mode = habit.repeatMode || "weekly";

  if (mode === "interval") {
    const interval = Math.max(1, habit.repeatInterval || 1);
    const anchor = anchorDate(habit);
    // Diferencia en días calendario (Date.UTC evita saltos por horario de verano).
    const diff = Math.round(
      (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())) / 86400000,
    );
    return diff >= 0 && diff % interval === 0;
  }

  if (mode === "monthly") {
    const wanted = habit.repeatMonthDay || anchorDate(habit).getDate();
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    // Si el mes no tiene ese día (ej. 31 en febrero), toca el último día del mes.
    return d.getDate() === Math.min(wanted, lastDay);
  }

  const days = Array.isArray(habit.scheduledDays) && habit.scheduledDays.length > 0 ? habit.scheduledDays : ALL_DAYS;
  const dow = d.getDay() === 0 ? 6 : d.getDay() - 1;
  return days.includes(dow);
}

// Texto corto para mostrar la frecuencia; null si es todos los días.
export function describeHabitSchedule(habit: HabitScheduleLike): string | null {
  const mode = habit.repeatMode || "weekly";
  if (mode === "interval") {
    const n = Math.max(1, habit.repeatInterval || 1);
    return n === 1 ? null : `Cada ${n} días`;
  }
  if (mode === "monthly") {
    return `Cada mes, día ${habit.repeatMonthDay || anchorDate(habit).getDate()}`;
  }
  const days = Array.isArray(habit.scheduledDays) ? habit.scheduledDays : [];
  if (days.length === 0 || days.length >= 7) return null;
  return [...days].sort((a, b) => a - b).map((d) => DAY_LABELS[d]).join(", ");
}
