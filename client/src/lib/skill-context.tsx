import { createContext, useContext, useState, useEffect } from "react";
import { Music, Trophy, BookOpen, Home } from "lucide-react";

export type SkillStatus = "locked" | "available" | "mastered";

export interface Skill {
  id: string;
  areaId: string;
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
  skills: Skill[];
}

interface SkillTreeContextType {
  areas: Area[];
  activeAreaId: string;
  setActiveAreaId: (id: string) => void;
  toggleSkillStatus: (areaId: string, skillId: string) => void;
  addSkill: (areaId: string, skill: Omit<Skill, "id">) => void;
  updateSkill: (areaId: string, skillId: string, updates: { title?: string; description?: string }) => void;
  deleteSkill: (areaId: string, skillId: string) => void;
  toggleLock: (areaId: string, skillId: string) => void;
  moveSkill: (areaId: string, skillId: string, direction: "up" | "down") => void;
  activeArea: Area | undefined;
  isLoading: boolean;
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
  const [activeAreaId, setActiveAreaId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  const activeArea = areas.find(a => a.id === activeAreaId);

  // Load areas from API
  useEffect(() => {
    async function loadAreas() {
      try {
        const response = await fetch("/api/areas");
        const data = await response.json();
        setAreas(data);
        if (data.length > 0 && !activeAreaId) {
          setActiveAreaId(data[0].id);
        }
      } catch (error) {
        console.error("Error loading areas:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadAreas();
  }, []);

  const toggleSkillStatus = async (areaId: string, skillId: string) => {
    const area = areas.find(a => a.id === areaId);
    if (!area) return;
    
    const skill = area.skills.find(s => s.id === skillId);
    if (!skill) return;

    const nextStatus: Record<SkillStatus, SkillStatus> = {
      "locked": "locked",
      "available": "mastered",
      "mastered": "available"
    };

    const newStatus = nextStatus[skill.status];
    const isFinalNodeBeingMastered = skill.isFinalNode === 1 && newStatus === "mastered";
    const isFinalNodeBeingUnmastered = skill.isFinalNode === 1 && skill.status === "mastered" && newStatus === "available";

    try {
      await fetch(`/api/skills/${skillId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (isFinalNodeBeingMastered) {
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
      } else if (isFinalNodeBeingUnmastered) {
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

    const sortedSkills = [...area.skills].sort((a, b) => a.y - b.y);
    const currentIndex = sortedSkills.findIndex(s => s.id === skillId);
    
    let neighborIndex: number;
    if (direction === "up") {
      neighborIndex = currentIndex - 1;
    } else {
      neighborIndex = currentIndex + 1;
    }

    if (neighborIndex < 0 || neighborIndex >= sortedSkills.length) return;

    const neighbor = sortedSkills[neighborIndex];
    const currentY = skill.y;
    const neighborY = neighbor.y;

    const sameLevelSkills = sortedSkills.filter(s => s.level === skill.level);
    const lastSameLevelSkill = sameLevelSkills[sameLevelSkills.length - 1];
    const isCurrentFinal = skill.isFinalNode === 1;
    const isNeighborFinal = neighbor.isFinalNode === 1;
    const sameLevel = skill.level === neighbor.level;

    let swapFinalNode = false;
    if (sameLevel && (isCurrentFinal || isNeighborFinal)) {
      swapFinalNode = true;
    }

    try {
      const updates: Promise<Response>[] = [
        fetch(`/api/skills/${skillId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            y: neighborY,
            ...(swapFinalNode && isCurrentFinal ? { isFinalNode: 0 } : {}),
            ...(swapFinalNode && isNeighborFinal ? { isFinalNode: 1 } : {})
          }),
        }),
        fetch(`/api/skills/${neighbor.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            y: currentY,
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
                ...(swapFinalNode && isCurrentFinal ? { isFinalNode: 0 } : {}),
                ...(swapFinalNode && isNeighborFinal ? { isFinalNode: 1 } : {})
              };
            }
            if (s.id === neighbor.id) {
              return { 
                ...s, 
                y: currentY,
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

  // Auto-unlock logic
  useEffect(() => {
    if (isLoading || areas.length === 0) return;

    const updatesToMake: Array<{ skillId: string; newStatus: SkillStatus }> = [];

    areas.forEach(area => {
      area.skills.forEach(skill => {
        if (skill.status !== "locked") return;
        if (skill.manualLock) return;
        if (skill.level > area.unlockedLevel) return;

        // For the first node of a level (levelPosition = 1), it becomes available when:
        // - The level is unlocked AND
        // - All dependencies are mastered (or no dependencies)
        // For nodes 2-5, they also need their dependencies mastered
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

  return (
    <SkillTreeContext.Provider value={{ 
      areas, 
      activeAreaId, 
      setActiveAreaId, 
      toggleSkillStatus, 
      addSkill,
      updateSkill,
      deleteSkill,
      toggleLock,
      moveSkill,
      activeArea,
      isLoading
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
