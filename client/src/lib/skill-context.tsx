import { createContext, useContext, useState, useEffect } from "react";
import { Music, Trophy, BookOpen, Home } from "lucide-react";

export type SkillStatus = "locked" | "available" | "mastered";

export interface Skill {
  id: string;
  areaId?: string;
  projectId?: string;
  parentSkillId?: string;
  title: string;
  description: string;
  status: SkillStatus;
  x: number;
  y: number;
  dependencies: string[];
  manualLock?: number;
  isFinalNode?: number;
  level: number;
  levelPosition?: number;
}

export interface Area {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
  unlockedLevel: number;
  nextLevelToAssign: number;
  levelSubtitles: Record<string, string>;
  skills: Skill[];
}

export interface Project {
  id: string;
  name: string;
  icon: string;
  description: string;
  unlockedLevel: number;
  nextLevelToAssign: number;
  levelSubtitles: Record<string, string>;
  skills: Skill[];
}

interface ParentSkillInfo {
  id: string;
  title: string;
}

interface SkillTreeContextType {
  areas: Area[];
  activeAreaId: string;
  setActiveAreaId: (id: string) => void;
  toggleSkillStatus: (areaId: string, skillId: string) => void;
  toggleProjectSkillStatus: (projectId: string, skillId: string) => void;
  addSkill: (areaId: string, skill: Omit<Skill, "id">) => void;
  updateSkill: (areaId: string, skillId: string, updates: { title?: string; description?: string }) => void;
  deleteSkill: (areaId: string, skillId: string) => void;
  toggleLock: (areaId: string, skillId: string) => void;
  moveSkill: (areaId: string, skillId: string, direction: "up" | "down") => void;
  updateProjectSkill: (projectId: string, skillId: string, updates: { title?: string; description?: string }) => void;
  deleteProjectSkill: (projectId: string, skillId: string) => void;
  toggleProjectLock: (projectId: string, skillId: string) => void;
  moveProjectSkill: (projectId: string, skillId: string, direction: "up" | "down") => void;
  createArea: (name: string, description: string, icon: string) => Promise<void>;
  deleteArea: (areaId: string) => Promise<void>;
  activeArea: Area | undefined;
  isLoading: boolean;
  projects: Project[];
  activeProjectId: string;
  setActiveProjectId: (id: string) => void;
  activeProject: Project | undefined;
  createProject: (name: string, description: string, icon: string) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  activeParentSkillId: string | null;
  parentSkillStack: ParentSkillInfo[];
  subSkills: Skill[];
  enterSubSkillTree: (skillId: string, skillTitle: string) => Promise<void>;
  exitSubSkillTree: () => void;
  toggleSubSkillStatus: (skillId: string) => void;
  updateSubSkill: (skillId: string, updates: { title?: string; description?: string }) => void;
  deleteSubSkill: (skillId: string) => void;
  toggleSubSkillLock: (skillId: string) => void;
  moveSubSkill: (skillId: string, direction: "up" | "down") => void;
  addSkillBelow: (areaId: string, skillId: string) => Promise<void>;
  addProjectSkillBelow: (projectId: string, skillId: string) => Promise<void>;
  addSubSkillBelow: (skillId: string) => Promise<void>;
  updateLevelSubtitle: (areaId: string, level: number, subtitle: string) => Promise<void>;
  updateProjectLevelSubtitle: (projectId: string, level: number, subtitle: string) => Promise<void>;
  toggleFinalNode: (areaId: string, skillId: string) => Promise<void>;
  toggleProjectFinalNode: (projectId: string, skillId: string) => Promise<void>;
  toggleSubSkillFinalNode: (skillId: string) => Promise<void>;
  showLevelUp: boolean;
}

const SkillTreeContext = createContext<SkillTreeContextType | undefined>(undefined);

const iconMap: Record<string, any> = {
  Music,
  Trophy,
  BookOpen,
  Home,
};

export function SkillTreeProvider({ children }: { children: React.ReactNode }) {
  const [areas, setAreas] = useState<Area[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeAreaId, setActiveAreaId] = useState<string>("");
  const [activeProjectId, setActiveProjectId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [activeParentSkillId, setActiveParentSkillId] = useState<string | null>(null);
  const [parentSkillStack, setParentSkillStack] = useState<ParentSkillInfo[]>([]);
  const [subSkills, setSubSkills] = useState<Skill[]>([]);
  const [showLevelUp, setShowLevelUp] = useState(false);

  const triggerLevelUp = () => {
    setShowLevelUp(true);
    setTimeout(() => setShowLevelUp(false), 2000);
  };

  const activeArea = areas.find(a => a.id === activeAreaId);
  const activeProject = projects.find(p => p.id === activeProjectId);

  const handleSetActiveAreaId = (id: string) => {
    setActiveAreaId(id);
    setActiveProjectId("");
  };

  const handleSetActiveProjectId = (id: string) => {
    setActiveProjectId(id);
    setActiveAreaId("");
  };

  // Load areas and projects from API
  useEffect(() => {
    async function loadData() {
      try {
        const [areasResponse, projectsResponse] = await Promise.all([
          fetch("/api/areas"),
          fetch("/api/projects")
        ]);
        const areasData = await areasResponse.json();
        const projectsData = await projectsResponse.json();
        setAreas(areasData);
        setProjects(projectsData);
        if (areasData.length > 0 && !activeAreaId) {
          setActiveAreaId(areasData[0].id);
        }
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const toggleSkillStatus = async (areaId: string, skillId: string) => {
    const area = areas.find(a => a.id === areaId);
    if (!area) return;
    
    const skill = area.skills.find(s => s.id === skillId);
    if (!skill) return;

    // Check if this is a final node - can only be confirmed if all other nodes in level are mastered
    const skillsInLevel = area.skills.filter(s => s.level === skill.level);
    if (skill.isFinalNode === 1 && skill.status !== "mastered") {
      const otherNodesInLevel = skillsInLevel.filter(s => s.id !== skill.id);
      const allOthersMastered = otherNodesInLevel.every(s => s.status === "mastered");
      if (!allOthersMastered) {
        return;
      }
    }

    const nextStatus: Record<SkillStatus, SkillStatus> = {
      "locked": "locked",
      "available": "mastered",
      "mastered": "available"
    };

    const newStatus = nextStatus[skill.status];
    const isLastNodeOfLevel = skillsInLevel.length > 0 && 
      skill.y === Math.max(...skillsInLevel.map(s => s.y));
    
    // Last node of level can open new levels, UNLESS it has the star (isFinalNode === 1)
    const hasStar = skill.isFinalNode === 1;
    const canOpenNewLevels = isLastNodeOfLevel && !hasStar;
    const isOpeningNewLevel = canOpenNewLevels && newStatus === "mastered";
    const isClosingLevel = canOpenNewLevels && skill.status === "mastered" && newStatus === "available";

    try {
      await fetch(`/api/skills/${skillId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (isOpeningNewLevel) {
        triggerLevelUp();
        const newUnlockedLevel = skill.level + 1;
        
        // Generate 5 placeholder nodes for the new level (this also updates area in a transaction)
        // This endpoint is idempotent - if nodes exist, it returns them without creating duplicates
        const generateResponse = await fetch(`/api/areas/${areaId}/generate-level`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ level: newUnlockedLevel }),
        });
        
        if (!generateResponse.ok) {
          console.error("Failed to generate new level");
          setAreas(prev => prev.map(a => {
            if (a.id !== areaId) return a;
            return {
              ...a,
              skills: a.skills.map(s => 
                s.id === skillId ? { ...s, status: newStatus } : s
              )
            };
          }));
          return;
        }
        
        const { updatedArea, createdSkills } = await generateResponse.json();
        
        // Merge skills - avoid duplicates by checking existing skill IDs
        setAreas(prev => prev.map(a => {
          if (a.id !== areaId) return a;
          const existingSkillIds = new Set(a.skills.map(s => s.id));
          const newSkills = createdSkills.filter((s: Skill) => !existingSkillIds.has(s.id));
          return {
            ...a,
            unlockedLevel: updatedArea.unlockedLevel,
            nextLevelToAssign: updatedArea.nextLevelToAssign,
            skills: [
              ...a.skills.map(s => 
                s.id === skillId ? { ...s, status: newStatus } : s
              ),
              ...newSkills
            ]
          };
        }));
      } else if (isClosingLevel) {
        const revertedLevel = skill.level;
        
        const higherLevelSkills = area.skills.filter(s => s.level > revertedLevel);
        
        await Promise.all([
          fetch(`/api/areas/${areaId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              unlockedLevel: revertedLevel,
              nextLevelToAssign: revertedLevel
            }),
          }),
          ...higherLevelSkills.map(s => 
            fetch(`/api/skills/${s.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "locked" }),
            })
          )
        ]);

        setAreas(prev => prev.map(a => {
          if (a.id !== areaId) return a;
          return {
            ...a,
            unlockedLevel: revertedLevel,
            nextLevelToAssign: revertedLevel,
            skills: a.skills.map(s => {
              if (s.id === skillId) return { ...s, status: newStatus };
              if (s.level > revertedLevel) return { ...s, status: "locked" as SkillStatus };
              return s;
            })
          };
        }));
      } else {
        setAreas(prev => prev.map(a => {
          if (a.id !== areaId) return a;
          return {
            ...a,
            skills: a.skills.map(s => 
              s.id === skillId ? { ...s, status: newStatus } : s
            )
          };
        }));
      }
    } catch (error) {
      console.error("Error toggling skill status:", error);
    }
  };

  const toggleProjectSkillStatus = async (projectId: string, skillId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    const skill = project.skills.find(s => s.id === skillId);
    if (!skill) return;

    // Check if this is a final node - can only be confirmed if all other nodes in level are mastered
    const skillsInLevel = project.skills.filter(s => s.level === skill.level);
    if (skill.isFinalNode === 1 && skill.status !== "mastered") {
      const otherNodesInLevel = skillsInLevel.filter(s => s.id !== skill.id);
      const allOthersMastered = otherNodesInLevel.every(s => s.status === "mastered");
      if (!allOthersMastered) {
        return;
      }
    }

    const nextStatus: Record<SkillStatus, SkillStatus> = {
      "locked": "locked",
      "available": "mastered",
      "mastered": "available"
    };

    const newStatus = nextStatus[skill.status];
    const isLastNodeOfLevel = skillsInLevel.length > 0 && 
      skill.y === Math.max(...skillsInLevel.map(s => s.y));
    
    // Last node of level can open new levels, UNLESS it has the star (isFinalNode === 1)
    const hasStar = skill.isFinalNode === 1;
    const canOpenNewLevels = isLastNodeOfLevel && !hasStar;
    const isOpeningNewLevel = canOpenNewLevels && newStatus === "mastered";
    const isClosingLevel = canOpenNewLevels && skill.status === "mastered" && newStatus === "available";

    try {
      await fetch(`/api/skills/${skillId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (isOpeningNewLevel) {
        triggerLevelUp();
        const newUnlockedLevel = skill.level + 1;
        
        const generateResponse = await fetch(`/api/projects/${projectId}/generate-level`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ level: newUnlockedLevel }),
        });
        
        if (!generateResponse.ok) {
          console.error("Failed to generate new level");
          setProjects(prev => prev.map(p => {
            if (p.id !== projectId) return p;
            return {
              ...p,
              skills: p.skills.map(s => 
                s.id === skillId ? { ...s, status: newStatus } : s
              )
            };
          }));
          return;
        }
        
        const { updatedProject, createdSkills } = await generateResponse.json();
        
        setProjects(prev => prev.map(p => {
          if (p.id !== projectId) return p;
          const existingSkillIds = new Set(p.skills.map(s => s.id));
          const newSkills = createdSkills.filter((s: Skill) => !existingSkillIds.has(s.id));
          return {
            ...p,
            unlockedLevel: updatedProject.unlockedLevel,
            nextLevelToAssign: updatedProject.nextLevelToAssign,
            skills: [
              ...p.skills.map(s => 
                s.id === skillId ? { ...s, status: newStatus } : s
              ),
              ...newSkills
            ]
          };
        }));
      } else if (isClosingLevel) {
        const revertedLevel = skill.level;
        
        const higherLevelSkills = project.skills.filter(s => s.level > revertedLevel);
        
        await Promise.all([
          fetch(`/api/projects/${projectId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              unlockedLevel: revertedLevel,
              nextLevelToAssign: revertedLevel
            }),
          }),
          ...higherLevelSkills.map(s => 
            fetch(`/api/skills/${s.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "locked" }),
            })
          )
        ]);

        setProjects(prev => prev.map(p => {
          if (p.id !== projectId) return p;
          return {
            ...p,
            unlockedLevel: revertedLevel,
            nextLevelToAssign: revertedLevel,
            skills: p.skills.map(s => {
              if (s.id === skillId) return { ...s, status: newStatus };
              if (s.level > revertedLevel) return { ...s, status: "locked" as SkillStatus };
              return s;
            })
          };
        }));
      } else {
        setProjects(prev => prev.map(p => {
          if (p.id !== projectId) return p;
          return {
            ...p,
            skills: p.skills.map(s => 
              s.id === skillId ? { ...s, status: newStatus } : s
            )
          };
        }));
      }
    } catch (error) {
      console.error("Error toggling project skill status:", error);
    }
  };

  const toggleLock = async (areaId: string, skillId: string) => {
    const area = areas.find(a => a.id === areaId);
    if (!area) return;
    
    const skill = area.skills.find(s => s.id === skillId);
    if (!skill) return;

    const isLocked = skill.status === "locked";
    const newStatus = isLocked ? "available" : "locked";
    const newManualLock = isLocked ? 0 : 1;

    try {
      await fetch(`/api/skills/${skillId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          status: newStatus,
          manualLock: newManualLock
        }),
      });

      setAreas(prev => prev.map(area => {
        if (area.id !== areaId) return area;
        return {
          ...area,
          skills: area.skills.map(skill => 
            skill.id === skillId 
              ? { ...skill, status: newStatus, manualLock: newManualLock } 
              : skill
          )
        };
      }));
    } catch (error) {
      console.error("Error toggling lock:", error);
    }
  };

  const deleteSkill = async (areaId: string, skillId: string) => {
    const area = areas.find(a => a.id === areaId);
    if (!area) return;

    const skillToDelete = area.skills.find(s => s.id === skillId);
    if (!skillToDelete) return;

    // Find children (nodes that depend on this skill)
    const children = area.skills.filter(s => s.dependencies.includes(skillId));
    const newDependencies = skillToDelete.dependencies;

    // Check if we're deleting a final node - need to mark the previous one as final
    const wasIsFinalNode = skillToDelete.isFinalNode === 1;
    let newFinalNodeId: string | null = null;
    
    if (wasIsFinalNode) {
      const sameLevelSkills = area.skills
        .filter(s => s.level === skillToDelete.level && s.id !== skillId)
        .sort((a, b) => a.y - b.y);
      if (sameLevelSkills.length > 0) {
        newFinalNodeId = sameLevelSkills[sameLevelSkills.length - 1].id;
      }
    }

    try {
      // Delete the skill
      await fetch(`/api/skills/${skillId}`, { method: "DELETE" });

      // Update children's dependencies
      for (const child of children) {
        const updatedDeps = child.dependencies
          .filter(d => d !== skillId)
          .concat(newDependencies);
        
        await fetch(`/api/skills/${child.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dependencies: updatedDeps }),
        });
      }

      // Shift nodes below up by 150px
      const nodesToShift = area.skills.filter(s => s.y > skillToDelete.y);
      for (const node of nodesToShift) {
        await fetch(`/api/skills/${node.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ y: node.y - 150 }),
        });
      }

      // Mark new final node if needed
      if (newFinalNodeId) {
        await fetch(`/api/skills/${newFinalNodeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isFinalNode: 1 }),
        });
      }

      // Update local state
      setAreas(prev => prev.map(area => {
        if (area.id !== areaId) return area;

        const updatedSkills = area.skills
          .filter(s => s.id !== skillId)
          .map(s => {
            let updated = { ...s };
            
            if (children.find(c => c.id === s.id)) {
              updated.dependencies = s.dependencies
                .filter(d => d !== skillId)
                .concat(newDependencies);
            }
            
            if (s.y > skillToDelete.y) {
              updated.y = s.y - 150;
            }

            if (s.id === newFinalNodeId) {
              updated.isFinalNode = 1;
            }
            
            return updated;
          });

        return { ...area, skills: updatedSkills };
      }));
    } catch (error) {
      console.error("Error deleting skill:", error);
    }
  };

  const addSkill = async (areaId: string, newSkillData: Omit<Skill, "id">) => {
    try {
      const response = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSkillData),
      });
      const newSkill = await response.json();

      setAreas(prev => prev.map(area => {
        if (area.id !== areaId) return area;
        return {
          ...area,
          skills: [...area.skills, newSkill]
        };
      }));
    } catch (error) {
      console.error("Error adding skill:", error);
    }
  };

  const updateSkill = async (areaId: string, skillId: string, updates: { title?: string; description?: string }) => {
    try {
      await fetch(`/api/skills/${skillId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      setAreas(prev => prev.map(area => {
        if (area.id !== areaId) return area;
        return {
          ...area,
          skills: area.skills.map(skill => 
            skill.id === skillId ? { ...skill, ...updates } : skill
          )
        };
      }));
    } catch (error) {
      console.error("Error updating skill:", error);
    }
  };

  const moveSkill = async (areaId: string, skillId: string, direction: "up" | "down") => {
    const area = areas.find(a => a.id === areaId);
    if (!area) return;

    const skill = area.skills.find(s => s.id === skillId);
    if (!skill) return;

    const sameLevelSkills = [...area.skills]
      .filter(s => s.level === skill.level)
      .sort((a, b) => a.y - b.y);
    
    const currentIndex = sameLevelSkills.findIndex(s => s.id === skillId);
    
    let neighborIndex: number;
    if (direction === "up") {
      neighborIndex = currentIndex - 1;
    } else {
      neighborIndex = currentIndex + 1;
    }

    if (neighborIndex < 0 || neighborIndex >= sameLevelSkills.length) return;

    const neighbor = sameLevelSkills[neighborIndex];
    const currentY = skill.y;
    const neighborY = neighbor.y;

    const isCurrentFinal = skill.isFinalNode === 1;
    const isNeighborFinal = neighbor.isFinalNode === 1;

    let swapFinalNode = false;
    if (isCurrentFinal || isNeighborFinal) {
      swapFinalNode = true;
    }

    const currentDeps = skill.dependencies;
    const neighborDeps = neighbor.dependencies;

    try {
      const updates: Promise<Response>[] = [
        fetch(`/api/skills/${skillId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            y: neighborY,
            dependencies: neighborDeps,
            ...(swapFinalNode && isCurrentFinal ? { isFinalNode: 0 } : {}),
            ...(swapFinalNode && isNeighborFinal ? { isFinalNode: 1 } : {})
          }),
        }),
        fetch(`/api/skills/${neighbor.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            y: currentY,
            dependencies: currentDeps,
            ...(swapFinalNode && isNeighborFinal ? { isFinalNode: 0 } : {}),
            ...(swapFinalNode && isCurrentFinal ? { isFinalNode: 1 } : {})
          }),
        })
      ];

      await Promise.all(updates);

      setAreas(prev => prev.map(area => {
        if (area.id !== areaId) return area;
        return {
          ...area,
          skills: area.skills.map(s => {
            if (s.id === skillId) {
              return { 
                ...s, 
                y: neighborY,
                dependencies: neighborDeps,
                ...(swapFinalNode && isCurrentFinal ? { isFinalNode: 0 } : {}),
                ...(swapFinalNode && isNeighborFinal ? { isFinalNode: 1 } : {})
              };
            }
            if (s.id === neighbor.id) {
              return { 
                ...s, 
                y: currentY,
                dependencies: currentDeps,
                ...(swapFinalNode && isNeighborFinal ? { isFinalNode: 0 } : {}),
                ...(swapFinalNode && isCurrentFinal ? { isFinalNode: 1 } : {})
              };
            }
            return s;
          })
        };
      }));
    } catch (error) {
      console.error("Error moving skill:", error);
    }
  };

  const toggleProjectLock = async (projectId: string, skillId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    const skill = project.skills.find(s => s.id === skillId);
    if (!skill) return;

    const isLocked = skill.status === "locked";
    const newStatus = isLocked ? "available" : "locked";
    const newManualLock = isLocked ? 0 : 1;

    try {
      await fetch(`/api/skills/${skillId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          status: newStatus,
          manualLock: newManualLock
        }),
      });

      setProjects(prev => prev.map(project => {
        if (project.id !== projectId) return project;
        return {
          ...project,
          skills: project.skills.map(skill => 
            skill.id === skillId 
              ? { ...skill, status: newStatus, manualLock: newManualLock } 
              : skill
          )
        };
      }));
    } catch (error) {
      console.error("Error toggling project lock:", error);
    }
  };

  const deleteProjectSkill = async (projectId: string, skillId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const skillToDelete = project.skills.find(s => s.id === skillId);
    if (!skillToDelete) return;

    const children = project.skills.filter(s => s.dependencies.includes(skillId));
    const newDependencies = skillToDelete.dependencies;

    const wasIsFinalNode = skillToDelete.isFinalNode === 1;
    let newFinalNodeId: string | null = null;
    
    if (wasIsFinalNode) {
      const sameLevelSkills = project.skills
        .filter(s => s.level === skillToDelete.level && s.id !== skillId)
        .sort((a, b) => a.y - b.y);
      if (sameLevelSkills.length > 0) {
        newFinalNodeId = sameLevelSkills[sameLevelSkills.length - 1].id;
      }
    }

    try {
      await fetch(`/api/skills/${skillId}`, { method: "DELETE" });

      for (const child of children) {
        const updatedDeps = child.dependencies
          .filter(d => d !== skillId)
          .concat(newDependencies);
        
        await fetch(`/api/skills/${child.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dependencies: updatedDeps }),
        });
      }

      const nodesToShift = project.skills.filter(s => s.y > skillToDelete.y);
      for (const node of nodesToShift) {
        await fetch(`/api/skills/${node.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ y: node.y - 150 }),
        });
      }

      if (newFinalNodeId) {
        await fetch(`/api/skills/${newFinalNodeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isFinalNode: 1 }),
        });
      }

      setProjects(prev => prev.map(project => {
        if (project.id !== projectId) return project;

        const updatedSkills = project.skills
          .filter(s => s.id !== skillId)
          .map(s => {
            let updated = { ...s };
            
            if (children.find(c => c.id === s.id)) {
              updated.dependencies = s.dependencies
                .filter(d => d !== skillId)
                .concat(newDependencies);
            }
            
            if (s.y > skillToDelete.y) {
              updated.y = s.y - 150;
            }

            if (s.id === newFinalNodeId) {
              updated.isFinalNode = 1;
            }
            
            return updated;
          });

        return { ...project, skills: updatedSkills };
      }));
    } catch (error) {
      console.error("Error deleting project skill:", error);
    }
  };

  const updateProjectSkill = async (projectId: string, skillId: string, updates: { title?: string; description?: string }) => {
    try {
      await fetch(`/api/skills/${skillId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      setProjects(prev => prev.map(project => {
        if (project.id !== projectId) return project;
        return {
          ...project,
          skills: project.skills.map(skill => 
            skill.id === skillId ? { ...skill, ...updates } : skill
          )
        };
      }));
    } catch (error) {
      console.error("Error updating project skill:", error);
    }
  };

  const moveProjectSkill = async (projectId: string, skillId: string, direction: "up" | "down") => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const skill = project.skills.find(s => s.id === skillId);
    if (!skill) return;

    const sameLevelSkills = [...project.skills]
      .filter(s => s.level === skill.level)
      .sort((a, b) => a.y - b.y);
    
    const currentIndex = sameLevelSkills.findIndex(s => s.id === skillId);
    
    let neighborIndex: number;
    if (direction === "up") {
      neighborIndex = currentIndex - 1;
    } else {
      neighborIndex = currentIndex + 1;
    }

    if (neighborIndex < 0 || neighborIndex >= sameLevelSkills.length) return;

    const neighbor = sameLevelSkills[neighborIndex];
    const currentY = skill.y;
    const neighborY = neighbor.y;

    const isCurrentFinal = skill.isFinalNode === 1;
    const isNeighborFinal = neighbor.isFinalNode === 1;

    let swapFinalNode = false;
    if (isCurrentFinal || isNeighborFinal) {
      swapFinalNode = true;
    }

    const currentDeps = skill.dependencies;
    const neighborDeps = neighbor.dependencies;

    try {
      const updates: Promise<Response>[] = [
        fetch(`/api/skills/${skillId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            y: neighborY,
            dependencies: neighborDeps,
            ...(swapFinalNode && isCurrentFinal ? { isFinalNode: 0 } : {}),
            ...(swapFinalNode && isNeighborFinal ? { isFinalNode: 1 } : {})
          }),
        }),
        fetch(`/api/skills/${neighbor.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            y: currentY,
            dependencies: currentDeps,
            ...(swapFinalNode && isNeighborFinal ? { isFinalNode: 0 } : {}),
            ...(swapFinalNode && isCurrentFinal ? { isFinalNode: 1 } : {})
          }),
        })
      ];

      await Promise.all(updates);

      setProjects(prev => prev.map(project => {
        if (project.id !== projectId) return project;
        return {
          ...project,
          skills: project.skills.map(s => {
            if (s.id === skillId) {
              return { 
                ...s, 
                y: neighborY,
                dependencies: neighborDeps,
                ...(swapFinalNode && isCurrentFinal ? { isFinalNode: 0 } : {}),
                ...(swapFinalNode && isNeighborFinal ? { isFinalNode: 1 } : {})
              };
            }
            if (s.id === neighbor.id) {
              return { 
                ...s, 
                y: currentY,
                dependencies: currentDeps,
                ...(swapFinalNode && isNeighborFinal ? { isFinalNode: 0 } : {}),
                ...(swapFinalNode && isCurrentFinal ? { isFinalNode: 1 } : {})
              };
            }
            return s;
          })
        };
      }));
    } catch (error) {
      console.error("Error moving project skill:", error);
    }
  };

  const createArea = async (name: string, description: string, icon: string) => {
    try {
      const id = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      const response = await fetch("/api/areas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          name,
          icon,
          color: "text-zinc-800 dark:text-zinc-200",
          description,
          unlockedLevel: 1,
          nextLevelToAssign: 1
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to create area");
      }
      
      const newArea = await response.json();
      
      const generateResponse = await fetch(`/api/areas/${newArea.id}/generate-level`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: 1 }),
      });
      
      if (generateResponse.ok) {
        const { createdSkills } = await generateResponse.json();
        setAreas(prev => [...prev, { ...newArea, skills: createdSkills }]);
      } else {
        setAreas(prev => [...prev, { ...newArea, skills: [] }]);
      }
      
      setActiveAreaId(newArea.id);
    } catch (error) {
      console.error("Error creating area:", error);
    }
  };

  const deleteArea = async (areaId: string) => {
    try {
      const response = await fetch(`/api/areas/${areaId}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        throw new Error("Failed to delete area");
      }
      
      setAreas(prev => {
        const filtered = prev.filter(a => a.id !== areaId);
        if (activeAreaId === areaId && filtered.length > 0) {
          setActiveAreaId(filtered[0].id);
        }
        return filtered;
      });
    } catch (error) {
      console.error("Error deleting area:", error);
    }
  };

  const createProject = async (name: string, description: string, icon: string) => {
    try {
      const id = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') + '_' + Date.now();
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          name,
          icon,
          description,
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to create project");
      }
      
      const newProject = await response.json();
      
      const generateResponse = await fetch(`/api/projects/${newProject.id}/generate-level`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: 1 }),
      });
      
      if (generateResponse.ok) {
        const { createdSkills } = await generateResponse.json();
        setProjects(prev => [...prev, { ...newProject, skills: createdSkills }]);
      } else {
        setProjects(prev => [...prev, { ...newProject, skills: [] }]);
      }
      
      handleSetActiveProjectId(newProject.id);
    } catch (error) {
      console.error("Error creating project:", error);
    }
  };

  const deleteProject = async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        throw new Error("Failed to delete project");
      }
      
      setProjects(prev => prev.filter(p => p.id !== projectId));
    } catch (error) {
      console.error("Error deleting project:", error);
    }
  };

  const enterSubSkillTree = async (skillId: string, skillTitle: string) => {
    try {
      const response = await fetch(`/api/skills/${skillId}/subskills`);
      let skills = await response.json();
      
      if (skills.length === 0) {
        const generateResponse = await fetch(`/api/skills/${skillId}/subskills/generate-level`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ level: 1 }),
        });
        
        if (generateResponse.ok) {
          const { createdSkills } = await generateResponse.json();
          skills = createdSkills;
        }
      }
      
      setParentSkillStack(prev => [...prev, { id: skillId, title: skillTitle }]);
      setActiveParentSkillId(skillId);
      setSubSkills(skills);
    } catch (error) {
      console.error("Error entering sub-skill tree:", error);
    }
  };

  const exitSubSkillTree = () => {
    if (parentSkillStack.length <= 1) {
      setActiveParentSkillId(null);
      setParentSkillStack([]);
      setSubSkills([]);
    } else {
      const newStack = parentSkillStack.slice(0, -1);
      const previousParent = newStack[newStack.length - 1];
      setParentSkillStack(newStack);
      setActiveParentSkillId(previousParent.id);
      fetch(`/api/skills/${previousParent.id}/subskills`)
        .then(res => res.json())
        .then(skills => setSubSkills(skills))
        .catch(err => console.error("Error loading parent sub-skills:", err));
    }
  };

  const toggleSubSkillStatus = async (skillId: string) => {
    const skill = subSkills.find(s => s.id === skillId);
    if (!skill) return;

    // Check if this is a final node - can only be confirmed if all other nodes in level are mastered
    const skillsInLevel = subSkills.filter(s => s.level === skill.level);
    if (skill.isFinalNode === 1 && skill.status !== "mastered") {
      const otherNodesInLevel = skillsInLevel.filter(s => s.id !== skill.id);
      const allOthersMastered = otherNodesInLevel.every(s => s.status === "mastered");
      if (!allOthersMastered) {
        return;
      }
    }

    const nextStatus: Record<SkillStatus, SkillStatus> = {
      "locked": "locked",
      "available": "mastered",
      "mastered": "available"
    };

    const newStatus = nextStatus[skill.status];
    const isFinalNodeBeingMastered = skill.isFinalNode === 1 && newStatus === "mastered";

    try {
      await fetch(`/api/skills/${skillId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (isFinalNodeBeingMastered && activeParentSkillId) {
        const newLevel = skill.level + 1;
        const generateResponse = await fetch(`/api/skills/${activeParentSkillId}/subskills/generate-level`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ level: newLevel }),
        });

        if (generateResponse.ok) {
          const { createdSkills } = await generateResponse.json();
          setSubSkills(prev => {
            const existingIds = new Set(prev.map(s => s.id));
            const newSkills = createdSkills.filter((s: Skill) => !existingIds.has(s.id));
            return [
              ...prev.map(s => s.id === skillId ? { ...s, status: newStatus } : s),
              ...newSkills
            ];
          });
          return;
        }
      }

      setSubSkills(prev => prev.map(s => 
        s.id === skillId ? { ...s, status: newStatus } : s
      ));
    } catch (error) {
      console.error("Error toggling sub-skill status:", error);
    }
  };

  const updateSubSkill = async (skillId: string, updates: { title?: string; description?: string }) => {
    try {
      await fetch(`/api/skills/${skillId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      setSubSkills(prev => prev.map(s => 
        s.id === skillId ? { ...s, ...updates } : s
      ));
    } catch (error) {
      console.error("Error updating sub-skill:", error);
    }
  };

  const deleteSubSkill = async (skillId: string) => {
    const skillToDelete = subSkills.find(s => s.id === skillId);
    if (!skillToDelete) return;

    const children = subSkills.filter(s => s.dependencies.includes(skillId));
    const newDependencies = skillToDelete.dependencies;

    const wasIsFinalNode = skillToDelete.isFinalNode === 1;
    let newFinalNodeId: string | null = null;
    
    if (wasIsFinalNode) {
      const sameLevelSkills = subSkills
        .filter(s => s.level === skillToDelete.level && s.id !== skillId)
        .sort((a, b) => a.y - b.y);
      if (sameLevelSkills.length > 0) {
        newFinalNodeId = sameLevelSkills[sameLevelSkills.length - 1].id;
      }
    }

    try {
      await fetch(`/api/skills/${skillId}`, { method: "DELETE" });

      for (const child of children) {
        const updatedDeps = child.dependencies
          .filter(d => d !== skillId)
          .concat(newDependencies);
        
        await fetch(`/api/skills/${child.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dependencies: updatedDeps }),
        });
      }

      const nodesToShift = subSkills.filter(s => s.y > skillToDelete.y);
      for (const node of nodesToShift) {
        await fetch(`/api/skills/${node.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ y: node.y - 150 }),
        });
      }

      if (newFinalNodeId) {
        await fetch(`/api/skills/${newFinalNodeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isFinalNode: 1 }),
        });
      }

      setSubSkills(prev => {
        return prev
          .filter(s => s.id !== skillId)
          .map(s => {
            let updated = { ...s };
            
            if (children.find(c => c.id === s.id)) {
              updated.dependencies = s.dependencies
                .filter(d => d !== skillId)
                .concat(newDependencies);
            }
            
            if (s.y > skillToDelete.y) {
              updated.y = s.y - 150;
            }

            if (s.id === newFinalNodeId) {
              updated.isFinalNode = 1;
            }
            
            return updated;
          });
      });
    } catch (error) {
      console.error("Error deleting sub-skill:", error);
    }
  };

  const toggleSubSkillLock = async (skillId: string) => {
    const skill = subSkills.find(s => s.id === skillId);
    if (!skill) return;

    const isLocked = skill.status === "locked";
    const newStatus = isLocked ? "available" : "locked";
    const newManualLock = isLocked ? 0 : 1;

    try {
      await fetch(`/api/skills/${skillId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          status: newStatus,
          manualLock: newManualLock
        }),
      });

      setSubSkills(prev => prev.map(s => 
        s.id === skillId 
          ? { ...s, status: newStatus, manualLock: newManualLock } 
          : s
      ));
    } catch (error) {
      console.error("Error toggling sub-skill lock:", error);
    }
  };

  const moveSubSkill = async (skillId: string, direction: "up" | "down") => {
    const skill = subSkills.find(s => s.id === skillId);
    if (!skill) return;

    const sameLevelSkills = [...subSkills]
      .filter(s => s.level === skill.level)
      .sort((a, b) => a.y - b.y);
    
    const currentIndex = sameLevelSkills.findIndex(s => s.id === skillId);
    
    let neighborIndex: number;
    if (direction === "up") {
      neighborIndex = currentIndex - 1;
    } else {
      neighborIndex = currentIndex + 1;
    }

    if (neighborIndex < 0 || neighborIndex >= sameLevelSkills.length) return;

    const neighbor = sameLevelSkills[neighborIndex];
    const currentY = skill.y;
    const neighborY = neighbor.y;

    const isCurrentFinal = skill.isFinalNode === 1;
    const isNeighborFinal = neighbor.isFinalNode === 1;

    let swapFinalNode = false;
    if (isCurrentFinal || isNeighborFinal) {
      swapFinalNode = true;
    }

    const currentDeps = skill.dependencies;
    const neighborDeps = neighbor.dependencies;

    try {
      await Promise.all([
        fetch(`/api/skills/${skillId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            y: neighborY,
            dependencies: neighborDeps,
            ...(swapFinalNode && isCurrentFinal ? { isFinalNode: 0 } : {}),
            ...(swapFinalNode && isNeighborFinal ? { isFinalNode: 1 } : {})
          }),
        }),
        fetch(`/api/skills/${neighbor.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            y: currentY,
            dependencies: currentDeps,
            ...(swapFinalNode && isNeighborFinal ? { isFinalNode: 0 } : {}),
            ...(swapFinalNode && isCurrentFinal ? { isFinalNode: 1 } : {})
          }),
        })
      ]);

      setSubSkills(prev => prev.map(s => {
        if (s.id === skillId) {
          return { 
            ...s, 
            y: neighborY,
            dependencies: neighborDeps,
            ...(swapFinalNode && isCurrentFinal ? { isFinalNode: 0 } : {}),
            ...(swapFinalNode && isNeighborFinal ? { isFinalNode: 1 } : {})
          };
        }
        if (s.id === neighbor.id) {
          return { 
            ...s, 
            y: currentY,
            dependencies: currentDeps,
            ...(swapFinalNode && isNeighborFinal ? { isFinalNode: 0 } : {}),
            ...(swapFinalNode && isCurrentFinal ? { isFinalNode: 1 } : {})
          };
        }
        return s;
      }));
    } catch (error) {
      console.error("Error moving sub-skill:", error);
    }
  };

  const addSkillBelow = async (areaId: string, skillId: string) => {
    const area = areas.find(a => a.id === areaId);
    if (!area) return;

    const clickedSkill = area.skills.find(s => s.id === skillId);
    if (!clickedSkill) return;

    const sameLevelSkills = area.skills
      .filter(s => s.level === clickedSkill.level)
      .sort((a, b) => a.y - b.y);

    const finalNode = sameLevelSkills.find(s => s.isFinalNode === 1);
    const newY = clickedSkill.y + 150;

    try {
      const nodesToShift = area.skills.filter(s => s.y > clickedSkill.y);
      for (const node of nodesToShift) {
        const newNodeY = node.y + 150;
        const newLevelPosition = (node.levelPosition || 0) + 1;
        await fetch(`/api/skills/${node.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ y: newNodeY, levelPosition: newLevelPosition }),
        });
      }

      const newSkillData = {
        areaId,
        title: "?",
        description: "",
        x: clickedSkill.x,
        y: newY,
        status: "locked" as SkillStatus,
        dependencies: [clickedSkill.id],
        level: clickedSkill.level,
        levelPosition: (clickedSkill.levelPosition || 0) + 1,
        isFinalNode: 0,
        manualLock: 0,
      };

      const response = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSkillData),
      });
      const newSkill = await response.json();

      if (finalNode && finalNode.dependencies.includes(clickedSkill.id)) {
        const updatedDeps = finalNode.dependencies.map(d => d === clickedSkill.id ? newSkill.id : d);
        await fetch(`/api/skills/${finalNode.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dependencies: updatedDeps }),
        });
      }

      setAreas(prev => prev.map(a => {
        if (a.id !== areaId) return a;
        return {
          ...a,
          skills: [
            ...a.skills.map(s => {
              let updated = { ...s };
              if (s.y > clickedSkill.y) {
                updated = { ...updated, y: s.y + 150, levelPosition: (s.levelPosition || 0) + 1 };
              }
              if (finalNode && s.id === finalNode.id && finalNode.dependencies.includes(clickedSkill.id)) {
                const updatedDeps = s.dependencies.map(d => d === clickedSkill.id ? newSkill.id : d);
                updated = { ...updated, dependencies: updatedDeps };
              }
              return updated;
            }),
            newSkill
          ]
        };
      }));
    } catch (error) {
      console.error("Error adding skill below:", error);
    }
  };

  const addProjectSkillBelow = async (projectId: string, skillId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const clickedSkill = project.skills.find(s => s.id === skillId);
    if (!clickedSkill) return;

    const sameLevelSkills = project.skills
      .filter(s => s.level === clickedSkill.level)
      .sort((a, b) => a.y - b.y);

    const finalNode = sameLevelSkills.find(s => s.isFinalNode === 1);
    const newY = clickedSkill.y + 150;

    try {
      const nodesToShift = project.skills.filter(s => s.y > clickedSkill.y);
      for (const node of nodesToShift) {
        const newNodeY = node.y + 150;
        const newLevelPosition = (node.levelPosition || 0) + 1;
        await fetch(`/api/skills/${node.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ y: newNodeY, levelPosition: newLevelPosition }),
        });
      }

      const newSkillData = {
        projectId,
        title: "?",
        description: "",
        x: clickedSkill.x,
        y: newY,
        status: "locked" as SkillStatus,
        dependencies: [clickedSkill.id],
        level: clickedSkill.level,
        levelPosition: (clickedSkill.levelPosition || 0) + 1,
        isFinalNode: 0,
        manualLock: 0,
      };

      const response = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSkillData),
      });
      const newSkill = await response.json();

      if (finalNode && finalNode.dependencies.includes(clickedSkill.id)) {
        const updatedDeps = finalNode.dependencies.map(d => d === clickedSkill.id ? newSkill.id : d);
        await fetch(`/api/skills/${finalNode.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dependencies: updatedDeps }),
        });
      }

      setProjects(prev => prev.map(p => {
        if (p.id !== projectId) return p;
        return {
          ...p,
          skills: [
            ...p.skills.map(s => {
              let updated = { ...s };
              if (s.y > clickedSkill.y) {
                updated = { ...updated, y: s.y + 150, levelPosition: (s.levelPosition || 0) + 1 };
              }
              if (finalNode && s.id === finalNode.id && finalNode.dependencies.includes(clickedSkill.id)) {
                const updatedDeps = s.dependencies.map(d => d === clickedSkill.id ? newSkill.id : d);
                updated = { ...updated, dependencies: updatedDeps };
              }
              return updated;
            }),
            newSkill
          ]
        };
      }));
    } catch (error) {
      console.error("Error adding project skill below:", error);
    }
  };

  const addSubSkillBelow = async (skillId: string) => {
    const clickedSkill = subSkills.find(s => s.id === skillId);
    if (!clickedSkill || !activeParentSkillId) return;

    const sameLevelSkills = subSkills
      .filter(s => s.level === clickedSkill.level)
      .sort((a, b) => a.y - b.y);

    const finalNode = sameLevelSkills.find(s => s.isFinalNode === 1);
    const newY = clickedSkill.y + 150;

    try {
      const nodesToShift = subSkills.filter(s => s.y > clickedSkill.y);
      for (const node of nodesToShift) {
        const newNodeY = node.y + 150;
        const newLevelPosition = (node.levelPosition || 0) + 1;
        await fetch(`/api/skills/${node.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ y: newNodeY, levelPosition: newLevelPosition }),
        });
      }

      const newSkillData = {
        parentSkillId: activeParentSkillId,
        title: "?",
        description: "",
        x: clickedSkill.x,
        y: newY,
        status: "locked" as SkillStatus,
        dependencies: [clickedSkill.id],
        level: clickedSkill.level,
        levelPosition: (clickedSkill.levelPosition || 0) + 1,
        isFinalNode: 0,
        manualLock: 0,
      };

      const response = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSkillData),
      });
      const newSkill = await response.json();

      if (finalNode && finalNode.dependencies.includes(clickedSkill.id)) {
        const updatedDeps = finalNode.dependencies.map(d => d === clickedSkill.id ? newSkill.id : d);
        await fetch(`/api/skills/${finalNode.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dependencies: updatedDeps }),
        });
      }

      setSubSkills(prev => [
        ...prev.map(s => {
          let updated = { ...s };
          if (s.y > clickedSkill.y) {
            updated = { ...updated, y: s.y + 150, levelPosition: (s.levelPosition || 0) + 1 };
          }
          if (finalNode && s.id === finalNode.id && finalNode.dependencies.includes(clickedSkill.id)) {
            const updatedDeps = s.dependencies.map(d => d === clickedSkill.id ? newSkill.id : d);
            updated = { ...updated, dependencies: updatedDeps };
          }
          return updated;
        }),
        newSkill
      ]);
    } catch (error) {
      console.error("Error adding sub-skill below:", error);
    }
  };

  // Auto-unlock logic for areas
  useEffect(() => {
    if (isLoading || areas.length === 0) return;

    const updatesToMake: Array<{ skillId: string; newStatus: SkillStatus }> = [];

    areas.forEach(area => {
      area.skills.forEach(skill => {
        if (skill.status !== "locked") return;
        if (skill.manualLock) return;
        if (skill.level > area.unlockedLevel) return;

        const dependencies = skill.dependencies.map(depId => 
          area.skills.find(s => s.id === depId)
        );
        
        const allDepsMastered = dependencies.length === 0 || 
          dependencies.every(dep => dep && dep.status === "mastered");
        
        if (allDepsMastered) {
          updatesToMake.push({ skillId: skill.id, newStatus: "available" });
        }
      });
    });

    if (updatesToMake.length > 0) {
      Promise.all(
        updatesToMake.map(({ skillId, newStatus }) =>
          fetch(`/api/skills/${skillId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: newStatus }),
          })
        )
      ).then(() => {
        setAreas(prev => prev.map(area => ({
          ...area,
          skills: area.skills.map(skill => {
            const update = updatesToMake.find(u => u.skillId === skill.id);
            return update ? { ...skill, status: update.newStatus } : skill;
          })
        })));
      });
    }
  }, [areas, isLoading]);

  // Auto-unlock logic for projects
  useEffect(() => {
    if (isLoading || projects.length === 0) return;

    const updatesToMake: Array<{ skillId: string; newStatus: SkillStatus }> = [];

    projects.forEach(project => {
      project.skills.forEach(skill => {
        if (skill.status !== "locked") return;
        if (skill.manualLock) return;
        if (skill.level > project.unlockedLevel) return;

        const dependencies = skill.dependencies.map(depId => 
          project.skills.find(s => s.id === depId)
        );
        
        const allDepsMastered = dependencies.length === 0 || 
          dependencies.every(dep => dep && dep.status === "mastered");
        
        if (allDepsMastered) {
          updatesToMake.push({ skillId: skill.id, newStatus: "available" });
        }
      });
    });

    if (updatesToMake.length > 0) {
      Promise.all(
        updatesToMake.map(({ skillId, newStatus }) =>
          fetch(`/api/skills/${skillId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: newStatus }),
          })
        )
      ).then(() => {
        setProjects(prev => prev.map(project => ({
          ...project,
          skills: project.skills.map(skill => {
            const update = updatesToMake.find(u => u.skillId === skill.id);
            return update ? { ...skill, status: update.newStatus } : skill;
          })
        })));
      });
    }
  }, [projects, isLoading]);

  const updateLevelSubtitle = async (areaId: string, level: number, subtitle: string) => {
    const area = areas.find(a => a.id === areaId);
    if (!area) return;

    const updatedSubtitles = { ...area.levelSubtitles, [level.toString()]: subtitle };
    
    try {
      await fetch(`/api/areas/${areaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ levelSubtitles: updatedSubtitles }),
      });

      setAreas(prev => prev.map(a => 
        a.id === areaId ? { ...a, levelSubtitles: updatedSubtitles } : a
      ));
    } catch (error) {
      console.error("Error updating level subtitle:", error);
    }
  };

  const updateProjectLevelSubtitle = async (projectId: string, level: number, subtitle: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const updatedSubtitles = { ...project.levelSubtitles, [level.toString()]: subtitle };
    
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ levelSubtitles: updatedSubtitles }),
      });

      setProjects(prev => prev.map(p => 
        p.id === projectId ? { ...p, levelSubtitles: updatedSubtitles } : p
      ));
    } catch (error) {
      console.error("Error updating project level subtitle:", error);
    }
  };

  const toggleFinalNode = async (areaId: string, skillId: string) => {
    const area = areas.find(a => a.id === areaId);
    if (!area) return;

    const skill = area.skills.find(s => s.id === skillId);
    if (!skill) return;

    const isCurrentlyFinal = skill.isFinalNode === 1;

    try {
      if (isCurrentlyFinal) {
        await fetch(`/api/skills/${skillId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isFinalNode: 0 }),
        });

        setAreas(prev => prev.map(a => 
          a.id === areaId ? {
            ...a,
            skills: a.skills.map(s => 
              s.id === skillId ? { ...s, isFinalNode: 0 } : s
            )
          } : a
        ));
      } else {
        const otherFinalNodes = area.skills.filter(s => s.isFinalNode === 1 && s.id !== skillId);
        
        await Promise.all([
          ...otherFinalNodes.map(s => 
            fetch(`/api/skills/${s.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ isFinalNode: 0 }),
            })
          ),
          fetch(`/api/skills/${skillId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isFinalNode: 1 }),
          })
        ]);

        setAreas(prev => prev.map(a => 
          a.id === areaId ? {
            ...a,
            skills: a.skills.map(s => ({
              ...s,
              isFinalNode: s.id === skillId ? 1 : 0
            }))
          } : a
        ));
      }
    } catch (error) {
      console.error("Error toggling final node:", error);
    }
  };

  const toggleProjectFinalNode = async (projectId: string, skillId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const skill = project.skills.find(s => s.id === skillId);
    if (!skill) return;

    const isCurrentlyFinal = skill.isFinalNode === 1;

    try {
      if (isCurrentlyFinal) {
        await fetch(`/api/skills/${skillId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isFinalNode: 0 }),
        });

        setProjects(prev => prev.map(p => 
          p.id === projectId ? {
            ...p,
            skills: p.skills.map(s => 
              s.id === skillId ? { ...s, isFinalNode: 0 } : s
            )
          } : p
        ));
      } else {
        const otherFinalNodes = project.skills.filter(s => s.isFinalNode === 1 && s.id !== skillId);
        
        await Promise.all([
          ...otherFinalNodes.map(s => 
            fetch(`/api/skills/${s.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ isFinalNode: 0 }),
            })
          ),
          fetch(`/api/skills/${skillId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isFinalNode: 1 }),
          })
        ]);

        setProjects(prev => prev.map(p => 
          p.id === projectId ? {
            ...p,
            skills: p.skills.map(s => ({
              ...s,
              isFinalNode: s.id === skillId ? 1 : 0
            }))
          } : p
        ));
      }
    } catch (error) {
      console.error("Error toggling project final node:", error);
    }
  };

  const toggleSubSkillFinalNode = async (skillId: string) => {
    const skill = subSkills.find(s => s.id === skillId);
    if (!skill) return;

    const isCurrentlyFinal = skill.isFinalNode === 1;

    try {
      if (isCurrentlyFinal) {
        await fetch(`/api/skills/${skillId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isFinalNode: 0 }),
        });

        setSubSkills(prev => prev.map(s => 
          s.id === skillId ? { ...s, isFinalNode: 0 } : s
        ));
      } else {
        const otherFinalNodes = subSkills.filter(s => s.isFinalNode === 1 && s.id !== skillId);
        
        await Promise.all([
          ...otherFinalNodes.map(s => 
            fetch(`/api/skills/${s.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ isFinalNode: 0 }),
            })
          ),
          fetch(`/api/skills/${skillId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isFinalNode: 1 }),
          })
        ]);

        setSubSkills(prev => prev.map(s => ({
          ...s,
          isFinalNode: s.id === skillId ? 1 : 0
        })));
      }
    } catch (error) {
      console.error("Error toggling sub-skill final node:", error);
    }
  };

  return (
    <SkillTreeContext.Provider value={{ 
      areas, 
      activeAreaId, 
      setActiveAreaId: handleSetActiveAreaId, 
      toggleSkillStatus,
      toggleProjectSkillStatus,
      addSkill,
      updateSkill,
      deleteSkill,
      toggleLock,
      moveSkill,
      updateProjectSkill,
      deleteProjectSkill,
      toggleProjectLock,
      moveProjectSkill,
      createArea,
      deleteArea,
      activeArea,
      isLoading,
      projects,
      activeProjectId,
      setActiveProjectId: handleSetActiveProjectId,
      activeProject,
      createProject,
      deleteProject,
      activeParentSkillId,
      parentSkillStack,
      subSkills,
      enterSubSkillTree,
      exitSubSkillTree,
      toggleSubSkillStatus,
      updateSubSkill,
      deleteSubSkill,
      toggleSubSkillLock,
      moveSubSkill,
      addSkillBelow,
      addProjectSkillBelow,
      addSubSkillBelow,
      updateLevelSubtitle,
      updateProjectLevelSubtitle,
      toggleFinalNode,
      toggleProjectFinalNode,
      toggleSubSkillFinalNode,
      showLevelUp
    }}>
      {children}
    </SkillTreeContext.Provider>
  );
}

export function useSkillTree() {
  const context = useContext(SkillTreeContext);
  if (!context) throw new Error("useSkillTree must be used within SkillTreeProvider");
  return context;
}

export { iconMap };
