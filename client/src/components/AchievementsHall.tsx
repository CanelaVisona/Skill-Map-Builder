import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trophy, X } from "lucide-react";
import { useSkillTree } from "@/lib/skill-context";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { playProgressAdvanceSound } from "@/lib/sound";
import {
  AchievementCelebration,
  ACHIEVEMENT_CELEBRATION_MS,
  type AchievementCelebrationState,
} from "@/components/AchievementCelebration";

// Tab "Logros" del Journal: junta en un solo lugar lo que ya se cumplió en cada tracker
// (hábitos terminados, libros leídos, bugs debugueados, objetivos, ahorro, etc.). Solo lee:
// cada logro se sigue editando desde su propio modal. Los únicos que viven acá son los
// logros manuales, que se agregan manteniendo apretado el fondo de la tab.

type CategoryKey =
  | "manual"
  | "habits"
  | "books"
  | "spaced"
  | "rewiring"
  | "errorsFound"
  | "bugs"
  | "shadows"
  | "goals"
  | "skills"
  | "financial"
  | "missions"
  | "questions"
  | "repairs";

const CATEGORIES: Record<CategoryKey, { emoji: string; label: string }> = {
  manual: { emoji: "🏅", label: "Logros propios" },
  habits: { emoji: "🔥", label: "Hábitos completados" },
  books: { emoji: "📚", label: "Libros leídos" },
  spaced: { emoji: "🧠", label: "Repetición espaciada" },
  rewiring: { emoji: "⚡", label: "Rewirings completados" },
  errorsFound: { emoji: "🔍", label: "Errores encontrados" },
  bugs: { emoji: "🐞", label: "Errores debugueados" },
  shadows: { emoji: "💀", label: "Sombras derrotadas" },
  goals: { emoji: "🎯", label: "Objetivos cumplidos" },
  skills: { emoji: "✨", label: "Skills completadas" },
  financial: { emoji: "💰", label: "Metas de ahorro" },
  missions: { emoji: "🐷", label: "Misiones de ahorro" },
  questions: { emoji: "⚔️", label: "Problemas encontrados" },
  repairs: { emoji: "🔧", label: "Reparaciones hechas" },
};

interface ManualAchievement {
  id: string;
  emoji: string;
  title: string;
  detail: string;
  date: string;
}

const MANUAL_KEY = ["achievements-hall", "manual"];
const LONG_PRESS_MS = 550;

interface Achievement {
  id: string;
  cat: CategoryKey;
  emoji?: string;
  manualId?: string;
  title: string;
  detail?: string;
  date?: string | null;
}

// Fechas "YYYY-MM-DD" se leen como día local; el resto (ISO/timestamp) tal cual.
function toTime(date?: string | null): number {
  if (!date) return 0;
  const t = new Date(date.length === 10 ? `${date}T00:00:00` : date).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function formatDate(date?: string | null): string {
  const t = toTime(date);
  if (!t) return "";
  return new Date(t).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Keys propias (no las de cada modal) porque algunos modales cachean con otro queryFn/forma.
// Se refetchea al montar para que el tab siempre muestre lo último.
function useList<T>(key: string, url: string, enabled = true) {
  return useQuery<T[]>({
    queryKey: ["achievements-hall", key],
    enabled,
    refetchOnMount: "always",
    queryFn: async () => {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  }).data ?? [];
}

export function AchievementsHall() {
  const { areas, projects } = useSkillTree();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<CategoryKey | null>(null);
  const [draft, setDraft] = useState<{ emoji: string; title: string; detail: string; date: string } | null>(null);
  const pressRef = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);

  const manual = useList<ManualAchievement>("manual", "/api/manual-achievements");
  const nodeErrors = useList<any>("node-errors", "/api/node-errors");

  const saveManual = useMutation({
    mutationFn: async (items: ManualAchievement[]) => {
      const res = await fetch("/api/manual-achievements", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ items }),
      });
      if (!res.ok) throw new Error("No se pudo guardar el logro");
      return (await res.json()) as ManualAchievement[];
    },
    onMutate: async (items) => {
      await queryClient.cancelQueries({ queryKey: MANUAL_KEY });
      const previous = queryClient.getQueryData<ManualAchievement[]>(MANUAL_KEY);
      queryClient.setQueryData(MANUAL_KEY, items);
      return { previous };
    },
    onError: (_err, _items, ctx) => queryClient.setQueryData(MANUAL_KEY, ctx?.previous ?? []),
    onSuccess: (items) => queryClient.setQueryData(MANUAL_KEY, items),
  });

  const [celebration, setCelebration] = useState<AchievementCelebrationState | null>(null);
  const celebrationTimerRef = useRef<number | null>(null);
  useEffect(() => () => {
    if (celebrationTimerRef.current) window.clearTimeout(celebrationTimerRef.current);
  }, []);
  const celebrate = (emoji: string, title: string) => {
    playProgressAdvanceSound();
    setCelebration({ emoji, title });
    if (celebrationTimerRef.current) window.clearTimeout(celebrationTimerRef.current);
    celebrationTimerRef.current = window.setTimeout(() => setCelebration(null), ACHIEVEMENT_CELEBRATION_MS);
  };

  const addManual = () => {
    if (!draft || !draft.title.trim()) return;
    const item: ManualAchievement = {
      id: crypto.randomUUID(),
      emoji: draft.emoji.trim() || "🏅",
      title: draft.title.trim(),
      detail: draft.detail.trim(),
      date: draft.date || todayStr(),
    };
    saveManual.mutate([...manual, item], { onSuccess: () => celebrate(item.emoji, item.title) });
    setDraft(null);
  };

  // Mantener apretado el fondo (no una tarjeta ni un botón) abre el alta de un logro manual.
  // Moverse más de 10px cancela, así scrollear la lista no lo dispara.
  const cancelPress = () => {
    if (pressRef.current) clearTimeout(pressRef.current.timer);
    pressRef.current = null;
  };
  const startPress = (e: React.PointerEvent) => {
    // contains(): los eventos del diálogo (portal) también burbujean hasta acá.
    const target = e.target as HTMLElement;
    if (!e.currentTarget.contains(target) || target.closest("button, [data-achievement-card]")) return;
    cancelPress();
    pressRef.current = {
      x: e.clientX,
      y: e.clientY,
      timer: setTimeout(() => {
        pressRef.current = null;
        setDraft({ emoji: "🏅", title: "", detail: "", date: todayStr() });
      }, LONG_PRESS_MS),
    };
  };
  const movePress = (e: React.PointerEvent) => {
    const p = pressRef.current;
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10) cancelPress();
  };
  const pressHandlers = {
    onPointerDown: startPress,
    onPointerMove: movePress,
    onPointerUp: cancelPress,
    onPointerLeave: cancelPress,
    onPointerCancel: cancelPress,
    onContextMenu: (e: React.MouseEvent) => {
      if (!(e.target as HTMLElement).closest("button, [data-achievement-card]")) e.preventDefault();
    },
  };

  const habits = useList<any>("habits", "/api/habits");
  const books = useList<any>("books", "/api/book-wishlist");
  const spaced = useList<any>("spaced", "/api/space-repetition");
  const rewiring = useList<any>("rewiring", "/api/rewiring-trackers");
  const shadows = useList<any>("shadows", "/api/journal/shadows");
  const lifeGoals = useList<any>("life-goals", "/api/life-goals");
  const globalSkills = useList<any>("global-skills", "/api/global-skills");
  const financial = useList<any>("financial", "/api/financial-goals");
  const missions = useList<any>("missions", "/api/saving-missions");
  const questions = useList<any>("questions", "/api/question-problems");
  const repairs = useList<any>("repairs", "/api/house-repairs/items");

  const areaIds = areas.map((a) => a.id).join("|");
  const { data: bugs = [] } = useQuery<Array<{ areaName: string; bug: any }>>({
    queryKey: ["achievements-hall", "bugs", areaIds],
    enabled: areas.length > 0,
    refetchOnMount: "always",
    queryFn: async () => {
      const groups = await Promise.all(
        areas.map(async (area) => {
          const res = await fetch(`/api/source-bugs/area/${area.id}`, { credentials: "include" });
          if (!res.ok) return [];
          const list = (await res.json()) as any[];
          return list.map((bug) => ({ areaName: area.name, bug }));
        }),
      );
      return groups.flat();
    },
  });

  const sourceName = (type: string, id: string) =>
    (type === "area" ? areas.find((a) => a.id === id) : projects.find((p) => p.id === id))?.name;

  const achievements = useMemo<Achievement[]>(() => {
    const today = todayStr();
    const list: Achievement[] = [];

    // Hábito con fecha de fin ya pasada = hábito terminado (mismo criterio que "archivados").
    habits
      .filter((h) => h.endDate && h.endDate < today)
      .forEach((h) =>
        list.push({
          id: `habit-${h.id}`,
          cat: "habits",
          title: `${h.emoji ?? ""} ${h.name}`.trim(),
          detail: h.bestStreak ? `Mejor racha: ${h.bestStreak} días` : undefined,
          date: h.endDate,
        }),
      );

    books
      .filter((b) => b.status === "leido")
      .forEach((b) =>
        list.push({ id: `book-${b.id}`, cat: "books", title: b.title, detail: b.author || undefined, date: b.updatedAt }),
      );

    spaced
      .filter((p) => p.archived === 1 || p.archived === true)
      .forEach((p) =>
        list.push({
          id: `sr-${p.id}`,
          cat: "spaced",
          title: `${p.emoji ?? ""} ${p.name}`.trim(),
          detail: p.level === 2 ? "Nivel 2 completo" : undefined,
          date: p.endDate,
        }),
      );

    rewiring
      .filter((t) => t.archivedAt)
      .forEach((t) =>
        list.push({
          id: `rw-${t.id}`,
          cat: "rewiring",
          title: t.name,
          detail: t.count ? `${t.count} repeticiones` : undefined,
          date: t.archivedAt,
        }),
      );

    // Encontrar un error ya es un logro, esté o no debugueado. Bugs y errores de nodo son lo
    // mismo: el error confirmado tiene su bug (bugId), así que de node_errors solo se suman los
    // que todavía no se confirmaron, para no contarlos dos veces.
    bugs.forEach(({ areaName, bug }) =>
      list.push({
        id: `found-bug-${bug.id}`,
        cat: "errorsFound",
        title: bug.nombre,
        detail: areaName,
        date: bug.createdAt,
      }),
    );
    nodeErrors
      .filter((e) => !e.bugId)
      .forEach((e) =>
        list.push({
          id: `found-err-${e.id}`,
          cat: "errorsFound",
          title: e.nombre,
          detail: (e.areaId && sourceName("area", e.areaId)) || (e.projectId && sourceName("project", e.projectId)) || undefined,
          date: e.createdAt,
        }),
      );

    bugs
      .filter(({ bug }) => bug.status === "debugueado")
      .forEach(({ areaName, bug }) =>
        list.push({
          id: `bug-${bug.id}`,
          cat: "bugs",
          title: bug.accion ? `${bug.nombre} → ${bug.accion}` : bug.nombre,
          detail: areaName,
          date: bug.updatedAt,
        }),
      );

    shadows
      .filter((s) => s.defeated === 1)
      .forEach((s) =>
        list.push({ id: `shadow-${s.id}`, cat: "shadows", title: s.name, detail: s.action || undefined, date: s.updatedAt }),
      );

    lifeGoals.forEach((row) =>
      (row.completed ?? []).forEach((g: any) =>
        list.push({
          id: `goal-${row.sourceId}-${g.id}`,
          cat: "goals",
          title: g.text,
          detail: sourceName(row.sourceType, row.sourceId),
          date: g.completedAt,
        }),
      ),
    );

    globalSkills
      .filter((s) => s.completed === 1 || s.completed === true)
      .forEach((s) =>
        list.push({ id: `skill-${s.id}`, cat: "skills", title: s.name, detail: `Nivel ${s.level}`, date: s.completedAt }),
      );

    financial
      .filter((g) => {
        const saved = (g.holdings ?? []).reduce((a: number, h: any) => a + (Number(h.amount) || 0), 0);
        return g.target > 0 && saved >= g.target;
      })
      .forEach((g) =>
        list.push({
          id: `fin-${g.id}`,
          cat: "financial",
          title: `${g.emoji ?? ""} ${g.name}`.trim(),
          detail: `Meta: US$ ${Number(g.target).toLocaleString("es-AR")}`,
          date: g.updatedAt,
        }),
      );

    missions
      .filter((m) => m.done)
      .forEach((m) =>
        list.push({
          id: `mission-${m.id}`,
          cat: "missions",
          title: `${m.emoji ?? ""} ${m.title}`.trim(),
          detail: m.amount ? `Ahorro: US$ ${Number(m.amount).toLocaleString("es-AR")}` : undefined,
          date: m.completedAt,
        }),
      );

    questions
      .filter((q) => q.foundAt)
      .forEach((q) =>
        list.push({ id: `q-${q.id}`, cat: "questions", title: q.text || "Problema", detail: q.goal || undefined, date: q.foundAt }),
      );

    repairs
      .filter((r) => r.done)
      .forEach((r) => list.push({ id: `repair-${r.id}`, cat: "repairs", title: r.text }));

    manual.forEach((m) =>
      list.push({
        id: `manual-${m.id}`,
        cat: "manual",
        emoji: m.emoji,
        manualId: m.id,
        title: m.title,
        detail: m.detail || undefined,
        date: m.date,
      }),
    );

    return list.sort((a, b) => toTime(b.date) - toTime(a.date));
  }, [manual, nodeErrors, habits, books, spaced, rewiring, bugs, shadows, lifeGoals, globalSkills, financial, missions, questions, repairs, areas, projects]);

  const counts = useMemo(() => {
    const c = {} as Record<CategoryKey, number>;
    achievements.forEach((a) => {
      c[a.cat] = (c[a.cat] ?? 0) + 1;
    });
    return c;
  }, [achievements]);

  const visible = filter ? achievements.filter((a) => a.cat === filter) : achievements;
  const categoryKeys = (Object.keys(CATEGORIES) as CategoryKey[]).filter((k) => counts[k]);

  const addDialog = (
    <>
    <AchievementCelebration celebration={celebration} />
    <Dialog open={!!draft} onOpenChange={(open) => !open && setDraft(null)}>
      <DialogContent className="max-w-md">
        <DialogTitle>Nuevo logro</DialogTitle>
        {draft && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              addManual();
            }}
          >
            <div className="flex gap-2">
              <Input
                value={draft.emoji}
                onChange={(e) => setDraft({ ...draft, emoji: e.target.value })}
                className="w-14 text-center"
                maxLength={4}
                aria-label="Emoji"
                data-testid="input-manual-achievement-emoji"
              />
              <Input
                autoFocus
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="¿Qué lograste?"
                data-testid="input-manual-achievement-title"
              />
            </div>
            <Textarea
              value={draft.detail}
              onChange={(e) => setDraft({ ...draft, detail: e.target.value })}
              placeholder="Detalle (opcional)"
              rows={2}
              data-testid="input-manual-achievement-detail"
            />
            <Input
              type="date"
              value={draft.date}
              onChange={(e) => setDraft({ ...draft, date: e.target.value })}
              data-testid="input-manual-achievement-date"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!draft.title.trim()} data-testid="button-save-manual-achievement">
                Guardar
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
    </>
  );

  if (achievements.length === 0) {
    return (
      <div
        className="flex h-full select-none flex-col items-center justify-center text-center"
        data-testid="achievements-hall-empty"
        {...pressHandlers}
      >
        <Trophy className="mb-3 h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Todavía no hay logros. ¡Terminá un hábito, un libro o un error!</p>
        <p className="mt-1 text-xs text-muted-foreground/70">Mantené apretado el fondo para agregar uno.</p>
        {addDialog}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 select-none flex-col gap-4" data-testid="achievements-hall" {...pressHandlers}>
      {addDialog}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        <button
          onClick={() => setFilter(null)}
          className={`rounded-lg border p-2.5 text-left transition-colors ${
            filter === null ? "border-foreground/40 bg-secondary" : "border-border/60 bg-muted/20 hover:bg-muted/40"
          }`}
          data-testid="achievements-filter-all"
        >
          <div className="text-xl font-bold tabular-nums text-foreground">{achievements.length}</div>
          <div className="text-xs text-muted-foreground">🏆 Todos los logros</div>
        </button>
        {categoryKeys.map((k) => (
          <button
            key={k}
            onClick={() => setFilter(filter === k ? null : k)}
            className={`rounded-lg border p-2.5 text-left transition-colors ${
              filter === k ? "border-foreground/40 bg-secondary" : "border-border/60 bg-muted/20 hover:bg-muted/40"
            }`}
            data-testid={`achievements-filter-${k}`}
          >
            <div className="text-xl font-bold tabular-nums text-foreground">{counts[k]}</div>
            <div className="text-xs text-muted-foreground">
              {CATEGORIES[k].emoji} {CATEGORIES[k].label}
            </div>
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
        {visible.map((a) => (
          <div
            key={a.id}
            className="flex select-text items-start gap-3 rounded-lg border border-border/50 bg-background/70 px-3 py-2"
            data-achievement-card
            data-testid={`achievement-${a.id}`}
          >
            <span className="mt-0.5 text-lg leading-none">{a.emoji ?? CATEGORIES[a.cat].emoji}</span>
            <div className="min-w-0 flex-1">
              <p className="break-words text-sm font-medium text-foreground">{a.title}</p>
              {a.detail && <p className="break-words text-xs text-muted-foreground">{a.detail}</p>}
            </div>
            {a.date && <span className="shrink-0 text-xs text-muted-foreground">{formatDate(a.date)}</span>}
            {a.manualId && (
              <button
                onClick={() => saveManual.mutate(manual.filter((m) => m.id !== a.manualId))}
                className="shrink-0 rounded p-0.5 text-muted-foreground/60 hover:text-foreground"
                title="Borrar logro"
                data-testid={`button-delete-manual-achievement-${a.manualId}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
        <p className="pt-2 text-center text-xs text-muted-foreground/60">Mantené apretado el fondo para agregar un logro.</p>
      </div>
    </div>
  );
}
