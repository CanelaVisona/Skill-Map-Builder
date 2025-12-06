import { SkillTreeProvider, useSkillTree } from "@/lib/skill-context";
import { AreaMenu } from "@/components/AreaMenu";
import { SkillNode } from "@/components/SkillNode";
import { SkillConnection } from "@/components/SkillConnection";
import { motion, AnimatePresence } from "framer-motion";

function SkillCanvas() {
  const { activeArea, toggleSkillStatus } = useSkillTree();

  if (!activeArea) return null;

  return (
    <div className="flex-1 relative overflow-hidden bg-background">
      {/* Grid Background */}
      <div 
        className="absolute inset-0 opacity-[0.03]" 
        style={{ 
          backgroundImage: `linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }} 
      />
      
      {/* Radial Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/20 to-background pointer-events-none" />

      <div className="absolute inset-0 p-8">
        <div className="h-full w-full relative max-w-4xl mx-auto mt-10 border border-white/5 rounded-3xl bg-black/20 backdrop-blur-sm shadow-2xl overflow-hidden">
          
          <div className="absolute top-6 left-8 z-10">
            <h2 className={`text-3xl font-display font-bold ${activeArea.color} glow-text mb-2`}>
              {activeArea.name}
            </h2>
            <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
              {activeArea.description}
            </p>
          </div>

          <div className="relative w-full h-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeArea.id}
                initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
                transition={{ duration: 0.5 }}
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
