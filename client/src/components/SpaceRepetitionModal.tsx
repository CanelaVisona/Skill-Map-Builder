import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { ArrowLeft, Plus, Trash2, Archive } from "lucide-react";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { useBodyProgress, BODY_LINK_OPTIONS, parseBodyLink, type BodyLinkValue } from "@/lib/body-progress-context";
import { useBodyGainPopup } from "@/lib/body-gain-popup-context";
import { useXpPopup } from "@/lib/xp-popup-context";

interface SpaceRepetitionPractice {
  id: string;
  name: string;
  emoji: string;
  startDate: string;
  completedIntervals: number[];
  level?: 1 | 2;
  level1CompletedDate?: string | null;
  completedIntervalsL2?: number[];
  lostIntervals?: number[];
  bodyZone?: string | null;
  bodyDimension?: string | null;
}

interface ArchivedPractice {
  id: string;
  name: string;
  emoji: string;
  startDate: string;
  endDate: string;
  totalDays: number;
}

interface SpaceRepetitionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Level 1 intervals (6 checkpoints)
const INTERVALS_L1 = [0, 1, 3, 7, 16, 30];
const LABELS_L1 = ["D0", "D1", "D3", "D7", "D16", "D30"];

// Level 2 intervals (6 checkpoints) - long term retention
const INTERVALS_L2 = [45, 60, 90, 120, 180, 270];
const LABELS_L2 = ["D45", "D60", "D90", "D120", "D180", "D270"];

// Backward compatibility
const INTERVALS = INTERVALS_L1;
const INTERVAL_LABELS = LABELS_L1;

// Helper functions to get appropriate intervals based on practice level
function getIntervalsForPractice(practice: SpaceRepetitionPractice): number[] {
  return (practice.level === 2) ? INTERVALS_L2 : INTERVALS_L1;
}

function getLabelsForPractice(practice: SpaceRepetitionPractice): string[] {
  return (practice.level === 2) ? LABELS_L2 : LABELS_L1;
}

function getReferenceDate(practice: SpaceRepetitionPractice): string {
  return (practice.level === 2 && practice.level1CompletedDate) 
    ? practice.level1CompletedDate 
    : practice.startDate;
}

function getCompletedIntervals(practice: SpaceRepetitionPractice): number[] {
  return (practice.level === 2) ? (practice.completedIntervalsL2 || []) : practice.completedIntervals;
}

function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function calculateDaysSince(startDateStr: string): number {
  // Parsear la fecha en formato local (YYYY-MM-DD) para evitar problemas de zona horaria
  const [year, month, day] = startDateStr.split('-').map(Number);
  // Crear fecha a medianoche en zona horaria local del usuario
  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  
  // Obtener hoy a medianoche en zona horaria local
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
  
  // Calcular diferencia de días desde medianoche local
  const diff = todayMidnight.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatTimeRemaining(daysRemaining: number): string {
  if (daysRemaining > 2) {
    return `${daysRemaining} días`;
  }
  if (daysRemaining === 1) {
    return "tomorrow";
  }
  // If 0 or negative, calculate hours, minutes and seconds until midnight
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  const msUntilMidnight = midnight.getTime() - now.getTime();
  const diff = Math.floor(msUntilMidnight / 1000);
  const hours = String(Math.floor(diff / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
  const seconds = String(diff % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

type PracticeStatus = "waiting" | "expires_soon" | "loss" | "frozen" | "complete" | "level2_waiting";

function calculateStatus(practice: SpaceRepetitionPractice): PracticeStatus {
  const level = practice.level || 1;
  
  // Handle L2 special case
  if (level === 2 && practice.level1CompletedDate) {
    return calculateStatusL2(practice);
  }

  const daysSince = calculateDaysSince(practice.startDate);
  const completedIndices = new Set(practice.completedIntervals);

  // If never registered anything, cannot be in loss or frozen
  if (practice.completedIntervals.length === 0) {
    if (daysSince === 0) return "expires_soon"; // D0 due today
    if (daysSince <= 2) return "expires_soon";  // still in window
    return "waiting"; // waiting for first registration, no penalty
  }

  for (let i = 0; i < INTERVALS_L1.length; i++) {
    if (!completedIndices.has(i)) {
      const targetDay = INTERVALS_L1[i];
      const daysUntilDue = targetDay - daysSince;
      const daysAfterDue = daysSince - targetDay;

      // More than 2 days before due
      if (daysUntilDue > 2) {
        return "waiting";
      }
      // 0-2 days before due or on due day
      else if (daysUntilDue >= 0) {
        return "expires_soon";
      }
      // 1-2 days after due
      else if (daysAfterDue <= 2) {
        return "loss";
      }
      // 3+ days after due
      else if (daysAfterDue > 2) {
        return "frozen";
      }
    }
  }

  return "complete";
}

function calculateStatusL2(practice: SpaceRepetitionPractice): PracticeStatus {
  // If L1 not complete, shouldn't reach here
  if (practice.level !== 2 || !practice.level1CompletedDate) {
    return calculateStatus({ ...practice, level: 1 });
  }

  const daysSinceL1Complete = calculateDaysSince(practice.level1CompletedDate);
  
  // If <15 days since L1 completion
  if (daysSinceL1Complete < 15) {
    return "level2_waiting";
  }

  // L2 has started, apply same logic as L1
  const completedIndicesL2 = new Set((practice.completedIntervalsL2 || []).map(Number));

  for (let i = 0; i < INTERVALS_L2.length; i++) {
    if (!completedIndicesL2.has(i)) {
      const targetDay = INTERVALS_L2[i];
      const daysUntilDue = targetDay - daysSinceL1Complete;
      const daysAfterDue = daysSinceL1Complete - targetDay;

      if (daysUntilDue > 2) {
        return "waiting";
      } else if (daysUntilDue >= 0) {
        return "expires_soon";
      } else if (daysAfterDue <= 2) {
        return "loss";
      } else if (daysAfterDue > 2) {
        return "frozen";
      }
    }
  }

  return "complete";
}


function getNextIntervalIndex(practice: SpaceRepetitionPractice): number {
  const level = practice.level || 1;
  const intervals = (level === 2) ? INTERVALS_L2 : INTERVALS_L1;
  const completedIndices = new Set(getCompletedIntervals(practice));
  for (let i = 0; i < intervals.length; i++) {
    if (!completedIndices.has(i)) {
      return i;
    }
  }
  return -1;
}

function daysUntilNextInterval(practice: SpaceRepetitionPractice): number {
  const nextIdx = getNextIntervalIndex(practice);
  if (nextIdx === -1) return 0;
  
  const level = practice.level || 1;
  const intervals = (level === 2) ? INTERVALS_L2 : INTERVALS_L1;
  const referenceDate = getReferenceDate(practice);
  const daysSince = calculateDaysSince(referenceDate);
  const targetDay = intervals[nextIdx];
  return Math.max(0, targetDay - daysSince);
}

function getStateColor(status: PracticeStatus): string {
  switch (status) {
    case "waiting":
      return "bg-blue-500/20 border-blue-500 text-blue-700 dark:text-blue-400";
    case "expires_soon":
      return "bg-yellow-500/20 border-yellow-500 text-yellow-700 dark:text-yellow-400";
    case "loss":
      return "bg-pink-500/20 border-pink-500 text-pink-700 dark:text-pink-400";
    case "frozen":
      return "bg-[#cce8f4]/20 border-[#a8d8ea] text-[#4a9abb] dark:text-[#4a9abb]";
    case "complete":
      return "bg-green-500/20 border-green-500 text-green-700 dark:text-green-400";
    case "level2_waiting":
      return "bg-indigo-500/20 border-indigo-500 text-indigo-700 dark:text-indigo-400";
    default:
      return "";
  }
}

function getStateLabel(status: PracticeStatus): string {
  switch (status) {
    case "waiting":
      return "⏳ Esperando";
    case "expires_soon":
      return "⚠️ Próximo a vencer";
    case "loss":
      return "📉 Pérdida de progreso";
    case "frozen":
      return "❄️ Congelado";
    case "complete":
      return "✅ Completado";
    case "level2_waiting":
      return "💜 Esperando L2";
  }
}

function formatTimeMessage(status: PracticeStatus, practice: SpaceRepetitionPractice): string {
  const nextIdx = getNextIntervalIndex(practice);
  if (nextIdx === -1) return "";

  const level = practice.level || 1;
  const intervals = (level === 2) ? INTERVALS_L2 : INTERVALS_L1;
  const referenceDate = getReferenceDate(practice);
  const daysSince = calculateDaysSince(referenceDate);
  const targetDay = intervals[nextIdx];
  const daysUntilDue = targetDay - daysSince;
  const timeRemaining = formatTimeRemaining(daysUntilDue);

  switch (status) {
    case "waiting":
      return `Transfer available in: ${timeRemaining}`;
    case "expires_soon":
      return `Transfer expires in: ${timeRemaining}`;
    case "loss":
      return `Loss of progress in: ${timeRemaining}`;
    case "level2_waiting":
      return `Next level starts in: ${timeRemaining}`;
    case "frozen":
    case "complete":
    default:
      return "";
  }
}

function getStatusMessage(practice: SpaceRepetitionPractice, status: PracticeStatus): string {
  return formatTimeMessage(status, practice);
}

interface StorageData {
  practices: SpaceRepetitionPractice[];
  archived: ArchivedPractice[];
}

// Hook para detectar long press
function useLongPress(callback: () => void, duration = 500) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [isPressed, setIsPressed] = useState(false);
  const MOVE_THRESHOLD = 10; // pixels

  const clearPress = () => {
    setIsPressed(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const startPress = () => {
    setIsPressed(true);
    timeoutRef.current = setTimeout(() => {
      callback();
      setIsPressed(false);
    }, duration);
  };

  // Mouse events
  const handleMouseDown = () => {
    startPress();
  };

  const handleMouseUp = () => {
    clearPress();
  };

  const handleMouseLeave = () => {
    clearPress();
  };

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    startPress();
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartRef.current.y);
    
    // Si se movió más del threshold, cancelar el long press
    if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) {
      clearPress();
    }
  };

  const handleTouchEnd = () => {
    touchStartRef.current = null;
    clearPress();
  };

  const handleTouchCancel = () => {
    touchStartRef.current = null;
    clearPress();
  };

  return {
    onMouseDown: handleMouseDown,
    onMouseUp: handleMouseUp,
    onMouseLeave: handleMouseLeave,
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    onTouchCancel: handleTouchCancel,
    isPressed,
  };
}

export function SpaceRepetitionModal({
  open,
  onOpenChange,
}: SpaceRepetitionModalProps) {
  const [currentPanel, setCurrentPanel] = useState<"main" | "add" | "detail" | "archived">("main");
  const [practices, setPractices] = useState<SpaceRepetitionPractice[]>([]);
  const [archived, setArchived] = useState<ArchivedPractice[]>([]);
  const [selectedPracticeId, setSelectedPracticeId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("💪");
  const [newBodyLink, setNewBodyLink] = useState<BodyLinkValue>("");
  const [notification, setNotification] = useState<string | null>(null);
  const { theme } = useTheme();
  const { addBodyBlock } = useBodyProgress();
  const { showBodyGainPopup } = useBodyGainPopup();
  const { hideXpPopup } = useXpPopup();

  // Muestra el pop-up de crecimiento corporal para el componente linkeado a la práctica.
  const growLinkedBody = (bodyZone: string | null | undefined, bodyDimension: string | null | undefined) => {
    const link = parseBodyLink(bodyZone && bodyDimension ? `${bodyZone}:${bodyDimension}` : null);
    if (!link) return;
    const { before, after } = addBodyBlock(link.zone, link.dimension);
    hideXpPopup();
    showBodyGainPopup({ zone: link.zone, dimension: link.dimension, before, after });
  };

  // Función para migrar datos de localStorage a la API
  const migrateLocalStorageData = async () => {
    try {
      const stored = localStorage.getItem("sr_habits_v2");
      if (!stored) return; // No hay datos para migrar

      const data = JSON.parse(stored) as StorageData;
      if (!data.practices || data.practices.length === 0) return; // No hay prácticas para migrar

      // Migrar cada práctica a la API
      let migratedCount = 0;
      for (const practice of data.practices) {
        try {
          const res = await fetch("/api/space-repetition", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: practice.name,
              emoji: practice.emoji,
              startDate: practice.startDate,
              completedIntervals: practice.completedIntervals,
            }),
          });
          if (res.ok) {
            migratedCount++;
          }
        } catch (e) {
          console.error("Error migrating practice:", e);
        }
      }

      // Si se migraron prácticas, limpiar localStorage y mostrar notificación
      if (migratedCount > 0) {
        localStorage.removeItem("sr_habits_v2");
        setNotification(`✨ ${migratedCount} práctica${migratedCount > 1 ? "s" : ""} migrada${migratedCount > 1 ? "s" : ""}!`);
      }
    } catch (error) {
      console.error("Error during migration:", error);
    }
  };

  useEffect(() => {
    if (open) {
      migrateLocalStorageData();
      loadPractices();
    }
  }, [open]);

  const loadPractices = async () => {
    try {
      const res = await fetch("/api/space-repetition");
      if (!res.ok) throw new Error("Error loading practices");
      const data = await res.json();
      setPractices(data);
    } catch (error) {
      console.error("Error loading practices:", error);
    }
  };

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const savePractices = (updated: SpaceRepetitionPractice[], archivedUpdated?: ArchivedPractice[]) => {
    setPractices(updated);
    if (archivedUpdated) setArchived(archivedUpdated);
  };

  const addPractice = async () => {
    if (!newName.trim()) return;
    try {
      const res = await fetch("/api/space-repetition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          emoji: newEmoji || "💪",
          startDate: getLocalDateString(),
          completedIntervals: [],
          bodyZone: parseBodyLink(newBodyLink)?.zone ?? null,
          bodyDimension: parseBodyLink(newBodyLink)?.dimension ?? null,
        })
      });
      if (!res.ok) throw new Error("Error creating practice");
      const newPractice = await res.json();
      setPractices([...practices, newPractice]);
      setNewName("");
      setNewEmoji("💪");
      setNewBodyLink("");
      setCurrentPanel("main");
    } catch (error) {
      console.error("Error adding practice:", error);
    }
  };

  const deletePractice = async (id: string) => {
    try {
      const res = await fetch(`/api/space-repetition/${id}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("Error deleting practice");
      setPractices(practices.filter((p) => p.id !== id));
    } catch (error) {
      console.error("Error deleting practice:", error);
    }
  };

  const toggleInterval = async (practiceId: string, intervalIndex: number) => {
    try {
      const practice = practices.find((p) => p.id === practiceId);
      if (!practice) return;

      const level = practice.level || 1;

      // Handle Level 2 intervals
      if (level === 2) {
        const intervalsL2 = new Set(practice.completedIntervalsL2 || []);
        intervalsL2.add(intervalIndex);
        const newCompletedL2 = Array.from(intervalsL2).sort();

        // Check if all L2 intervals are completed
        if (newCompletedL2.length === INTERVALS_L2.length) {
          // Archive when L2 is complete
          const res = await fetch(`/api/space-repetition/${practiceId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              completedIntervalsL2: newCompletedL2,
              archived: 1,
              endDate: getLocalDateString(),
              lostIntervals: [],
            })
          });
          if (!res.ok) throw new Error("Error updating practice");
          const updated = await res.json();
          
          setPractices(practices.filter((p) => p.id !== practiceId));
          setArchived([...archived, {
            id: practice.id,
            name: practice.name,
            emoji: practice.emoji,
            startDate: practice.startDate,
            endDate: getLocalDateString(),
            totalDays: calculateDaysSince(practice.startDate),
          }]);
          setNotification("🏆 ¡Nivel 2 completado y archivado!");
          growLinkedBody(practice.bodyZone, practice.bodyDimension);
          return;
        }

        // Regular L2 interval update
        const res = await fetch(`/api/space-repetition/${practiceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            completedIntervalsL2: newCompletedL2,
            lostIntervals: [],
          })
        });
        if (!res.ok) throw new Error("Error updating practice");
        const updated = await res.json();

        setPractices(practices.map((p) => p.id === practiceId ? updated : p));
        growLinkedBody(practice.bodyZone, practice.bodyDimension);
        return;
      }

      // Handle Level 1 intervals
      const intervals = new Set(practice.completedIntervals);
      intervals.add(intervalIndex);
      const newCompleted = Array.from(intervals).sort();

      // Check if all L1 intervals are completed
      if (newCompleted.length === INTERVALS_L1.length) {
        // Transition to Level 2 instead of archiving
        const res = await fetch(`/api/space-repetition/${practiceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            completedIntervals: newCompleted,
            level: 2,
            level1CompletedDate: getLocalDateString(),
            completedIntervalsL2: [],
            lostIntervals: [],
          })
        });
        if (!res.ok) throw new Error("Error updating practice");
        const updated = await res.json();
        
        setPractices(practices.map((p) => p.id === practiceId ? updated : p));
        setNotification("🎉 ¡Nivel 1 completado! Iniciando Nivel 2");
        growLinkedBody(practice.bodyZone, practice.bodyDimension);
        return;
      }

      // Regular interval update
      const res = await fetch(`/api/space-repetition/${practiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          completedIntervals: newCompleted,
          lostIntervals: [],
        })
      });
      if (!res.ok) throw new Error("Error updating practice");
      const updated = await res.json();

      setPractices(practices.map((p) => p.id === practiceId ? updated : p));
      growLinkedBody(practice.bodyZone, practice.bodyDimension);
    } catch (error) {
      console.error("Error toggling interval:", error);
    }
  };

  const handleExpiredReset = async (practiceId: string) => {
    try {
      const res = await fetch(`/api/space-repetition/${practiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: getLocalDateString(),
          completedIntervals: [],
        })
      });
      if (!res.ok) throw new Error("Error resetting practice");
      const updated = await res.json();
      
      setPractices(practices.map((p) => p.id === practiceId ? updated : p));
      setNotification("🔄 ¡Práctica reiniciada!");
    } catch (error) {
      console.error("Error resetting practice:", error);
    }
  };

  const handleRecover = async (practiceId: string) => {
    try {
      const practice = practices.find((p) => p.id === practiceId);
      if (!practice) return;

      const nextIdx = getNextIntervalIndex(practice);
      if (nextIdx === -1) return;

      const level = practice.level || 1;
      const intervals = (level === 2) ? INTERVALS_L2 : INTERVALS_L1;
      const targetIntervalDays = intervals[nextIdx];

      // Calculate new start date: today - interval days
      const today = new Date();
      const newDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - targetIntervalDays, 0, 0, 0, 0);
      const newDateStr = getLocalDateString(newDate);

      const updateData = level === 2 && practice.level1CompletedDate
        ? { level1CompletedDate: newDateStr }
        : { startDate: newDateStr };

      const res = await fetch(`/api/space-repetition/${practiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });
      if (!res.ok) throw new Error("Error recovering practice");
      const updated = await res.json();

      setPractices(practices.map((p) => p.id === practiceId ? updated : p));
      setNotification("🔥 ¡Práctica recuperada!");
    } catch (error) {
      console.error("Error recovering practice:", error);
    }
  };

  if (!open) return null;

  const selectedPractice = practices.find((p) => p.id === selectedPracticeId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 border-0 bg-background">
        <VisuallyHidden>
          <DialogTitle>Repetición Espaciada</DialogTitle>
          <DialogDescription>Gestiona tus prácticas con repetición espaciada</DialogDescription>
        </VisuallyHidden>
        <div className="overflow-hidden rounded-3xl border border-border/50">
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-green-500/20 border-b border-green-500/30 px-4 py-2 text-sm text-green-700 dark:text-green-400 text-center"
            >
              {notification}
            </motion.div>
          )}

          {currentPanel === "main" && (
            <MainPanel
              practices={practices}
              activeCount={practices.length}
              archivedCount={archived.length}
              onLongPressAdd={() => setCurrentPanel("add")}
              onDetail={(id) => {
                setSelectedPracticeId(id);
                setCurrentPanel("detail");
              }}
              onArchived={() => setCurrentPanel("archived")}
              onDelete={deletePractice}
              onRegister={(practiceId, intervalIdx) => {
                toggleInterval(practiceId, intervalIdx);
              }}
              onRecover={(practiceId) => handleRecover(practiceId)}
            />
          )}

          {currentPanel === "add" && (
            <AddPanel
              emoji={newEmoji}
              name={newName}
              bodyLink={newBodyLink}
              onEmojiChange={setNewEmoji}
              onNameChange={setNewName}
              onBodyLinkChange={setNewBodyLink}
              onBack={() => {
                setNewName("");
                setNewEmoji("💪");
                setNewBodyLink("");
                setCurrentPanel("main");
              }}
              onSubmit={addPractice}
            />
          )}

          {currentPanel === "detail" && selectedPractice && (
            <DetailPanel
              practice={selectedPractice}
              onBack={() => {
                setSelectedPracticeId(null);
                setCurrentPanel("main");
              }}
              onToggleInterval={(idx) => toggleInterval(selectedPractice.id, idx)}
              onReset={() => handleExpiredReset(selectedPractice.id)}
              onRecover={() => handleRecover(selectedPractice.id)}
            />
          )}

          {currentPanel === "archived" && (
            <ArchivedPanel
              archived={archived}
              onBack={() => setCurrentPanel("main")}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MainPanel({
  practices,
  activeCount,
  archivedCount,
  onLongPressAdd,
  onDetail,
  onArchived,
  onDelete,
  onRegister,
  onRecover,
}: {
  practices: SpaceRepetitionPractice[];
  activeCount: number;
  archivedCount: number;
  onLongPressAdd: () => void;
  onDetail: (id: string) => void;
  onArchived: () => void;
  onDelete: (id: string) => void;
  onRegister: (practiceId: string, intervalIdx: number) => void;
  onRecover: (practiceId: string) => void;
}) {
  const today = new Date();
  const todayStr = today.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const longPressHandler = useLongPress(onLongPressAdd, 3000);

  const practicesWithStatus = practices.map((p) => ({
    ...p,
    status: (p.level === 2) ? calculateStatusL2(p) : calculateStatus(p),
    nextIdx: getNextIntervalIndex(p),
  }));

  const pendingPractices = practicesWithStatus.filter(
    (p) => p.status === "expires_soon" || p.status === "loss" || p.status === "frozen"
  );

  return (
    <div className="w-full">
      {/* Header - Long press para agregar */}
      <div
        className="border-b border-border/30 px-6 py-5 cursor-pointer active:bg-muted/50 transition-colors"
        {...longPressHandler}
      >
        <h2 className="font-black text-xl text-foreground">Mis Repeticiones</h2>
        <p className="mt-1 text-sm text-muted-foreground capitalize">
          {todayStr.charAt(0).toUpperCase() + todayStr.slice(1)}
        </p>
      </div>

      {/* Practices List */}
      <div className="px-5 py-3 flex flex-col gap-2 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground/40">
        {practices.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No tienes prácticas aún. ¡Crea una para empezar!
          </p>
        ) : (
          <>
            {/* Pending Section */}
            {pendingPractices.length > 0 && (
              <div>
                <p className="text-xs font-bold text-muted-foreground mb-2 px-1">
                  PENDIENTES ({pendingPractices.length})
                </p>
                {pendingPractices.map((practice) => (
                  <PracticeCardWithLongPress
                    key={practice.id}
                    practice={practice}
                    onDetail={() => onDetail(practice.id)}
                    onDelete={() => onDelete(practice.id)}
                    onRegister={() => {
                      if (practice.nextIdx >= 0) {
                        onRegister(practice.id, practice.nextIdx);
                      }
                    }}
                    onRecover={() => onRecover(practice.id)}
                  />
                ))}
              </div>
            )}

            {/* Waiting Section */}
            {practicesWithStatus.filter((p) => p.status === "waiting").length > 0 && (
              <div>
                <p className="text-xs font-bold text-muted-foreground mb-2 px-1 mt-3">
                  EN ESPERA ({practicesWithStatus.filter((p) => p.status === "waiting").length})
                </p>
                {practicesWithStatus
                  .filter((p) => p.status === "waiting")
                  .map((practice) => {
                    const daysLeft = daysUntilNextInterval(practice);
                    return (
                      <PracticeWaitingCardWithLongPress
                        key={practice.id}
                        practice={practice}
                        daysLeft={daysLeft}
                        onDetail={() => onDetail(practice.id)}
                        onDelete={() => onDelete(practice.id)}
                      />
                    );
                  })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer Icon */}
      {archivedCount > 0 && (
        <div className="border-t border-border/30 px-5 py-3 flex justify-center">
          <motion.button
            onClick={onArchived}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="text-yellow-500 hover:text-yellow-400 transition-colors cursor-pointer"
            title={`Archivadas (${archivedCount})`}
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </motion.button>
        </div>
      )}
    </div>
  );
}

// Rock SVG Node Component
function RockNode() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="rockGrad" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#7a7a7a"/>
          <stop offset="40%" stopColor="#555"/>
          <stop offset="100%" stopColor="#2a2a2a"/>
        </radialGradient>
        <radialGradient id="rockHighlight" cx="30%" cy="25%" r="40%">
          <stop offset="0%" stopColor="#999" stopOpacity="0.4"/>
          <stop offset="100%" stopColor="#999" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <polygon points="5,20 3,13 7,5 14,3 21,4 25,10 26,18 22,24 14,26 7,25" fill="url(#rockGrad)" stroke="#3a3a3a" strokeWidth="1"/>
      <polygon points="5,20 3,13 7,5 14,3 21,4 25,10 26,18 22,24 14,26 7,25" fill="url(#rockHighlight)"/>
      <polyline points="11,5 13,10 10,15 12,22" fill="none" stroke="#1a1a1a" strokeWidth="1.2" strokeLinecap="round"/>
      <polyline points="13,10 17,12 20,11" fill="none" stroke="#1a1a1a" strokeWidth="0.8" strokeLinecap="round"/>
      <polyline points="10,15 7,17" fill="none" stroke="#222" strokeWidth="0.7" strokeLinecap="round"/>
      <polygon points="5,20 3,13 7,5 14,3 21,4 25,10 26,18 22,24 14,26 7,25" fill="none" stroke="#666" strokeWidth="0.5" opacity="0.4"/>
    </svg>
  );
}

function PracticeCardWithLongPress({
  practice,
  onDetail,
  onDelete,
  onRegister,
  onRecover,
}: {
  practice: SpaceRepetitionPractice & { status: PracticeStatus; nextIdx: number };
  onDetail: () => void;
  onDelete: () => void;
  onRegister: () => void;
  onRecover?: () => void;
}) {
  const [showDelete, setShowDelete] = useState(false);
  const [, setCurrentTime] = useState(Date.now());
  const longPressHandler = useLongPress(() => setShowDelete(true), 800);
  const completedIntervalsArray = Array.isArray(practice.completedIntervals)
    ? practice.completedIntervals
    : typeof practice.completedIntervals === "string"
    ? JSON.parse(practice.completedIntervals ?? "[]")
    : [];
  const completedSet = new Set<number>(completedIntervalsArray.map(Number));
  
  // Update countdown every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  
  // Determine card styling based on status with frozen priority
  const cardTint =
    practice.status === "frozen"
      ? "border-sky-400/70 bg-sky-400/20"
      : practice.status === "loss"
        ? "border-red-400/70 bg-red-400/20"
        : practice.status === "expires_soon"
          ? "border-yellow-400/70 bg-yellow-400/20"
          : practice.status === "waiting"
            ? "border-green-400/70 bg-green-400/20"
            : "border-border/30 bg-transparent";

  const cardHoverTint =
    practice.status === "frozen"
      ? "hover:border-sky-400/90 hover:bg-sky-400/30"
      : practice.status === "loss"
        ? "hover:border-red-400/90 hover:bg-red-400/30"
        : practice.status === "expires_soon"
          ? "hover:border-yellow-400/90 hover:bg-yellow-400/30"
          : practice.status === "waiting"
            ? "hover:border-green-400/90 hover:bg-green-400/30"
            : "hover:border-border/50";

  const cardActiveTint =
    practice.status === "frozen"
      ? "active:bg-sky-400/40"
      : practice.status === "loss"
        ? "active:bg-red-400/40"
        : practice.status === "expires_soon"
          ? "active:bg-yellow-400/40"
          : practice.status === "waiting"
            ? "active:bg-green-400/40"
            : "active:bg-muted/10";

  const handleClick = () => {
    if (!showDelete) {
      onDetail();
    }
  };

  const statusMessage = formatTimeMessage(practice.status, practice);
  const lostIntervals = Array.isArray(practice.lostIntervals)
    ? practice.lostIntervals
    : typeof practice.lostIntervals === "string"
    ? JSON.parse(practice.lostIntervals ?? "[]")
    : [];

  // Calculate days until next interval and show Well done message
  const nextIdx = getNextIntervalIndex(practice);
  const daysSince = calculateDaysSince(practice.startDate);
  const intervals = practice.level === 2 ? INTERVALS_L2 : INTERVALS_L1;
  const daysUntilDue = nextIdx >= 0 ? Math.max(0, intervals[nextIdx] - daysSince) : 0;
  const lastCompletedLabel = completedSet.size > 0
    ? LABELS_L1[[...completedSet].sort((a: number, b: number) => b - a)[0]]
    : null;
  const showWellDone = practice.status === "waiting" && daysUntilDue > 7 && lastCompletedLabel !== null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      {...longPressHandler}
      className={`rounded-2xl ${cardTint} px-3 py-2.5 mb-2 cursor-pointer ${cardHoverTint} transition-all ${cardActiveTint}`}
      onClick={handleClick}
    >
      {/* Header con nombre, emoji y level pill */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg flex-shrink-0">{practice.emoji}</span>
        <span className="font-bold text-sm text-foreground flex-1">{practice.name}</span>
        
        {/* Level pill */}
        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
          practice.level === 2 
            ? "bg-purple-500/30 text-purple-700 dark:text-purple-400" 
            : "bg-yellow-500/30 text-yellow-700 dark:text-yellow-400"
        }`}>
          L{practice.level || 1}
        </span>
      </div>

      {/* Status message */}
      {statusMessage && (
        <p className="text-xs text-muted-foreground mb-2 text-right">
          {statusMessage}
        </p>
      )}

      {/* Timeline compacta */}
      <div className="mb-3">
        <div className="relative pt-4 pb-3">
          {/* Nodes container */}
          <div className="relative flex justify-between items-center px-0">
            {INTERVALS.map((days, idx) => {
              const isDone = completedSet.has(idx);
              const isNext = idx === practice.nextIdx && (practice.status === "expires_soon" || practice.status === "loss" || practice.status === "frozen");
              const isFinal = idx === INTERVALS.length - 1;
              const isLost = lostIntervals.includes(idx);
              
              // Frozen flame only when status === "frozen" and node is completed
              const isFrozen = practice.status === "frozen" && isDone && idx < practice.nextIdx;

              return (
                <motion.div
                  key={idx}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex flex-col items-center flex-1"
                >
                  {/* Wrapper que centra la línea con el círculo */}
                  <div className="relative flex items-center justify-center w-full">
                    {/* Connection line to next node */}
                    {idx < INTERVALS.length - 1 && (
                      <div
                        className="absolute h-0.5 pointer-events-none"
                        style={{ left: "50%", width: "100%", zIndex: 0 }}
                      >
                        <div
                          className={`h-full w-full transition-all ${
                            isLost
                              ? "bg-gradient-to-r from-[#555555aa] to-[#333333aa]"
                              : practice.status === "frozen" && idx < practice.nextIdx
                                ? "bg-gradient-to-r from-[#38bdf8aa] to-[#0ea5e933]"
                                : completedSet.has(idx) && completedSet.has(idx + 1)
                                  ? "bg-green-500"
                                  : completedSet.has(idx)
                                    ? "bg-gradient-to-r from-green-500 to-border/30"
                                    : "bg-muted-foreground/25"
                          }`}
                          style={isLost ? { boxShadow: "0 0 4px rgba(51, 51, 51, 0.2)" } : (practice.status === "frozen" && idx < practice.nextIdx) ? { background: "linear-gradient(to right, #38bdf8aa, #0ea5e933)", boxShadow: "0 0 4px #38bdf833" } : {}}
                        />
                      </div>
                    )}

                    {/* Node */}
                    <div className="relative z-10">
                      {isLost ? (
                        <div className="w-6 h-6 flex items-center justify-center">
                          <RockNode />
                        </div>
                      ) : isFrozen ? (
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{
                          background: "linear-gradient(135deg, #0c2a4a 0%, #0e3460 100%)",
                          border: "2.5px solid #38bdf8",
                          boxShadow: "0 0 12px rgba(14, 165, 233, 0.4), 0 0 4px rgba(56, 189, 248, 0.73), inset 0 0 6px rgba(14, 165, 233, 0.13)"
                        }}>
                          <span style={{
                            filter: "hue-rotate(180deg) saturate(1.8) brightness(1.3)"
                          }}>🔥</span>
                        </div>
                      ) : isDone ? (
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-green-500/20 border-2 border-green-500">
                          ✓
                        </div>
                      ) : isNext ? (
                        <div>
                          <motion.div
                            animate={{ scale: [1, 1.1, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="absolute inset-0 rounded-full bg-yellow-500/30 border border-yellow-500/50"
                            style={{ width: 36, height: 36, top: -5.5, left: -5.5 }}
                          />
                          <div className="w-6 h-6 rounded-full bg-yellow-500/20 border-2 border-yellow-500 flex items-center justify-center text-base font-bold relative">
                            🔥
                          </div>
                        </div>
                      ) : isFinal ? (
                        <div className="w-6 h-6 rounded-full bg-muted border-2 border-muted-foreground/40 flex items-center justify-center text-xs">
                          🧠
                        </div>
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-muted border-2 border-muted-foreground/40" />
                      )}
                    </div>
                  </div>

                  {/* Label */}
                  <p className="text-xs font-bold text-muted-foreground mt-1 whitespace-nowrap">
                    {isFinal ? "D30" : INTERVAL_LABELS[idx]}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Botones */}
      {showDelete ? (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-2"
        >
          <Button
            onClick={(e) => {
              e.stopPropagation();
              setShowDelete(false);
            }}
            className="flex-1 rounded-xl bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-500/30 border border-yellow-500/50 text-xs h-8"
          >
            Cancelar
          </Button>
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="flex-1 rounded-xl bg-red-500/20 text-red-700 dark:text-red-400 hover:bg-red-500/30 border border-red-500/50 text-xs h-8"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Eliminar
          </Button>
        </motion.div>
      ) : showWellDone ? (
        <p className="text-center text-sm font-semibold text-green-400 py-1">
          🎉 Well done! You have finished {lastCompletedLabel}
        </p>
      ) : practice.status === "frozen" ? (
        <Button
          onClick={(e) => {
            e.stopPropagation();
            onRecover?.();
          }}
          className="w-full rounded-xl bg-[#cce8f4]/20 text-[#4a9abb] dark:text-[#4a9abb] hover:bg-[#cce8f4]/30 border border-[#a8d8ea] text-xs h-8"
        >
          🔥 Recover
        </Button>
      ) : practice.status === "loss" ? (
        <Button
          onClick={(e) => {
            e.stopPropagation();
            onRegister();
          }}
          className="w-full rounded-xl bg-red-500/20 text-red-700 dark:text-red-400 hover:bg-red-500/30 border border-red-500/50 text-xs h-8"
        >
          🔥 Registrar antes de perder progreso
        </Button>
      ) : practice.status === "expires_soon" ? (
        <Button
          onClick={(e) => {
            e.stopPropagation();
            onRegister();
          }}
          className="w-full rounded-xl bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-500/30 border border-yellow-500/50 text-xs h-8"
        >
          🔥 Continúa el progreso
        </Button>
      ) : null}
    </motion.div>
  );
}

function PracticeWaitingCardWithLongPress({
  practice,
  daysLeft,
  onDetail,
  onDelete,
}: {
  practice: SpaceRepetitionPractice & { status: PracticeStatus; nextIdx: number };
  daysLeft: number;
  onDetail: () => void;
  onDelete: () => void;
}) {
  const [showDelete, setShowDelete] = useState(false);
  const [, setCurrentTime] = useState(Date.now());
  const longPressHandler = useLongPress(() => setShowDelete(true), 800);
  
  // Update countdown every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  
  const intervals = practice.level === 2 ? INTERVALS_L2 : INTERVALS_L1;
  const labels = practice.level === 2 ? LABELS_L2 : LABELS_L1;
  const intervalsToUse = practice.level === 2 ? practice.completedIntervalsL2 : practice.completedIntervals;
  const intervalsArray: number[] = Array.isArray(intervalsToUse)
    ? intervalsToUse
    : typeof intervalsToUse === "string"
    ? JSON.parse(intervalsToUse ?? "[]") as number[]
    : [];
  const completedSet = new Set<number>(intervalsArray.map(Number));
  
  // Determine card styling based on status with frozen priority
  const cardTint =
    practice.status === "frozen"
      ? "border-sky-400/70 bg-sky-400/20"
      : practice.status === "loss"
        ? "border-red-400/70 bg-red-400/20"
        : practice.status === "expires_soon"
          ? "border-yellow-400/70 bg-yellow-400/20"
          : practice.status === "waiting"
            ? "border-green-400/70 bg-green-400/20"
            : "border-border/30 bg-transparent";

  const cardHoverTint =
    practice.status === "frozen"
      ? "hover:border-sky-400/90 hover:bg-sky-400/30"
      : practice.status === "loss"
        ? "hover:border-red-400/90 hover:bg-red-400/30"
        : practice.status === "expires_soon"
          ? "hover:border-yellow-400/90 hover:bg-yellow-400/30"
          : practice.status === "waiting"
            ? "hover:border-green-400/90 hover:bg-green-400/30"
            : "hover:border-border/50";

  const cardActiveTint =
    practice.status === "frozen"
      ? "active:bg-sky-400/40"
      : practice.status === "loss"
        ? "active:bg-red-400/40"
        : practice.status === "expires_soon"
          ? "active:bg-yellow-400/40"
          : practice.status === "waiting"
            ? "active:bg-green-400/40"
            : "active:bg-muted/10";

  const badgeBg = practice.status === "level2_waiting" ? "bg-indigo-500/30 text-indigo-700 dark:text-indigo-400" : "bg-blue-500/30 text-blue-700 dark:text-blue-400";
  const isLevel2Waiting = practice.status === "level2_waiting";

  const handleClick = () => {
    // No abrir el DetailPanel si estamos mostrando los botones de eliminar
    if (!showDelete) {
      onDetail();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      {...longPressHandler}
      className={`rounded-2xl border ${cardTint} px-3 py-2.5 mb-2 cursor-pointer ${cardHoverTint} transition-all ${cardActiveTint}`}
      onClick={handleClick}
    >
      {/* Header con nombre, emoji y level pill */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg flex-shrink-0">{practice.emoji}</span>
        <span className="font-bold text-sm text-foreground flex-1">{practice.name}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${practice.level === 2 ? "bg-purple-500/30 text-purple-700 dark:text-purple-400" : "bg-yellow-500/30 text-yellow-700 dark:text-yellow-400"}`}>
          L{practice.level}
        </span>
        <span className={`text-xs ${badgeBg} px-2 py-1 rounded-full font-bold`}>
          en {daysLeft}d
        </span>
      </div>

      {/* Timeline compacta */}
      <div className="mb-3">
        <div className="relative pt-4 pb-3">
          {/* Nodes container */}
          <div className="relative flex justify-between items-center px-0">
            {intervals.map((days, idx) => {
              const isDone = completedSet.has(idx);
              const isFinal = idx === intervals.length - 1;

              return (
                <motion.div
                  key={idx}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex flex-col items-center flex-1"
                >
                  {/* Wrapper que centra la línea con el círculo */}
                  <div className="relative flex items-center justify-center w-full">
                    {/* Connection line to next node */}
                    {idx < intervals.length - 1 && (
                      <div
                        className="absolute h-0.5 pointer-events-none"
                        style={{ left: "50%", width: "100%", zIndex: 0 }}
                      >
                        <div
                          className={`h-full w-full transition-all ${
                            completedSet.has(idx) && completedSet.has(idx + 1)
                              ? isLevel2Waiting ? "bg-indigo-500" : "bg-green-500"
                              : completedSet.has(idx)
                              ? isLevel2Waiting ? "bg-gradient-to-r from-indigo-500 to-border/30" : "bg-gradient-to-r from-green-500 to-border/30"
                              : "bg-muted-foreground/25"
                          }`}
                        />
                      </div>
                    )}

                    {/* Node */}
                    <div className="relative z-10">
                      {isDone ? (
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-1.5 ${isLevel2Waiting ? "bg-indigo-500/20 border-indigo-500" : "bg-green-500/20 border-green-500"}`}>
                          {isLevel2Waiting ? "🔒" : "✓"}
                        </div>
                      ) : isFinal ? (
                        <div className="w-6 h-6 rounded-full bg-muted border-2 border-muted-foreground/40 flex items-center justify-center text-xs">
                          🧠
                        </div>
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-muted border-2 border-muted-foreground/40" />
                      )}
                    </div>
                  </div>

                  {/* Label */}
                  <p className="text-xs font-bold text-muted-foreground mt-1 whitespace-nowrap">
                    {labels[idx]}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Botones de eliminar */}
      {showDelete && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-2"
        >
          <Button
            onClick={(e) => {
              e.stopPropagation();
              setShowDelete(false);
            }}
            className={`flex-1 rounded-xl border text-xs h-8 ${
              practice.status === "level2_waiting"
                ? "bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border-indigo-500/50 hover:bg-indigo-500/30"
                : "bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/50 hover:bg-green-500/30"
            }`}
          >
            Cancelar
          </Button>
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="flex-1 rounded-xl bg-red-500/20 text-red-700 dark:text-red-400 hover:bg-red-500/30 border border-red-500/50 text-xs h-8"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Eliminar
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}

function AddPanel({
  emoji,
  name,
  bodyLink,
  onEmojiChange,
  onNameChange,
  onBodyLinkChange,
  onBack,
  onSubmit,
}: {
  emoji: string;
  name: string;
  bodyLink: BodyLinkValue;
  onEmojiChange: (emoji: string) => void;
  onNameChange: (name: string) => void;
  onBodyLinkChange: (value: BodyLinkValue) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="w-full">
      {/* Header */}
      <div className="border-b border-border/30 px-6 py-5 flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="font-black text-xl text-foreground">Nueva Práctica</h2>
      </div>

      {/* Content */}
      <div className="px-6 py-5 flex flex-col gap-4">
        {/* Emoji Input */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Emoji
          </label>
          <div className="flex gap-2">
            <Input
              value={emoji}
              onChange={(e) => onEmojiChange(e.target.value.slice(0, 2))}
              className="text-xl font-black w-16 text-center h-10"
              maxLength={2}
            />
            <Input
              value={emoji}
              readOnly
              className="text-4xl font-black text-center h-10 flex-1 bg-muted"
            />
          </div>
        </div>

        {/* Name Input */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Nombre
          </label>
          <Input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Por ej: Vocabulario, Guitarra..."
            className="rounded-xl"
          />
        </div>

        {/* Body Component Select */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Componente corporal a linkear
          </label>
          <select
            value={bodyLink}
            onChange={(e) => onBodyLinkChange(e.target.value as BodyLinkValue)}
            className="w-full h-10 px-3 rounded-xl border border-border/50 bg-background text-foreground text-sm"
          >
            <option value="">Sin componente asignado</option>
            {BODY_LINK_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            Opcional: linkear a un componente de fuerza/flexibilidad para hacerlo crecer al registrar un intervalo
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-4">
          <Button
            onClick={onBack}
            variant="outline"
            className="flex-1 rounded-xl"
          >
            Cancelar
          </Button>
          <Button
            onClick={onSubmit}
            disabled={!name.trim()}
            className="flex-1 rounded-xl bg-purple-500 hover:bg-purple-600 text-white"
          >
            Crear
          </Button>
        </div>
      </div>
    </div>
  );
}

function DetailPanel({
  practice,
  onBack,
  onToggleInterval,
  onReset,
  onRecover,
}: {
  practice: SpaceRepetitionPractice;
  onBack: () => void;
  onToggleInterval: (index: number) => void;
  onReset: () => void;
  onRecover?: () => void;
}) {
  const status = practice.level === 2 ? calculateStatusL2(practice) : calculateStatus(practice);
  const refDate = practice.level === 2 && practice.level1CompletedDate ? practice.level1CompletedDate : practice.startDate;
  const daysSince = calculateDaysSince(refDate);
  const nextIntervalIdx = getNextIntervalIndex(practice);
  const intervals = practice.level === 2 ? INTERVALS_L2 : INTERVALS_L1;
  const intervalsToUse = practice.level === 2 ? practice.completedIntervalsL2 : practice.completedIntervals;
  const intervalsArray = Array.isArray(intervalsToUse)
    ? intervalsToUse
    : typeof intervalsToUse === "string"
    ? JSON.parse(intervalsToUse ?? "[]")
    : [];
  const progress = intervalsArray.length / intervals.length;
  const completedSet = new Set<number>(intervalsArray.map(Number));

  return (
    <div className="w-full">
      {/* Header */}
      <div className="border-b border-border/30 px-6 py-5 flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h2 className="font-black text-xl text-foreground flex items-center gap-2">
            <span>{practice.emoji}</span>
            <span>{practice.name}</span>
            <span className={`text-xs px-2 py-1 rounded-lg font-bold ${practice.level === 2 ? "bg-purple-500/20 text-purple-700 dark:text-purple-400" : "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400"}`}>
              L{practice.level}
            </span>
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {practice.level === 2 ? "L2 iniciado" : "Iniciado"} {refDate} ({daysSince} días)
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-5 flex flex-col gap-5">
        {/* Status Badge */}
        <div className={`rounded-2xl border px-4 py-3 text-center ${getStateColor(status)}`}>
          <p className="font-bold text-sm">{getStateLabel(status)}</p>
          {status === "expires_soon" && <p className="text-xs mt-1">Próximo a vencer, registra pronto</p>}
          {status === "loss" && <p className="text-xs mt-1">Progreso perdido, pero recuperable</p>}
          {status === "frozen" && <p className="text-xs mt-1">Congelado, requiere recuperación</p>}
          {status === "waiting" && <p className="text-xs mt-1">Espera el siguiente intervalo</p>}
          {status === "complete" && <p className="text-xs mt-1">¡Completada!</p>}
          {status === "level2_waiting" && <p className="text-xs mt-1">Esperando 15 días después de L1</p>}
        </div>

        {/* Timeline Visual */}
        <TimelineVisual practice={practice} completedSet={completedSet} />

        {/* Register Button */}
        {(status === "expires_soon" || status === "loss") && nextIntervalIdx >= 0 && (
          <Button
            onClick={() => onToggleInterval(nextIntervalIdx)}
            className="w-full rounded-xl bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-500/30 border border-yellow-500/50"
          >
            ⚠️ Registrar {INTERVAL_LABELS[nextIntervalIdx]}
          </Button>
        )}

        {status === "frozen" && nextIntervalIdx >= 0 && (
          <Button
            onClick={() => onRecover?.()}
            className="w-full rounded-xl bg-[#cce8f4]/20 text-[#4a9abb] dark:text-[#4a9abb] hover:bg-[#cce8f4]/30 border border-[#a8d8ea]"
          >
            ❄️ Recuperar
          </Button>
        )}
      </div>
    </div>
  );
}

function TimelineVisual({
  practice,
  completedSet,
}: {
  practice: SpaceRepetitionPractice;
  completedSet: Set<number>;
}) {
  const status = practice.level === 2 ? calculateStatusL2(practice) : calculateStatus(practice);
  const nextIdx = getNextIntervalIndex(practice);
  const intervals = practice.level === 2 ? INTERVALS_L2 : INTERVALS_L1;
  const labels = practice.level === 2 ? LABELS_L2 : LABELS_L1;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-foreground mb-3">Timeline</p>

        {/* Container with relative positioning for the timeline */}
        <div className="relative pt-8 pb-6">
          {/* Nodes container */}
          <div className="relative flex justify-between items-center px-0">
            {intervals.map((days, idx) => {
              const isDone = completedSet.has(idx);
              const isNext = idx === nextIdx && (status === "expires_soon" || status === "loss" || status === "frozen");
              const isFinal = idx === intervals.length - 1;
              const isLost = (practice.lostIntervals || []).includes(idx);
              
              // Frozen flame only when status === "frozen" and node is completed
              const isFrozen = status === "frozen" && isDone && idx < nextIdx;
              
              // Calculate days frozen for progressive opacity
              let daysFrozen = 0;
              if (isFrozen) {
                const refDate = practice.level === 2 && practice.level1CompletedDate ? practice.level1CompletedDate : practice.startDate;
                daysFrozen = calculateDaysSince(refDate) - intervals[idx];
              }
              
              // Opacity: 50% if 1-2 days frozen, 100% if 3+ days
              const frozenOpacity = daysFrozen >= 3 ? "opacity-100" : daysFrozen >= 1 ? "opacity-50" : "opacity-0";

              return (
                <motion.div
                  key={idx}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: idx * 0.1 }}
                  className="flex flex-col items-center flex-1"
                >
                  {/* Wrapper que centra la línea con el círculo */}
                  <div className="relative flex items-center justify-center w-full">
                    {/* Connection line to next node */}
                    {idx < INTERVALS.length - 1 && (
                      <div
                        className="absolute h-0.5 pointer-events-none"
                        style={{ left: "50%", width: "100%", zIndex: 0 }}
                      >
                        <div
                          className={`h-full w-full transition-all ${
                            isLost
                              ? "bg-gradient-to-r from-[#555555aa] to-[#333333aa]"
                              : status === "frozen" && idx < nextIdx
                                ? "bg-gradient-to-r from-[#38bdf8aa] to-[#0ea5e933]"
                                : completedSet.has(idx) && completedSet.has(idx + 1)
                                  ? "bg-gradient-to-r from-green-500 to-green-500"
                                  : completedSet.has(idx)
                                    ? "bg-gradient-to-r from-green-500 to-border/30"
                                    : "bg-muted-foreground/25"
                          }`}
                          style={isLost ? { boxShadow: "0 0 4px rgba(51, 51, 51, 0.2)" } : (status === "frozen" && idx < nextIdx) ? { background: "linear-gradient(to right, #38bdf8aa, #0ea5e933)", boxShadow: "0 0 4px #38bdf833" } : {}}
                        />
                      </div>
                    )}

                    {/* Node */}
                    <div className="relative z-10">
                      {isLost ? (
                        <div className="w-10 h-10 flex items-center justify-center">
                          <RockNode />
                        </div>
                      ) : isFrozen ? (
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${frozenOpacity} transition-opacity`} style={{
                          background: "linear-gradient(135deg, #0c2a4a 0%, #0e3460 100%)",
                          border: "2.5px solid #38bdf8",
                          boxShadow: "0 0 12px rgba(14, 165, 233, 0.4), 0 0 4px rgba(56, 189, 248, 0.73), inset 0 0 6px rgba(14, 165, 233, 0.13)"
                        }}>
                          <span style={{
                            filter: "hue-rotate(180deg) saturate(1.8) brightness(1.3)"
                          }}>🔥</span>
                        </div>
                      ) : isDone ? (
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold bg-green-500/20 border-2 border-green-500">
                          ✓
                        </div>
                      ) : isNext ? (
                        <div>
                          <motion.div
                            animate={{ scale: [1, 1.1, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="absolute inset-0 rounded-full bg-yellow-500/30 border-2 border-yellow-500/50"
                            style={{ width: 56, height: 56, top: -8, left: -8 }}
                          />
                          <div className="w-10 h-10 rounded-full bg-yellow-500/20 border-3 border-yellow-500 flex items-center justify-center text-xl font-bold relative">
                            🔥
                          </div>
                        </div>
                      ) : isFinal ? (
                        <div className="w-10 h-10 rounded-full bg-muted border-2 border-muted-foreground/40 flex items-center justify-center text-xl">
                          🧠
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-muted border-2 border-muted-foreground/40" />
                      )}
                    </div>
                  </div>

                  {/* Label */}
                  <p className="text-xs font-bold text-muted-foreground mt-2 whitespace-nowrap">
                    {isFinal ? labels[idx] : labels[idx]}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-border/30 bg-muted/30 px-3 py-2 text-center">
          <p className="text-xl font-bold text-foreground">{practice.level === 2 ? practice.completedIntervalsL2?.length || 0 : practice.completedIntervals.length}/{intervals.length}</p>
          <p className="text-xs text-muted-foreground">Conquistados</p>
        </div>
        <div className="rounded-xl border border-border/30 bg-muted/30 px-3 py-2 text-center">
          <p className="text-xl font-bold text-foreground">
            {practice.level === 2 && practice.level1CompletedDate 
              ? calculateDaysSince(practice.level1CompletedDate) 
              : calculateDaysSince(practice.startDate)}
          </p>
          <p className="text-xs text-muted-foreground">Días transcurridos</p>
        </div>
      </div>
    </div>
  );
}

function ArchivedPanel({
  archived,
  onBack,
}: {
  archived: ArchivedPractice[];
  onBack: () => void;
}) {
  return (
    <div className="w-full">
      {/* Header */}
      <div className="border-b border-yellow-500/30 px-6 py-5 bg-gradient-to-r from-yellow-500/5 to-amber-500/5">
        <div className="flex items-start gap-4">
          <button
            onClick={onBack}
            className="flex-shrink-0 mt-1 rounded hover:bg-yellow-500/10 p-1 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
          </button>
          <div>
            <h2 className="font-black text-xl text-yellow-700 dark:text-yellow-300 flex items-center gap-2">
              <Archive size={20} className="text-yellow-600 dark:text-yellow-400" />
              🏆 Prácticas Completadas
            </h2>
            <p className="mt-1 text-sm text-yellow-600/70 dark:text-yellow-400/70">
              ¡Felicidades! Dominaste estas prácticas
            </p>
          </div>
        </div>
      </div>

      {/* Archives List */}
      <div className="px-5 py-3 flex flex-col gap-2 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-yellow-500/20 scrollbar-track-transparent hover:scrollbar-thumb-yellow-500/40">
        {archived.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No tienes prácticas archivadas
          </p>
        ) : (
          archived.map((item) => (
            <button
              key={item.id}
              className="text-left rounded-2xl border-2 border-yellow-400/50 px-4 py-3 bg-gradient-to-br from-yellow-500/20 via-amber-500/10 to-yellow-500/10 hover:border-yellow-400 hover:from-yellow-500/30 hover:via-amber-500/20 transition-all shadow-md hover:shadow-lg hover:shadow-yellow-500/20"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl flex-shrink-0 drop-shadow">{item.emoji}</span>
                <div className="flex-1 min-w-0">
                  <span className="font-black text-sm text-yellow-900 dark:text-yellow-100 block truncate">
                    {item.name}
                  </span>
                  <span className="text-xs text-yellow-700/80 dark:text-yellow-300/80">
                    {formatDate(item.startDate)} → {formatDate(item.endDate)}
                  </span>
                </div>
              </div>
              <div className="pl-11 flex items-center gap-2 text-xs text-yellow-700/70 dark:text-yellow-300/70">
                <span className="font-semibold">Completada en:</span>
                <span className="font-bold text-yellow-700 dark:text-yellow-300">{item.totalDays} días</span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
