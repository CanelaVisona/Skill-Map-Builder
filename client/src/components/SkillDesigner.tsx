import { useState, useRef } from "react";
import { useSkillTree } from "@/lib/skill-context";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SkillDesignerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SkillDesigner({ open, onOpenChange }: SkillDesignerProps) {
  const { areas, projects, activeAreaId, activeProjectId, updateSkill, updateProjectSkill, createLockedSkill, createLockedProjectSkill, updateLevelSubtitle, updateProjectLevelSubtitle } = useSkillTree();
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingLevel, setEditingLevel] = useState<number | null>(null);
  const [isLockedNode, setIsLockedNode] = useState(false);
  
  // Subtitle editing state
  const [editingLevelSubtitle, setEditingLevelSubtitle] = useState<string>("");
  const [editingLevelSubtitleDescription, setEditingLevelSubtitleDescription] = useState<string>("");
  const [editingLevelData, setEditingLevelData] = useState<{ areaId: string | null; projectId: string | null; level: number } | null>(null);
  
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleNodeLongPressStart = (skillId: string, currentName: string, areaId: string | null, projectId: string | null, level?: number, isLocked: boolean = false) => {
    longPressTimer.current = setTimeout(() => {
      setEditingSkillId(skillId);
      setEditingName(currentName);
      setEditingAreaId(areaId);
      setEditingProjectId(projectId);
      if (level) setEditingLevel(level);
      if (isLocked) setIsLockedNode(true);
    }, 500);
  };

  const handleNodeLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleSaveName = async () => {
    if (editingSkillId && editingName.trim()) {
      // Si es un nodo bloqueado nuevo, crear uno nuevo
      if (isLockedNode && editingLevel && editingSkillId.startsWith("locked_")) {
        if (editingAreaId) {
          await createLockedSkill(editingAreaId, editingLevel, editingName);
        } else if (editingProjectId) {
          await createLockedProjectSkill(editingProjectId, editingLevel, editingName);
        }
      } else {
        // Si es un nodo existente, actualizar
        if (editingAreaId) {
          updateSkill(editingAreaId, editingSkillId, { title: editingName });
        } else if (editingProjectId) {
          updateProjectSkill(editingProjectId, editingSkillId, { title: editingName });
        }
      }
    }
    setEditingSkillId(null);
    setEditingName("");
    setEditingLevel(null);
    setIsLockedNode(false);
  };

  const handleEditLevelSubtitle = (level: number, currentSubtitle: string, currentDescription: string, areaId: string | null, projectId: string | null) => {
    setEditingLevelSubtitle(currentSubtitle);
    setEditingLevelSubtitleDescription(currentDescription);
    setEditingLevelData({ level, areaId, projectId });
  };

  const handleSaveLevelSubtitle = async () => {
    if (editingLevelData) {
      // Guardar el subtítulo y descripción (vacío o con contenido)
      if (editingLevelData.areaId) {
        await updateLevelSubtitle(editingLevelData.areaId, editingLevelData.level, editingLevelSubtitle.trim(), editingLevelSubtitleDescription.trim());
      } else if (editingLevelData.projectId) {
        await updateProjectLevelSubtitle(editingLevelData.projectId, editingLevelData.level, editingLevelSubtitle.trim(), editingLevelSubtitleDescription.trim());
      }
    }
    setEditingLevelSubtitle("");
    setEditingLevelSubtitleDescription("");
    setEditingLevelData(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Skill Designer</DialogTitle>
            <DialogDescription className="sr-only">
              Editar nombres de nodos y subtítulos de niveles.
            </DialogDescription>
          </DialogHeader>

          <Accordion type="single" collapsible className="w-full">
            {/* Areas */}
            {areas.map((area) => {
              const maxLevel = Math.max(...area.skills.map((s) => s.level));
              const levelsToShow = Array.from({ length: maxLevel + 3 }, (_, i) => i + 1);
              const nodesInLastLevel = area.skills.filter((s) => s.level === maxLevel).length || 2;
              
              return (
                <AccordionItem key={area.id} value={`area-${area.id}`}>
                  <AccordionTrigger className="hover:no-underline">
                    <span className="font-semibold">{area.name}</span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <Accordion type="single" collapsible className="w-full pl-4">
                      {/* Levels in Area */}
                      {levelsToShow.map((level) => {
                        const subtitle = area.levelSubtitles?.[level] || "";
                        const subtitleDescription = area.levelSubtitleDescriptions?.[level] || "";
                        const isBlocked = level > maxLevel;
                        
                        return (
                        <AccordionItem key={`${area.id}-level-${level}`} value={`${area.id}-level-${level}`}>
                          <AccordionTrigger className="hover:no-underline">
                            <span 
                              className={cn(isBlocked && "text-muted-foreground/50 cursor-pointer hover:text-foreground")}
                              onClick={(e) => {
                                if (isBlocked) {
                                  e.stopPropagation();
                                  handleEditLevelSubtitle(level, subtitle, subtitleDescription, area.id, null);
                                }
                              }}
                            >
                              Nivel {level}{subtitle && `: ${subtitle}`}
                              {isBlocked && " (Bloqueado)"}
                            </span>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-2 pl-4">
                              {level <= maxLevel ? (
                                area.skills
                                  .filter((s) => s.level === level)
                                  .sort((a, b) => a.y - b.y)
                                  .filter((s, index) => {
                                    const noTitle = !s.title || s.title.toLowerCase().includes("challenge") || s.title.toLowerCase().includes("objective quest");
                                    return !noTitle || index !== 0;
                                  })
                                  .map((skill) => (
                                    <div
                                      key={skill.id}
                                      className={cn("p-2 rounded border border-border bg-card/50 cursor-pointer hover:bg-card transition-colors", skill.status === "locked" && "opacity-60")}
                                      onMouseDown={() => handleNodeLongPressStart(skill.id, skill.title, area.id, null)}
                                      onMouseUp={handleNodeLongPressEnd}
                                      onMouseLeave={handleNodeLongPressEnd}
                                      onTouchStart={() => handleNodeLongPressStart(skill.id, skill.title, area.id, null)}
                                      onTouchEnd={handleNodeLongPressEnd}
                                    >
                                      <div className="flex items-center gap-2">
                                        <div className={cn("text-sm font-medium", skill.status === "available" && "text-amber-400")}>{!skill.title || skill.title.toLowerCase().includes("challenge") || skill.title.toLowerCase().includes("objective quest") ? "-" : skill.title}</div>
                                        {skill.status === "available" && <span className="text-lg font-bold text-amber-400">!</span>}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {skill.status === "mastered" && "✓ Completado"}
                                        {skill.status === "locked" && "Bloqueado"}
                                      </div>
                                    </div>
                                  ))
                              ) : (
                                Array.from({ length: nodesInLastLevel }, (_, i) => (
                                  <div
                                    key={`locked-${level}-${i}`}
                                    className="p-2 rounded border border-border bg-card/50 cursor-pointer hover:bg-card/70 transition-colors opacity-60"
                                    onMouseDown={() => handleNodeLongPressStart(`locked_${area.id}_${level}_${i}`, `Nodo ${i + 1}`, area.id, null, level, true)}
                                    onMouseUp={handleNodeLongPressEnd}
                                    onMouseLeave={handleNodeLongPressEnd}
                                    onTouchStart={() => handleNodeLongPressStart(`locked_${area.id}_${level}_${i}`, `Nodo ${i + 1}`, area.id, null, level, true)}
                                    onTouchEnd={handleNodeLongPressEnd}
                                  >
                                    <div className="text-sm font-medium">Nodo {i + 1}</div>
                                    <div className="text-xs text-muted-foreground">Bloqueado</div>
                                  </div>
                                ))
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                        );
                      })}
                    </Accordion>
                  </AccordionContent>
                </AccordionItem>
              );
            })}

            {/* Main Quests */}
            {projects
              .filter((p) => !p.questType || p.questType === "main")
              .map((project) => {
                const maxLevel = Math.max(...project.skills.map((s) => s.level));
                const levelsToShow = Array.from({ length: maxLevel + 3 }, (_, i) => i + 1);
                const nodesInLastLevel = project.skills.filter((s) => s.level === maxLevel).length || 2;
                
                return (
                  <AccordionItem key={project.id} value={`project-${project.id}`}>
                    <AccordionTrigger className="hover:no-underline">
                      <span className="font-semibold">{project.name} (Quest Principal)</span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <Accordion type="single" collapsible className="w-full pl-4">
                        {levelsToShow.map((level) => {
                          const subtitle = project.levelSubtitles?.[level] || "";
                          const isBlocked = level > maxLevel;
                          
                          return (
                          <AccordionItem key={`${project.id}-level-${level}`} value={`${project.id}-level-${level}`}>
                            <AccordionTrigger className="hover:no-underline">
                              <span 
                                className={cn(isBlocked && "text-muted-foreground/50 cursor-pointer hover:text-foreground")}
                                onClick={(e) => {
                                  if (isBlocked) {
                                    e.stopPropagation();
                                    handleEditLevelSubtitle(level, subtitle, null, project.id);
                                  }
                                }}
                              >
                                Nivel {level}{subtitle && `: ${subtitle}`}
                                {isBlocked && " (Bloqueado)"}
                              </span>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-2 pl-4">
                                {level <= maxLevel ? (
                                  project.skills
                                    .filter((s) => s.level === level)
                                    .sort((a, b) => a.y - b.y)
                                    .filter((s, index) => {
                                      const noTitle = !s.title || s.title.toLowerCase().includes("challenge") || s.title.toLowerCase().includes("objective quest");
                                      return !noTitle || index !== 0;
                                    })
                                    .map((skill) => (
                                      <div
                                        key={skill.id}
                                        className={cn("p-2 rounded border border-border bg-card/50 cursor-pointer hover:bg-card transition-colors", skill.status === "locked" && "opacity-60")}
                                        onMouseDown={() => handleNodeLongPressStart(skill.id, skill.title, null, project.id)}
                                        onMouseUp={handleNodeLongPressEnd}
                                        onMouseLeave={handleNodeLongPressEnd}
                                        onTouchStart={() => handleNodeLongPressStart(skill.id, skill.title, null, project.id)}
                                        onTouchEnd={handleNodeLongPressEnd}
                                      >
                                        <div className="flex items-center gap-2">
                                          <div className={cn("text-sm font-medium", skill.status === "available" && "text-amber-400")}>{!skill.title || skill.title.toLowerCase().includes("challenge") || skill.title.toLowerCase().includes("objective quest") ? "-" : skill.title}</div>
                                          {skill.status === "available" && <span className="text-lg font-bold text-amber-400">!</span>}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                          {skill.status === "mastered" && "✓ Completado"}
                                          {skill.status === "locked" && "Bloqueado"}
                                        </div>
                                      </div>
                                    ))
                                ) : (
                                  Array.from({ length: nodesInLastLevel }, (_, i) => (
                                    <div
                                      key={`locked-${level}-${i}`}
                                      className="p-2 rounded border border-border bg-card/50 cursor-pointer hover:bg-card/70 transition-colors opacity-60"
                                      onMouseDown={() => handleNodeLongPressStart(`locked_${project.id}_${level}_${i}`, `Nodo ${i + 1}`, null, project.id, level, true)}
                                      onMouseUp={handleNodeLongPressEnd}
                                      onMouseLeave={handleNodeLongPressEnd}
                                      onTouchStart={() => handleNodeLongPressStart(`locked_${project.id}_${level}_${i}`, `Nodo ${i + 1}`, null, project.id, level, true)}
                                      onTouchEnd={handleNodeLongPressEnd}
                                    >
                                      <div className="text-sm font-medium">Nodo {i + 1}</div>
                                      <div className="text-xs text-muted-foreground">Bloqueado</div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                          );
                        })}
                      </Accordion>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            {projects
              .filter((p) => p.questType === "side")
              .map((project) => {
                const maxLevel = Math.max(...project.skills.map((s) => s.level));
                const levelsToShow = Array.from({ length: maxLevel + 3 }, (_, i) => i + 1);
                const nodesInLastLevel = project.skills.filter((s) => s.level === maxLevel).length || 2;
                
                return (
                  <AccordionItem key={project.id} value={`project-${project.id}`}>
                    <AccordionTrigger className="hover:no-underline">
                      <span className="font-semibold">{project.name} (Quest Secundaria)</span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <Accordion type="single" collapsible className="w-full pl-4">
                        {levelsToShow.map((level) => {
                          const subtitle = project.levelSubtitles?.[level] || "";
                          const subtitleDescription = project.levelSubtitleDescriptions?.[level] || "";
                          const isBlocked = level > maxLevel;
                          
                          return (
                          <AccordionItem key={`${project.id}-level-${level}`} value={`${project.id}-level-${level}`}>
                            <AccordionTrigger className="hover:no-underline">
                              <span 
                                className={cn(isBlocked && "text-muted-foreground/50 cursor-pointer hover:text-foreground")}
                                onClick={(e) => {
                                  if (isBlocked) {
                                    e.stopPropagation();
                                    handleEditLevelSubtitle(level, subtitle, subtitleDescription, null, project.id);
                                  }
                                }}
                              >
                                Nivel {level}{subtitle && `: ${subtitle}`}
                                {isBlocked && " (Bloqueado)"}
                              </span>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-2 pl-4">
                                {level <= maxLevel ? (
                                  project.skills
                                    .filter((s) => s.level === level)
                                    .sort((a, b) => a.y - b.y)
                                    .filter((s, index) => {
                                      const noTitle = !s.title || s.title.toLowerCase().includes("challenge") || s.title.toLowerCase().includes("objective quest");
                                      return !noTitle || index !== 0;
                                    })
                                    .map((skill) => (
                                      <div
                                        key={skill.id}
                                        className={cn("p-2 rounded border border-border bg-card/50 cursor-pointer hover:bg-card transition-colors", skill.status === "locked" && "opacity-60")}
                                        onMouseDown={() => handleNodeLongPressStart(skill.id, skill.title, null, project.id)}
                                        onMouseUp={handleNodeLongPressEnd}
                                        onMouseLeave={handleNodeLongPressEnd}
                                        onTouchStart={() => handleNodeLongPressStart(skill.id, skill.title, null, project.id)}
                                        onTouchEnd={handleNodeLongPressEnd}
                                      >
                                        <div className="flex items-center gap-2">
                                          <div className={cn("text-sm font-medium", skill.status === "available" && "text-amber-400")}>{!skill.title || skill.title.toLowerCase().includes("challenge") || skill.title.toLowerCase().includes("objective quest") ? "-" : skill.title}</div>
                                          {skill.status === "available" && <span className="text-lg font-bold text-amber-400">!</span>}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                          {skill.status === "mastered" && "✓ Completado"}
                                          {skill.status === "locked" && "Bloqueado"}
                                        </div>
                                      </div>
                                    ))
                                ) : (
                                  Array.from({ length: nodesInLastLevel }, (_, i) => (
                                    <div
                                      key={`locked-${level}-${i}`}
                                      className="p-2 rounded border border-border bg-card/50 cursor-pointer hover:bg-card/70 transition-colors opacity-60"
                                      onMouseDown={() => handleNodeLongPressStart(`locked_${project.id}_${level}_${i}`, `Nodo ${i + 1}`, null, project.id, level, true)}
                                      onMouseUp={handleNodeLongPressEnd}
                                      onMouseLeave={handleNodeLongPressEnd}
                                      onTouchStart={() => handleNodeLongPressStart(`locked_${project.id}_${level}_${i}`, `Nodo ${i + 1}`, null, project.id, level, true)}
                                      onTouchEnd={handleNodeLongPressEnd}
                                    >
                                      <div className="text-sm font-medium">Nodo {i + 1}</div>
                                      <div className="text-xs text-muted-foreground">Bloqueado</div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                          );
                        })}
                      </Accordion>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}

            {/* Emergent Quests */}
            {projects
              .filter((p) => p.questType === "emergent")
              .map((project) => {
                const maxLevel = Math.max(...project.skills.map((s) => s.level));
                const levelsToShow = Array.from({ length: maxLevel + 3 }, (_, i) => i + 1);
                const nodesInLastLevel = project.skills.filter((s) => s.level === maxLevel).length || 2;
                
                return (
                  <AccordionItem key={project.id} value={`project-${project.id}`}>
                    <AccordionTrigger className="hover:no-underline">
                      <span className="font-semibold">{project.name} (Quest Emergente)</span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <Accordion type="single" collapsible className="w-full pl-4">
                        {levelsToShow.map((level) => {
                          const subtitle = project.levelSubtitles?.[level] || "";
                          const subtitleDescription = project.levelSubtitleDescriptions?.[level] || "";
                          const isBlocked = level > maxLevel;
                          
                          return (
                          <AccordionItem key={`${project.id}-level-${level}`} value={`${project.id}-level-${level}`}>
                            <AccordionTrigger className="hover:no-underline">
                              <span 
                                className={cn(isBlocked && "text-muted-foreground/50 cursor-pointer hover:text-foreground")}
                                onClick={(e) => {
                                  if (isBlocked) {
                                    e.stopPropagation();
                                    handleEditLevelSubtitle(level, subtitle, subtitleDescription, null, project.id);
                                  }
                                }}
                              >
                                Nivel {level}{subtitle && `: ${subtitle}`}
                                {isBlocked && " (Bloqueado)"}
                              </span>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="space-y-2 pl-4">
                                {level <= maxLevel ? (
                                  project.skills
                                    .filter((s) => s.level === level)
                                    .sort((a, b) => a.y - b.y)
                                    .filter((s, index) => {
                                      const noTitle = !s.title || s.title.toLowerCase().includes("challenge") || s.title.toLowerCase().includes("objective quest");
                                      return !noTitle || index !== 0;
                                    })
                                    .map((skill) => (
                                      <div
                                        key={skill.id}
                                        className={cn("p-2 rounded border border-border bg-card/50 cursor-pointer hover:bg-card transition-colors", skill.status === "locked" && "opacity-60")}
                                        onMouseDown={() => handleNodeLongPressStart(skill.id, skill.title, null, project.id)}
                                        onMouseUp={handleNodeLongPressEnd}
                                        onMouseLeave={handleNodeLongPressEnd}
                                        onTouchStart={() => handleNodeLongPressStart(skill.id, skill.title, null, project.id)}
                                        onTouchEnd={handleNodeLongPressEnd}
                                      >
                                        <div className="flex items-center gap-2">
                                          <div className={cn("text-sm font-medium", skill.status === "available" && "text-amber-400")}>{!skill.title || skill.title.toLowerCase().includes("challenge") || skill.title.toLowerCase().includes("objective quest") ? "-" : skill.title}</div>
                                          {skill.status === "available" && <span className="text-lg font-bold text-amber-400">!</span>}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                          {skill.status === "mastered" && "✓ Completado"}
                                          {skill.status === "locked" && "Bloqueado"}
                                        </div>
                                      </div>
                                    ))
                                ) : (
                                  Array.from({ length: nodesInLastLevel }, (_, i) => (
                                    <div
                                      key={`locked-${level}-${i}`}
                                      className="p-2 rounded border border-border bg-card/50 cursor-pointer hover:bg-card/70 transition-colors opacity-60"
                                      onMouseDown={() => handleNodeLongPressStart(`locked_${project.id}_${level}_${i}`, `Nodo ${i + 1}`, null, project.id, level, true)}
                                      onMouseUp={handleNodeLongPressEnd}
                                      onMouseLeave={handleNodeLongPressEnd}
                                      onTouchStart={() => handleNodeLongPressStart(`locked_${project.id}_${level}_${i}`, `Nodo ${i + 1}`, null, project.id, level, true)}
                                      onTouchEnd={handleNodeLongPressEnd}
                                    >
                                      <div className="text-sm font-medium">Nodo {i + 1}</div>
                                      <div className="text-xs text-muted-foreground">Bloqueado</div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                          );
                        })}
                      </Accordion>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
          </Accordion>
        </DialogContent>
      </Dialog>

      {/* Edit Name Dialog */}
      <Dialog open={editingSkillId !== null} onOpenChange={(isOpen) => !isOpen && setEditingSkillId(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar nombre del nodo</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Input
              placeholder="Nombre del nodo"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSaveName();
                }
              }}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditingSkillId(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveName}>Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Level Subtitle Dialog */}
      <Dialog open={editingLevelData !== null} onOpenChange={(isOpen) => !isOpen && setEditingLevelData(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar subtítulo del nivel</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="text-sm text-muted-foreground">
              Nivel {editingLevelData?.level}
            </div>
            <Input
              placeholder="Subtítulo del nivel"
              value={editingLevelSubtitle}
              onChange={(e) => setEditingLevelSubtitle(e.target.value)}
              autoFocus
            />
            <Textarea
              placeholder="Descripción del nivel..."
              value={editingLevelSubtitleDescription}
              onChange={(e) => setEditingLevelSubtitleDescription(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditingLevelData(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveLevelSubtitle}>Guardar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
