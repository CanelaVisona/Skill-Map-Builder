import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { ArrowLeft, Plus, Trash2, Archive } from "lucide-react";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";

interface SpaceRepetitionPractice {
  id: string;
  name: string;
  emoji: string;
  startDate: string;
  completedIntervals: number[];
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

const INTERVALS = [0, 1, 3, 7, 16, 30];
const INTERVAL_LABELS = ["D0", "D1", "D3", "D7", "D16", "D30"];

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

type PracticeStatus = "due" | "late" | "expired" | "waiting" | "complete";

function calculateStatus(practice: SpaceRepetitionPractice): PracticeStatus {
  const daysSince = calculateDaysSince(practice.startDate);
  const completedIndices = new Set(practice.completedIntervals);

  for (let i = 0; i < INTERVALS.length; i++) {
    if (!completedIndices.has(i)) {
      const targetDay = INTERVALS[i];
      const tolerance = 2;
      const expireWindow = 5;

      if (daysSince < targetDay) {
        return "waiting";
      } else if (daysSince === targetDay) {
        return "due";
      } else if (daysSince <= targetDay + tolerance) {
        return "late";
      } else if (daysSince <= targetDay + expireWindow) {
        return "expired";
      }
    }
  }

  return "complete";
}

function getNextIntervalIndex(practice: SpaceRepetitionPractice): number {
  const completedIndices = new Set(practice.completedIntervals);
  for (let i = 0; i < INTERVALS.length; i++) {
    if (!completedIndices.has(i)) {
      return i;
    }
  }
  return -1;
}

function daysUntilNextInterval(practice: SpaceRepetitionPractice): number {
  const nextIdx = getNextIntervalIndex(practice);
  if (nextIdx === -1) return 0;
  const daysSince = calculateDaysSince(practice.startDate);
  const targetDay = INTERVALS[nextIdx];
  return Math.max(0, targetDay - daysSince);
}

function getStateColor(status: PracticeStatus): string {
  switch (status) {
    case "due":
    case "late":
      return "bg-yellow-500/20 border-yellow-500 text-yellow-700 dark:text-yellow-400";
    case "expired":
      return "bg-red-500/20 border-red-500 text-red-700 dark:text-red-400";
    case "waiting":
      return "bg-blue-500/20 border-blue-500 text-blue-700 dark:text-blue-400";
    case "complete":
      return "bg-green-500/20 border-green-500 text-green-700 dark:text-green-400";
    default:
      return "";
  }
}

function getStateLabel(status: PracticeStatus): string {
  switch (status) {
    case "due":
      return "🔥 Hoy";
    case "late":
      return "⚠️ Atrasado";
    case "expired":
      return "❌ Expirado";
    case "waiting":
      return "⏳ Esperando";
    case "complete":
      return "✅ Completado";
  }
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
  const [notification, setNotification] = useState<string | null>(null);
  const { theme } = useTheme();

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
        })
      });
      if (!res.ok) throw new Error("Error creating practice");
      const newPractice = await res.json();
      setPractices([...practices, newPractice]);
      setNewName("");
      setNewEmoji("💪");
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

      const intervals = new Set(practice.completedIntervals);
      intervals.add(intervalIndex);
      const newCompleted = Array.from(intervals).sort();

      // Check if all intervals are completed
      if (newCompleted.length === INTERVALS.length) {
        // Archive this practice
        const res = await fetch(`/api/space-repetition/${practiceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            completedIntervals: newCompleted,
            archived: 1,
            endDate: getLocalDateString(),
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
        setNotification("✅ ¡Práctica completada y archivada!");
        return;
      }

      // Regular interval update
      const res = await fetch(`/api/space-repetition/${practiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          completedIntervals: newCompleted,
        })
      });
      if (!res.ok) throw new Error("Error updating practice");
      const updated = await res.json();
      
      setPractices(practices.map((p) => p.id === practiceId ? updated : p));
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
            />
          )}

          {currentPanel === "add" && (
            <AddPanel
              emoji={newEmoji}
              name={newName}
              onEmojiChange={setNewEmoji}
              onNameChange={setNewName}
              onBack={() => {
                setNewName("");
                setNewEmoji("💪");
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
}: {
  practices: SpaceRepetitionPractice[];
  activeCount: number;
  archivedCount: number;
  onLongPressAdd: () => void;
  onDetail: (id: string) => void;
  onArchived: () => void;
  onDelete: (id: string) => void;
  onRegister: (practiceId: string, intervalIdx: number) => void;
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
    status: calculateStatus(p),
    nextIdx: getNextIntervalIndex(p),
  }));

  const pendingPractices = practicesWithStatus.filter(
    (p) => p.status === "due" || p.status === "late" || p.status === "expired"
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

function PracticeCardWithLongPress({
  practice,
  onDetail,
  onDelete,
  onRegister,
}: {
  practice: SpaceRepetitionPractice & { status: PracticeStatus; nextIdx: number };
  onDetail: () => void;
  onDelete: () => void;
  onRegister: () => void;
}) {
  const [showDelete, setShowDelete] = useState(false);
  const longPressHandler = useLongPress(() => setShowDelete(true), 800);
  const completedSet = new Set(practice.completedIntervals.map(Number));

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
      className="rounded-2xl border border-yellow-500/30 bg-yellow-500/5 px-3 py-2.5 mb-2 cursor-pointer hover:border-yellow-500/50 transition-all active:bg-yellow-500/10"
      onClick={handleClick}
    >
      {/* Header con nombre y emoji */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg flex-shrink-0">{practice.emoji}</span>
        <span className="font-bold text-sm text-foreground flex-1">{practice.name}</span>
        {practice.nextIdx >= 0 && (
          <span className="text-xs bg-yellow-500/30 text-yellow-700 dark:text-yellow-400 px-2 py-1 rounded-full font-bold">
            {INTERVAL_LABELS[practice.nextIdx]}
          </span>
        )}
      </div>

      {/* Timeline compacta */}
      <div className="mb-3">
        <div className="relative pt-4 pb-3">
          {/* Nodes container */}
          <div className="relative flex justify-between items-center px-0">
            {INTERVALS.map((days, idx) => {
              const isDone = completedSet.has(idx);
              const isNext = idx === practice.nextIdx && (practice.status === "due" || practice.status === "late" || practice.status === "expired");
              const isFinal = idx === INTERVALS.length - 1;

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
                            completedSet.has(idx) && completedSet.has(idx + 1)
                              ? "bg-green-500"
                              : completedSet.has(idx)
                              ? "bg-gradient-to-r from-green-500 to-border/30"
                              : "bg-border/30"
                          }`}
                        />
                      </div>
                    )}

                    {/* Node */}
                    <div className="relative z-10">
                      {isDone ? (
                        <div className="w-6 h-6 rounded-full bg-green-500/20 border-1.5 border-green-500 flex items-center justify-center text-xs font-bold">
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
                        <div className="w-6 h-6 rounded-full bg-muted/50 border-1.5 border-border/30 flex items-center justify-center text-xs">
                          🧠
                        </div>
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-border/30 border border-border/50" />
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
      ) : (
        <Button
          onClick={(e) => {
            e.stopPropagation();
            onRegister();
          }}
          className="w-full rounded-xl bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-500/30 border border-yellow-500/50 text-xs h-8"
        >
          🔥 Registrar {practice.nextIdx >= 0 ? INTERVAL_LABELS[practice.nextIdx] : ""}
        </Button>
      )}
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
  const longPressHandler = useLongPress(() => setShowDelete(true), 800);
  const completedSet = new Set(practice.completedIntervals.map(Number));

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
      className="rounded-2xl border border-blue-500/30 bg-blue-500/5 px-3 py-2.5 mb-2 cursor-pointer hover:border-blue-500/50 transition-all active:bg-blue-500/10"
      onClick={handleClick}
    >
      {/* Header con nombre y emoji */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg flex-shrink-0">{practice.emoji}</span>
        <span className="font-bold text-sm text-foreground flex-1">{practice.name}</span>
        <span className="text-xs bg-blue-500/30 text-blue-700 dark:text-blue-400 px-2 py-1 rounded-full font-bold">
          en {daysLeft}d
        </span>
      </div>

      {/* Timeline compacta */}
      <div className="mb-3">
        <div className="relative pt-4 pb-3">
          {/* Nodes container */}
          <div className="relative flex justify-between items-center px-0">
            {INTERVALS.map((days, idx) => {
              const isDone = completedSet.has(idx);
              const isFinal = idx === INTERVALS.length - 1;

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
                            completedSet.has(idx) && completedSet.has(idx + 1)
                              ? "bg-green-500"
                              : completedSet.has(idx)
                              ? "bg-gradient-to-r from-green-500 to-border/30"
                              : "bg-border/30"
                          }`}
                        />
                      </div>
                    )}

                    {/* Node */}
                    <div className="relative z-10">
                      {isDone ? (
                        <div className="w-6 h-6 rounded-full bg-green-500/20 border-1.5 border-green-500 flex items-center justify-center text-xs font-bold">
                          ✓
                        </div>
                      ) : isFinal ? (
                        <div className="w-6 h-6 rounded-full bg-muted/50 border-1.5 border-border/30 flex items-center justify-center text-xs">
                          🧠
                        </div>
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-border/30 border border-border/50" />
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
            className="flex-1 rounded-xl bg-blue-500/20 text-blue-700 dark:text-blue-400 hover:bg-blue-500/30 border border-blue-500/50 text-xs h-8"
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
  onEmojiChange,
  onNameChange,
  onBack,
  onSubmit,
}: {
  emoji: string;
  name: string;
  onEmojiChange: (emoji: string) => void;
  onNameChange: (name: string) => void;
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
}: {
  practice: SpaceRepetitionPractice;
  onBack: () => void;
  onToggleInterval: (index: number) => void;
  onReset: () => void;
}) {
  const status = calculateStatus(practice);
  const daysSince = calculateDaysSince(practice.startDate);
  const nextIntervalIdx = getNextIntervalIndex(practice);
  const progress = practice.completedIntervals.length / INTERVALS.length;
  const completedSet = new Set(practice.completedIntervals.map(Number));

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
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Iniciado {practice.startDate} ({daysSince} días)
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-5 flex flex-col gap-5">
        {/* Status Badge */}
        <div className={`rounded-2xl border px-4 py-3 text-center ${getStateColor(status)}`}>
          <p className="font-bold text-sm">{getStateLabel(status)}</p>
          {status === "due" && <p className="text-xs mt-1">¡Hoy es el día!</p>}
          {status === "late" && <p className="text-xs mt-1">Atrasado, pero aún registrable</p>}
          {status === "expired" && <p className="text-xs mt-1">Expirado, se reiniciará</p>}
          {status === "waiting" && <p className="text-xs mt-1">Espera el siguiente intervalo</p>}
          {status === "complete" && <p className="text-xs mt-1">¡Completada!</p>}
        </div>

        {/* Timeline Visual */}
        <TimelineVisual practice={practice} completedSet={completedSet} />

        {/* Register Button */}
        {(status === "due" || status === "late") && nextIntervalIdx >= 0 && (
          <Button
            onClick={() => onToggleInterval(nextIntervalIdx)}
            className="w-full rounded-xl bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-500/30 border border-yellow-500/50"
          >
            🔥 Registrar {INTERVAL_LABELS[nextIntervalIdx]}
          </Button>
        )}

        {status === "expired" && nextIntervalIdx >= 0 && (
          <div className="flex gap-2">
            <Button
              onClick={() => onToggleInterval(nextIntervalIdx)}
              className="flex-1 rounded-xl bg-red-500/20 text-red-700 dark:text-red-400 hover:bg-red-500/30 border border-red-500/50"
            >
              🔥 Registrar igual
            </Button>
            <Button
              onClick={onReset}
              className="flex-1 rounded-xl bg-red-500/20 text-red-700 dark:text-red-400 hover:bg-red-500/30 border border-red-500/50"
            >
              🔄 Reiniciar
            </Button>
          </div>
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
  const status = calculateStatus(practice);
  const nextIdx = getNextIntervalIndex(practice);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-foreground mb-3">Timeline</p>

        {/* Container with relative positioning for the timeline */}
        <div className="relative pt-8 pb-6">
          {/* Nodes container */}
          <div className="relative flex justify-between items-center px-0">
            {INTERVALS.map((days, idx) => {
              const isDone = completedSet.has(idx);
              const isNext = idx === nextIdx && (status === "due" || status === "late" || status === "expired");
              const isFinal = idx === INTERVALS.length - 1;

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
                            completedSet.has(idx) && completedSet.has(idx + 1)
                              ? "bg-gradient-to-r from-green-500 to-green-500"
                              : completedSet.has(idx)
                              ? "bg-gradient-to-r from-green-500 to-border/30"
                              : "bg-border/30"
                          }`}
                        />
                      </div>
                    )}

                    {/* Node */}
                    <div className="relative z-10">
                      {isDone ? (
                        <div className="w-10 h-10 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center text-lg font-bold">
                          🔥
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
                        <div className="w-10 h-10 rounded-full bg-muted/50 border-2 border-border/30 flex items-center justify-center text-xl">
                          🧠
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-border/30 border border-border/50" />
                      )}
                    </div>
                  </div>

                  {/* Label */}
                  <p className="text-xs font-bold text-muted-foreground mt-2 whitespace-nowrap">
                    {isFinal ? "D30" : INTERVAL_LABELS[idx]}
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
          <p className="text-xl font-bold text-foreground">{practice.completedIntervals.length}/6</p>
          <p className="text-xs text-muted-foreground">Completados</p>
        </div>
        <div className="rounded-xl border border-border/30 bg-muted/30 px-3 py-2 text-center">
          <p className="text-xl font-bold text-foreground">{calculateDaysSince(practice.startDate)}</p>
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
