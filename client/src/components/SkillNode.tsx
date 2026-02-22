import { motion, AnimatePresence } from "framer-motion";
import { type Skill, useSkillTree } from "@/lib/skill-context";
import { type JournalThought, type JournalLearning, type JournalTool } from "@shared/schema";
import { cn } from "@/lib/utils";
import { Check, Lock, Trash2, ChevronUp, ChevronDown, Pencil, Plus, Star, ChevronRight, ChevronLeft, Wrench, Lightbulb } from "lucide-react";
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
  const hasStar = skill.isFinalNode === 1; // Has the star activated (final final node)
  const isInicioNode = skill.title.toLowerCase() === "inicio"; // "inicio" nodes are text-only, not interactive
  
  const { 
    activeAreaId, 
    activeProjectId,
    activeParentSkillId,
    activeArea,
    activeProject,
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
    toggleSubSkillFinalNode
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
  
  // Calculate if this node is the last node of its level (by Y position)
  const isLastNodeOfLevel = skillsInLevel.length > 0 && 
    skill.y === Math.max(...skillsInLevel.map(s => s.y));
  
  // Calculate effective locked state: final nodes (by position or star) should appear locked
  // if not all other nodes in level are mastered
  const isFinalNodeByPosition = isLastNodeOfLevel || hasStar;
  const otherNodesInLevel = skillsInLevel.filter(s => s.id !== skill.id);
  const allOthersMastered = otherNodesInLevel.every(s => s.status === "mastered");
  
  // Effective states: final nodes show as locked if others aren't mastered
  const shouldForceLock = isFinalNodeByPosition && skill.status !== "mastered" && !allOthersMastered;
  const isLocked = skill.status === "locked" || shouldForceLock;
  const isMastered = skill.status === "mastered";

  // Detect if node has default name
  const hasDefaultName = skill.title === "Next challenge" || skill.title === "Next objetive quest" || skill.title === "Objective quest";
  
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
  
  const [isSubtitleDialogOpen, setIsSubtitleDialogOpen] = useState(false);
  const [isSubtaskConfirmOpen, setIsSubtaskConfirmOpen] = useState(false);
  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);
  const levelSubtitles = isProject ? (activeProject?.levelSubtitles || {}) : (activeArea?.levelSubtitles || {});
  const currentSubtitle = levelSubtitles[skill.level.toString()] || "";
  const [editSubtitle, setEditSubtitle] = useState(currentSubtitle);
  const levelLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTitleLongPress = useRef(false);

  // Tools & Learnings form state
  const queryClient = useQueryClient();
  const [feedbackActiveTab, setFeedbackActiveTab] = useState<"thoughts" | "tools" | "learnings" | "experience">("thoughts");
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
  
  // XP state
  const [xpValue, setXpValue] = useState(skill.experiencePoints ? skill.experiencePoints.toString() : "");
  const [showXpAnimation, setShowXpAnimation] = useState(false);
  const [animatedXpValue, setAnimatedXpValue] = useState("");
  const pendingXpValue = useRef<string>("");
  const prevStatus = useRef<string>(skill.status);
  const wasDialogOpen = useRef(false);
  
  // Add options popup state
  const [isAddOptionsOpen, setIsAddOptionsOpen] = useState(false);

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
    console.log("[handleAddExperience] XP to add:", xpToAdd, "Skill:", experienceSelectedSkill);
    
    const skillsProgress = localStorage.getItem("skillsProgress");
    console.log("[handleAddExperience] Current localStorage:", skillsProgress);
    
    let skills: any;
    if (skillsProgress) {
      try {
        skills = JSON.parse(skillsProgress);
      } catch (error) {
        console.error("[handleAddExperience] Error parsing skillsProgress:", error);
        return;
      }
    } else {
      // Initialize skills if not in localStorage
      const SKILLS_LIST = ["Limpieza", "Guitarra", "Lectura", "Growth mindset", "Acertividad"];
      skills = {};
      SKILLS_LIST.forEach((skillName) => {
        skills[skillName] = { name: skillName, currentXp: 0, level: 1 };
      });
      console.log("[handleAddExperience] Initialized new skills object:", skills);
    }
    
    if (skills && experienceSelectedSkill && skills[experienceSelectedSkill]) {
      try {
        const xpPerLevel = 500;
        
        const oldXp = skills[experienceSelectedSkill].currentXp;
        const oldLevel = skills[experienceSelectedSkill].level;
        
        skills[experienceSelectedSkill].currentXp += xpToAdd;
        
        // Calculate new level based on total XP (level = floor(XP / 500) + 1)
        skills[experienceSelectedSkill].level = Math.floor(skills[experienceSelectedSkill].currentXp / xpPerLevel) + 1;
        const newLevel = skills[experienceSelectedSkill].level;
        
        console.log("[handleAddExperience] Updated skill:", {
          skillName: experienceSelectedSkill,
          oldXp,
          newXp: skills[experienceSelectedSkill].currentXp,
          oldLevel,
          newLevel
        });

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
        console.log("[handleAddExperience] Saved to localStorage, dispatching event");
        
        // Save to server
        try {
          await fetch("/api/skills-progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              skillName: experienceSelectedSkill,
              currentXp: skills[experienceSelectedSkill].currentXp,
              level: skills[experienceSelectedSkill].level
            })
          });
          console.log("[handleAddExperience] Saved to server successfully");
        } catch (error) {
          console.error('[handleAddExperience] Error saving to server:', error);
        }
        
        // Dispatch event to update UI
        console.log("[handleAddExperience] Dispatching skillXpAdded event");
        window.dispatchEvent(new CustomEvent('skillXpAdded', { 
          detail: { skillName: experienceSelectedSkill, currentXp: skills[experienceSelectedSkill].currentXp }
        }));
        
        // Clear inputs and show feedback
        setXpValue("");
        setExperienceSelectedSkill(null);
        setShowPlusOne({ visible: true, type: "experience" });
        setTimeout(() => setShowPlusOne({ visible: false, type: "experience" }), 1000);
      } catch (error) {
        console.error("[handleAddExperience] Error updating skill:", error);
      }
    } else if (!skills) {
      console.error("[handleAddExperience] Failed to initialize or parse skills");
    } else {
      console.error("[handleAddExperience] Skill not found in skills object:", experienceSelectedSkill, "Available:", skills ? Object.keys(skills) : "N/A");
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
      setEditStep(0);
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
      updateProjectLevelSubtitle(activeId, skill.level, editSubtitle);
    } else {
      updateLevelSubtitle(activeId, skill.level, editSubtitle);
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
    
    // Update localStorage and dispatch event IMMEDIATELY (before mutations)
    if (experienceSelectedSkill && xpValue && parseInt(xpValue) > 0) {
      const xpToAdd = parseInt(xpValue);
      const skillsProgress = localStorage.getItem("skillsProgress");
      
      let skills: any;
      if (skillsProgress) {
        try {
          skills = JSON.parse(skillsProgress);
        } catch (error) {
          console.error("[handleEditSave] Error parsing skillsProgress:", error);
          return;
        }
      } else {
        // Initialize skills if not in localStorage
        const SKILLS_LIST = ["Limpieza", "Guitarra", "Lectura", "Growth mindset", "Acertividad"];
        skills = {};
        SKILLS_LIST.forEach((skillName) => {
          skills[skillName] = { name: skillName, currentXp: 0, level: 1 };
        });
        console.log("[handleEditSave] Initialized new skills object:", skills);
      }
      
      if (skills && skills[experienceSelectedSkill]) {
        try {
          const xpPerLevel = 500;
          const oldLevel = skills[experienceSelectedSkill].level;
          
          skills[experienceSelectedSkill].currentXp += xpToAdd;
          
          // Calculate new level based on total XP (level = floor(XP / 500) + 1)
          skills[experienceSelectedSkill].level = Math.floor(skills[experienceSelectedSkill].currentXp / xpPerLevel) + 1;
          const newLevel = skills[experienceSelectedSkill].level;

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
                skillName: experienceSelectedSkill,
                currentXp: skills[experienceSelectedSkill].currentXp,
                level: skills[experienceSelectedSkill].level
              })
            });
          } catch (error) {
            console.error('[handleEditSave] Error saving to server:', error);
          }
          
          // Dispatch event immediately to update UI without waiting for mutations
          window.dispatchEvent(new CustomEvent('skillXpAdded', { 
            detail: { skillName: experienceSelectedSkill, currentXp: skills[experienceSelectedSkill].currentXp }
          }));
        } catch (error) {
          console.error('[handleEditSave] Error updating localStorage:', error);
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
    if (isLongPress.current) {
      e.preventDefault();
      e.stopPropagation();
      isLongPress.current = false;
      return;
    }
    if (isLocked) {
      return; // Locked nodes cannot be clicked - only unlock when previous node is mastered
    }
    
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

          {/* Label */}
          <div className={cn(
            "absolute left-14 top-1/2 -translate-y-1/2 font-medium transition-colors text-sm flex items-center gap-2",
            isLocked ? "text-muted-foreground" : "text-foreground",
            isMastered && "text-foreground",
            (skill.title === "Next challenge" || skill.title === "Next objetive quest" || skill.title === "Objective quest") && "text-muted-foreground/60"
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
              {skill.title}
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
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
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
            <span className="text-xs text-muted-foreground">Mover</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
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
                         addSubSkillBelow(skill.id, "Next challenge");
                       } else if (isProject) {
                         addProjectSkillBelow(activeId, skill.id, "Next challenge");
                       } else {
                         addSkillBelow(activeId, skill.id, "Next challenge");
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
                 </div>
               </PopoverContent>
             </Popover>

             {/* Star button - show for last node of level OR if node already has star (to allow removal) */}
             {(isLastNodeOfLevel || hasStar) && (
               <Button 
                 variant="ghost"
                 size="sm" 
                 className={cn(
                   "h-8 w-8 p-0 text-xs",
                   hasStar ? "bg-amber-500 hover:bg-amber-600 text-white" : "bg-muted/50 hover:bg-muted"
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
                 title={hasStar ? "Quitar nodo final final" : "Marcar como nodo final final"}
               >
                 <Star className={cn("h-3 w-3", hasStar && "fill-white")} />
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
                    onClick={() => setEditStep(1)}
                    className="h-10 w-10 bg-muted/50 hover:bg-muted"
                    data-testid="button-next-step"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
              </motion.div>
            )}

            {editStep === 1 && (
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
                <Tabs value={feedbackActiveTab} onValueChange={(v) => setFeedbackActiveTab(v as "thoughts" | "tools" | "learnings" | "experience")} className="w-full flex flex-col flex-1">
                  <TabsList className="w-full grid grid-cols-4 bg-muted/50">
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
                          {experienceSelectedSkill ? `✓ ${experienceSelectedSkill}` : "Seleccionar skill"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56 p-2 border-0 bg-background/95 backdrop-blur-sm" align="center" side="top">
                        <div className="max-h-48 overflow-y-auto">
                          <div className="space-y-1">
                            {["Limpieza", "Guitarra", "Lectura", "Growth mindset", "Acertividad"].map((skillName) => (
                              <Button
                                key={skillName}
                                variant="ghost"
                                size="sm"
                                className={`w-full justify-start h-8 px-3 text-xs font-normal ${
                                  experienceSelectedSkill === skillName 
                                    ? "bg-muted text-foreground" 
                                    : "hover:bg-muted/50"
                                }`}
                                onClick={() => {
                                  setExperienceSelectedSkill(skillName);
                                  setShowExperienceSkillSelector(false);
                                }}
                                data-testid={`button-select-skill-${skillName}`}
                              >
                                {skillName}
                              </Button>
                            ))}
                          </div>
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
                </Tabs>
                
                <div className="flex justify-between mt-auto pt-6">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setEditStep(1)}
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

    <Dialog open={isSubtitleDialogOpen} onOpenChange={setIsSubtitleDialogOpen}>
      <DialogContent className="sm:max-w-[350px] border-0 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">Subtítulo del Nivel {skill.level}</DialogTitle>
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


