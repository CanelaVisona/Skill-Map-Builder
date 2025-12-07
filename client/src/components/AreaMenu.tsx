import { useSkillTree, iconMap } from "@/lib/skill-context";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { useState } from "react";

export function AreaMenu() {
  const { areas, activeAreaId, setActiveAreaId } = useSkillTree();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isOpen, setIsOpen] = useState(true);

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
              {isOpen && "Agregar"}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Agregar Nuevo</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <Button 
                  variant="outline" 
                  className="h-24 flex flex-col gap-2"
                  onClick={() => {
                    setIsAddOpen(false);
                  }}
                >
                  <Plus className="h-6 w-6" />
                  <span>Nueva Área</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-24 flex flex-col gap-2"
                  onClick={() => {
                    setIsAddOpen(false);
                  }}
                >
                  <Plus className="h-6 w-6" />
                  <span>Nuevo Proyecto</span>
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </motion.div>
  );
}


