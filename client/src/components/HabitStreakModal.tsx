import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { ArrowLeft, ChevronLeft, ChevronRight, Eye, Trash2, Plus, Swords, Archive } from "lucide-react";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import type { Habit, HabitRecord, Area, Project } from "@shared/schema";
import { useSkillTree } from "@/lib/skill-context";
import { useXpPopup } from "@/lib/xp-popup-context";
import { useBodyProgress } from "@/lib/body-progress-context";
import { useBodyGainPopup } from "@/lib/body-gain-popup-context";
import { BodyLinkPicker, type BodyLink } from "@/components/BodyLinkPicker";

interface HabitData extends Habit {
  done: Set<string>;
  bestStreak: number;
  frozenDates: Set<string>;
}

interface HabitStreakModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

const DAY_LBLS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];
const COLORS = ["#534AB7", "#1D9E75", "#D85A30", "#185FA5"];

type PanelType = "main" | "history" | "detail" | "add" | "edit" | "archived" | "archived-detail";

// Helper function to get local date string in YYYY-MM-DD format (not UTC)
function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper function to compute streak
function computeStreakGlobal(done: Set<string>, scheduledDays?: number[], referenceDate?: Date, frozenDates: Set<string> = new Set()): number {
  const today = referenceDate || new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = getLocalDateString(today);
  
  const days = (Array.isArray(scheduledDays) && scheduledDays.length > 0) ? scheduledDays : [0, 1, 2, 3, 4, 5, 6];
  
  let s = 0;
  const c = new Date(today);
  const todayDayOfWeek = c.getDay() === 0 ? 6 : c.getDay() - 1;
  
  if (days.includes(todayDayOfWeek) && done.has(todayStr)) {
    s++;
    c.setDate(c.getDate() - 1);
  } else {
    c.setDate(c.getDate() - 1);
  }
  
  let maxIterations = 1000;
  while (maxIterations > 0) {
    maxIterations--;
    const x = getLocalDateString(c);
    const dayOfWeek = c.getDay() === 0 ? 6 : c.getDay() - 1;
    
    if (!days.includes(dayOfWeek)) {
      c.setDate(c.getDate() - 1);
      continue;
    }
    
    if (done.has(x)) {
      s++;
      c.setDate(c.getDate() - 1);
    } else if (frozenDates.has(x)) {
      // día congelado, no rompe la racha
      s++;
      c.setDate(c.getDate() - 1);
    } else {
      break;
    }
  }
  return s;
}

// Helper function to check if streak is broken
function isStreakBrokenGlobal(done: Set<string>, scheduledDays?: number[], referenceDate?: Date, frozenDates: Set<string> = new Set()): boolean {
  const today = referenceDate || new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = getLocalDateString(today);
  
  const days = (Array.isArray(scheduledDays) && scheduledDays.length > 0) ? scheduledDays : [0, 1, 2, 3, 4, 5, 6];
  
  const yesterdayStr = new Date(today);
  yesterdayStr.setDate(yesterdayStr.getDate() - 1);
  const yesterdayDateStr = getLocalDateString(yesterdayStr);
  const yesterdayDayOfWeek = yesterdayStr.getDay() === 0 ? 6 : yesterdayStr.getDay() - 1;
  
  const todayDayOfWeek = today.getDay() === 0 ? 6 : today.getDay() - 1;
  const todayScheduled = days.includes(todayDayOfWeek);
  const todayNotDone = todayScheduled && !done.has(todayStr);
  
  const yesterdayScheduled = days.includes(yesterdayDayOfWeek);
  const yesterdayNotDone = yesterdayScheduled && !done.has(yesterdayDateStr) && !frozenDates.has(yesterdayDateStr);
  
  return todayNotDone && yesterdayNotDone;
}

// Helper function to find the best streak from historical records
function computeBestStreakFromRecords(done: Set<string>, scheduledDays?: number[]): number {
  if (done.size === 0) return 0;
  
  const days = (Array.isArray(scheduledDays) && scheduledDays.length > 0) 
    ? scheduledDays 
    : [0, 1, 2, 3, 4, 5, 6];
  
  const sortedDates = Array.from(done).sort();
  let best = 0;
  let current = 0;
  
  for (const dateStr of sortedDates) {
    const d = new Date(dateStr + "T00:00:00");
    const dayOfWeek = d.getDay() === 0 ? 6 : d.getDay() - 1;
    if (!days.includes(dayOfWeek)) continue;
    
    const prev = new Date(d);
    prev.setDate(prev.getDate() - 1);
    let foundPrev = false;
    
    for (let i = 1; i <= 7; i++) {
      const p = getLocalDateString(prev);
      const pDow = prev.getDay() === 0 ? 6 : prev.getDay() - 1;
      if (days.includes(pDow)) {
        foundPrev = done.has(p);
        break;
      }
      prev.setDate(prev.getDate() - 1);
    }
    
    current = foundPrev ? current + 1 : 1;
    best = Math.max(best, current);
  }
  
  return best;
}

// Helper function to count freezes used this month
function countFreezesThisMonth(frozenDates: Set<string>): number {
  const now = new Date();
  const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return Array.from(frozenDates).filter((d) => d.startsWith(prefix)).length;
}

export function HabitStreakModal({ open, onOpenChange }: HabitStreakModalProps) {
  const [currentPanel, setCurrentPanel] = useState<PanelType>("main");
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const [historyViewDate, setHistoryViewDate] = useState(new Date());
  const [detailViewDate, setDetailViewDate] = useState(new Date());
  const [selectedArchivedHabitId, setSelectedArchivedHabitId] = useState<string | null>(null);
  const [archivedDetailDate, setArchivedDetailDate] = useState(new Date());
  const [editingArchivedId, setEditingArchivedId] = useState<string | null>(null);
  const [editingArchivedDate, setEditingArchivedDate] = useState<string>("");
  const [newHabitEmoji, setNewHabitEmoji] = useState("");
  const [newHabitName, setNewHabitName] = useState("");
  const [newHabitEndDate, setNewHabitEndDate] = useState("");
  const [newHabitAreaId, setNewHabitAreaId] = useState<string | null>(null);
  const [newHabitProjectId, setNewHabitProjectId] = useState<string | null>(null);
  const [newHabitScheduledDays, setNewHabitScheduledDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [newHabitType, setNewHabitType] = useState<"mini" | "deep">("mini");
  const [editHabitEmoji, setEditHabitEmoji] = useState("");
  const [editHabitName, setEditHabitName] = useState("");
  const [editHabitEndDate, setEditHabitEndDate] = useState("");
  const [editHabitAreaId, setEditHabitAreaId] = useState<string | null>(null);
  const [editHabitProjectId, setEditHabitProjectId] = useState<string | null>(null);
  const [editHabitScheduledDays, setEditHabitScheduledDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [editHabitType, setEditHabitType] = useState<"mini" | "deep">("mini");
  const [newHabitSkillProgressId, setNewHabitSkillProgressId] = useState<string | null>(null);
  const [editHabitSkillProgressId, setEditHabitSkillProgressId] = useState<string | null>(null);
  const [newHabitBodyLinks, setNewHabitBodyLinks] = useState<BodyLink[]>([]);
  const [editHabitBodyLinks, setEditHabitBodyLinks] = useState<BodyLink[]>([]);
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const { globalSkills, refetchGlobalSkills } = useSkillTree();
  const { showXpPopup, hideXpPopup } = useXpPopup();
  const { addBodyBlock } = useBodyProgress();
  const { showBodyGainPopup, hideBodyGainPopup } = useBodyGainPopup();

  // Muestra un pop-up de crecimiento corporal por cada componente linkeado, en secuencia (1800ms
  // entre cada uno, y esperando ese mismo tiempo si en la misma confirmación ya se mostró el de
  // XP) para que no se solapen entre sí ni con el de XP (mismo criterio que SkillNode.tsx).
  const growLinkedBody = (links: BodyLink[], xpWasShown: boolean) => {
    links.forEach((link, index) => {
      const run = () => {
        const { before, after } = addBodyBlock(link.zone, link.dimension);
        hideXpPopup();
        showBodyGainPopup({ zone: link.zone, dimension: link.dimension, before, after });
      };
      const delay = (xpWasShown ? 1800 : 0) + index * 1800;
      if (delay === 0) {
        run();
      } else {
        setTimeout(run, delay);
      }
    });
  };

  // Fetch habits
  const { data: habits = [], isLoading: habitsLoading } = useQuery({
    queryKey: ["habits"],
    queryFn: async () => {
      const res = await fetch("/api/habits");
      if (!res.ok) throw new Error("Failed to fetch habits");
      return res.json();
    },
    enabled: open,
  });

  // Fetch areas
  const { data: areas = [] } = useQuery({
    queryKey: ["areas"],
    queryFn: async () => {
      const res = await fetch("/api/areas");
      if (!res.ok) throw new Error("Failed to fetch areas");
      return res.json();
    },
    enabled: open,
  });

  // Fetch projects
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("Failed to fetch projects");
      return res.json();
    },
    enabled: open,
  });

  // Fetch skills progress (lectura, escritura, etc.) instead of skill tree nodes
  // Fetch skills by area when areaId changes - includes both legacy and global skills
  const [newPanelSkills, setNewPanelSkills] = useState<any[]>([]);
  const [editPanelSkills, setEditPanelSkills] = useState<any[]>([]);

  useEffect(() => {
    const loadSkillsByArea = async () => {
      if (!newHabitAreaId) {
        setNewPanelSkills([]);
        return;
      }
      try {
        // Load legacy skills from localStorage
        const legacySkillsData: Record<string, { name: string; currentXp: number; level: number }> = {};
        const stored = localStorage.getItem("skillsProgress");
        if (stored) {
          try {
            Object.assign(legacySkillsData, JSON.parse(stored));
          } catch (e) {
            console.error("Error parsing legacy skills:", e);
          }
        }

        // Load global skills from API
        const res = await fetch(`/api/global-skills/area/${newHabitAreaId}`);
        const globalSkillsData = res.ok ? await res.json() : [];

        // Combine: legacy skills first, then global skills
        const combined = [
          // Convert legacy skills to same format as global skills
          ...Object.entries(legacySkillsData).map(([name, skill]) => ({
            id: `legacy-${name}`,
            name: name,
            currentXp: skill.currentXp,
            level: skill.level,
            isLegacy: true,
          })),
          // Add global skills
          ...globalSkillsData,
        ];

        setNewPanelSkills(combined);
      } catch (error) {
        console.error("Error loading skills:", error);
        setNewPanelSkills([]);
      }
    };
    loadSkillsByArea();
  }, [newHabitAreaId]);

  useEffect(() => {
    const loadSkillsByArea = async () => {
      if (!editHabitAreaId) {
        setEditPanelSkills([]);
        return;
      }
      try {
        // Load legacy skills from localStorage
        const legacySkillsData: Record<string, { name: string; currentXp: number; level: number }> = {};
        const stored = localStorage.getItem("skillsProgress");
        if (stored) {
          try {
            Object.assign(legacySkillsData, JSON.parse(stored));
          } catch (e) {
            console.error("Error parsing legacy skills:", e);
          }
        }

        // Load global skills from API
        const res = await fetch(`/api/global-skills/area/${editHabitAreaId}`);
        const globalSkillsData = res.ok ? await res.json() : [];

        // Combine: legacy skills first, then global skills
        const combined = [
          // Convert legacy skills to same format as global skills
          ...Object.entries(legacySkillsData).map(([name, skill]) => ({
            id: `legacy-${name}`,
            name: name,
            currentXp: skill.currentXp,
            level: skill.level,
            isLegacy: true,
          })),
          // Add global skills
          ...globalSkillsData,
        ];

        setEditPanelSkills(combined);
      } catch (error) {
        console.error("Error loading skills:", error);
        setEditPanelSkills([]);
      }
    };
    loadSkillsByArea();
  }, [editHabitAreaId]);

  // Transform habits with their records
  const [habitsWithRecords, setHabitsWithRecords] = useState<HabitData[]>([]);

  const fetchHabitRecords = async (habitsToFetch: typeof habits) => {
    if (!habitsToFetch.length) {
      setHabitsWithRecords([]);
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const year = today.getFullYear();

    const updatedHabits = await Promise.all(
      habitsToFetch.map(async (habit: Habit) => {
        // Siempre cargamos el historial completo: la "mejor racha" necesita ver
        // todo lo hecho alguna vez, no solo el año en curso (ese recorte era lo
        // que hacía que la mejor racha se "perdiera" para hábitos activos).
        const startDate = "2000-01-01";
        const isArchived = !!habit.endDate && habit.endDate < getLocalDateString();
        const endDate = isArchived ? habit.endDate! : `${year}-12-31`;

        const res = await fetch(
          `/api/habit-records/${habit.id}?startDate=${startDate}&endDate=${endDate}`
        );
        const records: HabitRecord[] = res.ok ? await res.json() : [];
        const done = new Set(
          records.filter((r) => r.completed === 1).map((r) => r.date)
        );

        // Parse frozenDates from habit
        const frozenDates = new Set<string>(
          Array.isArray(habit.freezeDates) ? habit.freezeDates : []
        );

        // La mejor racha real = máximo entre la racha vigente (a hoy, o a la
        // fecha de archivado) y la mejor racha histórica calculada sobre todos
        // los registros. Se calcula siempre, no solo para hábitos archivados.
        let calculatedBestStreak = habit.bestStreak || 0;
        if (done.size > 0) {
          const referenceDate = isArchived ? new Date(habit.endDate! + "T00:00:00") : new Date();
          const streakAtReference = computeStreakGlobal(done, habit.scheduledDays, referenceDate, frozenDates);
          const bestEver = computeBestStreakFromRecords(done, habit.scheduledDays);
          calculatedBestStreak = Math.max(calculatedBestStreak, streakAtReference, bestEver);
        }

        return { ...habit, done, bestStreak: calculatedBestStreak, frozenDates };
      })
    );
    setHabitsWithRecords(updatedHabits);
  };

  const toggleHabitMutation = useMutation({
    mutationFn: async ({
      habitId,
      date,
      completed,
    }: {
      habitId: string;
      date: string;
      completed: 0 | 1;
    }) => {
      const res = await fetch(`/api/habit-records/${habitId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, completed }),
      });
      if (!res.ok) throw new Error("Failed to toggle habit");
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["habits"] });
      // Rebuild records from fresh habits data
      const freshHabits = queryClient.getQueryData<any[]>(["habits"]) || [];
      await fetchHabitRecords(freshHabits);
    },
  });

  const deleteHabitMutation = useMutation({
    mutationFn: async (habitId: string) => {
      const res = await fetch(`/api/habits/${habitId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete habit");
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["habits"] });
    },
  });

  const createHabitMutation = useMutation({
    mutationFn: async (data: {
      emoji: string;
      name: string;
      endDate?: string;
      areaId?: string | null;
      projectId?: string | null;
      skillId?: string | null;
      bodyLinks?: BodyLink[];
      scheduledDays: number[];
      habitType: "mini" | "deep";
    }) => {
      const res = await fetch("/api/habits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create habit");
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["habits"] });
    },
  });

  const updateHabitMutation = useMutation({
    mutationFn: async (data: {
      id: string;
      emoji: string;
      name: string;
      endDate?: string;
      areaId?: string | null;
      projectId?: string | null;
      skillId?: string | null;
      bodyLinks?: BodyLink[];
      scheduledDays?: number[];
      habitType?: "mini" | "deep";
    }) => {
      const res = await fetch(`/api/habits/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emoji: data.emoji,
          name: data.name,
          endDate: data.endDate,
          areaId: data.areaId,
          projectId: data.projectId,
          skillId: data.skillId,
          bodyLinks: data.bodyLinks,
          scheduledDays: data.scheduledDays,
          habitType: data.habitType,
        }),
      });
      if (!res.ok) throw new Error("Failed to update habit");
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["habits"] });
    },
  });

  const updateArchivedEndDateMutation = useMutation({
    mutationFn: async ({ id, endDate }: { id: string; endDate: string }) => {
      const res = await fetch(`/api/habits/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endDate }),
      });
      if (!res.ok) throw new Error("Failed to update end date");
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["habits"] });
    },
  });

  const freezeHabitMutation = useMutation({
    mutationFn: async ({ habitId, frozenDates }: { habitId: string; frozenDates: string[] }) => {
      const res = await fetch(`/api/habits/${habitId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ freezeDates: frozenDates }),
      });
      if (!res.ok) throw new Error("Failed to freeze habit");
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ["habits"] });
    },
  });

  // Fetch records when modal opens or habits change
  if (open && habitsWithRecords.length === 0 && habits.length > 0) {
    // Initialize daily refresh date on first load
    const today = getLocalDateString();
    if (!localStorage.getItem("lastHabitRefreshDate")) {
      localStorage.setItem("lastHabitRefreshDate", today);
    }
    fetchHabitRecords(habits);
  }

  // Refetch when modal opens
  useEffect(() => {
    if (open) {
      const refetch = async () => {
        await queryClient.refetchQueries({ queryKey: ["habits"] });
      };
      refetch();
    }
  }, [open, queryClient]);

  // Auto-refresh when habits array changes
  useEffect(() => {
    if (habits.length > 0) {
      fetchHabitRecords(habits);
    }
  }, [habits]);

  // Listen to habit query changes from any source (including SkillNode)
  useEffect(() => {
    if (!open) return;

    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.query.queryKey[0] === 'habits' && event.type === 'updated') {
        const freshHabits = event.query.state.data;
        if (Array.isArray(freshHabits) && freshHabits.length > 0) {
          fetchHabitRecords(freshHabits);
        }
      }
    });

    return () => unsubscribe();
  }, [open, queryClient]);

  // Daily refresh: Check if day has changed and refresh habits
  useEffect(() => {
    if (!open) return;

    const storedDate = localStorage.getItem("lastHabitRefreshDate");
    const today = getLocalDateString();

    // If this is the first check or the date has changed, refresh
    if (storedDate !== today) {
      localStorage.setItem("lastHabitRefreshDate", today);
      if (habits.length > 0) {
        fetchHabitRecords(habits);
      }
    }

    // Check every minute if the day has changed
    const interval = setInterval(() => {
      const newToday = getLocalDateString();
      const currentStored = localStorage.getItem("lastHabitRefreshDate");
      if (currentStored !== newToday) {
        localStorage.setItem("lastHabitRefreshDate", newToday);
        if (habits.length > 0) {
          fetchHabitRecords(habits);
        }
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [open, habits]);

  if (!open) return null;

  const showPanel = (panelType: PanelType) => {
    setCurrentPanel(panelType);
  };

  const showMain = () => showPanel("main");
  const showHistory = () => {
    setHistoryViewDate(
      new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    );
    showPanel("history");
  };
  const showDetail = (habitId: string) => {
    setSelectedHabitId(habitId);
    setDetailViewDate(
      new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    );
    showPanel("detail");
  };
  const showAdd = () => {
    setNewHabitSkillProgressId(null);
    setNewHabitBodyLinks([]);
    showPanel("add");
  };
  const showArchived = () => showPanel("archived");
  const showEdit = (habitId: string) => {
    const habit = habitsWithRecords.find((h) => h.id === habitId);
    if (habit) {
      setSelectedHabitId(habitId);
      setEditHabitEmoji(habit.emoji);
      setEditHabitName(habit.name);
      setEditHabitEndDate(habit.endDate || "");
      setEditHabitAreaId(habit.areaId || null);
      setEditHabitProjectId(habit.projectId || null);
      setEditHabitSkillProgressId(habit.skillId || null);
      setEditHabitBodyLinks(habit.bodyLinks ?? []);
      setEditHabitScheduledDays(habit.scheduledDays || [0, 1, 2, 3, 4, 5, 6]);
      setEditHabitType(habit.habitType || "mini");
      showPanel("edit");
    }
  };
  const resetForm = () => {
    setNewHabitEmoji("");
    setNewHabitName("");
    setNewHabitEndDate("");
    setNewHabitAreaId(null);
    setNewHabitProjectId(null);
    setNewHabitSkillProgressId(null);
    setNewHabitBodyLinks([]);
    setNewHabitScheduledDays([0, 1, 2, 3, 4, 5, 6]);
    setNewHabitType("mini");
  };
  const resetEditForm = () => {
    setEditHabitEmoji("");
    setEditHabitName("");
    setEditHabitEndDate("");
    setEditHabitAreaId(null);
    setEditHabitProjectId(null);
    setEditHabitSkillProgressId(null);
    setEditHabitBodyLinks([]);
    setEditHabitScheduledDays([0, 1, 2, 3, 4, 5, 6]);
    setEditHabitType("mini");
    setSelectedHabitId(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 border-0 bg-background touch-manipulation">
        <VisuallyHidden>
          <DialogTitle>Hábitos</DialogTitle>
          <DialogDescription>Gestiona tus hábitos diarios</DialogDescription>
        </VisuallyHidden>
        <div className="overflow-hidden rounded-3xl border border-border/50">
          {currentPanel === "main" && (
            <MainPanel
              habits={habitsWithRecords.filter((h) => !h.endDate || h.endDate >= getLocalDateString())}
              onDetailed={showDetail}
              onHistory={showHistory}
              onArchived={showArchived}
              onAddClick={showAdd}
              onEditClick={showEdit}
              onToggle={(habitId) => {
                const today = getLocalDateString();
                const habit = habitsWithRecords.find((h) => h.id === habitId);
                if (habit) {
                  const isCompleted = habit.done.has(today);
                  toggleHabitMutation.mutate(
                    {
                      habitId,
                      date: today,
                      completed: isCompleted ? 0 : 1,
                    },
                    {
                      onSuccess: async () => {
                        // Award XP if habit has a linked skill and is being marked complete
                        if (!isCompleted && habit.skillId) {
                          try {
                            const linkedSkill = globalSkills.find((skillEntry) => skillEntry.id === habit.skillId);
                            const res = await fetch(`/api/habits/${habitId}/award-xp`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                            });
                            if (res.ok) {
                              const xpData = await res.json();
                              if (linkedSkill) {
                                const area = areas.find((areaEntry) => areaEntry.id === linkedSkill.areaId);
                                hideBodyGainPopup();
                                showXpPopup({
                                  skillName: linkedSkill.name,
                                  areaColor: area?.color || "#c85a2a",
                                  xpBefore: linkedSkill.currentXp,
                                  xpAfter: linkedSkill.currentXp + (xpData?.xpAwarded || 5),
                                  xpMax: linkedSkill.goalXp || null,
                                  level: linkedSkill.level,
                                });
                              }
                              await refetchGlobalSkills();
                              await queryClient.refetchQueries({ queryKey: ["skills"] });
                            }
                          } catch (error) {
                            console.error("Error awarding XP:", error);
                          }
                        }
                        if (!isCompleted) {
                          growLinkedBody(habit.bodyLinks ?? [], !!habit.skillId);
                        }
                      },
                    }
                  );
                }
              }}
              onFreeze={(habitId) => {
                const habit = habitsWithRecords.find((h) => h.id === habitId);
                if (!habit) return;
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = getLocalDateString(yesterday);
                const updatedFreezes = [...Array.from(habit.frozenDates), yesterdayStr];
                freezeHabitMutation.mutate({ habitId, frozenDates: updatedFreezes });
              }}
              isLoading={habitsLoading}
            />
          )}

          {currentPanel === "history" && (
            <HistoryPanel
              habits={habitsWithRecords}
              currentDate={historyViewDate}
              onMonthChange={(delta) => {
                const newDate = new Date(historyViewDate);
                newDate.setMonth(newDate.getMonth() + delta);
                setHistoryViewDate(newDate);
              }}
              onBack={showMain}
            />
          )}

          {currentPanel === "detail" && selectedHabitId && (
            <DetailPanel
              habit={habitsWithRecords.find((h) => h.id === selectedHabitId)}
              currentDate={detailViewDate}
              onMonthChange={(delta) => {
                const newDate = new Date(detailViewDate);
                newDate.setMonth(newDate.getMonth() + delta);
                setDetailViewDate(newDate);
              }}
              onBack={showMain}
              onToggleDate={(date) => {
                const habit = habitsWithRecords.find((h) => h.id === selectedHabitId);
                if (!habit) return;
                const isCompleted = habit.done.has(date);
                toggleHabitMutation.mutate(
                  {
                    habitId: selectedHabitId,
                    date,
                    completed: isCompleted ? 0 : 1,
                  },
                  {
                    onSuccess: async () => {
                      // Award XP and show popup when completing from calendar too
                      if (!isCompleted && habit.skillId) {
                        try {
                          const linkedSkill = globalSkills.find((skillEntry) => skillEntry.id === habit.skillId);
                          const res = await fetch(`/api/habits/${selectedHabitId}/award-xp`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                          });

                          if (res.ok) {
                            const xpData = await res.json();
                            if (linkedSkill) {
                              const area = areas.find((areaEntry) => areaEntry.id === linkedSkill.areaId);
                              hideBodyGainPopup();
                              showXpPopup({
                                skillName: linkedSkill.name,
                                areaColor: area?.color || "#c85a2a",
                                xpBefore: linkedSkill.currentXp,
                                xpAfter: linkedSkill.currentXp + (xpData?.xpAwarded || 5),
                                xpMax: linkedSkill.goalXp || null,
                                level: linkedSkill.level,
                              });
                            }
                            await refetchGlobalSkills();
                            await queryClient.refetchQueries({ queryKey: ["skills"] });
                          }
                        } catch (error) {
                          console.error("Error awarding XP:", error);
                        }
                      }
                      if (!isCompleted) {
                        growLinkedBody(habit.bodyLinks ?? [], !!habit.skillId);
                      }
                    },
                  }
                );
              }}
            />
          )}

          {currentPanel === "add" && (
            <AddPanel
              emoji={newHabitEmoji}
              name={newHabitName}
              endDate={newHabitEndDate}
              areaId={newHabitAreaId}
              projectId={newHabitProjectId}
              skillId={newHabitSkillProgressId}
              bodyLinks={newHabitBodyLinks}
              areas={areas}
              projects={projects}
              skills={newPanelSkills}
              scheduledDays={newHabitScheduledDays}
              onScheduledDaysChange={setNewHabitScheduledDays}
              habitType={newHabitType}
              onHabitTypeChange={setNewHabitType}
              onEmojiChange={setNewHabitEmoji}
              onNameChange={setNewHabitName}
              onEndDateChange={setNewHabitEndDate}
              onAreaIdChange={setNewHabitAreaId}
              onProjectIdChange={setNewHabitProjectId}
              onSkillIdChange={setNewHabitSkillProgressId}
              onBodyLinksChange={setNewHabitBodyLinks}
              onBack={() => {
                resetForm();
                showMain();
              }}
              onSubmit={async () => {
                if (newHabitName.trim()) {
                  try {
                    await createHabitMutation.mutateAsync({
                      emoji: newHabitEmoji || "⭐",
                      name: newHabitName.trim(),
                      endDate: newHabitEndDate || undefined,
                      areaId: newHabitAreaId,
                      projectId: newHabitProjectId,
                      skillId: newHabitSkillProgressId,
                      bodyLinks: newHabitBodyLinks,
                      scheduledDays: newHabitScheduledDays,
                      habitType: newHabitType,
                    });
                    resetForm();
                    showMain();
                  } catch (error: any) {
                    console.error("Error creating habit:", error);
                    const errorMsg = error?.response?.data?.message || error?.message || "Error desconocido al crear el hábito";
                    alert(`❌ Error: ${errorMsg}`);
                  }
                }
              }}
              isLoading={createHabitMutation.isPending}
            />
          )}

          {currentPanel === "edit" && selectedHabitId && (
            <EditPanel
              habitId={selectedHabitId}
              emoji={editHabitEmoji}
              name={editHabitName}
              endDate={editHabitEndDate}
              areaId={editHabitAreaId}
              projectId={editHabitProjectId}
              skillId={editHabitSkillProgressId}
              bodyLinks={editHabitBodyLinks}
              areas={areas}
              projects={projects}
              skills={editPanelSkills}
              scheduledDays={editHabitScheduledDays}
              onScheduledDaysChange={setEditHabitScheduledDays}
              habitType={editHabitType}
              onHabitTypeChange={setEditHabitType}
              onEmojiChange={setEditHabitEmoji}
              onNameChange={setEditHabitName}
              onEndDateChange={setEditHabitEndDate}
              onAreaIdChange={setEditHabitAreaId}
              onProjectIdChange={setEditHabitProjectId}
              onSkillIdChange={setEditHabitSkillProgressId}
              onBodyLinksChange={setEditHabitBodyLinks}
              onBack={() => {
                resetEditForm();
                showMain();
              }}
              onSubmit={async () => {
                if (editHabitName.trim() && selectedHabitId) {
                  try {
                    await updateHabitMutation.mutateAsync({
                      id: selectedHabitId,
                      emoji: editHabitEmoji || "⭐",
                      name: editHabitName.trim(),
                      endDate: editHabitEndDate || undefined,
                      areaId: editHabitAreaId,
                      projectId: editHabitProjectId,
                      skillId: editHabitSkillProgressId,
                      bodyLinks: editHabitBodyLinks,
                      scheduledDays: editHabitScheduledDays,
                      habitType: editHabitType,
                    });
                    resetEditForm();
                    showMain();
                  } catch (error: any) {
                    console.error("Error updating habit:", error);
                    const errorMsg = error?.response?.data?.message || error?.message || "Error al actualizar el hábito";
                    alert(`❌ Error: ${errorMsg}`);
                  }
                }
              }}
              onDelete={async () => {
                if (selectedHabitId && confirm("¿Estás seguro de que quieres eliminar este hábito?")) {
                  try {
                    await deleteHabitMutation.mutateAsync(selectedHabitId);
                    resetEditForm();
                    showMain();
                  } catch (error: any) {
                    console.error("Error deleting habit:", error);
                    alert(`❌ Error al eliminar: ${error?.message || "Intenta de nuevo"}`);
                  }
                }
              }}
              isLoading={updateHabitMutation.isPending || deleteHabitMutation.isPending}
            />
          )}

          {currentPanel === "archived" && (
            <ArchivedPanel
              habits={habitsWithRecords.filter((h) => h.endDate && h.endDate < getLocalDateString())}
              onBack={showMain}
              onDetailClick={(habitId) => {
                setSelectedArchivedHabitId(habitId);
                setCurrentPanel("archived-detail");
              }}
              editingId={editingArchivedId}
              editingDate={editingArchivedDate}
              onEditingDateChange={setEditingArchivedDate}
              onLongPress={(habitId) => {
                const habit = habitsWithRecords.find((h) => h.id === habitId);
                if (habit) {
                  setEditingArchivedId(habitId);
                  setEditingArchivedDate(habit.endDate || "");
                }
              }}
              onSaveDate={async () => {
                if (editingArchivedId && editingArchivedDate) {
                  try {
                    await updateArchivedEndDateMutation.mutateAsync({
                      id: editingArchivedId,
                      endDate: editingArchivedDate,
                    });
                    setEditingArchivedId(null);
                    setEditingArchivedDate("");
                  } catch (error: any) {
                    console.error("Error saving archived end date:", error);
                    alert(`Error al guardar: ${error?.message || "Intenta de nuevo"}`);
                  }
                }
              }}
              onCancelEdit={() => {
                setEditingArchivedId(null);
                setEditingArchivedDate("");
              }}
            />
          )}

          {currentPanel === "archived-detail" && selectedArchivedHabitId && (
            <ArchivedDetailPanel
              habit={habitsWithRecords.find((h) => h.id === selectedArchivedHabitId)}
              currentDate={archivedDetailDate}
              onMonthChange={(delta) => {
                const newDate = new Date(archivedDetailDate);
                newDate.setMonth(newDate.getMonth() + delta);
                setArchivedDetailDate(newDate);
              }}
              onBack={() => {
                setSelectedArchivedHabitId(null);
                setCurrentPanel("archived");
              }}
            />
          )}
        </div>

      </DialogContent>
    </Dialog>
  );
}

// Paleta por tipo de hábito: mini (violeta, casi diario) vs deep (teal, menos frecuente/más largo)
const HABIT_THEME = {
  mini: {
    activeBorder: "border-purple-500 bg-purple-500/10",
    hoverBorder: "hover:border-purple-400 hover:bg-purple-500/5",
    badge: "bg-purple-500/20 text-purple-700 dark:text-purple-400",
    bannerBg: "bg-purple-500/10 border-purple-500/20",
    bannerText: "text-purple-400",
    barFill: "bg-purple-500",
    barBg: "bg-purple-500/20",
    circleDone: "border-purple-500",
    circleToday: "border-purple-500 bg-purple-500/20",
  },
  deep: {
    activeBorder: "border-teal-500 bg-teal-500/10",
    hoverBorder: "hover:border-teal-400 hover:bg-teal-500/5",
    badge: "bg-teal-500/20 text-teal-700 dark:text-teal-400",
    bannerBg: "bg-teal-500/10 border-teal-500/20",
    bannerText: "text-teal-400",
    barFill: "bg-teal-500",
    barBg: "bg-teal-500/20",
    circleDone: "border-teal-500",
    circleToday: "border-teal-500 bg-teal-500/20",
  },
} as const;

function HabitCard({
  habit,
  today,
  todayStr,
  weekDays,
  onToggle,
  onDetailed,
  onFreeze,
  onPressStart,
  onPressEnd,
}: {
  habit: HabitData;
  today: Date;
  todayStr: string;
  weekDays: Date[];
  onToggle: (habitId: string) => void;
  onDetailed: (id: string) => void;
  onFreeze: (habitId: string) => void;
  onPressStart: (habitId: string) => void;
  onPressEnd: (habitId: string) => void;
}) {
  const theme = HABIT_THEME[habit.habitType === "deep" ? "deep" : "mini"];
  const streak = computeStreakGlobal(habit.done, habit.scheduledDays, today, habit.frozenDates);
  const broken = isStreakBrokenGlobal(habit.done, habit.scheduledDays, today, habit.frozenDates);
  const displayBestStreak = broken ? habit.bestStreak : Math.max(streak, habit.bestStreak);
  const isToday = habit.done.has(todayStr);
  const scheduledDays = habit.scheduledDays?.length ? habit.scheduledDays : [0, 1, 2, 3, 4, 5, 6];

  // Progreso de la semana actual: cuántos de los días agendados ya se completaron
  let weekTotal = 0;
  let weekCompleted = 0;
  weekDays.forEach((w, i) => {
    if (scheduledDays.includes(i)) {
      weekTotal++;
      if (habit.done.has(getLocalDateString(w))) weekCompleted++;
    }
  });

  return (
    <div
      onClick={() => onToggle(habit.id)}
      onMouseDown={() => onPressStart(habit.id)}
      onMouseUp={() => onPressEnd(habit.id)}
      onMouseLeave={() => onPressEnd(habit.id)}
      onTouchStart={() => onPressStart(habit.id)}
      onTouchEnd={() => onPressEnd(habit.id)}
      className={`cursor-pointer rounded-2xl border px-3 sm:px-3.5 py-3 transition-all active:opacity-75 touch-manipulation ${
        isToday
          ? theme.activeBorder
          : broken
            ? "border-border/30 bg-muted/30"
            : `border-border/30 ${theme.hoverBorder}`
      }`}
    >
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-lg sm:text-xl flex-shrink-0">{habit.emoji}</span>
        <span className="font-bold text-xs sm:text-sm text-foreground flex-1 min-w-0 truncate">
          {habit.name}
        </span>
        <span
          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium flex-shrink-0 whitespace-nowrap ${
            broken
              ? "border border-border/50 bg-muted text-muted-foreground"
              : theme.badge
          }`}
        >
          {broken ? "— racha rota" : `🔥 ${streak}`}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDetailed(habit.id);
          }}
          className="ml-1 flex h-8 w-8 sm:h-7 sm:w-7 items-center justify-center rounded-full border border-border/30 bg-muted hover:border-purple-400 hover:bg-purple-500/10 active:bg-purple-500/20 transition-colors flex-shrink-0 touch-manipulation"
          title="Ver historial"
        >
          <Eye className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Scheduled days */}
      {habit.scheduledDays && habit.scheduledDays.length > 0 && habit.scheduledDays.length < 7 && (
        <div className="mb-2 text-xs text-muted-foreground">
          Días: <span className="font-medium text-foreground">
            {habit.scheduledDays.map((d) => DAY_LBLS[d]).join(", ")}
          </span>
        </div>
      )}

      {/* Banner de mejor racha */}
      <div className={`mb-2 rounded-xl border px-3 py-2 text-center ${theme.bannerBg}`}>
        <p className={`text-xs font-bold ${theme.bannerText}`}>
          Mejor racha: {displayBestStreak} días 🔥
        </p>
        {streak > 0 && streak >= displayBestStreak ? (
          <p className="text-xs text-yellow-400">🏆 ¡Nuevo récord!</p>
        ) : streak > 0 && streak >= displayBestStreak - 2 ? (
          <p className="text-xs text-muted-foreground">¡Estás cerca del récord!</p>
        ) : (
          <p className="text-xs text-muted-foreground">¡Supérala para crear un nuevo récord!</p>
        )}
        <div className={`mt-1.5 h-1 w-full rounded-full ${theme.barBg}`}>
          <div
            className={`h-full rounded-full transition-all ${theme.barFill}`}
            style={{ width: `${Math.min(100, (streak / Math.max(displayBestStreak, 1)) * 100)}%` }}
          />
        </div>
      </div>

      {/* Week circles: los días agendados se ven con prioridad, el resto se atenúa */}
      <div className="flex gap-1 sm:gap-1.5 items-center">
        {weekDays.map((w, i) => {
          const wds = getLocalDateString(w);
          const wc = new Date(w);
          wc.setHours(0, 0, 0, 0);
          const isFut = wc > today;
          const isTod = wds === todayStr;
          const isDone = habit.done.has(wds);
          const isMissed = wc < today && !isDone;
          const isScheduled = scheduledDays.includes(i);

          return (
            <div
              key={i}
              className={`flex flex-col items-center gap-1 flex-1 transition-opacity ${
                isScheduled ? "" : "opacity-30"
              }`}
            >
              <div
                className={`h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium transition-all ${
                  isDone
                    ? `bg-gray-900 ${theme.circleDone} border-2`
                    : isTod
                      ? `border-2 ${theme.circleToday}`
                      : isMissed
                        ? "bg-muted border-dashed border-2 border-border/50 opacity-50"
                        : isFut
                          ? "border border-border/30 opacity-20"
                          : "border border-border/30"
                }`}
              >
                {isDone ? <span className="text-sm">🔥</span> : ""}
              </div>
              <span className="text-xs font-medium text-muted-foreground uppercase">
                {DAY_LBLS[i]}
              </span>
            </div>
          );
        })}
      </div>

      {/* Barra semanal: se completa cuando se cumplen todas las veces agendadas esa semana */}
      <div className="mt-2">
        <div className="flex gap-1">
          {Array.from({ length: Math.max(weekTotal, 1) }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                i < weekCompleted ? theme.barFill : theme.barBg
              }`}
            />
          ))}
        </div>
        <p className="mt-1 text-xs text-muted-foreground text-center">
          {weekCompleted}/{weekTotal} esta semana
        </p>
      </div>

      {broken && (
        <div>
          {(() => {
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = getLocalDateString(yesterday);
            const yesterdayDow = yesterday.getDay() === 0 ? 6 : yesterday.getDay() - 1;
            const canFreeze =
              scheduledDays.includes(yesterdayDow) &&
              !habit.frozenDates.has(yesterdayStr) &&
              countFreezesThisMonth(habit.frozenDates) < 7;

            return canFreeze ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onFreeze(habit.id);
                }}
                className="mt-1 text-xs text-blue-400 border border-blue-400/30 rounded-full px-3 py-1 hover:bg-blue-400/10 transition-colors"
              >
                🧊 Freeze x7
              </button>
            ) : null;
          })()}
        </div>
      )}
    </div>
  );
}

function MainPanel({
  habits,
  onDetailed,
  onHistory,
  onArchived,
  onAddClick,
  onEditClick,
  onToggle,
  onFreeze,
  isLoading,
}: {
  habits: HabitData[];
  onDetailed: (id: string) => void;
  onHistory: () => void;
  onArchived: () => void;
  onAddClick: () => void;
  onEditClick: (id: string) => void;
  onToggle: (habitId: string) => void;
  onFreeze: (habitId: string) => void;
  isLoading: boolean;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = getLocalDateString(today);

  // Long-press detection for editing (mouse + touch)
  const longPressTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const getWeekDays = () => {
    const dow = today.getDay();
    const mo = dow === 0 ? -6 : 1 - dow;
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + mo + i);
      return d;
    });
  };

  const weekDays = getWeekDays();
  const weekRange = `${weekDays[0].toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
  })} – ${weekDays[6].toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
  })}`;

  const doneCount = habits.filter((h) => h.done.has(todayStr)).length;
  const miniHabits = habits.filter((h) => h.habitType !== "deep");
  const deepHabits = habits.filter((h) => h.habitType === "deep");

  const todayStr2 = today.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // Long-press detection for adding habit
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPress = useRef(false);

  const handlePressStart = (e: React.MouseEvent | React.TouchEvent, identifier?: string) => {
    // Don't trigger on buttons or interactive elements
    const target = e.currentTarget as HTMLElement;
    if (target.closest("button")) return;
    
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      onAddClick();
    }, 1500);
  };

  const handlePressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
      longPressTimers.current.forEach(timer => clearTimeout(timer));
    };
  }, []);

  const handleHabitPressStart = (habitId: string) => {
    const timer = setTimeout(() => {
      onEditClick(habitId);
    }, 1500);
    longPressTimers.current.set(habitId, timer);
  };

  const handleHabitPressEnd = (habitId: string) => {
    const timer = longPressTimers.current.get(habitId);
    if (timer) {
      clearTimeout(timer);
      longPressTimers.current.delete(habitId);
    }
  };

  const handleHeaderPressStart = () => {
    const timer = setTimeout(() => {
      onAddClick();
    }, 1500);
    longPressTimers.current.set("header", timer);
  };

  const handleHeaderPressEnd = () => {
    const timer = longPressTimers.current.get("header");
    if (timer) {
      clearTimeout(timer);
      longPressTimers.current.delete("header");
    }
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="border-b border-border/30 px-4 sm:px-6 py-5">
        <div className="flex items-start justify-between gap-2">
          <div
            onMouseDown={handleHeaderPressStart}
            onMouseUp={handleHeaderPressEnd}
            onMouseLeave={handleHeaderPressEnd}
            onTouchStart={handleHeaderPressStart}
            onTouchEnd={handleHeaderPressEnd}
            className="cursor-pointer select-none transition-opacity hover:opacity-70 active:opacity-70 flex-1 min-w-0"
          >
            <h2 className="font-black text-lg sm:text-xl text-foreground truncate">
              Mis hábitos de hoy
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground capitalize truncate">
              {todayStr2.charAt(0).toUpperCase() + todayStr2.slice(1)}
            </p>
          </div>
          <div className="text-right text-xs text-muted-foreground leading-relaxed flex-shrink-0">
            <div className="font-medium text-foreground text-xs sm:text-sm">{weekRange}</div>
            <div className="text-xs">esta semana</div>
          </div>
        </div>
      </div>

      {/* Habits List: separadas en Mini tareas (rápidas) y Deep tareas (más largas/infrecuentes) */}
      <div className="px-3 sm:px-5 py-3 flex flex-col gap-4 max-h-80 overflow-y-auto">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando hábitos...</p>
        ) : habits.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No tienes hábitos aún. ¡Crea uno para empezar!
          </p>
        ) : (
          <>
            {miniHabits.length > 0 && (
              <div className="flex flex-col gap-2 sm:gap-1.5">
                <h3 className="text-xs font-bold uppercase tracking-wide text-purple-700 dark:text-purple-400">
                  ⚡ Mini tareas
                </h3>
                {miniHabits.map((habit) => (
                  <HabitCard
                    key={habit.id}
                    habit={habit}
                    today={today}
                    todayStr={todayStr}
                    weekDays={weekDays}
                    onToggle={onToggle}
                    onDetailed={onDetailed}
                    onFreeze={onFreeze}
                    onPressStart={handleHabitPressStart}
                    onPressEnd={handleHabitPressEnd}
                  />
                ))}
              </div>
            )}

            {deepHabits.length > 0 && (
              <div className="flex flex-col gap-2 sm:gap-1.5">
                <h3 className="text-xs font-bold uppercase tracking-wide text-teal-700 dark:text-teal-400">
                  🌊 Deep tareas
                </h3>
                {deepHabits.map((habit) => (
                  <HabitCard
                    key={habit.id}
                    habit={habit}
                    today={today}
                    todayStr={todayStr}
                    weekDays={weekDays}
                    onToggle={onToggle}
                    onDetailed={onDetailed}
                    onFreeze={onFreeze}
                    onPressStart={handleHabitPressStart}
                    onPressEnd={handleHabitPressEnd}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border/30 flex items-center justify-between px-4 sm:px-6 py-3 gap-2 sm:gap-3">
        <div className="text-xs sm:text-sm text-muted-foreground">
          <strong className="font-bold text-foreground">{doneCount}</strong> / {habits.length}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onArchived}
            className="inline-flex items-center justify-center rounded-full bg-purple-500/20 p-2 text-purple-700 hover:opacity-80 dark:text-purple-400 active:opacity-60 transition-colors touch-manipulation h-9 w-9 sm:h-auto"
            title="Archivados"
          >
            <Swords className="h-4 w-4" />
          </button>
          <button
            onClick={onHistory}
            className="inline-flex items-center justify-center rounded-full bg-purple-500/20 p-2 text-purple-700 hover:opacity-80 dark:text-purple-400 active:opacity-60 transition-colors touch-manipulation h-9 w-9 sm:h-auto"
            title="Historial"
          >
            <Eye className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function HistoryPanel({
  habits,
  currentDate,
  onMonthChange,
  onBack,
}: {
  habits: HabitData[];
  currentDate: Date;
  onMonthChange: (delta: number) => void;
  onBack: () => void;
}) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const dim = new Date(year, month + 1, 0).getDate();

  const getFirstDayOfMonth = (date: Date) => {
    const firstDow = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    return firstDow === 0 ? 6 : firstDow - 1;
  };

  // Filter habits that were active in this month
  // A habit is active if it has no endDate or if its endDate is >= the first day of the month
  const firstDayOfMonth = new Date(year, month, 1);
  firstDayOfMonth.setHours(0, 0, 0, 0);
  
  const activeHabits = habits.filter((habit) => {
    if (!habit.endDate) return true; // No end date = always active
    const endDate = new Date(habit.endDate + "T00:00:00");
    endDate.setHours(0, 0, 0, 0);
    return endDate >= firstDayOfMonth; // Show if ended on or after the first day of this month
  });

  const offset = getFirstDayOfMonth(currentDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="border-b border-border/30 flex items-center gap-3 px-4 sm:px-6 py-4">
        <button
          onClick={onBack}
          className="flex h-9 w-9 sm:h-7 sm:w-7 items-center justify-center rounded-full border border-border/30 bg-muted hover:bg-muted/80 active:bg-muted/60 transition-colors touch-manipulation flex-shrink-0"
        >
          <ArrowLeft className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-muted-foreground" />
        </button>
        <h2 className="font-black text-base sm:text-lg text-foreground flex-1 truncate">Historial general</h2>
        <p className="text-xs text-muted-foreground ml-auto flex-shrink-0">Todos</p>
      </div>

      {/* Month Navigation */}
      <div className="border-b border-border/30 flex items-center justify-between px-4 sm:px-6 py-2.5 gap-2">
        <button
          onClick={() => onMonthChange(-1)}
          className="flex h-9 w-9 sm:h-7 sm:w-7 items-center justify-center rounded border border-border/30 bg-muted hover:bg-muted/80 active:bg-muted/60 transition-colors touch-manipulation flex-shrink-0"
        >
          <ChevronLeft className="h-4 w-4 sm:h-4 sm:w-4 text-muted-foreground" />
        </button>
        <span className="font-bold text-xs sm:text-sm text-foreground capitalize flex-1 text-center">
          {MONTHS[month]} {year}
        </span>
        <button
          onClick={() => onMonthChange(1)}
          className="flex h-9 w-9 sm:h-7 sm:w-7 items-center justify-center rounded border border-border/30 bg-muted hover:bg-muted/80 active:bg-muted/60 transition-colors touch-manipulation flex-shrink-0"
        >
          <ChevronRight className="h-4 w-4 sm:h-4 sm:w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Calendar */}
      <div className="px-3 sm:px-5 py-3">
        <div className="grid grid-cols-7 gap-1 sm:gap-1">
          {DAY_LBLS.map((lbl) => (
            <div
              key={lbl}
              className="text-center text-xs font-medium text-muted-foreground uppercase mb-1"
            >
              {lbl}
            </div>
          ))}

          {Array.from({ length: offset }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}

          {Array.from({ length: dim }).map((_, d) => {
            const day = d + 1;
            const dateStr = `${year}-${String(month + 1).padStart(
              2,
              "0"
            )}-${String(day).padStart(2, "0")}`;
            const dObj = new Date(dateStr + "T12:00:00");
            dObj.setHours(0, 0, 0, 0);
            const isFuture = dObj > today;
            const isToday = dateStr === getLocalDateString(today);

            const doneCount = activeHabits.filter((h) => h.done.has(dateStr)).length;
            const allDone = doneCount === activeHabits.length && activeHabits.length > 0;

            return (
              <div
                key={day}
                className={`relative aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-medium cursor-pointer transition-all active:scale-95 ${
                  allDone
                    ? "bg-purple-500/20"
                    : isFuture
                      ? "opacity-20"
                      : "bg-muted/30"
                } ${isToday ? "ring-2 ring-purple-500" : ""}`}
              >
                <div
                  className={`font-medium ${
                    isToday ? "text-purple-600 dark:text-purple-400" : ""
                  }`}
                >
                  {day}
                </div>
                {allDone && !isFuture && (
                  <div className="text-xs font-bold text-purple-600 dark:text-purple-400">
                    ✓✓
                  </div>
                )}
                {doneCount > 0 && !allDone && !isFuture && (
                  <div className="flex gap-1 flex-wrap justify-center max-w-full">
                    {activeHabits
                      .filter((h) => h.done.has(dateStr))
                      .map((h, i) => (
                        <div
                          key={h.id}
                          className="h-1.5 w-1.5 rounded-full"
                          style={{
                            background:
                              COLORS[activeHabits.indexOf(h) % COLORS.length],
                          }}
                        />
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="border-t border-border/30 flex flex-wrap gap-2 px-4 sm:px-5 py-3">
        {activeHabits.map((habit, i) => (
          <div
            key={habit.id}
            className="flex items-center gap-1 text-xs text-muted-foreground"
          >
            <div
              className="h-2 w-2 rounded-full"
              style={{ background: COLORS[i % COLORS.length] }}
            />
            <span>
              {habit.emoji} {habit.name}
            </span>
          </div>
        ))}
        {activeHabits.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <div className="h-2 w-2 rounded-full bg-purple-500/30 border border-purple-500" />
            <span>Todos</span>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailPanel({
  habit,
  currentDate,
  onMonthChange,
  onBack,
  onToggleDate,
}: {
  habit?: HabitData;
  currentDate: Date;
  onMonthChange: (delta: number) => void;
  onBack: () => void;
  onToggleDate: (date: string) => void;
}) {
  if (!habit) return null;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const dim = new Date(year, month + 1, 0).getDate();

  const getFirstDayOfMonth = (date: Date) => {
    const firstDow = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    return firstDow === 0 ? 6 : firstDow - 1;
  };

  const offset = getFirstDayOfMonth(currentDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Misma lógica que el resto de los paneles (computeStreakGlobal/computeBestStreakFromRecords):
  // antes esta vista recalculaba la racha con una copia local que ignoraba los días congelados,
  // lo que la desalineaba de "Mejor racha" mostrada en la lista principal.
  const streak = computeStreakGlobal(habit.done, habit.scheduledDays, today, habit.frozenDates);
  const broken = isStreakBrokenGlobal(habit.done, habit.scheduledDays, today, habit.frozenDates);
  const bestStreak = broken ? habit.bestStreak : Math.max(streak, habit.bestStreak);
  const doneInMonth = Array.from(habit.done).filter(
    (d) => d.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`)
  ).length;
  const percentThisMonth = Math.round((doneInMonth / dim) * 100);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="border-b border-border/30 flex items-center gap-3 px-4 sm:px-6 py-4">
        <button
          onClick={onBack}
          className="flex h-9 w-9 sm:h-7 sm:w-7 items-center justify-center rounded-full border border-border/30 bg-muted hover:bg-muted/80 active:bg-muted/60 transition-colors touch-manipulation flex-shrink-0"
        >
          <ArrowLeft className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-muted-foreground" />
        </button>
        <h2 className="font-black text-base sm:text-lg text-foreground flex-1 truncate">
          {habit.emoji} {habit.name}
        </h2>
      </div>

      {/* Stats */}
      <div className="border-b border-border/30 flex gap-2 px-3 sm:px-5 py-3">
        <div className="flex-1 rounded-xl bg-muted/50 px-2 sm:px-3 py-2 text-center">
          <div className="font-black text-lg sm:text-xl text-foreground">{streak}</div>
          <div className="text-xs text-muted-foreground uppercase">Racha</div>
        </div>
        <div className="flex-1 rounded-xl bg-muted/50 px-2 sm:px-3 py-2 text-center">
          <div className="font-black text-lg sm:text-xl text-foreground">
            {bestStreak}
          </div>
          <div className="text-xs text-muted-foreground uppercase">Mejor</div>
        </div>
        <div className="flex-1 rounded-xl bg-muted/50 px-2 sm:px-3 py-2 text-center">
          <div className="font-black text-lg sm:text-xl text-foreground">
            {percentThisMonth}%
          </div>
          <div className="text-xs text-muted-foreground uppercase">Mes</div>
        </div>
      </div>

      {/* Month Navigation */}
      <div className="border-b border-border/30 flex items-center justify-between px-4 sm:px-6 py-2.5 gap-2">
        <button
          onClick={() => onMonthChange(-1)}
          className="flex h-9 w-9 sm:h-7 sm:w-7 items-center justify-center rounded border border-border/30 bg-muted hover:bg-muted/80 active:bg-muted/60 transition-colors touch-manipulation flex-shrink-0"
        >
          <ChevronLeft className="h-4 w-4 sm:h-4 sm:w-4 text-muted-foreground" />
        </button>
        <span className="font-bold text-xs sm:text-sm text-foreground capitalize">
          {MONTHS[month]} {year}
        </span>
        <button
          onClick={() => onMonthChange(1)}
          className="flex h-9 w-9 sm:h-7 sm:w-7 items-center justify-center rounded border border-border/30 bg-muted hover:bg-muted/80 active:bg-muted/60 transition-colors touch-manipulation flex-shrink-0"
        >
          <ChevronRight className="h-4 w-4 sm:h-4 sm:w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Calendar */}
      <div className="px-3 sm:px-5 py-3">
        <div className="grid grid-cols-7 gap-1">
          {DAY_LBLS.map((lbl) => (
            <div
              key={lbl}
              className="text-center text-xs font-medium text-muted-foreground uppercase mb-1"
            >
              {lbl}
            </div>
          ))}

          {Array.from({ length: offset }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}

          {Array.from({ length: dim }).map((_, d) => {
            const day = d + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dObj = new Date(dateStr + "T12:00:00");
            dObj.setHours(0, 0, 0, 0);
            const isFuture = dObj > today;
            const isToday = dateStr === getLocalDateString(today);
            const isDone = habit.done.has(dateStr);
            const isPastMissed = dObj < today && !isDone && !isToday;

            return (
              <div
                key={day}
                onClick={() => {
                  if (!isFuture) onToggleDate(dateStr);
                }}
                className={`relative aspect-square rounded-lg flex items-center justify-center text-xs font-medium transition-all ${
                  isFuture
                    ? "opacity-20 cursor-default"
                    : "cursor-pointer active:scale-95"
                } ${
                  isDone
                    ? "bg-gray-900"
                    : isToday && !isDone
                      ? "ring-2 ring-purple-500"
                      : isPastMissed
                        ? "bg-muted/50 border-dashed border border-border/50 opacity-50 hover:opacity-75"
                        : ""
                }`}
              >
                {isDone ? (
                  <span className="text-base">🔥</span>
                ) : (
                  <span
                    className={`${
                      isToday ? "text-purple-600 dark:text-purple-400 font-bold" : "text-muted-foreground"
                    }`}
                  >
                    {day}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="h-2" />
    </div>
  );
}

function AddPanel({
  emoji,
  name,
  endDate,
  areaId,
  projectId,
  skillId,
  bodyLinks,
  areas,
  projects,
  skills,
  onEmojiChange,
  onNameChange,
  onEndDateChange,
  onAreaIdChange,
  onProjectIdChange,
  onSkillIdChange,
  onBodyLinksChange,
  scheduledDays,
  onScheduledDaysChange,
  habitType,
  onHabitTypeChange,
  onBack,
  onSubmit,
  isLoading,
}: {
  emoji: string;
  name: string;
  endDate: string;
  areaId: string | null;
  projectId: string | null;
  skillId: string | null;
  bodyLinks: BodyLink[];
  areas: Area[];
  projects: Project[];
  skills: any[];
  onEmojiChange: (emoji: string) => void;
  onNameChange: (name: string) => void;
  onEndDateChange: (date: string) => void;
  onAreaIdChange: (id: string | null) => void;
  onProjectIdChange: (id: string | null) => void;
  onSkillIdChange: (id: string | null) => void;
  onBodyLinksChange: (links: BodyLink[]) => void;
  scheduledDays: number[];
  onScheduledDaysChange: (days: number[]) => void;
  habitType: "mini" | "deep";
  onHabitTypeChange: (type: "mini" | "deep") => void;
  onBack: () => void;
  onSubmit: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="w-full">
      {/* Header */}
      <div className="border-b border-border/30 px-4 sm:px-6 py-5">
        <div className="flex items-start gap-3 sm:gap-4">
          <button
            onClick={onBack}
            disabled={isLoading}
            className="flex-shrink-0 mt-0.5 sm:mt-1 rounded hover:bg-muted p-1.5 sm:p-1 transition-colors disabled:opacity-50 h-8 w-8 sm:h-auto sm:w-auto touch-manipulation"
          >
            <ArrowLeft className="h-5 w-5 sm:h-5 sm:w-5 text-muted-foreground" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="font-black text-lg sm:text-xl text-foreground">
              Nuevo hábito
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
              Crea un nuevo hábito para rastrear
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="px-4 sm:px-6 py-5 flex flex-col gap-4 max-h-[calc(100vh-300px)] overflow-y-auto">
        {/* Emoji Input */}
        <div>
          <label className="text-xs font-semibold text-foreground uppercase tracking-wide">
            Emoji
          </label>
          <input
            type="text"
            maxLength={2}
            value={emoji}
            onChange={(e) => onEmojiChange(e.target.value)}
            placeholder="⭐"
            disabled={isLoading}
            className="mt-2 w-full px-3 py-2.5 text-lg text-center border border-border/50 rounded-lg bg-background hover:border-border focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all touch-manipulation"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Selecciona un emoji para tu hábito
          </p>
        </div>

        {/* Name Input */}
        <div>
          <label className="text-xs font-semibold text-foreground uppercase tracking-wide">
            Nombre *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Ej: Meditar"
            disabled={isLoading}
            className="mt-2 w-full px-3 py-2.5 border border-border/50 rounded-lg bg-background hover:border-border focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm touch-manipulation"
            required
          />
          <p className="mt-1 text-xs text-muted-foreground">
            El nombre es obligatorio
          </p>
        </div>

        {/* Habit Type Selector */}
        <div>
          <label className="text-xs font-semibold text-foreground uppercase tracking-wide">
            Tipo de hábito *
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              onClick={() => onHabitTypeChange("mini")}
              disabled={isLoading}
              className={`py-2.5 px-2 rounded-lg font-semibold text-xs sm:text-sm transition-all active:scale-95 touch-manipulation ${
                habitType === "mini"
                  ? "bg-purple-600 text-white border-2 border-purple-600"
                  : "border-2 border-border/30 bg-background text-foreground hover:border-purple-400"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              ⚡ Mini
            </button>
            <button
              onClick={() => onHabitTypeChange("deep")}
              disabled={isLoading}
              className={`py-2.5 px-2 rounded-lg font-semibold text-xs sm:text-sm transition-all active:scale-95 touch-manipulation ${
                habitType === "deep"
                  ? "bg-teal-600 text-white border-2 border-teal-600"
                  : "border-2 border-border/30 bg-background text-foreground hover:border-teal-400"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              🌊 Deep
            </button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Mini: rápido, casi diario. Deep: lleva más tiempo, unas pocas veces por semana.
          </p>
        </div>

        {/* End Date Input */}
        <div>
          <label className="text-xs font-semibold text-foreground uppercase tracking-wide">
            Hasta cuándo
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            disabled={isLoading}
            className="mt-2 w-full px-3 py-2.5 border border-border/50 rounded-lg bg-background hover:border-border focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm touch-manipulation"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Opcional: define una fecha límite para el hábito
          </p>
        </div>

        {/* Scheduled Days Selector */}
        <div>
          <label className="text-xs font-semibold text-foreground uppercase tracking-wide">
            Días de la semana *
          </label>
          <div className="mt-2 grid grid-cols-7 gap-1.5">
            {["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"].map((day, index) => (
              <button
                key={index}
                onClick={() => {
                  const newDays = scheduledDays.includes(index)
                    ? scheduledDays.filter((d) => d !== index)
                    : [...scheduledDays, index];
                  if (newDays.length > 0) {
                    onScheduledDaysChange(newDays.sort((a, b) => a - b));
                  }
                }}
                disabled={isLoading || (scheduledDays.length === 1 && scheduledDays.includes(index))}
                className={`py-2.5 sm:py-2 px-1 rounded-lg font-semibold text-xs sm:text-sm transition-all active:scale-95 touch-manipulation ${
                  scheduledDays.includes(index)
                    ? "bg-purple-600 text-white border-2 border-purple-600"
                    : "border-2 border-border/30 bg-background text-foreground hover:border-purple-400"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {day}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Selecciona al menos un día para rastrear el hábito
          </p>
        </div>

        {/* Area Select */}
        <div>
          <label className="text-xs font-semibold text-foreground uppercase tracking-wide">
            Área
          </label>
          <select
            value={areaId || ""}
            onChange={(e) => onAreaIdChange(e.target.value || null)}
            disabled={isLoading}
            className="mt-2 w-full px-3 py-2.5 border border-border/50 rounded-lg bg-background hover:border-border focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm appearance-none cursor-pointer touch-manipulation"
          >
            <option value="">Sin área asignada</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.icon} {area.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            Opcional: vincular el hábito a un área
          </p>
        </div>

        {/* Project Select */}
        <div>
          <label className="text-xs font-semibold text-foreground uppercase tracking-wide">
            Proyecto
          </label>
          <select
            value={projectId || ""}
            onChange={(e) => onProjectIdChange(e.target.value || null)}
            disabled={isLoading}
            className="mt-2 w-full px-3 py-2.5 border border-border/50 rounded-lg bg-background hover:border-border focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm appearance-none cursor-pointer touch-manipulation"
          >
            <option value="">Sin proyecto asignado</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.icon} {project.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            Opcional: vincular el hábito a un proyecto
          </p>
        </div>

        {/* Skill Select */}
        <div>
          <label className="text-xs font-semibold text-foreground uppercase tracking-wide">
            Skill a linkear
          </label>
          <select
            value={skillId || ""}
            onChange={(e) => onSkillIdChange(e.target.value || null)}
            disabled={isLoading}
            className="mt-2 w-full px-3 py-2.5 border border-border/50 rounded-lg bg-background hover:border-border focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm appearance-none cursor-pointer touch-manipulation"
          >
            <option value="">Sin skill asignado</option>
            {skills.map((skill) => (
              <option key={skill.id} value={skill.id}>
                {skill.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            Opcional: linkear a un skill para sumar XP al completar
          </p>
        </div>

        {/* Body Component Select */}
        <div>
          <label className="text-xs font-semibold text-foreground uppercase tracking-wide">
            Componente corporal a linkear
          </label>
          <BodyLinkPicker value={bodyLinks} onChange={onBodyLinksChange} disabled={isLoading} />
          <p className="mt-1 text-xs text-muted-foreground">
            Opcional: linkear a uno o más componentes de fuerza/flexibilidad para hacerlos crecer al completar
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border/30 px-4 sm:px-6 py-3.5 sm:py-4 flex gap-3">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={isLoading}
          className="flex-1 h-10 sm:h-auto touch-manipulation"
        >
          Cancelar
        </Button>
        <Button
          onClick={onSubmit}
          disabled={isLoading || !name.trim()}
          className="flex-1 h-10 sm:h-auto bg-purple-600 hover:bg-purple-700 text-white touch-manipulation"
        >
          {isLoading ? "Creando..." : "Crear hábito"}
        </Button>
      </div>
    </div>
  );
}

function EditPanel({
  habitId,
  emoji,
  name,
  endDate,
  areaId,
  projectId,
  skillId,
  bodyLinks,
  areas,
  projects,
  skills,
  onEmojiChange,
  onNameChange,
  onEndDateChange,
  onAreaIdChange,
  onProjectIdChange,
  onSkillIdChange,
  onBodyLinksChange,
  scheduledDays,
  onScheduledDaysChange,
  habitType,
  onHabitTypeChange,
  onBack,
  onSubmit,
  onDelete,
  isLoading,
}: {
  habitId: string;
  emoji: string;
  name: string;
  endDate: string;
  areaId: string | null;
  projectId: string | null;
  skillId: string | null;
  bodyLinks: BodyLink[];
  areas: Area[];
  projects: Project[];
  skills: any[];
  onEmojiChange: (emoji: string) => void;
  onNameChange: (name: string) => void;
  onEndDateChange: (date: string) => void;
  onAreaIdChange: (id: string | null) => void;
  onProjectIdChange: (id: string | null) => void;
  onSkillIdChange: (id: string | null) => void;
  onBodyLinksChange: (links: BodyLink[]) => void;
  scheduledDays: number[];
  onScheduledDaysChange: (days: number[]) => void;
  habitType: "mini" | "deep";
  onHabitTypeChange: (type: "mini" | "deep") => void;
  onBack: () => void;
  onSubmit: () => void;
  onDelete: () => void;
  isLoading: boolean;
}) {
  return (
    <div className="w-full">
      {/* Header */}
      <div className="border-b border-border/30 px-4 sm:px-6 py-5">
        <div className="flex items-start gap-3 sm:gap-4">
          <button
            onClick={onBack}
            disabled={isLoading}
            className="flex-shrink-0 mt-0.5 sm:mt-1 rounded hover:bg-muted p-1.5 sm:p-1 transition-colors disabled:opacity-50 h-8 w-8 sm:h-auto sm:w-auto touch-manipulation"
          >
            <ArrowLeft className="h-5 w-5 sm:h-5 sm:w-5 text-muted-foreground" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="font-black text-lg sm:text-xl text-foreground">
              Editar hábito
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
              Actualiza los detalles de tu hábito
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="px-4 sm:px-6 py-5 flex flex-col gap-4 max-h-[calc(100vh-300px)] overflow-y-auto">
        {/* Emoji Input */}
        <div>
          <label className="text-xs font-semibold text-foreground uppercase tracking-wide">
            Emoji
          </label>
          <input
            type="text"
            maxLength={2}
            value={emoji}
            onChange={(e) => onEmojiChange(e.target.value)}
            placeholder="⭐"
            disabled={isLoading}
            className="mt-2 w-full px-3 py-2.5 text-lg text-center border border-border/50 rounded-lg bg-background hover:border-border focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all touch-manipulation"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Selecciona un emoji para tu hábito
          </p>
        </div>

        {/* Name Input */}
        <div>
          <label className="text-xs font-semibold text-foreground uppercase tracking-wide">
            Nombre *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Ej: Meditar"
            disabled={isLoading}
            className="mt-2 w-full px-3 py-2.5 border border-border/50 rounded-lg bg-background hover:border-border focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm touch-manipulation"
            required
          />
        </div>

        {/* Habit Type Selector */}
        <div>
          <label className="text-xs font-semibold text-foreground uppercase tracking-wide">
            Tipo de hábito *
          </label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              onClick={() => onHabitTypeChange("mini")}
              disabled={isLoading}
              className={`py-2.5 px-2 rounded-lg font-semibold text-xs sm:text-sm transition-all active:scale-95 touch-manipulation ${
                habitType === "mini"
                  ? "bg-purple-600 text-white border-2 border-purple-600"
                  : "border-2 border-border/30 bg-background text-foreground hover:border-purple-400"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              ⚡ Mini
            </button>
            <button
              onClick={() => onHabitTypeChange("deep")}
              disabled={isLoading}
              className={`py-2.5 px-2 rounded-lg font-semibold text-xs sm:text-sm transition-all active:scale-95 touch-manipulation ${
                habitType === "deep"
                  ? "bg-teal-600 text-white border-2 border-teal-600"
                  : "border-2 border-border/30 bg-background text-foreground hover:border-teal-400"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              🌊 Deep
            </button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Mini: rápido, casi diario. Deep: lleva más tiempo, unas pocas veces por semana.
          </p>
        </div>

        {/* End Date Input */}
        <div>
          <label className="text-xs font-semibold text-foreground uppercase tracking-wide">
            Hasta cuándo
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            disabled={isLoading}
            className="mt-2 w-full px-3 py-2.5 border border-border/50 rounded-lg bg-background hover:border-border focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm touch-manipulation"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Opcional: define una fecha límite para el hábito
          </p>
        </div>

        {/* Scheduled Days Selector */}
        <div>
          <label className="text-xs font-semibold text-foreground uppercase tracking-wide">
            Días de la semana *
          </label>
          <div className="mt-2 grid grid-cols-7 gap-1.5">
            {["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"].map((day, index) => (
              <button
                key={index}
                onClick={() => {
                  const newDays = scheduledDays.includes(index)
                    ? scheduledDays.filter((d) => d !== index)
                    : [...scheduledDays, index];
                  if (newDays.length > 0) {
                    onScheduledDaysChange(newDays.sort((a, b) => a - b));
                  }
                }}
                disabled={isLoading || (scheduledDays.length === 1 && scheduledDays.includes(index))}
                className={`py-2.5 sm:py-2 px-1 rounded-lg font-semibold text-xs sm:text-sm transition-all active:scale-95 touch-manipulation ${ 
                  scheduledDays.includes(index)
                    ? "bg-purple-600 text-white border-2 border-purple-600"
                    : "border-2 border-border/30 bg-background text-foreground hover:border-purple-400"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {day}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Selecciona al menos un día para rastrear el hábito
          </p>
        </div>

        {/* Area Select */}
        <div>
          <label className="text-xs font-semibold text-foreground uppercase tracking-wide">
            Área
          </label>
          <select
            value={areaId || ""}
            onChange={(e) => onAreaIdChange(e.target.value || null)}
            disabled={isLoading}
            className="mt-2 w-full px-3 py-2.5 border border-border/50 rounded-lg bg-background hover:border-border focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm appearance-none cursor-pointer touch-manipulation"
          >
            <option value="">Sin área asignada</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.icon} {area.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            Opcional: vincular el hábito a un área
          </p>
        </div>

        {/* Project Select */}
        <div>
          <label className="text-xs font-semibold text-foreground uppercase tracking-wide">
            Proyecto
          </label>
          <select
            value={projectId || ""}
            onChange={(e) => onProjectIdChange(e.target.value || null)}
            disabled={isLoading}
            className="mt-2 w-full px-3 py-2.5 border border-border/50 rounded-lg bg-background hover:border-border focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm appearance-none cursor-pointer touch-manipulation"
          >
            <option value="">Sin proyecto asignado</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.icon} {project.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            Opcional: vincular el hábito a un proyecto
          </p>
        </div>

        {/* Skill Select */}
        <div>
          <label className="text-xs font-semibold text-foreground uppercase tracking-wide">
            Skill a linkear
          </label>
          <select
            value={skillId || ""}
            onChange={(e) => onSkillIdChange(e.target.value || null)}
            disabled={isLoading}
            className="mt-2 w-full px-3 py-2.5 border border-border/50 rounded-lg bg-background hover:border-border focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-sm appearance-none cursor-pointer touch-manipulation"
          >
            <option value="">Sin skill asignado</option>
            {skills.map((skill) => (
              <option key={skill.id} value={skill.id}>
                {skill.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            Opcional: linkear a un skill para sumar XP al completar
          </p>
        </div>

        {/* Body Component Select */}
        <div>
          <label className="text-xs font-semibold text-foreground uppercase tracking-wide">
            Componente corporal a linkear
          </label>
          <BodyLinkPicker value={bodyLinks} onChange={onBodyLinksChange} disabled={isLoading} />
          <p className="mt-1 text-xs text-muted-foreground">
            Opcional: linkear a uno o más componentes de fuerza/flexibilidad para hacerlos crecer al completar
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border/30 px-4 sm:px-6 py-3.5 sm:py-4 flex gap-2 sm:gap-3">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={isLoading}
          className="flex-1 h-10 sm:h-auto touch-manipulation"
        >
          Cancelar
        </Button>
        <Button
          variant="destructive"
          onClick={onDelete}
          disabled={isLoading}
          className="flex-1 h-10 sm:h-auto touch-manipulation"
          title="Eliminar este hábito permanentemente"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Eliminar</span>
        </Button>
        <Button
          onClick={onSubmit}
          disabled={isLoading || !name.trim()}
          className="flex-1 h-10 sm:h-auto bg-purple-600 hover:bg-purple-700 text-white touch-manipulation"
        >
          {isLoading ? "Actualizando..." : "Guardar"}
        </Button>
      </div>
    </div>
  );
}

function ArchivedPanel({
  habits,
  onBack,
  onDetailClick,
  editingId,
  editingDate,
  onEditingDateChange,
  onLongPress,
  onSaveDate,
  onCancelEdit,
}: {
  habits: HabitData[];
  onBack: () => void;
  onDetailClick: (habitId: string) => void;
  editingId: string | null;
  editingDate: string;
  onEditingDateChange: (date: string) => void;
  onLongPress: (habitId: string) => void;
  onSaveDate: () => Promise<void>;
  onCancelEdit: () => void;
}) {
  const longPressTimers = useRef<Record<string, NodeJS.Timeout>>({});

  const handleHabitPressStart = (habitId: string) => {
    const timer = setTimeout(() => {
      onLongPress(habitId);
    }, 500);
    longPressTimers.current[habitId] = timer;
  };

  const handleHabitPressEnd = (habitId: string) => {
    const timer = longPressTimers.current[habitId];
    if (timer) {
      clearTimeout(timer);
      delete longPressTimers.current[habitId];
    }
  };

  useEffect(() => {
    return () => {
      Object.values(longPressTimers.current).forEach(timer => clearTimeout(timer));
    };
  }, []);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="border-b border-yellow-500/30 px-4 sm:px-6 py-5 bg-gradient-to-r from-yellow-500/5 to-amber-500/5">
        <div className="flex items-start gap-3 sm:gap-4">
          <button
            onClick={onBack}
            className="flex-shrink-0 mt-0.5 sm:mt-1 rounded hover:bg-yellow-500/10 p-1.5 sm:p-1 transition-colors h-8 w-8 sm:h-auto sm:w-auto touch-manipulation"
          >
            <ArrowLeft className="h-5 w-5 sm:h-5 sm:w-5 text-yellow-600 dark:text-yellow-400" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="font-black text-base sm:text-lg text-yellow-700 dark:text-yellow-300 flex items-center gap-2 flex-wrap">
              <span>⚔️ Conquistados</span>
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-yellow-600/70 dark:text-yellow-400/70">
              ¡Felicidades! Superaste estos desafíos
            </p>
          </div>
        </div>
      </div>

      {/* Habits List */}
      <div className="px-3 sm:px-5 py-3 flex flex-col gap-2 max-h-80 overflow-y-auto">
        {!habits || habits.length === 0 ? (
          <p className="text-sm text-yellow-600/70 dark:text-yellow-400/70 py-4">
            No hay hábitos archivados
          </p>
        ) : (
          habits.map((habit) => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const streak = computeStreakGlobal(habit.done, habit.scheduledDays, today, habit.frozenDates);
            const broken = isStreakBrokenGlobal(habit.done, habit.scheduledDays, today, habit.frozenDates);
            const displayBestStreak = broken ? habit.bestStreak : Math.max(streak, habit.bestStreak);
            const isEditing = editingId === habit.id;
            
            return (
              <div
                key={habit.id}
                onMouseDown={() => handleHabitPressStart(habit.id)}
                onMouseUp={() => handleHabitPressEnd(habit.id)}
                onMouseLeave={() => handleHabitPressEnd(habit.id)}
                onTouchStart={() => handleHabitPressStart(habit.id)}
                onTouchEnd={() => handleHabitPressEnd(habit.id)}
                onTouchCancel={() => handleHabitPressEnd(habit.id)}
              >
                {isEditing ? (
                  <div className="rounded-2xl border-2 border-yellow-400 px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-br from-yellow-500/30 via-amber-500/20 to-yellow-500/20 shadow-md">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl sm:text-2xl flex-shrink-0 drop-shadow">{habit.emoji}</span>
                        <span className="font-black text-xs sm:text-sm text-yellow-900 dark:text-yellow-100 flex-1 truncate">
                          {habit.name}
                        </span>
                      </div>
                      <div className="pl-7 sm:pl-11">
                        <Input
                          type="date"
                          value={editingDate}
                          onChange={(e) => onEditingDateChange(e.target.value)}
                          className="bg-yellow-100 dark:bg-yellow-900/40 border-yellow-300 text-yellow-900 dark:text-yellow-100 h-9 text-sm"
                        />
                      </div>
                      <div className="pl-7 sm:pl-11 flex gap-2">
                        <Button
                          onClick={async () => {
                            try {
                              await onSaveDate();
                            } catch (error) {
                              console.error("Error saving archived date:", error);
                            }
                          }}
                          size="sm"
                          className="flex-1 h-8 bg-green-600 hover:bg-green-700 text-white text-xs"
                        >
                          Guardar
                        </Button>
                        <Button
                          onClick={onCancelEdit}
                          size="sm"
                          variant="outline"
                          className="flex-1 h-8 border-yellow-300 text-yellow-700 dark:text-yellow-300 text-xs"
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => onDetailClick(habit.id)}
                    className="w-full text-left rounded-2xl border-2 border-yellow-400/50 px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-br from-yellow-500/20 via-amber-500/10 to-yellow-500/10 hover:border-yellow-400 hover:from-yellow-500/30 hover:via-amber-500/20 active:scale-95 transition-all shadow-md hover:shadow-lg hover:shadow-yellow-500/20 touch-manipulation"
                  >
                    <div className="flex items-center gap-2 sm:gap-3 mb-1.5 sm:mb-2 flex-wrap">
                      <span className="text-xl sm:text-2xl flex-shrink-0 drop-shadow">{habit.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <span className="font-black text-xs sm:text-sm text-yellow-900 dark:text-yellow-100 block truncate">
                          {habit.name}
                        </span>
                        <span className="text-xs text-yellow-700/80 dark:text-yellow-300/80">
                          Terminó: {new Date(habit.endDate!).toLocaleDateString("es-AR")}
                        </span>
                      </div>
                    </div>
                    <div className="pl-7 sm:pl-11 flex items-center gap-1.5 sm:gap-2 text-xs text-yellow-700/70 dark:text-yellow-300/70">
                      <span className="font-semibold">Racha:</span>
                      <span className="font-black text-yellow-800 dark:text-yellow-200">{displayBestStreak} 🔥</span>
                    </div>
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-yellow-500/20 px-4 sm:px-6 py-3 sm:py-4 bg-yellow-50/30 dark:bg-yellow-950/20">
        <Button
          variant="outline"
          onClick={onBack}
          className="w-full h-10 sm:h-auto border-yellow-400/50 hover:border-yellow-400 hover:bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 touch-manipulation"
        >
          Volver
        </Button>
      </div>
    </div>
  );
}

function ArchivedDetailPanel({
  habit,
  currentDate,
  onMonthChange,
  onBack,
}: {
  habit?: HabitData;
  currentDate: Date;
  onMonthChange: (delta: number) => void;
  onBack: () => void;
}) {
  if (!habit) return null;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const dim = new Date(year, month + 1, 0).getDate();

  const getFirstDayOfMonth = (date: Date) => {
    const firstDow = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    return firstDow === 0 ? 6 : firstDow - 1;
  };

  const offset = getFirstDayOfMonth(currentDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Calculate display best streak
  const streak = computeStreakGlobal(habit.done, habit.scheduledDays, today, habit.frozenDates);
  const broken = isStreakBrokenGlobal(habit.done, habit.scheduledDays, today, habit.frozenDates);
  const displayBestStreak = broken ? habit.bestStreak : Math.max(streak, habit.bestStreak);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="border-b border-yellow-500/30 px-4 sm:px-6 py-4 bg-gradient-to-r from-yellow-500/10 to-amber-500/5">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onBack}
            className="flex h-8 w-8 sm:h-7 sm:w-7 items-center justify-center rounded-full border border-yellow-400/50 bg-yellow-500/10 hover:bg-yellow-500/20 transition-colors touch-manipulation flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-yellow-600 dark:text-yellow-400" />
          </button>
          <h2 className="font-black text-base sm:text-lg text-yellow-900 dark:text-yellow-100 flex-1 truncate">
            {habit.emoji} {habit.name}
          </h2>
          <span className="text-lg sm:text-2xl flex-shrink-0">🏆</span>
        </div>
      </div>

      {/* Stats */}
      <div className="border-b border-yellow-500/20 flex gap-2 px-3 sm:px-5 py-3 bg-yellow-50/30 dark:bg-yellow-950/10">
        <div className="flex-1 rounded-xl bg-gradient-to-br from-yellow-400/30 to-amber-400/20 px-2 sm:px-3 py-2 text-center border border-yellow-300/30">
          <div className="font-black text-lg sm:text-xl text-yellow-900 dark:text-yellow-100">{displayBestStreak}</div>
          <div className="text-xs text-yellow-700/80 dark:text-yellow-300/80 uppercase font-semibold">Racha</div>
        </div>
        <div className="flex-1 rounded-xl bg-gradient-to-br from-yellow-500/20 to-amber-500/10 px-2 sm:px-3 py-2 text-center border border-yellow-300/30">
          <div className="font-black text-lg sm:text-xl text-yellow-900 dark:text-yellow-100">
            {habit.done.size}
          </div>
          <div className="text-xs text-yellow-700/80 dark:text-yellow-300/80 uppercase font-semibold">Conquistados</div>
        </div>
        <div className="flex-1 rounded-xl bg-gradient-to-br from-yellow-400/25 to-amber-400/15 px-2 sm:px-3 py-2 text-center border border-yellow-300/30">
          <div className="font-black text-lg sm:text-xl text-yellow-900 dark:text-yellow-100 text-sm sm:text-base">
            {new Date(habit.endDate!).toLocaleDateString("es-AR")}
          </div>
          <div className="text-xs text-yellow-700/80 dark:text-yellow-300/80 uppercase font-semibold">Fin</div>
        </div>
      </div>

      {/* Month Navigation */}
      <div className="border-b border-yellow-500/20 flex items-center justify-between px-4 sm:px-6 py-2.5 gap-2">
        <button
          onClick={() => onMonthChange(-1)}
          className="flex h-8 w-8 sm:h-7 sm:w-7 items-center justify-center rounded border border-yellow-400/50 bg-yellow-500/10 hover:bg-yellow-500/20 active:bg-yellow-500/30 transition-colors touch-manipulation flex-shrink-0"
        >
          <ChevronLeft className="h-4 w-4 sm:h-4 sm:w-4 text-yellow-600 dark:text-yellow-400" />
        </button>
        <span className="font-bold text-xs sm:text-sm text-yellow-900 dark:text-yellow-100 capitalize flex-1 text-center">
          {MONTHS[month]} {year}
        </span>
        <button
          onClick={() => onMonthChange(1)}
          className="flex h-8 w-8 sm:h-7 sm:w-7 items-center justify-center rounded border border-yellow-400/50 bg-yellow-500/10 hover:bg-yellow-500/20 active:bg-yellow-500/30 transition-colors touch-manipulation flex-shrink-0"
        >
          <ChevronRight className="h-4 w-4 sm:h-4 sm:w-4 text-yellow-600 dark:text-yellow-400" />
        </button>
      </div>

      {/* Calendar */}
      <div className="px-3 sm:px-5 py-3 bg-yellow-50/20 dark:bg-yellow-950/10">
        <div className="grid grid-cols-7 gap-1">
          {DAY_LBLS.map((lbl) => (
            <div
              key={lbl}
              className="text-center text-xs font-bold text-yellow-700 dark:text-yellow-300 uppercase mb-1"
            >
              {lbl}
            </div>
          ))}

          {Array.from({ length: offset }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}

          {Array.from({ length: dim }).map((_, d) => {
            const day = d + 1;
            const dateStr = `${year}-${String(month + 1).padStart(
              2,
              "0"
            )}-${String(day).padStart(2, "0")}`;
            const dObj = new Date(dateStr + "T12:00:00");
            dObj.setHours(0, 0, 0, 0);
            const isDone = habit.done.has(dateStr);

            return (
              <div
                key={day}
                className={`relative aspect-square rounded-lg flex items-center justify-center text-xs font-black transition-all cursor-pointer active:scale-95 ${
                  isDone
                    ? "bg-gradient-to-br from-yellow-500 to-amber-500 text-white shadow-md shadow-yellow-500/30 border border-yellow-400"
                    : "bg-yellow-100/30 dark:bg-yellow-900/20 border border-yellow-300/30 text-yellow-700 dark:text-yellow-300"
                }`}
              >
                {isDone ? (
                  <span className="text-base">🔥</span>
                ) : (
                  <span>{day}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="h-2" />
    </div>
  );
}
