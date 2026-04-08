import { motion, AnimatePresence } from "framer-motion";
import { type Skill, type GlobalSkill, useSkillTree } from "@/lib/skill-context";
import { type JournalThought, type JournalLearning, type JournalTool } from "@shared/schema";
import { cn } from "@/lib/utils";
import { Check, Lock, Trash2, ChevronUp, ChevronDown, Pencil, Plus, Star, ChevronRight, ChevronLeft, Wrench, Lightbulb, Flame } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
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
}

export function SkillNode({ skill, areaColor, onClick, isFirstOfLevel, isOnboardingTarget }: SkillNodeProps) {
  const isInicioNode = skill.title.toLowerCase() === "inicio"; // "inicio" nodes are text-only, not interactive
  
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
    addXpToGlobalSkill
  } = useSkillTree();
  
  const isProject = !activeAreaId && !!activeProjectId;
  const activeId = activeAreaId || activeProjectId;
  const isSubSkillView = !!activeParentSkillId;
  
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

  // Detect if node has default name (generated Nodo X format)
  const hasDefaultName = skill.title.startsWith("Nodo ") || skill.title === "Next challenge" || skill.title === "Next objetive quest" || skill.title === "Objective quest";
  
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
  const [editSubtitle, setEditSubtitle] = useState(currentSubtitle);
  const [editSubtitleDescription, setEditSubtitleDescription] = useState(currentSubtitleDescription);
  const levelLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTitleLongPress = useRef(false);

  // Tools & Learnings form state
  const queryClient = useQueryClient();
  const [feedbackActiveTab, setFeedbackActiveTab] = useState<"thoughts" | "tools" | "learnings" | "experience" | "habits">("thoughts");
  const [thoughtTitle, setThoughtTitle] = useState("");
  const [thoughtSentence, setThoughtSentence] = useState("");
  const [toolTitle, setToolTitle] = useState("");
  const [toolSentence, setToolSentence] = useState("");
  const [learningTitle, setLearningTitle] = useState("");
  const [learningSentence, setLearningSentence] = useState("");
  const [showPlusOne, setShowPlusOne] = useState<{ visible: boolean; type: "tools" | "learnings" | "thoughts" | "experience" }>({ visible: false, type: "tools" });
  const [levelUpPopupVisible, setLevelUpPopupVisible] = useState(false);
  const levelUpPopupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hasIncompleteSubtasks, setHasIncompleteSubtasks] = useState(false);
  
  // Habits state
  const [habitDataWithRecords, setHabitDataWithRecords] = useState<any[]>([]);
  const [showXpPopup, setShowXpPopup] = useState<{ visible: boolean; x: number; y: number }>({ visible: false, x: 0, y: 0 });
  
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

  // Fetch all habits
  const { data: allHabits = [] } = useQuery({
    queryKey: ["habits"],
    queryFn: async () => {
      const res = await fetch("/api/habits");
      if (!res.ok) throw new Error("Failed to fetch habits");
      return res.json();
    },
  });

  // Filter habits by current area or project
  const skillHabits = allHabits.filter((h: any) =>
    (activeAreaId && h.areaId === activeAreaId) ||
    (activeProjectId && h.projectId === activeProjectId)
  );

  // Load year-long habit records for streak calculation
  useEffect(() => {
    if (skillHabits.length === 0 || feedbackActiveTab !== "habits") return;

    const fetchHabitRecords = async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const year = today.getFullYear();
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;

      try {
        const updatedHabits = await Promise.all(
          skillHabits.map(async (habit: any) => {
            const res = await fetch(
              `/api/habit-records/${habit.id}?startDate=${startDate}&endDate=${endDate}`
            );
            const records = res.ok ? await res.json() : [];
            const done = new Set(
              records.filter((r: any) => r.completed === 1).map((r: any) => r.date)
            );
            return { ...habit, done };
          })
        );
        setHabitDataWithRecords(updatedHabits);
      } catch (error) {
        console.error("Error loading habit records:", error);
      }
    };

    fetchHabitRecords();
  }, [skillHabits, feedbackActiveTab]);
  
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
  const [xpValue, setXpValue] = useState(skill.experiencePoints ? skill.experiencePoints.toString() : "");
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

  const handleAddThought = () => {
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
    
    createThought.mutate(payload);
    setThoughtTitle("");
    setThoughtSentence("");
    setShowPlusOne({ visible: true, type: "thoughts" });
    setTimeout(() => setShowPlusOne({ visible: false, type: "thoughts" }), 1000);
  };

  const handleAddLearning = () => {
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
    
    createLearning.mutate(payload);
    setLearningTitle("");
    setLearningSentence("");
    setShowPlusOne({ visible: true, type: "learnings" });
    setTimeout(() => setShowPlusOne({ visible: false, type: "learnings" }), 1000);
  };

  const handleAddTool = () => {
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
    
    createTool.mutate(payload);
    setToolTitle("");
    setToolSentence("");
    setShowPlusOne({ visible: true, type: "tools" });
    setTimeout(() => setShowPlusOne({ visible: false, type: "tools" }), 1000);
  };

  const handleAddExperience = async () => {
    console.log("[handleAddExperience] Called", {
      xpValue,
      experienceSelectedSkill,
    });
    
    if (!experienceSelectedSkill || !xpValue || parseInt(xpValue) <= 0) {
      console.log("[handleAddExperience] Invalid inputs, returning");
      return;
    }
    
    const xpToAdd = parseInt(xpValue);
    console.log("[handleAddExperience] XP to add:", xpToAdd, "SkillId:", experienceSelectedSkill);
    
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
      
      setXpValue("");
      setExperienceSelectedSkill(null);
      setShowPlusOne({ visible: true, type: "experience" });
      setTimeout(() => setShowPlusOne({ visible: false, type: "experience" }), 1000);
      return;
    }
    
    // GlobalSkill flow
    const currentSkill = availableGlobalSkills.find(s => s.id === experienceSelectedSkill);
    const oldLevel = currentSkill?.level || 1;
    
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
        setXpValue("");
        setExperienceSelectedSkill(null);
        setShowPlusOne({ visible: true, type: "experience" });
        setTimeout(() => setShowPlusOne({ visible: false, type: "experience" }), 1000);
      }
    } catch (error) {
      console.error("[handleAddExperience] Error adding XP:", error);
    }
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
      setXpValue("");
      // First node of level (levelPosition === 1) starts at step 2, skipping title edit
      const initialStep = skill.levelPosition === 1 ? 2 : 0;
      setEditStep(initialStep);
      setIsEditDialogOpen(true);
    }, 500);
  };
  
  const handleXpConfirm = () => {
    if (xpValue && parseInt(xpValue) > 0) {
      setAnimatedXpValue(xpValue);
      setIsEditDialogOpen(false);
      setShowXpAnimation(true);
      setTimeout(() => setShowXpAnimation(false), 1500);
    }
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
    
    const xpNumber = xpValue ? parseInt(xpValue) : 0;
    
    // Add XP to skill (before mutations)
    if (experienceSelectedSkill && xpValue && parseInt(xpValue) > 0) {
      const xpToAdd = parseInt(xpValue);
      
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
    if (skill.levelPosition === 1) return; // Node 1 is not interactive
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
    
    // Allow unlocking manually locked nodes by clicking
    if (skill.manualLock === 1) {
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
    if (skill.levelPosition === 1) return; // Node 1 is not interactive
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
              <div>Level {skill.level}</div>
            </div>
          )}

          {/* Node Circle */}
          <motion.div
            initial={{
              scale: skill.status === "available" ? 1 : (isMastered ? 1.05 : 1),
              boxShadow: skill.status === "available" ? "0 0 0px 1px rgba(255, 255, 255, 1)" : "none",
            }}
            animate={{
              scale: isMastered ? 1.05 : skill.status === "available" ? [1, 1.3, 1] : 1,
              boxShadow: skill.status === "available" ? [
                "0 0 0px 1px rgba(255, 255, 255, 1)",
                "0 0 0px 1.5px rgba(255, 255, 255, 1)",
                "0 0 0px 1px rgba(255, 255, 255, 1)"
              ] : "none",
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
              } : { duration: 0 }
            }}
            className={cn(
              "w-10 h-10 rounded-full border-2 flex items-center justify-center relative",
              // Locked nodes - with default names have less opacity
              isLocked && !isLastNodeOfLevel && hasDefaultName && "bg-muted border-muted-foreground/10 text-muted-foreground/30",
              // Locked nodes - with custom names have more opacity
              isLocked && !isLastNodeOfLevel && !hasDefaultName && "bg-muted border-muted-foreground/70 text-muted-foreground/90",
              isLocked && isLastNodeOfLevel && hasDefaultName && "bg-muted border-amber-400/30 text-muted-foreground/30",
              isLocked && isLastNodeOfLevel && !hasDefaultName && "bg-muted border-amber-400 text-muted-foreground/90",
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
            <div className="absolute -top-1 -right-1 z-30">
              <Star 
                size={14} 
                className="fill-amber-400 text-amber-400 drop-shadow-lg" 
                title="Nodo final del área"
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
            {!isLocked && !isMastered && (
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
        className="w-64 border-border bg-popover/95 backdrop-blur-xl shadow-xl p-4 z-50"
      >
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
            <p className="text-sm text-muted-foreground leading-relaxed break-words">
              {skill.description || "No description available."}
            </p>
            {skill.feedback && (
              <div className="mt-2 pt-2 border-t border-border/50">
                <p className="text-xs text-muted-foreground font-medium mb-1">Thoughts:</p>
                <p className="text-sm text-foreground/80 leading-relaxed break-words italic">
                  {skill.feedback}
                </p>
              </div>
            )}
          </div>
          
          <div className="pt-2 border-t border-border flex flex-wrap justify-end gap-2">
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
                     onClick={() => {
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
                     onClick={() => {
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

             {/* Delete button - hide for last node of level (can't delete) */}
             {!isLastNodeOfLevel && (
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
             )}
          </div>
        </div>
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
                  <Label htmlFor="edit-action" className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">ACTION: What can you do to advance in this quest?</Label>
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
                    onClick={() => setEditStep(skill.levelPosition === 1 ? 2 : 1)}
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
                <Label htmlFor="edit-title" className="text-xs text-muted-foreground uppercase tracking-wide mb-3">NAME: Name this move (6 words max)</Label>
                <Input
                  id="edit-title"
                  value={editTitle}
                  onChange={(e) => {
                    const val = e.target.value;
                    const words = val.split(/\s+/).filter(w => w.length > 0);
                    if (words.length <= 6) {
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
                    variant="ghost" 
                    size="icon"
                    onClick={() => setEditStep(2)}
                    disabled={!editTitle.trim()}
                    className="h-10 w-10 bg-muted/50 hover:bg-muted"
                    data-testid="button-next-step-2"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
              </motion.div>
            )}

            {editStep === 2 && (
              <motion.div
                key="step-feedback"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex-1 flex flex-col"
              >
                <Tabs value={feedbackActiveTab} onValueChange={(v) => setFeedbackActiveTab(v as "thoughts" | "tools" | "learnings" | "experience" | "habits")} className="w-full flex flex-col flex-1">
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
                    <TabsTrigger value="tools" className="text-xs" data-testid="feedback-tab-tools">
                      <Wrench className="h-3 w-3 mr-1" />
                      Tools
                    </TabsTrigger>
                    <TabsTrigger value="habits" className="text-xs" data-testid="feedback-tab-habits">
                      <Flame className="h-3 w-3 mr-1" />
                      Habits
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
                      <div className="relative">
                        <AnimatePresence>
                          {showPlusOne.visible && showPlusOne.type === "thoughts" && (
                            <motion.span
                              initial={{ opacity: 1, y: 0 }}
                              animate={{ opacity: 0, y: -20 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.8 }}
                              className="absolute -top-6 -right-2 text-foreground font-medium text-sm pointer-events-none"
                            >
                              +1
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </div>
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
                      <div className="relative">
                        <AnimatePresence>
                          {showPlusOne.visible && showPlusOne.type === "learnings" && (
                            <motion.span
                              initial={{ opacity: 1, y: 0 }}
                              animate={{ opacity: 0, y: -20 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.8 }}
                              className="absolute -top-6 -right-2 text-foreground font-medium text-sm pointer-events-none"
                            >
                              +1
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </div>
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
                      <Input
                        type="number"
                        value={xpValue}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val.length <= 3) {
                            setXpValue(val);
                          }
                        }}
                        className="w-24 text-center text-lg font-bold border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted"
                        placeholder="0"
                        max={999}
                        min={1}
                        data-testid="input-xp-value"
                      />
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
                      <div className="relative">
                        <AnimatePresence>
                          {showPlusOne.visible && showPlusOne.type === "experience" && (
                            <motion.span
                              initial={{ opacity: 1, y: 0 }}
                              animate={{ opacity: 0, y: -20 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.8 }}
                              className="absolute -top-6 -right-2 text-foreground font-medium text-sm pointer-events-none"
                            >
                              +1
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={handleAddExperience}
                        disabled={!experienceSelectedSkill || !xpValue || parseInt(xpValue) <= 0}
                        className="bg-muted/50 hover:bg-muted"
                        data-testid="button-new-experience"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Experience
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
                      <div className="relative">
                        <AnimatePresence>
                          {showPlusOne.visible && showPlusOne.type === "tools" && (
                            <motion.span
                              initial={{ opacity: 1, y: 0 }}
                              animate={{ opacity: 0, y: -20 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.8 }}
                              className="absolute -top-6 -right-2 text-foreground font-medium text-sm pointer-events-none"
                            >
                              +1
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </div>
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

                  <TabsContent value="habits" className="mt-4 flex flex-col flex-1 overflow-hidden">
                    <div className="flex-1 overflow-y-auto space-y-2 px-1">
                      {skillHabits.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">No habits linked to this area/project</p>
                      ) : (
                        (() => {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const todayStr = today.toISOString().slice(0, 10);

                          const getWeekDays = () => {
                            const dow = today.getDay();
                            const mo = dow === 0 ? -6 : 1 - dow;
                            return Array.from({ length: 7 }, (_, i) => {
                              const d = new Date(today);
                              d.setDate(today.getDate() + mo + i);
                              return d;
                            });
                          };

                          const computeStreak = (done: Set<string>): number => {
                            let s = 0;
                            const c = new Date(today);
                            if (done.has(todayStr)) {
                              s++;
                              c.setDate(c.getDate() - 1);
                            } else {
                              c.setDate(c.getDate() - 1);
                            }
                            while (true) {
                              const x = c.toISOString().slice(0, 10);
                              if (done.has(x)) {
                                s++;
                                c.setDate(c.getDate() - 1);
                              } else {
                                break;
                              }
                            }
                            return s;
                          };

                          const isBroken = (done: Set<string>): boolean => {
                            const yesterdayStr = new Date(today);
                            yesterdayStr.setDate(yesterdayStr.getDate() - 1);
                            const yesterdayDateStr = yesterdayStr.toISOString().slice(0, 10);
                            return !done.has(todayStr) && !done.has(yesterdayDateStr);
                          };

                          const weekDays = getWeekDays();
                          const DAY_LBLS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

                          return skillHabits.map((habit: any) => {
                            const habitData = habitDataWithRecords.find(h => h.id === habit.id);
                            const done = habitData?.done || new Set();
                            const streak = computeStreak(done);
                            const broken = isBroken(done);
                            const isToday = done.has(todayStr);

                            return (
                              <div
                                key={habit.id}
                                onClick={async () => {
                                  try {
                                    const today2 = new Date().toISOString().slice(0, 10);
                                    const isCompleting = isToday === false; // About to mark as complete
                                    
                                    await fetch(`/api/habit-records/${habit.id}`, {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ date: today2, completed: isToday ? 0 : 1 }),
                                    });
                                    
                                    // Award XP if habit is being completed and has a skill linked
                                    if (isCompleting && (habit.skillProgressId || habit.subskillId)) {
                                      const xpRes = await fetch(`/api/habits/${habit.id}/award-xp`, {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                      });
                                      
                                      if (xpRes.ok) {
                                        const xpData = await xpRes.json();
                                        // Show +5xp popup near cursor (approximate)
                                        setShowXpPopup({ visible: true, x: window.innerWidth / 2, y: window.innerHeight / 2 });
                                        setTimeout(() => setShowXpPopup({ visible: false, x: 0, y: 0 }), 1500);
                                        
                                        // Refetch skills to update XP display
                                        if (activeAreaId) {
                                          await queryClient.refetchQueries({ queryKey: ["/api/areas", activeAreaId] });
                                        } else if (activeProjectId) {
                                          await queryClient.refetchQueries({ queryKey: ["/api/projects", activeProjectId] });
                                        }
                                      }
                                    }
                                    
                                    // Reload records immediately
                                    const year = new Date().getFullYear();
                                    const startDate = `${year}-01-01`;
                                    const endDate = `${year}-12-31`;
                                    const recordsRes = await fetch(
                                      `/api/habit-records/${habit.id}?startDate=${startDate}&endDate=${endDate}`
                                    );
                                    const newRecords = recordsRes.ok ? await recordsRes.json() : [];
                                    const newDone = new Set(
                                      newRecords.filter((r: any) => r.completed === 1).map((r: any) => r.date)
                                    );
                                    setHabitDataWithRecords((prev: any[]) =>
                                      prev.map(h => h.id === habit.id ? { ...h, done: newDone } : h)
                                    );
                                    // Refetch habits cache so HabitStreakModal updates immediately
                                    await queryClient.refetchQueries({ queryKey: ["habits"] });
                                  } catch (error) {
                                    console.error("Error toggling habit:", error);
                                  }
                                }}
                                className={`cursor-pointer rounded-lg border px-3 py-2 transition-all ${
                                  isToday
                                    ? "border-purple-500 bg-purple-500/10"
                                    : broken
                                      ? "border-border/30 bg-muted/30"
                                      : "border-border/30 hover:border-purple-400 hover:bg-purple-500/5"
                                }`}
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-lg flex-shrink-0">{habit.emoji}</span>
                                  <span className="font-bold text-xs text-foreground flex-1 truncate">
                                    {habit.name}
                                  </span>
                                  <span className={`text-xs font-medium flex-shrink-0 ${broken ? "text-muted-foreground" : "text-purple-600 dark:text-purple-400"}`}>
                                    {broken ? "— rota" : `🔥 ${streak}`}
                                  </span>
                                </div>

                                <div className="flex gap-1 items-center">
                                  {weekDays.map((w, i) => {
                                    const wds = w.toISOString().slice(0, 10);
                                    const wc = new Date(w);
                                    wc.setHours(0, 0, 0, 0);
                                    const isFut = wc > today;
                                    const isTod = wds === todayStr;
                                    const isDone = done.has(wds);
                                    const isMissed = wc < today && !isDone;

                                    return (
                                      <div
                                        key={i}
                                        className="flex flex-col items-center gap-0.5 flex-1 text-center"
                                      >
                                        <div
                                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
                                            isDone
                                              ? "bg-gray-900 border border-purple-500"
                                              : isTod
                                                ? "border-2 border-purple-500 bg-purple-500/20"
                                                : isMissed
                                                  ? "bg-muted border border-dashed border-border/50 opacity-50"
                                                  : isFut
                                                    ? "border border-border/30 opacity-20"
                                                    : "border border-border/30"
                                          }`}
                                        >
                                          {isDone ? <span className="text-sm">🔥</span> : ""}
                                        </div>
                                        <span className="text-xs font-medium text-muted-foreground">
                                          {DAY_LBLS[i]}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          });
                        })()
                      )}
                    </div>
                  </TabsContent>
                </Tabs>

                <AnimatePresence>
                  {showXpPopup.visible && (
                    <motion.div
                      initial={{ opacity: 0, y: -100, scale: 0.5 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 100, scale: 0.5 }}
                      transition={{ duration: 0.4, type: "spring", damping: 10 }}
                      className="fixed left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50"
                    >
                      <div className="text-5xl font-bold text-green-400 drop-shadow-lg">+5xp</div>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                <div className="flex justify-between mt-auto pt-6">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setEditStep(skill.levelPosition === 1 ? 0 : 1)}
                    className="h-10 w-10 bg-muted/50 hover:bg-muted"
                    data-testid="button-prev-step-2"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button 
                    onClick={() => setIsEditDialogOpen(false)}
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
              <div className="relative">
                <AnimatePresence>
                  {showPlusOne.visible && showPlusOne.type === "tools" && (
                    <motion.span
                      initial={{ opacity: 1, y: 0 }}
                      animate={{ opacity: 0, y: -20 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.8 }}
                      className="absolute -top-6 -right-2 text-foreground font-medium text-sm pointer-events-none"
                    >
                      +1
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
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
              <div className="relative">
                <AnimatePresence>
                  {showPlusOne.visible && showPlusOne.type === "learnings" && (
                    <motion.span
                      initial={{ opacity: 1, y: 0 }}
                      animate={{ opacity: 0, y: -20 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.8 }}
                      className="absolute -top-6 -right-2 text-foreground font-medium text-sm pointer-events-none"
                    >
                      +1
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
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


