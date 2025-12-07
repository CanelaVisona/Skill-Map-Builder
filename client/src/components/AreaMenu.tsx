import { useSkillTree, iconMap } from "@/lib/skill-context";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, PanelLeftClose, PanelLeftOpen, Music, Trophy, BookOpen, Home, Dumbbell, Briefcase, Heart, Utensils, Palette, Code, Gamepad2, Camera } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { useState } from "react";

type DialogStep = "choose" | "new-area" | "new-project";

const iconKeywords: Record<string, string[]> = {
  Music: ["música", "musica", "guitarra", "guitar", "piano", "canto", "instrumento", "song", "canción"],
  Trophy: ["deporte", "fútbol", "futbol", "football", "soccer", "basket", "tenis", "competencia", "ganador", "winner"],
  BookOpen: ["libro", "lectura", "literatura", "leer", "estudio", "study", "book", "reading"],
  Home: ["casa", "hogar", "home", "limpieza", "cocina", "organización"],
  Dumbbell: ["gym", "gimnasio", "ejercicio", "fitness", "workout", "peso", "músculo"],
  Briefcase: ["trabajo", "work", "negocio", "business", "empleo", "carrera", "profesional"],
  Heart: ["salud", "health", "bienestar", "meditación", "yoga", "mental"],
  Utensils: ["cocina", "cooking", "recetas", "chef", "comida", "food"],
  Palette: ["arte", "art", "pintura", "dibujo", "diseño", "design", "creatividad"],
  Code: ["programación", "código", "code", "software", "web", "desarrollo", "developer"],
  Gamepad2: ["juegos", "gaming", "videojuegos", "game"],
  Camera: ["foto", "fotografía", "photography", "video", "film"]
};

function getIconForTitle(title: string): string {
  const lowerTitle = title.toLowerCase();
  for (const [iconName, keywords] of Object.entries(iconKeywords)) {
    if (keywords.some(keyword => lowerTitle.includes(keyword))) {
      return iconName;
    }
  }
  return "Home";
}

const extendedIconMap: Record<string, any> = {
  ...iconMap,
  Dumbbell,
  Briefcase,
  Heart,
  Utensils,
  Palette,
  Code,
  Gamepad2,
  Camera
};

export function AreaMenu() {
  const { areas, activeAreaId, setActiveAreaId, createArea } = useSkillTree();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [dialogStep, setDialogStep] = useState<DialogStep>("choose");
  const [areaName, setAreaName] = useState("");
  const [areaDescription, setAreaDescription] = useState("");

  const handleDialogClose = (open: boolean) => {
    setIsAddOpen(open);
    if (!open) {
      setDialogStep("choose");
      setAreaName("");
      setAreaDescription("");
    }
  };

  const handleCreateArea = async () => {
    if (!areaName.trim()) return;
    
    const icon = getIconForTitle(areaName);
    await createArea(areaName.trim(), areaDescription.trim(), icon);
    
    setIsAddOpen(false);
    setDialogStep("choose");
    setAreaName("");
    setAreaDescription("");
  };

  const detectedIcon = getIconForTitle(areaName);
  const DetectedIconComponent = extendedIconMap[detectedIcon] || Home;

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
          const Icon = extendedIconMap[area.icon] || extendedIconMap.Home;
          
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
        <Dialog open={isAddOpen} onOpenChange={handleDialogClose}>
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
            {dialogStep === "choose" && (
              <>
                <DialogHeader>
                  <DialogTitle>Agregar Nuevo</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Button 
                      variant="outline" 
                      className="h-24 flex flex-col gap-2"
                      onClick={() => setDialogStep("new-area")}
                      data-testid="button-new-area"
                    >
                      <Plus className="h-6 w-6" />
                      <span>Nueva Área</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="h-24 flex flex-col gap-2"
                      onClick={() => setDialogStep("new-project")}
                      data-testid="button-new-project"
                    >
                      <Plus className="h-6 w-6" />
                      <span>Nuevo Proyecto</span>
                    </Button>
                  </div>
                </div>
              </>
            )}

            {dialogStep === "new-area" && (
              <>
                <DialogHeader>
                  <DialogTitle>Nueva Área</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <DetectedIconComponent size={20} className="text-primary" />
                    </div>
                    <span className="text-sm text-muted-foreground">
                      Icono detectado automáticamente
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="area-name">Título</Label>
                    <Input 
                      id="area-name" 
                      value={areaName}
                      onChange={(e) => setAreaName(e.target.value)}
                      placeholder="ej: Guitarra, Cocina, Programación..."
                      data-testid="input-area-name"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="area-description">Descripción</Label>
                    <Textarea 
                      id="area-description" 
                      value={areaDescription}
                      onChange={(e) => setAreaDescription(e.target.value)}
                      placeholder="Describe brevemente esta área de desarrollo"
                      rows={3}
                      data-testid="input-area-description"
                    />
                  </div>
                  
                  <div className="flex gap-2 pt-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setDialogStep("choose")}
                      className="flex-1"
                    >
                      Atrás
                    </Button>
                    <Button 
                      onClick={handleCreateArea}
                      disabled={!areaName.trim()}
                      className="flex-1"
                      data-testid="button-create-area"
                    >
                      Hecho
                    </Button>
                  </div>
                </div>
              </>
            )}

            {dialogStep === "new-project" && (
              <>
                <DialogHeader>
                  <DialogTitle>Nuevo Proyecto</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <p className="text-sm text-muted-foreground">
                    Los proyectos estarán disponibles próximamente.
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={() => setDialogStep("choose")}
                    className="w-full"
                  >
                    Atrás
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </motion.div>
  );
}
