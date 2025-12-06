import { SkillTreeProvider, useSkillTree } from "@/lib/skill-context";
import { AreaMenu } from "@/components/AreaMenu";
import { SkillNode } from "@/components/SkillNode";
import { SkillConnection } from "@/components/SkillConnection";
import { motion, AnimatePresence } from "framer-motion";

function SkillCanvas() {
  const { activeArea, toggleSkillStatus } = useSkillTree();

  if (!activeArea) return null;

  // Calculate the required height based on the lowest node
  // We add some padding (e.g. + 20%) to ensure the last node isn't at the very edge
  const maxY = Math.max(...activeArea.skills.map(s => s.y), 80);
  const containerHeight = Math.max(100, maxY + 20);

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
            style={{ height: `${containerHeight}%`, minHeight: "600px" }}
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
                {activeArea.skills.map(skill => {
                  return skill.dependencies.map(depId => {
                    const depSkill = activeArea.skills.find(s => s.id === depId);
                    if (!depSkill) return null;

                    // Line is active if the dependency is mastered (meaning path is open)
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
                {activeArea.skills.map(skill => (
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
