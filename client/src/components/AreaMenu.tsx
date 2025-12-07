import { useSkillTree, iconMap } from "@/lib/skill-context";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { useForm } from "react-hook-form";
import { useState } from "react";

export function AreaMenu() {
  const { areas, activeAreaId, setActiveAreaId, addSkill, activeArea } = useSkillTree();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  
  const { register, handleSubmit, reset } = useForm({
    defaultValues: {
      title: "",
      description: ""
    }
  });

  const currentLevel = activeArea?.nextLevelToAssign || 1;
  const skillsInCurrentLevel = activeArea?.skills.filter(s => s.level === currentLevel) || [];
  const currentLevelNodeCount = skillsInCurrentLevel.length;
  const isLevelFull = currentLevelNodeCount >= 5;

  const onSubmit = (data: any) => {
    if (!activeArea) return;
    
    const levelToAssign = activeArea.nextLevelToAssign;
    const skillsInLevel = activeArea.skills.filter(s => s.level === levelToAssign);
    
    let lastSkill = null;
    let newY = 100;

    if (skillsInLevel.length > 0) {
      lastSkill = skillsInLevel.reduce((max, s) => s.y > max.y ? s : max, skillsInLevel[0]);
      newY = lastSkill.y + 150;
    } else if (activeArea.skills.length > 0) {
      const lastSkillOverall = activeArea.skills.reduce((max, s) => s.y > max.y ? s : max, activeArea.skills[0]);
      newY = lastSkillOverall.y + 150;
      lastSkill = lastSkillOverall;
    }

    // Server enforces: position 1 = available, positions 2-5 = locked
    addSkill(activeAreaId, {
      areaId: activeAreaId,
      title: data.title,
      description: data.description,
      x: 50,
      y: newY,
      status: "available",
      dependencies: lastSkill ? [lastSkill.id] : [],
      level: levelToAssign
    });
    
    reset();
    setIsAddOpen(false);
  };

  return (
    <motion.div 
      initial={{ width: 256 }}
      animate={{ width: isOpen ? 256 : 60 }}
      className="h-full border-r border-border bg-card/50 backdrop-blur-xl flex flex-col z-30 relative transition-all duration-300 ease-in-out"
    >
      <div className="p-4 flex items-center justify-between border-b border-border h-[60px]">
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="overflow-hidden whitespace-nowrap"
            >
              <h1 className="text-lg font-bold tracking-tight">
                NEXUS
              </h1>
            </motion.div>
          )}
        </AnimatePresence>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setIsOpen(!isOpen)}
          className="ml-auto"
        >
          {isOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto py-2 space-y-1 px-2">
        {areas.map((area) => {
          const isActive = area.id === activeAreaId;
          const Icon = iconMap[area.icon] || iconMap.Home;
          
          return (
            <button
              key={area.id}
              onClick={() => setActiveAreaId(area.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 group relative overflow-hidden",
                isActive 
                  ? "bg-primary/10 text-primary" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                !isOpen && "justify-center px-2"
              )}
            >
              {isActive && isOpen && (
                <motion.div
                  layoutId="activeIndicator"
                  className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary"
                />
              )}
              
              <Icon size={18} className={cn("shrink-0", isActive ? "text-primary" : "group-hover:text-foreground")} />
              
              {isOpen && (
                <motion.span 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="font-medium text-sm truncate"
                >
                  {area.name}
                </motion.span>
              )}
            </button>
          );
        })}

        <div className="my-3 border-t border-border" />

        {isOpen && (
          <div className="px-3 py-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Proyectos
            </span>
          </div>
        )}

        <div className="text-xs text-muted-foreground px-3 py-2 italic">
          {isOpen ? "Sin proyectos aún" : "—"}
        </div>
      </div>

      <div className="p-2 border-t border-border space-y-2">
        {isOpen && activeArea && (
          <div className="text-xs text-muted-foreground px-2 py-1 text-center">
            Nivel {currentLevel}: {currentLevelNodeCount}/5 nodos
          </div>
        )}
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button 
              variant="outline" 
              size={isOpen ? "default" : "icon"}
              disabled={isLevelFull}
              className={cn(
                "w-full border-dashed border-border bg-transparent text-muted-foreground hover:text-foreground",
                !isOpen && "aspect-square p-0",
                isLevelFull && "opacity-50 cursor-not-allowed"
              )}
            >
              <Plus className={cn("h-4 w-4", isOpen && "mr-2")} /> 
              {isOpen && (isLevelFull ? "Nivel completo" : "Add Skill")}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>New Skill Node</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
              <div className="text-sm text-muted-foreground">
                Nivel {currentLevel} - Posicion {currentLevelNodeCount + 1}/5
                {currentLevelNodeCount === 4 && (
                  <span className="ml-2 text-yellow-500">(Nodo Final)</span>
                )}
                {currentLevelNodeCount > 0 && currentLevelNodeCount < 4 && (
                  <span className="ml-2 text-muted-foreground/60">(Iniciara bloqueado)</span>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Skill Name</Label>
                <Input id="title" {...register("title", { required: true })} placeholder="e.g. Advanced Picking" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" {...register("description")} placeholder="Short description of goal" />
              </div>
              <Button type="submit" className="w-full">
                Initialize Node
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </motion.div>
  );
}


