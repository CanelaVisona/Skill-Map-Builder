import { useSkillTree, iconMap, type Project } from "@/lib/skill-context";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, PanelLeftClose, PanelLeftOpen, Music, Trophy, BookOpen, Home, Dumbbell, Briefcase, Heart, Utensils, Palette, Code, Gamepad2, Camera, FolderKanban, Trash2, LogOut, Archive, ArchiveRestore, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Popover, PopoverContent, PopoverAnchor } from "./ui/popover";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { useState, useEffect, useRef } from "react";

type DialogStep = "choose" | "new-area" | "new-project";

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
}

function AreaItem({ area, isActive, isMenuOpen, onSelect, onDelete, onArchive }: AreaItemProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
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
            "w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 group relative overflow-hidden touch-none select-none",
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
        className="w-48 p-2 space-y-2"
      >
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => {
            onArchive();
            setIsPopoverOpen(false);
          }}
          data-testid={`button-archive-area-${area.id}`}
        >
          <Archive className="mr-2 h-4 w-4" />
          Archivar
        </Button>
        <Button
          variant="destructive"
          size="sm"
          className="w-full"
          onClick={() => {
            onDelete();
            setIsPopoverOpen(false);
          }}
          data-testid={`button-delete-area-${area.id}`}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Eliminar
        </Button>
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
}

function ProjectItem({ project, isActive, isMenuOpen, onSelect, onDelete, onArchive }: ProjectItemProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
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
            "w-full flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 group relative overflow-hidden touch-none select-none",
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
        className="w-48 p-2 space-y-2"
      >
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => {
            onArchive();
            setIsPopoverOpen(false);
          }}
          data-testid={`button-archive-project-${project.id}`}
        >
          <Archive className="mr-2 h-4 w-4" />
          Archivar
        </Button>
        <Button
          variant="destructive"
          size="sm"
          className="w-full"
          onClick={() => {
            onDelete();
            setIsPopoverOpen(false);
          }}
          data-testid={`button-delete-project-${project.id}`}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Eliminar
        </Button>
      </PopoverContent>
    </Popover>
  );
}

export function AreaMenu() {
  const { 
    areas, activeAreaId, setActiveAreaId, createArea, deleteArea, archiveArea, unarchiveArea, archivedAreas, loadArchivedAreas,
    projects, activeProjectId, setActiveProjectId, createProject, deleteProject, archiveProject, unarchiveProject, archivedProjects, loadArchivedProjects 
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
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    if (showArchived) {
      loadArchivedAreas();
      loadArchivedProjects();
    }
  }, [showArchived]);

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

  const renderForm = (type: "area" | "project") => (
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
          placeholder={type === "area" ? "ej: Guitarra, Cocina..." : "ej: Aprender React, Renovar casa..."}
          data-testid="input-item-name"
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="item-description">Descripción</Label>
        <Textarea 
          id="item-description" 
          value={itemDescription}
          onChange={(e) => setItemDescription(e.target.value)}
          placeholder={type === "area" ? "Describe esta área de desarrollo" : "Describe este proyecto"}
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
          onClick={type === "area" ? handleCreateArea : handleCreateProject}
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
                LIFEGAME {user && <span className="font-normal text-muted-foreground">| {user.username}</span>}
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
            />
          ))
        )}

        <div className="my-3 border-t border-border" />

        {isOpen && (
          <div className="px-3 py-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Proyectos
            </span>
          </div>
        )}

        {projects.length === 0 ? (
          <div className="text-xs text-muted-foreground px-3 py-2 italic">
            {isOpen ? "Sin proyectos aún" : "—"}
          </div>
        ) : (
          projects.map((project) => (
            <ProjectItem
              key={project.id}
              project={project}
              isActive={project.id === activeProjectId}
              isMenuOpen={isOpen}
              onSelect={() => setActiveProjectId(project.id)}
              onDelete={() => deleteProject(project.id)}
              onArchive={() => archiveProject(project.id)}
            />
          ))
        )}

        <div className="my-3 border-t border-border" />

        {isOpen && (
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="w-full flex items-center gap-2 px-3 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
            data-testid="button-toggle-archived"
          >
            {showArchived ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <Archive size={14} />
            Archivados
          </button>
        )}

        {!isOpen && (
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={cn(
              "w-full flex items-center justify-center py-2 rounded-md transition-colors",
              showArchived ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
            data-testid="button-toggle-archived-collapsed"
          >
            <Archive size={18} />
          </button>
        )}

        {showArchived && (
          <div className="space-y-1 mt-2">
            {archivedAreas.length === 0 && archivedProjects.length === 0 ? (
              <div className="text-xs text-muted-foreground px-3 py-2 italic">
                {isOpen ? "Sin elementos archivados" : "—"}
              </div>
            ) : (
              <>
                {archivedAreas.map((area) => (
                  <div key={area.id} className="flex items-center gap-2 px-3 py-1.5 text-muted-foreground">
                    {(() => {
                      const Icon = extendedIconMap[area.icon] || extendedIconMap.Home;
                      return <Icon size={16} />;
                    })()}
                    {isOpen && (
                      <>
                        <span className="text-sm truncate flex-1">{area.name}</span>
                        <button
                          onClick={() => unarchiveArea(area.id)}
                          className="p-1 hover:text-foreground transition-colors"
                          title="Desarchivar"
                          data-testid={`button-unarchive-area-${area.id}`}
                        >
                          <ArchiveRestore size={14} />
                        </button>
                      </>
                    )}
                  </div>
                ))}
                {archivedProjects.map((project) => (
                  <div key={project.id} className="flex items-center gap-2 px-3 py-1.5 text-muted-foreground">
                    {(() => {
                      const Icon = extendedIconMap[project.icon] || FolderKanban;
                      return <Icon size={16} />;
                    })()}
                    {isOpen && (
                      <>
                        <span className="text-sm truncate flex-1">{project.name}</span>
                        <button
                          onClick={() => unarchiveProject(project.id)}
                          className="p-1 hover:text-foreground transition-colors"
                          title="Desarchivar"
                          data-testid={`button-unarchive-project-${project.id}`}
                        >
                          <ArchiveRestore size={14} />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        )}
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
                      <FolderKanban className="h-6 w-6" />
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
                {renderForm("area")}
              </>
            )}

            {dialogStep === "new-project" && (
              <>
                <DialogHeader>
                  <DialogTitle>Nuevo Proyecto</DialogTitle>
                </DialogHeader>
                {renderForm("project")}
              </>
            )}
          </DialogContent>
        </Dialog>
        <Button 
          variant="ghost" 
          size={isOpen ? "default" : "icon"}
          className={cn(
            "w-full text-muted-foreground hover:text-foreground",
            !isOpen && "aspect-square p-0"
          )}
          onClick={logout}
          data-testid="button-logout"
        >
          <LogOut className={cn("h-4 w-4", isOpen && "mr-2")} />
          {isOpen && "Cerrar sesión"}
        </Button>
      </div>
    </motion.div>
  );
}
