"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Trash2, Archive } from "lucide-react";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface Level {
  name: string;
  from: number;
  to: number;
  col: string;
  bg: string;
  txt: string;
}

const LEVELS: Level[] = [
  { name: "Iniciante", from: 0, to: 3, col: "#378ADD", bg: "#E6F1FB", txt: "#185FA5" },
  { name: "Avanzado", from: 3, to: 6, col: "#7F77DD", bg: "#EEEDFE", txt: "#534AB7" },
  { name: "Maestro", from: 6, to: 10, col: "#BA7517", bg: "#FAEEDA", txt: "#854F0B" },
];

const CIRC = 2 * Math.PI * 88;

interface HistoryEntry {
  timestamp: string;
}

interface TrackerData {
  count: number;
  name: string;
  history: HistoryEntry[];
  startDate?: string;
}

interface ArchivedTracker {
  id: string;
  name: string;
  completedDate: string;
  startDate?: string;
  totalActions: number;
}

interface RewiringTrackerProps {
  onBack?: () => void;
}

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTH_NAMES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function formatDateToString(iso: string): string {
  const date = new Date(iso);
  const dayName = DAY_NAMES[date.getDay()];
  const day = date.getDate();
  const month = MONTH_NAMES[date.getMonth()];
  const year = date.getFullYear();
  return `${dayName} ${day} ${month} ${year}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

function getLevelIndex(count: number): number {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (count >= LEVELS[i].from) return i;
  }
  return 0;
}

function useLongPress(callback: () => void, duration = 500) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [isPressed, setIsPressed] = useState(false);
  const MOVE_THRESHOLD = 10;

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

  const handleMouseDown = () => {
    startPress();
  };

  const handleMouseUp = () => {
    clearPress();
  };

  const handleMouseLeave = () => {
    clearPress();
  };

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

function RewiringTracker({ onBack }: RewiringTrackerProps) {
  const [currentPanel, setCurrentPanel] = useState<"main" | "detail" | "archived">("main");
  const [trackerData, setTrackerData] = useState<Record<string, TrackerData>>({});
  const [archivedTrackers, setArchivedTrackers] = useState<ArchivedTracker[]>([]);
  const [availableTrackers, setAvailableTrackers] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedTrackerId, setSelectedTrackerId] = useState<string | null>(null);
  const [newTrackerName, setNewTrackerName] = useState("");
  const [isCreatingTracker, setIsCreatingTracker] = useState(false);
  const [contextMenuTrackerId, setContextMenuTrackerId] = useState<string | null>(null);
  const [editingTrackerId, setEditingTrackerId] = useState<string | null>(null);
  const [editingTrackerName, setEditingTrackerName] = useState("");

  // Load all tracker data on mount
  useEffect(() => {
    const trackerList = JSON.parse(localStorage.getItem("rewiring_tracker_list") || "[]");
    const archivedList = JSON.parse(localStorage.getItem("rewiring_tracker_archived") || "[]");
    
    setAvailableTrackers(trackerList);
    setArchivedTrackers(archivedList);

    // Load all tracker data
    const allData: Record<string, TrackerData> = {};
    trackerList.forEach((tracker: { id: string; name: string }) => {
      const stored = localStorage.getItem(`rewiring_tracker_${tracker.id}`);
      if (stored) {
        try {
          allData[tracker.id] = JSON.parse(stored);
        } catch (error) {
          allData[tracker.id] = { count: 0, name: tracker.name, history: [], startDate: new Date().toISOString() };
        }
      } else {
        allData[tracker.id] = { count: 0, name: tracker.name, history: [], startDate: new Date().toISOString() };
      }
    });
    setTrackerData(allData);

    // Set first tracker as selected
    if (trackerList.length > 0) {
      setSelectedTrackerId(trackerList[0].id);
    }
  }, []);

  // Save tracker data to localStorage whenever it changes
  useEffect(() => {
    Object.entries(trackerData).forEach(([trackerId, data]) => {
      localStorage.setItem(`rewiring_tracker_${trackerId}`, JSON.stringify(data));
    });
  }, [trackerData]);

  // Save archived trackers to localStorage
  useEffect(() => {
    localStorage.setItem("rewiring_tracker_archived", JSON.stringify(archivedTrackers));
  }, [archivedTrackers]);


  const handleCreateTracker = () => {
    if (!newTrackerName.trim()) return;

    const newTrackerId = `tracker_${Date.now()}`;
    const newTracker = { id: newTrackerId, name: newTrackerName.trim() };
    const trackerList = [...availableTrackers, newTracker];

    localStorage.setItem("rewiring_tracker_list", JSON.stringify(trackerList));
    localStorage.setItem(
      `rewiring_tracker_${newTrackerId}`,
      JSON.stringify({
        count: 0,
        name: newTrackerName.trim(),
        history: [],
        startDate: new Date().toISOString(),
      })
    );

    setAvailableTrackers(trackerList);
    setTrackerData({
      ...trackerData,
      [newTrackerId]: { count: 0, name: newTrackerName.trim(), history: [], startDate: new Date().toISOString() },
    });
    setNewTrackerName("");
    setSelectedTrackerId(newTrackerId);
  };

  const handleDeleteTracker = (trackerId: string) => {
    if (confirm("¿Eliminar este rastreador? Se perderán todos los datos.")) {
      const trackerList = availableTrackers.filter((t) => t.id !== trackerId);
      localStorage.setItem("rewiring_tracker_list", JSON.stringify(trackerList));
      localStorage.removeItem(`rewiring_tracker_${trackerId}`);

      const newTrackerData = { ...trackerData };
      delete newTrackerData[trackerId];

      setAvailableTrackers(trackerList);
      setTrackerData(newTrackerData);
      setContextMenuTrackerId(null);
      setEditingTrackerId(null);

      // Switch to first available tracker or go back to main panel
      if (trackerList.length > 0 && trackerId === selectedTrackerId) {
        setSelectedTrackerId(trackerList[0].id);
        setCurrentPanel("main");
      } else if (trackerList.length === 0) {
        setSelectedTrackerId(null);
        setCurrentPanel("main");
      }
    }
  };

  const handleRenameTracker = (trackerId: string, newName: string) => {
    if (!newName.trim()) return;

    const updatedTrackers = availableTrackers.map((t) =>
      t.id === trackerId ? { ...t, name: newName.trim() } : t
    );
    localStorage.setItem("rewiring_tracker_list", JSON.stringify(updatedTrackers));

    const updatedData = { ...trackerData };
    if (updatedData[trackerId]) {
      updatedData[trackerId] = { ...updatedData[trackerId], name: newName.trim() };
    }

    setAvailableTrackers(updatedTrackers);
    setTrackerData(updatedData);
    setEditingTrackerId(null);
    setContextMenuTrackerId(null);
  };

  const handleIncrement = (trackerId: string) => {
    const data = trackerData[trackerId];
    if (!data) return;

    const newCount = data.count + 1;
    const newHistory = [...data.history, { timestamp: new Date().toISOString() }];

    // Check if tracker is complete (Maestro level = 10 actions)
    const levelIndex = getLevelIndex(newCount);
    const isComplete = levelIndex === LEVELS.length - 1 && newCount >= 10;

    if (isComplete) {
      // Archive the tracker
      const archivedTracker: ArchivedTracker = {
        id: trackerId,
        name: data.name,
        completedDate: new Date().toISOString(),
        startDate: data.startDate,
        totalActions: newCount,
      };

      // Remove from active trackers
      const trackerList = availableTrackers.filter((t) => t.id !== trackerId);
      localStorage.setItem("rewiring_tracker_list", JSON.stringify(trackerList));
      localStorage.removeItem(`rewiring_tracker_${trackerId}`);

      const newTrackerData = { ...trackerData };
      delete newTrackerData[trackerId];

      // Add to archived
      const newArchived = [...archivedTrackers, archivedTracker];

      setAvailableTrackers(trackerList);
      setArchivedTrackers(newArchived);
      setTrackerData(newTrackerData);

      // Switch to first available tracker or go back to main
      if (trackerList.length > 0) {
        setSelectedTrackerId(trackerList[0].id);
        setCurrentPanel("main");
      } else {
        setSelectedTrackerId(null);
        setCurrentPanel("main");
      }
    } else {
      // Regular increment
      setTrackerData({
        ...trackerData,
        [trackerId]: {
          ...data,
          count: newCount,
          history: newHistory,
        },
      });
    }
  };

  const handleReset = (trackerId: string) => {
    if (confirm("¿Reiniciar todo? Se borrará el historial.")) {
      const data = trackerData[trackerId];
      if (!data) return;

      setTrackerData({
        ...trackerData,
        [trackerId]: {
          ...data,
          count: 0,
          history: [],
        },
      });
    }
  };

  const longPressHandler = useLongPress(() => {
    setIsCreatingTracker(true);
  }, 600);

  return (
    <div className="w-full">
      {currentPanel === "main" && (
        <MainPanel
          trackers={availableTrackers}
          trackerData={trackerData}
          archivedCount={archivedTrackers.length}
          onSelectTracker={(id) => {
            setSelectedTrackerId(id);
            setCurrentPanel("detail");
          }}
          onViewArchived={() => setCurrentPanel("archived")}
          onLongPressAdd={longPressHandler}
          onCreateTracker={handleCreateTracker}
          newTrackerName={newTrackerName}
          onNewTrackerNameChange={setNewTrackerName}
          isCreatingTracker={isCreatingTracker}
          onIsCreatingTracker={setIsCreatingTracker}
          onDeleteTracker={handleDeleteTracker}
          onRegisterAction={handleIncrement}
          contextMenuTrackerId={contextMenuTrackerId}
          onContextMenuTrackerId={setContextMenuTrackerId}
          editingTrackerId={editingTrackerId}
          editingTrackerName={editingTrackerName}
          onEditingTrackerName={setEditingTrackerName}
          onRenameTracker={handleRenameTracker}
          onSetEditingTrackerId={setEditingTrackerId}
        />
      )}

      {currentPanel === "detail" && selectedTrackerId && trackerData[selectedTrackerId] && (
        <DetailPanel
          trackerId={selectedTrackerId}
          data={trackerData[selectedTrackerId]}
          onBack={() => {
            setCurrentPanel("main");
            setSelectedTrackerId(null);
          }}
          onRegisterAction={handleIncrement}
          onReset={handleReset}
          onDeleteTracker={handleDeleteTracker}
        />
      )}

      {currentPanel === "archived" && (
        <ArchivedPanel
          archived={archivedTrackers}
          onBack={() => setCurrentPanel("main")}
        />
      )}
    </div>
  );
}

function MainPanel({
  trackers,
  trackerData,
  archivedCount,
  onSelectTracker,
  onViewArchived,
  onLongPressAdd,
  onCreateTracker,
  newTrackerName,
  onNewTrackerNameChange,
  isCreatingTracker,
  onIsCreatingTracker,
  onDeleteTracker,
  onRegisterAction,
  contextMenuTrackerId,
  onContextMenuTrackerId,
  editingTrackerId,
  editingTrackerName,
  onEditingTrackerName,
  onRenameTracker,
  onSetEditingTrackerId,
}: {
  trackers: Array<{ id: string; name: string }>;
  trackerData: Record<string, TrackerData>;
  archivedCount: number;
  onSelectTracker: (id: string) => void;
  onViewArchived: () => void;
  onLongPressAdd: ReturnType<typeof useLongPress>;
  onCreateTracker: () => void;
  newTrackerName: string;
  onNewTrackerNameChange: (name: string) => void;
  isCreatingTracker: boolean;
  onIsCreatingTracker: (creating: boolean) => void;
  onDeleteTracker: (id: string) => void;
  onRegisterAction: (id: string) => void;
  contextMenuTrackerId: string | null;
  onContextMenuTrackerId: (id: string | null) => void;
  editingTrackerId: string | null;
  editingTrackerName: string | null;
  onEditingTrackerName: (name: string) => void;
  onRenameTracker: (id: string, name: string) => void;
  onSetEditingTrackerId: (id: string | null) => void;
}) {
  const today = new Date();
  const todayStr = today.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="w-full">
      {/* Header - Long press para agregar */}
      <div
        className="border-b border-border/30 px-6 py-5 cursor-pointer active:bg-muted/50 transition-colors"
        {...onLongPressAdd}
      >
        <h2 className="font-black text-xl text-foreground">Mi rewirings</h2>
        <p className="mt-1 text-sm text-muted-foreground capitalize">
          {todayStr.charAt(0).toUpperCase() + todayStr.slice(1)}
        </p>
      </div>

      {/* Trackers List */}
      <div className="px-5 py-3 flex flex-col gap-2 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground/40">
        {trackers.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No tienes rewiramientos aún. ¡Crea uno para empezar!
          </p>
        ) : (
          trackers.map((tracker) => {
            const data = trackerData[tracker.id];
            if (!data) return null;

            const levelIndex = getLevelIndex(data.count);
            const level = LEVELS[levelIndex];
            const isComplete = levelIndex === LEVELS.length - 1 && data.count >= level.to;
            const remainingActions = level.to - data.count;
            const isEditMode = editingTrackerId === tracker.id;
            const isContextMenuOpen = contextMenuTrackerId === tracker.id;
            const longPressHandler = useLongPress(() => {
              onContextMenuTrackerId(tracker.id);
            }, 600);

            return (
              <motion.div
                key={tracker.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border px-3 py-2.5 mb-2 cursor-pointer hover:border-primary/50 transition-all relative"
                style={{
                  borderColor: level.col,
                  background: level.bg,
                }}
                onClick={() => !isEditMode && !isContextMenuOpen && onSelectTracker(tracker.id)}
                {...longPressHandler}
              >
                {isEditMode ? (
                  <div className="flex items-center gap-2 mb-3">
                    <Input
                      value={editingTrackerName || ""}
                      onChange={(e) => onEditingTrackerName(e.target.value)}
                      placeholder="Nombre del rastreador..."
                      className="flex-1 text-sm h-8"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && editingTrackerName) {
                          onRenameTracker(tracker.id, editingTrackerName);
                        } else if (e.key === "Escape") {
                          onSetEditingTrackerId(null);
                        }
                      }}
                    />
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (editingTrackerName) {
                          onRenameTracker(tracker.id, editingTrackerName);
                        }
                      }}
                      className="h-8 px-2 text-xs"
                      style={{ background: level.col, color: "white" }}
                    >
                      ✓
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="font-bold text-sm text-foreground flex-1">{tracker.name}</span>
                      <span
                        className="text-xs px-2 py-1 rounded-full font-bold text-white"
                        style={{ background: level.col }}
                      >
                        Nivel {levelIndex + 1}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="text-lg font-bold" style={{ color: level.col }}>
                          {data.count} / {level.to}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {isComplete
                            ? "¡Completado!"
                            : `${remainingActions} acción${remainingActions === 1 ? "" : "es"} falta${remainingActions === 1 ? "" : "n"}`}
                        </div>
                      </div>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRegisterAction(tracker.id);
                        }}
                        disabled={isComplete}
                        className="rounded-xl text-xs h-8 px-3"
                        style={{
                          background: level.col,
                          color: "white",
                        }}
                      >
                        + Acción
                      </Button>
                    </div>
                  </>
                )}
                <AnimatePresence>
                  {isContextMenuOpen && !isEditMode && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="absolute top-full mt-1 right-0 bg-background border border-border rounded-lg shadow-lg z-50 min-w-max"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditingTrackerName(tracker.name);
                          onSetEditingTrackerId(tracker.id);
                          onContextMenuTrackerId(null);
                        }}
                        className="w-full px-4 py-2 text-sm text-left hover:bg-muted/50 border-b border-border/30"
                      >
                        ✏️ Editar nombre
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onContextMenuTrackerId(null);
                          onDeleteTracker(tracker.id);
                        }}
                        className="w-full px-4 py-2 text-sm text-left text-red-500 hover:bg-red-500/10"
                      >
                        🗑️ Eliminar
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </div>

      {/* New Tracker Form - Modal */}
      <AnimatePresence>
        {isCreatingTracker && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
              onClick={() => {
                onIsCreatingTracker(false);
                onNewTrackerNameChange("");
              }}
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                className="bg-background rounded-2xl border border-border p-6 w-full max-w-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-lg font-semibold mb-4">Crear nuevo rastreador</h2>
                <Input
                  value={newTrackerName}
                  onChange={(e) => onNewTrackerNameChange(e.target.value)}
                  placeholder="Nombre del comportamiento..."
                  className="mb-4"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      onIsCreatingTracker(false);
                      onNewTrackerNameChange("");
                    }}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => {
                      onCreateTracker();
                      onIsCreatingTracker(false);
                    }}
                    className="flex-1"
                    disabled={!newTrackerName.trim()}
                  >
                    Crear
                  </Button>
                </div>
              </motion.div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* Footer - Archived button - Always visible */}
      <div className="border-t border-border/30 px-5 py-3 flex justify-center">
        <motion.button
          onClick={onViewArchived}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="text-yellow-500 hover:text-yellow-400 transition-colors cursor-pointer"
          title={`Completados (${archivedCount})`}
        >
          <Archive className="w-6 h-6" />
        </motion.button>
      </div>
    </div>
  );
}

function DetailPanel({
  trackerId,
  data,
  onBack,
  onRegisterAction,
  onReset,
  onDeleteTracker,
}: {
  trackerId: string;
  data: TrackerData;
  onBack: () => void;
  onRegisterAction: (id: string) => void;
  onReset: (id: string) => void;
  onDeleteTracker: (id: string) => void;
}) {
  const levelIndex = getLevelIndex(data.count);
  const currentLevel = LEVELS[levelIndex];
  const isMaxLevel = levelIndex === LEVELS.length - 1;
  const isComplete = isMaxLevel && data.count >= currentLevel.to;
  const remainingActions = currentLevel.to - data.count;
  const progressInLevel = data.count - currentLevel.from;
  const levelRange = currentLevel.to - currentLevel.from;
  const progressPercent = Math.min(1, progressInLevel / levelRange);

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
          <h2 className="font-black text-xl text-foreground">{data.name}</h2>
        </div>
        <button
          onClick={() => onDeleteTracker(trackerId)}
          className="text-red-500 hover:text-red-600 transition-colors"
          title="Eliminar rastreador"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="px-6 py-5 flex flex-col gap-5">
        {/* Circular progress ring */}
        <div className="flex justify-center">
          <div className="relative w-48 h-48">
            <svg viewBox="0 0 210 210" className="w-full h-full">
              <circle
                cx="105"
                cy="105"
                r="88"
                fill="none"
                stroke="currentColor"
                strokeWidth="14"
                className="text-muted-foreground/20"
              />
              <motion.circle
                cx="105"
                cy="105"
                r="88"
                fill="none"
                strokeWidth="14"
                stroke={currentLevel.col}
                strokeDasharray={CIRC}
                strokeDashoffset={CIRC * (1 - progressPercent)}
                strokeLinecap="round"
                className="transition-all"
                style={{ transform: "rotate(-90deg)", transformOrigin: "105px 105px" }}
                animate={{ strokeDashoffset: CIRC * (1 - progressPercent) }}
                transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
              />
            </svg>
            {/* Center text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-4xl font-medium">{data.count}</div>
              <div className="text-xs text-muted-foreground">de {currentLevel.to}</div>
            </div>
          </div>
        </div>

        {/* Level badge */}
        <div className="text-center">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
            style={{ background: currentLevel.bg, color: currentLevel.txt }}
          >
            Nivel {levelIndex + 1} — {currentLevel.name}
          </div>
        </div>

        {/* Progress text */}
        <div className="text-center text-sm text-muted-foreground">
          {isComplete
            ? "Maestro completo — ¡todo logrado!"
            : `${remainingActions} acción${remainingActions === 1 ? "" : "es"} para completar`}
        </div>

        {/* Register action button */}
        <motion.button
          onClick={() => onRegisterAction(trackerId)}
          disabled={isComplete}
          className="w-full py-3 rounded-full border"
          style={{
            borderColor: currentLevel.col,
            background: currentLevel.bg,
            color: currentLevel.txt,
          }}
          whileTap={isComplete ? {} : { scale: 0.97 }}
        >
          + Registrar acción
        </motion.button>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-secondary rounded-lg p-4 text-center">
            <div className="text-2xl font-medium">{levelIndex + 1}</div>
            <div className="text-xs text-muted-foreground mt-1">Nivel actual</div>
          </div>
          <div className="bg-secondary rounded-lg p-4 text-center">
            <div className="text-2xl font-medium">
              {isComplete ? "—" : remainingActions}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Para completar</div>
          </div>
        </div>

        {/* Levels section */}
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Niveles
          </div>
          <div className="space-y-1">
            {LEVELS.map((level, idx) => {
              const isActive = idx === levelIndex;
              const isDone = idx < levelIndex;
              const actionsInLevel = isDone
                ? level.to - level.from
                : isActive
                  ? Math.min(data.count - level.from, level.to - level.from)
                  : 0;

              return (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3 rounded-lg border"
                  style={
                    isActive
                      ? {
                          borderColor: level.col,
                          borderWidth: "1.5px",
                          background: level.bg,
                        }
                      : { borderColor: "var(--color-border)" }
                  }
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0"
                    style={{ background: level.bg, color: level.txt }}
                  >
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">
                      {isActive ? "→ " : ""}
                      Nivel {idx + 1}: {level.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {actionsInLevel} / {level.to - level.from} acciones
                      {isDone && " · completado"}
                    </div>
                  </div>
                  <div style={{ color: level.col }}>
                    {isDone && "✓"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* History section */}
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Historial
          </div>
          <div className="max-h-48 overflow-y-auto border rounded-lg">
            {data.history.length === 0 ? (
              <div className="p-4 text-xs text-muted-foreground text-center">
                Aún no hay acciones registradas.
              </div>
            ) : (
              <div className="divide-y">
                {[...data.history].reverse().map((entry, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center p-3 text-sm"
                  >
                    <span className="font-medium">#{data.history.length - idx}</span>
                    <span className="text-muted-foreground">
                      {formatDateToString(entry.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Reset button */}
        <button
          onClick={() => onReset(trackerId)}
          className="w-full text-xs text-muted-foreground hover:text-foreground underline transition-colors"
        >
          Reiniciar todo
        </button>
      </div>
    </div>
  );
}

function ArchivedPanel({
  archived,
  onBack,
}: {
  archived: ArchivedTracker[];
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
              🏆 Rewiramientos Completados
            </h2>
            <p className="mt-1 text-sm text-yellow-600/70 dark:text-yellow-400/70">
              ¡Felicidades! Dominaste estos comportamientos
            </p>
          </div>
        </div>
      </div>

      {/* Archives List */}
      <div className="px-5 py-3 flex flex-col gap-2 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-yellow-500/20 scrollbar-track-transparent hover:scrollbar-thumb-yellow-500/40">
        {archived.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No tienes rewiramientos completados aún
          </p>
        ) : (
          archived.map((item) => (
            <button
              key={item.id}
              className="text-left rounded-2xl border-2 border-yellow-400/50 px-4 py-3 bg-gradient-to-br from-yellow-500/20 via-amber-500/10 to-yellow-500/10 hover:border-yellow-400 hover:from-yellow-500/30 hover:via-amber-500/20 transition-all shadow-md hover:shadow-lg hover:shadow-yellow-500/20"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl flex-shrink-0 drop-shadow">🎯</span>
                <div className="flex-1 min-w-0">
                  <span className="font-black text-sm text-yellow-900 dark:text-yellow-100 block truncate">
                    {item.name}
                  </span>
                  <span className="text-xs text-yellow-700/80 dark:text-yellow-300/80">
                    {item.startDate ? `${formatDate(item.startDate)} → ` : ""}{formatDate(item.completedDate)}
                  </span>
                </div>
              </div>
              <div className="pl-11 flex items-center gap-2 text-xs text-yellow-700/70 dark:text-yellow-300/70">
                <span className="font-semibold">Acciones completadas:</span>
                <span className="font-bold text-yellow-700 dark:text-yellow-300">{item.totalActions}</span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export default RewiringTracker;
