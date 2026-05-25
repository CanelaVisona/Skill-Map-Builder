import React, { useState, useMemo } from "react";
import ReactDOM from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { SkillDiamond } from "./SkillDiamond";
import { SkillGridDetail } from "./SkillGridDetail";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSkillTree } from "@/lib/skill-context";

// Icon map for skills - maps skill title keywords to icon paths
const SKILL_ICONS: Record<string, string> = {
  musica: `<path d="M14,4 L14,24 M10,8 L18,8 M8,18 C8,14 20,14 20,18" stroke-width="1.5" fill="none"/><path d="M8,18 L8,20 L20,20 L20,18" stroke-width="1" fill="none"/>`,
  guitarra: `<path d="M14,4 L14,24 M10,8 L18,8 M8,18 C8,14 20,14 20,18" stroke-width="1.5" fill="none"/>`,
  piano: `<path d="M8,14 L8,24 M10,14 L10,24 M12,14 L12,24 M14,14 L14,24 M16,14 L16,24 M18,14 L18,24 M20,14 L20,24" stroke-width="1" fill="none"/>`,
  flame: `<path d="M14,22 C14,22 8,18 8,13 C8,10 10,8 12,9 C12,6 14,4 14,4 C14,4 16,7 18,9 C20,11 20,16 20,18 C20,20 17,22 14,22Z" stroke-width="1.2" fill="none"/><path d="M14,18 C14,18 11,16 11,14 C11,13 12,12 13,13" stroke-width="1" fill="none"/>`,
  meditacion: `<path d="M6,14 C6,14 9,8 14,8 C19,8 22,14 22,14 C22,14 19,20 14,20 C9,20 6,14 6,14Z" stroke-width="1.3" fill="none"/><circle cx="14" cy="14" r="3" stroke-width="1.3" fill="none"/><circle cx="14" cy="14" r="1" fill="currentColor"/>`,
  respiracion: `<path d="M6,14 C8,10 10,8 14,8 C18,8 20,10 22,14" stroke-width="1.5" fill="none"/><path d="M6,14 C8,18 10,20 14,20 C18,20 20,18 22,14" stroke-width="1" fill="none"/><path d="M10,14 C10,12 12,11 14,11 C16,11 18,12 18,14 C18,16 16,17 14,17 C12,17 10,16 10,14" stroke-width="1" fill="none"/>`,
  olas: `<path d="M5,14 C7,10 9,10 11,14 C13,18 15,18 17,14 C19,10 21,10 23,14" stroke-width="1.5" fill="none"/><path d="M5,18 C7,14 9,14 11,18 C13,22 15,22 17,18 C19,14 21,14 23,18" stroke-width="1" fill="none" opacity=".5"/>`,
  surf: `<path d="M5,14 C7,10 9,10 11,14 C13,18 15,18 17,14 C19,10 21,10 23,14" stroke-width="1.5" fill="none"/>`,
  lectura: `<path d="M9,6 C9,6 8,6 8,8 L8,20 C8,20 8,22 10,22 L20,22 L20,8 C20,8 20,6 18,6 Z" stroke-width="1.3" fill="none"/><path d="M8,8 C8,8 8,6 10,6" stroke-width="1.3" fill="none"/><line x1="11" y1="10" x2="17" y2="10" stroke-width="1"/><line x1="11" y1="13" x2="17" y2="13" stroke-width="1"/><line x1="11" y1="16" x2="14" y2="16" stroke-width="1"/>`,
  intelecto: `<path d="M14,5 L14,23 M9,8 L19,8 M9,14 L19,14 M9,20 L14,20" stroke-width="1.5" fill="none"/><path d="M14,14 L19,20" stroke-width="1.5" fill="none"/>`,
  escritura: `<path d="M20,5 C20,5 16,8 13,14 L11,21 L14,18 C18,14 22,10 20,5Z" stroke-width="1.2" fill="none"/><line x1="11" y1="21" x2="8" y2="23" stroke-width="1"/><path d="M13,14 C12,16 11,18 11,21" stroke-width="1" fill="none"/>`,
  casa: `<path d="M14,22 C14,22 7,15 7,10 C7,7 9,5 11,5 C12.5,5 13.5,6 14,7 C14.5,6 15.5,5 17,5 C19,5 21,7 21,10 C21,15 14,22 14,22Z" stroke-width="1.3" fill="none"/>`,
  limpieza: `<path d="M14,22 C14,22 7,15 7,10 C7,7 9,5 11,5 C12.5,5 13.5,6 14,7 C14.5,6 15.5,5 17,5 C19,5 21,7 21,10 C21,15 14,22 14,22Z" stroke-width="1.3" fill="none"/>`,
  organizacion: `<rect x="8" y="11" width="12" height="10" rx="1" stroke-width="1.3" fill="none"/><path d="M8,8 L20,8 L20,11 L8,11 Z" stroke-width="1.3" fill="none"/><circle cx="14" cy="16" r="1.5" stroke-width="1" fill="none"/><line x1="14" y1="17.5" x2="14" y2="19" stroke-width="1"/>`,
};

// Area colors (from HTML design)
const AREA_COLORS: Record<string, string> = {
  musica: "#c85a2a",
  meditacion: "#7F77DD",
  surf: "#378ADD",
  intelecto: "#1D9E75",
  casa: "#BA7517",
};

const TIER_NAMES = ["Fundamento", "Rama", "Maestría"];

interface SkillData {
  id: string;
  areaId: string;
  parentSkillId: string | null;
  title: string;
  level: number;
  levelPosition: number;
  status: "locked" | "available" | "mastered";
  experiencePoints: number;
}

interface GlobalSkillData {
  id: string;
  name: string;
  skillId: string;
  currentXp: number;
  goalXp: number;
  level: number;
  areaId: string;
  status: "locked" | "available" | "mastered";
  createdAt?: string;
}

interface AreaData {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface SkillsGridJournalProps {
  skillId: string;
  areaId?: string;
}

export function SkillsGridJournal({ skillId, areaId }: SkillsGridJournalProps) {
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [activeAreaId, setActiveAreaId] = useState(areaId || "");
  const [activeAreaIds, setActiveAreaIds] = useState<string[]>(areaId ? [areaId] : []);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; skillId: string } | null>(null);
  const [areaContextMenu, setAreaContextMenu] = useState<{ x: number; y: number; areaId: string } | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [metaSkillId, setMetaSkillId] = useState<string | null>(null);
  const [goalXpValue, setGoalXpValue] = useState<string>("");
  const [metaUnlimited, setMetaUnlimited] = useState(false);
  const [showNewSkillForm, setShowNewSkillForm] = useState(false);
  const [newSkillName, setNewSkillName] = useState<string>("");
  const [newSkillXpMax, setNewSkillXpMax] = useState<string>("");
  const [newSkillUnlimited, setNewSkillUnlimited] = useState(false);
  const [newSkillLinkType, setNewSkillLinkType] = useState<"area" | "project">("area");
  const [newSkillLinkId, setNewSkillLinkId] = useState<string>("");
  const [newSkillError, setNewSkillError] = useState<string>("");
  const gridContainerRef = React.useRef<HTMLDivElement | null>(null);
  const longPressTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const [longPressStart, setLongPressStart] = useState<{ x: number; y: number } | null>(null);
  const isMobile = useIsMobile();
  const longPressTimer = React.useRef<NodeJS.Timeout | null>(null);
  const areaLongPressTimer = React.useRef<NodeJS.Timeout | null>(null);
  const plusButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const tabsContainerRef = React.useRef<HTMLDivElement | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
  
  // Create Area/Project Form
  const [showCreateAreaProjectForm, setShowCreateAreaProjectForm] = useState(false);
  const [createFormType, setCreateFormType] = useState<"area" | "project">("area");
  const [createFormName, setCreateFormName] = useState<string>("");
  const [createFormColor, setCreateFormColor] = useState<string>("#c85a2a");
  const [createFormError, setCreateFormError] = useState<string>("");
  const tabsLongPressTimer = React.useRef<NodeJS.Timeout | null>(null);
  const [tabsLongPressStart, setTabsLongPressStart] = useState<{ x: number; y: number } | null>(null);

  const AVAILABLE_COLORS = ["#c85a2a", "#7F77DD", "#378ADD", "#1D9E75", "#BA7517", "#D4537E", "#4aaa6a", "#5aaacc"];

  // Grid Long Press Options Modal
  const [showGridLongPressOptions, setShowGridLongPressOptions] = useState(false);
  const [gridLongPressAction, setGridLongPressAction] = useState<"create-skill" | "create-area" | null>(null);

  // Helper: determine if an event originates from an interactive element
  const isInteractiveTarget = (e: React.MouseEvent | React.TouchEvent) => {
    const target = e.target as HTMLElement | null;
    return !!target?.closest("input, select, textarea, button, [role=\"button\"]");
  };

  // If any modal/context menu is open, we should not run grid long-press handlers
  const anyModalOpen = showNewSkillForm || showCreateAreaProjectForm || showGridLongPressOptions || !!metaSkillId || !!contextMenu;

  // Get skills from context
  const { 
    areas,
    projects,
    activeArea,
    activeAreaId: contextActiveAreaId,
    globalSkills,
    createGlobalSkill
  } = useSkillTree();

  // Determine which area to display
  const displayAreaId = activeAreaId || contextActiveAreaId || areas[0]?.id || "";
  const currentArea = areas.find((a) => a.id === displayAreaId);

  // Initialize activeAreaIds on first load - show first area by default
  React.useEffect(() => {
    if (activeAreaIds.length === 0 && areas.length > 0) {
      const detectAreasWithSkills = async () => {
        const areasWithSkills: string[] = [];
        
        for (const area of areas) {
          try {
            const res = await fetch(`/api/global-skills/area/${area.id}`);
            const skills = await res.json();
            if (Array.isArray(skills) && skills.length > 0) {
              areasWithSkills.push(area.id);
            }
          } catch (error) {
            console.error(`Error fetching skills for area ${area.id}:`, error);
          }
        }

        // If areas with skills are found, use them. Otherwise use first area
        if (areasWithSkills.length > 0) {
          setActiveAreaIds(areasWithSkills);
          setActiveAreaId(areasWithSkills[0]);
        } else {
          const defaultAreaId = areaId || areas[0].id;
          setActiveAreaIds([defaultAreaId]);
          setActiveAreaId(defaultAreaId);
        }
      };

      detectAreasWithSkills();
    }
  }, [areas, areaId]);

  // Fetch global skills for area (these are the base skills from journal, not skill tree nodes)
  const { data: globalSkillsForArea = [], refetch } = useQuery<GlobalSkillData[]>({
    queryKey: ["global-skills-area", displayAreaId],
    queryFn: async () => {
      if (!displayAreaId) return [];
      const res = await fetch(`/api/global-skills/area/${displayAreaId}`);
      return res.json();
    },
    enabled: !!displayAreaId,
  });

  // Sort journal skills by creation time so new skills are appended toward the bottom
  const journalSkills = useMemo(() => {
    return [...globalSkillsForArea].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (aTime !== bTime) return aTime - bTime;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [globalSkillsForArea]);

  const groupSkillsIntoRows = (skills: GlobalSkillData[]) => {
    const rows: GlobalSkillData[][] = [];
    let index = 0;
    let takeTwo = true;

    while (index < skills.length) {
      const size = takeTwo ? 2 : 1;
      rows.push(skills.slice(index, index + size));
      index += size;
      takeTwo = !takeTwo;
    }

    return rows;
  };

  // Split areas: active, and inactive
  const activeAreas = areas.filter((a) => activeAreaIds.includes(a.id));
  const inactiveAreas = areas.filter((a) => !activeAreaIds.includes(a.id));

  const handleAreaChange = (newAreaId: string) => {
    if (!activeAreaIds.includes(newAreaId)) {
      setActiveAreaIds([...activeAreaIds, newAreaId]);
    }
    setActiveAreaId(newAreaId);
    setSelectedSkillId(null);
    setDropdownOpen(false);
  };

  const handleActivateArea = (newAreaId: string) => {
    if (!activeAreaIds.includes(newAreaId)) {
      setActiveAreaIds([...activeAreaIds, newAreaId]);
    }
    setActiveAreaId(newAreaId);
    setSelectedSkillId(null);
    setDropdownOpen(false);
  };

  const handleHideArea = (areaIdToHide: string) => {
    const newActiveAreaIds = activeAreaIds.filter((id) => id !== areaIdToHide);
    setActiveAreaIds(newActiveAreaIds);
    setAreaContextMenu(null);

    // If the hidden area was selected, switch to the first active area
    if (activeAreaId === areaIdToHide) {
      if (newActiveAreaIds.length > 0) {
        setActiveAreaId(newActiveAreaIds[0]);
      } else {
        setActiveAreaId("");
      }
    }
  };

  const getIconForSkill = (title: string): string => {
    const lowerTitle = title.toLowerCase();
    for (const [key, icon] of Object.entries(SKILL_ICONS)) {
      if (lowerTitle.includes(key)) {
        return icon;
      }
    }
    // Default icon if no match
    return `<circle cx="14" cy="14" r="5" fill="none"/>`;
  };

  const handleLongPress = (skillId: string, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const x = 'clientX' in e ? e.clientX : e.touches[0].clientX;
    const y = 'clientY' in e ? e.clientY : e.touches[0].clientY;
    setContextMenu({ x, y, skillId });
  };

  const handleMouseDown = (skillId: string, e: React.MouseEvent | React.TouchEvent) => {
    longPressTimer.current = setTimeout(() => {
      handleLongPress(skillId, e);
    }, 500);
  };

  const handleMouseUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleAddMeta = (skillId: string) => {
    const skill = globalSkillsForArea.find((s) => s.id === skillId);
    if (skill) {
      setMetaSkillId(skillId);
      setGoalXpValue(String(skill.goalXp || ""));
      setMetaUnlimited(!skill.goalXp || skill.goalXp === 0);
      setContextMenu(null);
    }
  };

  const handleSaveMeta = async () => {
    if (!metaSkillId) return;
    
    // Find the skill to get currentLevel for validation
    const skill = globalSkillsForArea.find((s) => s.id === metaSkillId);
    if (!skill) {
      console.error("Skill not found");
      return;
    }

    // goalXp now represents LEVEL objective
    const newGoalLevel = metaUnlimited ? 0 : (parseInt(goalXpValue) || 0);
    const currentLevel = Math.floor(skill.currentXp / 100) + 1;
    
    if (!metaUnlimited && newGoalLevel < currentLevel) {
      alert(`La meta debe ser un nivel mayor o igual a ${currentLevel} (nivel actual)`);
      return;
    }

    try {
      const response = await fetch(`/api/global-skills/${metaSkillId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ goalXp: newGoalLevel }),
      });
      if (response.ok) {
        setMetaSkillId(null);
        setGoalXpValue("");
        setMetaUnlimited(false);
        refetch(); // Use refetch instead of reload
      }
    } catch (error) {
      console.error("Error saving meta:", error);
    }
  };

  const handleDeleteSkill = async (skillId: string) => {
    if (!confirm("¿Estás seguro de que querés borrar este skill?")) return;
    try {
      const response = await fetch(`/api/global-skills/${skillId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (response.ok) {
        setContextMenu(null);
        refetch(); // Use refetch instead of reload
      }
    } catch (error) {
      console.error("Error deleting skill:", error);
    }
  };

  // Long press handlers for new skill
  const handleGridLongPressStart = (e: React.MouseEvent | React.TouchEvent) => {
    // Ignore long-press if the event comes from an interactive control
    if (isInteractiveTarget(e)) return;

    const x = 'clientX' in e ? e.clientX : e.touches[0].clientX;
    const y = 'clientY' in e ? e.clientY : e.touches[0].clientY;
    setLongPressStart({ x, y });

    longPressTimerRef.current = setTimeout(() => {
      setShowGridLongPressOptions(true);
    }, 600);
  };

  const handleGridLongPressEnd = (e?: React.MouseEvent | React.TouchEvent) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    // Check if moved more than 10px
    if (e && longPressStart) {
      const x = 'clientX' in e ? e.clientX : e.changedTouches[0].clientX;
      const y = 'clientY' in e ? e.clientY : e.changedTouches[0].clientY;
      const distance = Math.sqrt(Math.pow(x - longPressStart.x, 2) + Math.pow(y - longPressStart.y, 2));
      if (distance > 10) {
        setShowNewSkillForm(false);
      }
    }

    setLongPressStart(null);
  };

  const handleCreateNewSkill = async () => {
    setNewSkillError("");

    // Validate name
    if (!newSkillName.trim()) {
      setNewSkillError("El nombre del skill es requerido");
      return;
    }

    // Validate link ID
    if (!newSkillLinkId) {
      setNewSkillError(newSkillLinkType === "area" ? "Selecciona un área" : "Selecciona un proyecto");
      return;
    }

    // Validate level goal
    const levelGoal = newSkillUnlimited ? 0 : (parseInt(newSkillXpMax) || 0);
    if (!newSkillUnlimited && (!levelGoal || levelGoal < 1)) {
      setNewSkillError("El nivel meta debe ser mínimo 1");
      return;
    }

    try {
      const newSkill = await createGlobalSkill(
        newSkillName.trim(),
        newSkillLinkType === "area" ? newSkillLinkId : undefined,
        newSkillLinkType === "project" ? newSkillLinkId : undefined
      );

      if (!newSkill) {
        setNewSkillError("Error al crear skill");
        return;
      }

      if (levelGoal > 0) {
        await fetch(`/api/global-skills/${newSkill.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ goalXp: levelGoal }),
        });
      }

      // Reset form
      setNewSkillName("");
      setNewSkillXpMax("");
      setNewSkillUnlimited(false);
      setNewSkillLinkType("area");
      setNewSkillLinkId("");
      setNewSkillError("");
      setShowNewSkillForm(false);
      refetch();
    } catch (error) {
      console.error("Error creating skill:", error);
      setNewSkillError("Error al crear skill");
    }
  };

  // Handle long press on area tab
  const handleAreaTabMouseDown = (areaId: string, e: React.MouseEvent | React.TouchEvent) => {
    areaLongPressTimer.current = setTimeout(() => {
      e.preventDefault();
      const x = 'clientX' in e ? e.clientX : e.touches[0].clientX;
      const y = 'clientY' in e ? e.clientY : e.touches[0].clientY;
      setAreaContextMenu({ x, y, areaId });
    }, 600);
  };

  const handleAreaTabMouseUp = () => {
    if (areaLongPressTimer.current) {
      clearTimeout(areaLongPressTimer.current);
    }
  };

  // Handle long press on tabs container to create new area/project
  const handleTabsLongPressStart = (e: React.MouseEvent | React.TouchEvent) => {
    // Don't trigger if clicking on existing tabs or buttons
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }

    const x = 'clientX' in e ? e.clientX : e.touches[0].clientX;
    const y = 'clientY' in e ? e.clientY : e.touches[0].clientY;
    setTabsLongPressStart({ x, y });

    tabsLongPressTimer.current = setTimeout(() => {
      setShowCreateAreaProjectForm(true);
      setCreateFormType("area");
      setCreateFormName("");
      setCreateFormColor("#c85a2a");
      setCreateFormError("");
    }, 600);
  };

  const handleTabsLongPressEnd = () => {
    if (tabsLongPressTimer.current) {
      clearTimeout(tabsLongPressTimer.current);
    }
    // Check if moved more than 10px
    if (tabsLongPressStart) {
      const x = tabsLongPressStart.x;
      const y = tabsLongPressStart.y;
      // Distance check can be added here if needed
    }
    setTabsLongPressStart(null);
  };

  // Validate area/project name
  const validateAreaProjectName = (): boolean => {
    if (!createFormName.trim()) {
      setCreateFormError("El nombre es requerido");
      return false;
    }

    const isDuplicate = createFormType === "area"
      ? areas.some((a) => a.name.toLowerCase() === createFormName.toLowerCase())
      : projects.some((p) => p.name.toLowerCase() === createFormName.toLowerCase());

    if (isDuplicate) {
      setCreateFormError(`Ya existe un ${createFormType === "area" ? "área" : "proyecto"} con ese nombre`);
      return false;
    }

    return true;
  };

  // Create new area or project
  const handleCreateAreaProject = async () => {
    if (!validateAreaProjectName()) {
      return;
    }

    try {
      const endpoint = createFormType === "area" ? "/api/areas" : "/api/projects";
      const payload = {
        name: createFormName,
        icon: createFormType === "area" ? "◆" : "★", // Default icons
        color: createFormColor,
        ...(createFormType === "project" && { questType: "main" }),
      };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const newItem = await response.json();
        
        // Add to active list and select it
        if (createFormType === "area") {
          setActiveAreaIds([...activeAreaIds, newItem.id]);
          setActiveAreaId(newItem.id);
        }

        // Reset form
        setShowCreateAreaProjectForm(false);
        setCreateFormName("");
        setCreateFormColor("#c85a2a");
        setCreateFormError("");
      } else {
        setCreateFormError("Error al crear " + (createFormType === "area" ? "área" : "proyecto"));
      }
    } catch (error) {
      console.error("Error creating area/project:", error);
      setCreateFormError("Error al crear " + (createFormType === "area" ? "área" : "proyecto"));
    }
  };

    // Ensure body pointer events are enabled while any modal is open.
    // Some 3rd-party layers may set `body.style.pointerEvents = 'none'` which
    // prevents inputs from receiving focus/clicks. Force it to 'auto' while
    // our modals/menus are visible and restore previous value afterwards.
    React.useEffect(() => {
      if (!anyModalOpen) return;

      const prev = document.body.style.pointerEvents;
      document.body.style.pointerEvents = "auto";
      return () => {
        document.body.style.pointerEvents = prev;
      };
    }, [anyModalOpen]);

  // Derive areaColor from currentArea
  const areaColor = currentArea?.color || AREA_COLORS[displayAreaId?.toLowerCase()] || "#c85a2a";

  // Derive selectedSkill from selectedSkillId and transform to SkillData format
  const globalSelectedSkill = selectedSkillId
    ? globalSkillsForArea.find((s) => s.id === selectedSkillId)
    : null;

  const selectedSkill = globalSelectedSkill
    ? {
        id: globalSelectedSkill.id,
        title: globalSelectedSkill.name,
        level: globalSelectedSkill.level,
        status: globalSelectedSkill.status,
        currentXp: globalSelectedSkill.currentXp,
        goalXp: globalSelectedSkill.goalXp,
        areaName: currentArea?.name || "",
      }
    : null;

  return (
    <div className="w-full h-full flex flex-col gap-3">
      {/* Area Tabs - Scrolleable */}
      <div
        className="overflow-x-auto overflow-y-hidden"
        ref={tabsContainerRef}
        onMouseDown={!anyModalOpen ? handleTabsLongPressStart : undefined}
        onMouseUp={!anyModalOpen ? handleTabsLongPressEnd : undefined}
        onMouseLeave={!anyModalOpen ? handleTabsLongPressEnd : undefined}
        onTouchStart={!anyModalOpen ? handleTabsLongPressStart : undefined}
        onTouchEnd={!anyModalOpen ? handleTabsLongPressEnd : undefined}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="w-full flex gap-1 justify-start bg-transparent p-0 min-w-min">
          {/* Active Area Tabs */}
          {activeAreas.map((area) => (
            <button
              key={area.id}
              onClick={() => handleAreaChange(area.id)}
              onMouseDown={(e) => handleAreaTabMouseDown(area.id, e)}
              onMouseUp={handleAreaTabMouseUp}
              onMouseLeave={handleAreaTabMouseUp}
              onTouchStart={(e) => handleAreaTabMouseDown(area.id, e)}
              onTouchEnd={handleAreaTabMouseUp}
              className="text-xs px-3 py-2 whitespace-nowrap flex-shrink-0 rounded transition-all"
              style={{
                backgroundColor: activeAreaId === area.id ? AREA_COLORS[area.id.toLowerCase()] || "#666" : "transparent",
                opacity: activeAreaId === area.id ? 1 : 0.6,
                cursor: "pointer",
              }}
            >
              {area.name}
            </button>
          ))}

          {/* Plus button dropdown for inactive areas */}
          {inactiveAreas.length > 0 && (
            <div className="relative flex-shrink-0">
              <button
                ref={plusButtonRef}
                onClick={() => {
                  if (!dropdownOpen && plusButtonRef.current) {
                    const rect = plusButtonRef.current.getBoundingClientRect();
                    const dropdownWidth = 180;
                    const dropdownHeight = Math.min(154, inactiveAreas.length * 36 + 8);

                    // Anclar al borde izquierdo del botón, abrir hacia abajo
                    let left = rect.left;
                    let top = rect.bottom + 4;

                    // Si se sale por la derecha, mover hacia la izquierda
                    if (left + dropdownWidth > window.innerWidth - 10) {
                      left = rect.right - dropdownWidth;
                    }

                    // Si se sale por abajo, abrir hacia arriba
                    if (top + dropdownHeight > window.innerHeight - 10) {
                      top = rect.top - dropdownHeight - 4;
                    }

                    setDropdownPos({ top, left });
                  }
                  setDropdownOpen(!dropdownOpen);
                }}
                className="text-xs px-3 py-2 whitespace-nowrap rounded transition-all text-amber-700 hover:bg-amber-700/20"
              >
                ＋
              </button>
              {dropdownOpen && dropdownPos && ReactDOM.createPortal(
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setDropdownOpen(false)}
                    onWheel={(e) => e.stopPropagation()}
                  />
                  <div
                    className="fixed rounded border custom-scrollbar"
                    style={{
                      backgroundColor: "#0e0c0a",
                      borderColor: "#3a2a14",
                      top: `${dropdownPos.top}px`,
                      left: `${dropdownPos.left}px`,
                      width: "180px",
                      maxHeight: "154px",
                      overflowY: "auto",
                      overflowX: "hidden",
                      zIndex: 9999,
                      pointerEvents: "all",
                    }}
                    onWheel={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {inactiveAreas.map((area) => (
                      <button
                        key={area.id}
                        onClick={() => handleActivateArea(area.id)}
                        className="block w-full text-left px-3 py-2 text-xs hover:bg-amber-700/20 transition-colors border-b border-amber-700/10 last:border-b-0"
                        style={{ color: "#c8a96e" }}
                      >
                        {area.name}
                      </button>
                    ))}
                  </div>
                </>,
                document.body
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content - Grid + Details */}
      <div className="flex flex-1 gap-3 overflow-hidden">
        {/* Skills Grid */}
        <div
          ref={gridContainerRef}
          className="flex-1 flex flex-col gap-4 overflow-y-auto pr-2"
          // Disable long-press handlers while any modal/context menu is open
          onMouseDown={!anyModalOpen ? handleGridLongPressStart : undefined}
          onMouseUp={!anyModalOpen ? handleGridLongPressEnd : undefined}
          onMouseLeave={!anyModalOpen ? handleGridLongPressEnd : undefined}
          onTouchStart={!anyModalOpen ? handleGridLongPressStart : undefined}
          onTouchEnd={!anyModalOpen ? handleGridLongPressEnd : undefined}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="flex flex-col items-center gap-4 mx-auto w-full">
            {groupSkillsIntoRows(journalSkills).map((row, rowIndex) => (
              <div
                key={`row-${rowIndex}`}
                className="flex items-center justify-center gap-8"
              >
                {row.map((skill) => (
                  <div
                    key={skill.id}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      handleMouseDown(skill.id, e);
                    }}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      handleMouseDown(skill.id, e);
                    }}
                    onTouchEnd={handleMouseUp}
                  >
                    <SkillDiamond
                      skill={{
                        id: skill.id,
                        title: skill.name,
                        level: skill.level,
                        status: skill.status,
                        currentXp: skill.currentXp,
                        goalXp: skill.goalXp,
                        icon: getIconForSkill(skill.name),
                      }}
                      areaColor={areaColor}
                      selected={selectedSkillId === skill.id}
                      onClick={() => setSelectedSkillId(selectedSkillId === skill.id ? null : skill.id)}
                      size={56}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Details Panel - Hidden on mobile, shown as modal */}
        {!isMobile && (
          <div className="w-48 border-l border-gray-700 pl-3 overflow-y-auto custom-scrollbar">
            <SkillGridDetail
              skill={selectedSkill}
              areaColor={areaColor}
            />
          </div>
        )}
      </div>

      {/* Mobile Detail Modal */}
      {isMobile && selectedSkill && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end md:hidden">
          <div className="w-full bg-background border-t border-gray-700 rounded-t-lg p-4 max-h-96">
            <SkillGridDetail
              skill={selectedSkill}
              areaColor={areaColor}
              onClose={() => setSelectedSkillId(null)}
            />
          </div>
        </div>
      )}

      {/* Context Menu for Skills */}
      {contextMenu && (
        <>
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 999,
            }}
            onClick={() => setContextMenu(null)}
          />
          <div
            style={{
              position: "fixed",
              top: contextMenu.y,
              left: contextMenu.x,
              zIndex: 1000,
              backgroundColor: "#0e0c0a",
              border: "1px solid #3a2a14",
              borderRadius: "4px",
              boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
              minWidth: "140px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAddMeta(contextMenu.skillId);
              }}
              className="block w-full text-left px-3 py-2 text-xs hover:bg-amber-700/20 transition-colors"
              style={{ color: "#c8a96e" }}
            >
              Agregar meta
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteSkill(contextMenu.skillId);
              }}
              className="block w-full text-left px-3 py-2 text-xs hover:bg-red-700/20 transition-colors"
              style={{ color: "#ff6b6b" }}
            >
              Borrar
            </button>
          </div>
        </>
      )}

      {/* Context Menu for Area Tabs */}
      {areaContextMenu && (
        <>
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 999,
            }}
            onClick={() => setAreaContextMenu(null)}
          />
          <div
            style={{
              position: "fixed",
              top: areaContextMenu.y,
              left: areaContextMenu.x,
              zIndex: 1000,
              backgroundColor: "#0e0c0a",
              border: "1px solid #3a2a14",
              borderRadius: "4px",
              boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
              minWidth: "140px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleHideArea(areaContextMenu.areaId);
              }}
              className="block w-full text-left px-3 py-2 text-xs hover:bg-amber-700/20 transition-colors"
              style={{ color: "#c8a96e" }}
            >
              Ocultar área
            </button>
          </div>
        </>
      )}

      {/* Grid Long Press Options Modal */}
      {showGridLongPressOptions && ReactDOM.createPortal(
        <>
          <div
            className="fixed inset-0"
            style={{
              backgroundColor: "rgba(0,0,0,0.5)",
              zIndex: 9998,
              pointerEvents: "auto",
            }}
            onClick={() => setShowGridLongPressOptions(false)}
          />
          <div
            className="fixed inset-0 flex items-center justify-center p-4"
            style={{ zIndex: 9999, pointerEvents: "auto" }}
          >
            <div
              className="rounded-lg p-6 max-w-sm w-full"
              style={{
                backgroundColor: "#0e0c0a",
                border: "1px solid #3a2a14",
                pointerEvents: "auto",
              }}
              onClick={(e) => e.stopPropagation()}
              onPointerDownCapture={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-semibold mb-4" style={{ color: "#c8a96e" }}>
                ¿Qué quieres crear?
              </h2>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    setShowGridLongPressOptions(false);
                    setCreateFormType("area");
                    setCreateFormName("");
                    setCreateFormColor("#c85a2a");
                    setCreateFormError("");
                    setShowCreateAreaProjectForm(true);
                  }}
                  className="px-4 py-3 rounded text-sm font-semibold transition-colors"
                  style={{
                    backgroundColor: "#c85a2a",
                    color: "#0e0c0a",
                  }}
                >
                  Crear Área
                </button>
                <button
                  onClick={() => {
                    setShowGridLongPressOptions(false);
                    setShowNewSkillForm(true);
                  }}
                  className="px-4 py-3 rounded text-sm font-semibold transition-colors"
                  style={{
                    backgroundColor: "#c85a2a",
                    color: "#0e0c0a",
                  }}
                >
                  Crear Skill
                </button>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* New Skill Form Modal */}
      {showNewSkillForm && ReactDOM.createPortal(
        <>
          <div
            className="fixed inset-0"
            style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 9998, pointerEvents: "auto" }}
            onClick={() => setShowNewSkillForm(false)}
          />
          <div
            className="fixed inset-0 flex items-center justify-center p-4"
            style={{ zIndex: 9999, pointerEvents: "auto" }}
          >
            <div
              className="rounded-lg p-6 max-w-md w-full"
              style={{
                backgroundColor: "#0e0c0a",
                border: "1px solid #3a2a14",
                pointerEvents: "auto",
              }}
              onClick={(e) => e.stopPropagation()}
              onPointerDownCapture={(e) => e.stopPropagation()}
            >
              {/* Title */}
              <h2 className="text-lg font-semibold mb-4" style={{ color: "#c8a96e" }}>
                Nuevo skill
              </h2>

              {/* Error message */}
              {newSkillError && (
                <div className="mb-4 p-2 rounded text-xs" style={{ backgroundColor: "#c85a2a", color: "#0e0c0a" }}>
                  {newSkillError}
                </div>
              )}

              {/* Skill name input */}
              <input
                type="text"
                value={newSkillName}
                onChange={(e) => setNewSkillName(e.target.value)}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.nativeEvent.stopImmediatePropagation();
                  (e.target as HTMLInputElement).focus();
                }}
                autoFocus
                placeholder="Nombre del skill"
                className="w-full px-3 py-2 mb-4 rounded text-xs focus:outline-none transition-colors"
                style={{
                  backgroundColor: "#130f09",
                  border: "1px solid #3a2a14",
                  color: "#c8a96e",
                  pointerEvents: "auto",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#c8a96e")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#3a2a14")}
              />

              {/* Level goal section */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-xs" style={{ color: "#c8a96e" }}>
                    Meta de nivel
                  </label>
                  <input
                    type="checkbox"
                    checked={newSkillUnlimited}
                    onChange={(e) => setNewSkillUnlimited(e.target.checked)}
                    onPointerDown={(e) => e.stopPropagation()}
                    style={{ pointerEvents: "auto" }}
                  />
                  <label className="text-xs" style={{ color: "#c8a96e" }}>
                    Sin límite
                  </label>
                </div>
                {!newSkillUnlimited && (
                  <input
                    type="number"
                    value={newSkillXpMax}
                    onChange={(e) => setNewSkillXpMax(e.target.value)}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      e.currentTarget.focus();
                    }}
                    placeholder="ej: 5"
                    className="w-full px-3 py-2 rounded text-xs focus:outline-none transition-colors"
                    style={{
                      backgroundColor: "#130f09",
                      border: "1px solid #3a2a14",
                      color: "#c8a96e",
                      pointerEvents: "auto",
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "#c8a96e")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "#3a2a14")}
                  />
                )}
              </div>

              {/* Link Type Selector */}
              <div className="mb-4">
                <label className="text-xs block mb-2" style={{ color: "#c8a96e" }}>
                  Linkeado a
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setNewSkillLinkType("area");
                      setNewSkillLinkId("");
                    }}
                    className="flex-1 px-3 py-2 rounded text-xs transition-colors"
                    style={{
                      backgroundColor: newSkillLinkType === "area" ? "#c85a2a" : "#130f09",
                      border: newSkillLinkType === "area" ? "2px solid #c8a96e" : "1px solid #3a2a14",
                      color: newSkillLinkType === "area" ? "#0e0c0a" : "#c8a96e",
                    }}
                  >
                    Área
                  </button>
                  <button
                    onClick={() => {
                      setNewSkillLinkType("project");
                      setNewSkillLinkId("");
                    }}
                    className="flex-1 px-3 py-2 rounded text-xs transition-colors"
                    style={{
                      backgroundColor: newSkillLinkType === "project" ? "#c85a2a" : "#130f09",
                      border: newSkillLinkType === "project" ? "2px solid #c8a96e" : "1px solid #3a2a14",
                      color: newSkillLinkType === "project" ? "#0e0c0a" : "#c8a96e",
                    }}
                  >
                    Proyecto
                  </button>
                </div>
              </div>

              {/* Area/Project Selector */}
              <div className="mb-4">
                <label className="text-xs block mb-2" style={{ color: "#c8a96e" }}>
                  {newSkillLinkType === "area" ? "Selecciona un área" : "Selecciona un proyecto"}
                </label>
                <select
                  value={newSkillLinkId}
                  onChange={(e) => setNewSkillLinkId(e.target.value)}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="w-full px-3 py-2 rounded text-xs focus:outline-none transition-colors"
                  style={{
                    backgroundColor: "#130f09",
                    border: "1px solid #3a2a14",
                    color: "#c8a96e",
                    pointerEvents: "auto",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#c8a96e")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#3a2a14")}
                >
                  <option value="">
                    {newSkillLinkType === "area" ? "-- Selecciona un área --" : "-- Selecciona un proyecto --"}
                  </option>
                  {newSkillLinkType === "area"
                    ? areas.map((area) => (
                        <option key={area.id} value={area.id}>
                          {area.name}
                        </option>
                      ))
                    : projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                </select>
              </div>

              {/* Buttons */}
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowNewSkillForm(false)}
                  className="px-3 py-2 rounded text-xs transition-colors"
                  style={{
                    backgroundColor: "transparent",
                    border: "1px solid #5a4a2a",
                    color: "#5a4a2a",
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateNewSkill}
                  className="px-3 py-2 rounded text-xs font-semibold transition-colors"
                  style={{
                    backgroundColor: "#c85a2a",
                    color: "#0e0c0a",
                  }}
                >
                  Agregar
                </button>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Meta Modal */}
      {metaSkillId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
          }}
          onClick={() => setMetaSkillId(null)}
        >
          <div
            style={{
              backgroundColor: "#1a1410",
              border: "1px solid #2a1e0e",
              borderRadius: "8px",
              padding: "20px",
              maxWidth: "400px",
              width: "90%",
            }}
            onClick={(e) => e.stopPropagation()}
            onPointerDownCapture={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-amber-700 mb-4">Agregar meta de nivel</h3>
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <label className="text-xs text-amber-700">Meta de nivel</label>
                <input
                  type="checkbox"
                  checked={metaUnlimited}
                  onChange={(e) => setMetaUnlimited(e.target.checked)}
                  onPointerDown={(e) => e.stopPropagation()}
                  style={{ pointerEvents: "auto" }}
                />
                <label className="text-xs text-amber-700">Sin límite</label>
              </div>
              {!metaUnlimited && (
                <input
                  type="number"
                  value={goalXpValue}
                  onChange={(e) => setGoalXpValue(e.target.value)}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    (e.currentTarget as HTMLInputElement).focus();
                  }}
                  placeholder="Nivel a alcanzar"
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-xs text-amber-700"
                  style={{ pointerEvents: "auto" }}
                />
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveMeta}
                className="flex-1 px-3 py-2 bg-amber-700 text-white text-xs rounded hover:bg-amber-600"
              >
                Guardar
              </button>
              <button
                onClick={() => setMetaSkillId(null)}
                className="flex-1 px-3 py-2 bg-gray-700 text-white text-xs rounded hover:bg-gray-600"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Area/Project Modal */}
      {showCreateAreaProjectForm && ReactDOM.createPortal(
        <>
          <div
            className="fixed inset-0"
            style={{
              backgroundColor: "rgba(0,0,0,0.5)",
              zIndex: 9998,
              pointerEvents: "auto",
            }}
            onClick={() => setShowCreateAreaProjectForm(false)}
          />
          <div
            className="fixed inset-0 flex items-center justify-center p-4"
            style={{ zIndex: 9999, pointerEvents: "auto" }}
          >
            <div
              className="rounded-lg p-6 max-w-md w-full"
              style={{
                backgroundColor: "#0e0c0a",
                border: "1px solid #3a2a14",
                pointerEvents: "auto",
              }}
              onClick={(e) => e.stopPropagation()}
              onPointerDownCapture={(e) => e.stopPropagation()}
              
            >
              {/* Title */}
              <h2 className="text-lg font-semibold mb-4" style={{ color: "#c8a96e" }}>
                Nueva {createFormType === "area" ? "área" : "proyecto"}
              </h2>

              {/* Error message */}
              {createFormError && (
                <div className="mb-4 p-2 rounded text-xs" style={{ backgroundColor: "#c85a2a", color: "#0e0c0a" }}>
                  {createFormError}
                </div>
              )}

              {/* Type selector */}
              <div className="mb-4">
                <label className="text-xs block mb-2" style={{ color: "#c8a96e" }}>
                  Tipo
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCreateFormType("area")}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="flex-1 px-3 py-2 rounded text-xs transition-colors"
                    style={{
                      backgroundColor: createFormType === "area" ? "#c85a2a" : "#130f09",
                      border: createFormType === "area" ? "2px solid #c8a96e" : "1px solid #3a2a14",
                      color: createFormType === "area" ? "#0e0c0a" : "#c8a96e",
                    }}
                  >
                    Área
                  </button>
                  <button
                    onClick={() => setCreateFormType("project")}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="flex-1 px-3 py-2 rounded text-xs transition-colors"
                    style={{
                      backgroundColor: createFormType === "project" ? "#c85a2a" : "#130f09",
                      border: createFormType === "project" ? "2px solid #c8a96e" : "1px solid #3a2a14",
                      color: createFormType === "project" ? "#0e0c0a" : "#c8a96e",
                    }}
                  >
                    Proyecto
                  </button>
                </div>
              </div>

              {/* Name input */}
              <input
                type="text"
                value={createFormName}
                onChange={(e) => setCreateFormName(e.target.value)}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.nativeEvent.stopImmediatePropagation();
                  (e.target as HTMLInputElement).focus();
                }}
                autoFocus
                placeholder="Nombre"
                className="w-full px-3 py-2 mb-4 rounded text-xs focus:outline-none transition-colors"
                style={{
                  backgroundColor: "#130f09",
                  border: "1px solid #3a2a14",
                  color: "#c8a96e",
                  pointerEvents: "auto",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#c8a96e")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#3a2a14")}
              />

              {/* Color selector */}
              <div className="mb-4">
                <label className="text-xs block mb-2" style={{ color: "#c8a96e" }}>
                  Color
                </label>
                <div className="flex gap-2 flex-wrap">
                  {AVAILABLE_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setCreateFormColor(color)}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="w-6 h-6 rounded transition-all"
                      style={{
                        backgroundColor: color,
                        border: createFormColor === color ? "2px solid #c8a96e" : "1px solid #3a2a14",
                        opacity: createFormColor === color ? 1 : 0.6,
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCreateAreaProjectForm(false)}
                  className="flex-1 px-3 py-2 rounded text-xs font-semibold transition-colors"
                  style={{
                    backgroundColor: "transparent",
                    border: "1px solid #3a2a14",
                    color: "#5a4a2a",
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateAreaProject}
                  className="flex-1 px-3 py-2 rounded text-xs font-semibold transition-colors"
                  style={{
                    backgroundColor: "#c85a2a",
                    color: "#0e0c0a",
                  }}
                >
                  Crear
                </button>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
