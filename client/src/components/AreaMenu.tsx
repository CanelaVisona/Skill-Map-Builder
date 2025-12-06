import { useSkillTree } from "@/lib/skill-context";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { useForm } from "react-hook-form";
import { useState } from "react";

export function AreaMenu() {
  const { areas, activeAreaId, setActiveAreaId, addSkill } = useSkillTree();
  const [isAddOpen, setIsAddOpen] = useState(false);
  
  const { register, handleSubmit, reset } = useForm();

  const onSubmit = (data: any) => {
    // Random position for new skills for now, near center
    const randomX = 40 + Math.random() * 20;
    const randomY = 40 + Math.random() * 20;
    
    addSkill(activeAreaId, {
      title: data.title,
      description: data.description,
      x: randomX,
      y: randomY,
      dependencies: [] // New skills have no deps by default in this simple UI
    });
    reset();
    setIsAddOpen(false);
  };

  return (
    <div className="w-64 h-full border-r border-white/10 bg-black/20 backdrop-blur-xl flex flex-col z-30">
      <div className="p-6 border-b border-white/10">
        <h1 className="text-2xl font-display font-bold text-white tracking-widest glow-text">
          NEXUS
        </h1>
        <p className="text-xs text-muted-foreground mt-1 font-mono">
          SKILL TRACKING SYSTEM v1.0
        </p>
      </div>

      <div className="flex-1 overflow-y-auto py-4 space-y-2 px-3">
        {areas.map((area) => {
          const isActive = area.id === activeAreaId;
          const Icon = area.icon;
          
          return (
            <button
              key={area.id}
              onClick={() => setActiveAreaId(area.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-300 group relative overflow-hidden",
                isActive 
                  ? "bg-white/5 text-white border border-white/10" 
                  : "text-muted-foreground hover:text-white hover:bg-white/5"
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="activeIndicator"
                  className={cn("absolute left-0 top-0 bottom-0 w-1", area.color.replace("text-", "bg-"))}
                />
              )}
              
              <Icon size={18} className={cn("transition-colors", isActive ? area.color : "opacity-50 group-hover:opacity-100")} />
              <span className="font-display tracking-wide text-sm">{area.name}</span>
              
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              )}
            </button>
          );
        })}
      </div>

      <div className="p-4 border-t border-white/10">
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full border-dashed border-white/20 hover:border-white/50 bg-transparent text-muted-foreground hover:text-white">
              <Plus className="mr-2 h-4 w-4" /> Add Skill
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card/95 backdrop-blur-xl border-white/10 text-white">
            <DialogHeader>
              <DialogTitle className="font-display tracking-wider">New Skill Node</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="title">Skill Name</Label>
                <Input id="title" {...register("title", { required: true })} className="bg-black/20 border-white/10" placeholder="e.g. Advanced Picking" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" {...register("description")} className="bg-black/20 border-white/10" placeholder="Short description of goal" />
              </div>
              <Button type="submit" className="w-full bg-primary text-primary-foreground font-display hover:bg-primary/90">
                Initialize Node
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
