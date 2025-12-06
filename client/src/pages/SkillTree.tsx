import { SkillTreeProvider, useSkillTree } from "@/lib/skill-context";
import { AreaMenu } from "@/components/AreaMenu";
import { SkillNode } from "@/components/SkillNode";
import { SkillConnection } from "@/components/SkillConnection";
import { motion, AnimatePresence } from "framer-motion";

function SkillCanvas() {
  const { activeArea, toggleSkillStatus } = useSkillTree();

  if (!activeArea) return null;

  const visibleSkills = activeArea.skills.filter(s => s.level <= activeArea.unlockedLevel);

  const maxY = Math.max(...visibleSkills.map(s => s.y), 400);
  const containerHeight = maxY + 200;

  return (
    <div className="flex-1 relative overflow-hidden bg-background flex flex-col">
      <div className="flex-1 overflow-y-auto p-8 scroll-smooth">
        <div className="w-full relative max-w-4xl mx-auto mt-10 min-h-full">
          
          <div className="absolute top-0 left-0 z-10 sticky">
            <h2 className="text-2xl font-bold tracking-tight mb-1">
              {activeArea.name}
            </h2>
            <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
              {activeArea.description}
            </p>
          </div>

          <div 
            className="relative w-full mt-20 transition-all duration-500 ease-in-out"
            style={{ height: `${containerHeight}px`, minHeight: "600px" }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={activeArea.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="w-full h-full relative"
              >
                {/* Connections */}
                {visibleSkills.map(skill => {
                  return skill.dependencies.map(depId => {
                    const depSkill = visibleSkills.find(s => s.id === depId);
                    if (!depSkill) return null;

                    const isActive = depSkill.status === "mastered";

                    return (
                      <SkillConnection
                        key={`${depSkill.id}-${skill.id}`}
                        start={depSkill}
                        end={skill}
                        active={isActive}
                        areaColor={activeArea.color}
                      />
                    );
                  });
                })}

                {/* Nodes */}
                {visibleSkills.map(skill => (
                  <SkillNode
                    key={skill.id}
                    skill={skill}
                    areaColor={activeArea.color}
                    onClick={() => toggleSkillStatus(activeArea.id, skill.id)}
                  />
                ))}
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
    <SkillTreeProvider>
      <div className="flex h-screen w-full bg-background text-foreground overflow-hidden font-body selection:bg-primary/30">
        <AreaMenu />
        <SkillCanvas />
      </div>
    </SkillTreeProvider>
  );
}
