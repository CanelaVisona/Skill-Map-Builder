import { createContext, useContext, useState, useEffect } from "react";
import { Area, INITIAL_AREAS, Skill, SkillStatus } from "../data/skills";

interface SkillTreeContextType {
  areas: Area[];
  activeAreaId: string;
  setActiveAreaId: (id: string) => void;
  toggleSkillStatus: (areaId: string, skillId: string) => void;
  addSkill: (areaId: string, skill: Omit<Skill, "id" | "status">) => void;
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
            "locked": "locked", // Can't toggle locked manually usually, but for prototype maybe?
            "available": "mastered",
            "mastered": "available" // Allow toggle back
          };
          
          // Logic: Can only toggle if dependencies are met (which they should be if it's available/mastered)
          return { ...skill, status: nextStatus[skill.status] };
        })
      };
    }));
  };

  const addSkill = (areaId: string, newSkillData: Omit<Skill, "id" | "status">) => {
    setAreas(prev => prev.map(area => {
      if (area.id !== areaId) return area;
      
      const newSkill: Skill = {
        ...newSkillData,
        id: Math.random().toString(36).substr(2, 9),
        status: "available" // Default to available for now for simplicity
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
