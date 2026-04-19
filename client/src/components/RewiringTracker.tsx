"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Trash2, Archive, Edit, Swords } from "lucide-react";
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
  areaId?: string | null;
  projectId?: string | null;
  skillId?: string | null;
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
  const [editingTrackerAreaId, setEditingTrackerAreaId] = useState<string | null>(null);
  const [editingTrackerProjectId, setEditingTrackerProjectId] = useState<string | null>(null);
  const [editingTrackerSkillId, setEditingTrackerSkillId] = useState<string | null>(null);
  const [editingSkillsForArea, setEditingSkillsForArea] = useState<any[]>([]);
  const [showXpPopup, setShowXpPopup] = useState<{ visible: boolean }>({ visible: false });
  const [newTrackerAreaId, setNewTrackerAreaId] = useState<string | null>(null);
  const [newTrackerProjectId, setNewTrackerProjectId] = useState<string | null>(null);
  const [newTrackerSkillId, setNewTrackerSkillId] = useState<string | null>(null);
  const [areas, setAreas] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [availableSkills, setAvailableSkills] = useState<any[]>([]);
  const [levelCompletingTrackerId, setLevelCompletingTrackerId] = useState<string | null>(null);

  // Function to load trackers from API
  const reloadTrackers = async () => {
    try {
      const res = await fetch("/api/rewiring-trackers");
      if (res.ok) {
        const trackersFromApi = await res.json();
        
        // Separate archived and active trackers
        const active = trackersFromApi.filter((t: any) => !t.archivedAt);
        const archived = trackersFromApi.filter((t: any) => t.archivedAt);
        
        // Build availableTrackers list
        const trackerList = active.map((t: any) => ({ id: t.id, name: t.name }));
        setAvailableTrackers(trackerList);
        
        // Build trackerData
        const allData: Record<string, TrackerData> = {};
        for (const tracker of active) {
          allData[tracker.id] = {
            count: tracker.count || 0,
            name: tracker.name,
            history: [],
            startDate: tracker.startDate,
            areaId: tracker.areaId,
            projectId: tracker.projectId,
            skillId: tracker.skillId,
          };
        }
        setTrackerData(allData);
        
        // Set archived trackers
        const archivedList = archived.map((t: any) => ({
          id: t.id,
          name: t.name,
          completedDate: t.archivedAt,
          startDate: t.startDate,
          totalActions: t.count || 0,
        }));
        setArchivedTrackers(archivedList);
        
        // Set first tracker as selected if available
        if (trackerList.length > 0 && !selectedTrackerId) {
          setSelectedTrackerId(trackerList[0].id);
        }
      }
    } catch (error) {
      console.error("Error loading trackers:", error);
    }
  };

  // Load all tracker data from API on mount
  useEffect(() => {
    reloadTrackers();
  }, []);

  // Archive completed trackers when component unmounts (modal closes)
  useEffect(() => {
    return () => {
      // On unmount, archive any completed trackers
      const archiveOnClose = async () => {
        try {
          const completedTrackerIds = Object.entries(trackerData)
            .filter(([_, data]) => data.count >= 10)
            .map(([id, _]) => id);

          for (const trackerId of completedTrackerIds) {
            await fetch(`/api/rewiring-trackers/${trackerId}/archive`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
            });
          }
        } catch (error) {
          console.error("Error archiving trackers on close:", error);
        }
      };

      archiveOnClose();
    };
  }, [trackerData]);

  // Load areas and projects on mount
  useEffect(() => {
    const loadAreasAndProjects = async () => {
      try {
        const areasRes = await fetch("/api/areas");
        const projectsRes = await fetch("/api/projects");
        
        if (areasRes.ok) {
          const areasData = await areasRes.json();
          setAreas(areasData);
        }
        if (projectsRes.ok) {
          const projectsData = await projectsRes.json();
          setProjects(projectsData);
        }
      } catch (error) {
        console.error("Error loading areas and projects:", error);
      }
    };
    loadAreasAndProjects();
  }, []);

  // Load skills when area changes
  useEffect(() => {
    const loadSkillsByArea = async () => {
      if (!newTrackerAreaId) {
        setAvailableSkills([]);
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
        const res = await fetch(`/api/global-skills/area/${newTrackerAreaId}`);
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

        setAvailableSkills(combined);
      } catch (error) {
        console.error("Error loading skills:", error);
        setAvailableSkills([]);
      }
    };
    loadSkillsByArea();
  }, [newTrackerAreaId]);

  // Award XP to linked skill
  const awardSkillXP = (skillId: string | null | undefined) => {
    if (!skillId) return;

    if (skillId.startsWith("legacy-")) {
      // Handle legacy skills stored in localStorage
      const skillName = skillId.substring(7); // Remove "legacy-" prefix
      const skillsProgress: Record<string, { name: string; currentXp: number; level: number }> = {};
      const stored = localStorage.getItem("skillsProgress");
      if (stored) {
        try {
          Object.assign(skillsProgress, JSON.parse(stored));
        } catch (error) {
          console.error("Error parsing skillsProgress:", error);
          return;
        }
      }

      if (skillsProgress[skillName]) {
        const currentXp = skillsProgress[skillName].currentXp || 0;
        const newXp = currentXp + 5;
        const newLevel = Math.floor(newXp / 100) + 1;
        skillsProgress[skillName].currentXp = newXp;
        skillsProgress[skillName].level = newLevel;
        localStorage.setItem("skillsProgress", JSON.stringify(skillsProgress));
        setShowXpPopup({ visible: true });
        setTimeout(() => setShowXpPopup({ visible: false }), 1500);
      }
    }
  };

  const handleCreateTracker = async () => {
    if (!newTrackerName.trim()) return;

    try {
      const res = await fetch("/api/rewiring-trackers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTrackerName.trim(),
          areaId: newTrackerAreaId,
          projectId: newTrackerProjectId,
          skillId: newTrackerSkillId,
        }),
      });

      if (!res.ok) {
        console.error("Error creating tracker");
        return;
      }

      const newTracker = await res.json();
      const trackerList = [...availableTrackers, { id: newTracker.id, name: newTracker.name }];

      setAvailableTrackers(trackerList);
      setTrackerData({
        ...trackerData,
        [newTracker.id]: {
          count: 0,
          name: newTracker.name,
          history: [],
          startDate: newTracker.startDate,
          areaId: newTracker.areaId,
          projectId: newTracker.projectId,
          skillId: newTracker.skillId,
        },
      });
      setNewTrackerName("");
      setNewTrackerAreaId(null);
      setNewTrackerProjectId(null);
      setNewTrackerSkillId(null);
      setSelectedTrackerId(newTracker.id);
    } catch (error) {
      console.error("Error creating tracker:", error);
    }
  };

  const handleDeleteTracker = async (trackerId: string) => {
    if (confirm("¿Eliminar este rastreador? Se perderán todos los datos.")) {
      try {
        const res = await fetch(`/api/rewiring-trackers/${trackerId}`, {
          method: "DELETE",
        });

        if (!res.ok) {
          console.error("Error deleting tracker");
          return;
        }

        const trackerList = availableTrackers.filter((t) => t.id !== trackerId);

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
      } catch (error) {
        console.error("Error deleting tracker:", error);
      }
    }
  };

  const handleUpdateTracker = async (trackerId: string, updates: { name: string; areaId: string | null; projectId: string | null; skillId: string | null }) => {
    if (!updates.name.trim()) return;

    try {
      const res = await fetch(`/api/rewiring-trackers/${trackerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: updates.name.trim(),
          areaId: updates.areaId,
          projectId: updates.projectId,
          skillId: updates.skillId,
        }),
      });

      if (!res.ok) {
        console.error("Error updating tracker");
        return;
      }

      const updatedTrackers = availableTrackers.map((t) =>
        t.id === trackerId ? { ...t, name: updates.name.trim() } : t
      );

      const updatedData = { ...trackerData };
      if (updatedData[trackerId]) {
        updatedData[trackerId] = {
          ...updatedData[trackerId],
          name: updates.name.trim(),
          areaId: updates.areaId,
          projectId: updates.projectId,
          skillId: updates.skillId,
        };
      }

      setAvailableTrackers(updatedTrackers);
      setTrackerData(updatedData);
      setEditingTrackerId(null);
      setContextMenuTrackerId(null);
      setEditingTrackerName("");
      setEditingTrackerAreaId(null);
      setEditingTrackerProjectId(null);
      setEditingTrackerSkillId(null);
    } catch (error) {
      console.error("Error updating tracker:", error);
    }
  };

  const handleIncrement = async (trackerId: string) => {
    const data = trackerData[trackerId];
    if (!data) return;

    try {
      // Call API to record action
      const res = await fetch(`/api/rewiring-trackers/${trackerId}/record`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        console.error("Error recording action");
        return;
      }

      const updatedTracker = await res.json();
      const newCount = updatedTracker.count;
      const newHistory = [...data.history, { timestamp: new Date().toISOString() }];

      // Check if tracker is complete (Maestro level = 10 actions)
      const levelIndex = getLevelIndex(newCount);
      const isComplete = levelIndex === LEVELS.length - 1 && newCount >= 10;

      // Award XP if linked to skill
      if (data.skillId) {
        awardSkillXP(data.skillId);
      }

      // Trigger level completion animation for 3, 6, or 10 actions
      if ([3, 6, 10].includes(newCount)) {
        setLevelCompletingTrackerId(trackerId);
      }

      // Always update tracker data (whether complete or not)
      setTrackerData({
        ...trackerData,
        [trackerId]: {
          ...data,
          count: newCount,
          history: newHistory,
        },
      });
    } catch (error) {
      console.error("Error incrementing tracker:", error);
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

  const handleRenameArchived = (trackerId: string, newName: string) => {
    if (!newName.trim()) return;

    const updatedArchived = archivedTrackers.map((t) =>
      t.id === trackerId ? { ...t, name: newName.trim() } : t
    );
    setArchivedTrackers(updatedArchived);
  };

  const handleDeleteArchived = (trackerId: string) => {
    if (confirm("¿Eliminar este rewiring completado? Se perderán todos los datos.")) {
      const updatedArchived = archivedTrackers.filter((t) => t.id !== trackerId);
      setArchivedTrackers(updatedArchived);
    }
  };

  // Archive all completed trackers before closing the parent modal
  const handleArchivalBeforeClose = async () => {
    try {
      // Find all trackers with count >= 10 (completed)
      const completedTrackerIds = Object.entries(trackerData)
        .filter(([_, data]) => data.count >= 10)
        .map(([id, _]) => id);

      // Archive each completed tracker
      for (const trackerId of completedTrackerIds) {
        await fetch(`/api/rewiring-trackers/${trackerId}/archive`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
      }

      // Clear animation state
      setLevelCompletingTrackerId(null);

      // Close the parent modal
      if (onBack) {
        onBack();
      }
    } catch (error) {
      console.error("Error archiving trackers before close:", error);
      // Still close even if archival fails
      if (onBack) {
        onBack();
      }
    }
  };

  const longPressHandler = useLongPress(() => {
    setIsCreatingTracker(true);
  }, 600);

  // Wrap parent's onBack to archive trackers before closing
  const handleParentClose = () => {
    handleArchivalBeforeClose();
  };

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
          newTrackerAreaId={newTrackerAreaId}
          onNewTrackerAreaId={setNewTrackerAreaId}
          newTrackerProjectId={newTrackerProjectId}
          onNewTrackerProjectId={setNewTrackerProjectId}
          newTrackerSkillId={newTrackerSkillId}
          onNewTrackerSkillId={setNewTrackerSkillId}
          areas={areas}
          projects={projects}
          availableSkills={availableSkills}
          showXpPopup={showXpPopup}
          onDeleteTracker={handleDeleteTracker}
          onRegisterAction={handleIncrement}
          contextMenuTrackerId={contextMenuTrackerId}
          onContextMenuTrackerId={setContextMenuTrackerId}
          editingTrackerId={editingTrackerId}
          editingTrackerName={editingTrackerName}
          onEditingTrackerName={setEditingTrackerName}
          onUpdateTracker={handleUpdateTracker}
          onSetEditingTrackerId={setEditingTrackerId}
          editingTrackerAreaId={editingTrackerAreaId}
          onEditingTrackerAreaId={setEditingTrackerAreaId}
          editingTrackerProjectId={editingTrackerProjectId}
          onEditingTrackerProjectId={setEditingTrackerProjectId}
          editingTrackerSkillId={editingTrackerSkillId}
          onEditingTrackerSkillId={setEditingTrackerSkillId}
          editingSkillsForArea={editingSkillsForArea}
          onEditingSkillsForArea={setEditingSkillsForArea}
          levelCompletingTrackerId={levelCompletingTrackerId}
        />
      )}

      {currentPanel === "detail" && selectedTrackerId && trackerData[selectedTrackerId] && (
        <DetailPanel
          trackerId={selectedTrackerId}
          data={trackerData[selectedTrackerId]}
          onBack={() => {
            setCurrentPanel("main");
            setSelectedTrackerId(null);
            // Clear the level completing animation
            setLevelCompletingTrackerId(null);
            // Reload trackers to reflect any archival that occurred
            reloadTrackers();
          }}
          onRegisterAction={handleIncrement}
          onReset={handleReset}
          onDeleteTracker={handleDeleteTracker}
          isLevelCompleting={levelCompletingTrackerId === selectedTrackerId}
        />
      )}

      {currentPanel === "archived" && (
        <ArchivedPanel
          archived={archivedTrackers}
          onBack={() => setCurrentPanel("main")}
          onRenameArchived={handleRenameArchived}
          onDeleteArchived={handleDeleteArchived}
        />
      )}
    </div>
  );
}

function TrackerCard({
  tracker,
  data,
  levelIndex,
  isEditMode,
  editingTrackerName,
  onEditingTrackerNameChange,
  isContextMenuOpen,
  onContextMenuTrackerId,
  onEditingTrackerName,
  onSetEditingTrackerId,
  onUpdateTracker,
  onDeleteTracker,
  onRegisterAction,
  onSelectTracker,
  isLevelCompleting,
  areas,
  projects,
  editingTrackerAreaId,
  onEditingTrackerAreaId,
  editingTrackerProjectId,
  onEditingTrackerProjectId,
  editingTrackerSkillId,
  onEditingTrackerSkillId,
  editingSkillsForArea,
  onEditingSkillsForArea,
}: {
  tracker: { id: string; name: string };
  data: TrackerData;
  levelIndex: number;
  isEditMode: boolean;
  editingTrackerName: string | null;
  onEditingTrackerNameChange: (name: string) => void;
  isContextMenuOpen: boolean;
  onContextMenuTrackerId: (id: string | null) => void;
  onEditingTrackerName: (name: string) => void;
  onSetEditingTrackerId: (id: string | null) => void;
  onUpdateTracker: (id: string, updates: { name: string; areaId: string | null; projectId: string | null; skillId: string | null }) => void;
  onDeleteTracker: (id: string) => void;
  onRegisterAction: (id: string) => void;
  onSelectTracker: (id: string) => void;
  isLevelCompleting: boolean;
  areas: any[];
  projects: any[];
  editingTrackerAreaId: string | null;
  onEditingTrackerAreaId: (id: string | null) => void;
  editingTrackerProjectId: string | null;
  onEditingTrackerProjectId: (id: string | null) => void;
  editingTrackerSkillId: string | null;
  onEditingTrackerSkillId: (id: string | null) => void;
  editingSkillsForArea: any[];
  onEditingSkillsForArea: (skills: any[]) => void;
}) {
  const level = LEVELS[levelIndex];
  const isComplete = levelIndex === LEVELS.length - 1 && data.count >= level.to;
  const remainingActions = level.to - data.count;
  const progressInLevel = data.count - level.from;
  const levelRange = level.to - level.from;
  const progressPercent = Math.min(1, progressInLevel / levelRange);
  const [animatingLevel, setAnimatingLevel] = useState(false);

  // Handle level completion animation
  useEffect(() => {
    if (isLevelCompleting) {
      setAnimatingLevel(true);
    }
  }, [isLevelCompleting]);

  const longPressHandler = useLongPress(() => {
    if (!animatingLevel) {
      onContextMenuTrackerId(tracker.id);
    }
  }, 600);

  const handleCardClick = () => {
    if (!isEditMode && !isContextMenuOpen && !animatingLevel) {
      onSelectTracker(tracker.id);
    }
  };

  // Calculate animation progress for level completion
  let animatedProgressPercent = progressPercent;
  let animatedLevel = level;
  if (animatingLevel) {
    animatedProgressPercent = 1;
    animatedLevel = level; // Use current level color for the celebration
  }

  return (
    <motion.div
      key={tracker.id}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border px-4 py-4 cursor-pointer transition-all relative group bg-white dark:bg-slate-900"
      style={{
        borderColor: level.col,
      }}
      onClick={handleCardClick}
      {...longPressHandler}
    >
      {isEditMode ? (
        <div className="space-y-3 p-3" onClick={(e) => e.stopPropagation()}>
          {/* Tracker Name */}
          <div>
            <Input
              value={editingTrackerName || ""}
              onChange={(e) => onEditingTrackerNameChange(e.target.value)}
              placeholder="Nombre del rastreador..."
              className="text-sm"
              autoFocus
            />
          </div>

          {/* Area Select */}
          <div>
            <label className="text-xs font-semibold text-foreground uppercase tracking-wide">Área</label>
            <select
              value={editingTrackerAreaId || ""}
              onChange={async (e) => {
                const areaId = e.target.value || null;
                onEditingTrackerAreaId(areaId);
                onEditingTrackerSkillId(null);
                
                if (areaId) {
                  try {
                    const res = await fetch(`/api/global-skills/area/${areaId}`);
                    const skills = res.ok ? await res.json() : [];
                    onEditingSkillsForArea(skills);
                  } catch (error) {
                    console.error("Error loading skills:", error);
                    onEditingSkillsForArea([]);
                  }
                } else {
                  onEditingSkillsForArea([]);
                }
              }}
              className="mt-1 w-full px-2 py-1.5 border border-border/50 rounded bg-background text-foreground dark:bg-slate-900 text-xs"
            >
              <option value="">Sin área</option>
              {areas && areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.icon} {area.name}
                </option>
              ))}
            </select>
          </div>

          {/* Project Select */}
          <div>
            <label className="text-xs font-semibold text-foreground uppercase tracking-wide">Proyecto</label>
            <select
              value={editingTrackerProjectId || ""}
              onChange={(e) => onEditingTrackerProjectId(e.target.value || null)}
              className="mt-1 w-full px-2 py-1.5 border border-border/50 rounded bg-background text-foreground dark:bg-slate-900 text-xs"
            >
              <option value="">Sin proyecto</option>
              {projects && projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.icon} {project.name}
                </option>
              ))}
            </select>
          </div>

          {/* Skill Select */}
          <div>
            <label className="text-xs font-semibold text-foreground uppercase tracking-wide">Skill</label>
            <select
              value={editingTrackerSkillId || ""}
              onChange={(e) => onEditingTrackerSkillId(e.target.value || null)}
              disabled={!editingTrackerAreaId}
              className="mt-1 w-full px-2 py-1.5 border border-border/50 rounded bg-background text-foreground dark:bg-slate-900 text-xs disabled:opacity-50"
            >
              <option value="">Sin skill</option>
              {editingSkillsForArea && editingSkillsForArea.map((skill) => (
                <option key={skill.id} value={skill.id}>
                  {skill.name}
                </option>
              ))}
            </select>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onSetEditingTrackerId(null);
                onEditingTrackerNameChange("");
                onEditingTrackerAreaId(null);
                onEditingTrackerProjectId(null);
                onEditingTrackerSkillId(null);
                onEditingSkillsForArea([]);
              }}
              variant="outline"
              className="flex-1 h-7 text-xs"
            >
              Cancelar
            </Button>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                if (editingTrackerName) {
                  onUpdateTracker(tracker.id, {
                    name: editingTrackerName,
                    areaId: editingTrackerAreaId,
                    projectId: editingTrackerProjectId,
                    skillId: editingTrackerSkillId,
                  });
                }
              }}
              className="flex-1 h-7 text-xs"
              style={{ background: level.col, color: "white" }}
            >
              Guardar
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Circular Ring */}
          <div className="flex justify-center mb-3">
            <div className="relative w-32 h-32">
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
                  stroke={animatedLevel.col}
                  strokeDasharray={CIRC}
                  strokeDashoffset={CIRC * (1 - animatedProgressPercent)}
                  strokeLinecap="round"
                  className="transition-all"
                  style={{ transform: "rotate(-90deg)", transformOrigin: "105px 105px" }}
                  animate={{ strokeDashoffset: CIRC * (1 - animatedProgressPercent) }}
                  transition={{ duration: animatingLevel ? 0.3 : 0.45, ease: [0.4, 0, 0.2, 1] }}
                />
              </svg>
              {/* Center text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-3xl font-bold" style={{ color: animatedLevel.col }}>
                  {data.count}
                </div>
                <div className="text-xs" style={{ color: animatedLevel.txt }}>
                  de {level.to}
                </div>
              </div>
            </div>
          </div>

          {/* Tracker Info */}
          <div className="text-center">
            <h3 className="font-bold text-sm text-foreground mb-1 line-clamp-2">{tracker.name}</h3>
            <div className="flex items-center justify-center gap-2 mb-3">
              <span
                className="text-xs px-2 py-1 rounded-full font-bold text-white"
                style={{ background: level.col }}
              >
                {level.name}
              </span>
            </div>
            <div className="text-xs text-muted-foreground mb-3">
              {isComplete
                ? "¡Completado!"
                : `${remainingActions} acción${remainingActions === 1 ? "" : "es"} falta${remainingActions === 1 ? "" : "n"}`}
            </div>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onRegisterAction(tracker.id);
              }}
              disabled={isComplete}
              className="w-full rounded-xl text-xs h-8"
              style={{
                background: animatedLevel.col,
                color: "white",
              }}
            >
              + Acción
            </Button>
          </div>
        </>
      )}

      {/* Context Menu */}
      <AnimatePresence>
        {isContextMenuOpen && !isEditMode && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-full mt-2 right-0 flex flex-wrap gap-2 z-50 bg-background border border-border rounded-lg shadow-lg p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              onClick={async (e) => {
                e.stopPropagation();
                onEditingTrackerNameChange(tracker.name);
                onEditingTrackerAreaId(data.areaId || null);
                onEditingTrackerProjectId(data.projectId || null);
                onEditingTrackerSkillId(data.skillId || null);
                onSetEditingTrackerId(tracker.id);
                onContextMenuTrackerId(null);

                if (data.areaId) {
                  try {
                    const res = await fetch(`/api/global-skills/area/${data.areaId}`);
                    const skills = res.ok ? await res.json() : [];
                    onEditingSkillsForArea(skills);
                  } catch (error) {
                    console.error("Error loading skills:", error);
                  }
                }
              }}
              className="rounded-xl bg-blue-500/20 text-blue-700 dark:text-blue-400 hover:bg-blue-500/30 border border-blue-500/50 text-xs h-8"
            >
              <Edit className="h-3 w-3 mr-1" />
              Editar
            </Button>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onContextMenuTrackerId(null);
                onDeleteTracker(tracker.id);
              }}
              className="rounded-xl bg-red-500/20 text-red-700 dark:text-red-400 hover:bg-red-500/30 border border-red-500/50 text-xs h-8"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Eliminar
            </Button>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onContextMenuTrackerId(null);
              }}
              className="rounded-xl bg-gray-500/20 text-gray-700 dark:text-gray-400 hover:bg-gray-500/30 border border-gray-500/50 text-xs h-8"
            >
              Cancelar
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
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
  newTrackerAreaId,
  onNewTrackerAreaId,
  newTrackerProjectId,
  onNewTrackerProjectId,
  newTrackerSkillId,
  onNewTrackerSkillId,
  areas,
  projects,
  availableSkills,
  showXpPopup,
  onDeleteTracker,
  onRegisterAction,
  contextMenuTrackerId,
  onContextMenuTrackerId,
  editingTrackerId,
  editingTrackerName,
  onEditingTrackerName,
  onUpdateTracker,
  onSetEditingTrackerId,
  editingTrackerAreaId,
  onEditingTrackerAreaId,
  editingTrackerProjectId,
  onEditingTrackerProjectId,
  editingTrackerSkillId,
  onEditingTrackerSkillId,
  editingSkillsForArea,
  onEditingSkillsForArea,
  levelCompletingTrackerId,
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
  newTrackerAreaId: string | null;
  onNewTrackerAreaId: (id: string | null) => void;
  newTrackerProjectId: string | null;
  onNewTrackerProjectId: (id: string | null) => void;
  newTrackerSkillId: string | null;
  onNewTrackerSkillId: (id: string | null) => void;
  areas: any[];
  projects: any[];
  availableSkills: any[];
  showXpPopup: { visible: boolean };
  onDeleteTracker: (id: string) => void;
  onRegisterAction: (id: string) => void;
  contextMenuTrackerId: string | null;
  onContextMenuTrackerId: (id: string | null) => void;
  editingTrackerId: string | null;
  editingTrackerName: string | null;
  onEditingTrackerName: (name: string) => void;
  onUpdateTracker: (id: string, updates: { name: string; areaId: string | null; projectId: string | null; skillId: string | null }) => void;
  onSetEditingTrackerId: (id: string | null) => void;
  editingTrackerAreaId: string | null;
  onEditingTrackerAreaId: (id: string | null) => void;
  editingTrackerProjectId: string | null;
  onEditingTrackerProjectId: (id: string | null) => void;
  editingTrackerSkillId: string | null;
  onEditingTrackerSkillId: (id: string | null) => void;
  editingSkillsForArea: any[];
  onEditingSkillsForArea: (skills: any[]) => void;
  levelCompletingTrackerId: string | null;
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
        <div className="flex-1">
          <h2 className="font-black text-xl text-foreground dark:text-foreground">Mis rewirings</h2>
          <p className="mt-1 text-sm text-muted-foreground capitalize">
            {todayStr.charAt(0).toUpperCase() + todayStr.slice(1)}
          </p>
        </div>
      </div>

      {/* Trackers List */}
      <div className="px-5 py-4 flex flex-col gap-4 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground/40">
        {trackers.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No tienes rewirings aún. ¡Crea uno para empezar!
          </p>
        ) : (
          trackers.map((tracker) => {
            const data = trackerData[tracker.id];
            if (!data) return null;

            const levelIndex = getLevelIndex(data.count);
            const isEditMode = editingTrackerId === tracker.id;
            const isContextMenuOpen = contextMenuTrackerId === tracker.id;

            return (
              <TrackerCard
                key={tracker.id}
                tracker={tracker}
                data={data}
                levelIndex={levelIndex}
                isEditMode={isEditMode}
                editingTrackerName={editingTrackerName}
                onEditingTrackerNameChange={onEditingTrackerName}
                isContextMenuOpen={isContextMenuOpen}
                onContextMenuTrackerId={onContextMenuTrackerId}
                onEditingTrackerName={onEditingTrackerName}
                onSetEditingTrackerId={onSetEditingTrackerId}
                onUpdateTracker={onUpdateTracker}
                onDeleteTracker={onDeleteTracker}
                onRegisterAction={onRegisterAction}
                onSelectTracker={onSelectTracker}
                isLevelCompleting={levelCompletingTrackerId === tracker.id}
                areas={areas}
                projects={projects}
                editingTrackerAreaId={editingTrackerAreaId}
                onEditingTrackerAreaId={onEditingTrackerAreaId}
                editingTrackerProjectId={editingTrackerProjectId}
                onEditingTrackerProjectId={onEditingTrackerProjectId}
                editingTrackerSkillId={editingTrackerSkillId}
                onEditingTrackerSkillId={onEditingTrackerSkillId}
                editingSkillsForArea={editingSkillsForArea}
                onEditingSkillsForArea={onEditingSkillsForArea}
              />
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
                className="bg-background rounded-2xl border border-border p-6 w-full max-w-sm max-h-96 overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-lg font-semibold mb-4">Crear nuevo rastreador</h2>
                
                {/* Tracker Name */}
                <div className="mb-4">
                  <Input
                    value={newTrackerName}
                    onChange={(e) => onNewTrackerNameChange(e.target.value)}
                    placeholder="Nombre del comportamiento..."
                    autoFocus
                  />
                </div>

                {/* Area Select */}
                <div className="mb-4">
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wide">Área</label>
                  <select
                    value={newTrackerAreaId || ""}
                    onChange={(e) => {
                      onNewTrackerAreaId(e.target.value || null);
                      onNewTrackerSkillId(null);
                    }}
                    className="mt-2 w-full px-3 py-2.5 border border-border/50 rounded-lg bg-background text-foreground dark:bg-slate-900 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all text-sm"
                  >
                    <option value="">Sin área asignada</option>
                    {areas.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.icon} {area.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">Opcional: vincular el rastreador a un área</p>
                </div>

                {/* Project Select */}
                <div className="mb-4">
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wide">Proyecto</label>
                  <select
                    value={newTrackerProjectId || ""}
                    onChange={(e) => onNewTrackerProjectId(e.target.value || null)}
                    className="mt-2 w-full px-3 py-2.5 border border-border/50 rounded-lg bg-background text-foreground dark:bg-slate-900 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all text-sm"
                  >
                    <option value="">Sin proyecto asignado</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.icon} {project.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">Opcional: vincular el rastreador a un proyecto</p>
                </div>

                {/* Skill Select */}
                <div className="mb-4">
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wide">Skill a linkear</label>
                  <select
                    value={newTrackerSkillId || ""}
                    onChange={(e) => onNewTrackerSkillId(e.target.value || null)}
                    disabled={!newTrackerAreaId}
                    className="mt-2 w-full px-3 py-2.5 border border-border/50 rounded-lg bg-background text-foreground dark:bg-slate-900 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">Sin skill asignado</option>
                    {availableSkills.map((skill) => (
                      <option key={skill.id} value={skill.id}>
                        {skill.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">Opcional: linkear a un skill para sumar +5 XP al completar</p>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      onIsCreatingTracker(false);
                      onNewTrackerNameChange("");
                      onNewTrackerAreaId(null);
                      onNewTrackerProjectId(null);
                      onNewTrackerSkillId(null);
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



      {/* +5xp Popup */}
      <AnimatePresence>
        {showXpPopup.visible && (
          <motion.div
            initial={{ opacity: 0, y: -100, scale: 0.5 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.5 }}
            transition={{ duration: 0.4, type: "spring", damping: 10 }}
            className="fixed inset-0 flex items-center justify-center pointer-events-none z-[9999]"
          >
            <div className="text-5xl font-bold text-green-400 drop-shadow-lg">
              +5xp
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer - Archived button */}
      <div className="border-t border-border/30 flex items-center justify-end px-4 sm:px-6 py-3 gap-2">
        <button
          onClick={onViewArchived}
          className="inline-flex items-center justify-center rounded-full bg-blue-500/20 p-2 text-blue-700 hover:opacity-80 dark:text-blue-400 active:opacity-60 transition-colors touch-manipulation h-9 w-9"
          title={`Completados (${archivedCount})`}
        >
          <Swords className="h-4 w-4" />
        </button>
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
  isLevelCompleting,
}: {
  trackerId: string;
  data: TrackerData;
  onBack: () => void;
  onRegisterAction: (id: string) => void;
  onReset: (id: string) => void;
  onDeleteTracker: (id: string) => void;
  isLevelCompleting: boolean;
}) {
  const levelIndex = getLevelIndex(data.count);
  const currentLevel = LEVELS[levelIndex];
  const isMaxLevel = levelIndex === LEVELS.length - 1;
  const isComplete = isMaxLevel && data.count >= currentLevel.to;
  const remainingActions = currentLevel.to - data.count;
  const progressInLevel = data.count - currentLevel.from;
  const levelRange = currentLevel.to - currentLevel.from;
  const progressPercent = Math.min(1, progressInLevel / levelRange);
  const [animatingLevel, setAnimatingLevel] = useState(false);

  // Handle level completion animation
  useEffect(() => {
    if (isLevelCompleting) {
      setAnimatingLevel(true);
    }
  }, [isLevelCompleting]);

  // Calculate animation progress for level completion
  let animatedProgressPercent = progressPercent;
  let animatedLevel = currentLevel;
  if (animatingLevel) {
    animatedProgressPercent = 1;
    animatedLevel = currentLevel; // Use current level color for the celebration
  }

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
      </div>

      {/* Content */}
      <div className="px-6 py-5 flex flex-col gap-5 bg-background dark:bg-background">
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
                stroke={animatedLevel.col}
                strokeDasharray={CIRC}
                strokeDashoffset={CIRC * (1 - animatedProgressPercent)}
                strokeLinecap="round"
                className="transition-all"
                style={{ transform: "rotate(-90deg)", transformOrigin: "105px 105px" }}
                animate={{ strokeDashoffset: CIRC * (1 - animatedProgressPercent) }}
                transition={{ duration: animatingLevel ? 0.3 : 0.45, ease: [0.4, 0, 0.2, 1] }}
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
            style={{ background: animatedLevel.bg, color: animatedLevel.txt }}
          >
            Nivel {levelIndex + 1} — {animatedLevel.name}
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
            borderColor: animatedLevel.col,
            background: animatedLevel.bg,
            color: animatedLevel.txt,
          }}
          whileTap={isComplete ? {} : { scale: 0.97 }}
        >
          + Registrar acción
        </motion.button>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/50 dark:bg-muted/40 rounded-lg p-4 text-center border border-border/20 dark:border-border/40">
            <div className="text-2xl font-medium">{levelIndex + 1}</div>
            <div className="text-xs text-muted-foreground mt-1">Nivel actual</div>
          </div>
          <div className="bg-muted/50 dark:bg-muted/40 rounded-lg p-4 text-center border border-border/20 dark:border-border/40">
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

function ArchivedItemCard({
  item,
  isEditMode,
  editingArchiveName,
  onEditingArchiveNameChange,
  onOpenEdit,
  onCloseEdit,
  onRenameArchived,
  onDeleteArchived,
  onContextMenuOpen,
  onContextMenuClose,
  isContextMenuOpen,
}: {
  item: ArchivedTracker;
  isEditMode: boolean;
  editingArchiveName: string;
  onEditingArchiveNameChange: (name: string) => void;
  onOpenEdit: () => void;
  onCloseEdit: () => void;
  onRenameArchived: (id: string, name: string) => void;
  onDeleteArchived: (id: string) => void;
  onContextMenuOpen: () => void;
  onContextMenuClose: () => void;
  isContextMenuOpen: boolean;
}) {
  const longPressHandler = useLongPress(() => {
    onContextMenuOpen();
  }, 600);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border-2 border-yellow-400/50 px-4 py-3 bg-gradient-to-br from-yellow-500/20 via-amber-500/10 to-yellow-500/10 hover:border-yellow-400 hover:from-yellow-500/30 hover:via-amber-500/20 transition-all shadow-md hover:shadow-lg hover:shadow-yellow-500/20 relative text-left cursor-pointer"
      {...longPressHandler}
    >
      {isEditMode ? (
        <div className="flex items-center gap-2">
          <Input
            value={editingArchiveName}
            onChange={(e) => onEditingArchiveNameChange(e.target.value)}
            placeholder="Nombre del rewiring..."
            className="flex-1 text-sm h-8"
            autoFocus
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter" && editingArchiveName) {
                onRenameArchived(item.id, editingArchiveName);
                onCloseEdit();
              } else if (e.key === "Escape") {
                onCloseEdit();
              }
            }}
          />
          <Button
            onClick={(e) => {
              e.stopPropagation();
              if (editingArchiveName) {
                onRenameArchived(item.id, editingArchiveName);
                onCloseEdit();
              }
            }}
            className="h-8 px-2 text-xs bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-700 text-white transition-colors"
          >
            ✓
          </Button>
        </div>
      ) : (
        <>
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
        </>
      )}

      {/* Context Menu */}
      <AnimatePresence>
        {isContextMenuOpen && !isEditMode && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-full mt-2 right-0 flex flex-wrap gap-2 z-50 bg-background border border-border rounded-lg shadow-lg p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onEditingArchiveNameChange(item.name);
                onOpenEdit();
              }}
              className="rounded-xl bg-blue-500/20 text-blue-700 dark:text-blue-400 hover:bg-blue-500/30 border border-blue-500/50 text-xs h-8"
            >
              <Edit className="h-3 w-3 mr-1" />
              Editar
            </Button>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteArchived(item.id);
              }}
              className="rounded-xl bg-red-500/20 text-red-700 dark:text-red-400 hover:bg-red-500/30 border border-red-500/50 text-xs h-8"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Eliminar
            </Button>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onContextMenuClose();
              }}
              className="rounded-xl bg-gray-500/20 text-gray-700 dark:text-gray-400 hover:bg-gray-500/30 border border-gray-500/50 text-xs h-8"
            >
              Cancelar
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ArchivedPanel({
  archived,
  onBack,
  onRenameArchived,
  onDeleteArchived,
}: {
  archived: ArchivedTracker[];
  onBack: () => void;
  onRenameArchived: (id: string, name: string) => void;
  onDeleteArchived: (id: string) => void;
}) {
  const [contextMenuArchiveId, setContextMenuArchiveId] = useState<string | null>(null);
  const [editingArchiveId, setEditingArchiveId] = useState<string | null>(null);
  const [editingArchiveName, setEditingArchiveName] = useState("");

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
            <h2 className="font-black text-xl text-yellow-700 dark:text-yellow-300">
              Rewirings Completados
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
            No tienes rewirings completados aún
          </p>
        ) : (
          archived.map((item) => (
            <ArchivedItemCard
              key={item.id}
              item={item}
              isEditMode={editingArchiveId === item.id}
              editingArchiveName={editingArchiveName}
              onEditingArchiveNameChange={setEditingArchiveName}
              onOpenEdit={() => {
                setEditingArchiveId(item.id);
                setContextMenuArchiveId(null);
              }}
              onCloseEdit={() => setEditingArchiveId(null)}
              onRenameArchived={onRenameArchived}
              onDeleteArchived={onDeleteArchived}
              onContextMenuOpen={() => setContextMenuArchiveId(item.id)}
              onContextMenuClose={() => setContextMenuArchiveId(null)}
              isContextMenuOpen={contextMenuArchiveId === item.id}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default RewiringTracker;
