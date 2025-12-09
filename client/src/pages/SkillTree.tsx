import { SkillTreeProvider, useSkillTree, type Skill } from "@/lib/skill-context";
import { AreaMenu } from "@/components/AreaMenu";
import { SkillNode } from "@/components/SkillNode";
import { SkillConnection } from "@/components/SkillConnection";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Sun, Moon, BookOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { DiaryProvider, useDiary } from "@/lib/diary-context";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

function TopRightControls() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const currentTheme = resolvedTheme || theme;
  const { openDiary } = useDiary();
  
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3">
      <button
        className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
        onClick={() => setTheme(currentTheme === "dark" ? "light" : "dark")}
        data-testid="button-theme-toggle"
      >
        {currentTheme === "dark" ? (
          <Sun className="h-5 w-5" />
        ) : (
          <Moon className="h-5 w-5" />
        )}
      </button>
      <button
        className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
        onClick={openDiary}
        data-testid="button-diary-toggle"
        title="Quest Diary"
      >
        <BookOpen className="h-5 w-5" />
      </button>
    </div>
  );
}

function QuestDiary() {
  const { isDiaryOpen, closeDiary } = useDiary();
  const { activeArea, activeProject, subSkills, activeParentSkillId } = useSkillTree();
  
  const activeItem = activeArea || activeProject;
  const skills = activeParentSkillId 
    ? subSkills 
    : (activeItem?.skills || []);
  
  const skillsWithFeedback = skills.filter(s => s.feedback && s.title.toLowerCase() !== "inicio");
  
  return (
    <Dialog open={isDiaryOpen} onOpenChange={(open) => !open && closeDiary()}>
      <DialogContent className="max-w-2xl h-[80vh] p-0 overflow-hidden bg-amber-50 dark:bg-stone-900 border-amber-200 dark:border-amber-900">
        <div className="relative h-full flex flex-col">
          <div className="bg-amber-100 dark:bg-stone-800 border-b border-amber-200 dark:border-amber-900 px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-amber-900 dark:text-amber-100 flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Quest Diary
            </h2>
            <span className="text-sm text-amber-700 dark:text-amber-300">
              {activeItem?.name || "Sin área seleccionada"}
            </span>
          </div>
          
          <ScrollArea className="flex-1 p-6">
            {skillsWithFeedback.length === 0 ? (
              <div className="text-center text-amber-700 dark:text-amber-400 py-12">
                <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay notas en tu diario todavía.</p>
                <p className="text-sm mt-2 opacity-70">Agrega feedback a tus tareas para verlas aquí.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {skillsWithFeedback.map((skill) => (
                  <div 
                    key={skill.id}
                    className="flex gap-4 p-4 bg-white dark:bg-stone-800 rounded-lg border border-amber-200 dark:border-amber-800 shadow-sm"
                    data-testid={`diary-entry-${skill.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-amber-900 dark:text-amber-100 truncate">
                        {skill.title}
                      </h3>
                      {skill.description && (
                        <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 line-clamp-1">
                          {skill.description}
                        </p>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 pl-4 border-l border-amber-200 dark:border-amber-700">
                      <p className="text-sm text-amber-800 dark:text-amber-200 italic leading-relaxed">
                        "{skill.feedback}"
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}


function SkillCanvas() {
  const { 
    activeArea, 
    activeProject, 
    toggleSkillStatus, 
    toggleProjectSkillStatus,
    activeParentSkillId,
    parentSkillStack,
    subSkills,
    exitSubSkillTree,
    toggleSubSkillStatus,
    showLevelUp
  } = useSkillTree();

  const activeItem = activeArea || activeProject;
  const isProject = !activeArea && !!activeProject;
  const isSubSkillView = !!activeParentSkillId;

  // Helper function to calculate visible levels dynamically
  // The lowest level is always visible
  // Level N is visible only if the final node (highest Y) of the previous level is mastered
  const calculateVisibleLevels = (skills: Skill[]): Set<number> => {
    const visibleLevels = new Set<number>();
    
    // Group skills by level
    const levelMap = new Map<number, Skill[]>();
    skills.forEach(skill => {
      if (!levelMap.has(skill.level)) {
        levelMap.set(skill.level, []);
      }
      levelMap.get(skill.level)!.push(skill);
    });
    
    // Get sorted levels
    const sortedLevels = Array.from(levelMap.keys()).sort((a, b) => a - b);
    
    if (sortedLevels.length === 0) return visibleLevels;
    
    // The first (lowest) level is always visible
    const firstLevel = sortedLevels[0];
    visibleLevels.add(firstLevel);
    
    // For each subsequent level, check if the final node of the previous level is mastered
    for (let i = 1; i < sortedLevels.length; i++) {
      const currentLevel = sortedLevels[i];
      const previousLevel = sortedLevels[i - 1];
      
      const previousLevelSkills = levelMap.get(previousLevel);
      if (previousLevelSkills && previousLevelSkills.length > 0) {
        // Find the final node (highest Y position) of previous level
        const finalNodeOfPreviousLevel = previousLevelSkills.reduce(
          (max, s) => s.y > max.y ? s : max,
          previousLevelSkills[0]
        );
        
        // Only show this level if the final node of previous level is mastered
        if (finalNodeOfPreviousLevel.status === "mastered") {
          visibleLevels.add(currentLevel);
        } else {
          // Stop checking further levels since this level is not visible
          break;
        }
      }
    }
    
    return visibleLevels;
  };

  if (isSubSkillView) {
    const currentParent = parentSkillStack[parentSkillStack.length - 1];
    
    // Apply the same visibility logic to sub-skills
    const subSkillVisibleLevels = calculateVisibleLevels(subSkills);
    const visibleSkills = subSkills.filter(s => subSkillVisibleLevels.has(s.level));

    const firstSkillOfLevel = new Set<string>();
    const levelGroups = new Map<number, typeof visibleSkills>();
    
    visibleSkills.forEach(skill => {
      if (!levelGroups.has(skill.level)) {
        levelGroups.set(skill.level, []);
      }
      levelGroups.get(skill.level)!.push(skill);
    });
    
    levelGroups.forEach((skills) => {
      const firstSkill = skills.reduce((min, s) => s.y < min.y ? s : min, skills[0]);
      if (firstSkill) {
        firstSkillOfLevel.add(firstSkill.id);
      }
    });

    const maxY = visibleSkills.length > 0 ? Math.max(...visibleSkills.map(s => s.y), 400) : 400;
    const containerHeight = maxY + 200;

    return (
      <div className="flex-1 relative overflow-hidden bg-background flex flex-col">
        <AnimatePresence>
          {showLevelUp && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.span
                className="text-4xl font-bold tracking-widest uppercase text-foreground"
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -100, opacity: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              >
                level up
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex-1 overflow-y-auto p-8 scroll-smooth">
          <div className="w-full relative max-w-4xl mx-auto mt-10 min-h-full">
            
            <div className="absolute top-0 left-0 z-10 sticky">
              <div className="flex items-center gap-3 mb-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={exitSubSkillTree}
                  data-testid="button-back"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <h2 className="text-2xl font-bold tracking-tight">
                  {currentParent?.title || "Sub-Skills"}
                </h2>
              </div>
              <p className="text-muted-foreground max-w-md text-sm leading-relaxed ml-11">
                Sub-habilidades de {currentParent?.title}
              </p>
            </div>

            <div 
              className="relative w-full mt-20 transition-all duration-500 ease-in-out"
              style={{ height: `${containerHeight}px`, minHeight: "600px" }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeParentSkillId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4 }}
                  className="w-full h-full relative"
                >
                  {Array.from(levelGroups.entries()).flatMap(([level, skills]) => {
                    const sortedByY = [...skills].sort((a, b) => a.y - b.y);
                    const connections = [];
                    const itemColor = "text-zinc-800 dark:text-zinc-200";
                    
                    for (let i = 0; i < sortedByY.length - 1; i++) {
                      const parentSkill = sortedByY[i];
                      const childSkill = sortedByY[i + 1];
                      const isActive = parentSkill.status === "mastered";
                      
                      connections.push(
                        <SkillConnection
                          key={`${parentSkill.id}-${childSkill.id}`}
                          start={parentSkill}
                          end={childSkill}
                          active={isActive}
                          areaColor={itemColor}
                        />
                      );
                    }
                    
                    return connections;
                  })}

                  {visibleSkills.map(skill => {
                    const itemColor = "text-zinc-800 dark:text-zinc-200";
                    const handleClick = () => toggleSubSkillStatus(skill.id);
                    return (
                      <SkillNode
                        key={skill.id}
                        skill={skill}
                        areaColor={itemColor}
                        onClick={handleClick}
                        isFirstOfLevel={firstSkillOfLevel.has(skill.id)}
                      />
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!activeItem) return null;

  const visibleLevels = calculateVisibleLevels(activeItem.skills);
  const visibleSkills = activeItem.skills.filter(s => visibleLevels.has(s.level));

  // Find the first skill of each level (lowest Y position per level)
  const firstSkillOfLevel = new Set<string>();
  const levelGroups = new Map<number, typeof visibleSkills>();
  
  visibleSkills.forEach(skill => {
    if (!levelGroups.has(skill.level)) {
      levelGroups.set(skill.level, []);
    }
    levelGroups.get(skill.level)!.push(skill);
  });
  
  levelGroups.forEach((skills) => {
    const firstSkill = skills.reduce((min, s) => s.y < min.y ? s : min, skills[0]);
    if (firstSkill) {
      firstSkillOfLevel.add(firstSkill.id);
    }
  });

  const maxY = Math.max(...visibleSkills.map(s => s.y), 400);
  const containerHeight = maxY + 200;

  return (
    <div className="flex-1 relative overflow-hidden bg-background flex flex-col">
      <AnimatePresence>
        {showLevelUp && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.span
              className="text-4xl font-bold tracking-widest uppercase text-foreground"
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -100, opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              level up
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex-1 overflow-y-auto p-8 scroll-smooth">
        <div className="w-full relative max-w-4xl mx-auto mt-10 min-h-full">
          
          <div className="absolute top-0 left-0 z-10 sticky">
            <h2 className="text-2xl font-bold tracking-tight mb-1">
              {activeItem.name}
            </h2>
            <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
              {activeItem.description}
            </p>
          </div>

          <div 
            className="relative w-full mt-20 transition-all duration-500 ease-in-out"
            style={{ height: `${containerHeight}px`, minHeight: "600px" }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={activeItem.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="w-full h-full relative"
              >
                {/* Connections - based on visual Y position */}
                {Array.from(levelGroups.entries()).flatMap(([level, skills]) => {
                  const sortedByY = [...skills].sort((a, b) => a.y - b.y);
                  const connections = [];
                  const itemColor = 'color' in activeItem ? (activeItem.color as string) : "text-zinc-800 dark:text-zinc-200";
                  
                  for (let i = 0; i < sortedByY.length - 1; i++) {
                    const parentSkill = sortedByY[i];
                    const childSkill = sortedByY[i + 1];
                    const isActive = parentSkill.status === "mastered";
                    
                    connections.push(
                      <SkillConnection
                        key={`${parentSkill.id}-${childSkill.id}`}
                        start={parentSkill}
                        end={childSkill}
                        active={isActive}
                        areaColor={itemColor}
                      />
                    );
                  }
                  
                  return connections;
                })}

                {/* Nodes */}
                {visibleSkills.map(skill => {
                  const itemColor = 'color' in activeItem ? (activeItem.color as string) : "text-zinc-800 dark:text-zinc-200";
                  const handleClick = isProject 
                    ? () => toggleProjectSkillStatus(activeItem.id, skill.id)
                    : () => toggleSkillStatus(activeItem.id, skill.id);
                  return (
                    <SkillNode
                      key={skill.id}
                      skill={skill}
                      areaColor={itemColor}
                      onClick={handleClick}
                      isFirstOfLevel={firstSkillOfLevel.has(skill.id)}
                    />
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SkillTreePage() {
  return (
    <DiaryProvider>
      <SkillTreeProvider>
        <div className="flex h-screen w-full bg-background text-foreground overflow-hidden font-body selection:bg-primary/30">
          <TopRightControls />
          <AreaMenu />
          <SkillCanvas />
          <QuestDiary />
        </div>
      </SkillTreeProvider>
    </DiaryProvider>
  );
}
