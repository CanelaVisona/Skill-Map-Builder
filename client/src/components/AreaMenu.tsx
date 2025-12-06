import { useSkillTree } from "@/lib/skill-context";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Checkbox } from "./ui/checkbox";
import { useForm } from "react-hook-form";
import { useState } from "react";

export function AreaMenu() {
  const { areas, activeAreaId, setActiveAreaId, addSkill, activeArea } = useSkillTree();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  
  const { register, handleSubmit, reset, setValue, watch } = useForm({
    defaultValues: {
      title: "",
      description: "",
      locked: false
    }
  });

  const onSubmit = (data: any) => {
    // Find the last skill to calculate position and dependency
    let lastSkill = null;
    let newY = 20; // Default start position if no skills exist

    if (activeArea && activeArea.skills.length > 0) {
      // Assuming skills are sorted by creation or we just take the last one in the array
      // Since we want a linear tree, the last one in the array is the "bottom" one
      lastSkill = activeArea.skills[activeArea.skills.length - 1];
      newY = lastSkill.y + 20; // Add 20% vertical spacing
    }

    addSkill(activeAreaId, {
      title: data.title,
      description: data.description,
      x: 50, // Always center
      y: newY,
      status: data.locked ? "locked" : "available",
      dependencies: lastSkill ? [lastSkill.id] : []
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
          const Icon = area.icon;
          
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
      </div>

      <div className="p-2 border-t border-border">
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button 
              variant="outline" 
              size={isOpen ? "default" : "icon"}
              className={cn(
                "w-full border-dashed border-border bg-transparent text-muted-foreground hover:text-foreground",
                !isOpen && "aspect-square p-0"
              )}
            >
              <Plus className={cn("h-4 w-4", isOpen && "mr-2")} /> 
              {isOpen && "Add Skill"}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>New Skill Node</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="title">Skill Name</Label>
                <Input id="title" {...register("title", { required: true })} placeholder="e.g. Advanced Picking" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" {...register("description")} placeholder="Short description of goal" />
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox 
                  id="locked" 
                  onCheckedChange={(checked) => setValue("locked", checked as boolean)} 
                />
                <Label htmlFor="locked" className="cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Start as Locked
                </Label>
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


