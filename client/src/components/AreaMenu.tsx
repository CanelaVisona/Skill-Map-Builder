import { useSkillTree, iconMap, type Project } from "@/lib/skill-context";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, PanelLeftClose, PanelLeftOpen, Music, Trophy, BookOpen, Home, Dumbbell, Briefcase, Heart, Utensils, Palette, Code, Gamepad2, Camera, FolderKanban, Trash2, LogOut, Archive, ArchiveRestore, Pencil, Zap, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "./ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "./ui/alert-dialog";
import { Popover, PopoverContent, PopoverAnchor, PopoverTrigger } from "./ui/popover";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { useState, useEffect, useRef } from "react";

type DialogStep = "choose" | "new-area" | "new-project" | "new-sidequest" | "new-emergent";

const iconKeywords: Record<string, string[]> = {
  Music: ["música", "musica", "guitarra", "guitar", "piano", "canto", "instrumento", "song", "canción"],
  Trophy: ["deporte", "fútbol", "futbol", "football", "soccer", "basket", "tenis", "competencia", "ganador", "winner"],
  BookOpen: ["libro", "lectura", "literatura", "leer", "estudio", "study", "book", "reading"],
  Home: ["casa", "hogar", "home", "limpieza", "organización"],
  Dumbbell: ["gym", "gimnasio", "ejercicio", "fitness", "workout", "peso", "músculo"],
  Briefcase: ["trabajo", "work", "negocio", "business", "empleo", "carrera", "profesional"],
  Heart: ["salud", "health", "bienestar", "meditación", "yoga", "mental"],
  Utensils: ["cocina", "cooking", "recetas", "chef", "comida", "food"],
  Palette: ["arte", "art", "pintura", "dibujo", "diseño", "design", "creatividad"],
  Code: ["programación", "código", "code", "software", "web", "desarrollo", "developer"],
  Gamepad2: ["juegos", "gaming", "videojuegos", "game"],
  Camera: ["foto", "fotografía", "photography", "video", "film"]
};

const availableIcons = [
  { name: "Music", icon: Music },
  { name: "Trophy", icon: Trophy },
  { name: "BookOpen", icon: BookOpen },
  { name: "Home", icon: Home },
  { name: "Dumbbell", icon: Dumbbell },
  { name: "Briefcase", icon: Briefcase },
  { name: "Heart", icon: Heart },
  { name: "Utensils", icon: Utensils },
  { name: "Palette", icon: Palette },
  { name: "Code", icon: Code },
  { name: "Gamepad2", icon: Gamepad2 },
  { name: "Camera", icon: Camera },
  { name: "FolderKanban", icon: FolderKanban },
];

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
  Camera,
  FolderKanban
};

interface AreaItemProps {
  area: { id: string; name: string; icon: string };
  isActive: boolean;
  isMenuOpen: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onArchive: () => void;
  onRename: (newName: string) => void;
}

function AreaItem({ area, isActive, isMenuOpen, onSelect, onDelete, onArchive, onRename }: AreaItemProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [newName, setNewName] = useState(area.name);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);
  const Icon = extendedIconMap[area.icon] || extendedIconMap.Home;

  const handleTouchStart = () => {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setIsPopoverOpen(true);
    }, 1500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleMouseDown = () => {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setIsPopoverOpen(true);
    }, 1500);
  };

  const handleMouseUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isLongPress.current) {
      e.preventDefault();
      e.stopPropagation();
      isLongPress.current = false;
      return;
    }
    onSelect();
  };

  return (
    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
      <PopoverAnchor asChild>
        <button
          onClick={handleClick}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 group relative overflow-hidden touch-pan-y select-none",
            isActive 
              ? "bg-primary/10 text-primary" 
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            !isMenuOpen && "justify-center px-2"
          )}
        >
          {isActive && isMenuOpen && (
            <motion.div
              layoutId="activeIndicator"
              className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary"
            />
          )}
          
          <Icon size={18} className={cn("shrink-0", isActive ? "text-primary" : "group-hover:text-foreground")} />
          
          {isMenuOpen && (
            <motion.span 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-medium text-sm truncate"
            >
              {area.name}
            </motion.span>
          )}
        </button>
      </PopoverAnchor>
      <PopoverContent 
        side="right" 
        align="start"
        className="w-44 p-1.5 rounded-xl border border-border/50 bg-popover/95 backdrop-blur-lg shadow-xl"
      >
        <div className="flex flex-col">
          <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
            <DialogTrigger asChild>
              <button
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-foreground/80 hover:text-foreground hover:bg-muted/60 transition-colors"
                data-testid={`button-rename-area-${area.id}`}
              >
                <Pencil className="h-4 w-4 text-muted-foreground" />
                Renombrar
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Renombrar área</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <Input 
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nuevo nombre"
                  data-testid="input-rename-area"
                />
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)} className="flex-1">
                    Cancelar
                  </Button>
                  <Button 
                    onClick={() => {
                      if (newName.trim()) {
                        onRename(newName.trim());
                        setIsRenameDialogOpen(false);
                        setIsPopoverOpen(false);
                      }
                    }} 
                    disabled={!newName.trim()}
                    className="flex-1"
                    data-testid="button-save-rename-area"
                  >
                    Guardar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <button
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-foreground/80 hover:text-foreground hover:bg-muted/60 transition-colors"
            onClick={() => {
              onArchive();
              setIsPopoverOpen(false);
            }}
            data-testid={`button-archive-area-${area.id}`}
          >
            <Archive className="h-4 w-4 text-muted-foreground" />
            Archivar
          </button>
          <div className="my-1 border-t border-border/30" />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-destructive/80 hover:text-destructive hover:bg-destructive/10 transition-colors"
                data-testid={`button-delete-area-${area.id}`}
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar "{area.name}"?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción no se puede deshacer. Se eliminará permanentemente esta área y todas sus habilidades.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setIsPopoverOpen(false)}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    onDelete();
                    setIsPopoverOpen(false);
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface ProjectItemProps {
  project: Project;
  isActive: boolean;
  isMenuOpen: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onArchive: () => void;
  onRename: (newName: string) => void;
}

function ProjectItem({ project, isActive, isMenuOpen, onSelect, onDelete, onArchive, onRename }: ProjectItemProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [newName, setNewName] = useState(project.name);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);
  const Icon = extendedIconMap[project.icon] || FolderKanban;

  const handleTouchStart = () => {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setIsPopoverOpen(true);
    }, 1500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleMouseDown = () => {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setIsPopoverOpen(true);
    }, 1500);
  };

  const handleMouseUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleClick = () => {
    if (!isLongPress.current) {
      onSelect();
    }
  };

  return (
    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
      <PopoverAnchor asChild>
        <button
          onClick={handleClick}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 group relative overflow-hidden touch-pan-y select-none",
            isActive 
              ? "bg-primary/10 text-foreground" 
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            !isMenuOpen && "justify-center px-2"
          )}
          data-testid={`project-item-${project.id}`}
        >
          <Icon size={18} className={cn("shrink-0", isActive ? "text-primary" : "group-hover:text-foreground")} />
          
          {isMenuOpen && (
            <motion.span 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-medium text-sm truncate"
            >
              {project.name}
            </motion.span>
          )}
        </button>
      </PopoverAnchor>
      <PopoverContent 
        side="right" 
        align="start"
        className="w-44 p-1.5 rounded-xl border border-border/50 bg-popover/95 backdrop-blur-lg shadow-xl"
      >
        <div className="flex flex-col">
          <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
            <DialogTrigger asChild>
              <button
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-foreground/80 hover:text-foreground hover:bg-muted/60 transition-colors"
                data-testid={`button-rename-project-${project.id}`}
              >
                <Pencil className="h-4 w-4 text-muted-foreground" />
                Renombrar
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Renombrar Main Quest</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <Input 
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nuevo nombre"
                  data-testid="input-rename-project"
                />
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)} className="flex-1">
                    Cancelar
                  </Button>
                  <Button 
                    onClick={() => {
                      if (newName.trim()) {
                        onRename(newName.trim());
                        setIsRenameDialogOpen(false);
                        setIsPopoverOpen(false);
                      }
                    }} 
                    disabled={!newName.trim()}
                    className="flex-1"
                    data-testid="button-save-rename-project"
                  >
                    Guardar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <button
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-foreground/80 hover:text-foreground hover:bg-muted/60 transition-colors"
            onClick={() => {
              onArchive();
              setIsPopoverOpen(false);
            }}
            data-testid={`button-archive-project-${project.id}`}
          >
            <Archive className="h-4 w-4 text-muted-foreground" />
            Archivar
          </button>
          <div className="my-1 border-t border-border/30" />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-destructive/80 hover:text-destructive hover:bg-destructive/10 transition-colors"
                data-testid={`button-delete-project-${project.id}`}
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar "{project.name}"?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción no se puede deshacer. Se eliminará permanentemente este main quest y todas sus habilidades.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setIsPopoverOpen(false)}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    onDelete();
                    setIsPopoverOpen(false);
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function AreaMenu() {
  const { 
    areas, activeAreaId, setActiveAreaId, createArea, deleteArea, archiveArea, unarchiveArea, archivedAreas, loadArchivedAreas,
    mainQuests, sideQuests, emergentQuests, activeProjectId, setActiveProjectId, createProject, createSideQuest, createEmergentQuest, deleteProject, archiveProject, unarchiveProject, archivedMainQuests, archivedSideQuests, archivedEmergentQuests, loadArchivedProjects,
    renameArea, renameProject
  } = useSkillTree();
  const { user, logout } = useAuth();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [dialogStep, setDialogStep] = useState<DialogStep>("choose");
  const [itemName, setItemName] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("Home");
  const [manualIconSelected, setManualIconSelected] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isArchivedDialogOpen, setIsArchivedDialogOpen] = useState(false);
  const [viewingArchivedArea, setViewingArchivedArea] = useState<string | null>(null);
  const [viewingArchivedProject, setViewingArchivedProject] = useState<string | null>(null);
  const [emergentExpanded, setEmergentExpanded] = useState(true);
  
  // Emergent Quest multi-step form state
  const [emergentStep, setEmergentStep] = useState(1);
  const [emergentWhatHappened, setEmergentWhatHappened] = useState("");
  const [emergentConsequences, setEmergentConsequences] = useState("");
  const [emergentWhyMatters, setEmergentWhyMatters] = useState("");
  const [emergentObjective, setEmergentObjective] = useState("");
  const [emergentAction, setEmergentAction] = useState("");
  const [emergentNodeTitle, setEmergentNodeTitle] = useState("");

  useEffect(() => {
    if (isArchivedDialogOpen) {
      loadArchivedAreas();
      loadArchivedProjects();
    }
  }, [isArchivedDialogOpen]);

  useEffect(() => {
    if (itemName && !manualIconSelected) {
      const detected = getIconForTitle(itemName);
      setSelectedIcon(detected);
    }
  }, [itemName, manualIconSelected]);

  const handleDialogClose = (open: boolean) => {
    setIsAddOpen(open);
    if (!open) {
      setDialogStep("choose");
      setItemName("");
      setItemDescription("");
      setSelectedIcon("Home");
      setManualIconSelected(false);
      // Reset emergent form state
      setEmergentStep(1);
      setEmergentWhatHappened("");
      setEmergentConsequences("");
      setEmergentWhyMatters("");
      setEmergentObjective("");
      setEmergentAction("");
      setEmergentNodeTitle("");
    }
  };

  const handleCreateArea = async () => {
    if (!itemName.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      await createArea(itemName.trim(), itemDescription.trim(), selectedIcon);
      
      setIsAddOpen(false);
      setDialogStep("choose");
      setItemName("");
      setItemDescription("");
      setSelectedIcon("Home");
      setManualIconSelected(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateProject = async () => {
    if (!itemName.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      await createProject(itemName.trim(), itemDescription.trim(), selectedIcon);
      
      setIsAddOpen(false);
      setDialogStep("choose");
      setItemName("");
      setItemDescription("");
      setSelectedIcon("Home");
      setManualIconSelected(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateSideQuest = async () => {
    if (!itemName.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      await createSideQuest(itemName.trim(), itemDescription.trim(), selectedIcon);
      
      setIsAddOpen(false);
      setDialogStep("choose");
      setItemName("");
      setItemDescription("");
      setSelectedIcon("Home");
      setManualIconSelected(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateEmergentQuest = async () => {
    if (!emergentObjective.trim() || !emergentNodeTitle.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const description = `${emergentWhatHappened}\n\n${emergentConsequences}\n\n${emergentWhyMatters}`;
      await createEmergentQuest(
        emergentObjective.trim(), 
        description.trim(), 
        "Zap", 
        emergentNodeTitle.trim(), 
        emergentAction.trim()
      );
      
      setIsAddOpen(false);
      setDialogStep("choose");
      setEmergentStep(1);
      setEmergentWhatHappened("");
      setEmergentConsequences("");
      setEmergentWhyMatters("");
      setEmergentObjective("");
      setEmergentAction("");
      setEmergentNodeTitle("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderForm = (type: "area" | "project" | "sidequest") => (
    <div className="space-y-4 mt-4">
      <div className="space-y-2">
        <Label>Icono</Label>
        <div className="grid grid-cols-7 gap-2">
          {availableIcons.map(({ name, icon: IconComp }) => (
            <button
              key={name}
              type="button"
              onClick={() => {
                setSelectedIcon(name);
                setManualIconSelected(true);
              }}
              className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center transition-all",
                selectedIcon === name 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
              )}
              data-testid={`icon-${name.toLowerCase()}`}
            >
              <IconComp size={18} />
            </button>
          ))}
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="item-name">Título</Label>
        <Input 
          id="item-name" 
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          placeholder={type === "area" ? "ej: Guitarra, Cocina..." : type === "project" ? "ej: Lanzar mi app, Renovar casa..." : "ej: Organizar garage, Leer libro..."}
          data-testid="input-item-name"
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="item-description">Descripción</Label>
        <Textarea 
          id="item-description" 
          value={itemDescription}
          onChange={(e) => setItemDescription(e.target.value)}
          placeholder={type === "area" ? "Describe esta área de desarrollo" : type === "project" ? "Describe este main quest" : "Describe este side quest"}
          rows={3}
          data-testid="input-item-description"
        />
      </div>
      
      <div className="flex gap-2 pt-2">
        <Button 
          variant="outline" 
          onClick={() => {
            setDialogStep("choose");
            setItemName("");
            setItemDescription("");
            setSelectedIcon("Home");
          }}
          className="flex-1"
          disabled={isSubmitting}
        >
          Atrás
        </Button>
        <Button 
          onClick={type === "area" ? handleCreateArea : type === "project" ? handleCreateProject : handleCreateSideQuest}
          disabled={!itemName.trim() || isSubmitting}
          className="flex-1"
          data-testid={`button-create-${type}`}
        >
          {isSubmitting ? "Creando..." : "Hecho"}
        </Button>
      </div>
    </div>
  );

  return (
    <motion.div 
      initial={{ width: 256 }}
      animate={{ width: isOpen ? 256 : 60 }}
      className="h-full border-r border-border bg-card/50 backdrop-blur-xl flex flex-col z-30 relative transition-all duration-300 ease-in-out overflow-hidden"
    >
      <div className="p-4 flex items-center justify-between border-b border-border h-[60px]">
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="overflow-hidden"
            >
              <h1 className="text-lg font-bold tracking-tight whitespace-nowrap">
                LIFEGAME {user && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button 
                        className="font-normal text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        data-testid="button-username"
                      >
                        | {user.username}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent side="bottom" align="start" className="w-40 p-2 border-0 shadow-2xl">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                        onClick={logout}
                        data-testid="button-logout"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Cerrar sesión
                      </Button>
                    </PopoverContent>
                  </Popover>
                )}
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

      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 space-y-1 px-2 scrollbar-hide overscroll-contain">
        {isOpen && (
          <div className="px-3 py-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Áreas
            </span>
          </div>
        )}

        {areas.length === 0 ? (
          <div className="text-xs text-muted-foreground px-3 py-2 italic">
            {isOpen ? "Sin áreas aún" : "—"}
          </div>
        ) : (
          areas.map((area) => (
            <AreaItem
              key={area.id}
              area={area}
              isActive={area.id === activeAreaId}
              isMenuOpen={isOpen}
              onSelect={() => setActiveAreaId(area.id)}
              onDelete={() => deleteArea(area.id)}
              onArchive={() => archiveArea(area.id)}
              onRename={(name) => renameArea(area.id, name)}
            />
          ))
        )}

        <div className="my-3 border-t border-border" />

        {isOpen && (
          <div className="px-3 py-1" data-onboarding="main-quests">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Main Quest
            </span>
          </div>
        )}

        {mainQuests.length === 0 ? (
          <div className="text-xs text-muted-foreground px-3 py-2 italic" data-onboarding="main-quests">
            {isOpen ? "Sin main quests aún" : "—"}
          </div>
        ) : (
          mainQuests.map((project, index) => (
            <ProjectItem
              key={project.id}
              project={project}
              isActive={project.id === activeProjectId}
              isMenuOpen={isOpen}
              onSelect={() => setActiveProjectId(project.id)}
              onDelete={() => deleteProject(project.id)}
              onArchive={() => archiveProject(project.id)}
              onRename={(name) => renameProject(project.id, name)}
            />
          ))
        )}

        <div className="my-3 border-t border-border" />

        {isOpen && (
          <div className="px-3 py-1" data-onboarding="side-quests">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Side Quest
            </span>
          </div>
        )}

        {sideQuests.length === 0 ? (
          <div className="text-xs text-muted-foreground px-3 py-2 italic" data-onboarding="side-quests">
            {isOpen ? "Sin side quests aún" : "—"}
          </div>
        ) : (
          sideQuests.map((project, index) => (
            <ProjectItem
              key={project.id}
              project={project}
              isActive={project.id === activeProjectId}
              isMenuOpen={isOpen}
              onSelect={() => setActiveProjectId(project.id)}
              onDelete={() => deleteProject(project.id)}
              onArchive={() => archiveProject(project.id)}
              onRename={(name) => renameProject(project.id, name)}
            />
          ))
        )}

        {emergentQuests.length > 0 && (
          <div className="mt-2 ml-2">
            {isOpen && (
              <button
                onClick={() => setEmergentExpanded(!emergentExpanded)}
                className="flex items-center gap-1 px-2 py-1 text-xs text-amber-500/80 hover:text-amber-400 transition-colors"
                data-testid="button-toggle-emergent"
              >
                {emergentExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <Zap size={12} />
                <span className="font-medium">Emergent</span>
                <span className="text-muted-foreground">({emergentQuests.length})</span>
              </button>
            )}
            {emergentExpanded && emergentQuests.map((project) => (
              <ProjectItem
                key={project.id}
                project={project}
                isActive={project.id === activeProjectId}
                isMenuOpen={isOpen}
                onSelect={() => setActiveProjectId(project.id)}
                onDelete={() => deleteProject(project.id)}
                onArchive={() => archiveProject(project.id)}
                onRename={(name) => renameProject(project.id, name)}
              />
            ))}
          </div>
        )}

      </div>

      <div className={cn("p-2 flex flex-col gap-1", isOpen ? "items-start" : "items-center")}>
        <Dialog open={isAddOpen} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <button
              className="group flex items-center gap-2 px-3 py-2 text-muted-foreground hover:text-foreground transition-all duration-200 rounded-md hover:bg-muted/50"
              data-testid="button-add"
              data-onboarding="add-button"
            >
              <Plus size={18} className="shrink-0" />
              <span className={cn(
                "text-sm font-medium overflow-hidden transition-all duration-200",
                isOpen ? "max-w-[100px] opacity-100" : "max-w-0 opacity-0 group-hover:max-w-[100px] group-hover:opacity-100"
              )}>
                Agregar
              </span>
            </button>
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
                      <FolderKanban className="h-6 w-6" />
                      <span>Main Quest</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="h-24 flex flex-col gap-2"
                      onClick={() => setDialogStep("new-sidequest")}
                      data-testid="button-new-sidequest"
                    >
                      <FolderKanban className="h-6 w-6" />
                      <span>Side Quest</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="h-24 flex flex-col gap-2 border-amber-500/50 hover:border-amber-500 hover:bg-amber-500/10"
                      onClick={() => setDialogStep("new-emergent")}
                      data-testid="button-new-emergent"
                    >
                      <Zap className="h-6 w-6 text-amber-500" />
                      <span>Emergent Quest</span>
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
                {renderForm("area")}
              </>
            )}

            {dialogStep === "new-project" && (
              <>
                <DialogHeader>
                  <DialogTitle>Nuevo Main Quest</DialogTitle>
                </DialogHeader>
                {renderForm("project")}
              </>
            )}

            {dialogStep === "new-sidequest" && (
              <>
                <DialogHeader>
                  <DialogTitle>Nuevo Side Quest</DialogTitle>
                </DialogHeader>
                {renderForm("sidequest")}
              </>
            )}

            {dialogStep === "new-emergent" && (
              <div className="bg-zinc-900 -m-6 p-6 rounded-lg">
                <DialogHeader>
                  <DialogTitle className="text-amber-400 flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Nuevo Emergent Quest
                  </DialogTitle>
                  <DialogDescription className="text-zinc-400">
                    Paso {emergentStep} de 6
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-6 space-y-4">
                  {emergentStep === 1 && (
                    <div className="space-y-3">
                      <Label className="text-zinc-200 text-lg">¿Qué pasó?</Label>
                      <Textarea 
                        value={emergentWhatHappened}
                        onChange={(e) => setEmergentWhatHappened(e.target.value)}
                        placeholder="Describe el evento o situación que surgió..."
                        rows={4}
                        className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
                        data-testid="input-emergent-what-happened"
                      />
                    </div>
                  )}
                  {emergentStep === 2 && (
                    <div className="space-y-3">
                      <Label className="text-zinc-200 text-lg">¿Qué consecuencias trae?</Label>
                      <Textarea 
                        value={emergentConsequences}
                        onChange={(e) => setEmergentConsequences(e.target.value)}
                        placeholder="¿Qué impacto tiene esto en tu vida?"
                        rows={4}
                        className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
                        data-testid="input-emergent-consequences"
                      />
                    </div>
                  )}
                  {emergentStep === 3 && (
                    <div className="space-y-3">
                      <Label className="text-zinc-200 text-lg">¿Por qué te importa?</Label>
                      <Textarea 
                        value={emergentWhyMatters}
                        onChange={(e) => setEmergentWhyMatters(e.target.value)}
                        placeholder="¿Por qué es importante para vos resolver esto?"
                        rows={4}
                        className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
                        data-testid="input-emergent-why-matters"
                      />
                    </div>
                  )}
                  {emergentStep === 4 && (
                    <div className="space-y-3">
                      <Label className="text-zinc-200 text-lg">¿Cuál es tu objetivo?</Label>
                      <Input 
                        value={emergentObjective}
                        onChange={(e) => setEmergentObjective(e.target.value)}
                        placeholder="Define el objetivo de esta quest..."
                        className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
                        data-testid="input-emergent-objective"
                      />
                      <p className="text-xs text-zinc-500">Este será el nombre de tu quest</p>
                    </div>
                  )}
                  {emergentStep === 5 && (
                    <div className="space-y-3">
                      <Label className="text-zinc-200 text-lg">¿Qué podés hacer al respecto?</Label>
                      <Textarea 
                        value={emergentAction}
                        onChange={(e) => setEmergentAction(e.target.value)}
                        placeholder="Describe la primera acción concreta que podés tomar..."
                        rows={4}
                        className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
                        data-testid="input-emergent-action"
                      />
                    </div>
                  )}
                  {emergentStep === 6 && (
                    <div className="space-y-3">
                      <Label className="text-zinc-200 text-lg">¿Lo podés abreviar en tres palabras?</Label>
                      <Input 
                        value={emergentNodeTitle}
                        onChange={(e) => setEmergentNodeTitle(e.target.value)}
                        placeholder="ej: Llamar al mecánico"
                        className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
                        data-testid="input-emergent-node-title"
                      />
                      <p className="text-xs text-zinc-500">Este será el título de tu primer nodo</p>
                    </div>
                  )}
                  
                  <div className="flex gap-2 pt-4">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        if (emergentStep === 1) {
                          setDialogStep("choose");
                          setEmergentStep(1);
                          setEmergentWhatHappened("");
                          setEmergentConsequences("");
                          setEmergentWhyMatters("");
                          setEmergentObjective("");
                          setEmergentAction("");
                          setEmergentNodeTitle("");
                        } else {
                          setEmergentStep(s => s - 1);
                        }
                      }}
                      className="flex-1 bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
                      disabled={isSubmitting}
                    >
                      {emergentStep === 1 ? "Cancelar" : "Atrás"}
                    </Button>
                    {emergentStep < 6 ? (
                      <Button 
                        onClick={() => setEmergentStep(s => s + 1)}
                        className="flex-1 bg-amber-600 hover:bg-amber-500 text-white"
                        disabled={
                          (emergentStep === 1 && !emergentWhatHappened.trim()) ||
                          (emergentStep === 2 && !emergentConsequences.trim()) ||
                          (emergentStep === 3 && !emergentWhyMatters.trim()) ||
                          (emergentStep === 4 && !emergentObjective.trim()) ||
                          (emergentStep === 5 && !emergentAction.trim())
                        }
                      >
                        Siguiente
                      </Button>
                    ) : (
                      <Button 
                        onClick={handleCreateEmergentQuest}
                        disabled={!emergentNodeTitle.trim() || isSubmitting}
                        className="flex-1 bg-amber-600 hover:bg-amber-500 text-white"
                        data-testid="button-create-emergent"
                      >
                        {isSubmitting ? "Creando..." : "Crear Quest"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
        <Dialog open={isArchivedDialogOpen} onOpenChange={setIsArchivedDialogOpen}>
          <DialogTrigger asChild>
            <button
              className="group flex items-center gap-2 px-3 py-2 text-muted-foreground hover:text-foreground transition-all duration-200 rounded-md hover:bg-muted/50"
              data-testid="button-open-archived"
            >
              <Archive size={18} className="shrink-0" />
              <span className={cn(
                "text-sm font-medium overflow-hidden transition-all duration-200",
                isOpen ? "max-w-[100px] opacity-100" : "max-w-0 opacity-0 group-hover:max-w-[100px] group-hover:opacity-100"
              )}>
                Completados
              </span>
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Archive size={18} />
                Quests Completados
              </DialogTitle>
            </DialogHeader>
            <div className="mt-4 space-y-4 max-h-[60vh] overflow-y-auto">
              {archivedAreas.length === 0 && archivedMainQuests.length === 0 && archivedSideQuests.length === 0 && archivedEmergentQuests.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <Archive className="mx-auto h-12 w-12 mb-3 opacity-30" />
                  <p>No hay quests completados</p>
                </div>
              ) : (
                <>
                  {archivedAreas.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Áreas</h3>
                      {archivedAreas.map((area) => {
                        const Icon = extendedIconMap[area.icon] || extendedIconMap.Home;
                        const isViewing = viewingArchivedArea === area.id;
                        return (
                          <div 
                            key={area.id} 
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
                              isViewing ? "bg-primary/10 border-primary/30" : "hover:bg-muted/50 border-border"
                            )}
                            onClick={() => {
                              setViewingArchivedArea(isViewing ? null : area.id);
                              setViewingArchivedProject(null);
                              if (!isViewing) {
                                setActiveAreaId(area.id);
                                setIsArchivedDialogOpen(false);
                              }
                            }}
                            data-testid={`archived-area-${area.id}`}
                          >
                            <Icon size={20} className="text-muted-foreground" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{area.name}</p>
                              {area.description && (
                                <p className="text-sm text-muted-foreground truncate">{area.description}</p>
                              )}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  unarchiveArea(area.id);
                                }}
                                title="Restaurar"
                                data-testid={`button-unarchive-area-${area.id}`}
                              >
                                <ArchiveRestore size={16} />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-destructive hover:text-destructive"
                                    title="Eliminar"
                                    data-testid={`button-delete-archived-area-${area.id}`}
                                  >
                                    <Trash2 size={16} />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>¿Eliminar "{area.name}"?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta acción no se puede deshacer. Se eliminará permanentemente esta área y todas sus habilidades.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteArea(area.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Eliminar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {archivedMainQuests.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Main Quest</h3>
                      {archivedMainQuests.map((project) => {
                        const Icon = extendedIconMap[project.icon] || FolderKanban;
                        const isViewing = viewingArchivedProject === project.id;
                        return (
                          <div 
                            key={project.id} 
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
                              isViewing ? "bg-primary/10 border-primary/30" : "hover:bg-muted/50 border-border"
                            )}
                            onClick={() => {
                              setViewingArchivedProject(isViewing ? null : project.id);
                              setViewingArchivedArea(null);
                              if (!isViewing) {
                                setActiveProjectId(project.id);
                                setIsArchivedDialogOpen(false);
                              }
                            }}
                            data-testid={`archived-project-${project.id}`}
                          >
                            <Icon size={20} className="text-muted-foreground" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{project.name}</p>
                              {project.description && (
                                <p className="text-sm text-muted-foreground truncate">{project.description}</p>
                              )}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  unarchiveProject(project.id);
                                }}
                                title="Restaurar"
                                data-testid={`button-unarchive-project-${project.id}`}
                              >
                                <ArchiveRestore size={16} />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-destructive hover:text-destructive"
                                    title="Eliminar"
                                    data-testid={`button-delete-archived-project-${project.id}`}
                                  >
                                    <Trash2 size={16} />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>¿Eliminar "{project.name}"?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta acción no se puede deshacer. Se eliminará permanentemente este main quest y todas sus habilidades.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteProject(project.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Eliminar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {archivedSideQuests.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Side Quest</h3>
                      {archivedSideQuests.map((project) => {
                        const Icon = extendedIconMap[project.icon] || FolderKanban;
                        const isViewing = viewingArchivedProject === project.id;
                        return (
                          <div 
                            key={project.id} 
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
                              isViewing ? "bg-primary/10 border-primary/30" : "hover:bg-muted/50 border-border"
                            )}
                            onClick={() => {
                              setViewingArchivedProject(isViewing ? null : project.id);
                              setViewingArchivedArea(null);
                              if (!isViewing) {
                                setActiveProjectId(project.id);
                                setIsArchivedDialogOpen(false);
                              }
                            }}
                            data-testid={`archived-sidequest-${project.id}`}
                          >
                            <Icon size={20} className="text-muted-foreground" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{project.name}</p>
                              {project.description && (
                                <p className="text-sm text-muted-foreground truncate">{project.description}</p>
                              )}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  unarchiveProject(project.id);
                                }}
                                title="Restaurar"
                                data-testid={`button-unarchive-sidequest-${project.id}`}
                              >
                                <ArchiveRestore size={16} />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-destructive hover:text-destructive"
                                    title="Eliminar"
                                    data-testid={`button-delete-archived-sidequest-${project.id}`}
                                  >
                                    <Trash2 size={16} />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>¿Eliminar "{project.name}"?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta acción no se puede deshacer. Se eliminará permanentemente este side quest y todas sus habilidades.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteProject(project.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Eliminar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {archivedEmergentQuests.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold text-amber-500/80 uppercase tracking-wider px-1 flex items-center gap-1">
                        <Zap size={12} />
                        Emergent Quest
                      </h3>
                      {archivedEmergentQuests.map((project) => {
                        const isViewing = viewingArchivedProject === project.id;
                        return (
                          <div 
                            key={project.id} 
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
                              isViewing ? "bg-amber-500/10 border-amber-500/30" : "hover:bg-muted/50 border-border"
                            )}
                            onClick={() => {
                              setViewingArchivedProject(isViewing ? null : project.id);
                              setViewingArchivedArea(null);
                              if (!isViewing) {
                                setActiveProjectId(project.id);
                                setIsArchivedDialogOpen(false);
                              }
                            }}
                            data-testid={`archived-emergent-${project.id}`}
                          >
                            <Zap size={20} className="text-amber-500" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{project.name}</p>
                              {project.description && (
                                <p className="text-sm text-muted-foreground truncate">{project.description}</p>
                              )}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  unarchiveProject(project.id);
                                }}
                                title="Restaurar"
                                data-testid={`button-unarchive-emergent-${project.id}`}
                              >
                                <ArchiveRestore size={16} />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-destructive hover:text-destructive"
                                    title="Eliminar"
                                    data-testid={`button-delete-archived-emergent-${project.id}`}
                                  >
                                    <Trash2 size={16} />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>¿Eliminar "{project.name}"?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Esta acción no se puede deshacer. Se eliminará permanentemente este emergent quest y todas sus habilidades.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteProject(project.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Eliminar
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </motion.div>
  );
}
