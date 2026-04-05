import { createContext, useContext, useState, useEffect, useRef } from "react";
import { Music, Trophy, BookOpen, Home } from "lucide-react";

export type SkillStatus = "locked" | "available" | "mastered";

export interface Skill {
  id: string;
  areaId?: string;
  projectId?: string;
  parentSkillId?: string;
  title: string;
  description: string;
  feedback?: string;
  status: SkillStatus;
  x: number;
  y: number;
  dependencies: string[];
  manualLock?: number;
  isFinalNode?: number;
  isAutoComplete?: number;
  level: number;
  levelPosition?: number;
  experiencePoints?: number;
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
  levelSubtitleDescriptions: Record<string, string>;
  endOfAreaLevel?: number;
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
  levelSubtitleDescriptions: Record<string, string>;
  endOfAreaLevel?: number;
  skills: Skill[];
  questType?: "main" | "side" | "emergent" | "experience";
}

export interface GlobalSkill {
  id: string;
  userId: string;
  name: string;
  areaId?: string | null;
  projectId?: string | null;
  parentSkillId?: string | null;
  currentXp: number;
  level: number;
  goalXp: number;
  completed: boolean | number;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
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
  updateSkill: (areaId: string, skillId: string, updates: { title?: string; description?: string; feedback?: string; experiencePoints?: number }) => void;
  deleteSkill: (areaId: string, skillId: string) => void;
  toggleLock: (areaId: string, skillId: string) => void;
  moveSkill: (areaId: string, skillId: string, direction: "up" | "down") => void;
  moveSkillToLevel: (areaId: string, skillId: string, targetLevel: number) => Promise<void>;
  reorderSkillWithinLevel: (areaId: string, skillId: string, direction: "up" | "down") => Promise<void>;
  updateProjectSkill: (projectId: string, skillId: string, updates: { title?: string; description?: string; feedback?: string; experiencePoints?: number }) => void;
  deleteProjectSkill: (projectId: string, skillId: string) => void;
  toggleProjectLock: (projectId: string, skillId: string) => void;
  moveProjectSkill: (projectId: string, skillId: string, direction: "up" | "down") => void;
  moveProjectSkillToLevel: (projectId: string, skillId: string, targetLevel: number) => Promise<void>;
  reorderProjectSkillWithinLevel: (projectId: string, skillId: string, direction: "up" | "down") => Promise<void>;
  createArea: (name: string, description: string, icon: string) => Promise<void>;
  deleteArea: (areaId: string) => Promise<void>;
  archiveArea: (areaId: string) => Promise<void>;
  unarchiveArea: (areaId: string) => Promise<void>;
  archivedAreas: Area[];
  loadArchivedAreas: () => Promise<void>;
  activeArea: Area | undefined;
  isLoading: boolean;
  projects: Project[];
  mainQuests: Project[];
  activeProjectId: string;
  setActiveProjectId: (id: string) => void;
  activeProject: Project | undefined;
  createProject: (name: string, description: string, icon: string) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  archiveProject: (projectId: string) => Promise<void>;
  unarchiveProject: (projectId: string) => Promise<void>;
  archivedProjects: Project[];
  archivedMainQuests: Project[];
  loadArchivedProjects: () => Promise<void>;
  activeParentSkillId: string | null;
  parentSkillStack: ParentSkillInfo[];
  subSkills: Skill[];
  enterSubSkillTree: (skillId: string, skillTitle: string) => Promise<void>;
  exitSubSkillTree: () => void;
  toggleSubSkillStatus: (skillId: string) => void;
  updateSubSkill: (skillId: string, updates: { title?: string; description?: string; feedback?: string; experiencePoints?: number }) => void;
  deleteSubSkill: (skillId: string) => void;
  toggleSubSkillLock: (skillId: string) => void;
  moveSubSkill: (skillId: string, direction: "up" | "down") => void;
  deleteSubSkillTree: () => Promise<void>;
  addSkillBelow: (areaId: string, skillId: string, title?: string) => Promise<void>;
  addProjectSkillBelow: (projectId: string, skillId: string, title?: string) => Promise<void>;
  addSubSkillBelow: (skillId: string, title?: string) => Promise<void>;
  duplicateSkill: (areaId: string, skill: Skill) => Promise<void>;
  duplicateProjectSkill: (projectId: string, skill: Skill) => Promise<void>;
  duplicateSubSkill: (skill: Skill) => Promise<void>;
  updateLevelSubtitle: (areaId: string, level: number, subtitle: string, description?: string) => Promise<void>;
  updateProjectLevelSubtitle: (projectId: string, level: number, subtitle: string, description?: string) => Promise<void>;
  toggleFinalNode: (areaId: string, skillId: string) => Promise<void>;
  toggleProjectFinalNode: (projectId: string, skillId: string) => Promise<void>;
  toggleSubSkillFinalNode: (skillId: string) => Promise<void>;
  showLevelUp: boolean;
  levelUpNumber: number;
  showCompleted: boolean;
  showQuestUpdated: boolean;
  renameArea: (areaId: string, newName: string) => Promise<void>;
  renameProject: (projectId: string, newName: string) => Promise<void>;
  sideQuests: Project[];
  archivedSideQuests: Project[];
  createSideQuest: (name: string, description: string, icon: string) => Promise<void>;
  emergentQuests: Project[];
  archivedEmergentQuests: Project[];
  createEmergentQuest: (name: string, description: string, icon: string, firstNodeTitle: string, firstNodeAction: string) => Promise<void>;
  experienceQuests: Project[];
  archivedExperienceQuests: Project[];
  createExperienceQuest: (name: string, description: string, icon: string) => Promise<void>;
  // Global Skills for XP tracking
  globalSkills: GlobalSkill[];
  globalSkillsLoading: boolean;
  getGlobalSkillsForArea: (areaId: string) => GlobalSkill[];
  getGlobalSkillsForProject: (projectId: string) => GlobalSkill[];
  getSubSkillsOf: (parentSkillId: string) => GlobalSkill[];
  createGlobalSkill: (name: string, areaId?: string, projectId?: string, parentSkillId?: string) => Promise<GlobalSkill | null>;
  updateGlobalSkillName: (id: string, name: string) => Promise<GlobalSkill | null>;
  addXpToGlobalSkill: (id: string, xpAmount: number) => Promise<GlobalSkill | null>;
  deleteGlobalSkill: (id: string) => Promise<void>;
  refetchGlobalSkills: () => Promise<void>;
}

export const SkillTreeContext = createContext<SkillTreeContextType | undefined>(undefined);

const iconMap: Record<string, any> = {
  Music,
  Trophy,
  BookOpen,
  Home,
};

// Helper function to safely access dependencies as an array
function ensureDependenciesArray(deps: any): string[] {
  if (Array.isArray(deps)) return deps;
  if (typeof deps === 'string') {
    try {
      const parsed = JSON.parse(deps);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function SkillTreeProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [areas, setAreas] = useState<Area[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [archivedAreas, setArchivedAreas] = useState<Area[]>([]);
  const [archivedProjects, setArchivedProjects] = useState<Project[]>([]);
  const [activeAreaId, setActiveAreaId] = useState<string>("");
  const [activeProjectId, setActiveProjectId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [activeParentSkillId, setActiveParentSkillId] = useState<string | null>(null);
  const [parentSkillStack, setParentSkillStack] = useState<ParentSkillInfo[]>([]);
  const [subSkills, setSubSkills] = useState<Skill[]>([]);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpNumber, setLevelUpNumber] = useState(0);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showQuestUpdated, setShowQuestUpdated] = useState(false);
  const [globalSkills, setGlobalSkills] = useState<GlobalSkill[]>([]);
  const [globalSkillsLoading, setGlobalSkillsLoading] = useState(true);
  const isReordering = useRef(false);

  const triggerLevelUp = (level: number) => {
    setLevelUpNumber(level);
    setShowLevelUp(true);
    setTimeout(() => setShowLevelUp(false), 2000);
  };

  const triggerCompleted = () => {
    setShowCompleted(true);
    setTimeout(() => setShowCompleted(false), 2000);
  };

  const triggerQuestUpdated = () => {
    setShowQuestUpdated(true);
    setTimeout(() => setShowQuestUpdated(false), 2000);
  };

  const activeArea = Array.isArray(areas) ? areas.find(a => a.id === activeAreaId) : undefined;
  const activeProject = (Array.isArray(projects) ? projects.find(p => p.id === activeProjectId) : undefined) || 
                       (Array.isArray(archivedProjects) ? archivedProjects.find(p => p.id === activeProjectId) : undefined);
  
  const mainQuests = Array.isArray(projects) ? projects.filter(p => !p.questType || p.questType === "main") : [];
  const sideQuests = Array.isArray(projects) ? projects.filter(p => p.questType === "side") : [];
  const emergentQuests = Array.isArray(projects) ? projects.filter(p => p.questType === "emergent") : [];
  const experienceQuests = Array.isArray(projects) ? projects.filter(p => p.questType === "experience") : [];
  const archivedMainQuests = Array.isArray(archivedProjects) ? archivedProjects.filter(p => !p.questType || p.questType === "main") : [];
  const archivedSideQuests = Array.isArray(archivedProjects) ? archivedProjects.filter(p => p.questType === "side") : [];
  const archivedEmergentQuests = Array.isArray(archivedProjects) ? archivedProjects.filter(p => p.questType === "emergent") : [];
  const archivedExperienceQuests = Array.isArray(archivedProjects) ? archivedProjects.filter(p => p.questType === "experience") : [];

  const handleSetActiveAreaId = (id: string) => {
    setActiveAreaId(id);
    setActiveProjectId("");
  };

  const handleSetActiveProjectId = (id: string) => {
    setActiveProjectId(id);
    setActiveAreaId("");
  };

  // Auto-create 5 locked skills for each blocked level
  const ensureLockedLevelSkills = async (targetAreas: Area[], targetProjects: Project[]) => {
    console.warn('[ensureLockedLevelSkills] Starting - Areas:', targetAreas.length, 'Projects:', targetProjects.length);
    
    // Ensure areas have 3 locked levels ahead
    for (const area of targetAreas) {
      // IMPORTANT: nextLevelToAssign tracks which level number comes next to CREATE in DB
      // unlockedLevel is the highest UNLOCKED level
      // We want to maintain 3 LOCKED levels ahead
      const startLevel = Math.max(area.unlockedLevel + 1, area.nextLevelToAssign);
      const targetNextLevel = area.unlockedLevel + 3; // Last locked level = unlockedLevel + 3 (so 3 locked levels)
      const nextLevelToAssignInDb = targetNextLevel + 1; // Next number to assign after creating all locked levels
      
      console.warn(`[ensureLockedLevelSkills] Area "${area.name}" - unlockedLevel=${area.unlockedLevel}, nextLevelToAssign=${area.nextLevelToAssign}, startLevel=${startLevel}, targetNextLevel=${targetNextLevel}`);
      
      // Only create if we need more locked levels
      if (startLevel <= targetNextLevel) {
        console.warn(`[ensureLockedLevelSkills] Need to create levels ${startLevel} to ${targetNextLevel} for area "${area.name}"`);
        for (let level = startLevel; level <= targetNextLevel; level++) {
          console.warn(`[ensureLockedLevelSkills] Creating 5 skills for area "${area.name}", level ${level}`);
          
          // Find the last node from previous level for dependency
          const prevLevelSkills = area.skills.filter(s => s.level === level - 1);
          const lastNodeOfPrevLevel = prevLevelSkills.length > 0 
            ? prevLevelSkills.reduce((max, s) => s.y > max.y ? s : max)
            : null;

          // Create 5 locked placeholder nodes for this level
          for (let position = 1; position <= 5; position++) {
            const newSkill = {
              areaId: area.id,
              parentSkillId: null,
              title: "",
              description: "",
              feedback: "",
              status: "locked" as const,
              x: position * 150 - 100,
              y: position * 150,
              dependencies: position === 1 && lastNodeOfPrevLevel ? [lastNodeOfPrevLevel.id] : [],
              manualLock: 1,
              isFinalNode: 0,
              level,
              levelPosition: position,
              experiencePoints: 0
            };

            try {
              const response = await fetch("/api/skills", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newSkill)
              });

              if (response.ok) {
                const createdSkill = await response.json();
                console.warn(`[ensureLockedLevelSkills] ✓ Created skill for area "${area.name}" level ${level} position ${position}`);
                // Sync to local state
                setAreas(prev => prev.map(a => {
                  if (a.id === area.id) {
                    return { ...a, skills: [...a.skills, createdSkill] };
                  }
                  return a;
                }));
              } else {
                console.error(`[ensureLockedLevelSkills] ✗ Failed to create skill (status ${response.status})`);
              }
            } catch (error) {
              console.error(`[ensureLockedLevelSkills] Error creating skill:`, error);
            }
          }
        }
        
        // Update the area's nextLevelToAssign in the database
        try {
          const patchResult = await fetch(`/api/areas/${area.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nextLevelToAssign: nextLevelToAssignInDb })
          });
          if (patchResult.ok) {
            console.warn(`[ensureLockedLevelSkills] ✓ Updated area "${area.name}" nextLevelToAssign to ${nextLevelToAssignInDb}`);
          } else {
            console.error(`[ensureLockedLevelSkills] ✗ Failed to PATCH area (status ${patchResult.status})`);
          }
        } catch (error) {
          console.error(`[ensureLockedLevelSkills] Error PATCHING area:`, error);
        }
      } else {
        console.warn(`[ensureLockedLevelSkills] Area "${area.name}" already has enough locked levels`);
      }
      
      // REFETCH area from DB to get current skills before cleanup
      console.warn(`[ensureLockedLevelSkills] Refetching area "${area.name}" to get current skills...`);
      try {
        const areaRefetchResponse = await fetch(`/api/areas`, { credentials: "include" });
        if (areaRefetchResponse.ok) {
          const areasFromDb = await areaRefetchResponse.json();
          const refreshedArea = areasFromDb.find((a: Area) => a.id === area.id);
          if (refreshedArea) {
            console.warn(`[ensureLockedLevelSkills] Refreshed area "${area.name}": has ${refreshedArea.skills?.length || 0} skills in DB`);
            console.warn(`[ensureLockedLevelSkills] DEBUG: unlockedLevel=${area.unlockedLevel}, targetNextLevel=${targetNextLevel}`);
            
            // Debug: log all skill levels
            const allSkillLevels = ((refreshedArea.skills || []) as Skill[]).map((s) => s.level);
            console.warn(`[ensureLockedLevelSkills] DEBUG: All skill levels in area:`, allSkillLevels);
            
            // Clean up skills that are beyond targetNextLevel (remove extras) using FRESH data
            const skillsToDelete = ((refreshedArea.skills || []) as Skill[]).filter((s) => {
              const shouldDelete = s.level > targetNextLevel;
              if (shouldDelete) {
                console.warn(`[ensureLockedLevelSkills] DEBUG: Found skill to delete: id=${s.id}, level=${s.level}, type=${typeof s.level}, targetNextLevel=${targetNextLevel}, comparison=${s.level} > ${targetNextLevel}`);
              }
              return shouldDelete;
            });
            if (skillsToDelete.length > 0) {
              console.warn(`[ensureLockedLevelSkills] Deleting ${skillsToDelete.length} extra skills from area "${area.name}" beyond level ${targetNextLevel}`);
              for (const skill of skillsToDelete) {
                console.warn(`[ensureLockedLevelSkills] Attempting to delete skill: id=${skill.id}, level=${skill.level}, position=${skill.levelPosition}`);
                try {
                  const deleteResult = await fetch(`/api/skills/${skill.id}`, {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" }
                  });
                  if (deleteResult.ok) {
                    console.warn(`[ensureLockedLevelSkills] ✓ Deleted skill level ${skill.level} position ${skill.levelPosition}`);
                  } else {
                    console.error(`[ensureLockedLevelSkills] ✗ Failed to delete skill (status ${deleteResult.status})`);
                  }
                } catch (error) {
                  console.error(`[ensureLockedLevelSkills] Error deleting skill:`, error);
                }
              }
            } else {
              console.warn(`[ensureLockedLevelSkills] No skills to delete in area "${area.name}" (all skills are within proper range)`);
            }
            
            // IMPORTANT: Also fix nextLevelToAssign if it's higher than it should be
            const correctNextLevelToAssign = targetNextLevel + 1;
            if (refreshedArea.nextLevelToAssign !== correctNextLevelToAssign) {
              console.warn(`[ensureLockedLevelSkills] Correcting nextLevelToAssign: ${refreshedArea.nextLevelToAssign} -> ${correctNextLevelToAssign}`);
              try {
                const patchResult = await fetch(`/api/areas/${area.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ nextLevelToAssign: correctNextLevelToAssign })
                });
                if (patchResult.ok) {
                  console.warn(`[ensureLockedLevelSkills] ✓ Fixed nextLevelToAssign for "${area.name}"`);
                } else {
                  console.error(`[ensureLockedLevelSkills] ✗ Failed to fix nextLevelToAssign (status ${patchResult.status})`);
                }
              } catch (error) {
                console.error(`[ensureLockedLevelSkills] Error fixing nextLevelToAssign:`, error);
              }
            }
          } else {
            console.warn(`[ensureLockedLevelSkills] Could not find refreshed area data`);
          }
        }
      } catch (error) {
        console.error(`[ensureLockedLevelSkills] Error refetching area for cleanup:`, error);
      }
    }

    // Ensure projects have 3 locked levels ahead
    for (const project of targetProjects) {
      const startLevel = Math.max(project.unlockedLevel + 1, project.nextLevelToAssign);
      const targetNextLevel = project.unlockedLevel + 3; // 3 locked levels ahead
      const nextLevelToAssignInDb = targetNextLevel + 1;
      
      console.warn(`[ensureLockedLevelSkills] Project "${project.name}" - unlockedLevel=${project.unlockedLevel}, nextLevelToAssign=${project.nextLevelToAssign}, startLevel=${startLevel}, targetNextLevel=${targetNextLevel}`);
      
      if (startLevel <= targetNextLevel) {
        console.warn(`[ensureLockedLevelSkills] Need to create levels ${startLevel} to ${targetNextLevel} for project "${project.name}"`);
        for (let level = startLevel; level <= targetNextLevel; level++) {
          console.warn(`[ensureLockedLevelSkills] Creating 5 skills for project "${project.name}", level ${level}`);
          
          // Find the last node from previous level for dependency
          const prevLevelSkills = project.skills.filter(s => s.level === level - 1);
          const lastNodeOfPrevLevel = prevLevelSkills.length > 0 
            ? prevLevelSkills.reduce((max, s) => s.y > max.y ? s : max)
            : null;

          // Create 5 locked placeholder nodes for this level
          for (let position = 1; position <= 5; position++) {
            const newSkill = {
              projectId: project.id,
              parentSkillId: null,
              title: "",
              description: "",
              feedback: "",
              status: "locked" as const,
              x: position * 150 - 100,
              y: position * 150,
              dependencies: position === 1 && lastNodeOfPrevLevel ? [lastNodeOfPrevLevel.id] : [],
              manualLock: 1,
              isFinalNode: 0,
              level,
              levelPosition: position,
              experiencePoints: 0
            };

            try {
              const response = await fetch("/api/skills", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newSkill)
              });

              if (response.ok) {
                const createdSkill = await response.json();
                console.warn(`[ensureLockedLevelSkills] ✓ Created skill for project "${project.name}" level ${level} position ${position}`);
                // Sync to local state
                setProjects(prev => prev.map(p => {
                  if (p.id === project.id) {
                    return { ...p, skills: [...p.skills, createdSkill] };
                  }
                  return p;
                }));
              } else {
                console.error(`[ensureLockedLevelSkills] ✗ Failed to create skill (status ${response.status})`);
              }
            } catch (error) {
              console.error(`[ensureLockedLevelSkills] Error creating skill:`, error);
            }
          }
        }
        
        // Update the project's nextLevelToAssign in the database
        try {
          const patchResult = await fetch(`/api/projects/${project.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nextLevelToAssign: nextLevelToAssignInDb })
          });
          if (patchResult.ok) {
            console.warn(`[ensureLockedLevelSkills] ✓ Updated project "${project.name}" nextLevelToAssign to ${nextLevelToAssignInDb}`);
          } else {
            console.error(`[ensureLockedLevelSkills] ✗ Failed to PATCH project (status ${patchResult.status})`);
          }
        } catch (error) {
          console.error(`[ensureLockedLevelSkills] Error PATCHING project:`, error);
        }
      } else {
        console.warn(`[ensureLockedLevelSkills] Project "${project.name}" already has enough locked levels`);
      }
      
      // REFETCH project from DB to get current skills before cleanup
      console.warn(`[ensureLockedLevelSkills] Refetching project "${project.name}" to get current skills...`);
      try {
        const projectRefetchResponse = await fetch(`/api/projects`, { credentials: "include" });
        if (projectRefetchResponse.ok) {
          const projectsFromDb = await projectRefetchResponse.json();
          const refreshedProject = projectsFromDb.find((p: Project) => p.id === project.id);
          if (refreshedProject) {
            console.warn(`[ensureLockedLevelSkills] Refreshed project "${project.name}": has ${refreshedProject.skills?.length || 0} skills in DB`);
            console.warn(`[ensureLockedLevelSkills] DEBUG: unlockedLevel=${project.unlockedLevel}, targetNextLevel=${targetNextLevel}`);
            
            // Debug: log all skill levels
            const allSkillLevels = ((refreshedProject.skills || []) as Skill[]).map((s) => s.level);
            console.warn(`[ensureLockedLevelSkills] DEBUG: All skill levels in project:`, allSkillLevels);
            
            // Clean up skills that are beyond targetNextLevel (remove extras) using FRESH data
            const skillsToDelete = ((refreshedProject.skills || []) as Skill[]).filter((s) => {
              const shouldDelete = s.level > targetNextLevel;
              if (shouldDelete) {
                console.warn(`[ensureLockedLevelSkills] DEBUG: Found skill to delete: id=${s.id}, level=${s.level}, type=${typeof s.level}, targetNextLevel=${targetNextLevel}, comparison=${s.level} > ${targetNextLevel}`);
              }
              return shouldDelete;
            });
            if (skillsToDelete.length > 0) {
              console.warn(`[ensureLockedLevelSkills] Deleting ${skillsToDelete.length} extra skills from project "${project.name}" beyond level ${targetNextLevel}`);
              for (const skill of skillsToDelete) {
                console.warn(`[ensureLockedLevelSkills] Attempting to delete skill: id=${skill.id}, level=${skill.level}, position=${skill.levelPosition}`);
                try {
                  const deleteResult = await fetch(`/api/skills/${skill.id}`, {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" }
                  });
                  if (deleteResult.ok) {
                    console.warn(`[ensureLockedLevelSkills] ✓ Deleted skill level ${skill.level} position ${skill.levelPosition}`);
                  } else {
                    console.error(`[ensureLockedLevelSkills] ✗ Failed to delete skill (status ${deleteResult.status})`);
                  }
                } catch (error) {
                  console.error(`[ensureLockedLevelSkills] Error deleting skill:`, error);
                }
              }
            } else {
              console.warn(`[ensureLockedLevelSkills] No skills to delete in project "${project.name}" (all skills are within proper range)`);
            }
            
            // IMPORTANT: Also fix nextLevelToAssign if it's higher than it should be
            const correctNextLevelToAssign = targetNextLevel + 1;
            if (refreshedProject.nextLevelToAssign !== correctNextLevelToAssign) {
              console.warn(`[ensureLockedLevelSkills] Correcting nextLevelToAssign: ${refreshedProject.nextLevelToAssign} -> ${correctNextLevelToAssign}`);
              try {
                const patchResult = await fetch(`/api/projects/${project.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ nextLevelToAssign: correctNextLevelToAssign })
                });
                if (patchResult.ok) {
                  console.warn(`[ensureLockedLevelSkills] ✓ Fixed nextLevelToAssign for "${project.name}"`);
                } else {
                  console.error(`[ensureLockedLevelSkills] ✗ Failed to fix nextLevelToAssign (status ${patchResult.status})`);
                }
              } catch (error) {
                console.error(`[ensureLockedLevelSkills] Error fixing nextLevelToAssign:`, error);
              }
            }
          } else {
            console.warn(`[ensureLockedLevelSkills] Could not find refreshed project data`);
          }
        }
      } catch (error) {
        console.error(`[ensureLockedLevelSkills] Error refetching project for cleanup:`, error);
      }
    }
    
    console.warn('[ensureLockedLevelSkills] ✓ Complete');
  };

  // Load areas and projects from API
  useEffect(() => {
    async function loadData() {
      try {
        const [areasResponse, projectsResponse, globalSkillsResponse] = await Promise.all([
          fetch("/api/areas", { credentials: "include" }),
          fetch("/api/projects", { credentials: "include" }),
          fetch("/api/global-skills", { credentials: "include" })
        ]);
        const areasData = await areasResponse.json();
        const projectsData = await projectsResponse.json();
        const globalSkillsData = await globalSkillsResponse.json();
        
        if (Array.isArray(areasData)) {
          // Normalize all first nodes before setting state
          const normalizedAreas = areasData.map((area: Area) => ({
            ...area,
            skills: ensureFirstNodeRules(area.skills)
          }));
          setAreas(normalizedAreas);
          if (normalizedAreas.length > 0 && !activeAreaId) {
            setActiveAreaId(normalizedAreas[0].id);
          }
        } else {
          setAreas([]);
        }
        
        if (Array.isArray(projectsData)) {
          // Normalize all first nodes before setting state
          const normalizedProjects = projectsData.map((project: Project) => ({
            ...project,
            skills: ensureFirstNodeRules(project.skills)
          }));
          setProjects(normalizedProjects);
        } else {
          setProjects([]);
        }

        if (Array.isArray(globalSkillsData)) {
          setGlobalSkills(globalSkillsData);
        } else {
          setGlobalSkills([]);
        }

        // Auto-create locked level skills is DISABLED
        // Levels are now created on-demand via /api/areas/:id/generate-level endpoint
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setIsLoading(false);
        setGlobalSkillsLoading(false);
      }
    }
    loadData();
  }, []);

  /**
   * Ensure first nodes are ALWAYS mastered with empty title
   * This is applied to any skill to guarantee consistency
   */
  const ensureFirstNodeRules = (skills: Skill[]): Skill[] => {
    return skills.map(s => {
      if (s.levelPosition === 1) {
        const normalized = { ...s, status: "mastered" as SkillStatus, title: "", isAutoComplete: 1 };
        // Log for debugging
        if (s.title !== "" || s.status !== "mastered" || s.isAutoComplete !== 1) {
          console.log('[ensureFirstNodeRules] Normalized first node:', {
            level: s.level,
            before: { title: s.title, status: s.status, isAutoComplete: s.isAutoComplete },
            after: { title: normalized.title, status: normalized.status, isAutoComplete: normalized.isAutoComplete }
          });
        }
        return normalized;
      }
      return s;
    });
  };

  // Full refresh of ALL areas from server
  // Used after critical operations that generate new levels or move nodes
  const refreshAllAreas = async (): Promise<void> => {
    try {
      const response = await fetch("/api/areas", { credentials: "include" });
      if (!response.ok) return;
      const areasData = await response.json();
      if (!Array.isArray(areasData)) return;
      const normalizedAreas = areasData.map((area: Area) => ({
        ...area,
        skills: ensureFirstNodeRules(area.skills || [])
      }));
      
      // DEBUG: Log raw skills from each area
      normalizedAreas.forEach(area => {
        console.log(`[refreshAllAreas] Area "${area.name}" - ${area.skills.length} skills:`, 
          area.skills.map(s => ({
            title: s.title,
            level: s.level,
            levelPosition: s.levelPosition,
            x: s.x,
            y: s.y,
            status: s.status
          }))
        );
      });
      
      setAreas(normalizedAreas);
      console.log(`[refreshAllAreas] ✓ Refreshed ${normalizedAreas.length} areas from server`);
    } catch (error) {
      console.error("[refreshAllAreas] Error:", error);
    }
  };

  // Full refresh of ALL projects from server
  // Used after critical operations that generate new levels or move nodes
  const refreshAllProjects = async (): Promise<void> => {
    try {
      const response = await fetch("/api/projects", { credentials: "include" });
      if (!response.ok) return;
      const projectsData = await response.json();
      if (!Array.isArray(projectsData)) return;
      const normalizedProjects = projectsData.map((project: Project) => ({
        ...project,
        skills: ensureFirstNodeRules(project.skills || [])
      }));
      setProjects(normalizedProjects);
      console.log(`[refreshAllProjects] ✓ Refreshed ${normalizedProjects.length} projects from server`);
    } catch (error) {
      console.error("[refreshAllProjects] Error:", error);
    }
  };

  const toggleSkillStatus = async (areaId: string, skillId: string) => {
    console.log(`[toggleSkillStatus] CALLED - areaId: ${areaId}, skillId: ${skillId}, timestamp: ${Date.now()}`);
    
    const area = areas.find(a => a.id === areaId);
    if (!area) return;
    
    const skill = area.skills.find(s => s.id === skillId);
    if (!skill) return;

    // First node of any level is immutable - cannot be toggled
    if (skill.levelPosition === 1) {
      return;
    }

    const skillsInLevel = area.skills.filter(s => s.level === skill.level);
    const maxLevelPosition = Math.max(...skillsInLevel.map(s => s.levelPosition ?? 0));
    const isLastNodeOfLevel = skill.levelPosition === maxLevelPosition;
    
    // Check if this is a final node (has star OR is last node by position)
    // Can only be confirmed if all other nodes in level are mastered
    const isFinalNodeByPosition = isLastNodeOfLevel || skill.isFinalNode === 1;
    if (isFinalNodeByPosition && skill.status !== "mastered") {
      const otherNodesInLevel = skillsInLevel.filter(s => s.id !== skill.id);
      const allOthersMastered = otherNodesInLevel.every(s => s.status === "mastered");
      if (!allOthersMastered) {
        return;
      }
    }

    // NEW RULE: Node 1 of the active level cannot be unconfirmed
    // Node 1 is always auto-completed and is part of the active level presentation
    const isActiveLevel = skill.level === area.unlockedLevel;
    if (isActiveLevel && skill.levelPosition === 1 && skill.status === "mastered") {
      console.log(`[toggleSkillStatus] Cannot unconfirm Node 1 of active level`);
      return; // Block unconfirm of active Node 1
    }

    // Check if next node has a title (except for final nodes)
    if (skill.status === "available" && !isLastNodeOfLevel && !isFinalNodeByPosition) {
      const nodesSortedByY = skillsInLevel.sort((a, b) => a.y - b.y);
      const currentNodeIndex = nodesSortedByY.findIndex(s => s.id === skill.id);
      const nextNode = nodesSortedByY[currentNodeIndex + 1];
      
      if (nextNode) {
        const hasValidTitle = nextNode.title && 
          !nextNode.title.toLowerCase().includes("challenge") && 
          !nextNode.title.toLowerCase().includes("objective quest");
        
        if (!hasValidTitle) {
          return; // Block the action
        }
      }
    }

    const nextStatus: Record<SkillStatus, SkillStatus> = {
      "locked": "locked",
      "available": "mastered",
      "mastered": "available"
    };

    const newStatus = nextStatus[skill.status];

    // Validate unconfirm action: mastered → available
    // A mastered node can only be unconfirmed if the next node is "available" (not yet confirmed)
    if (skill.status === "mastered" && newStatus === "available") {
      console.log('[unconfirm-check] skill.level:', skill.level);
      console.log('[unconfirm-check] area.unlockedLevel:', area.unlockedLevel);
      console.log('[unconfirm-check] isFinalNodeByPosition:', isFinalNodeByPosition);
      console.log('[unconfirm-check] skill.status:', skill.status);
      console.log('[unconfirm-check] newStatus:', newStatus);
      console.log('[unconfirm-check] condition:', skill.level === area.unlockedLevel - 1);
      
      const nodesSortedByPosition = [...skillsInLevel].sort((a, b) => (a.levelPosition ?? 0) - (b.levelPosition ?? 0));
      const currentNodeIndex = nodesSortedByPosition.findIndex(s => s.id === skill.id);
      const nextNode = nodesSortedByPosition[currentNodeIndex + 1];

      // Check if the next node has been mastered (progression beyond this node)
      if (nextNode && nextNode.status === "mastered") {
        console.log(`[toggleSkillStatus] Cannot unconfirm - next node is already mastered`);
        return; // Block unconfirm - the chain has already progressed
      }

      // Special case: Allow unconfirming final node of level immediately before active level
      // This will close the active level and reset it to staged state
      const isFinalNodeOfPreviousLevel = isFinalNodeByPosition && skill.level === area.unlockedLevel - 1;

      // For non-final nodes: check that next node exists and is available
      // For final nodes: skip the next-node check (no next node in same level)
      if (!isFinalNodeByPosition && (!nextNode || (nextNode.status !== "available"))) {
        console.log(`[toggleSkillStatus] Cannot unconfirm - next node is not available`);
        return; // Block unconfirm - unexpected state
      }
    }
    
    // Determine if the star is active: only when endOfAreaLevel equals this level
    // isFinalNode: 1 is just an identifier (always on Node 5), not the control
    const isStarActive = area.endOfAreaLevel === skill.level;
    const canOpenNewLevels = isLastNodeOfLevel && !isStarActive;
    const isOpeningNewLevel = canOpenNewLevels && newStatus === "mastered";
    const isClosingLevel = canOpenNewLevels && skill.status === "mastered" && newStatus === "available";

    try {
      const response = await fetch(`/api/skills/${skillId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const updatedLevelSkills = await response.json();

      if (isStarActive && newStatus === "mastered") {
        triggerCompleted();
      } else if (newStatus === "mastered") {
        triggerQuestUpdated();
      }

      // Update skills for this level with the server response
      // This includes the auto-unlocked next node
      if (Array.isArray(updatedLevelSkills) && !isOpeningNewLevel) {
        setAreas(prev => prev.map(a => {
          if (a.id !== areaId) return a;
          return {
            ...a,
            skills: a.skills.map(s => {
              const updated = updatedLevelSkills.find(u => u.id === s.id);
              return updated || s;
            })
          };
        }));
      }

      // Handle level unlocking with atomic state update
      if (isOpeningNewLevel) {
        const newUnlockedLevel = skill.level + 1;
        
        // Trigger UI feedback immediately (no state change)
        triggerQuestUpdated();
        setTimeout(() => triggerLevelUp(newUnlockedLevel), 2500);
        
        // Generate new level in the background - atomically update state once on completion
        // This endpoint is idempotent, so it's safe to call even if nodes exist
        fetch(`/api/areas/${areaId}/generate-level`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ level: newUnlockedLevel }),
        }).then(response => {
          if (!response.ok) {
            console.error("Failed to generate new level");
            return;
          }
          
          return response.json().then(({ updatedArea, createdSkills }) => {
            // Immediately create the next future level AFTER receiving updated nextLevelToAssign
            // This maintains the 3 locked levels ahead of the newly visible level
            const nextFutureLevel = updatedArea.nextLevelToAssign;
            
            // Check if the future level already exists in area skills
            const futureLeveSkills = area.skills.filter(s => s.level === nextFutureLevel);
            
            console.log('[reconfirm] nextFutureLevel:', nextFutureLevel);
            console.log('[reconfirm] futureLeveSkills.length:', futureLeveSkills?.length);
            console.log('[reconfirm] skipping generation:', futureLeveSkills?.length > 0);
            
            if (futureLeveSkills.length > 0) {
              // Future level already exists, skip generation
              console.log(`[toggleSkillStatus] Future level ${nextFutureLevel} already exists, skipping generation`);
            } else {
              // Future level doesn't exist, create it
              console.log(`[toggleSkillStatus] Creating future level ${nextFutureLevel} after unlocking level ${newUnlockedLevel}`);
              fetch(`/api/areas/${areaId}/generate-level`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ level: nextFutureLevel }),
              }).then(futureResponse => {
                if (!futureResponse.ok) {
                  console.warn(`[toggleSkillStatus] Note: Could not create future level ${nextFutureLevel}, will be created on demand`);
                } else {
                  console.log(`[toggleSkillStatus] ✓ Future level ${nextFutureLevel} created`);
                }
              }).catch(error => {
                console.warn(`[toggleSkillStatus] Error creating future level ${nextFutureLevel}:`, error);
              });
            }
            
            // After level generation completes, refresh entire areas state from server
            console.log("[toggleSkillStatus] Level generation complete, refreshing areas from server...");
            return refreshAllAreas();
          });
        }).catch(error => {
          console.error("Error generating new level:", error);
        });
      } else if (isClosingLevel) {
        const revertedLevel = skill.level;
        
        // Update state immediately
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
        
        // Send updates to server without blocking
        const higherLevelSkills = area.skills.filter(s => s.level > revertedLevel);
        
        fetch(`/api/areas/${areaId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            unlockedLevel: revertedLevel,
            nextLevelToAssign: revertedLevel
          }),
        }).catch(error => {
          console.error("Error closing level:", error);
        });
        
        // Lock higher level skills in parallel without blocking
        higherLevelSkills.forEach(s => {
          fetch(`/api/skills/${s.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "locked" }),
          }).catch(error => {
            console.error(`Error locking skill ${s.id}:`, error);
          });
        });
      } else if (isFinalNodeByPosition && skill.status === "mastered" && newStatus === "available") {
        // NEW RULE 2: Unconfirming the final node of a completed level closes the next level
        // If this is a final node being unconfirmed, hide the next level and reset its skills
        console.log(`[toggleSkillStatus] Final node unconfirmed - closing next level`);
        
        const nextLevelToClose = skill.level + 1;
        
        // Update state immediately: close next level and reset its skills
        setAreas(prev => prev.map(a => {
          if (a.id !== areaId) return a;
          return {
            ...a,
            unlockedLevel: skill.level,
            nextLevelToAssign: skill.level,
            skills: a.skills.map(s => {
              if (s.id === skillId) return { ...s, status: newStatus };
              // Reset next level skills to initial state
              if (s.level === nextLevelToClose) {
                if (s.levelPosition === 1) {
                  return { ...s, status: "mastered" as SkillStatus };
                } else if (s.levelPosition === 2) {
                  return { ...s, status: "available" as SkillStatus };
                } else {
                  return { ...s, status: "locked" as SkillStatus };
                }
              }
              return s;
            })
          };
        }));
        
        // Send updates to server without blocking
        fetch(`/api/areas/${areaId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            unlockedLevel: skill.level,
            nextLevelToAssign: skill.level
          }),
        }).catch(error => {
          console.error("Error closing next level:", error);
        });
        
        // Reset skills of the next level on server
        const nextLevelSkills = area.skills.filter(s => s.level === nextLevelToClose);
        nextLevelSkills.forEach(s => {
          let newStatus: SkillStatus = "locked";
          if (s.levelPosition === 1) {
            newStatus = "mastered";
          } else if (s.levelPosition === 2) {
            newStatus = "available";
          }
          fetch(`/api/skills/${s.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: newStatus }),
          }).catch(error => {
            console.error(`Error resetting skill ${s.id}:`, error);
          });
        });
      } else if (isFinalNodeByPosition && skill.levelPosition === 5 && skill.level === area.unlockedLevel - 1 && skill.status === "mastered" && newStatus === "available") {
        // NEW RULE: Unconfirming final node of level immediately before active level
        // Hide the current active level and reset it to staged state
        console.log(`[toggleSkillStatus] Final node of previous level unconfirmed - hiding current active level`);
        
        const levelToHide = area.unlockedLevel;
        const nextLevelToAssignValue = area.nextLevelToAssign; // Preserve current value
        
        console.log('[unconfirm] area.nextLevelToAssign before setAreas:', area.nextLevelToAssign);
        console.log('[unconfirm] preservedNextLevelToAssign:', nextLevelToAssignValue);
        
        // Update state immediately: hide next level and reset its skills to staged state
        setAreas(prev => prev.map(a => {
          if (a.id !== areaId) return a;
          return {
            ...a,
            unlockedLevel: skill.level,
            nextLevelToAssign: nextLevelToAssignValue, // Explicitly preserve
            skills: a.skills.map(s => {
              if (s.id === skillId) return { ...s, status: newStatus };
              // Reset now-hidden level skills to initial staged state
              if (s.level === levelToHide) {
                if (s.levelPosition === 1) {
                  return { ...s, status: "mastered" as SkillStatus };
                } else if (s.levelPosition === 2) {
                  return { ...s, status: "available" as SkillStatus };
                } else {
                  return { ...s, status: "locked" as SkillStatus };
                }
              }
              return s;
            })
          };
        }));
        
        // Send updates to server and process response
        console.log('[unconfirm] Sending PATCH with:', { unlockedLevel: skill.level, nextLevelToAssign: area.nextLevelToAssign });
        fetch(`/api/areas/${areaId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            unlockedLevel: skill.level,
            nextLevelToAssign: area.nextLevelToAssign
          }),
        }).then(response => {
          if (!response.ok) {
            console.error("Error updating area on server");
            return;
          }
          // Response processed and state updated via the immediate setAreas() call above
          console.log("[toggleSkillStatus] Area unlockedLevel updated on server");
        }).catch(error => {
          console.error("Error unlocking previous level:", error);
        });
        
        // Reset skills of the now-hidden level on server
        const levelToHideSkills = area.skills.filter(s => s.level === levelToHide);
        levelToHideSkills.forEach(s => {
          let resetStatus: SkillStatus = "locked";
          if (s.levelPosition === 1) {
            resetStatus = "mastered";
          } else if (s.levelPosition === 2) {
            resetStatus = "available";
          }
          fetch(`/api/skills/${s.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: resetStatus }),
          }).catch(error => {
            console.error(`Error resetting skill ${s.id}:`, error);
          });
        });
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

    // First node of any level is immutable - cannot be toggled
    if (skill.levelPosition === 1) {
      return;
    }

    const skillsInLevel = project.skills.filter(s => s.level === skill.level);
    const isLastNodeOfLevel = skillsInLevel.length > 0 && 
      skill.y === Math.max(...skillsInLevel.map(s => s.y));
    
    // Check if this is a final node (has star OR is last node by position)
    // Can only be confirmed if all other nodes in level are mastered
    const isFinalNodeByPosition = isLastNodeOfLevel || skill.isFinalNode === 1;
    if (isFinalNodeByPosition && skill.status !== "mastered") {
      const otherNodesInLevel = skillsInLevel.filter(s => s.id !== skill.id);
      const allOthersMastered = otherNodesInLevel.every(s => s.status === "mastered");
      if (!allOthersMastered) {
        return;
      }
    }

    // Check if next node has a title (except for final nodes)
    if (skill.status === "available" && !isLastNodeOfLevel && !isFinalNodeByPosition) {
      const nodesSortedByY = skillsInLevel.sort((a, b) => a.y - b.y);
      const currentNodeIndex = nodesSortedByY.findIndex(s => s.id === skill.id);
      const nextNode = nodesSortedByY[currentNodeIndex + 1];
      
      if (nextNode) {
        const hasValidTitle = nextNode.title && 
          !nextNode.title.toLowerCase().includes("challenge") && 
          !nextNode.title.toLowerCase().includes("objective quest");
        
        if (!hasValidTitle) {
          return; // Block the action
        }
      }
    }

    const nextStatus: Record<SkillStatus, SkillStatus> = {
      "locked": "locked",
      "available": "mastered",
      "mastered": "available"
    };

    const newStatus = nextStatus[skill.status];
    
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

      if (hasStar && newStatus === "mastered") {
        triggerCompleted();
        await archiveProject(projectId);
      } else if (newStatus === "mastered") {
        triggerQuestUpdated();
      }

      if (isOpeningNewLevel) {
        const newUnlockedLevel = skill.level + 1;
        
        // Update state immediately without waiting
        setProjects(prev => prev.map(p => {
          if (p.id !== projectId) return p;
          return {
            ...p,
            unlockedLevel: newUnlockedLevel,
            nextLevelToAssign: newUnlockedLevel,
            skills: p.skills.map(s => 
              s.id === skillId ? { ...s, status: newStatus } : s
            )
          };
        }));
        
        // Trigger UI feedback immediately
        triggerQuestUpdated();
        setTimeout(() => triggerLevelUp(newUnlockedLevel), 2500);
        
        // Generate new level in the background without blocking
        fetch(`/api/projects/${projectId}/generate-level`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ level: newUnlockedLevel }),
        }).then(response => {
          if (!response.ok) {
            console.error("Failed to generate new level");
            return;
          }
          
          // Also create the next future level (newUnlockedLevel + 3) in the background
          // This maintains the 3 locked levels ahead of the newly visible level
          const nextFutureLevel = newUnlockedLevel + 3;
          console.log(`[toggleProjectSkillStatus] Creating future level ${nextFutureLevel} after unlocking level ${newUnlockedLevel}`);
          fetch(`/api/projects/${projectId}/generate-level`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ level: nextFutureLevel }),
          }).then(futureResponse => {
            if (!futureResponse.ok) {
              console.warn(`[toggleProjectSkillStatus] Note: Could not create future level ${nextFutureLevel}, will be created on demand`);
            } else {
              console.log(`[toggleProjectSkillStatus] ✓ Future level ${nextFutureLevel} created`);
            }
          }).catch(error => {
            console.warn(`[toggleProjectSkillStatus] Error creating future level ${nextFutureLevel}:`, error);
          });
          
          // After level generation completes, refresh entire projects state from server
          console.log("[toggleProjectSkillStatus] Level generation complete, refreshing projects from server...");
          return refreshAllProjects();
        }).catch(error => {
          console.error("Error generating new level:", error);
        });
      } else if (isClosingLevel) {
        const revertedLevel = skill.level;
        
        // Update state immediately
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
        
        // Send updates to server without blocking
        const higherLevelSkills = project.skills.filter(s => s.level > revertedLevel);
        
        fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            unlockedLevel: revertedLevel,
            nextLevelToAssign: revertedLevel
          }),
        }).catch(error => {
          console.error("Error closing level:", error);
        });
        
        // Lock higher level skills in parallel without blocking
        higherLevelSkills.forEach(s => {
          fetch(`/api/skills/${s.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "locked" }),
          }).catch(error => {
            console.error(`Error locking skill ${s.id}:`, error);
          });
        });
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
    const children = area.skills.filter(s => ensureDependenciesArray(s.dependencies).includes(skillId));
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
      const deleteResponse = await fetch(`/api/skills/${skillId}`, { method: "DELETE" });
      if (!deleteResponse.ok) {
        throw new Error(`Error al eliminar skill: ${deleteResponse.status}`);
      }

      // Update children's dependencies
      for (const child of children) {
        const updatedDeps = child.dependencies
          .filter(d => d !== skillId)
          .concat(newDependencies);
        
        const patchResponse = await fetch(`/api/skills/${child.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dependencies: updatedDeps }),
        });
        if (!patchResponse.ok) {
          throw new Error(`Error al actualizar dependencias: ${patchResponse.status}`);
        }
      }

      // Shift nodes below up by 150px
      const nodesToShift = area.skills.filter(s => s.y > skillToDelete.y);
      for (const node of nodesToShift) {
        const shiftResponse = await fetch(`/api/skills/${node.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ y: node.y - 150 }),
        });
        if (!shiftResponse.ok) {
          throw new Error(`Error al reposicionar skill: ${shiftResponse.status}`);
        }
      }

      // Mark new final node if needed
      if (newFinalNodeId) {
        const finalResponse = await fetch(`/api/skills/${newFinalNodeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isFinalNode: 1 }),
        });
        if (!finalResponse.ok) {
          throw new Error(`Error al marcar nodo final: ${finalResponse.status}`);
        }
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
      alert(`Error al eliminar skill: ${error instanceof Error ? error.message : "Error desconocido"}`);
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

  const updateSkill = async (areaId: string, skillId: string, updates: { title?: string; description?: string; feedback?: string; experiencePoints?: number }) => {
    console.log('[updateSkill] Called with skillId:', skillId, 'areaId:', areaId, 'updates:', updates);
    try {
      const response = await fetch(`/api/skills/${skillId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      console.log('[updateSkill] Response status:', response.status);

      const data = await response.json();
      console.log('[updateSkill] Response data:', data);

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

  // Renamed: now uses updateSkill instead
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

    const children = project.skills.filter(s => ensureDependenciesArray(s.dependencies).includes(skillId));
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
      const deleteResponse = await fetch(`/api/skills/${skillId}`, { method: "DELETE" });
      if (!deleteResponse.ok) {
        throw new Error(`Error al eliminar skill: ${deleteResponse.status}`);
      }

      for (const child of children) {
        const updatedDeps = child.dependencies
          .filter(d => d !== skillId)
          .concat(newDependencies);
        
        const patchResponse = await fetch(`/api/skills/${child.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dependencies: updatedDeps }),
        });
        if (!patchResponse.ok) {
          throw new Error(`Error al actualizar dependencias: ${patchResponse.status}`);
        }
      }

      const nodesToShift = project.skills.filter(s => s.y > skillToDelete.y);
      for (const node of nodesToShift) {
        const shiftResponse = await fetch(`/api/skills/${node.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ y: node.y - 150 }),
        });
        if (!shiftResponse.ok) {
          throw new Error(`Error al reposicionar skill: ${shiftResponse.status}`);
        }
      }

      if (newFinalNodeId) {
        const finalResponse = await fetch(`/api/skills/${newFinalNodeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isFinalNode: 1 }),
        });
        if (!finalResponse.ok) {
          throw new Error(`Error al marcar nodo final: ${finalResponse.status}`);
        }
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
      alert(`Error al eliminar skill del proyecto: ${error instanceof Error ? error.message : "Error desconocido"}`);
    }
  };

  const updateProjectSkill = async (projectId: string, skillId: string, updates: { title?: string; description?: string; feedback?: string; experiencePoints?: number }) => {
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
      console.log(`[createArea] Creating area with id="${id}", name="${name}"`);
      
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
        const errorText = await response.text();
        throw new Error(`Failed to create area: ${response.status} ${errorText}`);
      }
      
      const newArea = await response.json();
      console.log(`[createArea] Area created with:`, { id: newArea.id, name: newArea.name, skills: newArea.skills?.length || 0 });
      
      // Important: Only try to generate level if area has no skills yet
      if (!newArea.skills || newArea.skills.length === 0) {
        console.log(`[createArea] No skills in new area, calling generate-level...`);
        const generateResponse = await fetch(`/api/areas/${newArea.id}/generate-level`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ level: 1 }),
        });
        
        console.log(`[createArea] Generate level response status: ${generateResponse.status}`);
        
        if (generateResponse.ok) {
          const data = await generateResponse.json();
          console.log(`[createArea] Generated level data:`, { 
            createdSkills: data.createdSkills?.length || 0,
            updatedArea: data.updatedArea?.id 
          });
          const createdSkills = data.createdSkills || [];
          setAreas(prev => [...prev, { ...newArea, skills: createdSkills }]);
          console.log(`[createArea] ✓ Area created with ${createdSkills.length} initial skills`);
        } else {
          const errorText = await generateResponse.text();
          console.error(`[createArea] ✗ Generate level failed with status ${generateResponse.status}: ${errorText}`);
          setAreas(prev => [...prev, { ...newArea, skills: [] }]);
        }
      } else {
        console.log(`[createArea] Area already has skills (${newArea.skills.length}), skipping generate-level`);
        setAreas(prev => [...prev, newArea]);
      }
      
      setActiveAreaId(newArea.id);
    } catch (error) {
      console.error("✗ Error creating area:", error);
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
      
      setArchivedAreas(prev => prev.filter(a => a.id !== areaId));
    } catch (error) {
      console.error("Error deleting area:", error);
    }
  };

  const archiveArea = async (areaId: string) => {
    try {
      const response = await fetch(`/api/areas/${areaId}/archive`, {
        method: "PATCH",
      });
      
      if (!response.ok) {
        throw new Error("Failed to archive area");
      }
      
      setAreas(prev => {
        const filtered = prev.filter(a => a.id !== areaId);
        if (activeAreaId === areaId && filtered.length > 0) {
          setActiveAreaId(filtered[0].id);
        } else if (activeAreaId === areaId) {
          setActiveAreaId("");
        }
        return filtered;
      });
    } catch (error) {
      console.error("Error archiving area:", error);
    }
  };

  const unarchiveArea = async (areaId: string) => {
    try {
      const response = await fetch(`/api/areas/${areaId}/unarchive`, {
        method: "PATCH",
      });
      
      if (!response.ok) {
        throw new Error("Failed to unarchive area");
      }
      
      const area = await response.json();
      const skillsResponse = await fetch(`/api/areas`);
      const allAreas = await skillsResponse.json();
      const restoredArea = allAreas.find((a: Area) => a.id === areaId);
      if (restoredArea) {
        setAreas(prev => [...prev, restoredArea]);
        setArchivedAreas(prev => prev.filter(a => a.id !== areaId));
      }
    } catch (error) {
      console.error("Error unarchiving area:", error);
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

  const createSideQuest = async (name: string, description: string, icon: string) => {
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
          questType: "side",
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to create side quest");
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
      console.error("Error creating side quest:", error);
    }
  };

  const createEmergentQuest = async (name: string, description: string, icon: string, firstNodeTitle: string, firstNodeAction: string) => {
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
          questType: "emergent",
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to create emergent quest");
      }
      
      const newProject = await response.json();
      
      const generateResponse = await fetch(`/api/projects/${newProject.id}/generate-level`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: 1 }),
      });
      
      if (generateResponse.ok) {
        const { createdSkills } = await generateResponse.json();
        // Update first skill node with the provided title and action
        if (createdSkills.length > 0) {
          const firstSkillId = createdSkills[0].id;
          await fetch(`/api/skills/${firstSkillId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              title: firstNodeTitle,
              description: firstNodeAction 
            }),
          });
          createdSkills[0].title = firstNodeTitle;
          createdSkills[0].description = firstNodeAction;
        }
        setProjects(prev => [...prev, { ...newProject, skills: createdSkills }]);
      } else {
        setProjects(prev => [...prev, { ...newProject, skills: [] }]);
      }
      
      handleSetActiveProjectId(newProject.id);
    } catch (error) {
      console.error("Error creating emergent quest:", error);
    }
  };

  const createExperienceQuest = async (name: string, description: string, icon: string) => {
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
          questType: "experience",
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to create experience quest");
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
      console.error("Error creating experience quest:", error);
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
      setArchivedProjects(prev => prev.filter(p => p.id !== projectId));
    } catch (error) {
      console.error("Error deleting project:", error);
    }
  };

  const archiveProject = async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/archive`, {
        method: "PATCH",
      });
      
      if (!response.ok) {
        throw new Error("Failed to archive project");
      }
      
      setProjects(prev => {
        const filtered = prev.filter(p => p.id !== projectId);
        if (activeProjectId === projectId && filtered.length > 0) {
          setActiveProjectId(filtered[0].id);
        } else if (activeProjectId === projectId) {
          setActiveProjectId("");
        }
        return filtered;
      });
    } catch (error) {
      console.error("Error archiving project:", error);
    }
  };

  const unarchiveProject = async (projectId: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/unarchive`, {
        method: "PATCH",
      });
      
      if (!response.ok) {
        throw new Error("Failed to unarchive project");
      }
      
      const projectsResponse = await fetch(`/api/projects`);
      const allProjects = await projectsResponse.json();
      const restoredProject = allProjects.find((p: Project) => p.id === projectId);
      if (restoredProject) {
        setProjects(prev => [...prev, restoredProject]);
        setArchivedProjects(prev => prev.filter(p => p.id !== projectId));
      }
    } catch (error) {
      console.error("Error unarchiving project:", error);
    }
  };

  const renameArea = async (areaId: string, newName: string) => {
    try {
      const response = await fetch(`/api/areas/${areaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to rename area");
      }
      
      setAreas(prev => prev.map(a => 
        a.id === areaId ? { ...a, name: newName } : a
      ));
    } catch (error) {
      console.error("Error renaming area:", error);
    }
  };

  const renameProject = async (projectId: string, newName: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to rename project");
      }
      
      setProjects(prev => prev.map(p => 
        p.id === projectId ? { ...p, name: newName } : p
      ));
    } catch (error) {
      console.error("Error renaming project:", error);
    }
  };

  const loadArchivedAreas = async () => {
    try {
      const response = await fetch("/api/areas/archived");
      const data = await response.json();
      setArchivedAreas(data);
    } catch (error) {
      console.error("Error loading archived areas:", error);
    }
  };

  const loadArchivedProjects = async () => {
    try {
      const response = await fetch("/api/projects/archived");
      const data = await response.json();
      setArchivedProjects(data);
    } catch (error) {
      console.error("Error loading archived projects:", error);
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

    // First node of any level is immutable - cannot be toggled
    if (skill.levelPosition === 1) {
      return;
    }

    const skillsInLevel = subSkills.filter(s => s.level === skill.level);
    const isLastNodeOfLevel = skillsInLevel.length > 0 && 
      skill.y === Math.max(...skillsInLevel.map(s => s.y));
    
    // Check if this is a final node (has star OR is last node by position)
    // Can only be confirmed if all other nodes in level are mastered
    const isFinalNodeByPosition = isLastNodeOfLevel || skill.isFinalNode === 1;
    if (isFinalNodeByPosition && skill.status !== "mastered") {
      const otherNodesInLevel = skillsInLevel.filter(s => s.id !== skill.id);
      const allOthersMastered = otherNodesInLevel.every(s => s.status === "mastered");
      if (!allOthersMastered) {
        return;
      }
    }

    // Check if next node has a title (except for final nodes)
    if (skill.status === "available" && !isLastNodeOfLevel && !isFinalNodeByPosition) {
      const nodesSortedByY = skillsInLevel.sort((a, b) => a.y - b.y);
      const currentNodeIndex = nodesSortedByY.findIndex(s => s.id === skill.id);
      const nextNode = nodesSortedByY[currentNodeIndex + 1];
      
      if (nextNode) {
        const hasValidTitle = nextNode.title && 
          !nextNode.title.toLowerCase().includes("challenge") && 
          !nextNode.title.toLowerCase().includes("objective quest");
        
        if (!hasValidTitle) {
          return; // Block the action
        }
      }
    }

    const nextStatus: Record<SkillStatus, SkillStatus> = {
      "locked": "locked",
      "available": "mastered",
      "mastered": "available"
    };

    const newStatus = nextStatus[skill.status];
    
    // Last node of level can open new levels, UNLESS it has the star (isFinalNode === 1)
    const hasStar = skill.isFinalNode === 1;
    const canOpenNewLevels = isLastNodeOfLevel && !hasStar;
    const isOpeningNewLevel = canOpenNewLevels && newStatus === "mastered";

    try {
      await fetch(`/api/skills/${skillId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (hasStar && newStatus === "mastered") {
        triggerCompleted();
        
        // Unlock the parent skill when final node is mastered
        if (activeParentSkillId) {
          await fetch(`/api/skills/${activeParentSkillId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "available", fromSubtaskCompletion: true }),
          });
          
          // Update local state for areas
          setAreas(prev => prev.map(area => ({
            ...area,
            skills: area.skills.map(s => 
              s.id === activeParentSkillId ? { ...s, status: "available" as SkillStatus } : s
            )
          })));
          
          // Update local state for projects
          setProjects(prev => prev.map(project => ({
            ...project,
            skills: project.skills.map(s => 
              s.id === activeParentSkillId ? { ...s, status: "available" as SkillStatus } : s
            )
          })));
        }
      } else if (newStatus === "mastered") {
        triggerQuestUpdated();
      }

      if (isOpeningNewLevel && activeParentSkillId) {
        const newLevel = skill.level + 1;
        
        // Update state immediately without waiting
        setSubSkills(prev => prev.map(s => 
          s.id === skillId ? { ...s, status: newStatus } : s
        ));
        
        // Trigger UI feedback immediately
        triggerQuestUpdated();
        
        // Generate new level in the background without blocking
        fetch(`/api/skills/${activeParentSkillId}/subskills/generate-level`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ level: newLevel }),
        }).then(response => {
          if (!response.ok) {
            console.error("Failed to generate new subskill level");
            return;
          }
          return response.json().then(({ createdSkills }) => {
            // IMMEDIATE normalization right after receiving from server
            // Ensure first node NEVER shows as locked
            const normalizedCreatedSkills = ensureFirstNodeRules(createdSkills);
            
            setSubSkills(prev => {
              const existingIds = new Set(prev.map((s: Skill) => s.id));
              const newSkills = normalizedCreatedSkills.filter((s: Skill) => !existingIds.has(s.id));
              
              // Double-check: ensure new first nodes are mastered
              const guardedNewSkills = newSkills.map(s => {
                if (s.levelPosition === 1) {
                  return { ...s, status: "mastered" as SkillStatus, title: "" };
                }
                return s;
              });
              
              return [...prev, ...guardedNewSkills];
            });
          });
        }).catch(error => {
          console.error("Error generating new subskill level:", error);
        });
      } else {
        setSubSkills(prev => prev.map(s => 
          s.id === skillId ? { ...s, status: newStatus } : s
        ));
      }
    } catch (error) {
      console.error("Error toggling sub-skill status:", error);
    }
  };

  const updateSubSkill = async (skillId: string, updates: { title?: string; description?: string; feedback?: string; experiencePoints?: number }) => {
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

    const children = subSkills.filter(s => ensureDependenciesArray(s.dependencies).includes(skillId));
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
      const deleteResponse = await fetch(`/api/skills/${skillId}`, { method: "DELETE" });
      if (!deleteResponse.ok) {
        throw new Error(`Error al eliminar sub-skill: ${deleteResponse.status}`);
      }

      for (const child of children) {
        const updatedDeps = child.dependencies
          .filter(d => d !== skillId)
          .concat(newDependencies);
        
        const patchResponse = await fetch(`/api/skills/${child.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dependencies: updatedDeps }),
        });
        if (!patchResponse.ok) {
          throw new Error(`Error al actualizar dependencias: ${patchResponse.status}`);
        }
      }

      const nodesToShift = subSkills.filter(s => s.y > skillToDelete.y);
      for (const node of nodesToShift) {
        const shiftResponse = await fetch(`/api/skills/${node.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ y: node.y - 150 }),
        });
        if (!shiftResponse.ok) {
          throw new Error(`Error al reposicionar skill: ${shiftResponse.status}`);
        }
      }

      if (newFinalNodeId) {
        const finalResponse = await fetch(`/api/skills/${newFinalNodeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isFinalNode: 1 }),
        });
        if (!finalResponse.ok) {
          throw new Error(`Error al marcar nodo final: ${finalResponse.status}`);
        }
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
      alert(`Error al eliminar sub-skill: ${error instanceof Error ? error.message : "Error desconocido"}`);
    }
  };

  const deleteSubSkillTree = async () => {
    if (!activeParentSkillId) return;
    
    try {
      const response = await fetch(`/api/skills/${activeParentSkillId}/subskills`, { method: "DELETE" });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Error al borrar las sub-habilidades");
      }
      setSubSkills([]);
      exitSubSkillTree();
    } catch (error) {
      console.error("Error deleting sub-skill tree:", error);
      throw error;
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

  const addSkillBelow = async (areaId: string, skillId: string, title: string = "?") => {
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
        title,
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

      if (finalNode && ensureDependenciesArray(finalNode.dependencies).includes(clickedSkill.id)) {
        const updatedDeps = ensureDependenciesArray(finalNode.dependencies).map(d => d === clickedSkill.id ? newSkill.id : d);
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
              if (finalNode && s.id === finalNode.id && ensureDependenciesArray(finalNode.dependencies).includes(clickedSkill.id)) {
                const updatedDeps = ensureDependenciesArray(s.dependencies).map(d => d === clickedSkill.id ? newSkill.id : d);
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

  const addProjectSkillBelow = async (projectId: string, skillId: string, title: string = "?") => {
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
        title,
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

      if (finalNode && ensureDependenciesArray(finalNode.dependencies).includes(clickedSkill.id)) {
        const updatedDeps = ensureDependenciesArray(finalNode.dependencies).map(d => d === clickedSkill.id ? newSkill.id : d);
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
              if (finalNode && s.id === finalNode.id && ensureDependenciesArray(finalNode.dependencies).includes(clickedSkill.id)) {
                const updatedDeps = ensureDependenciesArray(s.dependencies).map(d => d === clickedSkill.id ? newSkill.id : d);
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

  const addSubSkillBelow = async (skillId: string, title: string = "?") => {
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
        title,
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

      if (finalNode && ensureDependenciesArray(finalNode.dependencies).includes(clickedSkill.id)) {
        const updatedDeps = ensureDependenciesArray(finalNode.dependencies).map(d => d === clickedSkill.id ? newSkill.id : d);
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
          if (finalNode && s.id === finalNode.id && ensureDependenciesArray(finalNode.dependencies).includes(clickedSkill.id)) {
            const updatedDeps = ensureDependenciesArray(s.dependencies).map(d => d === clickedSkill.id ? newSkill.id : d);
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

  // Helper function to find the next node by Y coordinate in the same level
  const getNextNodeByY = (skills: Skill[], skill: Skill): Skill | undefined => {
    const sameLevelSkills = skills
      .filter(s => s.level === skill.level)
      .sort((a, b) => a.y - b.y);
    
    const nextNode = sameLevelSkills.find(s => s.y > skill.y);
    return nextNode;
  };

  const duplicateSkill = async (areaId: string, skill: Skill) => {
    const area = areas.find(a => a.id === areaId);
    if (!area) return;

    const sameLevelSkills = area.skills
      .filter(s => s.level === skill.level)
      .sort((a, b) => a.y - b.y);

    const finalNode = sameLevelSkills.find(s => s.isFinalNode === 1);
    const nextNode = getNextNodeByY(area.skills, skill);
    const newY = skill.y + 150;

    try {
      const nodesToShift = area.skills.filter(s => s.y > skill.y);
      for (const node of nodesToShift) {
        const newNodeY = node.y + 150;
        const newLevelPosition = (node.levelPosition || 0) + 1;
        await fetch(`/api/skills/${node.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ y: newNodeY, levelPosition: newLevelPosition }),
        });
      }

      // Determine status for duplicated node based on next node
      let duplicatedStatus: SkillStatus = "locked";
      let nextNodeStatusUpdate: { needsUpdate: boolean; newStatus?: SkillStatus } = { needsUpdate: false };

      if (skill.status === "mastered" && nextNode && nextNode.status === "available") {
        duplicatedStatus = "available";
        nextNodeStatusUpdate = { needsUpdate: true, newStatus: "locked" };
        console.log(`[duplicateSkill] Intelligent status replication: duplicated=${duplicatedStatus}, nextNode will be locked`);
      }

      const newSkillData = {
        areaId,
        title: skill.title,
        description: skill.description,
        feedback: skill.feedback,
        x: skill.x,
        y: newY,
        status: duplicatedStatus,
        dependencies: [skill.id],
        level: skill.level,
        levelPosition: (skill.levelPosition || 0) + 1,
        isFinalNode: 0,
        manualLock: 0,
      };

      const response = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSkillData),
      });
      const newSkill = await response.json();

      // Update next node status if needed (intelligent replication)
      if (nextNodeStatusUpdate.needsUpdate && nextNode && nextNodeStatusUpdate.newStatus) {
        await fetch(`/api/skills/${nextNode.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextNodeStatusUpdate.newStatus }),
        });
      }

      if (finalNode && ensureDependenciesArray(finalNode.dependencies).includes(skill.id)) {
        const updatedDeps = ensureDependenciesArray(finalNode.dependencies).map(d => d === skill.id ? newSkill.id : d);
        await fetch(`/api/skills/${finalNode.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dependencies: updatedDeps }),
        });
      }

      // Recalculate final nodes for the affected level
      await fetch(`/api/areas/${areaId}/recalculate-level-final-nodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: skill.level }),
      });

      // After all operations complete, refresh entire area from server
      console.log("[duplicateSkill] Duplication complete, refreshing area from server...");
      await refreshAllAreas();
    } catch (error) {
      console.error("Error duplicating skill:", error);
    }
  };

  const duplicateProjectSkill = async (projectId: string, skill: Skill) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const sameLevelSkills = project.skills
      .filter(s => s.level === skill.level)
      .sort((a, b) => a.y - b.y);

    const finalNode = sameLevelSkills.find(s => s.isFinalNode === 1);
    const nextNode = getNextNodeByY(project.skills, skill);
    const newY = skill.y + 150;

    try {
      const nodesToShift = project.skills.filter(s => s.y > skill.y);
      for (const node of nodesToShift) {
        const newNodeY = node.y + 150;
        const newLevelPosition = (node.levelPosition || 0) + 1;
        await fetch(`/api/skills/${node.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ y: newNodeY, levelPosition: newLevelPosition }),
        });
      }

      // Determine status for duplicated node based on next node
      let duplicatedStatus: SkillStatus = "locked";
      let nextNodeStatusUpdate: { needsUpdate: boolean; newStatus?: SkillStatus } = { needsUpdate: false };

      if (skill.status === "mastered" && nextNode && nextNode.status === "available") {
        duplicatedStatus = "available";
        nextNodeStatusUpdate = { needsUpdate: true, newStatus: "locked" };
        console.log(`[duplicateProjectSkill] Intelligent status replication: duplicated=${duplicatedStatus}, nextNode will be locked`);
      }

      const newSkillData = {
        projectId,
        title: skill.title,
        description: skill.description,
        feedback: skill.feedback,
        x: skill.x,
        y: newY,
        status: duplicatedStatus,
        dependencies: [skill.id],
        level: skill.level,
        levelPosition: (skill.levelPosition || 0) + 1,
        isFinalNode: 0,
        manualLock: 0,
      };

      const response = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSkillData),
      });
      const newSkill = await response.json();

      // Update next node status if needed (intelligent replication)
      if (nextNodeStatusUpdate.needsUpdate && nextNode && nextNodeStatusUpdate.newStatus) {
        await fetch(`/api/skills/${nextNode.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextNodeStatusUpdate.newStatus }),
        });
      }

      if (finalNode && ensureDependenciesArray(finalNode.dependencies).includes(skill.id)) {
        const updatedDeps = ensureDependenciesArray(finalNode.dependencies).map(d => d === skill.id ? newSkill.id : d);
        await fetch(`/api/skills/${finalNode.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dependencies: updatedDeps }),
        });
      }

      // Recalculate final nodes for the affected level
      await fetch(`/api/projects/${projectId}/recalculate-level-final-nodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: skill.level }),
      });

      // After all operations complete, refresh entire projects from server
      console.log("[duplicateProjectSkill] Duplication complete, refreshing projects from server...");
      await refreshAllProjects();
    } catch (error) {
      console.error("Error duplicating project skill:", error);
    }
  };

  const duplicateSubSkill = async (skill: Skill) => {
    if (!activeParentSkillId) return;

    const sameLevelSkills = subSkills
      .filter(s => s.level === skill.level)
      .sort((a, b) => a.y - b.y);

    const finalNode = sameLevelSkills.find(s => s.isFinalNode === 1);
    const nextNode = getNextNodeByY(subSkills, skill);
    const newY = skill.y + 150;

    try {
      const nodesToShift = subSkills.filter(s => s.y > skill.y);
      for (const node of nodesToShift) {
        const newNodeY = node.y + 150;
        const newLevelPosition = (node.levelPosition || 0) + 1;
        await fetch(`/api/skills/${node.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ y: newNodeY, levelPosition: newLevelPosition }),
        });
      }

      // Determine status for duplicated node based on next node
      let duplicatedStatus: SkillStatus = "locked";
      let nextNodeStatusUpdate: { needsUpdate: boolean; newStatus?: SkillStatus } = { needsUpdate: false };

      if (skill.status === "mastered" && nextNode && nextNode.status === "available") {
        duplicatedStatus = "available";
        nextNodeStatusUpdate = { needsUpdate: true, newStatus: "locked" };
        console.log(`[duplicateSubSkill] Intelligent status replication: duplicated=${duplicatedStatus}, nextNode will be locked`);
      }

      const newSkillData = {
        parentSkillId: activeParentSkillId,
        title: skill.title,
        description: skill.description,
        feedback: skill.feedback,
        x: skill.x,
        y: newY,
        status: duplicatedStatus,
        dependencies: [skill.id],
        level: skill.level,
        levelPosition: (skill.levelPosition || 0) + 1,
        isFinalNode: 0,
        manualLock: 0,
      };

      const response = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSkillData),
      });
      const newSkill = await response.json();

      // Update next node status if needed (intelligent replication)
      if (nextNodeStatusUpdate.needsUpdate && nextNode && nextNodeStatusUpdate.newStatus) {
        await fetch(`/api/skills/${nextNode.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextNodeStatusUpdate.newStatus }),
        });
      }

      if (finalNode && ensureDependenciesArray(finalNode.dependencies).includes(skill.id)) {
        const updatedDeps = ensureDependenciesArray(finalNode.dependencies).map(d => d === skill.id ? newSkill.id : d);
        await fetch(`/api/skills/${finalNode.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dependencies: updatedDeps }),
        });
      }

      setSubSkills(prev => [
        ...prev.map(s => {
          let updated = { ...s };
          if (s.y > skill.y) {
            updated = { ...updated, y: s.y + 150, levelPosition: (s.levelPosition || 0) + 1 };
          }
          if (finalNode && s.id === finalNode.id && ensureDependenciesArray(finalNode.dependencies).includes(skill.id)) {
            const updatedDeps = ensureDependenciesArray(s.dependencies).map(d => d === skill.id ? newSkill.id : d);
            updated = { ...updated, dependencies: updatedDeps };
          }
          // Apply intelligent status replication to local state
          if (nextNodeStatusUpdate.needsUpdate && s.id === nextNode?.id && nextNodeStatusUpdate.newStatus) {
            updated = { ...updated, status: nextNodeStatusUpdate.newStatus };
          }
          return updated;
        }),
        newSkill
      ]);

      // Recalculate final nodes for the affected level
      if (activeParentSkillId) {
        await fetch(`/api/sub-skills/${activeParentSkillId}/recalculate-level-final-nodes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ level: skill.level }),
        });
      }
    } catch (error) {
      console.error("Error duplicating sub-skill:", error);
    }
  };

  // Auto-unlock logic for areas (also re-locks final nodes that shouldn't be available)
  useEffect(() => {
    if (isLoading || areas.length === 0) return;
    if (isReordering.current) return; // Skip auto-unlock during reorder

    const updatesToMake: Array<{ skillId: string; newStatus: SkillStatus }> = [];

    areas.forEach(area => {
      const skillsInLevel = new Map<number, typeof area.skills>();
      area.skills.forEach(skill => {
        if (!skillsInLevel.has(skill.level)) {
          skillsInLevel.set(skill.level, []);
        }
        skillsInLevel.get(skill.level)!.push(skill);
      });

      // Sort skills in each level by Y position
      skillsInLevel.forEach((skills) => {
        skills.sort((a, b) => a.y - b.y);
      });

      area.skills.forEach(skill => {
        if (skill.manualLock) return;
        if (skill.level > area.unlockedLevel) return;

        const levelSkills = skillsInLevel.get(skill.level) || [];
        
        // Skip first node of level (by levelPosition or by Y position)
        // It's always mastered from server and should never be auto-processed
        const skillIndex = levelSkills.findIndex(s => s.id === skill.id);
        const isFirstNodeOfLevel = skill.levelPosition === 1 || skillIndex === 0;
        if (isFirstNodeOfLevel) return;
        const isLastNodeOfLevel = levelSkills.length > 0 && 
          skill.y === Math.max(...levelSkills.map(s => s.y));
        const isFinalNodeByPosition = isLastNodeOfLevel || skill.isFinalNode === 1;
        const otherNodesInLevel = levelSkills.filter(s => s.id !== skill.id);
        const allOthersMastered = otherNodesInLevel.every(s => s.status === "mastered");

        // Find the previous skill by Y position in the same level
        const previousSkill = skillIndex > 0 ? levelSkills[skillIndex - 1] : null;
        const canUnlock = !previousSkill || previousSkill.status === "mastered";

        // Re-lock final nodes that are "available" but shouldn't be
        if (skill.status === "available" && isFinalNodeByPosition && !allOthersMastered) {
          updatesToMake.push({ skillId: skill.id, newStatus: "locked" });
          return;
        }

        // Re-lock non-first nodes that are "available" but previous node is not mastered
        if (skill.status === "available" && previousSkill && previousSkill.status !== "mastered") {
          updatesToMake.push({ skillId: skill.id, newStatus: "locked" });
          return;
        }

        if (skill.status !== "locked") return;
        
        // A skill can be unlocked if:
        // - It's the first skill in the level (no previous skill), OR
        // - The previous skill is mastered
        
        // Final nodes can only be unlocked if ALL other nodes in the level are mastered
        if (isFinalNodeByPosition) {
          if (canUnlock && allOthersMastered) {
            updatesToMake.push({ skillId: skill.id, newStatus: "available" });
          }
        } else if (canUnlock) {
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
            body: JSON.stringify(
              newStatus === "available"
                ? { status: newStatus, fromSubtaskCompletion: true }
                : { status: newStatus }
            ),
          })
        )
      ).then((responses) => {
        const successfulUpdates = updatesToMake.filter((_, index) => responses[index]?.ok);
        setAreas(prev => prev.map(area => ({
          ...area,
          skills: area.skills.map(skill => {
            const update = successfulUpdates.find(u => u.skillId === skill.id);
            return update ? { ...skill, status: update.newStatus } : skill;
          })
        })));
      });
    }
  }, [areas, isLoading, isReordering]);

  // Auto-unlock logic for projects (also re-locks nodes that shouldn't be available)
  useEffect(() => {
    if (isLoading || projects.length === 0) return;
    if (isReordering.current) return; // Skip auto-unlock during reorder

    const updatesToMake: Array<{ skillId: string; newStatus: SkillStatus }> = [];

    projects.forEach(project => {
      const skillsInLevel = new Map<number, typeof project.skills>();
      project.skills.forEach(skill => {
        if (!skillsInLevel.has(skill.level)) {
          skillsInLevel.set(skill.level, []);
        }
        skillsInLevel.get(skill.level)!.push(skill);
      });

      // Sort skills in each level by Y position
      skillsInLevel.forEach((skills) => {
        skills.sort((a, b) => a.y - b.y);
      });

      project.skills.forEach(skill => {
        if (skill.manualLock) return;
        if (skill.level > project.unlockedLevel) return;

        const levelSkills = skillsInLevel.get(skill.level) || [];
        
        // Skip first node of level (by levelPosition or by Y position)
        // It's always mastered from server and should never be auto-processed
        const skillIndex = levelSkills.findIndex(s => s.id === skill.id);
        const isFirstNodeOfLevel = skill.levelPosition === 1 || skillIndex === 0;
        if (isFirstNodeOfLevel) return;
        const isLastNodeOfLevel = levelSkills.length > 0 && 
          skill.y === Math.max(...levelSkills.map(s => s.y));
        const isFinalNodeByPosition = isLastNodeOfLevel || skill.isFinalNode === 1;
        const otherNodesInLevel = levelSkills.filter(s => s.id !== skill.id);
        const allOthersMastered = otherNodesInLevel.every(s => s.status === "mastered");

        // Find the previous skill by Y position in the same level
        const previousSkill = skillIndex > 0 ? levelSkills[skillIndex - 1] : null;
        const canUnlock = !previousSkill || previousSkill.status === "mastered";

        // Re-lock final nodes that are "available" but shouldn't be
        if (skill.status === "available" && isFinalNodeByPosition && !allOthersMastered) {
          updatesToMake.push({ skillId: skill.id, newStatus: "locked" });
          return;
        }

        // Re-lock non-first nodes that are "available" but previous node is not mastered
        if (skill.status === "available" && previousSkill && previousSkill.status !== "mastered") {
          updatesToMake.push({ skillId: skill.id, newStatus: "locked" });
          return;
        }

        if (skill.status !== "locked") return;
        
        // A skill can be unlocked if:
        // - It's the first skill in the level (no previous skill), OR
        // - The previous skill is mastered
        
        // Final nodes can only be unlocked if ALL other nodes in the level are mastered
        if (isFinalNodeByPosition) {
          if (canUnlock && allOthersMastered) {
            updatesToMake.push({ skillId: skill.id, newStatus: "available" });
          }
        } else if (canUnlock) {
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
            body: JSON.stringify(
              newStatus === "available"
                ? { status: newStatus, fromSubtaskCompletion: true }
                : { status: newStatus }
            ),
          })
        )
      ).then((responses) => {
        const successfulUpdates = updatesToMake.filter((_, index) => responses[index]?.ok);
        setProjects(prev => prev.map(project => ({
          ...project,
          skills: project.skills.map(skill => {
            const update = successfulUpdates.find(u => u.skillId === skill.id);
            return update ? { ...skill, status: update.newStatus } : skill;
          })
        })));
      });
    }
  }, [projects, isLoading]);

  // Auto-unlock logic for sub-skills
  useEffect(() => {
    if (subSkills.length === 0) return;
    if (isReordering.current) return; // Skip auto-unlock during reorder

    const updatesToMake: Array<{ skillId: string; newStatus: SkillStatus }> = [];

    const skillsInLevel = new Map<number, typeof subSkills>();
    subSkills.forEach(skill => {
      if (!skillsInLevel.has(skill.level)) {
        skillsInLevel.set(skill.level, []);
      }
      skillsInLevel.get(skill.level)!.push(skill);
    });

    // Sort skills in each level by Y position
    skillsInLevel.forEach((skills) => {
      skills.sort((a, b) => a.y - b.y);
    });

    subSkills.forEach(skill => {
      if (skill.manualLock) return;

      const levelSkills = skillsInLevel.get(skill.level) || [];
      const skillIndex = levelSkills.findIndex(s => s.id === skill.id);
      
      // Skip first node of level (by levelPosition or by Y position)
      // It's always mastered from server and should never be auto-processed
      const isFirstNodeOfLevel = skill.levelPosition === 1 || skillIndex === 0;
      if (isFirstNodeOfLevel) return;

      const isLastNodeOfLevel = levelSkills.length > 0 && 
        skill.y === Math.max(...levelSkills.map(s => s.y));
      const isFinalNodeByPosition = isLastNodeOfLevel || skill.isFinalNode === 1;
      const otherNodesInLevel = levelSkills.filter(s => s.id !== skill.id);
      const allOthersMastered = otherNodesInLevel.every(s => s.status === "mastered");

      // Find the previous skill by Y position in the same level
      const previousSkill = skillIndex > 0 ? levelSkills[skillIndex - 1] : null;
      const canUnlock = !previousSkill || previousSkill.status === "mastered";

      // Re-lock final nodes that are "available" but shouldn't be
      if (skill.status === "available" && isFinalNodeByPosition && !allOthersMastered) {
        updatesToMake.push({ skillId: skill.id, newStatus: "locked" });
        return;
      }

      // Re-lock non-first nodes that are "available" but previous node is not mastered
      if (skill.status === "available" && previousSkill && previousSkill.status !== "mastered") {
        updatesToMake.push({ skillId: skill.id, newStatus: "locked" });
        return;
      }

      if (skill.status !== "locked") return;
      
      // A skill can be unlocked if:
      // - It's the first skill in the level (no previous skill), OR
      // - The previous skill is mastered
      
      // Final nodes can only be unlocked if ALL other nodes in the level are mastered
      if (isFinalNodeByPosition) {
        if (canUnlock && allOthersMastered) {
          updatesToMake.push({ skillId: skill.id, newStatus: "available" });
        }
      } else if (canUnlock) {
        updatesToMake.push({ skillId: skill.id, newStatus: "available" });
      }
    });

    if (updatesToMake.length > 0) {
      Promise.all(
        updatesToMake.map(({ skillId, newStatus }) =>
          fetch(`/api/skills/${skillId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              newStatus === "available"
                ? { status: newStatus, fromSubtaskCompletion: true }
                : { status: newStatus }
            ),
          })
        )
      ).then((responses) => {
        const successfulUpdates = updatesToMake.filter((_, index) => responses[index]?.ok);
        setSubSkills(prev => prev.map(skill => {
          const update = successfulUpdates.find(u => u.skillId === skill.id);
          return update ? { ...skill, status: update.newStatus } : skill;
        }));
      });
    }
  }, [subSkills]);

  // Auto-unlock parent skill when ALL subtasks are mastered
  useEffect(() => {
    if (!activeParentSkillId || subSkills.length === 0) return;
    if (isReordering.current) return; // Skip auto-unlock during reorder
    
    const allSubtasksMastered = subSkills.every(s => s.status === "mastered");
    
    if (allSubtasksMastered) {
      // Unlock the parent skill
      fetch(`/api/skills/${activeParentSkillId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "available", fromSubtaskCompletion: true }),
      }).then(() => {
        // Update local state for areas
        setAreas(prev => prev.map(area => ({
          ...area,
          skills: area.skills.map(s => 
            s.id === activeParentSkillId ? { ...s, status: "available" as SkillStatus } : s
          )
        })));
        
        // Update local state for projects
        setProjects(prev => prev.map(project => ({
          ...project,
          skills: project.skills.map(s => 
            s.id === activeParentSkillId ? { ...s, status: "available" as SkillStatus } : s
          )
        })));
      }).catch(err => console.error("Error unlocking parent skill:", err));
    }
  }, [subSkills, activeParentSkillId]);

  const updateLevelSubtitle = async (areaId: string, level: number, subtitle: string, description?: string) => {
    const area = areas.find(a => a.id === areaId);
    if (!area) return;

    const updatedSubtitles = { ...area.levelSubtitles, [level.toString()]: subtitle };
    const updatedDescriptions = description !== undefined 
      ? { ...area.levelSubtitleDescriptions, [level.toString()]: description }
      : area.levelSubtitleDescriptions;
    
    try {
      await fetch(`/api/areas/${areaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          levelSubtitles: updatedSubtitles,
          ...(description !== undefined && { levelSubtitleDescriptions: updatedDescriptions })
        }),
      });

      setAreas(prev => prev.map(a => 
        a.id === areaId ? { ...a, levelSubtitles: updatedSubtitles, levelSubtitleDescriptions: updatedDescriptions } : a
      ));
    } catch (error) {
      console.error("Error updating level subtitle:", error);
    }
  };

  const updateProjectLevelSubtitle = async (projectId: string, level: number, subtitle: string, description?: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const updatedSubtitles = { ...project.levelSubtitles, [level.toString()]: subtitle };
    const updatedDescriptions = description !== undefined 
      ? { ...project.levelSubtitleDescriptions, [level.toString()]: description }
      : project.levelSubtitleDescriptions;
    
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          levelSubtitles: updatedSubtitles,
          ...(description !== undefined && { levelSubtitleDescriptions: updatedDescriptions })
        }),
      });

      setProjects(prev => prev.map(p => 
        p.id === projectId ? { ...p, levelSubtitles: updatedSubtitles, levelSubtitleDescriptions: updatedDescriptions } : p
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

  // Move skill to another level (with replacement node)
  const moveSkillToLevel = async (areaId: string, skillId: string, targetLevel: number) => {
    try {
      const area = areas.find(a => a.id === areaId);
      if (!area) return;

      const skill = area.skills.find(s => s.id === skillId);
      if (!skill || skill.level >= targetLevel) return;

      const response = await fetch(`/api/skills/${skillId}/move`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetLevel,
          parentType: "area",
          parentId: areaId
        }),
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("Error moving skill:", error);
        return;
      }

      // After successful move, refresh entire area from server to ensure consistency
      console.log("[moveSkillToLevel] Move complete, refreshing area from server...");
      await refreshAllAreas();
    } catch (error) {
      console.error("Error moving skill to level:", error);
    }
  };

  // Reorder skill within the same level (swap with adjacent)
  const reorderSkillWithinLevel = async (areaId: string, skillId: string, direction: "up" | "down") => {
    try {
      const area = areas.find(a => a.id === areaId);
      if (!area) return;

      const skill = area.skills.find(s => s.id === skillId);
      if (!skill) return;

      // Mark reordering in progress to prevent auto-unlock effects
      isReordering.current = true;
      console.log("[reorderSkillWithinLevel] Starting reorder, isReordering set to true");

      const response = await fetch(`/api/skills/${skillId}/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          direction,
          parentType: "area",
          parentId: areaId,
          currentLevel: skill.level
        }),
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("Error reordering skill:", error);
        isReordering.current = false;
        return;
      }

      // After successful reorder, refresh entire area from server to ensure consistency
      console.log("[reorderSkillWithinLevel] Reorder complete, refreshing area from server...");
      await refreshAllAreas();
      
      // Mark reordering complete to allow auto-unlock effects again
      isReordering.current = false;
      console.log("[reorderSkillWithinLevel] Refresh complete, isReordering set to false");
    } catch (error) {
      console.error("Error reordering skill within level:", error);
      isReordering.current = false;
    }
  };

  // Move project skill to another level (with replacement node)
  const moveProjectSkillToLevel = async (projectId: string, skillId: string, targetLevel: number) => {
    try {
      const project = projects.find(p => p.id === projectId);
      if (!project) return;

      const skill = project.skills.find(s => s.id === skillId);
      if (!skill || skill.level >= targetLevel) return;

      const response = await fetch(`/api/skills/${skillId}/move`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetLevel,
          parentType: "project",
          parentId: projectId
        }),
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("Error moving project skill:", error);
        return;
      }

      // After successful move, refresh entire projects from server to ensure consistency
      console.log("[moveProjectSkillToLevel] Move complete, refreshing projects from server...");
      await refreshAllProjects();
    } catch (error) {
      console.error("Error moving project skill to level:", error);
    }
  };

  // Reorder project skill within the same level (swap with adjacent)
  const reorderProjectSkillWithinLevel = async (projectId: string, skillId: string, direction: "up" | "down") => {
    try {
      const project = projects.find(p => p.id === projectId);
      if (!project) return;

      const skill = project.skills.find(s => s.id === skillId);
      if (!skill) return;

      // Mark reordering in progress to prevent auto-unlock effects
      isReordering.current = true;
      console.log("[reorderProjectSkillWithinLevel] Starting reorder, isReordering set to true");

      const response = await fetch(`/api/skills/${skillId}/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          direction,
          parentType: "project",
          parentId: projectId,
          currentLevel: skill.level
        }),
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("Error reordering project skill:", error);
        isReordering.current = false;
        return;
      }

      // After successful reorder, refresh entire projects from server to ensure consistency
      console.log("[reorderProjectSkillWithinLevel] Reorder complete, refreshing projects from server...");
      await refreshAllProjects();
      
      // Mark reordering complete to allow auto-unlock effects again
      isReordering.current = false;
      console.log("[reorderProjectSkillWithinLevel] Refresh complete, isReordering set to false");
    } catch (error) {
      console.error("Error reordering project skill within level:", error);
      isReordering.current = false;
    }
  };

  // Global Skills functions
  const getGlobalSkillsForArea = (areaId: string): GlobalSkill[] => {
    const areaSkills = globalSkills.filter(s => s.areaId === areaId && !s.parentSkillId);
    const areaSkillIds = new Set(areaSkills.map(s => s.id));
    const subSkillsOfArea = globalSkills.filter(s => s.parentSkillId && areaSkillIds.has(s.parentSkillId));
    return [...areaSkills, ...subSkillsOfArea];
  };

  const getGlobalSkillsForProject = (projectId: string): GlobalSkill[] => {
    const projectSkills = globalSkills.filter(s => s.projectId === projectId && !s.parentSkillId);
    const projectSkillIds = new Set(projectSkills.map(s => s.id));
    const subSkillsOfProject = globalSkills.filter(s => s.parentSkillId && projectSkillIds.has(s.parentSkillId));
    return [...projectSkills, ...subSkillsOfProject];
  };

  const getSubSkillsOf = (parentSkillId: string): GlobalSkill[] => {
    return globalSkills.filter(s => s.parentSkillId === parentSkillId);
  };

  const refetchGlobalSkills = async () => {
    try {
      setGlobalSkillsLoading(true);
      const response = await fetch("/api/global-skills", { credentials: "include" });
      const data = await response.json();
      if (Array.isArray(data)) {
        setGlobalSkills(data);
      }
    } catch (error) {
      console.error("Error refetching global skills:", error);
    } finally {
      setGlobalSkillsLoading(false);
    }
  };

  const createGlobalSkill = async (
    name: string, 
    areaId?: string, 
    projectId?: string, 
    parentSkillId?: string
  ): Promise<GlobalSkill | null> => {
    console.log('[createGlobalSkill] Creating skill:', name, 'areaId:', areaId, 'projectId:', projectId);
    try {
      const response = await fetch("/api/global-skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, areaId, projectId, parentSkillId }),
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        console.error("Error creating global skill:", error);
        return null;
      }
      const newSkill = await response.json();
      console.log('[createGlobalSkill] Created skill:', newSkill);
      setGlobalSkills(prev => [...prev, newSkill]);
      // Dispatch event to notify other components
      window.dispatchEvent(new Event('globalSkillCreated'));
      return newSkill;
    } catch (error) {
      console.error("Error creating global skill:", error);
      return null;
    }
  };

  const updateGlobalSkillName = async (id: string, name: string): Promise<GlobalSkill | null> => {
    try {
      const response = await fetch(`/api/global-skills/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
        credentials: "include",
      });
      if (!response.ok) return null;
      const updated = await response.json();
      setGlobalSkills(prev => prev.map(s => s.id === id ? updated : s));
      return updated;
    } catch (error) {
      console.error("Error updating global skill:", error);
      return null;
    }
  };

  const addXpToGlobalSkill = async (id: string, xpAmount: number): Promise<GlobalSkill | null> => {
    try {
      const response = await fetch(`/api/global-skills/${id}/add-xp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xpAmount }),
        credentials: "include",
      });
      if (!response.ok) return null;
      const updated = await response.json();
      // Refetch all skills to get updated parent XP too
      await refetchGlobalSkills();
      return updated;
    } catch (error) {
      console.error("Error adding XP to global skill:", error);
      return null;
    }
  };

  const deleteGlobalSkill = async (id: string): Promise<void> => {
    try {
      const deleteResponse = await fetch(`/api/global-skills/${id}`, { method: "DELETE", credentials: "include" });
      if (!deleteResponse.ok) {
        const errorData = await deleteResponse.json().catch(() => ({}));
        throw new Error(errorData.message || `Error al eliminar global skill: ${deleteResponse.status}`);
      }
      // Remove skill and its children from state
      setGlobalSkills(prev => prev.filter(s => s.id !== id && s.parentSkillId !== id));
    } catch (error) {
      console.error("Error deleting global skill:", error);
      alert(`Error al eliminar global skill: ${error instanceof Error ? error.message : "Error desconocido"}`);
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
      archiveArea,
      unarchiveArea,
      renameArea,
      archivedAreas,
      loadArchivedAreas,
      activeArea,
      isLoading,
      projects,
      mainQuests,
      activeProjectId,
      setActiveProjectId: handleSetActiveProjectId,
      activeProject,
      createProject,
      deleteProject,
      archiveProject,
      unarchiveProject,
      renameProject,
      archivedProjects,
      archivedMainQuests,
      loadArchivedProjects,
      activeParentSkillId,
      parentSkillStack,
      subSkills,
      enterSubSkillTree,
      exitSubSkillTree,
      toggleSubSkillStatus,
      updateSubSkill,
      deleteSubSkill,
      deleteSubSkillTree,
      toggleSubSkillLock,
      moveSubSkill,
      addSkillBelow,
      addProjectSkillBelow,
      addSubSkillBelow,
      moveSkillToLevel,
      reorderSkillWithinLevel,
      moveProjectSkillToLevel,
      reorderProjectSkillWithinLevel,
      duplicateSkill,
      duplicateProjectSkill,
      duplicateSubSkill,
      updateLevelSubtitle,
      updateProjectLevelSubtitle,
      toggleFinalNode,
      toggleProjectFinalNode,
      toggleSubSkillFinalNode,
      showLevelUp,
      levelUpNumber,
      showCompleted,
      showQuestUpdated,
      sideQuests,
      archivedSideQuests,
      createSideQuest,
      emergentQuests,
      archivedEmergentQuests,
      createEmergentQuest,
      experienceQuests,
      archivedExperienceQuests,
      createExperienceQuest,
      // Global Skills
      globalSkills,
      globalSkillsLoading,
      getGlobalSkillsForArea,
      getGlobalSkillsForProject,
      getSubSkillsOf,
      createGlobalSkill,
      updateGlobalSkillName,
      addXpToGlobalSkill,
      deleteGlobalSkill,
      refetchGlobalSkills
    }}>
      {children}
    </SkillTreeContext.Provider>
  );
}

/**
 * Calculate the rolling 5-level window for the Skill Designer.
 * Window shows: [active-1, active, active+1, active+2, active+3]
 * At end-of-area with fewer than 5 levels, shows last 5 available levels.
 * 
 * @param unlockedLevel The currently unlocked (active) level
 * @param nextLevelToAssign The next level to create (max level + 1)
 * @param endOfAreaLevel If set, marks the last available level (no more generation)
 * @returns Array of level numbers to display in the window
 */
/**
 * Calculates which levels should be displayed in the Designer accordion
 * Returns a 5-level window centered on the unlocked level
 * 
 * @param unlockedLevel The current playable level (what user has achieved)
 * @param nextLevelToAssign The next level number to create (max level + 1)
 * @param endOfAreaLevel Optional cap on the maximum level for this area
 * 
 * IMPORTANT: Window calculation uses the SAME visibility rule as SkillDesigner
 * Maximum visible = endOfAreaLevel ?? (nextLevelToAssign + 2)
 * This ensures consistency: levels beyond this show as locked in both views
 * 
 * Example: unlockedLevel=2, nextLevelToAssign=5
 *   -> maxLevelInDesigner = 5 + 2 = 7
 *   -> Window = [1, 2, 3, 4, 5] (5 levels centered on unlocked)
 *   -> Levels 6-7 can be created but are shown as locked/future
 */
export function calculateDesignerLevelWindow(
  unlockedLevel: number,
  nextLevelToAssign: number,
  endOfAreaLevel?: number
): number[] {
  // Determine the maximum level visible in Designer
  // Consistent with SkillDesigner visibility: endOfAreaLevel ?? (nextLevelToAssign + 2)
  const maxLevelInDesigner = endOfAreaLevel ?? (nextLevelToAssign + 2);
  
  // Calculate the ideal window: [unlockedLevel-1, unlockedLevel, unlockedLevel+1, unlockedLevel+2, unlockedLevel+3]
  let windowStart = Math.max(1, unlockedLevel - 1);
  let windowEnd = unlockedLevel + 3;
  
  // If total available levels < 5, adjust to show last 5 or all available
  const totalAvailable = maxLevelInDesigner;
  if (totalAvailable < 5) {
    // Show all available levels if less than 5
    windowStart = 1;
    windowEnd = totalAvailable;
  } else {
    // Ensure window doesn't exceed max available level
    windowEnd = Math.min(windowEnd, maxLevelInDesigner);
    // If adjusted end is less than 5 levels, shift window back to ensure 5 levels
    if (windowEnd - windowStart + 1 < 5) {
      windowStart = Math.max(1, windowEnd - 4);
    }
  }
  
  console.log('[window] unlockedLevel:', unlockedLevel, 'nextLevelToAssign:', nextLevelToAssign, 'maxLevelInDesigner:', maxLevelInDesigner, 'windowStart:', windowStart, 'windowEnd:', windowEnd);
  
  const levels: number[] = [];
  for (let i = windowStart; i <= windowEnd; i++) {
    levels.push(i);
  }
  return levels;
}

export function useSkillTree() {
  const context = useContext(SkillTreeContext);
  if (!context) throw new Error("useSkillTree must be used within SkillTreeProvider");
  return context;
}

export { iconMap };
