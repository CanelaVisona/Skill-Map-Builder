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
      <DialogContent className="max-w-3xl h-[85vh] p-0 overflow-hidden border-0 bg-transparent shadow-2xl">
        <div className="relative h-full flex rounded-2xl overflow-hidden backdrop-blur-xl bg-gradient-to-br from-stone-50/95 via-amber-50/90 to-orange-50/95 dark:from-stone-950/95 dark:via-stone-900/90 dark:to-stone-950/95 border border-white/20 dark:border-white/10">
          
          <div className="absolute top-4 left-4 w-3 h-3 rounded-full bg-red-400/80 shadow-sm" />
          <div className="absolute top-4 left-9 w-3 h-3 rounded-full bg-amber-400/80 shadow-sm" />
          <div className="absolute top-4 left-14 w-3 h-3 rounded-full bg-green-400/80 shadow-sm" />
          
          <div className="flex-1 flex flex-col min-w-0">
            <div className="px-8 pt-12 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/25">
                  <BookOpen className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 dark:from-amber-400 dark:to-orange-400 bg-clip-text text-transparent">
                    Quest Diary
                  </h2>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                    {activeItem?.name || "Selecciona un área"}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mx-8 h-px bg-gradient-to-r from-transparent via-amber-300/50 dark:via-amber-600/30 to-transparent" />
            
            <ScrollArea className="flex-1 px-8 py-6">
              {skillsWithFeedback.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-stone-100 to-stone-200 dark:from-stone-800 dark:to-stone-900 mb-4">
                    <BookOpen className="h-10 w-10 text-stone-400 dark:text-stone-500" />
                  </div>
                  <p className="text-stone-600 dark:text-stone-300 font-medium">Tu diario está vacío</p>
                  <p className="text-sm text-stone-500 dark:text-stone-400 mt-1 max-w-xs">
                    Agrega notas a tus tareas y aparecerán aquí
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {skillsWithFeedback.map((skill, index) => (
                    <motion.div 
                      key={skill.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="group relative"
                      data-testid={`diary-entry-${skill.id}`}
                    >
                      <div className="absolute -left-3 top-4 w-1.5 h-1.5 rounded-full bg-amber-400 dark:bg-amber-500 opacity-60 group-hover:opacity-100 transition-opacity" />
                      
                      <div className="flex gap-6 p-4 rounded-xl bg-white/60 dark:bg-white/5 border border-stone-200/50 dark:border-white/10 hover:bg-white/80 dark:hover:bg-white/10 hover:border-amber-300/50 dark:hover:border-amber-500/30 transition-all duration-200 hover:shadow-lg hover:shadow-amber-500/5">
                        <div className="flex-shrink-0 w-1/3 min-w-0">
                          <h3 className="font-semibold text-stone-800 dark:text-stone-100 truncate text-sm">
                            {skill.title}
                          </h3>
                          {skill.description && (
                            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 line-clamp-2 leading-relaxed">
                              {skill.description}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0 pl-6 border-l border-dashed border-stone-300/50 dark:border-stone-600/50">
                          <p className="text-sm text-stone-700 dark:text-stone-200 leading-relaxed">
                            <span className="text-amber-500 dark:text-amber-400 font-serif text-lg leading-none">"</span>
                            {skill.feedback}
                            <span className="text-amber-500 dark:text-amber-400 font-serif text-lg leading-none">"</span>
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
          
          <div className="w-1 bg-gradient-to-b from-amber-200 via-amber-300 to-amber-200 dark:from-amber-900 dark:via-amber-800 dark:to-amber-900 shadow-inner" />
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
