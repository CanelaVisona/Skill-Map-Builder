import React, { useState, useEffect } from "react";
import { SkillTreeProvider, useSkillTree, type Skill } from "@/lib/skill-context";
import { AreaMenu } from "@/components/AreaMenu";
import { SkillNode } from "@/components/SkillNode";
import { SkillConnection } from "@/components/SkillConnection";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Sun, Moon, BookOpen, Trash2, Plus, Users, Map as MapIcon, Skull, Scroll, Pencil, X, User, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { DiaryProvider, useDiary } from "@/lib/diary-context";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { JournalCharacter, JournalPlace, JournalShadow } from "@shared/schema";
import { OnboardingGuide, HelpButton, useOnboarding } from "@/components/OnboardingGuide";
import { useAuth } from "@/lib/auth-context";

function calculateVisibleLevels(skills: Skill[]): Set<number> {
  const visibleLevels = new Set<number>();
  
  const levelMap = new Map<number, Skill[]>();
  skills.forEach(skill => {
    if (!levelMap.has(skill.level)) {
      levelMap.set(skill.level, []);
    }
    levelMap.get(skill.level)!.push(skill);
  });
  
  const sortedLevels = Array.from(levelMap.keys()).sort((a, b) => a - b);
  
  if (sortedLevels.length === 0) return visibleLevels;
  
  const firstLevel = sortedLevels[0];
  visibleLevels.add(firstLevel);
  
  const firstLevelSkills = levelMap.get(firstLevel);
  const firstLevelStarredNode = firstLevelSkills?.find(s => s.isFinalNode === 1);
  if (firstLevelStarredNode && firstLevelStarredNode.status === "mastered") {
    return visibleLevels;
  }
  
  for (let i = 1; i < sortedLevels.length; i++) {
    const currentLevel = sortedLevels[i];
    const previousLevel = sortedLevels[i - 1];
    
    const previousLevelSkills = levelMap.get(previousLevel);
    if (previousLevelSkills && previousLevelSkills.length > 0) {
      const starredNode = previousLevelSkills.find(s => s.isFinalNode === 1);
      const gatingNode = starredNode || previousLevelSkills.reduce(
        (max, s) => s.y > max.y ? s : max,
        previousLevelSkills[0]
      );
      
      if (gatingNode.status === "mastered") {
        if (gatingNode.isFinalNode === 1) {
          break;
        }
        visibleLevels.add(currentLevel);
      } else {
        break;
      }
    }
  }
  
  return visibleLevels;
}

function TopRightControls({ onOpenGuide }: { onOpenGuide: () => void }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const currentTheme = resolvedTheme || theme;
  const { openDiary } = useDiary();
  
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3">
      <button
        className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
        onClick={() => setTheme(currentTheme === "dark" ? "light" : "dark")}
        data-testid="button-theme-toggle"
      >
        {currentTheme === "dark" ? (
          <Sun className="h-5 w-5" />
        ) : (
          <Moon className="h-5 w-5" />
        )}
      </button>
      <button
        className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
        onClick={openDiary}
        data-testid="button-diary-toggle"
        data-onboarding="diary-button"
        title="Quest Diary"
      >
        <BookOpen className="h-5 w-5" />
      </button>
      <HelpButton onClick={onOpenGuide} />
    </div>
  );
}

type JournalEntry = JournalCharacter | JournalPlace | JournalShadow;

function JournalSection({ 
  type, 
  entries,
  isLoading,
  onAdd,
  onEdit,
  onDelete 
}: { 
  type: "characters" | "places";
  entries: JournalEntry[];
  isLoading: boolean;
  onAdd: (entry: { name: string; action: string; description: string }) => void;
  onEdit: (id: string, entry: { name: string; action: string; description: string }) => void;
  onDelete: (id: string) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [extraInfo, setExtraInfo] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [viewingEntry, setViewingEntry] = useState<JournalEntry | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAddNew = () => {
    if (!name.trim()) return;
    onAdd({ name: name.trim().toUpperCase(), action: "", description: description.trim() });
    setIsAdding(false);
    setName("");
    setDescription("");
  };

  const handleAddExtraInfo = () => {
    if (!extraInfo.trim() || !selectedEntry) return;
    const newDescription = selectedEntry.description 
      ? `${selectedEntry.description}\n${extraInfo.trim()}` 
      : extraInfo.trim();
    onEdit(selectedEntry.id, { 
      name: selectedEntry.name, 
      action: "", 
      description: newDescription 
    });
    setSelectedEntry(null);
    setExtraInfo("");
  };

  const handleSaveEdit = () => {
    if (!name.trim() || !selectedEntry) return;
    onEdit(selectedEntry.id, { 
      name: name.trim().toUpperCase(), 
      action: "", 
      description: description.trim() 
    });
    setSelectedEntry(null);
    setIsEditMode(false);
    setName("");
    setDescription("");
  };

  const handleDelete = () => {
    if (selectedEntry) {
      onDelete(selectedEntry.id);
      setSelectedEntry(null);
      setIsEditMode(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleCloseDialog = () => {
    setSelectedEntry(null);
    setIsEditMode(false);
    setExtraInfo("");
    setShowDeleteConfirm(false);
  };

  const emptyMessage = type === "characters" ? "No characters" : type === "places" ? "No places" : "No shadows";
  const countLabel = type === "characters" ? "characters" : type === "places" ? "places" : "shadows";
  const Icon = type === "characters" ? Users : type === "places" ? MapIcon : Skull;

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Loading...</div>;
  }

  const handleLeftLongPressStart = () => {
    longPressTimer.current = setTimeout(() => {
      setIsAdding(true);
      setName("");
      setDescription("");
    }, 500);
  };

  const handleLeftLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleRightLongPressStart = () => {
    if (!viewingEntry) return;
    longPressTimer.current = setTimeout(() => {
      setSelectedEntry(viewingEntry);
      setName(viewingEntry.name);
      setDescription(viewingEntry.description || "");
      setExtraInfo("");
      setIsEditMode(false);
    }, 500);
  };

  const handleRightLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="mb-3 pb-2 border-b border-zinc-700/50">
        <span className="text-xs text-zinc-500 uppercase tracking-wider">
          {entries.length} {countLabel}
        </span>
        <div className="h-px w-8 bg-gradient-to-r from-zinc-600 to-transparent mt-1" />
      </div>

      <Dialog open={isAdding} onOpenChange={(open) => !open && setIsAdding(false)}>
        <DialogContent className="sm:max-w-md bg-zinc-900 border border-zinc-700">
          <VisuallyHidden>
            <DialogTitle>Add {type === "characters" ? "Character" : type === "places" ? "Place" : "Shadow"}</DialogTitle>
          </VisuallyHidden>
          
          <div className="space-y-4">
            <div className="border-b border-zinc-700/50 pb-2">
              <h3 className="font-medium text-zinc-100">
                Add {type === "characters" ? "Character" : type === "places" ? "Place" : "Shadow"}
              </h3>
              <div className="h-px w-8 bg-gradient-to-r from-zinc-500 to-transparent mt-1" />
            </div>
            <Input
              placeholder="NAME"
              value={name}
              onChange={(e) => setName(e.target.value.toUpperCase())}
              className="uppercase bg-zinc-800 border-zinc-700 text-zinc-200 placeholder:text-zinc-500"
              data-testid={`input-${type}-name`}
            />
            <Textarea
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="bg-zinc-800 border-zinc-700 text-zinc-200 placeholder:text-zinc-500 resize-none"
              data-testid={`input-${type}-description`}
            />
            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={handleAddNew} className="bg-zinc-700 hover:bg-zinc-600 text-zinc-200" data-testid={`button-save-${type}`}>
                Add
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)} className="text-zinc-400 hover:text-zinc-300">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedEntry} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="sm:max-w-md bg-zinc-900 border border-zinc-700">
          <VisuallyHidden>
            <DialogTitle>{selectedEntry?.name}</DialogTitle>
          </VisuallyHidden>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-700/50 pb-2">
              <div>
                <h3 className="font-medium text-zinc-100 uppercase">{selectedEntry?.name}</h3>
                <div className="h-px w-8 bg-gradient-to-r from-zinc-500 to-transparent mt-1" />
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditMode(!isEditMode)}
                  className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-200"
                  data-testid={`button-edit-mode-${type}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-200"
                  data-testid={`button-delete-${type}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {selectedEntry?.description && !isEditMode && (
              <p className="text-sm text-zinc-400 whitespace-pre-line leading-relaxed">{selectedEntry.description}</p>
            )}

            {!isEditMode ? (
              <div className="flex gap-2">
                <Input
                  placeholder="Add more info..."
                  value={extraInfo}
                  onChange={(e) => setExtraInfo(e.target.value)}
                  className="flex-1 bg-zinc-800 border-zinc-700 text-zinc-200 placeholder:text-zinc-500"
                  data-testid={`input-${type}-extra`}
                />
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={handleAddExtraInfo} 
                  disabled={!extraInfo.trim()}
                  className="text-zinc-400 hover:text-zinc-200"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Input
                  placeholder="NAME"
                  value={name}
                  onChange={(e) => setName(e.target.value.toUpperCase())}
                  className="uppercase bg-zinc-800 border-zinc-700 text-zinc-200 placeholder:text-zinc-500"
                  data-testid={`input-edit-${type}-name`}
                />
                <Textarea
                  placeholder="Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="bg-zinc-800 border-zinc-700 text-zinc-200 placeholder:text-zinc-500 resize-none"
                  data-testid={`input-edit-${type}-description`}
                />
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    onClick={handleSaveEdit}
                    className="bg-zinc-700 hover:bg-zinc-600 text-zinc-200"
                  >
                    Save
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => setIsEditMode(false)}
                    className="text-zinc-400 hover:text-zinc-300"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>

          {showDeleteConfirm && (
            <div className="pt-4 border-t border-zinc-700 mt-4">
              <p className="text-sm text-zinc-400 mb-3">Delete this entry?</p>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={handleDelete}
                  className="bg-red-900/50 hover:bg-red-900 text-red-200"
                >
                  Delete
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => setShowDeleteConfirm(false)}
                  className="text-zinc-400 hover:text-zinc-300"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="flex flex-1 min-h-0 gap-2">
        <div 
          className="w-1/2 bg-zinc-800/30 rounded border border-zinc-700/50 p-3 cursor-pointer select-none shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]"
          onTouchStart={handleLeftLongPressStart}
          onTouchEnd={handleLeftLongPressEnd}
          onTouchCancel={handleLeftLongPressEnd}
          onMouseDown={handleLeftLongPressStart}
          onMouseUp={handleLeftLongPressEnd}
          onMouseLeave={handleLeftLongPressEnd}
        >
          <ScrollArea className="h-full">
            {entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Icon className="h-8 w-8 text-zinc-600 mb-3" />
                <p className="text-zinc-500 text-sm">{emptyMessage}</p>
                <p className="text-zinc-600 text-xs mt-2">Mantené presionado para agregar</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {entries.map((entry, index) => (
                  <div key={entry.id}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setViewingEntry(entry); }}
                      className={`w-full text-left px-3 py-2 rounded text-sm transition-all cursor-pointer select-none ${
                        viewingEntry?.id === entry.id 
                          ? "bg-zinc-700 text-zinc-100 shadow-sm" 
                          : "text-zinc-400 hover:bg-zinc-700/50 hover:text-zinc-200"
                      }`}
                      data-testid={`card-${type}-${entry.id}`}
                    >
                      {entry.name}
                    </button>
                    {index < entries.length - 1 && (
                      <div className="h-px bg-zinc-700/30 mx-2" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
        
        <div 
          className="w-1/2 bg-zinc-800/20 rounded border border-zinc-700/50 p-4 cursor-pointer select-none shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)]"
          onTouchStart={handleRightLongPressStart}
          onTouchEnd={handleRightLongPressEnd}
          onTouchCancel={handleRightLongPressEnd}
          onMouseDown={handleRightLongPressStart}
          onMouseUp={handleRightLongPressEnd}
          onMouseLeave={handleRightLongPressEnd}
        >
          <ScrollArea className="h-full">
            {viewingEntry ? (
              <div className="space-y-4">
                <div className="border-b border-zinc-700/50 pb-2">
                  <h3 className="font-medium text-zinc-100 uppercase tracking-wide">{viewingEntry.name}</h3>
                  <div className="h-px w-12 bg-gradient-to-r from-zinc-500 to-transparent mt-2" />
                </div>
                {viewingEntry.description && (
                  <p className="text-sm text-zinc-400 whitespace-pre-line leading-relaxed">{viewingEntry.description}</p>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-zinc-600 text-sm">
                Seleccioná una entrada
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

function ShadowsSection({ 
  entries,
  isLoading,
  onAdd,
  onEdit,
  onDelete,
  onMarkDefeated
}: { 
  entries: JournalShadow[];
  isLoading: boolean;
  onAdd: (entry: { name: string; action: string; description: string }) => void;
  onEdit: (id: string, entry: { name: string; action: string; description: string }) => void;
  onDelete: (id: string) => void;
  onMarkDefeated: (id: string, defeated: 0 | 1) => void;
}) {
    const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [extraInfo, setExtraInfo] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<JournalShadow | null>(null);
  const [viewingEntry, setViewingEntry] = useState<JournalShadow | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentEntries = entries;

  const handleAddNew = () => {
    if (!name.trim()) return;
    onAdd({ name: name.trim().toUpperCase(), action: "", description: description.trim() });
    setIsAdding(false);
    setName("");
    setDescription("");
  };

  const handleAddExtraInfo = () => {
    if (!extraInfo.trim() || !selectedEntry) return;
    const newDescription = selectedEntry.description 
      ? `${selectedEntry.description}\n${extraInfo.trim()}` 
      : extraInfo.trim();
    onEdit(selectedEntry.id, { 
      name: selectedEntry.name, 
      action: "", 
      description: newDescription 
    });
    setSelectedEntry(null);
    setExtraInfo("");
  };

  const handleSaveEdit = () => {
    if (!name.trim() || !selectedEntry) return;
    onEdit(selectedEntry.id, { 
      name: name.trim().toUpperCase(), 
      action: "", 
      description: description.trim() 
    });
    setSelectedEntry(null);
    setIsEditMode(false);
    setName("");
    setDescription("");
  };

  const handleDelete = () => {
    if (selectedEntry) {
      onDelete(selectedEntry.id);
      setSelectedEntry(null);
      setIsEditMode(false);
      setShowDeleteConfirm(false);
      setViewingEntry(null);
    }
  };

  const handleToggleDefeated = () => {
    if (selectedEntry) {
      const newDefeated = selectedEntry.defeated === 1 ? 0 : 1;
      onMarkDefeated(selectedEntry.id, newDefeated as 0 | 1);
      setSelectedEntry(null);
      setViewingEntry(null);
    }
  };

  const handleCloseDialog = () => {
    setSelectedEntry(null);
    setIsEditMode(false);
    setExtraInfo("");
    setShowDeleteConfirm(false);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Loading...</div>;
  }

  const handleLeftLongPressStart = () => {
        longPressTimer.current = setTimeout(() => {
      setIsAdding(true);
      setName("");
      setDescription("");
    }, 500);
  };

  const handleLeftLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleRightLongPressStart = () => {
    if (!viewingEntry) return;
    longPressTimer.current = setTimeout(() => {
      setSelectedEntry(viewingEntry);
      setName(viewingEntry.name);
      setDescription(viewingEntry.description || "");
      setExtraInfo("");
      setIsEditMode(false);
    }, 500);
  };

  const handleRightLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="mb-3 pb-2 border-b border-zinc-700/50">
        <span className="text-xs text-zinc-500 uppercase tracking-wider">
          {currentEntries.length} shadows
        </span>
        <div className="h-px w-8 bg-gradient-to-r from-zinc-600 to-transparent mt-1" />
      </div>
      
      <Dialog open={isAdding} onOpenChange={(open) => !open && setIsAdding(false)}>
        <DialogContent className="sm:max-w-md bg-zinc-900 border border-zinc-700">
          <VisuallyHidden>
            <DialogTitle>Add Shadow</DialogTitle>
          </VisuallyHidden>
          
          <div className="space-y-4">
            <div className="border-b border-zinc-700/50 pb-2">
              <h3 className="font-medium text-zinc-100">Add Shadow</h3>
              <div className="h-px w-8 bg-gradient-to-r from-zinc-500 to-transparent mt-1" />
            </div>
            <Input
              placeholder="NAME"
              value={name}
              onChange={(e) => setName(e.target.value.toUpperCase())}
              className="uppercase bg-zinc-800 border-zinc-700 text-zinc-200 placeholder:text-zinc-500"
              data-testid="input-shadows-name"
            />
            <Textarea
              placeholder="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="bg-zinc-800 border-zinc-700 text-zinc-200 placeholder:text-zinc-500 resize-none"
              data-testid="input-shadows-description"
            />
            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={handleAddNew} className="bg-zinc-700 hover:bg-zinc-600 text-zinc-200" data-testid="button-save-shadows">
                Add
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)} className="text-zinc-400 hover:text-zinc-300">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedEntry} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="sm:max-w-md bg-zinc-900 border border-zinc-700">
          <VisuallyHidden>
            <DialogTitle>{selectedEntry?.name}</DialogTitle>
          </VisuallyHidden>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-700/50 pb-2">
              <div>
                <h3 className="font-medium text-zinc-100 uppercase">{selectedEntry?.name}</h3>
                <div className="h-px w-8 bg-gradient-to-r from-zinc-500 to-transparent mt-1" />
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditMode(!isEditMode)}
                  className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-200"
                  data-testid="button-edit-mode-shadows"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-200"
                  data-testid="button-delete-shadows"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {selectedEntry?.description && !isEditMode && (
              <p className="text-sm text-zinc-400 whitespace-pre-line leading-relaxed">{selectedEntry.description}</p>
            )}

            {!isEditMode ? (
              <div className="flex gap-2">
                <Input
                  placeholder="Add more info..."
                  value={extraInfo}
                  onChange={(e) => setExtraInfo(e.target.value)}
                  className="flex-1 bg-zinc-800 border-zinc-700 text-zinc-200 placeholder:text-zinc-500"
                  data-testid="input-shadows-extra"
                />
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={handleAddExtraInfo} 
                  disabled={!extraInfo.trim()}
                  className="text-zinc-400 hover:text-zinc-200"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Input
                  placeholder="NAME"
                  value={name}
                  onChange={(e) => setName(e.target.value.toUpperCase())}
                  className="uppercase bg-zinc-800 border-zinc-700 text-zinc-200 placeholder:text-zinc-500"
                  data-testid="input-edit-shadows-name"
                />
                <Textarea
                  placeholder="Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="bg-zinc-800 border-zinc-700 text-zinc-200 placeholder:text-zinc-500 resize-none"
                  data-testid="input-edit-shadows-description"
                />
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    onClick={handleSaveEdit}
                    className="bg-zinc-700 hover:bg-zinc-600 text-zinc-200"
                  >
                    Save
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => setIsEditMode(false)}
                    className="text-zinc-400 hover:text-zinc-300"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>

          {showDeleteConfirm && (
            <div className="pt-4 border-t border-zinc-700 mt-4">
              <p className="text-sm text-zinc-400 mb-3">Delete this entry?</p>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={handleDelete}
                  className="bg-red-900/50 hover:bg-red-900 text-red-200"
                >
                  Delete
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => setShowDeleteConfirm(false)}
                  className="text-zinc-400 hover:text-zinc-300"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="flex flex-1 min-h-0 gap-2">
        <div 
          className="w-1/2 bg-zinc-800/30 rounded border border-zinc-700/50 p-3 cursor-pointer select-none shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]"
          onTouchStart={handleLeftLongPressStart}
          onTouchEnd={handleLeftLongPressEnd}
          onTouchCancel={handleLeftLongPressEnd}
          onMouseDown={handleLeftLongPressStart}
          onMouseUp={handleLeftLongPressEnd}
          onMouseLeave={handleLeftLongPressEnd}
        >
          <ScrollArea className="h-full">
            {currentEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Skull className="h-8 w-8 text-zinc-600 mb-3" />
                <p className="text-zinc-500 text-sm">
                  No hay sombras aún
                </p>
                <p className="text-zinc-600 text-xs mt-2">Mantené presionado para agregar</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {currentEntries.map((entry, index) => (
                  <div key={entry.id}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setViewingEntry(entry); }}
                      className={`w-full text-left px-3 py-2 rounded text-sm transition-all cursor-pointer select-none ${
                        viewingEntry?.id === entry.id 
                          ? "bg-zinc-700 text-zinc-100 shadow-sm" 
                          : "text-zinc-400 hover:bg-zinc-700/50 hover:text-zinc-200"
                      }`}
                      data-testid={`card-shadows-${entry.id}`}
                    >
                      {entry.name}
                    </button>
                    {index < currentEntries.length - 1 && (
                      <div className="h-px bg-zinc-700/30 mx-2" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
        
        <div 
          className="w-1/2 bg-zinc-800/20 rounded border border-zinc-700/50 p-4 cursor-pointer select-none shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)]"
          onTouchStart={handleRightLongPressStart}
          onTouchEnd={handleRightLongPressEnd}
          onTouchCancel={handleRightLongPressEnd}
          onMouseDown={handleRightLongPressStart}
          onMouseUp={handleRightLongPressEnd}
          onMouseLeave={handleRightLongPressEnd}
        >
          <ScrollArea className="h-full">
            {viewingEntry ? (
              <div className="space-y-4">
                <div className="border-b border-zinc-700/50 pb-2">
                  <h3 className="font-medium text-zinc-100 uppercase tracking-wide">{viewingEntry.name}</h3>
                  <div className="h-px w-12 bg-gradient-to-r from-zinc-500 to-transparent mt-2" />
                </div>
                {viewingEntry.description && (
                  <p className="text-sm text-zinc-400 whitespace-pre-line leading-relaxed">{viewingEntry.description}</p>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-zinc-600 text-sm">
                Seleccioná una entrada
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

interface ProfileEntry {
  id: string;
  name: string;
  description: string;
}

function ProfileSection() {
  const queryClient = useQueryClient();
  const [profileMission, setProfileMission] = useState("");
  const [profileAbout, setProfileAbout] = useState("");
  const [activeTab, setActiveTab] = useState("mission");
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  
  // For list-based entries (values and likes)
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<ProfileEntry | null>(null);
  const [viewingEntry, setViewingEntry] = useState<ProfileEntry | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [extraInfo, setExtraInfo] = useState("");
  
  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: profile, isLoading: profileLoading } = useQuery<{ user: { profileMission: string; profileAbout: string } }>({
    queryKey: ["/api/me"],
    queryFn: async () => {
      const res = await fetch("/api/me");
      return res.json();
    },
  });

  const { data: profileValues = [], isLoading: valuesLoading } = useQuery<ProfileEntry[]>({
    queryKey: ["/api/profile/values"],
    queryFn: async () => {
      const res = await fetch("/api/profile/values");
      return res.json();
    },
  });

  const { data: profileLikes = [], isLoading: likesLoading } = useQuery<ProfileEntry[]>({
    queryKey: ["/api/profile/likes"],
    queryFn: async () => {
      const res = await fetch("/api/profile/likes");
      return res.json();
    },
  });

  useEffect(() => {
    if (profile?.user) {
      setProfileMission(profile.user.profileMission || "");
      setProfileAbout(profile.user.profileAbout || "");
    }
  }, [profile]);

  const updateProfile = useMutation({
    mutationFn: async (data: { profileMission?: string; profileAbout?: string }) => {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
      setIsEditing(false);
    },
  });

  const createValue = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      const res = await fetch("/api/profile/values", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile/values"] });
      setIsAdding(false);
      setName("");
      setDescription("");
    },
  });

  const updateValue = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; description?: string } }) => {
      const res = await fetch(`/api/profile/values/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile/values"] });
      setSelectedEntry(null);
      setIsEditMode(false);
    },
  });

  const deleteValue = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/profile/values/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile/values"] });
      setSelectedEntry(null);
      setShowDeleteConfirm(false);
    },
  });

  const createLike = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      const res = await fetch("/api/profile/likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile/likes"] });
      setIsAdding(false);
      setName("");
      setDescription("");
    },
  });

  const updateLike = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; description?: string } }) => {
      const res = await fetch(`/api/profile/likes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile/likes"] });
      setSelectedEntry(null);
      setIsEditMode(false);
    },
  });

  const deleteLike = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/profile/likes/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile/likes"] });
      setSelectedEntry(null);
      setShowDeleteConfirm(false);
    },
  });

  const tabs = [
    { id: "mission", label: "Misión", title: "MI MISIÓN", isText: true },
    { id: "values", label: "Valores", title: "MIS VALORES", isText: false },
    { id: "likes", label: "Gustos", title: "LO QUE ME GUSTA", isText: false },
    { id: "about", label: "Sobre mí", title: "SOBRE MÍ", isText: true },
  ];

  const currentTab = tabs.find(t => t.id === activeTab) || tabs[0];
  const currentEntries = activeTab === "values" ? profileValues : activeTab === "likes" ? profileLikes : [];
  const currentTextValue = activeTab === "mission" ? profileMission : activeTab === "about" ? profileAbout : "";

  const handleTextSave = () => {
    const updates = activeTab === "mission" 
      ? { profileMission: editValue }
      : { profileAbout: editValue };
    updateProfile.mutate(updates);
  };

  const handleAddNew = () => {
    if (!name.trim()) return;
    if (activeTab === "values") {
      createValue.mutate({ name: name.trim(), description: description.trim() });
    } else if (activeTab === "likes") {
      createLike.mutate({ name: name.trim(), description: description.trim() });
    }
  };

  const handleSaveEdit = () => {
    if (!selectedEntry || !name.trim()) return;
    if (activeTab === "values") {
      updateValue.mutate({ id: selectedEntry.id, data: { name: name.trim(), description: description.trim() } });
    } else if (activeTab === "likes") {
      updateLike.mutate({ id: selectedEntry.id, data: { name: name.trim(), description: description.trim() } });
    }
  };

  const handleDelete = () => {
    if (!selectedEntry) return;
    if (activeTab === "values") {
      deleteValue.mutate(selectedEntry.id);
    } else if (activeTab === "likes") {
      deleteLike.mutate(selectedEntry.id);
    }
  };

  const handleAddExtraInfo = () => {
    if (!selectedEntry || !extraInfo.trim()) return;
    const newDesc = selectedEntry.description 
      ? `${selectedEntry.description}\n${extraInfo.trim()}`
      : extraInfo.trim();
    if (activeTab === "values") {
      updateValue.mutate({ id: selectedEntry.id, data: { description: newDesc } });
    } else if (activeTab === "likes") {
      updateLike.mutate({ id: selectedEntry.id, data: { description: newDesc } });
    }
    setExtraInfo("");
  };

  const handleCloseDialog = () => {
    setSelectedEntry(null);
    setIsEditMode(false);
    setShowDeleteConfirm(false);
    setName("");
    setDescription("");
    setExtraInfo("");
  };

  const handleTextLongPressStart = () => {
    longPressTimer.current = setTimeout(() => {
      setEditValue(currentTextValue);
      setIsEditing(true);
    }, 500);
  };

  const handleTextLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleLeftLongPressStart = () => {
    longPressTimer.current = setTimeout(() => {
      setName("");
      setDescription("");
      setIsAdding(true);
    }, 500);
  };

  const handleLeftLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleRightLongPressStart = () => {
    if (!viewingEntry) return;
    longPressTimer.current = setTimeout(() => {
      setSelectedEntry(viewingEntry);
      setName(viewingEntry.name);
      setDescription(viewingEntry.description);
    }, 500);
  };

  const handleRightLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  if (profileLoading || valuesLoading || likesLoading) {
    return <div className="text-zinc-500 text-sm">Cargando...</div>;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Text editing dialog for mission/about */}
      <Dialog open={isEditing} onOpenChange={(open) => !open && setIsEditing(false)}>
        <DialogContent className="sm:max-w-md bg-zinc-900 border border-zinc-700">
          <VisuallyHidden>
            <DialogTitle>{currentTab.title}</DialogTitle>
          </VisuallyHidden>
          
          <div className="space-y-3">
            <div className="border-b border-zinc-700/50 pb-2">
              <h3 className="text-sm font-medium text-zinc-100">{currentTab.title}</h3>
              <div className="h-px w-8 bg-gradient-to-r from-zinc-500 to-transparent mt-1" />
            </div>
            
            <Textarea
              placeholder={activeTab === "mission" ? "¿Cuál es tu propósito?" : "Describe quién eres..."}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              rows={6}
              className="bg-zinc-800 border-zinc-700 text-zinc-200 placeholder:text-zinc-500 resize-none text-sm"
              data-testid={`input-profile-${activeTab}`}
              autoFocus
            />
            
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={handleTextSave} className="bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-xs">
                Guardar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} className="text-zinc-400 hover:text-zinc-300 text-xs">
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add entry dialog for values/likes */}
      <Dialog open={isAdding} onOpenChange={(open) => !open && setIsAdding(false)}>
        <DialogContent className="sm:max-w-md bg-zinc-900 border border-zinc-700">
          <VisuallyHidden>
            <DialogTitle>Agregar {activeTab === "values" ? "Valor" : "Gusto"}</DialogTitle>
          </VisuallyHidden>
          
          <div className="space-y-4">
            <div className="border-b border-zinc-700/50 pb-2">
              <h3 className="font-medium text-zinc-100">Agregar {activeTab === "values" ? "Valor" : "Gusto"}</h3>
              <div className="h-px w-8 bg-gradient-to-r from-zinc-500 to-transparent mt-1" />
            </div>
            <Input
              placeholder="NOMBRE"
              value={name}
              onChange={(e) => setName(e.target.value.toUpperCase())}
              className="uppercase bg-zinc-800 border-zinc-700 text-zinc-200 placeholder:text-zinc-500"
              data-testid={`input-profile-${activeTab}-name`}
            />
            <Textarea
              placeholder="Descripción"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="bg-zinc-800 border-zinc-700 text-zinc-200 placeholder:text-zinc-500 resize-none"
              data-testid={`input-profile-${activeTab}-description`}
            />
            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={handleAddNew} className="bg-zinc-700 hover:bg-zinc-600 text-zinc-200">
                Agregar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)} className="text-zinc-400 hover:text-zinc-300">
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit entry dialog for values/likes */}
      <Dialog open={!!selectedEntry} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="sm:max-w-md bg-zinc-900 border border-zinc-700">
          <VisuallyHidden>
            <DialogTitle>{selectedEntry?.name}</DialogTitle>
          </VisuallyHidden>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-700/50 pb-2">
              <div>
                <h3 className="font-medium text-zinc-100 uppercase">{selectedEntry?.name}</h3>
                <div className="h-px w-8 bg-gradient-to-r from-zinc-500 to-transparent mt-1" />
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => setIsEditMode(!isEditMode)} className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-200">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowDeleteConfirm(true)} className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-200">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {selectedEntry?.description && !isEditMode && (
              <p className="text-sm text-zinc-400 whitespace-pre-line leading-relaxed">{selectedEntry.description}</p>
            )}

            {!isEditMode ? (
              <div className="flex gap-2">
                <Input
                  placeholder="Agregar más info..."
                  value={extraInfo}
                  onChange={(e) => setExtraInfo(e.target.value)}
                  className="flex-1 bg-zinc-800 border-zinc-700 text-zinc-200 placeholder:text-zinc-500"
                />
                <Button size="sm" variant="ghost" onClick={handleAddExtraInfo} disabled={!extraInfo.trim()} className="text-zinc-400 hover:text-zinc-200">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Input
                  placeholder="NOMBRE"
                  value={name}
                  onChange={(e) => setName(e.target.value.toUpperCase())}
                  className="uppercase bg-zinc-800 border-zinc-700 text-zinc-200 placeholder:text-zinc-500"
                />
                <Textarea
                  placeholder="Descripción"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="bg-zinc-800 border-zinc-700 text-zinc-200 placeholder:text-zinc-500 resize-none"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveEdit} className="bg-zinc-700 hover:bg-zinc-600 text-zinc-200">
                    Guardar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setIsEditMode(false)} className="text-zinc-400 hover:text-zinc-300">
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>

          {showDeleteConfirm && (
            <div className="pt-4 border-t border-zinc-700 mt-4">
              <p className="text-sm text-zinc-400 mb-3">¿Eliminar esta entrada?</p>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleDelete} className="bg-red-900/50 hover:bg-red-900 text-red-200">
                  Eliminar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowDeleteConfirm(false)} className="text-zinc-400 hover:text-zinc-300">
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="flex border-b border-zinc-700 mb-3">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setViewingEntry(null); }}
            className={`px-3 py-1.5 text-xs transition-colors border-b-2 -mb-[1px] ${
              activeTab === tab.id 
                ? "border-zinc-400 text-zinc-200" 
                : "border-transparent text-zinc-500 hover:text-zinc-400"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Text-based tabs (mission/about) */}
      {currentTab.isText && (
        <div 
          className="flex-1 flex cursor-pointer select-none"
          onTouchStart={handleTextLongPressStart}
          onTouchEnd={handleTextLongPressEnd}
          onTouchCancel={handleTextLongPressEnd}
          onMouseDown={handleTextLongPressStart}
          onMouseUp={handleTextLongPressEnd}
          onMouseLeave={handleTextLongPressEnd}
        >
          <div className="flex-1 flex flex-col">
            <div className="text-xs text-zinc-500 border-b border-zinc-800 pb-1 mb-2">
              {currentTab.title}
            </div>
            
            <ScrollArea className="flex-1">
              {currentTextValue ? (
                <p className="text-sm text-zinc-300 whitespace-pre-line leading-relaxed">{currentTextValue}</p>
              ) : (
                <p className="text-zinc-600 italic text-sm">
                  Mantené presionado para agregar información...
                </p>
              )}
            </ScrollArea>
          </div>
        </div>
      )}

      {/* List-based tabs (values/likes) */}
      {!currentTab.isText && (
        <>
          <div className="mb-3 pb-2 border-b border-zinc-700/50">
            <span className="text-xs text-zinc-500 uppercase tracking-wider">
              {currentEntries.length} {activeTab === "values" ? "valores" : "gustos"}
            </span>
            <div className="h-px w-8 bg-gradient-to-r from-zinc-600 to-transparent mt-1" />
          </div>

          <div className="flex flex-1 min-h-0 gap-2">
            <div 
              className="w-1/2 bg-zinc-800/30 rounded border border-zinc-700/50 p-3 cursor-pointer select-none shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]"
              onTouchStart={handleLeftLongPressStart}
              onTouchEnd={handleLeftLongPressEnd}
              onTouchCancel={handleLeftLongPressEnd}
              onMouseDown={handleLeftLongPressStart}
              onMouseUp={handleLeftLongPressEnd}
              onMouseLeave={handleLeftLongPressEnd}
            >
              <ScrollArea className="h-full">
                {currentEntries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <p className="text-zinc-500 text-sm">
                      No hay {activeTab === "values" ? "valores" : "gustos"} aún
                    </p>
                    <p className="text-zinc-600 text-xs mt-2">Mantené presionado para agregar</p>
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {currentEntries.map((entry, index) => (
                      <div key={entry.id}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setViewingEntry(entry); }}
                          className={`w-full text-left px-3 py-2 rounded text-sm transition-all cursor-pointer select-none ${
                            viewingEntry?.id === entry.id 
                              ? "bg-zinc-700 text-zinc-100 shadow-sm" 
                              : "text-zinc-400 hover:bg-zinc-700/50 hover:text-zinc-200"
                          }`}
                          data-testid={`card-profile-${activeTab}-${entry.id}`}
                        >
                          {entry.name}
                        </button>
                        {index < currentEntries.length - 1 && (
                          <div className="h-px bg-zinc-700/30 mx-2" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
            
            <div 
              className="w-1/2 bg-zinc-800/20 rounded border border-zinc-700/50 p-4 cursor-pointer select-none shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)]"
              onTouchStart={handleRightLongPressStart}
              onTouchEnd={handleRightLongPressEnd}
              onTouchCancel={handleRightLongPressEnd}
              onMouseDown={handleRightLongPressStart}
              onMouseUp={handleRightLongPressEnd}
              onMouseLeave={handleRightLongPressEnd}
            >
              <ScrollArea className="h-full">
                {viewingEntry ? (
                  <div className="space-y-4">
                    <div className="border-b border-zinc-700/50 pb-2">
                      <h3 className="font-medium text-zinc-100 uppercase tracking-wide">{viewingEntry.name}</h3>
                      <div className="h-px w-12 bg-gradient-to-r from-zinc-500 to-transparent mt-2" />
                    </div>
                    {viewingEntry.description && (
                      <p className="text-sm text-zinc-400 whitespace-pre-line leading-relaxed">{viewingEntry.description}</p>
                    )}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-zinc-600 text-sm">
                    Seleccioná una entrada
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface SkillWithSource extends Skill {
  sourceName: string;
  sourceSkills: Skill[];
}

interface SourceGroup {
  name: string;
  skills: SkillWithSource[];
}

function AchievementsSection() {
  const { areas, mainQuests, sideQuests } = useSkillTree();
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [selectedSubtasks, setSelectedSubtasks] = useState<Skill[]>([]);
  const [selectedSubtaskId, setSelectedSubtaskId] = useState<string | null>(null);
  const [selectedSourceSkills, setSelectedSourceSkills] = useState<Skill[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  
  // Group completed skills by source
  const sourceGroups: SourceGroup[] = [];
  
  // Sort function to order skills like in the skill tree
  const sortByPosition = (a: Skill, b: Skill) => {
    if (a.level !== b.level) return a.level - b.level;
    return a.y - b.y;
  };

  // From areas
  areas.forEach(area => {
    const completedSkills = area.skills
      .filter(s => s.status === "mastered" && s.title.toLowerCase() !== "inicio")
      .sort(sortByPosition)
      .map(skill => ({ ...skill, sourceName: area.name, sourceSkills: area.skills }));
    if (completedSkills.length > 0) {
      sourceGroups.push({ name: area.name, skills: completedSkills });
    }
  });
  
  // From main quests
  mainQuests.forEach(project => {
    const completedSkills = project.skills
      .filter(s => s.status === "mastered" && s.title.toLowerCase() !== "inicio")
      .sort(sortByPosition)
      .map(skill => ({ ...skill, sourceName: project.name, sourceSkills: project.skills }));
    if (completedSkills.length > 0) {
      sourceGroups.push({ name: project.name, skills: completedSkills });
    }
  });
  
  // From side quests
  sideQuests.forEach(project => {
    const completedSkills = project.skills
      .filter(s => s.status === "mastered" && s.title.toLowerCase() !== "inicio")
      .sort(sortByPosition)
      .map(skill => ({ ...skill, sourceName: project.name, sourceSkills: project.skills }));
    if (completedSkills.length > 0) {
      sourceGroups.push({ name: project.name, skills: completedSkills });
    }
  });
  
  const allCompletedSkills = sourceGroups.flatMap(g => g.skills);
  const selectedSkill = allCompletedSkills.find(s => s.id === selectedSkillId);
  const selectedSubtask = selectedSubtasks.find(s => s.id === selectedSubtaskId);
  const hasSubtasks = selectedSubtasks.length > 0;

  const toggleGroup = (name: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const findNextSkill = (currentSkill: Skill, allSkills: Skill[]): Skill | undefined => {
    const sameLevelSkills = allSkills
      .filter(s => s.level === currentSkill.level && s.y > currentSkill.y)
      .sort((a, b) => a.y - b.y);
    return sameLevelSkills[0];
  };

  const nextSkillForSelected = selectedSkill ? findNextSkill(selectedSkill, selectedSourceSkills) : undefined;
  const nextSubtaskForSelected = selectedSubtask ? findNextSkill(selectedSubtask, selectedSubtasks) : undefined;
  
  const handleSelectSkill = async (skill: SkillWithSource) => {
    setSelectedSkillId(skill.id);
    setSelectedSubtaskId(null);
    setSelectedSourceSkills(skill.sourceSkills);
    try {
      const response = await fetch(`/api/skills/${skill.id}/subskills`);
      const allSubtasks = await response.json();
      const visibleLevels = calculateVisibleLevels(allSubtasks);
      const visibleSubtasks = allSubtasks
        .filter((s: Skill) => {
          const title = s.title.toLowerCase();
          const isPlaceholder = title === "inicio" || title.includes("next challenge") || title.includes("next challange");
          return visibleLevels.has(s.level) && !isPlaceholder;
        })
        .sort(sortByPosition);
      setSelectedSubtasks(visibleSubtasks);
    } catch {
      setSelectedSubtasks([]);
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      <div className={`${hasSubtasks ? 'w-1/3' : 'w-1/2'} h-full overflow-hidden border-r border-border pr-4`}>
        <ScrollArea className="h-full">
          {sourceGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Scroll className="h-8 w-8 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground text-sm">No completed tasks</p>
            </div>
          ) : (
            <div className="space-y-1">
              {sourceGroups.map((group) => (
                <div key={group.name}>
                  <button
                    onClick={() => toggleGroup(group.name)}
                    className="w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-muted/50 flex items-center justify-between"
                    data-testid={`group-${group.name}`}
                  >
                    <span>{group.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {expandedGroups.has(group.name) ? "▼" : "▶"} {group.skills.length}
                    </span>
                  </button>
                  {expandedGroups.has(group.name) && (
                    <div className="ml-3 border-l border-border pl-2 space-y-0.5">
                      {group.skills.map((skill) => (
                        <button
                          key={skill.id}
                          onClick={() => handleSelectSkill(skill)}
                          className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
                            selectedSkillId === skill.id 
                              ? "bg-muted text-foreground" 
                              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                          }`}
                          data-testid={`diary-entry-${skill.id}`}
                        >
                          {skill.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
      
      {hasSubtasks && (
        <div className="w-1/3 h-full overflow-hidden border-r border-border px-4 flex flex-col">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2 flex-shrink-0">Subtasks</p>
          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-1">
              {selectedSubtasks.map((subtask) => (
                <button
                  key={subtask.id}
                  onClick={() => setSelectedSubtaskId(subtask.id)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    selectedSubtaskId === subtask.id
                      ? "bg-muted text-foreground"
                      : subtask.status === "mastered"
                        ? "text-foreground hover:bg-muted/50"
                        : "text-muted-foreground/50 hover:bg-muted/30"
                  }`}
                >
                  {subtask.title}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
      
      <div className={`${hasSubtasks ? 'w-1/3' : 'w-1/2'} h-full pl-4 overflow-hidden`}>
        <div className="h-full overflow-y-auto overscroll-contain touch-pan-y pr-2 minimal-scrollbar">
          {selectedSubtask ? (
            <div className="space-y-4">
              <h3 className="font-medium text-foreground">
                {selectedSubtask.title}
              </h3>
              {selectedSubtask.description && (
                <p className="text-sm text-muted-foreground">
                  {selectedSubtask.description}
                </p>
              )}
              {selectedSubtask.feedback && (
                <div className="pt-2">
                  <p className="text-xs text-foreground uppercase tracking-wide mb-2">Feedback</p>
                  <p className="text-sm text-yellow-500 dark:text-yellow-400 leading-relaxed">
                    {selectedSubtask.feedback}
                  </p>
                </div>
              )}
            </div>
          ) : selectedSkill ? (
            <div className="space-y-4">
              <h3 className="font-medium text-foreground">
                {selectedSkill.title}
              </h3>
              <p className="text-xs text-muted-foreground/60">{selectedSkill.sourceName}</p>
              {selectedSkill.description && (
                <p className="text-sm text-muted-foreground">
                  {selectedSkill.description}
                </p>
              )}
              {(selectedSkill.feedback || selectedSubtasks.some(s => s.feedback)) && (
                <div className="pt-2">
                  <p className="text-xs text-foreground uppercase tracking-wide mb-2">Feedback</p>
                  {selectedSkill.feedback && (
                    <p className="text-sm text-yellow-500 dark:text-yellow-400 leading-relaxed">
                      {selectedSkill.feedback}
                    </p>
                  )}
                  {selectedSubtasks.filter(s => s.feedback).length > 0 && (
                    <div className={selectedSkill.feedback ? "mt-4 space-y-3" : "space-y-3"}>
                      {selectedSubtasks.filter(s => s.feedback).map((subtask) => (
                        <div key={subtask.id} className="border-t border-dotted border-muted-foreground/30 pt-3">
                          <p className="text-xs text-muted-foreground mb-1">{subtask.title}</p>
                          <p className="text-sm text-yellow-500 dark:text-yellow-400 leading-relaxed">
                            {subtask.feedback}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground/40 text-sm">
              Select a task
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QuestDiary() {
  const { isDiaryOpen, closeDiary } = useDiary();
  const queryClient = useQueryClient();

  const { data: characters = [], isLoading: loadingCharacters } = useQuery<JournalCharacter[]>({
    queryKey: ["/api/journal/characters"],
    enabled: isDiaryOpen,
  });

  const { data: places = [], isLoading: loadingPlaces } = useQuery<JournalPlace[]>({
    queryKey: ["/api/journal/places"],
    enabled: isDiaryOpen,
  });

  const { data: shadows = [], isLoading: loadingShadows } = useQuery<JournalShadow[]>({
    queryKey: ["/api/journal/shadows"],
    enabled: isDiaryOpen,
  });

  const createCharacter = useMutation({
    mutationFn: async (data: { name: string; action: string; description: string }) => {
      const res = await fetch("/api/journal/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/journal/characters"] }),
  });

  const updateCharacter = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; action: string; description: string } }) => {
      const res = await fetch(`/api/journal/characters/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/journal/characters"] }),
  });

  const deleteCharacter = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/journal/characters/${id}`, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/journal/characters"] }),
  });

  const createPlace = useMutation({
    mutationFn: async (data: { name: string; action: string; description: string }) => {
      const res = await fetch("/api/journal/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/journal/places"] }),
  });

  const updatePlace = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; action: string; description: string } }) => {
      const res = await fetch(`/api/journal/places/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/journal/places"] }),
  });

  const deletePlace = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/journal/places/${id}`, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/journal/places"] }),
  });

  const createShadow = useMutation({
    mutationFn: async (data: { name: string; action: string; description: string }) => {
      const res = await fetch("/api/journal/shadows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/journal/shadows"] }),
  });

  const updateShadow = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; action: string; description: string } }) => {
      const res = await fetch(`/api/journal/shadows/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/journal/shadows"] }),
  });

  const markShadowDefeated = useMutation({
    mutationFn: async ({ id, defeated }: { id: string; defeated: 0 | 1 }) => {
      const res = await fetch(`/api/journal/shadows/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defeated }),
      });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/journal/shadows"] }),
  });

  const deleteShadow = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/journal/shadows/${id}`, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/journal/shadows"] }),
  });
  
  return (
    <Dialog open={isDiaryOpen} onOpenChange={(open) => !open && closeDiary()}>
      <DialogContent className="max-w-4xl h-[75vh] p-0 overflow-hidden bg-zinc-900 border-2 border-zinc-700 shadow-2xl">
        <VisuallyHidden>
          <DialogTitle>Journal</DialogTitle>
        </VisuallyHidden>
        <div className="flex h-full">
          <Tabs defaultValue="achievements" className="flex-1 flex" orientation="vertical">
            <TabsList className="flex flex-col h-full justify-start gap-0.5 p-1.5 rounded-none border-r-2 border-zinc-700 bg-zinc-800/50 shadow-[inset_-4px_0_8px_rgba(0,0,0,0.3)]">
              <TabsTrigger value="achievements" className="p-2.5 rounded data-[state=active]:bg-zinc-700 data-[state=active]:shadow-inner text-zinc-400 data-[state=active]:text-zinc-100 transition-all" data-testid="tab-achievements" title="Achievements">
                <Scroll className="h-5 w-5" />
              </TabsTrigger>
              <div className="h-px bg-zinc-700/50 my-1 mx-1" />
              <TabsTrigger value="characters" className="p-2.5 rounded data-[state=active]:bg-zinc-700 data-[state=active]:shadow-inner text-zinc-400 data-[state=active]:text-zinc-100 transition-all" data-testid="tab-characters" title="Characters">
                <Users className="h-5 w-5" />
              </TabsTrigger>
              <TabsTrigger value="places" className="p-2.5 rounded data-[state=active]:bg-zinc-700 data-[state=active]:shadow-inner text-zinc-400 data-[state=active]:text-zinc-100 transition-all" data-testid="tab-places" title="Places">
                <MapIcon className="h-5 w-5" />
              </TabsTrigger>
              <TabsTrigger value="shadows" className="p-2.5 rounded data-[state=active]:bg-zinc-700 data-[state=active]:shadow-inner text-zinc-400 data-[state=active]:text-zinc-100 transition-all" data-testid="tab-shadows" title="Shadows">
                <Skull className="h-5 w-5" />
              </TabsTrigger>
              <div className="h-px bg-zinc-700/50 my-1 mx-1" />
              <TabsTrigger value="profile" className="p-2.5 rounded data-[state=active]:bg-zinc-700 data-[state=active]:shadow-inner text-zinc-400 data-[state=active]:text-zinc-100 transition-all" data-testid="tab-profile" title="Mi Perfil">
                <User className="h-5 w-5" />
              </TabsTrigger>
            </TabsList>
            
            <div className="flex-1 p-6 overflow-hidden bg-zinc-900">
              <div className="mb-4 pb-3 border-b border-zinc-700">
                <h2 className="text-xl font-bold tracking-tight text-zinc-100">Journal</h2>
                <div className="h-0.5 w-16 bg-gradient-to-r from-zinc-500 to-transparent mt-2" />
              </div>
              
              <TabsContent value="achievements" className="h-[calc(100%-4rem)] mt-0 overflow-hidden">
                <AchievementsSection />
              </TabsContent>
              
              <TabsContent value="characters" className="h-[calc(100%-4rem)] mt-0">
                <JournalSection
                  type="characters"
                  entries={characters}
                  isLoading={loadingCharacters}
                  onAdd={(data) => createCharacter.mutate(data)}
                  onEdit={(id, data) => updateCharacter.mutate({ id, data })}
                  onDelete={(id) => deleteCharacter.mutate(id)}
                />
              </TabsContent>
              
              <TabsContent value="places" className="h-[calc(100%-4rem)] mt-0">
                <JournalSection
                  type="places"
                  entries={places}
                  isLoading={loadingPlaces}
                  onAdd={(data) => createPlace.mutate(data)}
                  onEdit={(id, data) => updatePlace.mutate({ id, data })}
                  onDelete={(id) => deletePlace.mutate(id)}
                />
              </TabsContent>
              
              <TabsContent value="shadows" className="h-[calc(100%-4rem)] mt-0">
                <ShadowsSection
                  entries={shadows}
                  isLoading={loadingShadows}
                  onAdd={(data) => createShadow.mutate(data)}
                  onEdit={(id, data) => updateShadow.mutate({ id, data })}
                  onDelete={(id) => deleteShadow.mutate(id)}
                  onMarkDefeated={(id, defeated) => markShadowDefeated.mutate({ id, defeated })}
                />
              </TabsContent>
              
              <TabsContent value="profile" className="h-[calc(100%-4rem)] mt-0">
                <ProfileSection />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}


function SkillCanvas() {
  const { 
    activeArea, 
    activeProject, 
    toggleSkillStatus, 
    toggleProjectSkillStatus,
    activeParentSkillId,
    parentSkillStack,
    subSkills,
    exitSubSkillTree,
    toggleSubSkillStatus,
    deleteSubSkillTree,
    showLevelUp,
    showCompleted,
    addSkill,
    updateSkill,
    updateProjectSkill
  } = useSkillTree();
  
  const [isStuckDialogOpen, setIsStuckDialogOpen] = useState(false);
  const [stuckStep, setStuckStep] = useState(0);
  const [stuckProblem, setStuckProblem] = useState("");
  const [stuckSkill, setStuckSkill] = useState("");
  const [stuckAction, setStuckAction] = useState("");
  const [stuckTitle, setStuckTitle] = useState("");

  const handleStuckDialogClose = (open: boolean) => {
    if (!open) {
      setStuckStep(0);
      setStuckProblem("");
      setStuckSkill("");
      setStuckAction("");
      setStuckTitle("");
    }
    setIsStuckDialogOpen(open);
  };

  const handleCreateStuckNode = async () => {
    const activeItem = activeArea || activeProject;
    if (!activeItem) return;
    
    const skills = activeItem.skills;
    
    // Sort skills by level then by Y position (skill tree order)
    const sortedSkills = [...skills].sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level;
      return a.y - b.y;
    });
    
    // Find the first "next challenge" node in the visible levels
    let targetSkill = sortedSkills.find(s => 
      s.title.toLowerCase() === "next challenge" || 
      s.title.toLowerCase() === "next challange"
    );
    
    // If no "next challenge" found, find the first node of the next level after current visible
    if (!targetSkill) {
      // Get visible levels
      const visibleLevels = calculateVisibleLevels(skills);
      const visibleLevelArray = Array.from(visibleLevels).sort((a, b) => a - b);
      const maxVisibleLevel = visibleLevelArray.length > 0 ? Math.max(...visibleLevelArray) : 0;
      
      // Find the first node of the next level (maxVisibleLevel + 1)
      const nextLevel = maxVisibleLevel + 1;
      const nextLevelSkills = sortedSkills.filter(s => s.level === nextLevel);
      
      if (nextLevelSkills.length > 0) {
        // Get the first node of next level (lowest Y position)
        targetSkill = nextLevelSkills.reduce((min, s) => s.y < min.y ? s : min, nextLevelSkills[0]);
      } else {
        // No next level exists, use first node of the highest visible level
        const highestLevelSkills = sortedSkills.filter(s => s.level === maxVisibleLevel);
        if (highestLevelSkills.length > 0) {
          targetSkill = highestLevelSkills.reduce((min, s) => s.y < min.y ? s : min, highestLevelSkills[0]);
        }
      }
    }
    
    // Use target skill position or create at end
    const targetX = targetSkill ? targetSkill.x : 50;
    const targetY = targetSkill ? targetSkill.y : (skills.length > 0 ? Math.max(...skills.map(s => s.y)) + 80 : 100);
    const targetLevel = targetSkill ? targetSkill.level : (skills.length > 0 ? Math.max(...skills.map(s => s.level)) : 1);
    const targetLevelPosition = targetSkill ? targetSkill.levelPosition : 1;
    
    const newSkill: Omit<Skill, "id"> = {
      areaId: activeArea ? activeArea.id : undefined,
      projectId: activeProject ? activeProject.id : undefined,
      parentSkillId: undefined,
      title: stuckTitle,
      description: stuckAction,
      feedback: `Problema: ${stuckProblem}\n\nHabilidad necesaria: ${stuckSkill}`,
      status: "available" as const,
      x: targetX,
      y: targetY,
      dependencies: [],
      manualLock: 0 as 0 | 1,
      isFinalNode: 0 as 0 | 1,
      level: targetLevel,
      levelPosition: targetLevelPosition
    };
    
    // Always update the target skill (whether it's "next challenge" or first node of next level)
    if (targetSkill) {
      const updates = {
        title: stuckTitle,
        description: stuckAction,
        feedback: `Problema: ${stuckProblem}\n\nHabilidad necesaria: ${stuckSkill}`
      };
      if (activeArea) {
        updateSkill(activeArea.id, targetSkill.id, updates);
      } else if (activeProject) {
        updateProjectSkill(activeProject.id, targetSkill.id, updates);
      }
    } else {
      // Only create new if no target skill exists at all
      if (activeArea) {
        await addSkill(activeArea.id, newSkill);
      } else if (activeProject) {
        await addSkill(activeProject.id, newSkill);
      }
    }
    
    handleStuckDialogClose(false);
  };

  const activeItem = activeArea || activeProject;
  const isProject = !activeArea && !!activeProject;
  const isSubSkillView = !!activeParentSkillId;

  if (isSubSkillView) {
    const currentParent = parentSkillStack[parentSkillStack.length - 1];
    
    // Apply the same visibility logic to sub-skills
    const subSkillVisibleLevels = calculateVisibleLevels(subSkills);
    const visibleSkills = subSkills.filter(s => subSkillVisibleLevels.has(s.level));

    const firstSkillOfLevel = new Set<string>();
    const levelGroups = new Map<number, typeof visibleSkills>();
    
    visibleSkills.forEach(skill => {
      if (!levelGroups.has(skill.level)) {
        levelGroups.set(skill.level, []);
      }
      levelGroups.get(skill.level)!.push(skill);
    });
    
    levelGroups.forEach((skills) => {
      const firstSkill = skills.reduce((min, s) => s.y < min.y ? s : min, skills[0]);
      if (firstSkill) {
        firstSkillOfLevel.add(firstSkill.id);
      }
    });

    const maxY = visibleSkills.length > 0 ? Math.max(...visibleSkills.map(s => s.y), 400) : 400;
    const containerHeight = maxY + 200;

    return (
      <div className="flex-1 relative overflow-hidden bg-background flex flex-col">
        <AnimatePresence>
          {showLevelUp && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.span
                className="text-4xl font-bold tracking-widest uppercase text-foreground"
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -100, opacity: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              >
                level up
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {showCompleted && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.span
                className="text-4xl font-bold tracking-widest uppercase text-foreground"
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -100, opacity: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              >
                completed
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex-1 overflow-y-auto p-8 scroll-smooth">
          <div className="w-full relative max-w-4xl mx-auto mt-10 min-h-full">
            
            <div className="absolute top-0 left-0 z-10 sticky">
              <div className="flex items-center gap-3 mb-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={exitSubSkillTree}
                  data-testid="button-back"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <h2 className="text-2xl font-bold tracking-tight">
                  {currentParent?.title || "SubQuests"}
                </h2>
              </div>
              <p className="text-muted-foreground max-w-md text-sm leading-relaxed ml-11">
                Completa cada paso para avanzar
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    className="text-muted-foreground/50 hover:text-destructive text-xs ml-11 mt-1 flex items-center gap-1 transition-colors"
                    data-testid="button-delete-subtree"
                  >
                    <Trash2 className="h-3 w-3" />
                    Borrar skill tree
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar skill tree de "{currentParent?.title}"?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta acción no se puede deshacer. Se eliminarán permanentemente todas las sub-habilidades de este nodo.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        try {
                          await deleteSubSkillTree();
                        } catch (error) {
                          console.error("Error al borrar las sub-habilidades:", error);
                          alert("Error al borrar las sub-habilidades. Por favor, intenta de nuevo.");
                        }
                      }}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <div 
              className="relative w-full mt-20 transition-all duration-500 ease-in-out"
              style={{ height: `${containerHeight}px`, minHeight: "600px" }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeParentSkillId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4 }}
                  className="w-full h-full relative"
                >
                  {Array.from(levelGroups.entries()).flatMap(([level, skills]) => {
                    const sortedByY = [...skills].sort((a, b) => a.y - b.y);
                    const connections = [];
                    const itemColor = "text-zinc-800 dark:text-zinc-200";
                    
                    for (let i = 0; i < sortedByY.length - 1; i++) {
                      const parentSkill = sortedByY[i];
                      const childSkill = sortedByY[i + 1];
                      const isActive = parentSkill.status === "mastered";
                      
                      connections.push(
                        <SkillConnection
                          key={`${parentSkill.id}-${childSkill.id}`}
                          start={parentSkill}
                          end={childSkill}
                          active={isActive}
                          areaColor={itemColor}
                        />
                      );
                    }
                    
                    return connections;
                  })}

                  {visibleSkills.map((skill, index) => {
                    const itemColor = "text-zinc-800 dark:text-zinc-200";
                    const handleClick = () => toggleSubSkillStatus(skill.id);
                    return (
                      <SkillNode
                        key={skill.id}
                        skill={skill}
                        areaColor={itemColor}
                        onClick={handleClick}
                        isFirstOfLevel={firstSkillOfLevel.has(skill.id)}
                        isOnboardingTarget={index === 0}
                      />
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!activeItem) return null;

  const visibleLevels = calculateVisibleLevels(activeItem.skills);
  const visibleSkills = activeItem.skills.filter(s => visibleLevels.has(s.level));

  // Find the first skill of each level (lowest Y position per level)
  const firstSkillOfLevel = new Set<string>();
  const levelGroups = new Map<number, typeof visibleSkills>();
  
  visibleSkills.forEach(skill => {
    if (!levelGroups.has(skill.level)) {
      levelGroups.set(skill.level, []);
    }
    levelGroups.get(skill.level)!.push(skill);
  });
  
  levelGroups.forEach((skills) => {
    const firstSkill = skills.reduce((min, s) => s.y < min.y ? s : min, skills[0]);
    if (firstSkill) {
      firstSkillOfLevel.add(firstSkill.id);
    }
  });

  const maxY = Math.max(...visibleSkills.map(s => s.y), 400);
  const containerHeight = maxY + 200;

  return (
    <div className="flex-1 relative overflow-hidden bg-background flex flex-col">
      <AnimatePresence>
        {showLevelUp && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.span
              className="text-4xl font-bold tracking-widest uppercase text-foreground"
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -100, opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              level up
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showCompleted && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.span
              className="text-4xl font-bold tracking-widest uppercase text-foreground"
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -100, opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              completed
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex-1 overflow-y-auto p-8 scroll-smooth">
        <div className="w-full relative max-w-4xl mx-auto mt-10 min-h-full">
          
          <div className="absolute top-0 left-0 z-10 sticky">
            <h2 className="text-2xl font-bold tracking-tight mb-1">
              {activeItem.name}
            </h2>
            <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
              {activeItem.description}
            </p>
            <button
              onClick={() => setIsStuckDialogOpen(true)}
              className="text-xs text-muted-foreground/60 hover:text-muted-foreground mt-2 transition-colors"
              data-testid="button-stuck"
            >
              Estoy trabada
            </button>
          </div>

          <Dialog open={isStuckDialogOpen} onOpenChange={handleStuckDialogClose}>
            <DialogContent className="sm:max-w-[400px] border-0 shadow-2xl">
              <div className="min-h-[200px] flex flex-col">
                <AnimatePresence mode="wait">
                  {stuckStep === 0 && (
                    <motion.div
                      key="stuck-step-0"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="flex-1 flex flex-col"
                    >
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
                        ¿Dónde está el problema concreto?
                      </Label>
                      <Textarea
                        value={stuckProblem}
                        onChange={(e) => setStuckProblem(e.target.value)}
                        placeholder="Describe el problema..."
                        rows={3}
                        className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted resize-none"
                        data-testid="input-stuck-problem"
                        autoFocus
                      />
                      <div className="flex justify-end mt-auto pt-6">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => setStuckStep(1)}
                          className="h-10 w-10 bg-muted/50 hover:bg-muted"
                          data-testid="button-stuck-next-1"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {stuckStep === 1 && (
                    <motion.div
                      key="stuck-step-1"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="flex-1 flex flex-col"
                    >
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
                        Entonces, ¿qué habilidad necesito desarrollar ahora?
                      </Label>
                      <Textarea
                        value={stuckSkill}
                        onChange={(e) => setStuckSkill(e.target.value)}
                        placeholder="La habilidad que necesitas..."
                        rows={3}
                        className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted resize-none"
                        data-testid="input-stuck-skill"
                        autoFocus
                      />
                      <div className="flex justify-between mt-auto pt-6">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => setStuckStep(0)}
                          className="h-10 w-10 bg-muted/50 hover:bg-muted"
                          data-testid="button-stuck-prev-1"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => setStuckStep(2)}
                          className="h-10 w-10 bg-muted/50 hover:bg-muted"
                          data-testid="button-stuck-next-2"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {stuckStep === 2 && (
                    <motion.div
                      key="stuck-step-2"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                      className="flex-1 flex flex-col gap-4"
                    >
                      <div>
                        <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">
                          ¿Qué acción concreta entrena esa habilidad?
                        </Label>
                        <Textarea
                          value={stuckAction}
                          onChange={(e) => setStuckAction(e.target.value)}
                          placeholder="La acción que entrena la habilidad..."
                          rows={2}
                          className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted resize-none"
                          data-testid="input-stuck-action"
                          autoFocus
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">
                          Escribilo en tres palabras
                        </Label>
                        <Input
                          value={stuckTitle}
                          onChange={(e) => {
                            const words = e.target.value.split(/\s+/).filter(w => w.length > 0);
                            if (words.length <= 3) {
                              setStuckTitle(e.target.value);
                            } else {
                              setStuckTitle(words.slice(0, 3).join(" "));
                            }
                          }}
                          placeholder="Título del nodo..."
                          className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted"
                          data-testid="input-stuck-title"
                        />
                      </div>
                      <div className="flex justify-between mt-auto pt-4">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => setStuckStep(1)}
                          className="h-10 w-10 bg-muted/50 hover:bg-muted"
                          data-testid="button-stuck-prev-2"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <Button 
                          onClick={handleCreateStuckNode}
                          disabled={!stuckTitle.trim()}
                          className="border-0"
                          data-testid="button-create-stuck-node"
                        >
                          Crear nodo
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </DialogContent>
          </Dialog>

          <div 
            className="relative w-full mt-20 transition-all duration-500 ease-in-out"
            style={{ height: `${containerHeight}px`, minHeight: "600px" }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={activeItem.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="w-full h-full relative"
              >
                {/* Connections - based on visual Y position */}
                {Array.from(levelGroups.entries()).flatMap(([level, skills]) => {
                  const sortedByY = [...skills].sort((a, b) => a.y - b.y);
                  const connections = [];
                  const itemColor = 'color' in activeItem ? (activeItem.color as string) : "text-zinc-800 dark:text-zinc-200";
                  
                  for (let i = 0; i < sortedByY.length - 1; i++) {
                    const parentSkill = sortedByY[i];
                    const childSkill = sortedByY[i + 1];
                    const isActive = parentSkill.status === "mastered";
                    
                    connections.push(
                      <SkillConnection
                        key={`${parentSkill.id}-${childSkill.id}`}
                        start={parentSkill}
                        end={childSkill}
                        active={isActive}
                        areaColor={itemColor}
                      />
                    );
                  }
                  
                  return connections;
                })}

                {/* Nodes */}
                {visibleSkills.map((skill, index) => {
                  const itemColor = 'color' in activeItem ? (activeItem.color as string) : "text-zinc-800 dark:text-zinc-200";
                  const handleClick = isProject 
                    ? () => toggleProjectSkillStatus(activeItem.id, skill.id)
                    : () => toggleSkillStatus(activeItem.id, skill.id);
                  return (
                    <SkillNode
                      key={skill.id}
                      skill={skill}
                      areaColor={itemColor}
                      onClick={handleClick}
                      isFirstOfLevel={firstSkillOfLevel.has(skill.id)}
                      isOnboardingTarget={index === 0}
                    />
                  );
                })}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SkillTreePage() {
  const { user } = useAuth();
  const { showOnboarding, openGuide, closeGuide, markComplete } = useOnboarding(user?.id?.toString());
  
  const handleCompleteOnboarding = () => {
    if (user?.id) {
      markComplete(user.id.toString());
    }
    closeGuide();
  };
  
  return (
    <DiaryProvider>
      <SkillTreeProvider>
        <div className="flex h-screen w-full bg-background text-foreground overflow-hidden font-body selection:bg-primary/30">
          <TopRightControls onOpenGuide={openGuide} />
          <AreaMenu />
          <SkillCanvas />
          <QuestDiary />
          <OnboardingGuide isOpen={showOnboarding} onComplete={handleCompleteOnboarding} />
        </div>
      </SkillTreeProvider>
    </DiaryProvider>
  );
}
