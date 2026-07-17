import { motion, AnimatePresence } from "framer-motion";
import { type Skill, type GlobalSkill, useSkillTree } from "@/lib/skill-context";
import { type JournalThought, type JournalLearning, type JournalTool } from "@shared/schema";
import { cn } from "@/lib/utils";
import { Check, Lock, Trash2, ChevronUp, ChevronDown, Pencil, Plus, Star, ChevronRight, ChevronLeft, Wrench, Lightbulb, BicepsFlexed } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { type ExperienceGainSnapshot } from "./ExperienceGainPopup";
import { useXpPopup } from "@/lib/xp-popup-context";
import { useAreaXpPopup } from "@/lib/area-xp-popup-context";
import { useBodyProgress, BODY_ZONES, BODY_ZONE_LABELS, type BodyZone, type BodyDimension } from "@/lib/body-progress-context";
import { useBodyGainPopup } from "@/lib/body-gain-popup-context";
import { AREA_PROGRESS_XP_INCREMENT, calculateAreaProgressPercentage, countMasteredSkills } from "@/lib/area-progress";
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface SkillNodeProps {
  skill: Skill;
  areaColor: string;
  onClick: () => void;
  isFirstOfLevel?: boolean;
  isOnboardingTarget?: boolean;
  availableNodePosition?: number | null;
}

export function SkillNode({ skill, areaColor, onClick, isFirstOfLevel, isOnboardingTarget, availableNodePosition }: SkillNodeProps) {
  const isInicioNode = skill.title.toLowerCase() === "inicio"; // "inicio" nodes are text-only, not interactive
  const FIXED_XP_AMOUNT = 10;
  
  const { 
    activeAreaId, 
    activeProjectId,
    activeParentSkillId,
    activeArea,
    activeProject,
    areas,
    projects,
    subSkills,
    deleteSkill, 
    toggleLock, 
    moveSkill, 
    updateSkill,
    deleteProjectSkill,
    toggleProjectLock,
    moveProjectSkill,
    updateProjectSkill,
    deleteSubSkill,
    toggleSubSkillLock,
    moveSubSkill,
    updateSubSkill,
    enterSubSkillTree,
    addSkillBelow,
    addProjectSkillBelow,
    addSubSkillBelow,
    duplicateSkill,
    duplicateProjectSkill,
    duplicateSubSkill,
    updateLevelSubtitle,
    updateProjectLevelSubtitle,
    toggleFinalNode,
    toggleProjectFinalNode,
    toggleSubSkillFinalNode,
    globalSkills,
    getGlobalSkillsForArea,
    getGlobalSkillsForProject,
    createGlobalSkill,
    addXpToGlobalSkill,
    addAreaXp
  } = useSkillTree();
  
  const isProject = !activeAreaId && !!activeProjectId;
  const activeId = activeAreaId || activeProjectId;
  const isSubSkillView = !!activeParentSkillId;
  const activeScope = isProject ? activeProject : activeArea;
  
  // Calculate if all nodes in this level are mastered
  const currentSkills = isSubSkillView 
    ? subSkills 
    : isProject 
      ? (activeProject?.skills || []) 
      : (activeArea?.skills || []);
  const skillsInLevel = currentSkills.filter(s => s.level === skill.level);
  const isLevelCompleted = skillsInLevel.length > 0 && skillsInLevel.every(s => s.status === "mastered");
  
  // Calculate if this node is the last node of its level (by levelPosition, not Y)
  // This ensures visibility is always based on the current sequential position after reorders
  const isLastNodeOfLevel = skillsInLevel.length > 0 && 
    skill.levelPosition === Math.max(...skillsInLevel.map(s => s.levelPosition || 0));
  
  // Star is active only when endOfAreaLevel is set to this level
  // isFinalNode: 1 is just an identifier (always on Node 5), not the control
  const isStarActive = isProject 
    ? (activeProject?.endOfAreaLevel === skill.level)
    : (activeArea?.endOfAreaLevel === skill.level);
  
  console.log('[isStarActive] skill.level:', skill.level, 'activeArea?.endOfAreaLevel:', activeArea?.endOfAreaLevel, 'activeProject?.endOfAreaLevel:', activeProject?.endOfAreaLevel, 'isStarActive:', isStarActive);
  
  // Calculate effective locked state: final nodes (by position) should appear locked
  // if not all other nodes in level are mastered (UNLESS star is active, then node itself blocks)
  const isFinalNodeByPosition = isLastNodeOfLevel;
  const otherNodesInLevel = skillsInLevel.filter(s => s.id !== skill.id);
  const allOthersMastered = otherNodesInLevel.every(s => s.status === "mastered");
  
  // CRITICAL: First node of any level MUST ALWAYS appear mastered, never locked
  const isFirstNodeOfLevel = skill.levelPosition === 1;
  
  // Effective states: final nodes show as locked if others aren't mastered
  const shouldForceLock = isFinalNodeByPosition && skill.status !== "mastered" && !allOthersMastered;
  const isLocked = isFirstNodeOfLevel ? false : (skill.status === "locked" || shouldForceLock);
  const isMastered = isFirstNodeOfLevel ? true : skill.status === "mastered";

  // Mastered/confirmed nodes can only be used as the source for adding a new node
  // if they're the one immediately before the currently unlocked ("available") node
  // in this level. Older confirmed nodes further back in the chain can't spawn new
  // nodes, since that would let the user branch off history instead of the frontier.
  const isPredecessorOfAvailable = availableNodePosition != null && skill.levelPosition === availableNodePosition - 1;
  const canAddFromNode = !isMastered || isPredecessorOfAvailable;

  // Calculate distance-based opacity for locked nodes (Rule 6)
  let lockedNodeOpacity = 1; // default
  if (isLocked && availableNodePosition !== undefined && availableNodePosition !== null) {
    const distance = (skill.levelPosition ?? 0) - availableNodePosition;
    if (distance === 1) {
      lockedNodeOpacity = 0.7;
    } else if (distance === 2) {
      lockedNodeOpacity = 0.55;
    } else if (distance >= 3) {
      lockedNodeOpacity = 0.35;
    }
  }

  // Detect if node has default name (generated Nodo X format)
  const hasDefaultName = skill.title.startsWith("Nodo ") || skill.title === "Next challenge" || skill.title === "Next objetive quest" || skill.title === "Objective quest";

  // Default-named nodes get a mild extra fade, but distance to the active node stays
  // the dominant signal: a freshly-added node (necessarily still default-named) must
  // never look fainter than an already-named node sitting further away.
  if (isLocked && hasDefaultName) {
    lockedNodeOpacity *= 0.85;
  }
  
  // Check if swap would violate mastered/available constraint
  const canMoveUp = (): boolean | null => {
    // Rule 1: Node 1 (levelPosition === 1) - hide both arrows
    if (skill.levelPosition === 1) return null;
    
    // Rule 3: First non-Node-1 (levelPosition === 2) - hide up arrow
    if (skill.levelPosition === 2) return null;
    
    const sorted = [...skillsInLevel].sort((a, b) => a.y - b.y);
    const index = sorted.findIndex(s => s.id === skill.id);
    if (index <= 0) return false;
    
    const neighbor = sorted[index - 1];
    if (!neighbor) return false;
    
    // Hide button if mastered/available swap
    if ((skill.status === "mastered" && neighbor.status === "available") ||
        (skill.status === "available" && neighbor.status === "mastered")) {
      return null;
    }
    
    return true;
  };

  const canMoveDown = (): boolean | null => {
    // Rule 1: Node 1 (levelPosition === 1) - hide both arrows
    if (skill.levelPosition === 1) return null;
    
    // Rule 2: Final node - hide down arrow
    if (skill.isFinalNode === 1 || isLastNodeOfLevel) return null;
    
    const sorted = [...skillsInLevel].sort((a, b) => a.y - b.y);
    const index = sorted.findIndex(s => s.id === skill.id);
    if (index >= sorted.length - 1) return false;
    
    const neighbor = sorted[index + 1];
    if (!neighbor) return false;
    
    // Hide button if mastered/available swap
    if ((skill.status === "mastered" && neighbor.status === "available") ||
        (skill.status === "available" && neighbor.status === "mastered")) {
      return null;
    }
    
    return true;
  };
  
  const [isOpen, setIsOpen] = useState(false);
  const [popoverStep, setPopoverStep] = useState(0); // 0 = menu, 1 = journal tabs
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editStep, setEditStep] = useState(0);
  const [editTitle, setEditTitle] = useState(skill.title);
  const [editAction, setEditAction] = useState(skill.description?.split("\n\nWhen: ")[0] || "");
  const [editWhen, setEditWhen] = useState(skill.description?.split("\n\nWhen: ")[1] || "");
  const [editDescription, setEditDescription] = useState(skill.description || "");
  const [editFeedback, setEditFeedback] = useState(skill.feedback || "");
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);
  const lastClickTime = useRef<number>(0); // Debounce flag to prevent duplicate onClick calls
  
  const [isSubtitleDialogOpen, setIsSubtitleDialogOpen] = useState(false);
  const [isSubtaskConfirmOpen, setIsSubtaskConfirmOpen] = useState(false);
  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);
  const levelSubtitles = isProject ? (activeProject?.levelSubtitles || {}) : (activeArea?.levelSubtitles || {});
  const levelSubtitleDescriptions = isProject ? (activeProject?.levelSubtitleDescriptions || {}) : (activeArea?.levelSubtitleDescriptions || {});
  const currentSubtitle = levelSubtitles[skill.level.toString()] || "";
  const currentSubtitleDescription = levelSubtitleDescriptions[skill.level.toString()] || "";
  const trimmedLevelSubtitle = currentSubtitle.trim();
  const showCompletedLevelSubtitle = isFirstOfLevel && isLevelCompleted && trimmedLevelSubtitle.length > 0;
  const [editSubtitle, setEditSubtitle] = useState(currentSubtitle);
  const [editSubtitleDescription, setEditSubtitleDescription] = useState(currentSubtitleDescription);
  const levelLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTitleLongPress = useRef(false);

  // Tools & Learnings form state
  const queryClient = useQueryClient();
  const [feedbackActiveTab, setFeedbackActiveTab] = useState<"thoughts" | "tools" | "learnings" | "experience" | "body">("thoughts");
  const [thoughtTitle, setThoughtTitle] = useState("");
  const [thoughtSentence, setThoughtSentence] = useState("");
  const [toolTitle, setToolTitle] = useState("");
  const [toolSentence, setToolSentence] = useState("");
  const [learningTitle, setLearningTitle] = useState("");
  const [learningSentence, setLearningSentence] = useState("");
  
  const [levelUpPopupVisible, setLevelUpPopupVisible] = useState(false);
  const levelUpPopupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hasIncompleteSubtasks, setHasIncompleteSubtasks] = useState(false);
  
  const { showXpPopup, hideXpPopup } = useXpPopup();
  const { showAreaXpPopup } = useAreaXpPopup();
  const { addBodyBlock } = useBodyProgress();
  const { showBodyGainPopup, hideBodyGainPopup } = useBodyGainPopup();
  const [selectedBodyDimension, setSelectedBodyDimension] = useState<BodyDimension>("fuerza");
  const [selectedBodyZone, setSelectedBodyZone] = useState<BodyZone | null>(null);
  const [showBodyZoneSelector, setShowBodyZoneSelector] = useState(false);
  const activeScopeSkills = isProject ? (activeProject?.skills || []) : (activeArea?.skills || []);
  const activeScopeName = isProject ? (activeProject?.name || "Project") : (activeArea?.name || "Area");
  const activeScopeXp = activeScope?.currentXp ?? countMasteredSkills(activeScopeSkills);

  const triggerAreaProgressPopup = (xpBefore: number = activeScopeXp) => {
    if (!activeId) {
      return;
    }

    const progressBeforePct = calculateAreaProgressPercentage(xpBefore);
    const progressAfterPct = calculateAreaProgressPercentage(xpBefore + AREA_PROGRESS_XP_INCREMENT);

    showAreaXpPopup({
      areaOrProjectId: activeId,
      scopeName: activeScopeName,
      areaColor,
      progressBeforePct,
      progressAfterPct,
      bonusXp: AREA_PROGRESS_XP_INCREMENT,
      currentXp: xpBefore,
    });
  };
  
  // Queries for archivements (learnings, tools, thoughts by skillId)
  const { data: skillLearnings = [] } = useQuery({
    queryKey: ["/api/journal/learnings", skill.id],
    queryFn: async () => {
      const res = await fetch(`/api/journal/learnings?skillId=${skill.id}`);
      return res.json();
    },
  });

  const { data: skillTools = [] } = useQuery({
    queryKey: ["/api/journal/tools", skill.id],
    queryFn: async () => {
      const res = await fetch(`/api/journal/tools?skillId=${skill.id}`);
      return res.json();
    },
  });

  const { data: skillThoughts = [] } = useQuery({
    queryKey: ["/api/journal/thoughts", skill.id],
    queryFn: async () => {
      const res = await fetch(`/api/journal/thoughts?skillId=${skill.id}`);
      return res.json();
    },
  });

  // Experience tab state for editStep 2
  const [experienceSelectedSkill, setExperienceSelectedSkill] = useState<string | null>(null);
  const [showExperienceSkillSelector, setShowExperienceSkillSelector] = useState(false);
  
  // Legacy skill associations from localStorage
  const [legacySkillAssociations, setLegacySkillAssociations] = useState<Record<string, Array<{ type: "area" | "project"; id: string }>>>({});
  
  // Load legacy skill associations
  useEffect(() => {
    const stored = localStorage.getItem("legacySkillAssociations");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Migration: convert old single association to array
        const migrated: Record<string, Array<{ type: "area" | "project"; id: string }>> = {};
        Object.entries(parsed).forEach(([skill, assoc]) => {
          if (Array.isArray(assoc)) {
            migrated[skill] = assoc.filter(a =>
              a &&
              typeof a === 'object' &&
              (a.type === 'area' || a.type === 'project') &&
              typeof a.id === 'string'
            );
          } else if (
            assoc &&
            typeof assoc === 'object' &&
            ('type' in assoc) && ('id' in assoc) &&
            ((assoc as any).type === 'area' || (assoc as any).type === 'project') &&
            typeof (assoc as any).id === 'string'
          ) {
            migrated[skill] = [{
              type: (assoc as any).type,
              id: (assoc as any).id
            }];
          }
        });
        setLegacySkillAssociations(migrated);
      } catch (e) {
        console.error("Error parsing legacy skill associations:", e);
      }
    }
  }, []);
  
  // Filter legacy skills to only show ones associated with current area/project
  const filteredLegacySkills = ["Limpieza", "Guitarra", "Lectura", "Growth mindset", "Acertividad"].filter(skillName => {
    const associations = Array.isArray(legacySkillAssociations[skillName]) ? legacySkillAssociations[skillName] : [];
    if (associations.length === 0) return false;
    if (activeAreaId) {
      return associations.some(a => a.type === "area" && a.id === activeAreaId);
    }
    if (activeProjectId) {
      return associations.some(a => a.type === "project" && a.id === activeProjectId);
    }
    return false;
  });
  
  // XP state
  const [xpValue, setXpValue] = useState(FIXED_XP_AMOUNT.toString());
  const [showXpAnimation, setShowXpAnimation] = useState(false);
  const [animatedXpValue, setAnimatedXpValue] = useState("");

  const pendingXpValue = useRef<string>("");
  const prevStatus = useRef<string>(skill.status);
  const wasDialogOpen = useRef(false);
  
  // Add options popup state
  const [isAddOptionsOpen, setIsAddOptionsOpen] = useState(false);

  // Get available Global Skills for the current area/quest
  const availableGlobalSkills = activeAreaId 
    ? getGlobalSkillsForArea(activeAreaId)
    : activeProjectId 
      ? getGlobalSkillsForProject(activeProjectId) 
      : [];

  // State for subskill creation/selection in subtitle dialog
  const [newSubskillName, setNewSubskillName] = useState("");
  const [selectedSubskillId, setSelectedSubskillId] = useState<string | null>(null);
  const [showSubskillCreator, setShowSubskillCreator] = useState(false);

  // Get parent skills (not subskills) for the current area/quest
  const parentGlobalSkills = availableGlobalSkills.filter(s => !s.parentSkillId);

  // Show XP animation when skill becomes mastered
  useEffect(() => {
    if (prevStatus.current !== "mastered" && skill.status === "mastered" && pendingXpValue.current) {
      setAnimatedXpValue(pendingXpValue.current);
      setShowXpAnimation(true);
      setTimeout(() => {
        setShowXpAnimation(false);
        pendingXpValue.current = "";
      }, 1500);
    }
    prevStatus.current = skill.status;
  }, [skill.status]);

  // Update ref to track dialog open/close state
  useEffect(() => {
    wasDialogOpen.current = isEditDialogOpen;
  }, [isEditDialogOpen]);

  useEffect(() => {
    return () => {
      if (levelUpPopupTimer.current) {
        clearTimeout(levelUpPopupTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    const checkSubtasks = async () => {
      if (!isInicioNode) {
        try {
          const response = await fetch(`/api/skills/${skill.id}/subskills`);
          const subskills = await response.json();
          if (Array.isArray(subskills) && subskills.length > 0) {
            const hasIncomplete = subskills.some(s => s.status !== "mastered");
            setHasIncompleteSubtasks(hasIncomplete);
          } else {
            setHasIncompleteSubtasks(false);
          }
        } catch {
          setHasIncompleteSubtasks(false);
        }
      }
    };
    checkSubtasks();
  }, [skill.id, skill.status, activeParentSkillId]);

  const hasUnlockedWithIncompleteSubtasks = !isLocked && !isMastered && hasIncompleteSubtasks;

  const createThought = useMutation({
    mutationFn: async (data: { title: string; sentence: string; skillId: string }) => {
      const res = await fetch("/api/journal/thoughts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        console.error("Failed to create thought:", error);
        throw new Error(error.message || "Failed to create thought");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal/thoughts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/journal/thoughts", skill.id] });
    },
    onError: (error) => {
      console.error("createThought error:", error);
    },
  });

  const createLearning = useMutation({
    mutationFn: async (data: { title: string; sentence: string; skillId: string }) => {
      const res = await fetch("/api/journal/learnings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        console.error("Failed to create learning:", error);
        throw new Error(error.message || "Failed to create learning");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal/learnings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/journal/learnings", skill.id] });
    },
    onError: (error) => {
      console.error("createLearning error:", error);
    },
  });

  const createTool = useMutation({
    mutationFn: async (data: { title: string; sentence: string; skillId: string }) => {
      const res = await fetch("/api/journal/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        console.error("Failed to create tool:", error);
        throw new Error(error.message || "Failed to create tool");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal/tools"] });
      queryClient.invalidateQueries({ queryKey: ["/api/journal/tools", skill.id] });
    },
    onError: (error) => {
      console.error("createTool error:", error);
    },
  });

  const deleteThought = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/journal/thoughts/${id}`, {
        method: "DELETE",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal/thoughts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/journal/thoughts", skill.id] });
    },
  });

  const deleteLearning = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/journal/learnings/${id}`, {
        method: "DELETE",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal/learnings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/journal/learnings", skill.id] });
    },
  });

  const deleteTool = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/journal/tools/${id}`, {
        method: "DELETE",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal/tools"] });
      queryClient.invalidateQueries({ queryKey: ["/api/journal/tools", skill.id] });
    },
  });

  const handleAddThought = async () => {
    console.log("[handleAddThought] Called", {
      thoughtTitle: thoughtTitle.trim(),
      thoughtSentence: thoughtSentence.trim(),
      skillId: skill.id,
    });
    
    if (!thoughtTitle.trim()) {
      console.log("[handleAddThought] Title is empty, returning");
      return;
    }
    
    const payload = { 
      title: thoughtTitle.trim(), 
      sentence: thoughtSentence.trim(), 
      skillId: skill.id 
    };
    console.log("[handleAddThought] Calling mutation with:", payload);
    
    try {
      await createThought.mutateAsync(payload);
      setThoughtTitle("");
      setThoughtSentence("");
      if (activeId) {
        const areaXpUpdated = await addAreaXp(activeId, isProject, AREA_PROGRESS_XP_INCREMENT);
        if (areaXpUpdated) {
          triggerAreaProgressPopup();
        }
      }
    } catch {
      // Mutation error is already handled by the mutation's onError callback.
    }
  };

  const handleAddLearning = async () => {
    console.log("[handleAddLearning] Called", {
      learningTitle: learningTitle.trim(),
      learningSentence: learningSentence.trim(),
      skillId: skill.id,
    });
    
    if (!learningTitle.trim()) {
      console.log("[handleAddLearning] Title is empty, returning");
      return;
    }
    
    const payload = { 
      title: learningTitle.trim(), 
      sentence: learningSentence.trim(), 
      skillId: skill.id 
    };
    console.log("[handleAddLearning] Calling mutation with:", payload);
    
    try {
      await createLearning.mutateAsync(payload);
      setLearningTitle("");
      setLearningSentence("");
      if (activeId) {
        const areaXpUpdated = await addAreaXp(activeId, isProject, AREA_PROGRESS_XP_INCREMENT);
        if (areaXpUpdated) {
          triggerAreaProgressPopup();
        }
      }
    } catch {
      // Mutation error is already handled by the mutation's onError callback.
    }
  };

  const handleAddTool = async () => {
    console.log("[handleAddTool] Called", {
      toolTitle: toolTitle.trim(),
      toolSentence: toolSentence.trim(),
      skillId: skill.id,
    });
    
    if (!toolTitle.trim()) {
      console.log("[handleAddTool] Title is empty, returning");
      return;
    }
    
    const payload = { 
      title: toolTitle.trim(), 
      sentence: toolSentence.trim(), 
      skillId: skill.id 
    };
    console.log("[handleAddTool] Calling mutation with:", payload);
    
    try {
      await createTool.mutateAsync(payload);
      setToolTitle("");
      setToolSentence("");
      if (activeId) {
        const areaXpUpdated = await addAreaXp(activeId, isProject, AREA_PROGRESS_XP_INCREMENT);
        if (areaXpUpdated) {
          triggerAreaProgressPopup();
        }
      }
    } catch {
      // Mutation error is already handled by the mutation's onError callback.
    }
  };

  const handleAddExperience = async () => {
    console.log("[handleAddExperience] Called", {
      xpValue,
      experienceSelectedSkill,
    });
    
    if (!experienceSelectedSkill) {
      console.log("[handleAddExperience] Invalid inputs, returning");
      return;
    }
    
    const xpToAdd = FIXED_XP_AMOUNT;
    console.log("[handleAddExperience] XP to add:", xpToAdd, "SkillId:", experienceSelectedSkill);

    const buildSnapshot = (
      skillName: string,
      xpBefore: number,
      level: number,
      xpMax: number | null
    ): ExperienceGainSnapshot => ({
      skillName,
      areaColor,
      xpBefore,
      xpAfter: xpBefore + xpToAdd,
      xpMax,
      level,
    });
    
    // Check if it's a legacy skill
    if (experienceSelectedSkill.startsWith("legacy:")) {
      const legacySkillName = experienceSelectedSkill.replace("legacy:", "");
      console.log("[handleAddExperience] Adding XP to legacy skill:", legacySkillName);
      
      const skillsProgress = localStorage.getItem("skillsProgress");
      let skills: Record<string, { name: string; currentXp: number; level: number }> = {};
      
      if (skillsProgress) {
        try {
          skills = JSON.parse(skillsProgress);
        } catch (error) {
          console.error("[handleAddExperience] Error parsing skillsProgress:", error);
        }
      }
      
      // Initialize if skill doesn't exist
      if (!skills[legacySkillName]) {
        skills[legacySkillName] = { name: legacySkillName, currentXp: 0, level: 1 };
      }
      
      const legacySnapshot = buildSnapshot(
        legacySkillName,
        skills[legacySkillName].currentXp,
        skills[legacySkillName].level,
        500
      );

      const xpPerLevel = 500;
      const oldLevel = skills[legacySkillName].level;
      skills[legacySkillName].currentXp += xpToAdd;
      skills[legacySkillName].level = Math.floor(skills[legacySkillName].currentXp / xpPerLevel) + 1;
      const newLevel = skills[legacySkillName].level;
      
      if (newLevel > oldLevel) {
        if (levelUpPopupTimer.current) {
          clearTimeout(levelUpPopupTimer.current);
        }
        setLevelUpPopupVisible(true);
        levelUpPopupTimer.current = setTimeout(() => {
          setLevelUpPopupVisible(false);
        }, 1800);
      }
      
      localStorage.setItem("skillsProgress", JSON.stringify(skills));
      
      // Save to server
      try {
        await fetch("/api/skills-progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            skillName: legacySkillName,
            currentXp: skills[legacySkillName].currentXp,
            level: skills[legacySkillName].level
          })
        });
      } catch (error) {
        console.error('[handleAddExperience] Error saving to server:', error);
      }
      
      window.dispatchEvent(new CustomEvent('skillXpAdded', { 
        detail: { skillName: legacySkillName, currentXp: skills[legacySkillName].currentXp }
      }));
      
      setXpValue(FIXED_XP_AMOUNT.toString());
      setExperienceSelectedSkill(null);
      hideBodyGainPopup(); // evita solaparse con el pop-up de fuerza/flexibilidad
      showXpPopup(legacySnapshot);
      return;
    }
    
    // GlobalSkill flow
    const currentSkill = availableGlobalSkills.find(s => s.id === experienceSelectedSkill);
    const oldLevel = currentSkill?.level || 1;
    const globalSnapshot = buildSnapshot(
      currentSkill?.name || experienceSelectedSkill,
      currentSkill?.currentXp || 0,
      currentSkill?.level || 1,
      currentSkill?.goalXp && currentSkill.goalXp > 0 ? currentSkill.goalXp : null
    );
    
    try {
      // Use the GlobalSkills API to add XP (with cascade to parent)
      const updatedSkill = await addXpToGlobalSkill(experienceSelectedSkill, xpToAdd);
      
      if (updatedSkill) {
        console.log("[handleAddExperience] Updated skill via API:", updatedSkill);
        
        // Check for level up
        if (updatedSkill.level > oldLevel) {
          if (levelUpPopupTimer.current) {
            clearTimeout(levelUpPopupTimer.current);
          }
          setLevelUpPopupVisible(true);
          levelUpPopupTimer.current = setTimeout(() => {
            setLevelUpPopupVisible(false);
          }, 1800);
        }
        
        // Dispatch event to update UI (for compatibility)
        window.dispatchEvent(new CustomEvent('skillXpAdded', { 
          detail: { skillId: experienceSelectedSkill, currentXp: updatedSkill.currentXp, level: updatedSkill.level }
        }));
        
        // Clear inputs and show feedback
        setXpValue(FIXED_XP_AMOUNT.toString());
        setExperienceSelectedSkill(null);
        hideBodyGainPopup(); // evita solaparse con el pop-up de fuerza/flexibilidad
        showXpPopup(globalSnapshot);

        const targetId = currentSkill?.areaId || currentSkill?.projectId;
        const isTargetProject = !currentSkill?.areaId && !!currentSkill?.projectId;
        if (targetId) {
          const areaXpUpdated = await addAreaXp(targetId, isTargetProject, AREA_PROGRESS_XP_INCREMENT);
          if (areaXpUpdated) {
            triggerAreaProgressPopup(currentSkill?.currentXp ?? 0);
          }
        }
      }
    } catch (error) {
      console.error("[handleAddExperience] Error adding XP:", error);
    }
  };

  const handleAddBody = () => {
    if (!selectedBodyZone) return;

    const { before, after } = addBodyBlock(selectedBodyZone, selectedBodyDimension);
    hideXpPopup(); // evita solaparse con el pop-up de XP si sigue visible
    showBodyGainPopup({ zone: selectedBodyZone, dimension: selectedBodyDimension, before, after });
    setSelectedBodyZone(null);
  };

  const handleTitleLongPressStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.stopPropagation();
    isTitleLongPress.current = false;
    titleLongPressTimer.current = setTimeout(() => {
      isTitleLongPress.current = true;
      setEditTitle(skill.title);
      const descParts = (skill.description || "").split("\n\nWhen: ");
      setEditAction(descParts[0] || "");
      setEditWhen(descParts[1] || "");
      setEditFeedback(skill.feedback || "");
      setXpValue(FIXED_XP_AMOUNT.toString());
      // First node of level (levelPosition === 1) starts at step 2, skipping title edit
      const initialStep = skill.levelPosition === 1 ? 2 : 0;
      setEditStep(initialStep);
      setIsEditDialogOpen(true);
    }, 500);
  };
  
  const handleXpConfirm = () => {
    setAnimatedXpValue(FIXED_XP_AMOUNT.toString());
    setIsEditDialogOpen(false);
    setShowXpAnimation(true);
    setTimeout(() => setShowXpAnimation(false), 1500);
  };

  const handleTitleLongPressEnd = () => {
    if (titleLongPressTimer.current) {
      clearTimeout(titleLongPressTimer.current);
      titleLongPressTimer.current = null;
    }
  };

  const handleTitleClick = async (e: React.MouseEvent) => {
    if (isTitleLongPress.current) {
      e.preventDefault();
      e.stopPropagation();
      isTitleLongPress.current = false;
      return;
    }
    // Locked nodes (including not-yet-reached future/staged nodes) must not be
    // interactable here: without this, tapping a locked node's title could open the
    // "add a subtask tree?" prompt and attach real (locked-by-default) subskills to it,
    // leaving it permanently flagged as "has incomplete subtasks" even once it becomes
    // genuinely available later.
    if (isLocked) {
      return;
    }
    if (!isSubSkillView && !isInicioNode) {
      e.stopPropagation();
      try {
        const response = await fetch(`/api/skills/${skill.id}/subskills`);
        const subskills = await response.json();
        if (subskills && subskills.length > 0) {
          enterSubSkillTree(skill.id, skill.title);
        } else {
          setIsSubtaskConfirmOpen(true);
        }
      } catch {
        setIsSubtaskConfirmOpen(true);
      }
    }
  };

  const handleConfirmSubtasks = () => {
    setIsSubtaskConfirmOpen(false);
    enterSubSkillTree(skill.id, skill.title);
  };

  const handleDeclineSubtasks = () => {
    setIsSubtaskConfirmOpen(false);
  };

  const handleLevelLongPressStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.stopPropagation();
    levelLongPressTimer.current = setTimeout(() => {
      setEditSubtitle(currentSubtitle);
      setEditSubtitleDescription(currentSubtitleDescription);
      setIsSubtitleDialogOpen(true);
    }, 500);
  };

  const handleLevelLongPressEnd = () => {
    if (levelLongPressTimer.current) {
      clearTimeout(levelLongPressTimer.current);
      levelLongPressTimer.current = null;
    }
  };

  const handleSubtitleSave = () => {
    if (isProject) {
      updateProjectLevelSubtitle(activeId, skill.level, editSubtitle, editSubtitleDescription);
    } else {
      updateLevelSubtitle(activeId, skill.level, editSubtitle, editSubtitleDescription);
    }
    setIsSubtitleDialogOpen(false);
  };

  const handleFeedbackOpen = () => {
    setEditFeedback(skill.feedback || "");
    setIsOpen(false);
    setIsFeedbackDialogOpen(true);
  };

  const handleFeedbackSave = () => {
    if (isSubSkillView) {
      updateSubSkill(skill.id, { feedback: editFeedback });
    } else if (isProject) {
      updateProjectSkill(activeId, skill.id, { feedback: editFeedback });
    } else {
      updateSkill(activeId, skill.id, { feedback: editFeedback });
    }
    setIsFeedbackDialogOpen(false);
  };

  const handleEditSave = async () => {
    // Prepare data first
    const combinedDescription = editWhen.trim() 
      ? `${editAction}\n\nWhen: ${editWhen}` 
      : editAction;
    
    const xpNumber = FIXED_XP_AMOUNT;
    
    // Add XP to skill (before mutations)
    if (experienceSelectedSkill) {
      const xpToAdd = FIXED_XP_AMOUNT;
      
      // Check if it's a legacy skill
      if (experienceSelectedSkill.startsWith("legacy:")) {
        const legacySkillName = experienceSelectedSkill.replace("legacy:", "");
        const skillsProgress = localStorage.getItem("skillsProgress");
        let skills: Record<string, { name: string; currentXp: number; level: number }> = {};
        
        if (skillsProgress) {
          try {
            skills = JSON.parse(skillsProgress);
          } catch (error) {
            console.error("[handleEditSave] Error parsing skillsProgress:", error);
          }
        }
        
        if (!skills[legacySkillName]) {
          skills[legacySkillName] = { name: legacySkillName, currentXp: 0, level: 1 };
        }
        
        const xpPerLevel = 500;
        const oldLevel = skills[legacySkillName].level;
        skills[legacySkillName].currentXp += xpToAdd;
        skills[legacySkillName].level = Math.floor(skills[legacySkillName].currentXp / xpPerLevel) + 1;
        
        if (skills[legacySkillName].level > oldLevel) {
          if (levelUpPopupTimer.current) {
            clearTimeout(levelUpPopupTimer.current);
          }
          setLevelUpPopupVisible(true);
          levelUpPopupTimer.current = setTimeout(() => {
            setLevelUpPopupVisible(false);
          }, 1800);
        }
        
        localStorage.setItem("skillsProgress", JSON.stringify(skills));
        
        try {
          await fetch("/api/skills-progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              skillName: legacySkillName,
              currentXp: skills[legacySkillName].currentXp,
              level: skills[legacySkillName].level
            })
          });
        } catch (error) {
          console.error('[handleEditSave] Error saving to server:', error);
        }
        
        window.dispatchEvent(new CustomEvent('skillXpAdded', { 
          detail: { skillName: legacySkillName, currentXp: skills[legacySkillName].currentXp }
        }));
      } else {
        // GlobalSkill flow
        const currentSkill = availableGlobalSkills.find(s => s.id === experienceSelectedSkill);
        const oldLevel = currentSkill?.level || 1;
        
        try {
          const updatedSkill = await addXpToGlobalSkill(experienceSelectedSkill, xpToAdd);
          
          if (updatedSkill && updatedSkill.level > oldLevel) {
            if (levelUpPopupTimer.current) {
              clearTimeout(levelUpPopupTimer.current);
            }
            setLevelUpPopupVisible(true);
            levelUpPopupTimer.current = setTimeout(() => {
              setLevelUpPopupVisible(false);
            }, 1800);
          }
          
          window.dispatchEvent(new CustomEvent('skillXpAdded', { 
            detail: { skillId: experienceSelectedSkill, currentXp: updatedSkill?.currentXp, level: updatedSkill?.level }
          }));
        } catch (error) {
          console.error('[handleEditSave] Error adding XP:', error);
        }
      }
    }
    
    // Call mutations immediately (autosave without closing dialog)
    if (editTitle.trim() || editAction.trim()) {
      if (isSubSkillView) {
        updateSubSkill(skill.id, { 
          title: editTitle, 
          description: combinedDescription,
          feedback: editFeedback,
          experiencePoints: xpNumber
        });
      } else if (isProject) {
        updateProjectSkill(activeId, skill.id, { 
          title: editTitle, 
          description: combinedDescription,
          feedback: editFeedback,
          experiencePoints: xpNumber
        });
      } else {
        updateSkill(activeId, skill.id, { 
          title: editTitle, 
          description: combinedDescription,
          feedback: editFeedback,
          experiencePoints: xpNumber
        });
      }
      
      // Create journal learning entry when XP is added
      if (experienceSelectedSkill && xpNumber > 0) {
        // Build the sentence from action and feedback
        const parts = [];
        if (editAction.trim()) parts.push(editAction.trim());
        if (editFeedback.trim()) parts.push(editFeedback.trim());
        const sentence = parts.length > 0 ? parts.join(" - ") : `${xpNumber} XP agregado`;
        
        const learningEntry = {
          title: `${editTitle || skill.title} (+${xpNumber} XP en ${experienceSelectedSkill})`,
          sentence: sentence,
          skillId: skill.id,
        };
        createLearning.mutate(learningEntry);
      }
    }
  };

  // Autosave effect with debounce for step 1 and 2 fields
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isEditDialogOpen && (editTitle !== skill.title || editAction !== skill.description?.split("\n\nWhen: ")[0] || editWhen !== skill.description?.split("\n\nWhen: ")[1])) {
        const combinedDescription = editWhen.trim() 
          ? `${editAction}\n\nWhen: ${editWhen}` 
          : editAction;
        
        // Autosave without closing dialog
        if (isSubSkillView) {
          updateSubSkill(skill.id, { 
            title: editTitle, 
            description: combinedDescription
          });
        } else if (isProject) {
          updateProjectSkill(activeId, skill.id, { 
            title: editTitle, 
            description: combinedDescription
          });
        } else {
          updateSkill(activeId, skill.id, { 
            title: editTitle, 
            description: combinedDescription
          });
        }
      }
    }, 1500); // Save after user stops typing for 1.5 seconds
    
    return () => clearTimeout(timer);
  }, [editTitle, editAction, editWhen, isEditDialogOpen, skill.id, skill.title, skill.description, isSubSkillView, isProject, activeId, updateSubSkill, updateProjectSkill, updateSkill]);

  const handleTouchStart = () => {
    if (isInicioNode) return; // "inicio" nodes are not interactive
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setIsOpen(true);
    }, 1500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isInicioNode) return; // "inicio" nodes are not interactive
    if (skill.isAutoComplete === 1 || skill.levelPosition === 1) return; // Node 1 is not clickable
    if (isLongPress.current) {
      e.preventDefault();
      e.stopPropagation();
      isLongPress.current = false;
      return;
    }
    
    // Debounce: prevent multiple onClick invocations within 100ms
    // This prevents duplicate fires from touch/mouse event synthesis
    const now = Date.now();
    if (now - lastClickTime.current < 100) {
      console.log(`[SkillNode] onClick debounced (${now - lastClickTime.current}ms since last click)`);
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    lastClickTime.current = now;
    
    // Allow unlocking manually locked nodes by clicking.
    // Gate on the node still being "locked": a node can carry a stale manualLock=1
    // flag (leftover from when it was created as a future/staged placeholder) even
    // after its status has genuinely become "available" for real play. Without the
    // status check here, the first click on such a node would re-lock it instead of
    // confirming it, requiring lock -> unlock -> confirm across three clicks.
    if (skill.manualLock === 1 && skill.status === "locked") {
      if (isSubSkillView) {
        toggleSubSkillLock(skill.id);
      } else if (isProject) {
        toggleProjectLock(activeId, skill.id);
      } else {
        toggleLock(activeId, skill.id);
      }
      return;
    }
    if (isLocked) {
      return; // Locked nodes cannot be clicked - only unlock when previous node is mastered
    }
    
    console.log(`[SkillNode] onClick triggered for skill "${skill.title}" (id: ${skill.id})`);
    onClick();
  };

  const handleMouseDown = () => {
    if (isInicioNode) return; // "inicio" nodes are not interactive
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setIsOpen(true);
    }, 1500);
  };

  const handleMouseUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setIsOpen(false);
      setPopoverStep(0); // Reset to menu step when closing
      isLongPress.current = false;
    }
  };

  return (
    <>
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverAnchor asChild>
        <div
          className={cn(
            "absolute -translate-x-1/2 -translate-y-1/2 z-20 touch-none select-none",
            isInicioNode ? "cursor-default" : "cursor-pointer"
          )}
          style={{ left: `${skill.x}%`, top: `${skill.y}px` }}
          data-skill-id={skill.id}
          onClick={handleClick}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          {...(isOnboardingTarget ? { "data-onboarding": "skill-node" } : {})}
        >
          {/* Level Marker */}
          {isFirstOfLevel && (
            <div 
              className="absolute right-14 top-1/2 -translate-y-1/2 whitespace-nowrap text-xs font-semibold text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full border border-border cursor-pointer select-none"
              onTouchStart={handleLevelLongPressStart}
              onTouchEnd={handleLevelLongPressEnd}
              onTouchCancel={handleLevelLongPressEnd}
              onMouseDown={handleLevelLongPressStart}
              onMouseUp={handleLevelLongPressEnd}
              onMouseLeave={handleLevelLongPressEnd}
              onClick={(e) => e.stopPropagation()}
            >
              <div>{`Level ${skill.level}`}</div>
              {showCompletedLevelSubtitle && (
                <div>{trimmedLevelSubtitle}</div>
              )}
            </div>
          )}

          {/* Node Circle */}
          <motion.div
            initial={{
              scale: skill.status === "available" ? 1 : (isMastered ? 1.05 : 1),
              boxShadow: skill.status === "available" ? "0 0 0px 1px rgba(255, 255, 255, 1)" : "none",
              opacity: isLocked ? lockedNodeOpacity : 1,
            }}
            animate={{
              scale: isMastered ? 1.05 : skill.status === "available" ? [1, 1.3, 1] : 1,
              boxShadow: skill.status === "available" ? [
                "0 0 0px 1px rgba(255, 255, 255, 1)",
                "0 0 0px 1.5px rgba(255, 255, 255, 1)",
                "0 0 0px 1px rgba(255, 255, 255, 1)"
              ] : "none",
              opacity: isLocked ? lockedNodeOpacity : 1,
            }}
            transition={{
              scale: skill.status === "available" ? {
                duration: 2,
                repeat: Infinity,
                repeatType: "loop"
              } : { duration: 0.3 },
              boxShadow: skill.status === "available" ? {
                duration: 2,
                repeat: Infinity,
                repeatType: "loop"
              } : { duration: 0 },
              opacity: { duration: 0.3 }
            }}
            className={cn(
              "w-10 h-10 rounded-full border-2 flex items-center justify-center relative",
              // Locked nodes: border/text saturation stays constant: distance from the
              // active node (via lockedNodeOpacity above) is the single source of truth
              // for how faded a locked node looks, so it can't be overridden by whether
              // the node still has its default "Nodo X" name.
              isLocked && !isLastNodeOfLevel && "bg-muted border-muted-foreground/70 text-muted-foreground/90",
              isLocked && isLastNodeOfLevel && "bg-muted border-amber-400 text-muted-foreground/90",
              // Available nodes (not locked, not mastered)
              !isLocked && !isMastered && !isLastNodeOfLevel && "bg-card border-border",
              !isLocked && !isMastered && isLastNodeOfLevel && "bg-card border-amber-400",
              // Mastered nodes - not last node of level and level not completed
              isMastered && !isLastNodeOfLevel && !isLevelCompleted && "bg-foreground border-foreground text-background shadow-sm",
              // Mastered last node of level (always orange, whether level completed or not)
              isMastered && isLastNodeOfLevel && "bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-500/30",
              // Level completed - all nodes turn orange
              isMastered && isLevelCompleted && "bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-500/30"
            )}
          >
            {hasUnlockedWithIncompleteSubtasks ? (
              <Lock size={14} className="text-white" />
            ) : isLocked ? (
              <Lock size={14} />
            ) : isMastered ? (
              <Check size={18} strokeWidth={3} />
            ) : (
              <div className="w-2.5 h-2.5 rounded-full bg-foreground" />
            )}
          </motion.div>

          {/* Final Node Star Icon - only show when star is active AND final node is mastered */}
          {isStarActive && skillsInLevel.find(s => s.levelPosition === Math.max(...skillsInLevel.map(s => s.levelPosition || 0)))?.status === "mastered" && (
            <div className="absolute -top-1 -right-1 z-30" title="Nodo final del área">
              <Star 
                size={14} 
                className="fill-amber-400 text-amber-400 drop-shadow-lg" 
              />
            </div>
          )}

          {/* Label */}
          <div className={cn(
            "absolute left-14 top-1/2 -translate-y-1/2 font-medium transition-colors text-sm flex items-center gap-2",
            isLocked ? "text-muted-foreground" : "text-foreground",
            isMastered && "text-foreground",
            (skill.title.startsWith("Nodo ") || skill.title === "Next challenge" || skill.title === "Next objetive quest" || skill.title === "Objective quest") && "text-muted-foreground/60"
          )}>
            <span
              onClick={handleTitleClick}
              onTouchStart={handleTitleLongPressStart}
              onTouchEnd={handleTitleLongPressEnd}
              onTouchCancel={handleTitleLongPressEnd}
              onMouseDown={handleTitleLongPressStart}
              onMouseUp={handleTitleLongPressEnd}
              onMouseLeave={handleTitleLongPressEnd}
              className={cn(
                "whitespace-nowrap block transition-transform duration-150",
                !isSubSkillView && !isLocked && !isInicioNode && "cursor-pointer hover:translate-y-0.5 active:translate-y-1",
                !isInicioNode && "cursor-pointer"
              )}
              data-testid={`link-skill-title-${skill.id}`}
            >
              {skill.isAutoComplete === 1 || skill.levelPosition === 1 ? "" : skill.title}
            </span>
            {/* Don't show the "ready to confirm" mark alongside the incomplete-subtasks
                lock icon (hasUnlockedWithIncompleteSubtasks above) — the two signals
                contradict each other visually. */}
            {!isLocked && !isMastered && !hasIncompleteSubtasks && (
              <span className="text-2xl font-bold text-amber-400">!</span>
            )}
            {/* XP subtitle - only show when not mastered and has XP > 0 */}
            {!isMastered && typeof skill.experiencePoints === 'number' && skill.experiencePoints > 0 && (
              <div className="text-muted-foreground/70 text-center text-[0.8em]">
                +{skill.experiencePoints}xp
              </div>
            )}
          </div>

        </div>
      </PopoverAnchor>
      <PopoverContent 
        side="top" 
        collisionPadding={16} 
        className={cn(
          "border-border bg-popover/95 backdrop-blur-xl shadow-xl p-4 z-50",
          popoverStep === 0 ? "w-64" : "w-96"
        )}
      >
        {isFirstNodeOfLevel ? (
          // Node 1 of each level is always mastered and has no title; its only
          // available action is adding the next node, and only once that next
          // node is unlocked (available).
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-xs bg-muted/50 hover:bg-muted"
              disabled={!canAddFromNode}
              title={!canAddFromNode ? "Solo se puede agregar cuando el siguiente nodo está desbloqueado" : undefined}
              onClick={() => {
                if (!canAddFromNode) return;
                if (isSubSkillView) {
                  addSubSkillBelow(skill.id, "");
                } else if (isProject) {
                  addProjectSkillBelow(activeId, skill.id, "");
                } else {
                  addSkillBelow(activeId, skill.id, "");
                }
                setIsOpen(false);
              }}
              data-testid="button-add-skill-below-node1"
            >
              <Plus className="h-4 w-4 mr-1" />
              Agregar nodo debajo
            </Button>
          </div>
        ) : popoverStep === 0 ? (
          // STEP 1: Menu (current)
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              {canMoveUp() === null ? (
                <div className="h-8 w-8" />
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={canMoveUp() === false}
                  title={canMoveUp() === false ? "No puedes reordenar el Nodo 1" : "Mover arriba"}
                  onClick={() => {
                    if (isSubSkillView) {
                      moveSubSkill(skill.id, "up");
                    } else if (isProject) {
                      moveProjectSkill(activeId, skill.id, "up");
                    } else {
                      moveSkill(activeId, skill.id, "up");
                    }
                  }}
                  data-testid="button-move-up"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
              )}
              <span className="text-xs text-muted-foreground">Mover</span>
              {canMoveDown() === null ? (
                <div className="h-8 w-8" />
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={canMoveDown() === false}
                  title={canMoveDown() === false ? "No puedes reordenar el Nodo 1" : "Mover abajo"}
                  onClick={() => {
                    if (isSubSkillView) {
                      moveSubSkill(skill.id, "down");
                    } else if (isProject) {
                      moveProjectSkill(activeId, skill.id, "down");
                    } else {
                      moveSkill(activeId, skill.id, "down");
                    }
                  }}
                  data-testid="button-move-down"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
              <h4 className="font-semibold leading-none mb-1.5">{skill.title}</h4>
              {skill.description && (
                <p className="text-sm text-muted-foreground leading-relaxed break-words">
                  {skill.description}
                </p>
              )}
              {skill.feedback && (
                <div className="mt-2 pt-2 border-t border-border/50">
                  <p className="text-xs text-muted-foreground font-medium mb-1">Thoughts:</p>
                  <p className="text-sm text-foreground/80 leading-relaxed break-words italic">
                    {skill.feedback}
                  </p>
                </div>
              )}
            </div>
            
            <div className="pt-2 border-t border-border flex flex-wrap justify-between gap-2">
               <Popover open={isAddOptionsOpen} onOpenChange={setIsAddOptionsOpen}>
                 <PopoverTrigger asChild>
                   <Button 
                     variant="ghost" 
                     size="sm" 
                     className="h-8 w-8 p-0 text-xs bg-muted/50 hover:bg-muted"
                     data-testid="button-add-skill-below"
                   >
                     +
                   </Button>
                 </PopoverTrigger>
                 <PopoverContent 
                   className="w-auto p-1 border-0 bg-background/95 backdrop-blur-sm" 
                   align="center" 
                   side="top"
                   sideOffset={4}
                 >
                   <div className="flex flex-col gap-0.5">
                     <Button
                       variant="ghost"
                       size="sm"
                       className="h-7 px-3 text-xs justify-start font-normal hover:bg-muted/50"
                       disabled={!canAddFromNode}
                       title={!canAddFromNode ? "Solo se puede agregar desde el nodo confirmado anterior al desbloqueado" : undefined}
                       onClick={() => {
                         if (!canAddFromNode) return;
                         if (isSubSkillView) {
                           addSubSkillBelow(skill.id, "");
                         } else if (isProject) {
                           addProjectSkillBelow(activeId, skill.id, "");
                         } else {
                           addSkillBelow(activeId, skill.id, "");
                         }
                         setIsAddOptionsOpen(false);
                         setIsOpen(false);
                       }}
                       data-testid="button-add-new"
                     >
                       Agregar
                     </Button>
                     <Button
                       variant="ghost"
                       size="sm"
                       className="h-7 px-3 text-xs justify-start font-normal hover:bg-muted/50"
                       disabled={!canAddFromNode}
                       title={!canAddFromNode ? "Solo se puede duplicar desde el nodo confirmado anterior al desbloqueado" : undefined}
                       onClick={() => {
                         if (!canAddFromNode) return;
                         if (isSubSkillView) {
                           duplicateSubSkill(skill);
                         } else if (isProject) {
                           duplicateProjectSkill(activeId, skill);
                         } else {
                           duplicateSkill(activeId, skill);
                         }
                         setIsAddOptionsOpen(false);
                         setIsOpen(false);
                       }}
                       data-testid="button-duplicate"
                     >
                       Duplicar
                     </Button>
                     <Button
                       variant="ghost"
                       size="sm"
                       className="h-8 px-2 text-xs bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                       onClick={() => {
                         if (isSubSkillView) {
                           toggleSubSkillLock(skill.id);
                         } else if (isProject) {
                           toggleProjectLock(activeId, skill.id);
                         } else {
                           toggleLock(activeId, skill.id);
                         }
                         setIsOpen(false);
                       }}
                       data-testid="button-lock"
                     >
                       {skill.manualLock === 1 ? "Desbloquear" : "Bloquear"}
                     </Button>
                   </div>
                 </PopoverContent>
               </Popover>

               {/* Star button - show for last node of level OR if star is currently active (to allow removal) */}
               {(isLastNodeOfLevel || isStarActive) && (
                 <Button 
                   variant="ghost"
                   size="sm" 
                   className={cn(
                     "h-8 w-8 p-0 text-xs",
                     isStarActive ? "bg-amber-500 hover:bg-amber-600 text-white" : "bg-muted/50 hover:bg-muted"
                   )}
                   onClick={() => {
                     if (isSubSkillView) {
                       toggleSubSkillFinalNode(skill.id);
                     } else if (isProject) {
                       toggleProjectFinalNode(activeId, skill.id);
                     } else {
                       toggleFinalNode(activeId, skill.id);
                     }
                     setIsOpen(false);
                   }}
                   data-testid="button-toggle-final"
                   title={isStarActive ? "Quitar nodo final final" : "Marcar como nodo final final"}
                 >
                   <Star className={cn("h-3 w-3", isStarActive && "fill-white")} />
                 </Button>
               )}

               {/* Delete button - deleting the last node of a level promotes the previous
                   node to final; if that node was already mastered, the context layer
                   retroactively completes the level and opens the next one. */}
               <Button
                 variant="ghost"
                 size="sm"
                 className="h-8 w-8 p-0 bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                 onClick={() => {
                   if (isSubSkillView) {
                     deleteSubSkill(skill.id);
                   } else if (isProject) {
                     deleteProjectSkill(activeId, skill.id);
                   } else {
                     deleteSkill(activeId, skill.id);
                   }
                   setIsOpen(false);
                 }}
                 data-testid="button-delete"
               >
                 <Trash2 className="h-3 w-3" />
               </Button>

               {/* Next button to go to journal tabs step */}
               <Button 
                 variant="ghost" 
                 size="sm" 
                 className="h-8 w-8 p-0 bg-muted/50 hover:bg-muted ml-auto"
                 onClick={() => setPopoverStep(1)}
                 title="Thoughts, Learnings, Experience, Fuerza, Tools"
               >
                 <ChevronRight className="h-4 w-4" />
               </Button>
            </div>
          </div>
        ) : (
          // STEP 2: Journal Tabs (from previous Edit Dialog Step 3)
          <div className="flex flex-col h-full">
            <div className="mb-3">
              <span className="text-xs font-medium text-muted-foreground">Journal</span>
            </div>

            <Tabs value={feedbackActiveTab} onValueChange={(v) => setFeedbackActiveTab(v as "thoughts" | "tools" | "learnings" | "experience" | "body")} className="w-full flex flex-col flex-1">
              <TabsList className="w-full grid grid-cols-5 bg-muted/50">
                <TabsTrigger value="thoughts" className="text-xs" data-testid="feedback-tab-thoughts">
                  <Pencil className="h-3 w-3 mr-1" />
                  Thoughts
                </TabsTrigger>
                <TabsTrigger value="learnings" className="text-xs" data-testid="feedback-tab-learnings">
                  <Lightbulb className="h-3 w-3 mr-1" />
                  Learnings
                </TabsTrigger>
                <TabsTrigger value="experience" className="text-xs" data-testid="feedback-tab-experience">
                  <span className="text-xs font-bold mr-1">XP</span>
                </TabsTrigger>
                <TabsTrigger value="body" className="text-xs" data-testid="feedback-tab-body" title="Fuerza / Flexibilidad">
                  <BicepsFlexed className="h-3 w-3" />
                </TabsTrigger>
                <TabsTrigger value="tools" className="text-xs" data-testid="feedback-tab-tools">
                  <Wrench className="h-3 w-3 mr-1" />
                  Tools
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="thoughts" className="mt-4 space-y-3 flex flex-col flex-1">
                <div className="flex-1">
                  <Input
                    placeholder="TITLE"
                    value={thoughtTitle}
                    onChange={(e) => setThoughtTitle(e.target.value.toUpperCase())}
                    className="uppercase border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted"
                    data-testid="input-thought-title"
                  />
                  <Textarea
                    placeholder="Descripción, notas o reflexión..."
                    value={thoughtSentence}
                    onChange={(e) => setThoughtSentence(e.target.value)}
                    rows={3}
                    className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted resize-none mt-2"
                    data-testid="input-thought-sentence"
                  />
                </div>
                <div className="flex justify-end items-center gap-2 pt-2">
                  
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={handleAddThought}
                    disabled={!thoughtTitle.trim()}
                    className="bg-muted/50 hover:bg-muted"
                    data-testid="button-new-thought"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    New Thought
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="learnings" className="mt-4 space-y-3 flex flex-col flex-1">
                <div className="flex-1">
                  <Input
                    placeholder="TITLE"
                    value={learningTitle}
                    onChange={(e) => setLearningTitle(e.target.value.toUpperCase())}
                    className="uppercase border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted"
                    data-testid="input-learning-title"
                  />
                  <Input
                    placeholder="Description"
                    value={learningSentence}
                    onChange={(e) => setLearningSentence(e.target.value)}
                    className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted mt-2"
                    data-testid="input-learning-sentence"
                  />
                </div>
                <div className="flex justify-end items-center gap-2 pt-2">
                  
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={handleAddLearning}
                    disabled={!learningTitle.trim()}
                    className="bg-muted/50 hover:bg-muted"
                    data-testid="button-new-learning"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    New Learning
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="experience" className="mt-4 space-y-3 flex flex-col flex-1">
                <div className="flex items-center justify-center gap-2 py-4">
                  <div className="w-24 rounded-md bg-muted/50 px-3 py-2 text-center text-lg font-bold">
                    {FIXED_XP_AMOUNT}
                  </div>
                  <span className="text-lg font-medium text-muted-foreground">xp</span>
                </div>
                <Popover open={showExperienceSkillSelector} onOpenChange={setShowExperienceSkillSelector}>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="bg-muted/50 hover:bg-muted w-full"
                      data-testid="button-select-skill"
                    >
                      {experienceSelectedSkill 
                        ? `✓ ${experienceSelectedSkill.startsWith("legacy:") 
                            ? experienceSelectedSkill.replace("legacy:", "") 
                            : (availableGlobalSkills.find(s => s.id === experienceSelectedSkill)?.name || "Skill")}` 
                        : "Seleccionar skill"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent 
                    className="w-56 p-2 border-0 bg-background/95 backdrop-blur-sm z-[9999]" 
                    align="center" 
                    side="top"
                    sideOffset={8}
                    collisionPadding={16}
                  >
                    <div className="max-h-56 overflow-y-auto">
                      {/* Legacy skills (only those associated with this area/project) */}
                      {filteredLegacySkills.length > 0 && (
                        <div className="space-y-1 mb-2">
                          {filteredLegacySkills.map((skillName) => (
                            <Button
                            key={skillName}
                            variant="ghost"
                            size="sm"
                            className={`w-full justify-start h-8 px-3 text-xs font-normal ${
                              experienceSelectedSkill === `legacy:${skillName}`
                                ? "bg-muted text-foreground" 
                                : "hover:bg-muted/50"
                            }`}
                            onClick={() => {
                              setExperienceSelectedSkill(`legacy:${skillName}`);
                              setShowExperienceSkillSelector(false);
                            }}
                              data-testid={`button-select-legacy-${skillName}`}
                            >
                              {skillName}
                            </Button>
                          ))}
                        </div>
                      )}
                      
                      {/* GlobalSkills for this area/quest */}
                      {availableGlobalSkills.length > 0 && (
                        <>
                          <div className="border-t border-muted my-2" />
                          <div className="space-y-1">
                            {/* Parent skills (not subskills) */}
                            {availableGlobalSkills.filter(s => !s.parentSkillId).map((gSkill) => (
                              <div key={gSkill.id}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={`w-full justify-start h-8 px-3 text-xs font-medium ${
                                    experienceSelectedSkill === gSkill.id 
                                      ? "bg-muted text-foreground" 
                                      : "hover:bg-muted/50"
                                  }`}
                                  onClick={() => {
                                    setExperienceSelectedSkill(gSkill.id);
                                    setShowExperienceSkillSelector(false);
                                  }}
                                  data-testid={`button-select-skill-${gSkill.id}`}
                                >
                                  {gSkill.name}
                                  <span className="ml-auto text-muted-foreground">Lv.{gSkill.level}</span>
                                </Button>
                                {/* Subskills of this parent */}
                                {availableGlobalSkills
                                  .filter(s => s.parentSkillId === gSkill.id)
                                  .map((subSkill) => (
                                    <Button
                                      key={subSkill.id}
                                    variant="ghost"
                                    size="sm"
                                    className={`w-full justify-start h-7 px-3 pl-6 text-xs font-normal ${
                                      experienceSelectedSkill === subSkill.id 
                                        ? "bg-muted text-foreground" 
                                        : "hover:bg-muted/50 text-muted-foreground"
                                    }`}
                                    onClick={() => {
                                      setExperienceSelectedSkill(subSkill.id);
                                      setShowExperienceSkillSelector(false);
                                    }}
                                    data-testid={`button-select-subskill-${subSkill.id}`}
                                  >
                                    ↳ {subSkill.name}
                                    <span className="ml-auto">Lv.{subSkill.level}</span>
                                  </Button>
                                ))
                              }
                            </div>
                          ))}
                        </div>
                        </>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
                <div className="flex justify-end items-center gap-2 pt-4">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={handleAddExperience}
                    disabled={!experienceSelectedSkill}
                    className="bg-muted/50 hover:bg-muted"
                    data-testid="button-new-experience"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Experience
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="body" className="mt-4 space-y-3 flex flex-col flex-1">
                <div className="flex gap-2 justify-center">
                  {(["fuerza", "flex"] as BodyDimension[]).map((dimension) => (
                    <Button
                      key={dimension}
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedBodyDimension(dimension)}
                      className={selectedBodyDimension === dimension ? "bg-primary/20 text-foreground" : "bg-muted/50 hover:bg-muted text-muted-foreground"}
                      data-testid={`button-body-dimension-${dimension}`}
                    >
                      {dimension === "fuerza" ? "Fuerza" : "Flexibilidad"}
                    </Button>
                  ))}
                </div>
                <Popover open={showBodyZoneSelector} onOpenChange={setShowBodyZoneSelector}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="bg-muted/50 hover:bg-muted w-full"
                      data-testid="button-select-body-zone"
                    >
                      {selectedBodyZone ? `✓ ${BODY_ZONE_LABELS[selectedBodyZone]}` : "Seleccionar componente"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-56 p-2 border-0 bg-background/95 backdrop-blur-sm z-[9999]"
                    align="center"
                    side="top"
                    sideOffset={8}
                    collisionPadding={16}
                  >
                    <div className="space-y-1">
                      {BODY_ZONES.map((zone) => (
                        <Button
                          key={zone}
                          variant="ghost"
                          size="sm"
                          className={`w-full justify-start h-8 px-3 text-xs font-normal ${
                            selectedBodyZone === zone ? "bg-muted text-foreground" : "hover:bg-muted/50"
                          }`}
                          onClick={() => {
                            setSelectedBodyZone(zone);
                            setShowBodyZoneSelector(false);
                          }}
                          data-testid={`button-select-body-zone-${zone}`}
                        >
                          {BODY_ZONE_LABELS[zone]}
                        </Button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <div className="flex justify-end items-center gap-2 pt-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleAddBody}
                    disabled={!selectedBodyZone}
                    className="bg-muted/50 hover:bg-muted"
                    data-testid="button-add-body"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Agregar {selectedBodyDimension === "fuerza" ? "fuerza" : "flexibilidad"}
                  </Button>
                </div>
              </TabsContent>

              <AnimatePresence>
                {levelUpPopupVisible && (
                  <motion.div
                    initial={{ opacity: 0, y: 32, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -36, scale: 1.02 }}
                    transition={{ duration: 0.35 }}
                    className="fixed top-24 left-1/2 -translate-x-1/2 z-[250] px-4 py-2 text-2xl font-extrabold text-green-400"
                  >
                    Level Up
                  </motion.div>
                )}
              </AnimatePresence>
              
              <TabsContent value="tools" className="mt-4 space-y-3 flex flex-col flex-1">
                <div className="flex-1">
                  <Input
                    placeholder="TITLE"
                    value={toolTitle}
                    onChange={(e) => setToolTitle(e.target.value.toUpperCase())}
                    className="uppercase border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted"
                    data-testid="input-tool-title"
                  />
                  <Input
                    placeholder="Description"
                    value={toolSentence}
                    onChange={(e) => setToolSentence(e.target.value)}
                    className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted mt-2"
                    data-testid="input-tool-sentence"
                  />
                </div>
                <div className="flex justify-end items-center gap-2 pt-2">
                  
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={handleAddTool}
                    disabled={!toolTitle.trim()}
                    className="bg-muted/50 hover:bg-muted"
                    data-testid="button-new-tool"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    New Tool
                  </Button>
                </div>
              </TabsContent>
            </Tabs>

            <div className="mt-auto pt-4">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setPopoverStep(0)}
                className="h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>

    <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
      if (!open) {
        // Autosave when closing modal
        if (editTitle.trim() || editAction.trim()) {
          const combinedDescription = editWhen.trim() 
            ? `${editAction}\n\nWhen: ${editWhen}` 
            : editAction;
          
          if (isSubSkillView) {
            updateSubSkill(skill.id, { 
              title: editTitle, 
              description: combinedDescription,
              feedback: editFeedback
            });
          } else if (isProject) {
            updateProjectSkill(activeId, skill.id, { 
              title: editTitle, 
              description: combinedDescription,
              feedback: editFeedback
            });
          } else {
            updateSkill(activeId, skill.id, { 
              title: editTitle, 
              description: combinedDescription,
              feedback: editFeedback
            });
          }
        }
        setEditStep(0);
      }
      setIsEditDialogOpen(open);
    }}>
      <DialogContent className="sm:max-w-[400px] border-0 shadow-2xl">
        <DialogTitle className="sr-only">{skill.title}</DialogTitle>
        <DialogDescription className="sr-only">Edit skill details</DialogDescription>
        <div className="min-h-[180px] flex flex-col">
          <AnimatePresence mode="wait">
            {editStep === 0 && (
              <motion.div
                key="step-action"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex-1 flex flex-col gap-4"
              >
                <div>
                  <Label htmlFor="edit-action" className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">PASO 1: Background</Label>
                  <Textarea
                    id="edit-action"
                    value={editAction}
                    onChange={(e) => setEditAction(e.target.value)}
                    placeholder="Describe your next action..."
                    rows={2}
                    className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted resize-none"
                    data-testid="input-edit-action"
                    autoFocus
                  />
                </div>
                <div>
                  <Label htmlFor="edit-when" className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">When exactly?</Label>
                  <Input
                    id="edit-when"
                    value={editWhen}
                    onChange={(e) => setEditWhen(e.target.value)}
                    placeholder="Specify when..."
                    className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted"
                    data-testid="input-edit-when"
                  />
                </div>
                <div className="flex justify-end mt-auto pt-4">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setEditStep(1)}
                    className="h-10 w-10 bg-muted/50 hover:bg-muted"
                    data-testid="button-next-step"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
              </motion.div>
            )}

            {editStep === 1 && skill.levelPosition !== 1 && (
              <motion.div
                key="step-name"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex-1 flex flex-col"
              >
                <Label htmlFor="edit-title" className="text-xs text-muted-foreground uppercase tracking-wide mb-3">STEP 2: Name this move</Label>
                <Input
                  id="edit-title"
                  value={editTitle}
                  onChange={(e) => {
                    const val = e.target.value;
                    const words = val.split(/\s+/).filter(w => w.length > 0);
                    if (words.length <= 8) {
                      setEditTitle(val);
                    } else {
                      setEditTitle(words.slice(0, 8).join(" "));
                    }
                  }}
                  placeholder="Name your move..."
                  className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted text-lg"
                  data-testid="input-edit-title"
                  autoFocus
                />
                <div className="flex justify-between mt-auto pt-6">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setEditStep(0)}
                    className="h-10 w-10 bg-muted/50 hover:bg-muted"
                    data-testid="button-prev-step"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button 
                    onClick={() => setIsEditDialogOpen(false)}
                    disabled={!editTitle.trim()}
                    className="border-0"
                    data-testid="button-save-edit"
                  >
                    Guardar
                  </Button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={isSubtitleDialogOpen} onOpenChange={(open) => {
      setIsSubtitleDialogOpen(open);
      if (!open) {
        setNewSubskillName("");
        setSelectedSubskillId(null);
        setShowSubskillCreator(false);
      }
    }}>
      <DialogContent className="sm:max-w-[400px] border-0 shadow-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">Subtítulo del Nivel {skill.level}</DialogTitle>
          <DialogDescription className="sr-only">Edit level subtitle and subskills</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-subtitle" className="text-xs text-muted-foreground uppercase tracking-wide">Subtítulo</Label>
            <Input
              id="edit-subtitle"
              value={editSubtitle}
              onChange={(e) => setEditSubtitle(e.target.value)}
              placeholder="Ej: Fundamentos, Intermedio..."
              className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted"
              data-testid="input-edit-subtitle"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-subtitle-description" className="text-xs text-muted-foreground uppercase tracking-wide">Descripción</Label>
            <Textarea
              id="edit-subtitle-description"
              value={editSubtitleDescription}
              onChange={(e) => setEditSubtitleDescription(e.target.value)}
              placeholder="Describe este nivel..."
              rows={3}
              className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted resize-none"
              data-testid="input-edit-subtitle-description"
            />
          </div>

          {/* SubSkill Section */}
          <div className="border-t pt-4">
            <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-3 block">
              SubSkills para este nivel
            </Label>
            
            {/* Existing subskills list */}
            {parentGlobalSkills.length > 0 && (
              <div className="space-y-1 mb-3">
                <p className="text-xs text-muted-foreground mb-2">Seleccionar skill existente:</p>
                {parentGlobalSkills.map((gSkill) => (
                  <Button
                    key={gSkill.id}
                    variant={selectedSubskillId === gSkill.id ? "default" : "ghost"}
                    size="sm"
                    className="w-full justify-start text-left h-auto py-2"
                    onClick={() => setSelectedSubskillId(selectedSubskillId === gSkill.id ? null : gSkill.id)}
                  >
                    <div className="flex flex-col items-start">
                      <span className="text-sm">{gSkill.name}</span>
                      <span className="text-xs text-muted-foreground">Lv.{gSkill.level} • {gSkill.currentXp}xp</span>
                    </div>
                  </Button>
                ))}
              </div>
            )}

            {/* Create new subskill */}
            {showSubskillCreator ? (
              <div className="space-y-2 bg-muted/30 p-3 rounded-lg">
                <Input
                  value={newSubskillName}
                  onChange={(e) => setNewSubskillName(e.target.value)}
                  placeholder="Nombre del nuevo skill..."
                  className="border-0 bg-muted/50 focus-visible:ring-0"
                />
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowSubskillCreator(false);
                      setNewSubskillName("");
                    }}
                    className="flex-1 bg-muted/50"
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={async () => {
                      if (newSubskillName.trim()) {
                        console.log('[SkillNode] Creating skill with activeAreaId:', activeAreaId, 'activeProjectId:', activeProjectId);
                        await createGlobalSkill(
                          newSubskillName.trim(),
                          activeAreaId || undefined,
                          activeProjectId || undefined
                        );
                        setNewSubskillName("");
                        setShowSubskillCreator(false);
                      }
                    }}
                    disabled={!newSubskillName.trim()}
                    className="flex-1"
                  >
                    Crear Skill
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSubskillCreator(true)}
                className="w-full bg-muted/30 hover:bg-muted/50"
              >
                <Plus className="h-3 w-3 mr-1" />
                Agregar nuevo Skill
              </Button>
            )}
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="ghost" onClick={() => setIsSubtitleDialogOpen(false)} className="flex-1 bg-muted/50 hover:bg-muted" data-testid="button-cancel-subtitle">
            Cancelar
          </Button>
          <Button onClick={handleSubtitleSave} className="flex-1 border-0" data-testid="button-save-subtitle">
            Guardar
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={isSubtaskConfirmOpen} onOpenChange={setIsSubtaskConfirmOpen}>
      <DialogContent className="sm:max-w-[350px] border-0 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">{skill.title}</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground">¿Esta tarea necesita una red de subtareas?</p>
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="ghost" onClick={handleDeclineSubtasks} className="flex-1 bg-muted/50 hover:bg-muted" data-testid="button-no-subtasks">
            No
          </Button>
          <Button onClick={handleConfirmSubtasks} className="flex-1 border-0" data-testid="button-yes-subtasks">
            Sí
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={isFeedbackDialogOpen} onOpenChange={(open) => {
      if (!open) setFeedbackActiveTab("thoughts");
      setIsFeedbackDialogOpen(open);
    }}>
      <DialogContent className="sm:max-w-[400px] border-0 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">Feedback</DialogTitle>
        </DialogHeader>
        
        <Tabs value={feedbackActiveTab} onValueChange={(v) => setFeedbackActiveTab(v as "thoughts" | "tools" | "learnings")} className="w-full">
          <TabsList className="w-full grid grid-cols-3 bg-muted/50">
            <TabsTrigger value="thoughts" className="text-xs" data-testid="feedback-tab-thoughts">
              <Pencil className="h-3 w-3 mr-1" />
              Thoughts
            </TabsTrigger>
            <TabsTrigger value="tools" className="text-xs" data-testid="feedback-tab-tools">
              <Wrench className="h-3 w-3 mr-1" />
              Tools
            </TabsTrigger>
            <TabsTrigger value="learnings" className="text-xs" data-testid="feedback-tab-learnings">
              <Lightbulb className="h-3 w-3 mr-1" />
              Learnings
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="thoughts" className="mt-4">
            <Textarea
              value={editFeedback}
              onChange={(e) => setEditFeedback(e.target.value)}
              placeholder="Notas, comentarios o retroalimentación..."
              rows={4}
              className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted resize-none"
              data-testid="input-feedback"
              autoFocus
            />
            <div className="flex gap-2 pt-4">
              <Button variant="ghost" onClick={() => setIsFeedbackDialogOpen(false)} className="flex-1 bg-muted/50 hover:bg-muted" data-testid="button-cancel-feedback">
                Cancelar
              </Button>
              <Button onClick={handleFeedbackSave} className="flex-1 border-0" data-testid="button-save-feedback">
                Guardar
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="tools" className="mt-4 space-y-3 flex flex-col">
            <div className="flex-1">
              <Input
                placeholder="TITLE"
                value={toolTitle}
                onChange={(e) => setToolTitle(e.target.value.toUpperCase())}
                className="uppercase border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted"
                data-testid="input-tool-title"
              />
              <Input
                placeholder="Description"
                value={toolSentence}
                onChange={(e) => setToolSentence(e.target.value)}
                className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted mt-2"
                data-testid="input-tool-sentence"
              />
            </div>
            <div className="flex justify-end items-center gap-2 pt-2">
              
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleAddTool}
                disabled={!toolTitle.trim()}
                className="bg-muted/50 hover:bg-muted"
                data-testid="button-new-tool"
              >
                <Plus className="h-3 w-3 mr-1" />
                New Tool
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="learnings" className="mt-4 space-y-3 flex flex-col">
            <div className="flex-1">
              <Input
                placeholder="TITLE"
                value={learningTitle}
                onChange={(e) => setLearningTitle(e.target.value.toUpperCase())}
                className="uppercase border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted"
                data-testid="input-learning-title"
              />
              <Input
                placeholder="Description"
                value={learningSentence}
                onChange={(e) => setLearningSentence(e.target.value)}
                className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted mt-2"
                data-testid="input-learning-sentence"
              />
            </div>
            <div className="flex justify-end items-center gap-2 pt-2">
              
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleAddLearning}
                disabled={!learningTitle.trim()}
                className="bg-muted/50 hover:bg-muted"
                data-testid="button-new-learning"
              >
                <Plus className="h-3 w-3 mr-1" />
                New Learning
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>

    {/* Floating XP Animation */}
    <AnimatePresence>
      {showXpAnimation && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.span
            className="text-2xl font-bold tracking-wide text-foreground"
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            +{animatedXpValue}xp
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>

  </>
  );
}


