import { createContext, useContext, useState, useEffect } from "react";
import { Area, INITIAL_AREAS, Skill, SkillStatus } from "../data/skills";

interface SkillTreeContextType {
  areas: Area[];
  activeAreaId: string;
  setActiveAreaId: (id: string) => void;
  toggleSkillStatus: (areaId: string, skillId: string) => void;
  addSkill: (areaId: string, skill: Omit<Skill, "id">) => void;
  deleteSkill: (areaId: string, skillId: string) => void;
  toggleLock: (areaId: string, skillId: string) => void;
  activeArea: Area | undefined;
}

const SkillTreeContext = createContext<SkillTreeContextType | undefined>(undefined);

export function SkillTreeProvider({ children }: { children: React.ReactNode }) {
  const [areas, setAreas] = useState<Area[]>(INITIAL_AREAS);
  const [activeAreaId, setActiveAreaId] = useState<string>(INITIAL_AREAS[0].id);

  const activeArea = areas.find(a => a.id === activeAreaId);

  const toggleSkillStatus = (areaId: string, skillId: string) => {
    setAreas(prev => prev.map(area => {
      if (area.id !== areaId) return area;

      return {
        ...area,
        skills: area.skills.map(skill => {
          if (skill.id !== skillId) return skill;
          
          const nextStatus: Record<SkillStatus, SkillStatus> = {
            "locked": "locked", // Can't toggle locked manually via click, must use lock toggle
            "available": "mastered",
            "mastered": "available"
          };
          
          return { ...skill, status: nextStatus[skill.status] };
        })
      };
    }));
  };

  const toggleLock = (areaId: string, skillId: string) => {
    setAreas(prev => prev.map(area => {
      if (area.id !== areaId) return area;

      return {
        ...area,
        skills: area.skills.map(skill => {
          if (skill.id !== skillId) return skill;
          
          const isLocked = skill.status === "locked";
          return { 
            ...skill, 
            status: isLocked ? "available" : "locked",
            manualLock: !isLocked // If we are locking, set manualLock to true. If unlocking, false.
          };
        })
      };
    }));
  };

  const deleteSkill = (areaId: string, skillId: string) => {
    setAreas(prev => prev.map(area => {
      if (area.id !== areaId) return area;

      const skillToDelete = area.skills.find(s => s.id === skillId);
      if (!skillToDelete) return area;

      // Find children (nodes that depend on this skill)
      const children = area.skills.filter(s => s.dependencies.includes(skillId));

      // Re-link: children should now depend on the deleted skill's dependencies
      // In a linear tree, skillToDelete usually has 0 or 1 dependency.
      const newDependencies = skillToDelete.dependencies;

      const updatedSkills = area.skills
        .filter(s => s.id !== skillId) // Remove the skill
        .map(s => {
          if (children.find(c => c.id === s.id)) {
            // This is a child, update its dependencies
            return {
              ...s,
              dependencies: s.dependencies
                .filter(d => d !== skillId) // Remove old dependency
                .concat(newDependencies) // Add new dependencies (grandparent)
                // Also shift up if needed?
                // Let's shift up by 150px to close the gap
                // Only shift if it was below the deleted node
            };
          }
          return s;
        })
        // Shift all nodes below the deleted one up by 150px
        .map(s => {
          if (s.y > skillToDelete.y) {
            return { ...s, y: s.y - 150 };
          }
          return s;
        });

      return {
        ...area,
        skills: updatedSkills
      };
    }));
  };

  const addSkill = (areaId: string, newSkillData: Omit<Skill, "id">) => {
    setAreas(prev => prev.map(area => {
      if (area.id !== areaId) return area;
      
      const newSkill: Skill = {
        ...newSkillData,
        id: Math.random().toString(36).substr(2, 9),
      };
      
      return {
        ...area,
        skills: [...area.skills, newSkill]
      };
    }));
  };

  // Auto-unlock logic
  useEffect(() => {
    setAreas(prevAreas => {
      let hasChanges = false;
      const newAreas = prevAreas.map(area => {
        const newSkills = area.skills.map(skill => {
          if (skill.status !== "locked") return skill;
          if (skill.manualLock) return skill; // Skip if manually locked

          // Check if all dependencies are mastered
          const dependencies = skill.dependencies.map(depId => 
            area.skills.find(s => s.id === depId)
          );
          
          const allDepsMastered = dependencies.every(dep => dep && dep.status === "mastered");
          
          if (allDepsMastered) {
            hasChanges = true;
            return { ...skill, status: "available" as SkillStatus };
          }
          return skill;
        });
        
        if (area.skills !== newSkills) return { ...area, skills: newSkills };
        return area;
      });

      return hasChanges ? newAreas : prevAreas;
    });
  }, [areas]); // This might cause a loop if not careful, but setAreas checks identity. 
               // Actually, creating new object references every time inside toggleSkillStatus triggers this.
               // For prototype, it's fine.

  return (
    <SkillTreeContext.Provider value={{ 
      areas, 
      activeAreaId, 
      setActiveAreaId, 
      toggleSkillStatus, 
      addSkill,
      deleteSkill,
      activeArea 
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
