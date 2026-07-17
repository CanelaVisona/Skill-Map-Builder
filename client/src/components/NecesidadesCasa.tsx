import { useState, useEffect, useCallback, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useTheme } from "next-themes";

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const HOME_TASKS_STORAGE_KEY = "skill-map-home-needs-tasks-v1";

function computeValue(lastDone: number, periodDays: number) {
  const daysSince = (Date.now() - lastDone) / MS_PER_DAY;
  const overdueDays = daysSince - periodDays;
  // Past the 2-day overdue mark the bar goes empty. During the 0-2 day overdue
  // window it keeps degrading (100 -> 0) instead of sitting full, so the red
  // bar visibly drains just like the on-time countdown does. Otherwise (still
  // on time) it follows the normal countdown fill.
  if (overdueDays > 2) return 0;
  if (overdueDays > 0) return Math.max(0, 100 * (1 - overdueDays / 2));
  return Math.max(0, (1 - daysSince / periodDays) * 100);
}

type TaskColor = "green" | "yellow" | "orange" | "red" | "empty";

function computeColor(value: number, overdueDays: number): TaskColor {
  // Explicit "empty" state (not just an unused color) so elements that render color
  // as a solid fill — not scaled by value, like the big status icon — also go neutral
  // more than 2 days after the due date, instead of showing a misleadingly solid color.
  if (overdueDays > 2) return "empty";
  if (overdueDays > 0) return "red";
  if (value >= 60) return "green";
  if (value >= 40) return "yellow";
  return "orange"; // never red while still on time — red is reserved for the overdue window
}

function computeOverdueDays(lastDone: number, periodDays: number) {
  const daysSince = (Date.now() - lastDone) / MS_PER_DAY;
  return daysSince - periodDays;
}

function getBarGradient(color: TaskColor) {
  return {
    green: "linear-gradient(90deg, #16a34a, #4ade80)",
    yellow: "linear-gradient(90deg, #ca8a04, #facc15)",
    orange: "linear-gradient(90deg, #c2410c, #fb923c)",
    red: "linear-gradient(90deg, #991b1b, #ef4444)",
    empty: "transparent",
  }[color];
}

function hexToRgb(hex: string) {
  const value = parseInt(hex.slice(1), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function mixHex(hexA: string, hexB: string, t: number) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const r = Math.round(a.r + (b.r - a.r) * t);
  const g = Math.round(a.g + (b.g - a.g) * t);
  const bl = Math.round(a.b + (b.b - a.b) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

// Blends the red gradient into the green gradient as `progress` goes 0 -> 1,
// used to animate the bar slowly filling from red to green on completion.
function getCompletionGradient(progress: number) {
  const start = mixHex("#991b1b", "#16a34a", progress);
  const end = mixHex("#ef4444", "#4ade80", progress);
  return `linear-gradient(90deg, ${start}, ${end})`;
}

function daysRemaining(lastDone: number, periodDays: number) {
  const daysSince = (Date.now() - lastDone) / MS_PER_DAY;
  return periodDays - daysSince;
}

function formatRemaining(days: number, color: TaskColor, overdueDays: number) {
  if (color === "red") {
    const overdueWhole = Math.min(2, Math.max(1, Math.ceil(overdueDays)));
    return `-${overdueWhole}d`;
  }
  if (days <= 0) return "Vencido";
  if (days < 1) return `${Math.round(days * 24)}h restantes`;
  return `${days.toFixed(1)}d restantes`;
}

function formatFrequency(periodDays: number) {
  if (periodDays === 1) return "Todos los dias";
  if (periodDays < 1) return `Cada ${(periodDays * 24).toFixed(0)}h`;
  return `Cada ${periodDays.toFixed(periodDays % 1 === 0 ? 0 : 1)} dias`;
}

type HomeTask = {
  id: number;
  icon: string;
  name: string;
  freq: string;
  periodDays: number;
  lastDone: number;
  btnText: string;
  illo: string;
};

const now = Date.now();

const INITIAL_TASKS: HomeTask[] = [
  {
    id: 0,
    icon: "🗑️",
    name: "Sacar la basura",
    freq: "1 vez por semana",
    periodDays: 7,
    lastDone: now - MS_PER_DAY * 1.5,
    btnText: "Ya saqué la basura",
    illo: "🗑️",
  },
  {
    id: 1,
    icon: "🍽️",
    name: "Lavar los platos",
    freq: "Todos los dias",
    periodDays: 1,
    lastDone: now - MS_PER_DAY * 0.38,
    btnText: "Platos lavados",
    illo: "🫧",
  },
  {
    id: 2,
    icon: "🛁",
    name: "Limpiar el baño",
    freq: "5 veces por semana",
    periodDays: 7 / 5,
    lastDone: now - MS_PER_DAY * 0.7,
    btnText: "Baño limpio",
    illo: "🧹",
  },
  {
    id: 3,
    icon: "🛏️",
    name: "Ordenar habitación",
    freq: "2 veces por semana",
    periodDays: 7 / 2,
    lastDone: now - MS_PER_DAY * 2.05,
    btnText: "Cuarto ordenado",
    illo: "🛏️",
  },
  {
    id: 4,
    icon: "🧺",
    name: "Lavar la ropa",
    freq: "Cada 2 semanas",
    periodDays: 14,
    lastDone: now - MS_PER_DAY * 10.9,
    btnText: "Ropa lavada",
    illo: "👕",
  },
  {
    id: 5,
    icon: "🌿",
    name: "Cuidado de plantas",
    freq: "Cada 10 dias",
    periodDays: 10,
    lastDone: now - MS_PER_DAY * 9,
    btnText: "Plantas regadas",
    illo: "🌱",
  },
  {
    id: 6,
    icon: "🛒",
    name: "Comprar la comida",
    freq: "1 vez por semana",
    periodDays: 7,
    lastDone: now - MS_PER_DAY * 3.5,
    btnText: "Compras hechas",
    illo: "🛍️",
  },
];

function loadStoredTasks(): HomeTask[] {
  if (typeof window === "undefined") return INITIAL_TASKS;

  try {
    const raw = window.localStorage.getItem(HOME_TASKS_STORAGE_KEY);
    if (!raw) return INITIAL_TASKS;

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return INITIAL_TASKS;

    const tasks = parsed
      .map((item) => {
        const task = item as Partial<HomeTask>;
        if (
          typeof task.id !== "number" ||
          typeof task.icon !== "string" ||
          typeof task.name !== "string" ||
          typeof task.freq !== "string" ||
          typeof task.periodDays !== "number" ||
          typeof task.lastDone !== "number" ||
          typeof task.btnText !== "string" ||
          typeof task.illo !== "string"
        ) {
          return null;
        }

        return {
          id: task.id,
          icon: task.icon,
          name: task.name,
          freq: task.freq,
          periodDays: task.periodDays,
          lastDone: task.lastDone,
          btnText: task.btnText,
          illo: task.illo,
        } satisfies HomeTask;
      })
      .filter((task): task is HomeTask => task !== null);

    return tasks.length > 0 ? tasks : INITIAL_TASKS;
  } catch {
    return INITIAL_TASKS;
  }
}

function MiniBar({ value, gradient, instant }: { value: number; gradient: string; instant?: boolean }) {
  const { theme, resolvedTheme } = useTheme();
  const isDark = (resolvedTheme || theme) === "dark";

  return (
    <div
      style={{
        height: "6px",
        background: isDark ? "#0d1a0d" : "#e5e7eb",
        borderRadius: "3px",
        overflow: "hidden",
        border: isDark ? "1px solid #1a2a1a" : "1px solid #d1d5db",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${value}%`,
          borderRadius: "3px",
          background: gradient,
          transition: instant ? "none" : "width 1s linear",
        }}
      />
    </div>
  );
}

function TaskItem({
  task,
  value,
  gradient,
  instant,
  isActive,
  onClick,
  onPressStart,
  onPressMove,
  onPressEnd,
}: {
  task: HomeTask;
  value: number;
  gradient: string;
  instant?: boolean;
  isActive: boolean;
  onClick: () => void;
  onPressStart: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPressMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPressEnd: (e: ReactPointerEvent<HTMLDivElement>) => void;
}) {
  const { theme, resolvedTheme } = useTheme();
  const isDark = (resolvedTheme || theme) === "dark";

  return (
    <div
      onClick={onClick}
      onPointerDown={onPressStart}
      onPointerMove={onPressMove}
      onPointerUp={onPressEnd}
      onPointerCancel={onPressEnd}
      onPointerLeave={onPressEnd}
      onContextMenu={(e) => e.preventDefault()}
      className="ncasa-task-item"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "10px 12px",
        borderRadius: "10px",
        cursor: "pointer",
        border: isActive ? (isDark ? "1px solid #3d6b3d" : "1px solid #86efac") : "1px solid transparent",
        background: isActive ? (isDark ? "#1a2e1a" : "#ecfdf3") : "transparent",
        boxShadow: isActive ? (isDark ? "0 0 12px rgba(74,222,128,0.1)" : "0 4px 14px rgba(34,197,94,0.12)") : "none",
        position: "relative",
        transition: "all 0.2s ease",
      }}
    >
      {isActive && (
        <span
          style={{
            position: "absolute",
            left: "-2px",
            top: "50%",
            transform: "translateY(-50%)",
            width: "4px",
            height: "60%",
            background: "#4ade80",
            borderRadius: "2px",
            boxShadow: "0 0 8px #4ade80",
          }}
        />
      )}
      <div
        style={{
          width: "38px",
          height: "38px",
          borderRadius: "8px",
          background: isDark ? "#102012" : "#e5e7eb",
          border: isDark ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(0,0,0,0.16)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "20px",
          flexShrink: 0,
          boxShadow: isDark ? "inset 0 0 10px rgba(0,0,0,0.22)" : "inset 0 0 8px rgba(255,255,255,0.25)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: `${value}%`,
            background: gradient,
            transition: instant ? "none" : "height 1s linear",
          }}
        />
        <span style={{ position: "relative", zIndex: 1 }}>{task.icon}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "13px", fontWeight: 600, color: isDark ? "#e2e8f0" : "#0f172a", marginBottom: "6px" }}>{task.name}</div>
        <MiniBar value={value} gradient={gradient} instant={instant} />
      </div>
    </div>
  );
}

function BigBar({ value, gradient, instant }: { value: number; gradient: string; instant?: boolean }) {
  const { theme, resolvedTheme } = useTheme();
  const isDark = (resolvedTheme || theme) === "dark";

  return (
    <div style={{ width: "100%" }}>
      <div
        style={{
          height: "26px",
          background: isDark ? "#0a150a" : "#e5e7eb",
          borderRadius: "13px",
          border: isDark ? "1px solid #1e3a1e" : "1px solid #d1d5db",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${value}%`,
            borderRadius: "13px",
            background: gradient,
            transition: instant ? "none" : "width 1s linear",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            pointerEvents: "none",
          }}
        >
          {[...Array(5)].map((_, i) => (
            <span key={i} style={{ flex: 1, borderRight: i < 4 ? "1px solid rgba(0,0,0,0.25)" : "none" }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function NecesidadesCasa() {
  const { theme, resolvedTheme } = useTheme();
  const isDark = (resolvedTheme || theme) === "dark";

  const colors = {
    pageBg: isDark ? "#0d1117" : "#f5f7fb",
    shellBorder: isDark ? "1px solid #1e2d1e" : "1px solid #d7dce6",
    shellShadow: isDark ? "0 0 40px rgba(74,222,128,0.07)" : "0 8px 30px rgba(17,24,39,0.08)",
    title: isDark ? "#f0fdf4" : "#0f172a",
    subtitle: isDark ? "#6b7280" : "#64748b",
    detailCardBg: isDark ? "#0f1a0f" : "#ffffff",
    detailCardBorder: isDark ? "1px solid #1e3a1e" : "1px solid #d7dce6",
    detailCircleBg: isDark ? "radial-gradient(circle at 35% 35%, #243824, #0f1a0f)" : "radial-gradient(circle at 35% 35%, #dcfce7, #f8fafc)",
    detailCircleBorder: isDark ? "2px solid #2d4a2d" : "2px solid #86efac",
    detailTitle: isDark ? "#f0fdf4" : "#0f172a",
    detailFreq: isDark ? "#4ade80" : "#15803d",
  };

  const [tasks, setTasks] = useState<HomeTask[]>(() => loadStoredTasks());
  const [selectedId, setSelectedId] = useState(0);
  const [flashing, setFlashing] = useState(false);
  const [, setTick] = useState(0);
  const [completingId, setCompletingId] = useState<number | null>(null);
  const [completingFrom, setCompletingFrom] = useState(0);
  const [completingProgress, setCompletingProgress] = useState(0);
  const completionRafRef = useRef<number | null>(null);
  const [remoteLoaded, setRemoteLoaded] = useState(false);
  const [remoteSyncEnabled, setRemoteSyncEnabled] = useState(true);
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [newTaskEmoji, setNewTaskEmoji] = useState("🏠");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPeriodDays, setNewTaskPeriodDays] = useState("7");
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);
  const titleLongPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const taskPointerIdRef = useRef<number | null>(null);
  const taskPressStartPointRef = useRef<{ x: number; y: number } | null>(null);
  const titlePointerIdRef = useRef<number | null>(null);
  const titlePressStartPointRef = useRef<{ x: number; y: number } | null>(null);
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadRemoteTasks = async () => {
      try {
        const response = await fetch("/api/home-needs/tasks");

        if (response.status === 401) {
          if (!cancelled) {
            setRemoteSyncEnabled(false);
            setRemoteLoaded(true);
          }
          return;
        }

        if (!response.ok) {
          if (!cancelled) {
            setRemoteLoaded(true);
          }
          return;
        }

        const data = (await response.json()) as unknown;
        if (Array.isArray(data) && data.length > 0 && !cancelled) {
          const parsed = loadStoredTasks();
          const safeTasks = data
            .map((item) => {
              const task = item as Partial<HomeTask>;
              if (
                typeof task.id !== "number" ||
                typeof task.icon !== "string" ||
                typeof task.name !== "string" ||
                typeof task.freq !== "string" ||
                typeof task.periodDays !== "number" ||
                typeof task.lastDone !== "number" ||
                typeof task.btnText !== "string" ||
                typeof task.illo !== "string"
              ) {
                return null;
              }

              return {
                id: task.id,
                icon: task.icon,
                name: task.name,
                freq: task.freq,
                periodDays: task.periodDays,
                lastDone: task.lastDone,
                btnText: task.btnText,
                illo: task.illo,
              } satisfies HomeTask;
            })
            .filter((task): task is HomeTask => task !== null);

          setTasks(safeTasks.length > 0 ? safeTasks : parsed);
          setSelectedId((prev) => (safeTasks.some((task) => task.id === prev) ? prev : safeTasks[0]?.id ?? 0));
        }

        if (!cancelled) {
          setRemoteLoaded(true);
        }
      } catch {
        if (!cancelled) {
          setRemoteLoaded(true);
        }
      }
    };

    void loadRemoteTasks();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(HOME_TASKS_STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    if (!remoteLoaded || !remoteSyncEnabled) return;

    if (saveDebounceRef.current) {
      clearTimeout(saveDebounceRef.current);
    }

    saveDebounceRef.current = setTimeout(() => {
      void fetch("/api/home-needs/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks }),
      });
    }, 400);

    return () => {
      if (saveDebounceRef.current) {
        clearTimeout(saveDebounceRef.current);
      }
    };
  }, [remoteLoaded, remoteSyncEnabled, tasks]);

  const liveTask = useCallback((t: HomeTask) => {
    const value = computeValue(t.lastDone, t.periodDays);
    const overdueDays = computeOverdueDays(t.lastDone, t.periodDays);
    return { ...t, value, overdueDays, color: computeColor(value, overdueDays) };
  }, []);

  const liveTasks = tasks.map(liveTask);
  const selected = liveTasks.find((t) => t.id === selectedId) ?? liveTasks[0];

  if (!selected) return null;

  const displayFor = (task: { id: number; value: number; color: TaskColor }) => {
    if (completingId === task.id) {
      return {
        value: completingFrom + (100 - completingFrom) * completingProgress,
        gradient: getCompletionGradient(completingProgress),
        instant: true,
      };
    }
    return { value: task.value, gradient: getBarGradient(task.color), instant: false };
  };

  const selectedDisplay = displayFor(selected);

  const remaining = daysRemaining(selected.lastDone, selected.periodDays);

  const runCompletionAnimation = useCallback((taskId: number, startValue: number) => {
    const duration = 1400;
    const startTime = performance.now();
    setCompletingId(taskId);
    setCompletingFrom(startValue);
    setCompletingProgress(0);

    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      setCompletingProgress(t);
      if (t < 1) {
        completionRafRef.current = requestAnimationFrame(step);
        return;
      }
      setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, lastDone: Date.now() } : task)));
      setCompletingId(null);
      completionRafRef.current = null;
      setFlashing(true);
      setTimeout(() => setFlashing(false), 400);
    };

    completionRafRef.current = requestAnimationFrame(step);
  }, []);

  useEffect(() => {
    return () => {
      if (completionRafRef.current) cancelAnimationFrame(completionRafRef.current);
    };
  }, []);

  const markDone = () => {
    if (completingId !== null) return;

    if (selected.color === "red") {
      runCompletionAnimation(selected.id, selected.value);
      return;
    }

    setFlashing(true);
    setTimeout(() => setFlashing(false), 400);
    setTasks((prev) => prev.map((t) => (t.id === selectedId ? { ...t, lastDone: Date.now() } : t)));
  };

  const askPeriodDays = useCallback((defaultValue: number) => {
    const input = window.prompt(
      "Cada cuantos dias queres que se reinicie la barra?",
      String(Number(defaultValue.toFixed(2))),
    );

    if (input === null) return null;
    const parsed = Number(input.replace(",", ".").trim());
    if (!Number.isFinite(parsed) || parsed <= 0) {
      window.alert("Ingresa un numero mayor a 0.");
      return null;
    }

    return parsed;
  }, []);

  const editTaskPeriod = useCallback((taskId: number) => {
    const currentTask = tasks.find((t) => t.id === taskId);
    if (!currentTask) return;

    const parsed = askPeriodDays(currentTask.periodDays);
    if (parsed === null) return;

    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              periodDays: parsed,
              freq: formatFrequency(parsed),
            }
          : task,
      ),
    );
  }, [askPeriodDays, tasks]);

  const editTaskTitle = useCallback((taskId: number) => {
    const currentTask = tasks.find((t) => t.id === taskId);
    if (!currentTask) return;

    const nextTitle = window.prompt("Nuevo titulo:", currentTask.name);
    if (nextTitle === null) return;

    const cleanTitle = nextTitle.trim();
    if (!cleanTitle) {
      window.alert("El titulo no puede estar vacio.");
      return;
    }

    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              name: cleanTitle,
              btnText: `Marcar ${cleanTitle} como hecho`,
            }
          : task,
      ),
    );
  }, [tasks]);

  const deleteTask = useCallback((taskId: number) => {
    const currentTask = tasks.find((t) => t.id === taskId);
    if (!currentTask) return;

    const shouldDelete = window.confirm(`Eliminar "${currentTask.name}"?`);
    if (!shouldDelete) return;

    setTasks((prev) => {
      const next = prev.filter((task) => task.id !== taskId);
      if (next.length > 0 && selectedId === taskId) {
        setSelectedId(next[0].id);
      }
      return next;
    });
  }, [selectedId, tasks]);

  const openTaskActions = useCallback((taskId: number) => {
    const currentTask = tasks.find((t) => t.id === taskId);
    if (!currentTask) return;

    const action = window.prompt(
      `Accion para "${currentTask.name}":\n1 = Editar dias\n2 = Editar titulo\n3 = Eliminar`,
      "1",
    );

    if (action === null) return;

    const normalized = action.trim();
    if (normalized === "1") {
      editTaskPeriod(taskId);
      return;
    }
    if (normalized === "2") {
      editTaskTitle(taskId);
      return;
    }
    if (normalized === "3") {
      deleteTask(taskId);
      return;
    }

    window.alert("Opcion invalida. Usa 1, 2 o 3.");
  }, [deleteTask, editTaskPeriod, editTaskTitle, tasks]);

  const openAddTaskForm = useCallback(() => {
    setIsAddFormOpen(true);
    setNewTaskEmoji((prev) => prev.trim() || "🏠");
    setNewTaskTitle((prev) => prev.trim() || "");
    setNewTaskPeriodDays((prev) => prev.trim() || "7");
  }, []);

  const createNewTaskFromForm = useCallback(() => {
    const cleanTitle = newTaskTitle.trim();
    if (!cleanTitle) {
      window.alert("El titulo no puede estar vacio.");
      return;
    }

    const parsed = Number(newTaskPeriodDays.replace(",", ".").trim());
    if (!Number.isFinite(parsed) || parsed <= 0) {
      window.alert("Ingresa un numero mayor a 0 para los dias.");
      return;
    }

    const cleanEmoji = newTaskEmoji.trim() || "🏠";

    const nextTask: HomeTask = {
      id: Date.now(),
      icon: cleanEmoji,
      name: cleanTitle,
      freq: formatFrequency(parsed),
      periodDays: parsed,
      lastDone: Date.now(),
      btnText: `Marcar ${cleanTitle} como hecho`,
      illo: cleanEmoji,
    };

    setTasks((prev) => [nextTask, ...prev]);
    setSelectedId(nextTask.id);
    setIsAddFormOpen(false);
    setNewTaskEmoji("🏠");
    setNewTaskTitle("");
    setNewTaskPeriodDays("7");
  }, [newTaskEmoji, newTaskPeriodDays, newTaskTitle]);

  const cancelTaskLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    taskPointerIdRef.current = null;
    taskPressStartPointRef.current = null;
  }, []);

  const startTaskLongPress = useCallback((taskId: number, event: ReactPointerEvent<HTMLDivElement>) => {
    cancelTaskLongPress();

    taskPointerIdRef.current = event.pointerId;
    taskPressStartPointRef.current = { x: event.clientX, y: event.clientY };

    longPressTriggeredRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      setSelectedId(taskId);
      openTaskActions(taskId);
      cancelTaskLongPress();
    }, 700);
  }, [cancelTaskLongPress, openTaskActions]);

  const moveTaskLongPress = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (taskPointerIdRef.current !== event.pointerId || !taskPressStartPointRef.current) return;

    const dx = Math.abs(event.clientX - taskPressStartPointRef.current.x);
    const dy = Math.abs(event.clientY - taskPressStartPointRef.current.y);
    if (dx > 8 || dy > 8) {
      cancelTaskLongPress();
    }
  }, [cancelTaskLongPress]);

  const endTaskLongPress = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (taskPointerIdRef.current !== event.pointerId) return;
    cancelTaskLongPress();
  }, [cancelTaskLongPress]);

  const handleTaskClick = useCallback((taskId: number) => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    setSelectedId(taskId);
  }, []);

  const cancelTitleLongPress = useCallback(() => {
    if (titleLongPressTimerRef.current) {
      clearTimeout(titleLongPressTimerRef.current);
      titleLongPressTimerRef.current = null;
    }
    titlePointerIdRef.current = null;
    titlePressStartPointRef.current = null;
  }, []);

  const startTitleLongPress = useCallback((event: ReactPointerEvent<HTMLHeadingElement>) => {
    cancelTitleLongPress();

    titlePointerIdRef.current = event.pointerId;
    titlePressStartPointRef.current = { x: event.clientX, y: event.clientY };

    titleLongPressTimerRef.current = setTimeout(() => {
      openAddTaskForm();
      cancelTitleLongPress();
    }, 550);
  }, [cancelTitleLongPress, openAddTaskForm]);

  const moveTitleLongPress = useCallback((event: ReactPointerEvent<HTMLHeadingElement>) => {
    if (titlePointerIdRef.current !== event.pointerId || !titlePressStartPointRef.current) return;

    const dx = Math.abs(event.clientX - titlePressStartPointRef.current.x);
    const dy = Math.abs(event.clientY - titlePressStartPointRef.current.y);
    if (dx > 18 || dy > 18) {
      cancelTitleLongPress();
    }
  }, [cancelTitleLongPress]);

  const endTitleLongPress = useCallback((event: ReactPointerEvent<HTMLHeadingElement>) => {
    if (titlePointerIdRef.current !== event.pointerId) return;
    cancelTitleLongPress();
  }, [cancelTitleLongPress]);

  return (
    <>
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes doneFlash {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.03); }
          100% { opacity: 1; transform: scale(1); }
        }
        .ncasa-task-item:hover {
          background: ${isDark ? "#1a2e1a" : "#ecfdf3"} !important;
          border-color: ${isDark ? "#2d4a2d" : "#86efac"} !important;
        }
        .ncasa-task-item {
          user-select: none;
          -webkit-user-select: none;
          -webkit-touch-callout: none;
          touch-action: manipulation;
        }
        .ncasa-btn:hover {
          transform: translateY(-1px) !important;
          box-shadow: 0 6px 20px rgba(34,197,94,0.4) !important;
          background: linear-gradient(135deg, #22c55e, #4ade80) !important;
        }
        .ncasa-btn:active { transform: scale(0.98) translateY(0) !important; }
        .ncasa-flash { animation: doneFlash 0.4s ease; }
        .ncasa-illo { animation: float 3s ease-in-out infinite; }
        .ncasa-grid {
          display: grid;
          grid-template-columns: 1fr 1.3fr;
          gap: 12px;
        }
        @media (max-width: 900px) {
          .ncasa-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div
        style={{
          fontFamily: "'Exo 2', 'Segoe UI', sans-serif",
          background: colors.pageBg,
          borderRadius: "14px",
          border: colors.shellBorder,
          boxShadow: colors.shellShadow,
          width: "100%",
        }}
      >
        <div className="ncasa-grid" style={{ width: "100%", padding: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <div
                onPointerDown={startTitleLongPress}
                onPointerMove={moveTitleLongPress}
                onPointerUp={endTitleLongPress}
                onPointerCancel={endTitleLongPress}
                onPointerLeave={endTitleLongPress}
                onContextMenu={(e) => e.preventDefault()}
                style={{
                  display: "inline-flex",
                  padding: "4px 8px",
                  marginLeft: "-8px",
                  borderRadius: "8px",
                  userSelect: "none",
                  touchAction: "manipulation",
                  cursor: "pointer",
                }}
                title="Long press para agregar componente"
              >
                <h1
                  style={{
                    fontFamily: "'Orbitron', monospace",
                    fontSize: "15px",
                    fontWeight: 700,
                    color: colors.title,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    margin: 0,
                  }}
                >
                  Necesidades de tu Casa
                </h1>
              </div>
            </div>
            <p style={{ color: colors.subtitle, fontSize: "11px", marginBottom: "14px" }}>
              Mantene tu casa en buen estado. Long press en una tarea para editarla. Long press en el titulo para agregar.
            </p>
            {isAddFormOpen && (
              <div
                style={{
                  border: isDark ? "1px solid #2d4a2d" : "1px solid #86efac",
                  background: isDark ? "#112011" : "#f0fdf4",
                  borderRadius: "10px",
                  padding: "10px",
                  marginBottom: "10px",
                  display: "grid",
                  gap: "8px",
                }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "72px 1fr", gap: "8px" }}>
                  <input
                    value={newTaskEmoji}
                    onChange={(e) => setNewTaskEmoji(e.target.value)}
                    maxLength={3}
                    placeholder="🏠"
                    style={{
                      height: "34px",
                      borderRadius: "8px",
                      border: isDark ? "1px solid #325a32" : "1px solid #86efac",
                      background: isDark ? "#0f1a0f" : "#ffffff",
                      color: colors.title,
                      textAlign: "center",
                      fontSize: "18px",
                    }}
                  />
                  <input
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Titulo del componente"
                    style={{
                      height: "34px",
                      borderRadius: "8px",
                      border: isDark ? "1px solid #325a32" : "1px solid #86efac",
                      background: isDark ? "#0f1a0f" : "#ffffff",
                      color: colors.title,
                      padding: "0 10px",
                      fontSize: "12px",
                    }}
                  />
                </div>
                <input
                  value={newTaskPeriodDays}
                  onChange={(e) => setNewTaskPeriodDays(e.target.value)}
                  placeholder="Cada cuantos dias se reinicia"
                  inputMode="decimal"
                  style={{
                    height: "34px",
                    borderRadius: "8px",
                    border: isDark ? "1px solid #325a32" : "1px solid #86efac",
                    background: isDark ? "#0f1a0f" : "#ffffff",
                    color: colors.title,
                    padding: "0 10px",
                    fontSize: "12px",
                  }}
                />
                <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => setIsAddFormOpen(false)}
                    style={{
                      height: "30px",
                      borderRadius: "8px",
                      border: isDark ? "1px solid #325a32" : "1px solid #86efac",
                      background: "transparent",
                      color: colors.subtitle,
                      padding: "0 10px",
                      fontSize: "11px",
                      cursor: "pointer",
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={createNewTaskFromForm}
                    style={{
                      height: "30px",
                      borderRadius: "8px",
                      border: "none",
                      background: "linear-gradient(135deg, #16a34a, #22c55e)",
                      color: "#052e16",
                      padding: "0 10px",
                      fontSize: "11px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Agregar
                  </button>
                </div>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {liveTasks.map((t) => {
                const display = displayFor(t);
                return (
                <TaskItem
                  key={t.id}
                  task={t}
                  value={display.value}
                  gradient={display.gradient}
                  instant={display.instant}
                  isActive={t.id === selectedId}
                  onClick={() => handleTaskClick(t.id)}
                  onPressStart={(e) => startTaskLongPress(t.id, e)}
                  onPressMove={moveTaskLongPress}
                  onPressEnd={endTaskLongPress}
                />
                );
              })}
            </div>
          </div>

          <div
            style={{
              background: colors.detailCardBg,
              borderRadius: "12px",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "14px",
              border: colors.detailCardBorder,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: "40%",
                background: isDark
                  ? "radial-gradient(ellipse at 50% 100%, rgba(74,222,128,0.06) 0%, transparent 70%)"
                  : "radial-gradient(ellipse at 50% 100%, rgba(34,197,94,0.08) 0%, transparent 70%)",
                pointerEvents: "none",
              }}
            />

            <div
              style={{
                width: "80px",
                height: "80px",
                borderRadius: "50%",
                background: selectedDisplay.gradient,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "38px",
                border: isDark ? "2px solid rgba(255,255,255,0.22)" : "2px solid rgba(0,0,0,0.14)",
                boxShadow: isDark
                  ? "0 0 20px rgba(74,222,128,0.22), inset 0 0 16px rgba(0,0,0,0.25)"
                  : "0 0 20px rgba(34,197,94,0.18), inset 0 0 12px rgba(255,255,255,0.22)",
              }}
            >
              {selected.icon}
            </div>

            <div style={{ textAlign: "center" }}>
              <h2
                style={{
                  fontFamily: "'Orbitron', monospace",
                  fontSize: "20px",
                  fontWeight: 700,
                  color: colors.detailTitle,
                  marginBottom: "4px",
                }}
              >
                {selected.name}
              </h2>
              <p style={{ color: colors.detailFreq, fontSize: "13px", fontWeight: 500 }}>{selected.freq}</p>
            </div>

            <BigBar value={selectedDisplay.value} gradient={selectedDisplay.gradient} instant={selectedDisplay.instant} />

            <div
              style={{
                padding: "4px 14px",
                borderRadius: "20px",
                background: remaining <= 0 ? "rgba(239,68,68,0.15)" : "rgba(74,222,128,0.08)",
                border: `1px solid ${remaining <= 0 ? "rgba(239,68,68,0.3)" : "rgba(74,222,128,0.2)"}`,
                fontSize: "11px",
                fontWeight: 600,
                color: remaining <= 0 ? "#f87171" : "#86efac",
                letterSpacing: "0.03em",
              }}
            >
              {formatRemaining(remaining, selected.color, selected.overdueDays)}
            </div>

            <div className="ncasa-illo" style={{ fontSize: "60px", lineHeight: 1 }}>
              {selected.illo}
            </div>

            <button
              className={`ncasa-btn${flashing ? " ncasa-flash" : ""}`}
              onClick={markDone}
              disabled={completingId === selected.id}
              style={{
                width: "100%",
                padding: "14px 20px",
                background: "linear-gradient(135deg, #16a34a, #22c55e)",
                border: "none",
                borderRadius: "10px",
                color: "#052e16",
                fontFamily: "'Exo 2', sans-serif",
                fontSize: "14px",
                fontWeight: 700,
                cursor: completingId === selected.id ? "default" : "pointer",
                opacity: completingId === selected.id ? 0.75 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                letterSpacing: "0.02em",
                boxShadow: "0 4px 15px rgba(34,197,94,0.3)",
                transition: "all 0.2s ease",
                position: "relative",
                zIndex: 1,
              }}
            >
              <span
                style={{
                  width: "20px",
                  height: "20px",
                  background: "rgba(0,0,0,0.2)",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "12px",
                }}
              >
                ✓
              </span>
              <span>{completingId === selected.id ? "Completando..." : selected.btnText}</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
