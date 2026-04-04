import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { SkillTreeProvider, useSkillTree, type Skill, type GlobalSkill, type Area, type Project } from "@/lib/skill-context";
import { MenuProvider, useMenu } from "@/lib/menu-context";
import { AreaMenu } from "@/components/AreaMenu";
import { SkillNode } from "@/components/SkillNode";
import { SkillConnection } from "@/components/SkillConnection";
import { SkillDesigner } from "@/components/SkillDesigner";
import { HabitStreakModal } from "@/components/HabitStreakModal";
import { SpaceRepetitionModal } from "@/components/SpaceRepetitionModal";
import { ProgressModal } from "@/components/ProgressModal";
import { ProgressBar } from "@/components/ProgressBar";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Sun, Moon, BookOpen, Trash2, Plus, Users, Map as MapIcon, Skull, Scroll, Pencil, X, User, ChevronLeft, ChevronRight, Lightbulb, Wrench, Globe, ChevronDown, Target, FolderOpen, Mountain, Image, Grid, Flame, Dumbbell, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { DiaryProvider, useDiary } from "@/lib/diary-context";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { JournalCharacter, JournalPlace, JournalShadow, JournalLearning, JournalTool, JournalThought } from "@shared/schema";
import { OnboardingGuide, HelpButton, useOnboarding } from "@/components/OnboardingGuide";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

function calculateVisibleLevels(skills: Skill[], endOfAreaLevel?: number): Set<number> {
  const visibleLevels = new Set<number>();
  
  const levelMap = new Map<number, Skill[]>();
  skills.forEach(skill => {
    if (!levelMap.has(skill.level)) {
      levelMap.set(skill.level, []);
    }
    levelMap.get(skill.level)!.push(skill);
  });
  
  const sortedLevels = Array.from(levelMap.keys())
    .sort((a, b) => a - b)
    // Filter out staged levels (those > endOfAreaLevel when endOfAreaLevel is active)
    .filter(level => !endOfAreaLevel || level <= endOfAreaLevel);
  
  if (sortedLevels.length === 0) return visibleLevels;
  
  const firstLevel = sortedLevels[0];
  visibleLevels.add(firstLevel);
  
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
        visibleLevels.add(currentLevel);
        // Stop only if we've reached the end of the area marker
        if (endOfAreaLevel && currentLevel === endOfAreaLevel) {
          break;
        }
      } else {
        break;
      }
    }
  }
  
  return visibleLevels;
}

function TopRightControls({ onOpenGuide, onOpenDesigner, onOpenProgress, onOpenHabits, onOpenStrength }: { onOpenGuide: () => void; onOpenDesigner: () => void; onOpenProgress: () => void; onOpenHabits: () => void; onOpenStrength: () => void }) {
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
      <button
        className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
        onClick={onOpenProgress}
        title="Progress Tracker"
      >
        <Mountain className="h-5 w-5" />
      </button>
      <button
        className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
        onClick={onOpenDesigner}
        title="Skill Designer"
      >
        <Scroll className="h-5 w-5" />
      </button>
      <button
        className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
        onClick={onOpenHabits}
        title="Habit Streak"
      >
        <Flame className="h-5 w-5" />
      </button>
      <button
        className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
        onClick={onOpenStrength}
        title="Space Repetition"
      >
        <Dumbbell className="h-5 w-5" />
      </button>
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
    <div className="h-full min-h-0 flex flex-col">
      <div className="flex-shrink-0 mb-3 pb-2 border-b border-zinc-700/50">
        <span className="text-xs text-zinc-500 uppercase tracking-wider">
          {entries.length} {countLabel}
        </span>
        <div className="h-px w-8 bg-gradient-to-r from-zinc-600 to-transparent mt-1" />
      </div>

      <div className="flex-1 min-h-0 flex flex-col">

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

      <div className="flex-1 min-h-0 flex flex-col">
        <div className="flex flex-1 min-h-0 flex-col sm:flex-row gap-5 sm:gap-4">
          <div 
            className="w-full sm:w-1/2 flex flex-col bg-zinc-800/30 rounded border border-zinc-700/50 p-3 cursor-pointer min-h-0"
            onTouchStart={handleLeftLongPressStart}
            onTouchEnd={handleLeftLongPressEnd}
            onTouchCancel={handleLeftLongPressEnd}
            onMouseDown={handleLeftLongPressStart}
            onMouseUp={handleLeftLongPressEnd}
            onMouseLeave={handleLeftLongPressEnd}
          >
            <div className="flex-1 min-h-0 w-full overflow-y-auto pr-2 minimal-scrollbar">
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
          </div>
        </div>
        
        <div 
          className="w-full sm:w-1/2 flex flex-col bg-zinc-800/20 rounded border border-zinc-700/50 p-4 cursor-pointer min-h-0"
          onTouchStart={handleRightLongPressStart}
          onTouchEnd={handleRightLongPressEnd}
          onTouchCancel={handleRightLongPressEnd}
          onMouseDown={handleRightLongPressStart}
          onMouseUp={handleRightLongPressEnd}
          onMouseLeave={handleRightLongPressEnd}
        >
          {viewingEntry ? (
            <>
              <div className="border-b border-zinc-700/50 pb-2 mb-4 flex-shrink-0">
                <h3 className="font-medium text-zinc-100 uppercase tracking-wide">{viewingEntry.name}</h3>
                <div className="h-px w-12 bg-gradient-to-r from-zinc-500 to-transparent mt-2" />
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto minimal-scrollbar">
                {viewingEntry.description && (
                  <p className="text-sm text-zinc-400 whitespace-pre-line leading-relaxed">{viewingEntry.description}</p>
                )}
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-zinc-600 text-sm">
              Seleccioná una entrada
            </div>
          )}
        </div>
      </div>
      </div>
      </div>
    </div>
  );
}

// Professional FlipBook Bestiary Component
// Spread-based pagination (2 entries per spread), toolbar, thumbnails, progress bar

function BestiarySection({
  entries,
  isLoading,
  onAdd,
  onEdit,
  onDelete,
  onMarkDefeated,
}: {
  entries: JournalShadow[];
  isLoading: boolean;
  onAdd: (entry: { name: string; action: string; description: string }) => void;
  onEdit: (id: string, entry: { name: string; action: string; description: string; imageUrl?: string }) => void;
  onDelete: (id: string) => void;
  onMarkDefeated: (id: string, defeated: 0 | 1) => void;
}) {
  const isMobile = useIsMobile();
  
  const [spread, setSpread] = useState(0);
  const [flipping, setFlipping] = useState(false);
  const [flipDir, setFlipDir] = useState<"next" | "prev" | null>(null);
  const [showThumbs, setShowThumbs] = useState(!isMobile);
  const [selectedEntryIdx, setSelectedEntryIdx] = useState(0);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [editedName, setEditedName] = useState("");
  const [editedDescription, setEditedDescription] = useState("");
  const [editedImageUrl, setEditedImageUrl] = useState("");
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const [editedImagePreview, setEditedImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const currentSpread = selectedEntryIdx;
  const leftEntry = entries[currentSpread] || null;
  const rightEntry = entries[currentSpread] || null;

  const goTo = (idx: number) => {
    // Guard checks
    if (flipping) return;
    if (idx < 0 || idx >= entries.length) return;
    if (idx === selectedEntryIdx) return;
    
    const dir = idx > selectedEntryIdx ? "next" : "prev";
    setFlipDir(dir);
    setFlipping(true);
    
    setTimeout(() => {
      setSelectedEntryIdx(idx);
      setFlipping(false);
      setFlipDir(null);
    }, 700);
  };

  // Update selectedEntryIdx when entries change
  useEffect(() => {
    if (entries.length === 0) {
      setSelectedEntryIdx(0);
    } else if (selectedEntryIdx >= entries.length) {
      // Clamp selectedEntryIdx to valid range
      const newIdx = entries.length - 1;
      setSelectedEntryIdx(newIdx);
    }
  }, [entries.length]);

  // Auto-hide thumbnails on mobile, show on desktop
  useEffect(() => {
    setShowThumbs(!isMobile);
  }, [isMobile]);

  const handleAddBeast = () => {
    if (!newName.trim()) {
      alert("Por favor ingresa un nombre para la bestia");
      return;
    }
    if (!newDescription.trim()) {
      alert("Por favor ingresa una descripción");
      return;
    }
    console.log("[Bestiary] Adding beast:", { newName, newDescription, imageUrl: newImageUrl ? "present" : "none" });
    
    const addData: any = {
      name: newName.toUpperCase(),
      action: "",
      description: newDescription,
    };
    if (newImageUrl) {
      addData.imageUrl = newImageUrl;
    }
    
    onAdd(addData);
    
    // Clear form
    setNewName("");
    setNewDescription("");
    setNewImageUrl("");
    setNewImagePreview(null);
    setIsAdding(false);
  };

  const handleStartEdit = (entry: JournalShadow) => {
    setEditingId(entry.id);
    setEditedName(entry.name);
    setEditedDescription(entry.description);
    setEditedImageUrl(entry.imageUrl || "");
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (!editingId || !editedName.trim()) return;
    const updateData: any = {
      name: editedName.toUpperCase(),
      action: "",
      description: editedDescription,
    };
    if (editedImageUrl) {
      updateData.imageUrl = editedImageUrl;
    }
    onEdit(editingId, updateData);
    setIsEditing(false);
    setEditingId(null);
    setEditedName("");
    setEditedDescription("");
    setEditedImageUrl("");
    setEditedImagePreview(null);
  };

  const compressImage = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = document.createElement("img");
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(file);
            return;
          }

          // Max width/height: 600px (aggressive compression for DB)
          let width = img.width;
          let height = img.height;
          const maxSize = 600;

          if (width > height) {
            if (width > maxSize) {
              height = Math.round((height * maxSize) / width);
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = Math.round((width * maxSize) / height);
              height = maxSize;
            }
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          // Ultra-aggressive compression: 0.5 quality (~40-50KB max)
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name, {
                  type: "image/jpeg",
                  lastModified: Date.now(),
                });
                console.log(`[compress] Original: ${file.size}B, Compressed: ${blob.size}B`);
                resolve(compressedFile);
              } else {
                resolve(file);
              }
            },
            "image/jpeg",
            0.5
          );
        };
      };
    });
  };

  const handleImageUpload = async (file: File, isEditting: boolean) => {
    if (!file || !file.type.startsWith("image/")) {
      return;
    }

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (e) => {
      const preview = e.target?.result as string;
      if (isEditting) {
        setEditedImagePreview(preview);
      } else {
        setNewImagePreview(preview);
      }
    };
    reader.readAsDataURL(file);

    // Upload to server
    setIsUploadingImage(true);
    try {
      // Compress image before upload
      const compressedFile = await compressImage(file);

      const formData = new FormData();
      formData.append("image", compressedFile);

      const response = await fetch("/api/journal/shadows/upload", {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      const { imageUrl } = await response.json();
      if (isEditting) {
        setEditedImageUrl(imageUrl);
        // Update preview with server-compressed version
        setEditedImagePreview(imageUrl);
      } else {
        setNewImageUrl(imageUrl);
        // Update preview with server-compressed version
        setNewImagePreview(imageUrl);
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      alert("Error al subir la imagen: " + error.message);
      if (isEditting) {
        setEditedImagePreview(null);
        setEditedImageUrl("");
      } else {
        setNewImagePreview(null);
        setNewImageUrl("");
      }
    } finally {
      setIsUploadingImage(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Loading...</div>;
  }

  if (entries.length === 0) {
    return (
      <div className="h-full flex flex-col bg-zinc-900">
        <div className="flex items-center justify-between p-3 bg-zinc-950 border-b border-zinc-800">
          <div className="flex-1" />
          <Button
            size="sm"
            onClick={() => setIsAdding(true)}
            className="bg-amber-700 hover:bg-amber-800 text-amber-50 text-xs"
          >
            + Agregar
          </Button>
        </div>
        <div className="flex-1 flex items-center justify-center text-center">
          <div>
            <BookOpen className="h-16 w-16 text-zinc-600 mx-auto mb-4" />
            <p className="text-zinc-500 text-sm">No hay bestias registradas</p>
            <p className="text-zinc-600 text-xs mt-2">Usa el botón "Agregar" para comenzar</p>
          </div>
        </div>
        <Dialog open={isAdding} onOpenChange={setIsAdding}>
          <DialogContent className="sm:max-w-md bg-zinc-900 border border-zinc-700">
            <VisuallyHidden>
              <DialogTitle>Add Beast</DialogTitle>
            </VisuallyHidden>
            <div className="space-y-4">
              <div className="border-b border-zinc-700/50 pb-2">
                <h3 className="font-medium text-zinc-100">Agregar Bestia</h3>
              </div>
              <Input
                placeholder="NOMBRE"
                value={newName}
                onChange={(e) => setNewName(e.target.value.toUpperCase())}
                className="uppercase bg-zinc-800 border-zinc-700 text-zinc-200"
              />
              <Textarea
                placeholder="Descripción"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={4}
                className="bg-zinc-800 border-zinc-700 text-zinc-200 resize-none"
              />
              <div>
                <label className="text-xs text-zinc-400 block mb-2">Imagen (opcional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.currentTarget.files?.[0];
                    if (file) handleImageUpload(file, false);
                  }}
                  disabled={isUploadingImage}
                  className="w-full text-xs text-zinc-400 file:bg-zinc-800 file:border file:border-zinc-700 file:rounded file:px-2 file:py-1 file:text-xs file:text-zinc-400 cursor-pointer"
                />
                {newImagePreview && (
                  <div className="mt-2 relative">
                    <img
                      src={newImagePreview}
                      alt="Preview"
                      className="w-full h-32 object-cover rounded bg-zinc-800"
                    />
                    <button
                      onClick={() => {
                        setNewImageUrl("");
                        setNewImagePreview(null);
                      }}
                      className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-1 rounded"
                    >
                      Remover
                    </button>
                  </div>
                )}
              </div>
              <Input
                type="text"
                placeholder="O pega una URL de imagen"
                value={newImageUrl}
                onChange={(e) => {
                  setNewImageUrl(e.target.value);
                  if (e.target.value && !newImagePreview) {
                    setNewImagePreview(e.target.value);
                  }
                }}
                disabled={isUploadingImage}
                className="bg-zinc-800 border-zinc-700 text-zinc-200 placeholder:text-zinc-500 disabled:opacity-50"
              />
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={handleAddBeast} 
                  disabled={isUploadingImage || !newName.trim()}
                  className="bg-amber-700 hover:bg-amber-800 text-amber-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploadingImage ? "Subiendo..." : "Agregar"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)} className="text-zinc-400">
                  Cancelar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-zinc-900">
      <style>{`
        @keyframes bestiaryFlipSheetNext {
          0% { transform: rotateY(0deg); box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
          40% { transform: rotateY(-90deg); box-shadow: -30px 0 60px rgba(0,0,0,0.5); }
          100% { transform: rotateY(-180deg); box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
        }
        @keyframes bestiaryFlipSheetPrev {
          0% { transform: rotateY(0deg); box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
          40% { transform: rotateY(90deg); box-shadow: 30px 0 60px rgba(0,0,0,0.5); }
          100% { transform: rotateY(180deg); box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
        }
        .bestiary-spread {
          perspective: 1800px;
          position: relative;
          background-color: #000000;
        }
        .bestiary-book {
          transform-style: preserve-3d;
          transition: none;
          background-color: #000000;
        }
        .bestiary-flip-sheet {
          position: absolute;
          top: 0;
          width: 50%;
          height: 100%;
          background-color: #000000;
          transform-style: preserve-3d;
          z-index: 10;
        }
        .bestiary-flip-sheet.flipping-next {
          left: 50%;
          transform-origin: left center;
          animation: bestiaryFlipSheetNext 0.7s cubic-bezier(0.45, 0.05, 0.55, 0.95) forwards;
        }
        .bestiary-flip-sheet.flipping-prev {
          left: 4px;
          transform-origin: right center;
          animation: bestiaryFlipSheetPrev 0.7s cubic-bezier(0.45, 0.05, 0.55, 0.95) forwards;
        }
        /* Minimal scrollbar styling */
        .bestiary-description::-webkit-scrollbar {
          width: 6px;
        }
        .bestiary-description::-webkit-scrollbar-track {
          background: transparent;
        }
        .bestiary-description::-webkit-scrollbar-thumb {
          background: rgba(120, 113, 108, 0.5);
          border-radius: 3px;
        }
        .bestiary-description::-webkit-scrollbar-thumb:hover {
          background: rgba(120, 113, 108, 0.8);
        }
        /* Force bestiary pages to be black */
        .bestiary-spread > div > div:first-child,
        .bestiary-spread > div > div:last-child {
          background-color: #000000 !important;
          color: #ffffff !important;
        }
      `}</style>

      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 sm:p-3 border-b border-zinc-800 gap-1.5 sm:gap-3">
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => goTo(0)}
            disabled={flipping || isLoading || entries.length === 0 || selectedEntryIdx === 0}
            className="text-xs text-zinc-200 border-zinc-700 hover:bg-zinc-800 px-2"
          >
            ⏮
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => goTo(selectedEntryIdx - 1)}
            disabled={flipping || isLoading || entries.length === 0 || selectedEntryIdx === 0}
            className="text-xs text-zinc-200 border-zinc-700 hover:bg-zinc-800 px-2"
          >
            ◀
          </Button>
        </div>

        <Button
          size="sm"
          variant={showThumbs ? "default" : "outline"}
          onClick={() => setShowThumbs(!showThumbs)}
          disabled={flipping || isLoading}
          className="px-2"
          title={showThumbs ? "Ocultar thumbnails" : "Mostrar thumbnails"}
        >
          <Grid className="h-4 w-4" />
        </Button>

        <div className="flex-1 h-0.5 sm:h-1 bg-zinc-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-600 transition-all duration-300"
            style={{
              width: `${entries.length > 0 ? ((selectedEntryIdx + 1) / entries.length) * 100 : 0}%`,
            }}
          />
        </div>

        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => goTo(selectedEntryIdx + 1)}
            disabled={flipping || isLoading || entries.length === 0 || selectedEntryIdx === entries.length - 1}
            className="text-xs text-zinc-200 border-zinc-700 hover:bg-zinc-800 px-2"
          >
            ▶
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => goTo(entries.length - 1)}
            disabled={flipping || isLoading || entries.length === 0 || selectedEntryIdx === entries.length - 1}
            className="text-xs text-zinc-200 border-zinc-700 hover:bg-zinc-800 px-2"
          >
            ⏭
          </Button>
        </div>

        <Button
          size="sm"
          onClick={() => setIsAdding(true)}
          className="bg-amber-700 hover:bg-amber-800 text-amber-50 text-xs px-3"
        >
          + Agregar
        </Button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex gap-2 sm:gap-3 lg:gap-4 p-2 sm:p-3 lg:p-4 overflow-hidden bg-zinc-900">
        {/* Thumbnail Panel */}
        {showThumbs && !isMobile && (
          <div className="w-24 flex flex-col gap-2 overflow-y-auto border-r border-zinc-800 pr-2">
            {entries.map((entry, idx) => (
              <button
                key={entry.id}
                onClick={() => {
                  goTo(idx);
                }}
                className={`p-2 rounded text-xs text-center font-mono transition-colors ${
                  idx === selectedEntryIdx
                    ? "bg-amber-700 text-amber-50"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                {entry.name.substring(0, 8).toUpperCase()}
              </button>
            ))}
          </div>
        )}

        {/* Book Spread */}
        <div className="flex-1 flex flex-col lg:flex-row bestiary-spread w-full">
          {/* Flip Sheet (flying page during animation) */}
          {flipping && (
            <div
              className={`bestiary-flip-sheet ${
                flipDir === "next" ? "flipping-next" : "flipping-prev"
              }`}
            />
          )}

          <div className="bestiary-book flex gap-0 w-full h-full">
            {/* Left Page */}
            <div className="flex-1 max-h-[60vh] lg:h-full bg-black shadow-2xl flex flex-col p-4 sm:p-6 lg:p-8 min-w-0 rounded-l">
              {leftEntry ? (
                <>
                  <div className="flex items-start justify-between gap-2 mb-2 pb-2 border-b-2 border-white/20 flex-shrink-0">
                    <h2 className="font-serif text-sm font-bold text-white uppercase">
                      {leftEntry.name}
                    </h2>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleStartEdit(leftEntry)}
                      className="text-white hover:bg-white/20 flex-shrink-0 px-1"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex-1 font-serif text-base text-white leading-relaxed overflow-y-auto pr-4 bestiary-description">
                    <p>{leftEntry.description}</p>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-white/50 text-sm">
                  — blank page —
                </div>
              )}
            </div>

            {/* Spine */}
            <div className="w-full h-1 lg:h-full lg:w-1 bg-gradient-to-b from-gray-800 to-gray-900 shadow-lg" />

            {/* Right Page */}
            <div className="flex-1 max-h-[60vh] lg:h-full bg-black shadow-2xl flex items-center justify-center p-6 sm:p-8 lg:p-12 min-w-0 rounded-r overflow-hidden">
              <div className={`w-full h-full flex items-center justify-center transition-opacity duration-300 ${flipping ? 'opacity-0' : 'opacity-100'}`}>
                {rightEntry?.imageUrl ? (
                  <img src={rightEntry.imageUrl} alt={rightEntry.name} className="max-h-full max-w-full object-contain" />
                ) : rightEntry ? (
                  <div className="flex flex-col items-center justify-center text-white/50">
                    <Image className="h-8 w-8 mb-2" />
                    <p className="text-xs">{rightEntry.name}</p>
                  </div>
                ) : (
                  <div className="text-white/30 text-xs">— blank page —</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Dialog */}
      <Dialog open={isAdding} onOpenChange={setIsAdding}>
        <DialogContent className="sm:max-w-md bg-zinc-900 border border-zinc-700">
          <VisuallyHidden>
            <DialogTitle>Add Beast</DialogTitle>
          </VisuallyHidden>
          <div className="space-y-4">
            <div className="border-b border-zinc-700/50 pb-2">
              <h3 className="font-medium text-zinc-100">Agregar Bestia</h3>
            </div>
            <Input
              placeholder="NOMBRE"
              value={newName}
              onChange={(e) => setNewName(e.target.value.toUpperCase())}
              className="uppercase bg-zinc-800 border-zinc-700 text-zinc-200"
            />
            <Textarea
              placeholder="Descripción"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              rows={4}
              className="bg-zinc-800 border-zinc-700 text-zinc-200 resize-none"
            />
            <div>
              <label className="text-xs text-zinc-400 block mb-2">Imagen (opcional)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0];
                  if (file) handleImageUpload(file, false);
                }}
                disabled={isUploadingImage}
                className="w-full text-xs text-zinc-400 file:bg-zinc-800 file:border file:border-zinc-700 file:rounded file:px-2 file:py-1 file:text-xs file:text-zinc-400 cursor-pointer"
              />
              {newImagePreview && (
                <div className="mt-2 relative">
                  <img
                    src={newImagePreview}
                    alt="Preview"
                    className="w-full h-32 object-cover rounded bg-zinc-800"
                  />
                  <button
                    onClick={() => {
                      setNewImageUrl("");
                      setNewImagePreview(null);
                    }}
                    className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-1 rounded"
                  >
                    Remover
                  </button>
                </div>
              )}
            </div>
            <Input
              type="text"
              placeholder="O pega una URL de imagen"
              value={newImageUrl}
              onChange={(e) => {
                setNewImageUrl(e.target.value);
                if (e.target.value && !newImagePreview) {
                  setNewImagePreview(e.target.value);
                }
              }}
              disabled={isUploadingImage}
              className="bg-zinc-800 border-zinc-700 text-zinc-200 placeholder:text-zinc-500 disabled:opacity-50"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddBeast} className="bg-amber-700 hover:bg-amber-800 text-amber-50">
                Agregar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)} className="text-zinc-400">
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="sm:max-w-md bg-zinc-900 border border-zinc-700">
          <VisuallyHidden>
            <DialogTitle>Edit Beast</DialogTitle>
          </VisuallyHidden>
          <div className="space-y-4">
            <div className="border-b border-zinc-700/50 pb-2">
              <h3 className="font-medium text-zinc-100">Editar Bestia</h3>
            </div>
            <Input
              placeholder="NOMBRE"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value.toUpperCase())}
              className="uppercase bg-zinc-800 border-zinc-700 text-zinc-200"
            />
            <Textarea
              placeholder="Descripción"
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              rows={4}
              className="bg-zinc-800 border-zinc-700 text-zinc-200 resize-none"
            />
            <div>
              <label className="text-xs text-zinc-400 block mb-2">Imagen (opcional)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0];
                  if (file) handleImageUpload(file, true);
                }}
                disabled={isUploadingImage}
                className="w-full text-xs text-zinc-400 file:bg-zinc-800 file:border file:border-zinc-700 file:rounded file:px-2 file:py-1 file:text-xs file:text-zinc-400 cursor-pointer"
              />
              {editedImagePreview && (
                <div className="mt-2 relative">
                  <img
                    src={editedImagePreview}
                    alt="Preview"
                    className="w-full h-32 object-cover rounded bg-zinc-800"
                  />
                  <button
                    onClick={() => {
                      setEditedImageUrl("");
                      setEditedImagePreview(null);
                    }}
                    className="absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-1 rounded"
                  >
                    Remover
                  </button>
                </div>
              )}
            </div>
            <Input
              type="text"
              placeholder="O pega una URL de imagen"
              value={editedImageUrl}
              onChange={(e) => {
                setEditedImageUrl(e.target.value);
                if (e.target.value && !editedImagePreview) {
                  setEditedImagePreview(e.target.value);
                }
              }}
              disabled={isUploadingImage}
              className="bg-zinc-800 border-zinc-700 text-zinc-200 placeholder:text-zinc-500 disabled:opacity-50"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveEdit} className="bg-white/20 hover:bg-white/30 text-white">
                Guardar
              </Button>
              <Button 
                size="sm" 
                onClick={() => {
                  if (editingId) {
                    onDelete(editingId);
                    setIsEditing(false);
                  }
                }} 
                className="bg-red-700 hover:bg-red-800 text-red-50"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Eliminar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)} className="text-zinc-400">
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ToolsSection({ 
  entries,
  isLoading,
  onDelete 
}: { 
  entries: JournalTool[];
  isLoading: boolean;
  onDelete: (id: string) => void;
}) {
  const [viewingEntry, setViewingEntry] = useState<JournalTool | null>(null);
  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Loading...</div>;
  }

  const handleLeftLongPressStart = (entry: JournalTool) => {
    longPressTimer.current = setTimeout(() => {
      setViewingEntry(entry);
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
      onDelete(viewingEntry.id);
      setViewingEntry(null);
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
      <div className="mb-3 pb-2 border-b border-border">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">
          {entries.length} tools
        </span>
        <div className="h-px w-8 bg-gradient-to-r from-muted-foreground to-transparent mt-1" />
      </div>

      <div className="flex flex-1 min-h-0 flex-col sm:flex-row gap-5 sm:gap-4">
        <div 
          className="w-full sm:w-1/2 flex flex-col bg-secondary/30 rounded border border-border/50 p-3 cursor-pointer min-h-0"
        >
          <ScrollArea className="h-full">
            {entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Wrench className="h-8 w-8 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground text-sm">No tools yet</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {entries.map((entry, index) => (
                  <div key={entry.id}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setViewingEntry(entry); }}
                      onTouchStart={() => handleLeftLongPressStart(entry)}
                      onTouchEnd={handleLeftLongPressEnd}
                      onTouchCancel={handleLeftLongPressEnd}
                      onMouseDown={() => handleLeftLongPressStart(entry)}
                      onMouseUp={handleLeftLongPressEnd}
                      onMouseLeave={handleLeftLongPressEnd}
                      className={`w-full text-left px-3 py-2 rounded text-sm transition-all cursor-pointer select-none ${
                        viewingEntry?.id === entry.id 
                          ? "bg-secondary text-foreground shadow-sm" 
                          : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground/80"
                      }`}
                      data-testid={`card-tools-${entry.id}`}
                    >
                      {entry.title}
                    </button>
                    {index < entries.length - 1 && (
                      <div className="h-px bg-border/30 mx-2" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
        
        <div 
          className="w-full sm:w-1/2 h-full flex flex-col bg-secondary/20 rounded border border-border/50 p-4 cursor-pointer select-none shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)] dark:shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)]"
          onTouchStart={handleRightLongPressStart}
          onTouchEnd={handleRightLongPressEnd}
          onTouchCancel={handleRightLongPressEnd}
          onMouseDown={handleRightLongPressStart}
          onMouseUp={handleRightLongPressEnd}
          onMouseLeave={handleRightLongPressEnd}
        >
          {viewingEntry ? (
            <>
              <div className="border-b border-border/50 pb-2 mb-4 flex-shrink-0">
                <h3 className="font-medium text-foreground uppercase tracking-wide">{viewingEntry.title}</h3>
                <div className="h-px w-12 bg-gradient-to-r from-muted-foreground to-transparent mt-2" />
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto minimal-scrollbar">
                {viewingEntry.sentence && (
                  <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{viewingEntry.sentence}</p>
                )}
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground/50 text-sm">
              Seleccioná una entrada
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LearningsSection({ 
  entries,
  isLoading,
  onDelete 
}: { 
  entries: JournalLearning[];
  isLoading: boolean;
  onDelete: (id: string) => void;
}) {
  const [viewingEntry, setViewingEntry] = useState<JournalLearning | null>(null);
  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Loading...</div>;
  }

  const handleLeftLongPressStart = (entry: JournalLearning) => {
    longPressTimer.current = setTimeout(() => {
      setViewingEntry(entry);
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
      onDelete(viewingEntry.id);
      setViewingEntry(null);
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
      <div className="mb-3 pb-2 border-b border-border">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">
          {entries.length} discoveries
        </span>
        <div className="h-px w-8 bg-gradient-to-r from-muted-foreground to-transparent mt-1" />
      </div>

      <div className="flex flex-1 min-h-0 flex-col sm:flex-row gap-5 sm:gap-4">
        <div 
          className="w-full sm:w-1/2 flex flex-col bg-secondary/30 rounded border border-border/50 p-3 cursor-pointer min-h-0"
        >
          <ScrollArea className="h-full">
            {entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Lightbulb className="h-8 w-8 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground text-sm">No learnings yet</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {entries.map((entry, index) => (
                  <div key={entry.id}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setViewingEntry(entry); }}
                      onTouchStart={() => handleLeftLongPressStart(entry)}
                      onTouchEnd={handleLeftLongPressEnd}
                      onTouchCancel={handleLeftLongPressEnd}
                      onMouseDown={() => handleLeftLongPressStart(entry)}
                      onMouseUp={handleLeftLongPressEnd}
                      onMouseLeave={handleLeftLongPressEnd}
                      className={`w-full text-left px-3 py-2 rounded text-sm transition-all cursor-pointer select-none ${
                        viewingEntry?.id === entry.id 
                          ? "bg-secondary text-foreground shadow-sm" 
                          : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground/80"
                      }`}
                      data-testid={`card-learnings-${entry.id}`}
                    >
                      {entry.title}
                    </button>
                    {index < entries.length - 1 && (
                      <div className="h-px bg-border/30 mx-2" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
        
        <div 
          className="w-full sm:w-1/2 h-full flex flex-col bg-secondary/20 rounded border border-border/50 p-4 cursor-pointer select-none shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)] dark:shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)]"
          onTouchStart={handleRightLongPressStart}
          onTouchEnd={handleRightLongPressEnd}
          onTouchCancel={handleRightLongPressEnd}
          onMouseDown={handleRightLongPressStart}
          onMouseUp={handleRightLongPressEnd}
          onMouseLeave={handleRightLongPressEnd}
        >
          {viewingEntry ? (
            <>
              <div className="border-b border-border/50 pb-2 mb-4 flex-shrink-0">
                <h3 className="font-medium text-foreground uppercase tracking-wide">{viewingEntry.title}</h3>
                <div className="h-px w-12 bg-gradient-to-r from-muted-foreground to-transparent mt-2" />
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto minimal-scrollbar">
                {viewingEntry.sentence && (
                  <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{viewingEntry.sentence}</p>
                )}
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground/50 text-sm">
              Seleccioná una entrada
            </div>
          )}
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
  const { areas, mainQuests, sideQuests } = useSkillTree();
  const allProjects = [...mainQuests, ...sideQuests];
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
  
  // For area/project selection in experiences and contributions
  const [selectedSourceType, setSelectedSourceType] = useState<"area" | "project" | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  
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

  const { data: profileMissions = [], isLoading: missionsLoading } = useQuery<ProfileEntry[]>({
    queryKey: ["/api/profile/missions"],
    queryFn: async () => {
      const res = await fetch("/api/profile/missions");
      return res.json();
    },
  });

  const { data: profileAboutEntries = [], isLoading: aboutEntriesLoading } = useQuery<ProfileEntry[]>({
    queryKey: ["/api/profile/about"],
    queryFn: async () => {
      const res = await fetch("/api/profile/about");
      return res.json();
    },
  });

  const { data: profileExperiences = [], isLoading: experiencesLoading } = useQuery<ProfileEntry[]>({
    queryKey: ["/api/profile/experiences"],
    queryFn: async () => {
      const res = await fetch("/api/profile/experiences");
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: profileContributions = [], isLoading: contributionsLoading } = useQuery<ProfileEntry[]>({
    queryKey: ["/api/profile/contributions"],
    queryFn: async () => {
      const res = await fetch("/api/profile/contributions");
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const createMission = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      const res = await fetch("/api/profile/missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile/missions"] });
      setIsAdding(false);
      setName("");
      setDescription("");
    },
  });

  const updateMission = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; description?: string } }) => {
      const res = await fetch(`/api/profile/missions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile/missions"] });
      setSelectedEntry(null);
      setIsEditMode(false);
    },
  });

  const deleteMission = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/profile/missions/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile/missions"] });
      setSelectedEntry(null);
      setShowDeleteConfirm(false);
    },
  });

  const createAboutEntry = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      const res = await fetch("/api/profile/about", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile/about"] });
      setIsAdding(false);
      setName("");
      setDescription("");
    },
  });

  const updateAboutEntry = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; description?: string } }) => {
      const res = await fetch(`/api/profile/about/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile/about"] });
      setSelectedEntry(null);
      setIsEditMode(false);
    },
  });

  const deleteAboutEntry = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/profile/about/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile/about"] });
      setSelectedEntry(null);
      setShowDeleteConfirm(false);
    },
  });

  const createExperience = useMutation({
    mutationFn: async (data: { name: string; description: string; areaId?: string | null; projectId?: string | null }) => {
      const res = await fetch("/api/profile/experiences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Error al crear experiencia" }));
        throw new Error(error.message || "Error al crear experiencia");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile/experiences"] });
      // Also invalidate by-source queries for ViewSourceDialog
      queryClient.invalidateQueries({ predicate: (query) => 
        (query.queryKey[0] as string)?.startsWith?.("/api/profile/experiences/by-source")
      });
      setIsAdding(false);
      setName("");
      setDescription("");
      setSelectedSourceType(null);
      setSelectedSourceId(null);
    },
    onError: (error: Error) => {
      console.error("Error creating experience:", error.message);
      // Keep dialog open so user can retry
    },
  });

  const updateExperience = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; description?: string; areaId?: string | null; projectId?: string | null } }) => {
      const res = await fetch(`/api/profile/experiences/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile/experiences"] });
      // Also invalidate by-source queries for ViewSourceDialog
      queryClient.invalidateQueries({ predicate: (query) => 
        (query.queryKey[0] as string)?.startsWith?.("/api/profile/experiences/by-source")
      });
      setSelectedEntry(null);
      setIsEditMode(false);
    },
  });

  const deleteExperience = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/profile/experiences/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile/experiences"] });
      // Also invalidate by-source queries for ViewSourceDialog
      queryClient.invalidateQueries({ predicate: (query) => 
        (query.queryKey[0] as string)?.startsWith?.("/api/profile/experiences/by-source")
      });
      setSelectedEntry(null);
      setShowDeleteConfirm(false);
    },
  });

  const createContribution = useMutation({
    mutationFn: async (data: { name: string; description: string; areaId?: string | null; projectId?: string | null }) => {
      const res = await fetch("/api/profile/contributions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile/contributions"] });
      // Also invalidate by-source queries for ViewSourceDialog
      queryClient.invalidateQueries({ predicate: (query) => 
        (query.queryKey[0] as string)?.startsWith?.("/api/profile/contributions/by-source")
      });
      setIsAdding(false);
      setName("");
      setDescription("");
      setSelectedSourceType(null);
      setSelectedSourceId(null);
    },
  });

  const updateContribution = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; description?: string; areaId?: string | null; projectId?: string | null } }) => {
      const res = await fetch(`/api/profile/contributions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile/contributions"] });
      // Also invalidate by-source queries for ViewSourceDialog
      queryClient.invalidateQueries({ predicate: (query) => 
        (query.queryKey[0] as string)?.startsWith?.("/api/profile/contributions/by-source")
      });
      setSelectedEntry(null);
      setIsEditMode(false);
    },
  });

  const deleteContribution = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/profile/contributions/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/profile/contributions"] });
      // Also invalidate by-source queries for ViewSourceDialog
      queryClient.invalidateQueries({ predicate: (query) => 
        (query.queryKey[0] as string)?.startsWith?.("/api/profile/contributions/by-source")
      });
      setSelectedEntry(null);
      setShowDeleteConfirm(false);
    },
  });

  const tabs = [
    { id: "mission", label: "Misión", title: "MI MISIÓN" },
    { id: "values", label: "Valores", title: "MIS VALORES" },
    { id: "likes", label: "Gustos", title: "LO QUE ME GUSTA" },
    { id: "about", label: "Sobre mí", title: "SOBRE MÍ" },
    { id: "experiences", label: "Experiencias", title: "MIS EXPERIENCIAS" },
    { id: "contributions", label: "Contribución", title: "MIS CONTRIBUCIONES" },
  ];

  const currentTab = tabs.find(t => t.id === activeTab) || tabs[0];
  const currentEntries = activeTab === "values" ? profileValues : 
                        activeTab === "likes" ? profileLikes : 
                        activeTab === "mission" ? profileMissions : 
                        activeTab === "about" ? profileAboutEntries :
                        activeTab === "experiences" ? profileExperiences :
                        profileContributions;

  const handleAddNew = () => {
    if (!name.trim()) return;
    if (activeTab === "values") {
      createValue.mutate({ name: name.trim(), description: description.trim() });
    } else if (activeTab === "likes") {
      createLike.mutate({ name: name.trim(), description: description.trim() });
    } else if (activeTab === "mission") {
      createMission.mutate({ name: name.trim(), description: description.trim() });
    } else if (activeTab === "about") {
      createAboutEntry.mutate({ name: name.trim(), description: description.trim() });
    } else if (activeTab === "experiences") {
      createExperience.mutate({ 
        name: name.trim(), 
        description: description.trim(),
        areaId: selectedSourceType === "area" ? selectedSourceId : null,
        projectId: selectedSourceType === "project" ? selectedSourceId : null,
      });
    } else if (activeTab === "contributions") {
      createContribution.mutate({ 
        name: name.trim(), 
        description: description.trim(),
        areaId: selectedSourceType === "area" ? selectedSourceId : null,
        projectId: selectedSourceType === "project" ? selectedSourceId : null,
      });
    }
  };

  const handleSaveEdit = () => {
    if (!selectedEntry || !name.trim()) return;
    if (activeTab === "values") {
      updateValue.mutate({ id: selectedEntry.id, data: { name: name.trim(), description: description.trim() } });
    } else if (activeTab === "likes") {
      updateLike.mutate({ id: selectedEntry.id, data: { name: name.trim(), description: description.trim() } });
    } else if (activeTab === "mission") {
      updateMission.mutate({ id: selectedEntry.id, data: { name: name.trim(), description: description.trim() } });
    } else if (activeTab === "about") {
      updateAboutEntry.mutate({ id: selectedEntry.id, data: { name: name.trim(), description: description.trim() } });
    } else if (activeTab === "experiences") {
      updateExperience.mutate({ id: selectedEntry.id, data: { 
        name: name.trim(), 
        description: description.trim(),
        areaId: selectedSourceType === "area" ? selectedSourceId : null,
        projectId: selectedSourceType === "project" ? selectedSourceId : null,
      } });
    } else if (activeTab === "contributions") {
      updateContribution.mutate({ id: selectedEntry.id, data: { 
        name: name.trim(), 
        description: description.trim(),
        areaId: selectedSourceType === "area" ? selectedSourceId : null,
        projectId: selectedSourceType === "project" ? selectedSourceId : null,
      } });
    }
  };

  const handleDelete = () => {
    if (!selectedEntry) return;
    if (activeTab === "values") {
      deleteValue.mutate(selectedEntry.id);
    } else if (activeTab === "likes") {
      deleteLike.mutate(selectedEntry.id);
    } else if (activeTab === "mission") {
      deleteMission.mutate(selectedEntry.id);
    } else if (activeTab === "about") {
      deleteAboutEntry.mutate(selectedEntry.id);
    } else if (activeTab === "experiences") {
      deleteExperience.mutate(selectedEntry.id);
    } else if (activeTab === "contributions") {
      deleteContribution.mutate(selectedEntry.id);
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
    } else if (activeTab === "mission") {
      updateMission.mutate({ id: selectedEntry.id, data: { description: newDesc } });
    } else if (activeTab === "about") {
      updateAboutEntry.mutate({ id: selectedEntry.id, data: { description: newDesc } });
    } else if (activeTab === "experiences") {
      updateExperience.mutate({ id: selectedEntry.id, data: { description: newDesc } });
    } else if (activeTab === "contributions") {
      updateContribution.mutate({ id: selectedEntry.id, data: { description: newDesc } });
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
    setSelectedSourceType(null);
    setSelectedSourceId(null);
  };

  const handleTextLongPressStart = () => {
    setEditValue(currentTab.id === "mission" ? profileMission : profileAbout);
    setIsEditing(true);
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
      // Initialize source type and id for experiences/contributions
      const entry = viewingEntry as any;
      if (entry.areaId) {
        setSelectedSourceType("area");
        setSelectedSourceId(entry.areaId);
      } else if (entry.projectId) {
        setSelectedSourceType("project");
        setSelectedSourceId(entry.projectId);
      } else {
        setSelectedSourceType(null);
        setSelectedSourceId(null);
      }
    }, 500);
  };

  const handleRightLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const getTabLabel = (id: string) => {
    switch (id) {
      case "mission": return "Misión";
      case "values": return "Valor";
      case "likes": return "Gusto";
      case "about": return "Sobre mí";
      case "experiences": return "Experiencia";
      case "contributions": return "Contribución";
      default: return "Entrada";
    }
  };

  const getTabPlural = (id: string) => {
    switch (id) {
      case "mission": return "misiones";
      case "values": return "valores";
      case "likes": return "gustos";
      case "about": return "entradas";
      case "experiences": return "experiencias";
      case "contributions": return "contribuciones";
      default: return "entradas";
    }
  };

  if (profileLoading || valuesLoading || likesLoading || missionsLoading || aboutEntriesLoading || experiencesLoading || contributionsLoading) {
    return <div className="text-zinc-500 text-sm">Cargando...</div>;
  }

  return (
    <div className="h-full flex flex-col min-w-0 overflow-hidden">
      {/* Add entry dialog for mission/values/likes/about */}
      <Dialog open={isAdding} onOpenChange={(open) => !open && setIsAdding(false)}>
        <DialogContent className="sm:max-w-md bg-zinc-900 border border-zinc-700">
          <VisuallyHidden>
            <DialogTitle>Agregar {getTabLabel(activeTab)}</DialogTitle>
          </VisuallyHidden>
          
          <div className="space-y-4">
            <div className="border-b border-zinc-700/50 pb-2">
              <h3 className="font-medium text-zinc-100">Agregar {getTabLabel(activeTab)}</h3>
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
            {(activeTab === "experiences" || activeTab === "contributions") && (
              <div className="space-y-2">
                <Label className="text-xs text-zinc-400">Área o Quest (opcional)</Label>
                <Select
                  value={selectedSourceType && selectedSourceId ? `${selectedSourceType}:${selectedSourceId}` : "none"}
                  onValueChange={(value) => {
                    if (value === "none") {
                      setSelectedSourceType(null);
                      setSelectedSourceId(null);
                    } else {
                      const [type, id] = value.split(":");
                      setSelectedSourceType(type as "area" | "project");
                      setSelectedSourceId(id);
                    }
                  }}
                >
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-200">
                    <SelectValue placeholder="Sin asignar" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700 max-h-60 overflow-y-auto">
                    <SelectItem value="none" className="text-zinc-400">Sin asignar</SelectItem>
                    {areas.length > 0 && (
                      <SelectGroup>
                        <SelectLabel className="text-zinc-500">Áreas</SelectLabel>
                        {areas.map((area: Area) => (
                          <SelectItem key={area.id} value={`area:${area.id}`} className="text-zinc-200">
                            {area.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                    {allProjects.length > 0 && (
                      <SelectGroup>
                        <SelectLabel className="text-zinc-500">Quests</SelectLabel>
                        {allProjects.map((project) => (
                          <SelectItem key={project.id} value={`project:${project.id}`} className="text-zinc-200">
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
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
                {(activeTab === "experiences" || activeTab === "contributions") && (
                  <div className="space-y-2">
                    <Label className="text-xs text-zinc-400">Área o Quest (opcional)</Label>
                    <Select
                      value={selectedSourceType && selectedSourceId ? `${selectedSourceType}:${selectedSourceId}` : "none"}
                      onValueChange={(value) => {
                        if (value === "none") {
                          setSelectedSourceType(null);
                          setSelectedSourceId(null);
                        } else {
                          const [type, id] = value.split(":");
                          setSelectedSourceType(type as "area" | "project");
                          setSelectedSourceId(id);
                        }
                      }}
                    >
                      <SelectTrigger className="bg-zinc-800 border-zinc-700 text-zinc-200">
                        <SelectValue placeholder="Sin asignar" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-800 border-zinc-700 max-h-60 overflow-y-auto">
                        <SelectItem value="none" className="text-zinc-400">Sin asignar</SelectItem>
                        {areas.length > 0 && (
                          <SelectGroup>
                            <SelectLabel className="text-zinc-500">Áreas</SelectLabel>
                            {areas.map((area: Area) => (
                              <SelectItem key={area.id} value={`area:${area.id}`} className="text-zinc-200">
                                {area.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        )}
                        {allProjects.length > 0 && (
                          <SelectGroup>
                            <SelectLabel className="text-zinc-500">Quests</SelectLabel>
                            {allProjects.map((project) => (
                              <SelectItem key={project.id} value={`project:${project.id}`} className="text-zinc-200">
                                {project.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}
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

      <div className="flex w-full border-b border-zinc-700 mb-3 overflow-x-auto scrollbar-hide">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setViewingEntry(null); }}
            className={`shrink-0 px-2 py-1.5 text-xs transition-colors border-b-2 -mb-[1px] whitespace-nowrap ${
              activeTab === tab.id 
                ? "border-zinc-400 text-zinc-200" 
                : "border-transparent text-zinc-500 hover:text-zinc-400"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mb-3 pb-2 border-b border-zinc-700/50">
        <span className="text-xs text-zinc-500 uppercase tracking-wider">
          {currentEntries.length} {getTabPlural(activeTab)}
        </span>
        <div className="h-px w-8 bg-gradient-to-r from-zinc-600 to-transparent mt-1" />
      </div>

      <div className="flex flex-1 min-h-0 flex-col sm:flex-row gap-5 sm:gap-3">
        <div 
          className="w-full sm:w-1/2 bg-zinc-800/30 rounded border border-zinc-700/50 p-3 cursor-pointer select-none shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]"
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
                  No hay {getTabPlural(activeTab)} aún
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
          className="w-full sm:w-1/2 h-full bg-zinc-800/20 rounded border border-zinc-700/50 p-4 cursor-pointer select-none shadow-[inset_0_2px_4px_rgba(0,0,0,0.15)]"
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

interface SkillWithSource extends Skill {
  sourceName: string;
  sourceSkills: Skill[];
}

interface SourceGroup {
  name: string;
  skills: SkillWithSource[];
  levelSubtitles: Record<string, string>;
  levelSubtitleDescriptions: Record<string, string>;
  unlockedLevel: number;
}

function AchievementsSection({ learnings = [], tools = [], thoughts = [] }: { learnings?: JournalLearning[]; tools?: JournalTool[]; thoughts?: JournalThought[] }) {
  const { areas, mainQuests, sideQuests } = useSkillTree();
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [selectedSubtasks, setSelectedSubtasks] = useState<Skill[]>([]);
  const [selectedSubtaskId, setSelectedSubtaskId] = useState<string | null>(null);
  const [selectedSourceSkills, setSelectedSourceSkills] = useState<Skill[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(new Set());
  const [selectedLevel, setSelectedLevel] = useState<{ level: number; subtitle: string; description: string; groupName: string } | null>(null);
  const [selectedGroupName, setSelectedGroupName] = useState<string | null>(null);
  const [viewingThought, setViewingThought] = useState<JournalThought | null>(null);
  const [viewingLearning, setViewingLearning] = useState<JournalLearning | null>(null);
  const [viewingTool, setViewingTool] = useState<JournalTool | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Extract skill name from learning title
  // Format: "Skill Title (+XP en SkillName)"
  const extractSkillNameFromLearning = (title: string): { skillName: string; xp: number } | null => {
    const match = title.match(/\(\+(\d+)\s+XP\s+en\s+([^)]+)\)/);
    if (match) {
      return { xp: parseInt(match[1]), skillName: match[2] };
    }
    return null;
  };
  
  // Get learnings and tools for the selected skill
  const getRelatedEntries = (skillId: string) => {
    const relatedLearnings = learnings.filter(l => l.skillId === skillId);
    const relatedTools = tools.filter(t => t.skillId === skillId);
    
    return { learnings: relatedLearnings, tools: relatedTools };
  };

  // Get thoughts for the selected skill by skillId
  const getThoughtsForSkill = (skillId: string) => {
    return thoughts.filter(t => t.skillId === skillId);
  };
  
  // Group completed skills by source
  const sourceGroups: SourceGroup[] = [];
  
  // Sort function to order skills like in the skill tree
  const sortByPosition = (a: Skill, b: Skill) => {
    if (a.level !== b.level) return a.level - b.level;
    return a.y - b.y;
  };

  // From areas
  areas.forEach((area: Area) => {
    const allSkillsToShow = area.skills
      .filter((s: Skill) => {
        const titleLower = s.title.toLowerCase();
        const isPlaceholder = titleLower === "inicio" || titleLower.includes("next challenge") || titleLower.includes("next challange") || titleLower.includes("next objective quest") || titleLower.includes("objective quest");
        if (isPlaceholder) return false;
        
        // Only show mastered skills from the unlocked level
        if (s.level === area.unlockedLevel && s.status === "mastered") return true;
        // Show available (next) skill from unlocked level
        if (s.level === area.unlockedLevel && s.status === "available") return true;
        
        // For previous levels, only show mastered skills
        if (s.level < area.unlockedLevel && s.status === "mastered") return true;
        
        return false;
      })
      .sort(sortByPosition)
      .map((skill: Skill) => ({ ...skill, sourceName: area.name, sourceSkills: area.skills }));
    if (allSkillsToShow.length > 0) {
      sourceGroups.push({ name: area.name, skills: allSkillsToShow, levelSubtitles: area.levelSubtitles || {}, levelSubtitleDescriptions: area.levelSubtitleDescriptions || {}, unlockedLevel: area.unlockedLevel });
    }
  });
  
  // From main quests
  mainQuests.forEach((project: Project) => {
    const allSkillsToShow = project.skills
      .filter((s: Skill) => {
        const titleLower = s.title.toLowerCase();
        const isPlaceholder = titleLower === "inicio" || titleLower.includes("next challenge") || titleLower.includes("next challange") || titleLower.includes("next objective quest") || titleLower.includes("objective quest");
        if (isPlaceholder) return false;
        
        // Only show mastered skills from the unlocked level
        if (s.level === project.unlockedLevel && s.status === "mastered") return true;
        // Show available (next) skill from unlocked level
        if (s.level === project.unlockedLevel && s.status === "available") return true;
        
        // For previous levels, only show mastered skills
        if (s.level < project.unlockedLevel && s.status === "mastered") return true;
        
        return false;
      })
      .sort(sortByPosition)
      .map((skill: Skill) => ({ ...skill, sourceName: project.name, sourceSkills: project.skills }));
    if (allSkillsToShow.length > 0) {
      sourceGroups.push({ name: project.name, skills: allSkillsToShow, levelSubtitles: project.levelSubtitles || {}, levelSubtitleDescriptions: project.levelSubtitleDescriptions || {}, unlockedLevel: project.unlockedLevel });
    }
  });
  
  // From side quests
  sideQuests.forEach((project: Project) => {
    const allSkillsToShow = project.skills
      .filter((s: Skill) => {
        const titleLower = s.title.toLowerCase();
        const isPlaceholder = titleLower === "inicio" || titleLower.includes("next challenge") || titleLower.includes("next challange") || titleLower.includes("next objective quest") || titleLower.includes("objective quest");
        if (isPlaceholder) return false;
        
        // Only show mastered skills from the unlocked level
        if (s.level === project.unlockedLevel && s.status === "mastered") return true;
        // Show available (next) skill from unlocked level
        if (s.level === project.unlockedLevel && s.status === "available") return true;
        
        // For previous levels, only show mastered skills
        if (s.level < project.unlockedLevel && s.status === "mastered") return true;
        
        return false;
      })
      .sort(sortByPosition)
      .map((skill: Skill) => ({ ...skill, sourceName: project.name, sourceSkills: project.skills }));
    if (allSkillsToShow.length > 0) {
      sourceGroups.push({ name: project.name, skills: allSkillsToShow, levelSubtitles: project.levelSubtitles || {}, levelSubtitleDescriptions: project.levelSubtitleDescriptions || {}, unlockedLevel: project.unlockedLevel });
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

  const toggleLevel = (key: string) => {
    setExpandedLevels(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
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
    setSelectedLevel(null);
    setSelectedSourceSkills(skill.sourceSkills);
    try {
      const response = await fetch(`/api/skills/${skill.id}/subskills`);
      const allSubtasks = await response.json();
      const visibleLevels = calculateVisibleLevels(allSubtasks);
      const visibleSubtasks = allSubtasks
        .filter((s: Skill) => {
          const title = s.title.toLowerCase();
          const isPlaceholder = title === "inicio" || title.includes("next challenge") || title.includes("next challange") || title.includes("objective quest");
          return visibleLevels.has(s.level) && !isPlaceholder;
        })
        .sort(sortByPosition);
      setSelectedSubtasks(visibleSubtasks);
    } catch {
      setSelectedSubtasks([]);
    }
  };

  const handleThoughtLongPressStart = () => {
    longPressTimer.current = setTimeout(() => {
      // Long press triggered
    }, 500);
  };

  const handleThoughtLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleLearningClick = (learning: JournalLearning) => {
    longPressTimer.current = setTimeout(() => {
      setViewingLearning(learning);
    }, 500);
  };

  const handleLearningEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleToolClick = (tool: JournalTool) => {
    longPressTimer.current = setTimeout(() => {
      setViewingTool(tool);
    }, 500);
  };

  const handleToolEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  return (
    <>
      {/* Thought Detail Dialog */}
      <Dialog open={!!viewingThought} onOpenChange={(open) => !open && setViewingThought(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-700 max-w-lg">
          <DialogTitle className="text-zinc-100">
            {viewingThought?.title}
          </DialogTitle>
          <div className="space-y-3">
            <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {viewingThought?.sentence}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Learning Detail Dialog */}
      <Dialog open={!!viewingLearning} onOpenChange={(open) => !open && setViewingLearning(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-700 max-w-lg">
          <DialogTitle className="text-zinc-100">
            {viewingLearning?.title}
          </DialogTitle>
          <div className="space-y-3">
            <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {viewingLearning?.sentence}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tool Detail Dialog */}
      <Dialog open={!!viewingTool} onOpenChange={(open) => !open && setViewingTool(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-700 max-w-lg">
          <DialogTitle className="text-zinc-100">
            {viewingTool?.title}
          </DialogTitle>
          <div className="space-y-3">
            <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {viewingTool?.sentence}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex h-full overflow-hidden flex-col md:flex-row gap-8 md:gap-0">
        <div className={`${hasSubtasks ? 'md:w-1/3' : 'md:w-1/2'} w-full md:h-full max-h-[30vh] md:max-h-none overflow-hidden md:border-r border-border md:pr-4`}>
        <ScrollArea className="h-full">
          <div className="flex flex-col min-h-0">
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
                    onClick={() => {
                      toggleGroup(group.name);
                      setSelectedGroupName(group.name);
                      setSelectedSkillId(null);
                      setSelectedSubtaskId(null);
                      setSelectedLevel(null);
                    }}
                    className="w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-muted/50 flex items-center justify-between"
                    data-testid={`group-${group.name}`}
                  >
                    <span>{group.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {expandedGroups.has(group.name) ? "▼" : "▶"} {group.skills.length}
                    </span>
                  </button>
                  {expandedGroups.has(group.name) && (
                    <div className="ml-3 border-l border-border pl-2 space-y-0.5 flex flex-col">
                      {(() => {
                        // Group skills by level
                        const skillsByLevel = new Map<number, SkillWithSource[]>();
                        group.skills.forEach(skill => {
                          const level = skill.level;
                          if (!skillsByLevel.has(level)) {
                            skillsByLevel.set(level, []);
                          }
                          skillsByLevel.get(level)!.push(skill);
                        });
                        
                        // Sort levels and filter to show only levels up to and including the unlocked level
                        const allLevels = Array.from(skillsByLevel.keys()).sort((a, b) => a - b);
                        const sortedLevels = allLevels.filter(level => level <= group.unlockedLevel);
                        
                        return sortedLevels.map(level => {
                          const levelSkills = skillsByLevel.get(level)!;
                          const subtitle = group.levelSubtitles[level.toString()] || "";
                          const description = group.levelSubtitleDescriptions[level.toString()] || "";
                          const levelKey = `${group.name}-level-${level}`;
                          const levelLabel = subtitle ? `Nivel ${level}: ${subtitle}` : `Nivel ${level}`;
                          const isLevelSelected = selectedLevel?.groupName === group.name && selectedLevel?.level === level;
                          
                          return (
                            <div key={levelKey}>
                              <button
                                onClick={() => {
                                  toggleLevel(levelKey);
                                  setSelectedLevel({ level, subtitle, description, groupName: group.name });
                                  setSelectedSkillId(null);
                                  setSelectedSubtaskId(null);
                                  setSelectedSubtasks([]);
                                }}
                                className={`w-full text-left px-3 py-1.5 rounded-md text-xs font-medium transition-colors hover:bg-muted/50 flex items-center justify-between ${expandedLevels.has(levelKey) ? "bg-muted/30 text-foreground" : "text-muted-foreground"}`}
                              >
                                <span>{levelLabel}</span>
                                <span className="text-xs">
                                  {expandedLevels.has(levelKey) ? "▼" : "▶"} {levelSkills.length}
                                </span>
                              </button>
                              {expandedLevels.has(levelKey) && (
                                <div className="ml-3 border-l border-border/50 pl-2 space-y-0.5 flex flex-col">
                                  {levelSkills.map((skill) => {
                                    const isCompleted = skill.status === "mastered";
                                    const isManuallyLocked = skill.manualLock === 1;
                                    return (
                                      <button
                                        key={skill.id}
                                        onClick={() => handleSelectSkill(skill)}
                                        className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
                                          selectedSkillId === skill.id 
                                            ? "bg-muted text-foreground" 
                                            : isCompleted
                                              ? "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                              : isManuallyLocked
                                                ? "text-muted-foreground/60 hover:bg-muted/50 hover:text-muted-foreground"
                                                : "text-yellow-600 dark:text-yellow-500 hover:bg-muted/50 hover:text-yellow-500"
                                        }`}
                                        data-testid={`diary-entry-${skill.id}`}
                                      >
                                        {!isCompleted && "○ "}{skill.title}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          </div>
        </ScrollArea>
      </div>
      
      {hasSubtasks && (
        <div className="w-full md:w-1/3 md:h-full max-h-[24vh] md:max-h-none overflow-hidden md:border-r border-border md:px-4 flex flex-col">
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
      
      <div className={`${hasSubtasks ? 'md:w-1/3' : 'md:w-1/2'} w-full h-full pt-2 md:pt-0 md:pl-4 overflow-hidden flex-1 min-h-0`}>
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
              
              {/* Thoughts Section */}
              {(() => {
                const skillThoughts = getThoughtsForSkill(selectedSkill.id);
                return skillThoughts.length > 0 ? (
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs text-foreground uppercase tracking-wide mb-2 font-semibold flex items-center gap-1">
                      <BookOpen className="h-3 w-3 text-purple-400" /> Thoughts
                    </p>
                    <div className="space-y-2">
                      {skillThoughts.map((thought) => (
                        <div
                          key={thought.id}
                          className="bg-zinc-800/30 rounded p-2 border border-zinc-700/30 cursor-pointer hover:bg-zinc-800/50 transition-colors"
                          onMouseDown={() => handleThoughtLongPressStart()}
                          onMouseUp={() => {
                            handleThoughtLongPressEnd();
                            setViewingThought(thought);
                          }}
                          onMouseLeave={() => handleThoughtLongPressEnd()}
                          onTouchStart={() => handleThoughtLongPressStart()}
                          onTouchEnd={() => {
                            handleThoughtLongPressEnd();
                            setViewingThought(thought);
                          }}
                        >
                          <p className="text-xs font-medium text-zinc-100">{thought.title}</p>
                          <p className="text-xs text-zinc-400 line-clamp-2">{thought.sentence}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}
              
              {/* XP and Skill Section */}
              {selectedSkill && "experiencePoints" in selectedSkill && (selectedSkill as any).experiencePoints > 0 && (
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-foreground uppercase tracking-wide mb-2 font-semibold">Experience</p>
                  <p className="text-sm font-medium text-blue-400">+{(selectedSkill as any).experiencePoints} XP</p>
                </div>
              )}
              
              {/* Learnings Section */}
              {(() => {
                const { learnings: relatedLearnings } = getRelatedEntries(selectedSkill.id);
                return relatedLearnings.length > 0 ? (
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs text-foreground uppercase tracking-wide mb-2 font-semibold flex items-center gap-1">
                      <Lightbulb className="h-3 w-3 text-yellow-500" /> Learnings
                    </p>
                    <div className="space-y-2">
                      {relatedLearnings.map((learning) => (
                        <div
                          key={learning.id}
                          className="bg-zinc-800/30 rounded p-2 border border-zinc-700/30 cursor-pointer hover:bg-zinc-800/50 transition-colors"
                          onMouseDown={() => handleLearningClick(learning)}
                          onMouseUp={handleLearningEnd}
                          onMouseLeave={handleLearningEnd}
                          onTouchStart={() => handleLearningClick(learning)}
                          onTouchEnd={handleLearningEnd}
                        >
                          <p className="text-xs text-zinc-300 line-clamp-2">{learning.sentence}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}
              
              {/* Tools Section */}
              {(() => {
                const { tools: relatedTools } = getRelatedEntries(selectedSkill.id);
                return relatedTools.length > 0 ? (
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs text-foreground uppercase tracking-wide mb-2 font-semibold flex items-center gap-1">
                      <Wrench className="h-3 w-3 text-blue-400" /> Tools
                    </p>
                    <div className="space-y-2">
                      {relatedTools.map((tool) => (
                        <div
                          key={tool.id}
                          className="bg-zinc-800/30 rounded p-2 border border-zinc-700/30 cursor-pointer hover:bg-zinc-800/50 transition-colors"
                          onMouseDown={() => handleToolClick(tool)}
                          onMouseUp={handleToolEnd}
                          onMouseLeave={handleToolEnd}
                          onTouchStart={() => handleToolClick(tool)}
                          onTouchEnd={handleToolEnd}
                        >
                          <p className="text-xs font-medium text-zinc-100">{tool.title}</p>
                          <p className="text-xs text-zinc-400 line-clamp-2">{tool.sentence}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}
              
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
          ) : selectedLevel ? (
            <div className="h-full flex flex-col">
              {/* Chain of Thinking Path Graph */}
              {(() => {
                // Get all skills for this level in this group
                const group = sourceGroups.find(g => g.name === selectedLevel.groupName);
                if (!group) return null;
                
                const levelSkills = group.skills.filter(s => s.level === selectedLevel.level);
                
                // Collect all activities (learnings, tools, thoughts) for this level in order
                const levelActivities: Array<{id: string; type: 'learning' | 'tool' | 'thought'; title: string; sentence: string}> = [];
                
                levelSkills.forEach(skill => {
                  // Get activities in order they were added (by skillId which contains timestamp)
                  const skillLearnings = learnings.filter(l => l.skillId === skill.id).map(l => ({
                    id: l.id,
                    type: 'learning' as const,
                    title: l.title,
                    sentence: l.sentence
                  }));
                  const skillTools = tools.filter(t => t.skillId === skill.id).map(t => ({
                    id: t.id,
                    type: 'tool' as const,
                    title: t.title,
                    sentence: t.sentence
                  }));
                  const skillThoughts = thoughts.filter(t => t.skillId === skill.id).map(t => ({
                    id: t.id,
                    type: 'thought' as const,
                    title: t.title,
                    sentence: t.sentence
                  }));
                  
                  levelActivities.push(...skillLearnings, ...skillTools, ...skillThoughts);
                });
                
                return (
                  <>
                    {levelActivities.length > 0 ? (
                      <div className="space-y-4">
                        <h3 className="font-medium text-foreground mb-4">
                          {selectedLevel.subtitle ? `Nivel ${selectedLevel.level}: ${selectedLevel.subtitle}` : `Nivel ${selectedLevel.level}`}
                        </h3>
                        <p className="text-xs text-muted-foreground/60 mb-6">{selectedLevel.groupName}</p>
                        
                        <div className="pt-6">
                          <div className="relative">
                            {/* Vertical line connecting all nodes */}
                            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-muted-foreground/30 to-muted-foreground/50 dark:from-zinc-600 dark:to-zinc-700" style={{height: `calc(100% - 1.5rem)`}} />
                            
                            <div className="space-y-6">
                              {levelActivities.map((activity, index) => (
                                <div key={activity.id} className="flex gap-6 relative">
                                  {/* Node */}
                                  <div className="flex-shrink-0 flex justify-center">
                                    <button
                                      onClick={() => {
                                        if (activity.type === 'learning') {
                                          const learning = learnings.find(l => l.id === activity.id);
                                          if (learning) setViewingLearning(learning);
                                        } else if (activity.type === 'tool') {
                                          const tool = tools.find(t => t.id === activity.id);
                                          if (tool) setViewingTool(tool);
                                        } else if (activity.type === 'thought') {
                                          const thought = thoughts.find(t => t.id === activity.id);
                                          if (thought) setViewingThought(thought);
                                        }
                                      }}
                                      className="w-12 h-12 rounded-full bg-background border-2 border-border flex items-center justify-center flex-shrink-0 hover:border-muted-foreground/50 transition-all hover:shadow-lg hover:shadow-foreground/10 dark:bg-zinc-900 dark:border-zinc-700 dark:hover:border-zinc-500 dark:hover:shadow-zinc-900/50 group relative z-10"
                                    >
                                      {activity.type === 'learning' ? (
                                        <Lightbulb className="h-5 w-5 text-yellow-500 group-hover:text-yellow-400" />
                                      ) : activity.type === 'tool' ? (
                                        <Wrench className="h-5 w-5 text-blue-500 group-hover:text-blue-400" />
                                      ) : (
                                        <BookOpen className="h-5 w-5 text-purple-500 group-hover:text-purple-400" />
                                      )}
                                    </button>
                                  </div>
                                  
                                  {/* Content */}
                                  <div className="flex-1 pt-1">
                                    <div className="bg-transparent border border-border/30 rounded-lg p-4 hover:bg-muted/30 transition-colors cursor-pointer group dark:bg-zinc-800/40 dark:border-zinc-700/50 dark:hover:bg-zinc-800/60"
                                      onClick={() => {
                                        if (activity.type === 'learning') {
                                          const learning = learnings.find(l => l.id === activity.id);
                                          if (learning) setViewingLearning(learning);
                                        } else if (activity.type === 'tool') {
                                          const tool = tools.find(t => t.id === activity.id);
                                          if (tool) setViewingTool(tool);
                                        } else if (activity.type === 'thought') {
                                          const thought = thoughts.find(t => t.id === activity.id);
                                          if (thought) setViewingThought(thought);
                                        }
                                      }}
                                    >
                                      <p className="text-sm font-medium text-foreground mb-2 group-hover:text-foreground transition-colors dark:text-zinc-200 dark:group-hover:text-zinc-50">
                                        {activity.title}
                                      </p>
                                      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap group-hover:text-muted-foreground/80 transition-colors dark:text-zinc-400 dark:group-hover:text-zinc-300">
                                        {activity.sentence}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-center">
                        <h3 className="font-medium text-foreground mb-2">
                          {selectedLevel.subtitle ? `Nivel ${selectedLevel.level}: ${selectedLevel.subtitle}` : `Nivel ${selectedLevel.level}`}
                        </h3>
                        <p className="text-xs text-muted-foreground/60">
                          {selectedLevel.groupName}
                        </p>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          ) : selectedGroupName ? (
            <div className="space-y-4">
              <h3 className="font-medium text-foreground">
                {selectedGroupName}
              </h3>
              
              {/* Chain of Thinking Path Graph for Full Group */}
              {(() => {
                const group = sourceGroups.find(g => g.name === selectedGroupName);
                if (!group) return null;
                
                // Group activities by level
                const activitiesByLevel: Record<number, Array<{id: string; type: 'learning' | 'tool' | 'thought'; title: string; sentence: string}>> = {};
                
                group.skills.forEach(skill => {
                  // Get activities for this skill
                  const skillLearnings = learnings.filter(l => l.skillId === skill.id).map(l => ({
                    id: l.id,
                    type: 'learning' as const,
                    title: l.title,
                    sentence: l.sentence
                  }));
                  const skillTools = tools.filter(t => t.skillId === skill.id).map(t => ({
                    id: t.id,
                    type: 'tool' as const,
                    title: t.title,
                    sentence: t.sentence
                  }));
                  const skillThoughts = thoughts.filter(t => t.skillId === skill.id).map(t => ({
                    id: t.id,
                    type: 'thought' as const,
                    title: t.title,
                    sentence: t.sentence
                  }));
                  
                  const levelActivities = [...skillLearnings, ...skillTools, ...skillThoughts];
                  if (!activitiesByLevel[skill.level]) {
                    activitiesByLevel[skill.level] = [];
                  }
                  activitiesByLevel[skill.level].push(...levelActivities);
                });
                
                const sortedLevels = Object.keys(activitiesByLevel)
                  .map(Number)
                  .sort((a, b) => a - b);
                
                return sortedLevels.length > 0 ? (
                  <div className="pt-6 space-y-8">
                    {sortedLevels.map((level, levelIndex) => {
                      const levelActivities = activitiesByLevel[level];
                      const hasRealSubtitle = group.levelSubtitles[level];
                      
                      return (
                        <div key={`level-${level}`}>
                          {/* Level Separator */}
                          <div className="text-center mb-6">
                            <div className="flex items-center gap-4 mb-2">
                              <div className="flex-1 h-px bg-gradient-to-r from-muted-foreground/30 to-transparent dark:from-zinc-600/50 dark:to-transparent" />
                              <span className="text-sm font-semibold text-muted-foreground dark:text-zinc-400 whitespace-nowrap">
                                LEVEL {level}
                              </span>
                              <div className="flex-1 h-px bg-gradient-to-l from-muted-foreground/30 to-transparent dark:from-zinc-600/50 dark:to-transparent" />
                            </div>
                            {hasRealSubtitle && (
                              <p className="text-sm text-muted-foreground/70 dark:text-zinc-500">
                                {hasRealSubtitle}
                              </p>
                            )}
                          </div>
                          
                          {/* Activities for this level */}
                          <div className="relative">
                            {/* Vertical line for this level */}
                            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-muted-foreground/30 to-muted-foreground/50 dark:from-zinc-600 dark:to-zinc-700" style={{height: `calc(100% - 1.5rem)`}} />
                            
                            <div className="space-y-6">
                              {levelActivities.map((activity, index) => (
                                <div key={activity.id} className="flex gap-6 relative">
                                  {/* Node */}
                                  <div className="flex-shrink-0 flex justify-center">
                                    <button
                                      onClick={() => {
                                        if (activity.type === 'learning') {
                                          const learning = learnings.find(l => l.id === activity.id);
                                          if (learning) setViewingLearning(learning);
                                        } else if (activity.type === 'tool') {
                                          const tool = tools.find(t => t.id === activity.id);
                                          if (tool) setViewingTool(tool);
                                        } else if (activity.type === 'thought') {
                                          const thought = thoughts.find(t => t.id === activity.id);
                                          if (thought) setViewingThought(thought);
                                        }
                                      }}
                                      className="w-12 h-12 rounded-full bg-background border-2 border-border flex items-center justify-center flex-shrink-0 hover:border-muted-foreground/50 transition-all hover:shadow-lg hover:shadow-foreground/10 dark:bg-zinc-900 dark:border-zinc-700 dark:hover:border-zinc-500 dark:hover:shadow-zinc-900/50 group relative z-10"
                                    >
                                      {activity.type === 'learning' ? (
                                        <Lightbulb className="h-5 w-5 text-yellow-500 group-hover:text-yellow-400" />
                                      ) : activity.type === 'tool' ? (
                                        <Wrench className="h-5 w-5 text-blue-500 group-hover:text-blue-400" />
                                      ) : (
                                        <BookOpen className="h-5 w-5 text-purple-500 group-hover:text-purple-400" />
                                      )}
                                    </button>
                                  </div>
                                  
                                  {/* Content */}
                                  <div className="flex-1 pt-1">
                                    <div className="bg-transparent border border-border/30 rounded-lg p-4 hover:bg-muted/30 transition-colors cursor-pointer group dark:bg-zinc-800/40 dark:border-zinc-700/50 dark:hover:bg-zinc-800/60"
                                      onClick={() => {
                                        if (activity.type === 'learning') {
                                          const learning = learnings.find(l => l.id === activity.id);
                                          if (learning) setViewingLearning(learning);
                                        } else if (activity.type === 'tool') {
                                          const tool = tools.find(t => t.id === activity.id);
                                          if (tool) setViewingTool(tool);
                                        } else if (activity.type === 'thought') {
                                          const thought = thoughts.find(t => t.id === activity.id);
                                          if (thought) setViewingThought(thought);
                                        }
                                      }}
                                    >
                                      <p className="text-sm font-medium text-foreground mb-2 group-hover:text-foreground transition-colors dark:text-zinc-200 dark:group-hover:text-zinc-50">
                                        {activity.title}
                                      </p>
                                      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap group-hover:text-muted-foreground/80 transition-colors dark:text-zinc-400 dark:group-hover:text-zinc-300">
                                        {activity.sentence}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground/50 italic">
                    Sin actividades registradas
                  </p>
                );
              })()}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground/40 text-sm">
              Select a task
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

const SKILLS_LIST = ["Limpieza", "Guitarra", "Lectura", "Growth mindset", "Comunicación"];
const xpPerLevel = 500;

interface LegacySkill {
  name: string;
  currentXp: number;
  level: number;
  goalXp?: number;
  completed?: boolean;
  completedAt?: string | null;
}

function SkillsSection({ journalLearnings, journalTools, journalThoughts }: { journalLearnings: JournalLearning[]; journalTools: JournalTool[]; journalThoughts: JournalThought[] }) {
  const queryClient = useQueryClient();
  const { globalSkills, globalSkillsLoading, refetchGlobalSkills, deleteGlobalSkill, createGlobalSkill, areas, mainQuests, sideQuests, emergentQuests, experienceQuests } = useSkillTree();
  
  // Legacy skills from localStorage (the original hardcoded ones)
  const [legacySkills, setLegacySkills] = useState<Record<string, LegacySkill>>({});
  
  // State for legacy skill area/quest association dialog
  const [legacySkillDialogOpen, setLegacySkillDialogOpen] = useState(false);
  const [selectedLegacySkill, setSelectedLegacySkill] = useState<string | null>(null);
  const [selectedSourceType, setSelectedSourceType] = useState<"area" | "project" | null>(null);
  const [selectedAreaIds, setSelectedAreaIds] = useState<string[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [isEditingGlobalSkill, setIsEditingGlobalSkill] = useState(false);
  const [legacySkillAssociations, setLegacySkillAssociations] = useState<Record<string, Array<{ type: "area" | "project"; id: string }>>>({});
  const [pressingSkill, setPressingSkill] = useState<string | null>(null);
  const [legacySkillMenuOpen, setLegacySkillMenuOpen] = useState<string | null>(null);
  const [legacySkillMenuPosition, setLegacySkillMenuPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const legacyLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const legacyIsLongPress = useRef(false);
  const legacyMenuOpenTime = useRef<number>(0);
  
  // Global skill menu state
  const [globalSkillMenuOpen, setGlobalSkillMenuOpen] = useState<string | null>(null);
  const [globalSkillMenuPosition, setGlobalSkillMenuPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const globalLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const globalIsLongPress = useRef(false);
  const globalMenuOpenTime = useRef<number>(0);
  const [pressingGlobalSkill, setPressingGlobalSkill] = useState<string | null>(null);
  const [longTermModalOpen, setLongTermModalOpen] = useState(false);
  
  // State for creating new global skill
  const [isCreateSkillDialogOpen, setIsCreateSkillDialogOpen] = useState(false);
  const [skillCreationMode, setSkillCreationMode] = useState<'mode-selection' | 'subskill' | 'skill' | null>(null);
  const [parentSkillForSubskill, setParentSkillForSubskill] = useState<string>("");
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillAreaId, setNewSkillAreaId] = useState<string>("");
  const [newSkillProjectId, setNewSkillProjectId] = useState<string>("");
  const createSkillLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // State for subskill long-press menu
  const [pressingSubskill, setPressingSubskill] = useState<string | null>(null);
  const [subskillMenuOpen, setSubskillMenuOpen] = useState<string | null>(null);
  const [subskillMenuPosition, setSubskillMenuPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const subskillLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subskillIsLongPress = useRef(false);
  const subskillMenuOpenTime = useRef<number>(0);
  
  // State for Meta modal
  const [metaModalOpen, setMetaModalOpen] = useState(false);
  const [selectedSkillForMeta, setSelectedSkillForMeta] = useState<{ id: string; name: string } | null>(null);
  const [goalXpValue, setGoalXpValue] = useState<string>("");
  
  // Clean up corrupted localStorage data with "0" prefixes on mount ONCE
  useEffect(() => {
    const raw = localStorage.getItem('skillsProgress');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      const cleaned: Record<string, any> = {};
      for (const key of Object.keys(parsed)) {
        const cleanKey = key.replace(/^0+/, '');
        const skill = parsed[key];
        cleaned[cleanKey] = {
          ...skill,
          name: skill.name?.replace(/^0+/, '') ?? cleanKey
        };
      }
      localStorage.setItem('skillsProgress', JSON.stringify(cleaned));
      console.log('[CleanupEffect] Cleaned corrupted localStorage data');
    } catch (e) {
      console.error('[CleanupEffect] Error cleaning localStorage:', e);
    }
  }, []);

  // Monitor legacySkillMenuOpen state changes
  useEffect(() => {
    console.log('[STATE CHANGE] legacySkillMenuOpen updated to:', legacySkillMenuOpen);
  }, [legacySkillMenuOpen]);

  // Monitor globalSkillMenuOpen state changes
  useEffect(() => {
    console.log('[STATE CHANGE] globalSkillMenuOpen updated to:', globalSkillMenuOpen);
  }, [globalSkillMenuOpen]);

  // Load legacy skill associations from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("legacySkillAssociations");
    console.log('[SkillsSection] Loading legacySkillAssociations from localStorage:', stored);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Migration: convert old single association to array
        // Also clean up "0" prefix from skill names
        const migrated: Record<string, Array<{ type: "area" | "project"; id: string }>> = {};
        let hasCleanupNeeded = false;
        
        Object.entries(parsed).forEach(([skill, assoc]) => {
            // Clean up "0" prefix in skill name
            const cleanedSkillName = (typeof skill === 'string' && skill.startsWith('0') && skill !== '0') 
              ? skill.substring(1) 
              : skill;
            if (cleanedSkillName !== skill) {
              hasCleanupNeeded = true;
              console.log('[SkillsSection] Cleaned association skill name:', skill, '→', cleanedSkillName);
            }
            
            if (Array.isArray(assoc)) {
              migrated[cleanedSkillName] = assoc.filter(a =>
                a &&
                typeof a === 'object' &&
                (a.type === 'area' || a.type === 'project') &&
                typeof a.id === 'string'
              );
            } else if (
              assoc &&
              typeof assoc === 'object' &&
              ('type' in assoc) && ('id' in assoc) &&
              ((assoc as any).type === 'area' || (assoc as any).type === 'project') &&
              typeof (assoc as any).id === 'string'
            ) {
              migrated[cleanedSkillName] = [{
                type: (assoc as any).type,
                id: (assoc as any).id
              }];
            } // else skip invalid
        });
        
        if (hasCleanupNeeded) {
          console.log('[SkillsSection] Saved cleaned legacySkillAssociations to localStorage');
          localStorage.setItem("legacySkillAssociations", JSON.stringify(migrated));
        }
        
        setLegacySkillAssociations(migrated);
      } catch (e) {
        console.error("Error parsing legacy skill associations:", e);
      }
    }
  }, []);
  
  // All quests combined
  const allProjects = [...mainQuests, ...sideQuests, ...emergentQuests, ...experienceQuests];
  
  // Handlers for legacy skill long-press
  const handleLegacySkillPointerDown = (e: React.PointerEvent, skillName: string) => {
    console.log('[LegacySkill] PointerDown:', skillName, e.pointerType);
    // Stop propagation to prevent closing menu
    e.stopPropagation();
    
    setPressingSkill(skillName);
    legacyIsLongPress.current = false;
    
    // Close menu if clicking on different skill
    if (legacySkillMenuOpen && legacySkillMenuOpen !== skillName) {
      setLegacySkillMenuOpen(null);
    }
    
    // Clear any existing timer
    if (legacyLongPressTimer.current) {
      clearTimeout(legacyLongPressTimer.current);
    }
    
    legacyLongPressTimer.current = setTimeout(() => {
      console.log('[LegacySkill] Long press TRIGGERED:', skillName);
      legacyIsLongPress.current = true;
      setPressingSkill(null);
      legacyMenuOpenTime.current = Date.now();
      setLegacySkillMenuPosition({ x: e.clientX, y: e.clientY });
      setLegacySkillMenuOpen(skillName);
    }, 400);
  };
  
  const handleLegacySkillPointerUp = (e: React.PointerEvent) => {
    console.log('[LegacySkill] PointerUp', { wasLongPress: legacyIsLongPress.current });
    // Stop propagation to prevent closing menu if menu is open
    if (legacySkillMenuOpen || legacyIsLongPress.current) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    if (legacyIsLongPress.current) {
      // Menu handling already done in long press timeout
    } else {
      setPressingSkill(null);
      // Don't close menu - it should only close when user clicks outside or on a menu option
      // Keep menu open if it was recently opened
    }
    legacyIsLongPress.current = false;
    if (legacyLongPressTimer.current) {
      clearTimeout(legacyLongPressTimer.current);
      legacyLongPressTimer.current = null;
    }
  };
  
  const handleLegacySkillPointerCancel = (e: React.PointerEvent) => {
    console.log('[LegacySkill] PointerCancel');
    if (legacyIsLongPress.current) {
      e.stopPropagation();
      e.preventDefault();
      // Don't close menu if long press happened - menu should stay open
    } else {
      setPressingSkill(null);
      // Only close menu if enough time has passed since opening
      const timeSinceOpen = Date.now() - legacyMenuOpenTime.current;
      if (timeSinceOpen > 100) {
        // Safe to close menu if it's been open for >100ms without long press
        // setLegacySkillMenuOpen(null);
      }
    }
    legacyIsLongPress.current = false;
    if (legacyLongPressTimer.current) {
      clearTimeout(legacyLongPressTimer.current);
      legacyLongPressTimer.current = null;
    }
  };
  
  // Global skill long-press handlers
  const handleGlobalSkillPointerDown = (e: React.PointerEvent, skillId: string) => {
    console.log('[GlobalSkill] PointerDown:', skillId, e.pointerType);
    // Stop propagation to prevent closing menu
    e.stopPropagation();
    
    setPressingGlobalSkill(skillId);
    globalIsLongPress.current = false;
    
    // Close menu if clicking on different skill
    if (globalSkillMenuOpen && globalSkillMenuOpen !== skillId) {
      setGlobalSkillMenuOpen(null);
    }
    
    // Clear any existing timer
    if (globalLongPressTimer.current) {
      clearTimeout(globalLongPressTimer.current);
    }
    
    globalLongPressTimer.current = setTimeout(() => {
      console.log('[GlobalSkill] Long press TRIGGERED:', skillId);
      globalIsLongPress.current = true;
      setPressingGlobalSkill(null);
      globalMenuOpenTime.current = Date.now();
      setGlobalSkillMenuPosition({ x: e.clientX, y: e.clientY });
      setGlobalSkillMenuOpen(skillId);
    }, 400);
  };
  
  const handleGlobalSkillPointerUp = (e: React.PointerEvent) => {
    console.log('[GlobalSkill] PointerUp', { wasLongPress: globalIsLongPress.current });
    // Stop propagation to prevent closing menu if menu is open
    if (globalSkillMenuOpen || globalIsLongPress.current) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    if (globalIsLongPress.current) {
      // Menu handling already done in long press timeout
    } else {
      setPressingGlobalSkill(null);
      // Don't close menu - it should only close when user clicks outside or on a menu option
      // Keep menu open if it was recently opened
    }
    globalIsLongPress.current = false;
    if (globalLongPressTimer.current) {
      clearTimeout(globalLongPressTimer.current);
      globalLongPressTimer.current = null;
    }
  };
  
  const handleGlobalSkillPointerCancel = (e: React.PointerEvent) => {
    console.log('[GlobalSkill] PointerCancel');
    if (globalIsLongPress.current) {
      e.stopPropagation();
      e.preventDefault();
      // Don't close menu if long press happened - menu should stay open
    } else {
      setPressingGlobalSkill(null);
      // Only close menu if enough time has passed since opening
      const timeSinceOpen = Date.now() - globalMenuOpenTime.current;
      if (timeSinceOpen > 100) {
        // Safe to close menu if it's been open for >100ms without long press
        // setGlobalSkillMenuOpen(null);
      }
    }
    globalIsLongPress.current = false;
    if (globalLongPressTimer.current) {
      clearTimeout(globalLongPressTimer.current);
      globalLongPressTimer.current = null;
    }
  };
  
  // Subskill long-press handlers
  const handleSubSkillPointerDown = (e: React.PointerEvent, subskillId: string) => {
    console.log('[SubSkill] PointerDown:', subskillId, e.pointerType);
    e.stopPropagation();
    
    setPressingSubskill(subskillId);
    subskillIsLongPress.current = false;
    
    // Close menu if clicking on different subskill
    if (subskillMenuOpen && subskillMenuOpen !== subskillId) {
      setSubskillMenuOpen(null);
    }
    
    // Clear any existing timer
    if (subskillLongPressTimer.current) {
      clearTimeout(subskillLongPressTimer.current);
    }
    
    subskillLongPressTimer.current = setTimeout(() => {
      console.log('[SubSkill] Long press TRIGGERED:', subskillId);
      subskillIsLongPress.current = true;
      setPressingSubskill(null);
      subskillMenuOpenTime.current = Date.now();
      setSubskillMenuPosition({ x: e.clientX, y: e.clientY });
      setSubskillMenuOpen(subskillId);
    }, 400);
  };
  
  const handleSubSkillPointerUp = (e: React.PointerEvent) => {
    console.log('[SubSkill] PointerUp', { wasLongPress: subskillIsLongPress.current });
    if (subskillMenuOpen || subskillIsLongPress.current) {
      e.stopPropagation();
      e.preventDefault();
    }
    
    if (subskillIsLongPress.current) {
      // Menu handling already done in long press timeout
    } else {
      setPressingSubskill(null);
    }
    subskillIsLongPress.current = false;
    if (subskillLongPressTimer.current) {
      clearTimeout(subskillLongPressTimer.current);
      subskillLongPressTimer.current = null;
    }
  };
  
  const handleSubSkillPointerCancel = (e: React.PointerEvent) => {
    console.log('[SubSkill] PointerCancel');
    if (subskillIsLongPress.current) {
      e.stopPropagation();
      e.preventDefault();
    } else {
      setPressingSubskill(null);
    }
    subskillIsLongPress.current = false;
    if (subskillLongPressTimer.current) {
      clearTimeout(subskillLongPressTimer.current);
      subskillLongPressTimer.current = null;
    }
  };
  
  const handleSaveGlobalSkillArea = async () => {
    if (selectedLegacySkill && (selectedAreaIds.length > 0 || selectedProjectIds.length > 0)) {
      try {
        const skillName = selectedLegacySkill;
        const newAreaId = selectedAreaIds.length > 0 ? selectedAreaIds[0] : undefined;
        const newProjectId = selectedProjectIds.length > 0 ? selectedProjectIds[0] : undefined;
        
        // Check if skill already exists in the new area/project
        const skillAlreadyExists = globalSkills.some(s => {
          const sameArea = s.areaId === newAreaId && newAreaId !== undefined;
          const sameProject = s.projectId === newProjectId && newProjectId !== undefined;
          const sameName = s.name === skillName && !s.parentSkillId;
          return sameName && (sameArea || sameProject);
        });
        
        if (skillAlreadyExists) {
          console.log('[SkillsSection] Skill already exists in the new area/project:', { skillName, newAreaId, newProjectId });
          alert(`Skill "${skillName}" already exists in this area/quest`);
          return;
        }
        
        // Create a copy of the skill in the new area/project
        console.log('[SkillsSection] Creating copy of skill in new area/project:', { skillName, newAreaId, newProjectId });
        await createGlobalSkill(skillName, newAreaId, newProjectId);
        
        refetchGlobalSkills();
        setLegacySkillDialogOpen(false);
        setSelectedLegacySkill(null);
        setSelectedAreaIds([]);
        setSelectedProjectIds([]);
        setIsEditingGlobalSkill(false);
      } catch (error) {
        console.error('[SkillsSection] Error saving global skill area:', error);
      }
    }
  };
  
  const handleSaveAssociation = async () => {
    if (selectedLegacySkill) {
      // Get old associations before update
      const oldAssociations = legacySkillAssociations[selectedLegacySkill] || [];
      const oldAreaIds = new Set(oldAssociations.filter(a => a.type === "area").map(a => a.id));
      const oldProjectIds = new Set(oldAssociations.filter(a => a.type === "project").map(a => a.id));
      const newAreaIds = new Set(selectedAreaIds);
      const newProjectIds = new Set(selectedProjectIds);
      
      // Detect new areas and projects being added
      const newAreasAdded = selectedAreaIds.filter(id => !oldAreaIds.has(id));
      const newProjectsAdded = selectedProjectIds.filter(id => !oldProjectIds.has(id));
      
      // If new areas are being added, replicate global skills from old areas to new areas
      if (newAreasAdded.length > 0 && oldAreaIds.size > 0) {
        console.log('[SkillsSection] Replicating global skills to new areas:', newAreasAdded);
        
        // Get global skills from all old areas (including subskills)
        const oldAreaGlobalSkills = globalSkills.filter((s: GlobalSkill) => {
          const isFromOldArea = s.areaId && oldAreaIds.has(s.areaId);
          return isFromOldArea;
        });
        
        // For each new area, create copies of the global skills
        for (const newAreaId of newAreasAdded) {
          // Create parent skills first
          const parentSkillsToCreate = oldAreaGlobalSkills.filter((s: GlobalSkill) => !s.parentSkillId);
          const parentSkillMap = new Map<string, string>(); // Maps old skill ID to new skill ID
          
          for (const skill of parentSkillsToCreate) {
            try {
              // Check if skill already exists in the new area
              const skillAlreadyExists = globalSkills.some(s => {
                return s.name === skill.name && s.areaId === newAreaId && !s.parentSkillId;
              });
              
              if (!skillAlreadyExists) {
                console.log(`[SkillsSection] Creating copy of skill "${skill.name}" in new area ${newAreaId}`);
                const newSkill = await createGlobalSkill(skill.name, newAreaId);
                if (newSkill) {
                  parentSkillMap.set(skill.id, newSkill.id);
                }
              } else {
                console.log(`[SkillsSection] Skill "${skill.name}" already exists in area ${newAreaId}, skipping`);
              }
            } catch (error) {
              console.error(`[SkillsSection] Failed to replicate skill ${skill.id}:`, error);
            }
          }
          
          // Then create subskills
          const subSkillsToCreate = oldAreaGlobalSkills.filter((s: GlobalSkill) => s.parentSkillId && parentSkillMap.has(s.parentSkillId));
          for (const skill of subSkillsToCreate) {
            const newParentId = parentSkillMap.get(skill.parentSkillId!);
            if (newParentId) {
              try {
                // Check if subskill already exists in the new area with the same parent
                const subskillAlreadyExists = globalSkills.some(s => {
                  return s.name === skill.name && s.areaId === newAreaId && s.parentSkillId === newParentId;
                });
                
                if (!subskillAlreadyExists) {
                  console.log(`[SkillsSection] Creating copy of subskill "${skill.name}" in new area ${newAreaId}`);
                  await createGlobalSkill(skill.name, newAreaId, undefined, newParentId);
                } else {
                  console.log(`[SkillsSection] Subskill "${skill.name}" already exists in area ${newAreaId}, skipping`);
                }
              } catch (error) {
                console.error(`[SkillsSection] Failed to replicate subskill ${skill.id}:`, error);
              }
            }
          }
        }
      }
      
      // If new projects are being added, replicate global skills from old projects to new projects
      if (newProjectsAdded.length > 0 && oldProjectIds.size > 0) {
        console.log('[SkillsSection] Replicating global skills to new projects:', newProjectsAdded);
        
        // Get global skills from all old projects (including subskills)
        const oldProjectGlobalSkills = globalSkills.filter((s: GlobalSkill) => {
          const isFromOldProject = s.projectId && oldProjectIds.has(s.projectId);
          return isFromOldProject;
        });
        
        // For each new project, create copies of the global skills
        for (const newProjectId of newProjectsAdded) {
          // Create parent skills first
          const parentSkillsToCreate = oldProjectGlobalSkills.filter((s: GlobalSkill) => !s.parentSkillId);
          const parentSkillMap = new Map<string, string>(); // Maps old skill ID to new skill ID
          
          for (const skill of parentSkillsToCreate) {
            try {
              // Check if skill already exists in the new project
              const skillAlreadyExists = globalSkills.some(s => {
                return s.name === skill.name && s.projectId === newProjectId && !s.parentSkillId;
              });
              
              if (!skillAlreadyExists) {
                console.log(`[SkillsSection] Creating copy of skill "${skill.name}" in new project ${newProjectId}`);
                const newSkill = await createGlobalSkill(skill.name, undefined, newProjectId);
                if (newSkill) {
                  parentSkillMap.set(skill.id, newSkill.id);
                }
              } else {
                console.log(`[SkillsSection] Skill "${skill.name}" already exists in project ${newProjectId}, skipping`);
              }
            } catch (error) {
              console.error(`[SkillsSection] Failed to replicate skill ${skill.id}:`, error);
            }
          }
          
          // Then create subskills
          const subSkillsToCreate = oldProjectGlobalSkills.filter((s: GlobalSkill) => s.parentSkillId && parentSkillMap.has(s.parentSkillId));
          for (const skill of subSkillsToCreate) {
            const newParentId = parentSkillMap.get(skill.parentSkillId!);
            if (newParentId) {
              try {
                // Check if subskill already exists in the new project with the same parent
                const subskillAlreadyExists = globalSkills.some(s => {
                  return s.name === skill.name && s.projectId === newProjectId && s.parentSkillId === newParentId;
                });
                
                if (!subskillAlreadyExists) {
                  console.log(`[SkillsSection] Creating copy of subskill "${skill.name}" in new project ${newProjectId}`);
                  await createGlobalSkill(skill.name, undefined, newProjectId, newParentId);
                } else {
                  console.log(`[SkillsSection] Subskill "${skill.name}" already exists in project ${newProjectId}, skipping`);
                }
              } catch (error) {
                console.error(`[SkillsSection] Failed to replicate subskill ${skill.id}:`, error);
              }
            }
          }
        }
      }
      
      // Refetch if any changes were made
      if (newAreasAdded.length > 0 || newProjectsAdded.length > 0) {
        refetchGlobalSkills();
      }
      
      setLegacySkillAssociations(prev => {
        const updated = { ...prev };
        const arr = updated[selectedLegacySkill] || [];
        // Remove all previous associations for this skill
        let newArr: Array<{ type: "area" | "project"; id: string }> = [];
        newArr = [
          ...selectedAreaIds.map(id => ({ type: "area" as const, id })),
          ...selectedProjectIds.map(id => ({ type: "project" as const, id }))
        ];
        updated[selectedLegacySkill] = newArr;
        localStorage.setItem("legacySkillAssociations", JSON.stringify(updated));
        return updated;
      });
    }
    setLegacySkillDialogOpen(false);
    setSelectedLegacySkill(null);
    setSelectedSourceType(null);
    setSelectedAreaIds([]);
    setSelectedProjectIds([]);
  };
  
  const handleRemoveAssociation = () => {
    if (selectedLegacySkill) {
      setLegacySkillAssociations(prev => {
        const updated = { ...prev };
        updated[selectedLegacySkill] = [];
        localStorage.setItem("legacySkillAssociations", JSON.stringify(updated));
        return updated;
      });
    }
    setLegacySkillDialogOpen(false);
    setSelectedLegacySkill(null);
    setSelectedSourceType(null);
    setSelectedAreaIds([]);
    setSelectedProjectIds([]);
  };
  
  // Auto-complete skills that have reached their XP goal
  const autoCompleteReachedSkills = useCallback(async (skillsToCheck: GlobalSkill[]) => {
    for (const skill of skillsToCheck) {
      if (skill.goalXp > 0 && !skill.completed && skill.currentXp >= skill.goalXp) {
        console.log('[autoComplete] Skill reached goal - auto-completing:', skill.name, skill.currentXp, '>=', skill.goalXp);
        try {
          await fetch(`/api/global-skills/${skill.id}/complete`, { method: "PATCH" });
        } catch (error) {
          console.error('[autoComplete] Error completing skill:', error);
        }
      }
    }
  }, []);
  
  // Helper to get area/project name for display
  const getAssociationNames = (skillName: string) => {
    const assocs = legacySkillAssociations[skillName] || [];
    return assocs.map(assoc => {
      if (assoc.type === "area") {
        const area = areas.find((a: Area) => a.id === assoc.id);
        return area ? area.name : null;
      } else {
        const project = allProjects.find(p => p.id === assoc.id);
        return project ? project.name : null;
      }
    }).filter(Boolean);
  };
  
  useEffect(() => {
    const loadLegacySkills = () => {
      const stored = localStorage.getItem("skillsProgress");
      if (stored) {
        try {
          let loaded = JSON.parse(stored);
          
          // Clean up "0" prefix from all skill names
          let hasChanges = false;
          const cleaned: Record<string, LegacySkill> = {};
          
          for (const [key, skill] of Object.entries(loaded) as Array<[string, unknown]>) {
            if (typeof key === 'string' && key.startsWith('0') && key !== '0') {
              // Remove "0" prefix from key/skill name
              const cleanedKey = key.substring(1);
              const cleanedSkill = { ...skill as LegacySkill };
              if (cleanedSkill.name && cleanedSkill.name.startsWith('0')) {
                cleanedSkill.name = cleanedSkill.name.substring(1);
              }
              cleaned[cleanedKey] = cleanedSkill;
              hasChanges = true;
              console.log('[loadLegacySkills] Cleaned skill name:', key, '→', cleanedKey);
            } else {
              cleaned[key] = skill as LegacySkill;
            }
          }
          
          if (hasChanges) {
            console.log('[loadLegacySkills] Cleaned legacy skills (removed "0" prefix):', cleaned);
            localStorage.setItem("skillsProgress", JSON.stringify(cleaned));
            setLegacySkills(cleaned);
          } else {
            console.log('[loadLegacySkills] Loaded from localStorage:', loaded);
            setLegacySkills(loaded as Record<string, LegacySkill>);
          }
        } catch (e) {
          console.error("Error parsing legacy skills:", e);
          setLegacySkills({});
        }
      } else {
        console.log('[loadLegacySkills] No data in localStorage, starting empty');
        setLegacySkills({});
      }
    };
    loadLegacySkills();
  }, []);
  
  // XP per level calculation (same formula as backend)
  const calculateXpForLevel = (level: number) => {
    let totalXp = 0;
    for (let i = 1; i < level; i++) {
      totalXp += i * 100;
    }
    return totalXp;
  };
  
  const calculateXpProgress = (currentXp: number, level: number) => {
    const xpForCurrentLevel = calculateXpForLevel(level);
    const xpForNextLevel = calculateXpForLevel(level + 1);
    const xpNeeded = xpForNextLevel - xpForCurrentLevel;
    const xpProgress = currentXp - xpForCurrentLevel;
    return Math.min((xpProgress / xpNeeded) * 100, 100);
  };
  
  // Legacy XP calculation (500 XP per level)
  const calculateLegacyXpProgress = (currentXp: number, level: number) => {
    const xpInCurrentLevel = currentXp % xpPerLevel;
    return (xpInCurrentLevel / xpPerLevel) * 100;
  };

  const formatCompletedDate = (dateString: string | null | undefined): string => {
    if (!dateString) return 'Unknown';
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('es-AR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      }).format(date);
    } catch {
      return dateString;
    }
  };
  
  // Get GlobalSkills that belong to a legacy skill's associated area or project
  const getGlobalSkillsForLegacySkill = (skillName: string): GlobalSkill[] => {
    const associations = Array.isArray(legacySkillAssociations[skillName]) ? legacySkillAssociations[skillName] : [];
    const areaIds = associations.filter(a => a.type === 'area').map(a => a.id);
    const projectIds = associations.filter(a => a.type === 'project').map(a => a.id);
    const matched = globalSkills.filter((s: GlobalSkill) => {
      const isFromArea = s.areaId && areaIds.includes(s.areaId);
      const isFromProject = s.projectId && projectIds.includes(s.projectId);
      return (isFromArea || isFromProject) && !s.parentSkillId;
    });
    if (skillName === 'Música') {
      console.log('[getGlobalSkillsForLegacySkill] Música:', JSON.stringify({areaIds, globalSkillsCount: globalSkills.length, matched: matched.map((m: GlobalSkill) => ({ id: m.id, name: m.name, areaId: m.areaId }))}));
    }
    return matched;
  };
  
  // Get all area IDs that are associated with legacy skills
  const legacyAreaIds = Object.values(legacySkillAssociations)
    .flatMap(arr => Array.isArray(arr) ? arr.filter(a => a.type === 'area').map(a => a.id) : []);
  
  // Filter parent skills (not subskills) - exclude those belonging to legacy skill areas
  const parentSkills = globalSkills.filter((s: GlobalSkill) => !s.parentSkillId && !s.completed && !legacyAreaIds.includes(s.areaId || ''));
  
  // Helper function to adjust menu position to stay within viewport
  const adjustMenuPosition = (x: number, y: number): { x: number; y: number } => {
    const MENU_WIDTH = 200;
    const MENU_HEIGHT = 120;
    const PADDING = 10;
    
    let adjustedX = x;
    let adjustedY = y;
    
    // Adjust horizontal position
    if (x + MENU_WIDTH + PADDING > window.innerWidth) {
      adjustedX = Math.max(PADDING, window.innerWidth - MENU_WIDTH - PADDING);
    }
    
    // Adjust vertical position
    if (y + MENU_HEIGHT + PADDING > window.innerHeight) {
      adjustedY = Math.max(PADDING, window.innerHeight - MENU_HEIGHT - PADDING);
    }
    
    return { x: adjustedX, y: adjustedY };
  };
  
  // Get subskills for a parent
  const getSubSkillsOf = (parentId: string) => globalSkills.filter((s: GlobalSkill) => s.parentSkillId === parentId);
  
  // Get all available areas including legacy ones
  const getAllAvailableAreas = (): any[] => {
    const result: Array<{id: string; name: string; icon: string; isLegacy: boolean}> = [];
    
    // Add regular areas
    areas.forEach((area: Area) => {
      result.push({ id: area.id, name: area.name, icon: area.icon, isLegacy: false });
    });
    
    // Add legacy areas from legacySkillAssociations
    Object.keys(legacySkillAssociations).forEach(skillName => {
      const associations = legacySkillAssociations[skillName] || [];
      const areaAssocs = associations.filter(a => a.type === 'area');
      if (areaAssocs.length > 0) {
        const areaId = areaAssocs[0].id;
        // Don't duplicate if already in areas
        if (!result.some(a => a.id === areaId)) {
          result.push({ id: areaId, name: skillName, icon: '🎵', isLegacy: true });
        }
      }
    });
    
    return result;
  };
  
  // Get all available projects including legacy ones
  const getAllAvailableProjects = () => {
    const result: Array<{id: string; name: string; icon: string; isLegacy: boolean}> = [];
    
    // Add regular projects
    allProjects.forEach(project => {
      result.push({ id: project.id, name: project.name, icon: project.icon, isLegacy: false });
    });
    
    // Add legacy projects from legacySkillAssociations
    Object.keys(legacySkillAssociations).forEach(skillName => {
      const associations = legacySkillAssociations[skillName] || [];
      const projectAssocs = associations.filter(a => a.type === 'project');
      if (projectAssocs.length > 0) {
        const projectId = projectAssocs[0].id;
        // Don't duplicate if already in projects
        if (!result.some(p => p.id === projectId)) {
          result.push({ id: projectId, name: skillName, icon: '⚔️', isLegacy: true });
        }
      }
    });
    
    return result;
  };
  
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editType, setEditType] = useState<"learning" | "tool" | "thought" | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSentence, setEditSentence] = useState("");
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);

  // Refetch global skills and legacy skills when XP is added or skill is created
  useLayoutEffect(() => {
    const handleSkillXpAdded = async () => {
      console.log('[SkillsSection] === skillXpAdded event RECEIVED - refetching global skills ===');
      await refetchGlobalSkills();
      
      // Check for auto-completion after refetch
      const freshSkills = await fetch("/api/global-skills", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      }).then(r => r.json()).catch(() => []);
      
      if (freshSkills && freshSkills.length > 0) {
        await autoCompleteReachedSkills(freshSkills);
      }
      
      // Also reload legacy skills
      const stored = localStorage.getItem("skillsProgress");
      if (stored) {
        try {
          setLegacySkills(JSON.parse(stored));
        } catch (e) {
          console.error("Error reloading legacy skills:", e);
        }
      }
    };
    
    const handleGlobalSkillCreated = () => {
      console.log('[SkillsSection] === globalSkillCreated event RECEIVED - refetching global skills ===');
      refetchGlobalSkills();
    };

    window.addEventListener('skillXpAdded', handleSkillXpAdded);
    window.addEventListener('globalSkillCreated', handleGlobalSkillCreated);
    return () => {
      window.removeEventListener('skillXpAdded', handleSkillXpAdded);
      window.removeEventListener('globalSkillCreated', handleGlobalSkillCreated);
    };
  }, [refetchGlobalSkills, autoCompleteReachedSkills]);

  // Mutations for delete
  const deleteLearning = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/journal/learnings/${id}`, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/journal/learnings"] }),
  });

  const deleteTool = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/journal/tools/${id}`, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/journal/tools"] }),
  });

  const deleteThought = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/journal/thoughts/${id}`, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/journal/thoughts"] }),
  });

  // Mutations for edit
  const updateLearning = useMutation({
    mutationFn: async (data: { id: string; title: string; sentence: string }) => {
      console.log('[SkillsSection] Updating learning:', data);
      const response = await fetch(`/api/journal/learnings/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: data.title, sentence: data.sentence }),
      });
      console.log('[SkillsSection] Update response status:', response.status);
      console.log('[SkillsSection] Update response headers:', response.headers);
      
      const text = await response.text();
      console.log('[SkillsSection] Update response text:', text.substring(0, 200));
      
      if (!response.ok) {
        console.error('[SkillsSection] Update error response:', text);
        throw new Error(`Failed to update learning: ${response.status} - ${text.substring(0, 100)}`);
      }
      
      try {
        const result = JSON.parse(text);
        console.log('[SkillsSection] Update success:', result);
        return result;
      } catch (e) {
        console.error('[SkillsSection] Failed to parse JSON response:', e, 'text:', text.substring(0, 200));
        throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
      }
    },
    onSuccess: () => {
      console.log('[SkillsSection] Update mutation success');
      queryClient.invalidateQueries({ queryKey: ["/api/journal/learnings"] });
      setEditingId(null);
      setEditType(null);
      setEditTitle("");
      setEditSentence("");
    },
    onError: (error) => {
      console.error('[SkillsSection] Update mutation error:', error);
    },
  });

  const updateTool = useMutation({
    mutationFn: async (data: { id: string; title: string; sentence: string }) => {
      console.log('[SkillsSection] Updating tool:', data);
      const response = await fetch(`/api/journal/tools/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: data.title, sentence: data.sentence }),
      });
      console.log('[SkillsSection] Update response status:', response.status);
      console.log('[SkillsSection] Update response headers:', response.headers);
      
      const text = await response.text();
      console.log('[SkillsSection] Update response text:', text.substring(0, 200));
      
      if (!response.ok) {
        console.error('[SkillsSection] Update error response:', text);
        throw new Error(`Failed to update tool: ${response.status} - ${text.substring(0, 100)}`);
      }
      
      try {
        const result = JSON.parse(text);
        console.log('[SkillsSection] Update success:', result);
        return result;
      } catch (e) {
        console.error('[SkillsSection] Failed to parse JSON response:', e, 'text:', text.substring(0, 200));
        throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
      }
    },
    onSuccess: () => {
      console.log('[SkillsSection] Update mutation success');
      queryClient.invalidateQueries({ queryKey: ["/api/journal/tools"] });
      setEditingId(null);
      setEditType(null);
      setEditTitle("");
      setEditSentence("");
    },
    onError: (error) => {
      console.error('[SkillsSection] Update mutation error:', error);
    },
  });

  const updateThought = useMutation({
    mutationFn: async (data: { id: string; title: string; sentence: string }) => {
      console.log('[SkillsSection] Updating thought:', data);
      const response = await fetch(`/api/journal/thoughts/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: data.title, sentence: data.sentence }),
      });
      console.log('[SkillsSection] Update response status:', response.status);
      console.log('[SkillsSection] Update response headers:', response.headers);
      
      const text = await response.text();
      console.log('[SkillsSection] Update response text:', text.substring(0, 200));
      
      if (!response.ok) {
        console.error('[SkillsSection] Update error response:', text);
        throw new Error(`Failed to update thought: ${response.status} - ${text.substring(0, 100)}`);
      }
      
      try {
        const result = JSON.parse(text);
        console.log('[SkillsSection] Update success:', result);
        return result;
      } catch (e) {
        console.error('[SkillsSection] Failed to parse JSON response:', e, 'text:', text.substring(0, 200));
        throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
      }
    },
    onSuccess: () => {
      console.log('[SkillsSection] Update mutation success');
      queryClient.invalidateQueries({ queryKey: ["/api/journal/thoughts"] });
      setEditingId(null);
      setEditType(null);
      setEditTitle("");
      setEditSentence("");
    },
    onError: (error) => {
      console.error('[SkillsSection] Update mutation error:', error);
    },
  });

  // Long press handlers
  const handleActivityLongPressStart = (e: React.TouchEvent | React.MouseEvent, activityId: string) => {
    console.log('[SkillsSection] Long press started on:', activityId);
    e.stopPropagation();
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      console.log('[SkillsSection] Long press completed, setting selectedActivityId:', activityId);
      isLongPress.current = true;
      setSelectedActivityId(activityId);
    }, 500);
  };

  const handleActivityLongPressEnd = () => {
    console.log('[SkillsSection] Long press ended');
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleDelete = (activityId: string, activityType: "learning" | "tool" | "thought") => {
    console.log('[SkillsSection] Deleting', activityType, activityId);
    if (activityType === "learning") {
      deleteLearning.mutate(activityId);
    } else if (activityType === "tool") {
      deleteTool.mutate(activityId);
    } else if (activityType === "thought") {
      deleteThought.mutate(activityId);
    }
    setSelectedActivityId(null);
  };

  const handleEditStart = (activity: any) => {
    setEditingId(activity.id);
    setEditType(activity.type);
    setEditTitle(activity.title);
    setEditSentence(activity.sentence);
    setSelectedActivityId(null);
  };

  const handleEditSave = () => {
    console.log('[SkillsSection] handleEditSave called:', { editingId, editType, editTitle, editSentence });
    if (!editingId || !editType) {
      console.error('[SkillsSection] Missing editingId or editType');
      return;
    }
    if (editType === "learning") {
      updateLearning.mutate({ id: editingId, title: editTitle, sentence: editSentence });
    } else if (editType === "tool") {
      updateTool.mutate({ id: editingId, title: editTitle, sentence: editSentence });
    } else if (editType === "thought") {
      updateThought.mutate({ id: editingId, title: editTitle, sentence: editSentence });
    }
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditType(null);
    setEditTitle("");
    setEditSentence("");
  };

  // Handlers for create skill long-press
  const handleCreateSkillPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    createSkillLongPressTimer.current = setTimeout(() => {
      console.log('[SkillsSection] Long press on Skills Progress header - opening create skill dialog');
      setIsCreateSkillDialogOpen(true);
    }, 400);
  };

  const handleCreateSkillPointerUp = () => {
    if (createSkillLongPressTimer.current) {
      clearTimeout(createSkillLongPressTimer.current);
      createSkillLongPressTimer.current = null;
    }
  };

  const handleCreateSkill = async () => {
    if (newSkillName.trim()) {
      try {
        const skillName = newSkillName.trim();
        const areaId = newSkillAreaId || undefined;
        const projectId = newSkillProjectId || undefined;
        const parentId = skillCreationMode === 'subskill' ? parentSkillForSubskill || undefined : undefined;
        
        // Check if skill already exists in the same area/project
        const skillAlreadyExists = globalSkills.some(s => {
          const sameArea = s.areaId === areaId && areaId !== undefined;
          const sameProject = s.projectId === projectId && projectId !== undefined;
          const sameName = s.name === skillName && !s.parentSkillId;
          return sameName && (sameArea || sameProject);
        });
        
        if (skillAlreadyExists) {
          console.log('[SkillsSection] Skill already exists:', { skillName, areaId, projectId });
          alert(`Skill "${skillName}" already exists in this area/quest`);
          return;
        }
        
        console.log('[SkillsSection] Creating new global skill:', skillName, { areaId, projectId, parentId });
        await createGlobalSkill(skillName, areaId, projectId, parentId);
        setNewSkillName("");
        setNewSkillAreaId("");
        setNewSkillProjectId("");
        setParentSkillForSubskill("");
        setSkillCreationMode(null);
        setIsCreateSkillDialogOpen(false);
        await refetchGlobalSkills();
        console.log('[SkillsSection] After refetch, globalSkills count:', globalSkills.length);
      } catch (error) {
        console.error('[SkillsSection] Error creating skill:', error);
      }
    }
  };

  const activityFeed = [
    ...journalLearnings.map((learning) => ({
      id: learning.id,
      type: "learning" as const,
      title: learning.title,
      sentence: learning.sentence,
    })),
    ...journalTools.map((tool) => ({
      id: tool.id,
      type: "tool" as const,
      title: tool.title,
      sentence: tool.sentence,
    })),
    ...journalThoughts.map((thought) => ({
      id: thought.id,
      type: "thought" as const,
      title: thought.title,
      sentence: thought.sentence,
    })),
  ]
    .filter((activity) => {
      // Exclude items with XP in title or sentence
      const titleHasXP = activity.title.toLowerCase().includes("xp");
      const sentenceHasXP = activity.sentence.toLowerCase().includes("xp");
      return !(titleHasXP || sentenceHasXP);
    })
    .sort((a, b) => {
      const dateA = a.id ? new Date(a.id).getTime() : 0;
      const dateB = b.id ? new Date(b.id).getTime() : 0;
      return dateB - dateA;
    });

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1 minimal-scrollbar">
        <div className="space-y-6 pr-3 sm:pr-4">
          {/* Top Section: Skills Progress with Accordions */}
          <div className="bg-zinc-800/30 rounded border border-zinc-700/50 p-4">
            <div 
              className="mb-3 pb-2 border-b border-zinc-700/50 select-none flex items-center justify-between"
              onPointerDown={handleCreateSkillPointerDown}
              onPointerUp={handleCreateSkillPointerUp}
              onPointerCancel={handleCreateSkillPointerUp}
              onPointerLeave={handleCreateSkillPointerUp}
            >
              <div>
                <span className="text-xs text-zinc-500 uppercase tracking-wider">Skills Progress</span>
                <div className="h-px w-8 bg-gradient-to-r from-zinc-600 to-transparent mt-1" />
              </div>
              {(() => {
                const completedCount = globalSkills.filter(s => s.completed).length;
                return (
                  <Button 
                    onClick={() => setLongTermModalOpen(true)}
                    size="sm"
                    variant="outline"
                    className="h-8 gap-2 bg-amber-900/20 border-amber-600/40 hover:bg-amber-800/30 text-amber-400 hover:text-amber-300"
                  >
                    <Star className="h-4 w-4" />
                    <span className="text-xs font-medium">Long-term {completedCount > 0 && `(${completedCount})`}</span>
                  </Button>
                );
              })()}
            </div>
            
            <div className="space-y-4">
              {/* Legacy Skills as Accordions (with associated GlobalSkills underneath) */}
              {Object.keys(legacySkills).length > 0 && (
                <Accordion type="multiple" className="space-y-2">
                  {Object.keys(legacySkills).map((skillName) => {
                    const skill: LegacySkill = legacySkills[skillName] || { name: skillName, currentXp: 0, level: 1, goalXp: 0, completed: false, completedAt: null };
                    const xpProgress = calculateLegacyXpProgress(skill.currentXp, skill.level);
                    const associationNames = getAssociationNames(skillName);
                    const associationName = associationNames.length > 0 ? associationNames[0] : null;
                    const additionalCount = Math.max(0, associationNames.length - 1);
                    const isPressing = pressingSkill === skillName;
                    const linkedGlobalSkills = getGlobalSkillsForLegacySkill(skillName);
                    const incompleteLinkedSkills = linkedGlobalSkills.filter(s => !s.completed);
                    
                    return (
                      <AccordionItem key={skillName} value={skillName} className={cn("rounded-lg", skill.completed ? "border-amber-400 border-2 bg-amber-900/10" : "border-zinc-700/50 bg-zinc-800/20")}>
                        <AccordionTrigger className={cn("px-3 py-2 hover:no-underline rounded-t-lg", skill.completed ? "hover:bg-amber-800/20" : "hover:bg-zinc-700/20")}>
                          <div 
                            className={cn(
                              "flex-1 pr-4",
                              isPressing && "bg-purple-500/20"
                            )}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              handleLegacySkillPointerDown(e, skillName);
                            }}
                            onPointerUp={(e) => handleLegacySkillPointerUp(e)}
                            onPointerCancel={(e) => handleLegacySkillPointerCancel(e)}
                            onPointerLeave={(e) => handleLegacySkillPointerUp(e)}
                            onContextMenu={(e) => e.preventDefault()}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className={cn("text-sm font-medium", skill.completed ? "text-amber-300" : "text-zinc-100")}>
                                {!!skill.completed && <Star className="h-4 w-4 inline mr-1 text-amber-400" />}
                                {skill.name}
                              </span>
                              <span className={cn("text-xs", skill.completed ? "text-amber-400" : "text-zinc-400")}>
                                Lv.<span className="font-bold text-zinc-100">{skill.level}</span>
                                <span className="ml-2">{skill.currentXp}xp</span>
                              </span>
                            </div>
                            {!!skill.completed && skill.completedAt && (
                              <p className="text-xs text-amber-600/80 mb-1">✓ {formatCompletedDate(skill.completedAt)}</p>
                            )}
                            <div className={cn("w-full rounded h-2 overflow-hidden", skill.completed ? "border border-amber-500/50 bg-amber-950/30" : "bg-zinc-700/30 border border-zinc-600/50")}>
                              <div
                                className={cn("h-full transition-all duration-300", skill.completed ? "bg-gradient-to-r from-amber-600 via-amber-500 to-amber-400" : "bg-gradient-to-r from-purple-600 via-purple-500 to-purple-400")}
                                style={{ width: `${xpProgress}%` }}
                              />
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-3 pb-3">
                          {linkedGlobalSkills.length === 0 ? (
                            <p className="text-xs text-zinc-500 py-2">
                              {Array.isArray(legacySkillAssociations[skillName]) && legacySkillAssociations[skillName].length > 0 ? "No subskills yet. Add skills from area subtitle." : "Long press to link or delete."}
                            </p>
                          ) : (
                            <div className="space-y-2 pl-3 border-l-2 border-zinc-700/50">
                              {incompleteLinkedSkills.map((globalSkill: GlobalSkill) => {
                                const subXpProgress = calculateXpProgress(globalSkill.currentXp, globalSkill.level);
                                return (
                                  <div key={globalSkill.id} className={cn("space-y-1 rounded p-2", globalSkill.completed ? "border-l-2 border-amber-400 bg-amber-900/15" : "")}>
                                    <div className="flex items-center justify-between">
                                      <span className={cn("text-sm", globalSkill.completed ? "text-amber-300 font-medium" : "text-zinc-200")}>
                                        {!!globalSkill.completed && <Star className="h-3 w-3 inline mr-1 text-amber-400" />}
                                        {globalSkill.name}
                                      </span>
                                      <span className={cn("text-xs", globalSkill.completed ? "text-amber-400" : "text-zinc-400")}>
                                        Lv.<span className="font-medium">{globalSkill.level}</span>
                                        <span className="ml-1.5">{globalSkill.currentXp}xp</span>
                                      </span>
                                    </div>
                                    {!!globalSkill.completed && globalSkill.completedAt && (
                                      <p className="text-xs text-amber-600/80">✓ {formatCompletedDate(globalSkill.completedAt)}</p>
                                    )}
                                    <div className={cn("w-full rounded h-1.5 overflow-hidden", globalSkill.completed ? "border border-amber-500/30 bg-amber-950/20" : "bg-zinc-700/30 border border-zinc-600/40")}>
                                      <div
                                        className={cn("h-full transition-all duration-300", globalSkill.completed ? "bg-gradient-to-r from-amber-600 via-amber-500 to-amber-400" : "bg-gradient-to-r from-green-600 via-green-500 to-green-400")}
                                        style={{ width: `${subXpProgress}%` }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              )}
              
              {/* New GlobalSkills with Accordions */}
              {globalSkillsLoading ? (
                <div className="text-sm text-zinc-500 py-2">Loading new skills...</div>
              ) : parentSkills.length > 0 ? (
                <Accordion type="multiple" className="space-y-2">
                  {parentSkills.map((skill: GlobalSkill) => {
                    const subSkills = getSubSkillsOf(skill.id).filter(s => !s.completed);
                    const xpProgress = calculateXpProgress(skill.currentXp, skill.level);
                    const isPressing = pressingGlobalSkill === skill.id;
                    
                    return (
                      <AccordionItem key={skill.id} value={skill.id} className={cn("rounded-lg", skill.completed ? "border-amber-400 border-2 bg-amber-900/10" : "border-zinc-700/50 bg-zinc-800/20")}>
                        <AccordionTrigger className={cn("px-3 py-2 hover:no-underline rounded-t-lg", skill.completed ? "hover:bg-amber-800/20" : "hover:bg-zinc-700/20")}>
                          <div 
                            className={cn("flex-1 pr-4", isPressing && "bg-purple-500/20")}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              handleGlobalSkillPointerDown(e, skill.id);
                            }}
                            onPointerUp={(e) => handleGlobalSkillPointerUp(e)}
                            onPointerCancel={(e) => handleGlobalSkillPointerCancel(e)}
                            onPointerLeave={(e) => handleGlobalSkillPointerUp(e)}
                            onContextMenu={(e) => e.preventDefault()}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className={cn("text-sm font-medium", skill.completed ? "text-amber-300" : "text-zinc-100")}>
                                {!!skill.completed && <Star className="h-4 w-4 inline mr-1 text-amber-400" />}
                                {skill.name}
                              </span>
                              <span className={cn("text-xs", skill.completed ? "text-amber-400" : "text-zinc-400")}>
                                Lv.<span className="font-bold">{skill.level}</span>
                                <span className="ml-2">{skill.currentXp}xp</span>
                              </span>
                            </div>
                            {!!skill.completed && skill.completedAt && (
                              <p className="text-xs text-amber-600/80 mb-1">✓ {formatCompletedDate(skill.completedAt)}</p>
                            )}
                            <div className={cn("w-full rounded h-1.5 overflow-hidden", skill.completed ? "border border-amber-500/50 bg-amber-950/30" : "bg-zinc-700/30 border border-zinc-600/40")}>
                              <div
                                className={cn("h-full transition-all duration-300", skill.completed ? "bg-gradient-to-r from-amber-600 via-amber-500 to-amber-400" : "bg-gradient-to-r from-blue-600 via-blue-500 to-blue-400")}
                                style={{ width: `${xpProgress}%` }}
                              />
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-3 pb-3">
                          {subSkills.length === 0 ? (
                            <p className="text-xs text-zinc-500 py-2">No subskills yet</p>
                          ) : (
                            <div className="space-y-2 pl-3 border-l-2 border-zinc-700/50">
                              {subSkills.map((subSkill: GlobalSkill) => {
                                const subXpProgress = calculateXpProgress(subSkill.currentXp, subSkill.level);
                                const isPressingThisSubskill = pressingSubskill === subSkill.id;
                                return (
                                  <div 
                                    key={subSkill.id} 
                                    className={cn("space-y-1 rounded p-2", subSkill.completed ? "border-l-2 border-amber-400 bg-amber-900/15" : "", isPressingThisSubskill && "bg-purple-500/20")}
                                    onPointerDown={(e) => {
                                      e.stopPropagation();
                                      handleSubSkillPointerDown(e, subSkill.id);
                                    }}
                                    onPointerUp={(e) => handleSubSkillPointerUp(e)}
                                    onPointerCancel={(e) => handleSubSkillPointerCancel(e)}
                                    onPointerLeave={(e) => handleSubSkillPointerUp(e)}
                                    onContextMenu={(e) => e.preventDefault()}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className={cn("text-sm", subSkill.completed ? "text-amber-300 font-medium" : "text-zinc-200")}>
                                        {!!subSkill.completed && <Star className="h-3 w-3 inline mr-1 text-amber-400" />}
                                        {subSkill.name}
                                      </span>
                                      <span className={cn("text-xs", subSkill.completed ? "text-amber-400" : "text-zinc-400")}>
                                        Lv.<span className="font-medium">{subSkill.level}</span>
                                        <span className="ml-1.5">{subSkill.currentXp}xp</span>
                                      </span>
                                    </div>
                                    {!!subSkill.completed && subSkill.completedAt && (
                                      <p className="text-xs text-amber-600/80">✓ {formatCompletedDate(subSkill.completedAt)}</p>
                                    )}
                                    <div className={cn("w-full rounded h-1.5 overflow-hidden", subSkill.completed ? "border border-amber-500/30 bg-amber-950/20" : "bg-zinc-700/30 border border-zinc-600/40")}>
                                      <div
                                        className={cn("h-full transition-all duration-300", subSkill.completed ? "bg-gradient-to-r from-amber-600 via-amber-500 to-amber-400" : "bg-gradient-to-r from-green-600 via-green-500 to-green-400")}
                                        style={{ width: `${subXpProgress}%` }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              ) : (
                <p className="text-xs text-zinc-500 py-2">No skills yet. Create skills from area subtitles.</p>
              )}
            </div>
          </div>

          {/* Bottom Section: Activity Feed */}
          <div className="bg-zinc-800/30 rounded border border-zinc-700/50 p-4">
            <div className="mb-3 pb-2 border-b border-zinc-700/50">
              <span className="text-xs text-zinc-500 uppercase tracking-wider">{activityFeed.length} activities</span>
              <div className="h-px w-8 bg-gradient-to-r from-zinc-600 to-transparent mt-1" />
            </div>
            {activityFeed.length === 0 ? (
              <div className="text-sm text-zinc-500 py-4">No activities yet</div>
            ) : (
              <div className="space-y-2">
                {activityFeed.map((activity) => (
                  <div
                    key={activity.id}
                    data-activity-id={activity.id}
                    data-activity-type={activity.type}
                    onTouchStart={(e) => {
                      const id = (e.currentTarget as HTMLElement).dataset.activityId;
                      if (id) handleActivityLongPressStart(e, id);
                    }}
                    onTouchEnd={handleActivityLongPressEnd}
                    onTouchCancel={handleActivityLongPressEnd}
                    onMouseDown={(e) => {
                      const id = (e.currentTarget as HTMLElement).dataset.activityId;
                      if (id) handleActivityLongPressStart(e, id);
                    }}
                    onMouseUp={handleActivityLongPressEnd}
                    onMouseLeave={handleActivityLongPressEnd}
                    className="relative group bg-zinc-700/20 rounded p-3 border border-zinc-700/30 hover:border-zinc-600/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start gap-2">
                      {activity.type === "learning" ? (
                        <Lightbulb className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                      ) : activity.type === "tool" ? (
                        <Wrench className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      ) : (
                        <BookOpen className="h-4 w-4 text-purple-500 mt-0.5 flex-shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-zinc-100 font-medium truncate text-sm">{activity.title}</p>
                        <p className="text-zinc-400 text-xs line-clamp-2">{activity.sentence}</p>
                      </div>
                      {selectedActivityId === activity.id && (
                        <div className="flex gap-1 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 hover:bg-zinc-600/50"
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              handleEditStart(activity);
                            }}
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5 text-blue-500" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 hover:bg-zinc-600/50"
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              handleDelete(activity.id, activity.type); 
                            }}
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <Dialog open={editingId !== null} onOpenChange={(open) => !open && handleEditCancel()}>
        <DialogContent className="bg-zinc-900 border-zinc-700">
          <DialogTitle className="text-zinc-100">
            Edit {editType === "learning" ? "Learning" : editType === "tool" ? "Tool" : "Thought"}
          </DialogTitle>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-title" className="text-zinc-300">Title</Label>
              <Input
                id="edit-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-zinc-100"
                placeholder="Enter title"
              />
            </div>
            <div>
              <Label htmlFor="edit-sentence" className="text-zinc-300">Description</Label>
              <Textarea
                id="edit-sentence"
                value={editSentence}
                onChange={(e) => setEditSentence(e.target.value)}
                className="bg-zinc-800 border-zinc-700 text-zinc-100"
                placeholder="Enter description"
                rows={3}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                onClick={handleEditCancel}
                className="text-zinc-300 hover:bg-zinc-800"
              >
                Cancel
              </Button>
              <Button
                onClick={handleEditSave}
                disabled={updateLearning.isPending || updateTool.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {updateLearning.isPending || updateTool.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Legacy Skill Area/Quest Association Dialog */}
      <Dialog open={legacySkillDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setLegacySkillDialogOpen(false);
          setSelectedLegacySkill(null);
          setSelectedSourceType(null);
          setSelectedAreaIds([]);
          setSelectedProjectIds([]);
          setIsEditingGlobalSkill(false);
        }
      }}>
        <DialogContent className="bg-zinc-900 border-zinc-700 max-w-sm">
          <DialogTitle className="text-zinc-100 flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-purple-400" />
            {isEditingGlobalSkill ? "Change" : "Link"} "{selectedLegacySkill}" to Areas/Quests
          </DialogTitle>
          <div className="space-y-4 mt-2">
            {/* Type Selection */}
            <div className="space-y-2">
              <div className="text-xs text-zinc-400 mb-2">
                {isEditingGlobalSkill 
                  ? "✓ Select the new area or quest for this skill" 
                  : "✓ Select one or more areas and/or quests"}
              </div>
              <div className="text-xs text-zinc-400 mb-1">Select Areas</div>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {areas.length === 0 ? (
                  <p className="text-sm text-zinc-500 py-2">No areas available</p>
                ) : (
                  areas.map((area: Area) => (
                    <label key={area.id} className="flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedAreaIds.includes(area.id)}
                        onChange={e => {
                          if (isEditingGlobalSkill) {
                            // For global skills, single selection
                            setSelectedAreaIds(e.target.checked ? [area.id] : []);
                            setSelectedProjectIds([]);
                          } else {
                            // For legacy skills, multiple selection
                            setSelectedAreaIds(ids =>
                              e.target.checked ? [...ids, area.id] : ids.filter(id => id !== area.id)
                            );
                          }
                        }}
                        className="accent-purple-500"
                      />
                      <span className="mr-2">{area.icon}</span>
                      {area.name}
                    </label>
                  ))
                )}
              </div>
              <div className="text-xs text-zinc-400 mt-3 mb-1">Select Quests</div>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {allProjects.length === 0 ? (
                  <p className="text-sm text-zinc-500 py-2">No quests available</p>
                ) : (
                  allProjects.map(project => (
                    <label key={project.id} className="flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedProjectIds.includes(project.id)}
                        onChange={e => {
                          if (isEditingGlobalSkill) {
                            // For global skills, single selection
                            setSelectedProjectIds(e.target.checked ? [project.id] : []);
                            setSelectedAreaIds([]);
                          } else {
                            // For legacy skills, multiple selection
                            setSelectedProjectIds(ids =>
                              e.target.checked ? [...ids, project.id] : ids.filter(id => id !== project.id)
                            );
                          }
                        }}
                        className="accent-blue-500"
                      />
                      <span className="mr-2">{project.icon}</span>
                      {project.name}
                    </label>
                  ))
                )}
              </div>
            </div>

            {/* Area/Project List */}
            {/* Both area and quest checkboxes are always shown above */}

            {/* Actions */}
            <div className="flex gap-2 justify-between pt-2">
              {!isEditingGlobalSkill && legacySkillAssociations[selectedLegacySkill || ""] && legacySkillAssociations[selectedLegacySkill || ""].length > 0 && (
                <Button
                  variant="ghost"
                  onClick={handleRemoveAssociation}
                  className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                >
                  Remove All Links
                </Button>
              )}
              <div className="flex gap-2 ml-auto">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setLegacySkillDialogOpen(false);
                    setIsEditingGlobalSkill(false);
                  }}
                  className="text-zinc-300 hover:bg-zinc-800"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (isEditingGlobalSkill) {
                      handleSaveGlobalSkillArea();
                    } else {
                      handleSaveAssociation();
                    }
                  }}
                  disabled={selectedAreaIds.length === 0 && selectedProjectIds.length === 0}
                  className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create New Global Skill Dialog */}
      <Dialog open={isCreateSkillDialogOpen} onOpenChange={(open) => {
        if (open) {
          // Refetch skills when opening the dialog to ensure we have the latest data
          refetchGlobalSkills();
        } else {
          setNewSkillName("");
          setNewSkillAreaId("");
          setNewSkillProjectId("");
          setParentSkillForSubskill("");
          setSkillCreationMode(null);
        }
        setIsCreateSkillDialogOpen(open);
      }}>
        <DialogContent className="sm:max-w-md bg-zinc-900 border border-zinc-700">
          <VisuallyHidden>
            <DialogTitle>
              {skillCreationMode === null
                ? "Create New Skill"
                : skillCreationMode === 'subskill'
                ? "Create New Subskill"
                : "Create New Skill"}
            </DialogTitle>
          </VisuallyHidden>
          {skillCreationMode === null ? (
            <>
              <div className="space-y-4">
                <div className="border-b border-zinc-700/50 pb-2">
                  <h3 className="font-medium text-zinc-100">Create New Skill</h3>
                  <div className="h-px w-8 bg-gradient-to-r from-zinc-500 to-transparent mt-1" />
                </div>
                <p className="text-sm text-zinc-300">What do you want to create?</p>
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={() => setSkillCreationMode('subskill')}
                    className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-zinc-100"
                  >
                    Create SUBSKILL
                  </Button>
                  <Button
                    onClick={() => setSkillCreationMode('skill')}
                    className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-zinc-100"
                  >
                    Create SKILL
                  </Button>
                </div>
              </div>
            </>
          ) : skillCreationMode === 'subskill' ? (
            <>
              <div className="space-y-4">
                <div className="border-b border-zinc-700/50 pb-2">
                  <h3 className="font-medium text-zinc-100">Create New Subskill</h3>
                  <div className="h-px w-8 bg-gradient-to-r from-zinc-500 to-transparent mt-1" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="parent-skill" className="text-sm text-zinc-300">Link to Skill</label>
                  <select
                    id="parent-skill"
                    value={parentSkillForSubskill}
                    onChange={(e) => setParentSkillForSubskill(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded px-3 py-2 text-sm focus:outline-none focus:border-zinc-600"
                  >
                    <option value="">Select a skill...</option>
                    {globalSkills
                      .filter(s => !s.parentSkillId)
                      .map(skill => (
                        <option key={skill.id} value={skill.id}>
                          {skill.name}
                        </option>
                      ))}
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="subskill-name" className="text-sm text-zinc-300">Subskill Name</label>
                  <Input
                    id="subskill-name"
                    value={newSkillName}
                    onChange={(e) => setNewSkillName(e.target.value)}
                    placeholder="Limpiar la cocina"
                    className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && parentSkillForSubskill && newSkillName.trim()) {
                        handleCreateSkill();
                      }
                    }}
                    autoFocus
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSkillCreationMode(null);
                      setNewSkillName("");
                      setParentSkillForSubskill("");
                    }}
                    className="text-zinc-400 hover:text-zinc-300"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleCreateSkill}
                    disabled={!newSkillName.trim() || !parentSkillForSubskill}
                    className="bg-zinc-700 hover:bg-zinc-600 text-zinc-200"
                  >
                    Create
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-4">
                <div className="border-b border-zinc-700/50 pb-2">
                  <h3 className="font-medium text-zinc-100">Create New Skill</h3>
                  <div className="h-px w-8 bg-gradient-to-r from-zinc-500 to-transparent mt-1" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="new-skill-name" className="text-sm text-zinc-300">Skill Name</label>
                  <Input
                    id="new-skill-name"
                    value={newSkillName}
                    onChange={(e) => setNewSkillName(e.target.value)}
                    placeholder="e.g. Mathematics"
                    className="bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleCreateSkill();
                      }
                    }}
                    autoFocus
                  />
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="new-skill-area" className="text-sm text-zinc-300">Link to Area (optional)</label>
                  <select
                    id="new-skill-area"
                    value={newSkillAreaId}
                    onChange={(e) => {
                      setNewSkillAreaId(e.target.value);
                      setNewSkillProjectId("");
                    }}
                    className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded px-3 py-2 text-sm focus:outline-none focus:border-zinc-600"
                  >
                    <option value="">None</option>
                    {getAllAvailableAreas().map(area => (
                      <option key={area.id} value={area.id}>
                        {area.icon} {area.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="new-skill-project" className="text-sm text-zinc-300">Link to Quest (optional)</label>
                  <select
                    id="new-skill-project"
                    value={newSkillProjectId}
                    onChange={(e) => {
                      setNewSkillProjectId(e.target.value);
                      setNewSkillAreaId("");
                    }}
                    className="w-full bg-zinc-800 border border-zinc-700 text-zinc-100 rounded px-3 py-2 text-sm focus:outline-none focus:border-zinc-600"
                  >
                    <option value="">None</option>
                    {getAllAvailableProjects().map(project => (
                      <option key={project.id} value={project.id}>
                        {project.icon} {project.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSkillCreationMode(null);
                      setNewSkillName("");
                    }}
                    className="text-zinc-400 hover:text-zinc-300"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleCreateSkill}
                    disabled={!newSkillName.trim()}
                    className="bg-zinc-700 hover:bg-zinc-600 text-zinc-200"
                  >
                    Create
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Unified Skill Context Menu - for both legacy and global skills */}
      {(legacySkillMenuOpen || globalSkillMenuOpen || subskillMenuOpen) && (
        <>
          {/* Modal overlay */}
          <div
            className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center"
            onClick={() => {
              setLegacySkillMenuOpen(null);
              setGlobalSkillMenuOpen(null);
              setSubskillMenuOpen(null);
            }}
            onContextMenu={(e) => e.preventDefault()}
          />
          
          {/* Centered modal menu */}
          <div
            className="fixed z-50 inset-0 flex items-center justify-center pointer-events-none"
          >
            <div className="pointer-events-auto bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl overflow-hidden">
              {legacySkillMenuOpen && (
                <>
                  <button
                    onClick={() => {
                      const existing = legacySkillAssociations[legacySkillMenuOpen] || [];
                      setSelectedLegacySkill(legacySkillMenuOpen);
                      setSelectedSourceType(null);
                      setSelectedAreaIds(existing.filter(a => a.type === "area").map(a => a.id));
                      setSelectedProjectIds(existing.filter(a => a.type === "project").map(a => a.id));
                      setLegacySkillMenuOpen(null);
                      setLegacySkillDialogOpen(true);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors flex items-center gap-2 whitespace-nowrap"
                  >
                    <FolderOpen className="h-4 w-4" />
                    Link to Area/Quest
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      const skillName = legacySkillMenuOpen;
                      console.log('[MetaButton] Opening meta for legacy skill:', skillName);
                      setSelectedSkillForMeta({ id: skillName, name: skillName });
                      setGoalXpValue(legacySkills[skillName]?.goalXp ? String(legacySkills[skillName].goalXp) : "");
                      setMetaModalOpen(true);
                      setLegacySkillMenuOpen(null);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-blue-400 hover:bg-blue-900/20 hover:text-blue-300 transition-colors flex items-center gap-2 whitespace-nowrap border-t border-zinc-700"
                  >
                    <Target className="h-4 w-4" />
                    Meta
                  </button>
                  <button
                    onClick={() => {
                      // Delete the legacy skill completely
                      const skillToDelete = legacySkillMenuOpen;
                      console.log('[DeleteSkill] Deleting skill:', skillToDelete);
                      console.log('[DeleteSkill] Current legacySkills:', legacySkills);
                      console.log('[DeleteSkill] Is skill in legacySkills?', skillToDelete in legacySkills);
                      
                      if (!skillToDelete) {
                        console.error('[DeleteSkill] No skill selected to delete');
                        return;
                      }
                      
                      // Remove associations first
                      setLegacySkillAssociations(prev => {
                        const updated = { ...prev };
                        if (skillToDelete in updated) {
                          delete updated[skillToDelete];
                          console.log('[DeleteSkill] Removed associations for:', skillToDelete);
                        }
                        localStorage.setItem("legacySkillAssociations", JSON.stringify(updated));
                        return updated;
                      });
                      
                      // Then remove the skill itself from legacySkills
                      // Even if it's not explicitly in legacySkills, we need to record its deletion
                      setLegacySkills(prev => {
                        const updated = { ...prev };
                        // Always remove it, even if it wasn't explicitly stored
                        delete updated[skillToDelete];
                        console.log('[DeleteSkill] After delete from legacySkills:', updated);
                        localStorage.setItem("skillsProgress", JSON.stringify(updated));
                        return updated;
                      });
                      
                      // Also update SKILLS_LIST if this is a legacy skill we want to hide
                      console.log('[DeleteSkill] Skill deleted successfully');
                      setLegacySkillMenuOpen(null);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-900/20 hover:text-red-300 transition-colors flex items-center gap-2 whitespace-nowrap border-t border-zinc-700"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Skill
                  </button>
                </>
              )}
              {globalSkillMenuOpen && (
                <>
                  <button
                    onClick={() => {
                      const skill = globalSkills.find(s => s.id === globalSkillMenuOpen);
                      if (skill) {
                        console.log('[SkillsSection] Opening change area dialog for global skill:', skill.name);
                        setSelectedLegacySkill(skill.name);
                        setSelectedAreaIds(skill.areaId ? [skill.areaId] : []);
                        setSelectedProjectIds(skill.projectId ? [skill.projectId] : []);
                        setIsEditingGlobalSkill(true);
                        setGlobalSkillMenuOpen(null);
                        setLegacySkillDialogOpen(true);
                      }
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors flex items-center gap-2 whitespace-nowrap"
                  >
                    <FolderOpen className="h-4 w-4" />
                    Change Area/Quest
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      const skill = globalSkills.find(s => s.id === globalSkillMenuOpen);
                      if (skill) {
                        console.log('[MetaButton] Opening meta for global skill:', skill.name);
                        setSelectedSkillForMeta({ id: skill.id, name: skill.name });
                        setGoalXpValue(String(skill.goalXp || ""));
                        setMetaModalOpen(true);
                      }
                      setGlobalSkillMenuOpen(null);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-blue-400 hover:bg-blue-900/20 hover:text-blue-300 transition-colors flex items-center gap-2 whitespace-nowrap border-t border-zinc-700"
                  >
                    <Target className="h-4 w-4" />
                    Meta
                  </button>
                  <button
                    onClick={async () => {
                      // Find the skill in globalSkills and delete it
                      const skill = globalSkills.find(s => s.id === globalSkillMenuOpen);
                      if (skill) {
                        console.log('[SkillsSection] Deleting global skill:', skill.name, skill.id);
                        await deleteGlobalSkill(skill.id);
                        await refetchGlobalSkills();
                      }
                      setGlobalSkillMenuOpen(null);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-900/20 hover:text-red-300 transition-colors flex items-center gap-2 whitespace-nowrap border-t border-zinc-700"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Skill
                  </button>
                </>
              )}
              {subskillMenuOpen && (
                <>
                  <button
                    onClick={() => {
                      const skill = globalSkills.find(s => s.id === subskillMenuOpen);
                      if (skill) {
                        console.log('[SkillsSection] Opening change area dialog for subskill:', skill.name);
                        setSelectedLegacySkill(skill.name);
                        setSelectedAreaIds(skill.areaId ? [skill.areaId] : []);
                        setSelectedProjectIds(skill.projectId ? [skill.projectId] : []);
                        setIsEditingGlobalSkill(true);
                        setSubskillMenuOpen(null);
                        setLegacySkillDialogOpen(true);
                      }
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 transition-colors flex items-center gap-2 whitespace-nowrap"
                  >
                    <FolderOpen className="h-4 w-4" />
                    Change Area/Quest
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      const skill = globalSkills.find(s => s.id === subskillMenuOpen);
                      if (skill) {
                        console.log('[MetaButton] Opening meta for subskill:', skill.name);
                        setSelectedSkillForMeta({ id: skill.id, name: skill.name });
                        setGoalXpValue(String(skill.goalXp || ""));
                        setMetaModalOpen(true);
                      }
                      setSubskillMenuOpen(null);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-blue-400 hover:bg-blue-900/20 hover:text-blue-300 transition-colors flex items-center gap-2 whitespace-nowrap border-t border-zinc-700"
                  >
                    <Target className="h-4 w-4" />
                    Meta
                  </button>
                  <button
                    onClick={async () => {
                      // Find the skill in globalSkills and delete it
                      const skill = globalSkills.find(s => s.id === subskillMenuOpen);
                      if (skill) {
                        console.log('[SkillsSection] Deleting subskill:', skill.name, skill.id);
                        await deleteGlobalSkill(skill.id);
                        await refetchGlobalSkills();
                      }
                      setSubskillMenuOpen(null);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-900/20 hover:text-red-300 transition-colors flex items-center gap-2 whitespace-nowrap border-t border-zinc-700"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Skill
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Long-term Completed Skills Modal */}
      <Dialog open={longTermModalOpen} onOpenChange={setLongTermModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-700 max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogTitle className="text-zinc-100 flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-400" />
            Completed Skills - Long-term Goals
          </DialogTitle>
          <div className="space-y-4 mt-4">
            {(() => {
              // Global skills
              const completed = globalSkills.filter(s => s.completed);
              const groupedByParent = completed.reduce((acc, skill) => {
                if (skill.parentSkillId) {
                  const parentId = skill.parentSkillId;
                  if (!acc[parentId]) acc[parentId] = [];
                  acc[parentId].push(skill);
                } else {
                  if (!acc['_parent']) acc['_parent'] = [];
                  acc['_parent'].push(skill);
                }
                return acc;
              }, {} as Record<string, GlobalSkill[]>);

              // Legacy skills
              const completedLegacySkills = Object.entries(legacySkills)
                .filter(([name, skill]) => skill.completed)
                .map(([name, skill]) => ({
                  isLegacy: true,
                  ...skill
                }));

              return (
                <>
                  {/* Global Skills Section */}
                  {Object.entries(groupedByParent).length > 0 && (
                    <div>
                      <p className="text-xs text-zinc-400 font-semibold mb-3 uppercase tracking-wide">Global Skills</p>
                      {Object.entries(groupedByParent).map(([parentId, skills]) => (
                        <div key={parentId} className="border-l-2 border-amber-500/50 pl-3 mb-3">
                          {parentId !== '_parent' && (
                            <p className="text-xs text-amber-500 font-semibold mb-2">
                              Parent: {globalSkills.find(s => s.id === parentId)?.name || parentId}
                            </p>
                          )}
                          <div className="space-y-2">
                            {skills.map(skill => (
                              <div key={skill.id} className="bg-zinc-800/50 rounded p-3">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-zinc-100 font-medium">{skill.name}</span>
                                  <span className="text-xs text-amber-400">
                                    Lv.{skill.level} • {skill.currentXp} XP
                                    {skill.goalXp > 0 && <span> / {skill.goalXp} goal</span>}
                                  </span>
                                </div>
                                <p className="text-xs text-zinc-400 mt-1">
                                  Completed: {skill.completedAt ? formatCompletedDate(skill.completedAt) : 'Unknown date'}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Legacy Skills Section */}
                  {completedLegacySkills.length > 0 && (
                    <div className="pt-3 border-t border-zinc-700/50">
                      <p className="text-xs text-zinc-400 font-semibold mb-3 uppercase tracking-wide">Legacy Skills</p>
                      <div className="space-y-2">
                        {completedLegacySkills.map((skill: any) => (
                          <div key={skill.name} className="bg-zinc-800/50 rounded p-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-zinc-100 font-medium">{skill.name}</span>
                              <span className="text-xs text-amber-400">
                                Lv.{skill.level} • {skill.currentXp} XP
                                {skill.goalXp > 0 && <span> / {skill.goalXp} goal</span>}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-400 mt-1">
                              Completed: {skill.completedAt ? formatCompletedDate(skill.completedAt) : 'Unknown date'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {Object.entries(groupedByParent).length === 0 && completedLegacySkills.length === 0 && (
                    <p className="text-sm text-zinc-500 py-4">No completed skills yet</p>
                  )}
                </>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Meta Modal - Set Goal XP */}
      <Dialog open={metaModalOpen} onOpenChange={setMetaModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-700">
          <DialogTitle className="text-zinc-100 flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-400" />
            Set Goal XP
          </DialogTitle>
          {selectedSkillForMeta && (
            <div className="space-y-4 mt-4">
              <div>
                <p className="text-sm text-zinc-300 mb-2">Skill: <strong>{selectedSkillForMeta.name}</strong></p>
              </div>
              <div>
                <label className="text-sm text-zinc-300 mb-2 block">Goal XP</label>
                <input
                  type="number"
                  value={goalXpValue}
                  onChange={(e) => setGoalXpValue(e.target.value)}
                  placeholder="Enter goal XP"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={async () => {
                    if (!selectedSkillForMeta) return;
                    try {
                      const response = await fetch(`/api/global-skills/${selectedSkillForMeta.id}/goal-xp`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ goalXp: parseInt(goalXpValue) || 0 })
                      });
                      if (response.ok) {
                        console.log('[MetaModal] Goal XP saved successfully');
                        setMetaModalOpen(false);
                        setSelectedSkillForMeta(null);
                        setGoalXpValue("");
                        await refetchGlobalSkills();
                      } else {
                        console.error('[MetaModal] Failed to save goal XP:', response.statusText);
                      }
                    } catch (error) {
                      console.error('[MetaModal] Error saving goal XP:', error);
                    }
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded transition-colors"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setMetaModalOpen(false);
                    setSelectedSkillForMeta(null);
                    setGoalXpValue("");
                  }}
                  className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 font-medium py-2 rounded transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QuestDiary() {
  const { isDiaryOpen, closeDiary } = useDiary();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  // Listen for XP updates and refresh skills section via localStorage event
  useEffect(() => {
    const handleSkillXpAdded = () => {
      console.log('[QuestDiary] === skillXpAdded event RECEIVED - refreshing skills ===');
      
      // Read updated skills from localStorage
      const stored = localStorage.getItem("skillsProgress");
      if (stored) {
        try {
          console.log('[QuestDiary] Updated skills from localStorage:', stored);
        } catch (error) {
          console.error('[QuestDiary] Error reading updated skills:', error);
        }
      }
    };

    console.log('[QuestDiary] === useEffect: Attaching global skillXpAdded listener ===');
    window.addEventListener('skillXpAdded', handleSkillXpAdded);
    
    return () => {
      console.log('[QuestDiary] === QuestDiary cleanup: Detaching global listener ===');
      window.removeEventListener('skillXpAdded', handleSkillXpAdded);
    };
  }, []);

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

  const { data: learnings = [], isLoading: loadingLearnings } = useQuery<JournalLearning[]>({
    queryKey: ["/api/journal/learnings"],
    enabled: isDiaryOpen,
  });

  const { data: tools = [], isLoading: loadingTools } = useQuery<JournalTool[]>({
    queryKey: ["/api/journal/tools"],
    enabled: isDiaryOpen,
  });

  const { data: thoughts = [], isLoading: loadingThoughts } = useQuery<JournalThought[]>({
    queryKey: ["/api/journal/thoughts"],
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
    mutationFn: async (data: { name: string; action: string; description: string; imageUrl?: string }) => {
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
    mutationFn: async ({ id, data }: { id: string; data: { name: string; action: string; description: string; imageUrl?: string } }) => {
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

  const createLearning = useMutation({
    mutationFn: async (data: { title: string; sentence: string }) => {
      const res = await fetch("/api/journal/learnings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/journal/learnings"] }),
  });

  const deleteLearning = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/journal/learnings/${id}`, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/journal/learnings"] }),
  });

  const createTool = useMutation({
    mutationFn: async (data: { title: string; sentence: string }) => {
      const res = await fetch("/api/journal/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/journal/tools"] }),
  });
  
  return (
    <Dialog open={isDiaryOpen} onOpenChange={(open) => !open && closeDiary()}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] sm:max-w-4xl h-[92dvh] sm:h-[75vh] p-0 overflow-hidden bg-background border-2 border-border shadow-2xl">
        <VisuallyHidden>
          <DialogTitle>Journal</DialogTitle>
        </VisuallyHidden>
        <div className="flex h-full min-h-0 min-w-0 flex-col sm:flex-row">
          <Tabs defaultValue="achievements" className="flex-1 flex min-h-0 min-w-0 flex-col sm:flex-row" orientation={isMobile ? "horizontal" : "vertical"}>
            <TabsList className="flex w-full sm:w-auto flex-row sm:flex-col h-auto sm:h-full justify-start gap-0.5 p-1.5 rounded-none border-b-2 sm:border-b-0 sm:border-r-2 border-border bg-secondary/50 shadow-[inset_0_-4px_8px_rgba(0,0,0,0.3)] sm:shadow-[inset_-4px_0_8px_rgba(0,0,0,0.3)] dark:shadow-[inset_0_-4px_8px_rgba(0,0,0,0.3)] sm:dark:shadow-[inset_-4px_0_8px_rgba(0,0,0,0.3)] overflow-x-auto">
              <TabsTrigger value="achievements" className="shrink-0 p-2.5 rounded data-[state=active]:bg-secondary data-[state=active]:shadow-inner text-muted-foreground data-[state=active]:text-foreground transition-all" data-testid="tab-achievements" title="Achievements">
                <Scroll className="h-5 w-5" />
              </TabsTrigger>
              <div className="h-px bg-border/50 my-1 mx-1" />
              <TabsTrigger value="skills" className="shrink-0 p-2.5 rounded data-[state=active]:bg-secondary data-[state=active]:shadow-inner text-muted-foreground data-[state=active]:text-foreground transition-all" data-testid="tab-skills" title="Skills">
                <BookOpen className="h-5 w-5" />
              </TabsTrigger>
              <TabsTrigger value="profile" className="shrink-0 p-2.5 rounded data-[state=active]:bg-secondary data-[state=active]:shadow-inner text-muted-foreground data-[state=active]:text-foreground transition-all" data-testid="tab-profile" title="Mi Perfil">
                <User className="h-5 w-5" />
              </TabsTrigger>
              <TabsTrigger value="learnings" className="shrink-0 p-2.5 rounded data-[state=active]:bg-secondary data-[state=active]:shadow-inner text-muted-foreground data-[state=active]:text-foreground transition-all" data-testid="tab-learnings" title="Learnings">
                <Lightbulb className="h-5 w-5" />
              </TabsTrigger>
              <TabsTrigger value="tools" className="shrink-0 p-2.5 rounded data-[state=active]:bg-secondary data-[state=active]:shadow-inner text-muted-foreground data-[state=active]:text-foreground transition-all" data-testid="tab-tools" title="Tools">
                <Wrench className="h-5 w-5" />
              </TabsTrigger>
              <TabsTrigger value="bestiary" className="shrink-0 p-2.5 rounded data-[state=active]:bg-secondary data-[state=active]:shadow-inner text-muted-foreground data-[state=active]:text-foreground transition-all" data-testid="tab-bestiary" title="Bestiary">
                <BookOpen className="h-5 w-5" />
              </TabsTrigger>
            </TabsList>
            
            <div className="flex-1 p-3 sm:p-6 bg-background flex flex-col min-h-0 min-w-0">
              <div className="mb-4 pb-3 border-b border-border">
                <h2 className="text-xl font-bold tracking-tight text-foreground">Journal</h2>
                <div className="h-0.5 w-16 bg-gradient-to-r from-muted-foreground to-transparent mt-2" />
              </div>
              
              <TabsContent value="achievements" className="flex-1 min-h-0 min-w-0 mt-0">
                <AchievementsSection learnings={learnings} tools={tools} thoughts={thoughts} />
              </TabsContent>

              <TabsContent value="skills" className="flex-1 min-h-0 min-w-0 mt-0">
                <SkillsSection journalLearnings={learnings} journalTools={tools} journalThoughts={thoughts} />
              </TabsContent>
              
              <TabsContent value="bestiary" className="flex-1 min-h-0 min-w-0 mt-0">
                <BestiarySection
                  entries={shadows}
                  isLoading={loadingShadows}
                  onAdd={(data) => createShadow.mutate(data)}
                  onEdit={(id, data) => updateShadow.mutate({ id, data })}
                  onDelete={(id) => deleteShadow.mutate(id)}
                  onMarkDefeated={(id, defeated) => markShadowDefeated.mutate({ id, defeated })}
                />
              </TabsContent>
              
              <TabsContent value="learnings" className="flex-1 min-h-0 min-w-0 mt-0">
                <LearningsSection
                  entries={learnings}
                  isLoading={loadingLearnings}
                  onDelete={(id) => deleteLearning.mutate(id)}
                />
              </TabsContent>
              
              <TabsContent value="tools" className="flex-1 min-h-0 min-w-0 mt-0">
                <ToolsSection
                  entries={tools}
                  isLoading={loadingTools}
                  onDelete={(id) => {
                    fetch(`/api/journal/tools/${id}`, { method: "DELETE" });
                    queryClient.invalidateQueries({ queryKey: ["/api/journal/tools"] });
                  }}
                />
              </TabsContent>
              
              <TabsContent value="profile" className="flex-1 min-h-0 min-w-0 mt-0">
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
    levelUpNumber,
    showCompleted,
    showQuestUpdated,
    addSkill,
    updateSkill,
    updateProjectSkill
  } = useSkillTree();
  const { isMenuOpen } = useMenu();
  
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
    
    // Find the first "objective quest" node in the visible levels
    let targetSkill = sortedSkills.find(s => 
      s.title.toLowerCase() === "objective quest" || 
      s.title.toLowerCase() === "next challenge" || 
      s.title.toLowerCase() === "next challange"
    );
    
    // If no "objective quest" found, find the first node of the next level after current visible
    if (!targetSkill) {
      // Get visible levels, filtering out staged levels if end-of-area is active
      const visibleLevels = calculateVisibleLevels(skills, (activeItem as any)?.endOfAreaLevel);
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
    const targetY = targetSkill ? targetSkill.y : (skills.length > 0 ? Math.max(...skills.map((s: Skill) => s.y)) + 80 : 100);
    const targetLevel = targetSkill ? targetSkill.level : (skills.length > 0 ? Math.max(...skills.map((s: Skill) => s.level)) : 1);
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
    
    // Always update the target skill (whether it's "objective quest" or first node of next level)
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
    const visibleSkills = subSkills.filter((s: Skill) => subSkillVisibleLevels.has(s.level));

    // DEBUG: Log subskill visible skills with coordinate details
    console.log("[SkillCanvas SubSkills] visibleSkills:", visibleSkills.map(s => `level:${s.level} pos:${s.levelPosition} x:${s.x} y:${s.y} title:${s.title}`));

    const firstSkillOfLevel = new Set<string>();
    const levelGroups = new Map<number, typeof visibleSkills>();
    
    visibleSkills.forEach((skill: Skill) => {
      if (!levelGroups.has(skill.level)) {
        levelGroups.set(skill.level, []);
      }
      levelGroups.get(skill.level)!.push(skill);
    });
    
    levelGroups.forEach((skills) => {
      const firstSkill = skills.reduce((min: Skill, s: Skill) => s.y < min.y ? s : min, skills[0]);
      if (firstSkill) {
        firstSkillOfLevel.add(firstSkill.id);
      }
    });

    const maxY = visibleSkills.length > 0 ? Math.max(...visibleSkills.map((s: Skill) => s.y), 400) : 400;
    const containerHeight = maxY + 200;
    const maxX = visibleSkills.length > 0 ? Math.max(...visibleSkills.map((s: Skill) => s.x), 50) : 50;
    const containerMinWidth = `calc(${maxX}% + 100px)`;

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
                className="text-4xl font-bold tracking-widest uppercase text-foreground shadow-lg"
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -100, opacity: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              >
                Level {levelUpNumber}
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
        <AnimatePresence>
          {showQuestUpdated && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.span
                className="text-4xl font-bold tracking-widest uppercase text-amber-500 shadow-lg"
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -100, opacity: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              >
                Quest updated!
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex-1 overflow-y-auto p-8 scroll-smooth scrollbar-thin-on-scroll">
          <div className="w-full relative max-w-4xl mx-auto mt-2 min-h-full">
            
            <div className="absolute top-0 left-0 z-10">
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
              className="relative mt-20 transition-all duration-500 ease-in-out overflow-x-auto sm:overflow-x-hidden scrollbar-hide"
              style={{ height: `${containerHeight}px`, minHeight: "600px", width: "100%", minWidth: containerMinWidth }}
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
                  {Array.from(levelGroups.entries()).sort((a, b) => a[0] - b[0]).flatMap(([level, skills]) => {
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

                  {visibleSkills.map((skill: Skill, index: number) => {
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

  const visibleLevels = calculateVisibleLevels(activeItem.skills, (activeItem as any)?.endOfAreaLevel);
  // Always show +3 levels ahead: nextLevelToAssign + 2 (current level + 3)
  // If nextLevelToAssign = 2, show levels up to 4 (but we want 1,2,3,4,5, so it's +3 from 2)
  // So max level = nextLevelToAssign + 2
  const maxAllowedLevel = activeItem.nextLevelToAssign + 2;
  const validVisibleLevels = new Set(Array.from(visibleLevels).filter(level => level <= maxAllowedLevel));
  const visibleSkills = activeItem.skills
    .filter((s: Skill) => validVisibleLevels.has(s.level))
    .sort((a: Skill, b: Skill) => {
      if (a.level !== b.level) return a.level - b.level;
      return a.y - b.y;
    });

  // DEBUG: Log visible skills order after sorting with full coordinate details
  console.log("[SkillCanvas] visibleSkills after sorting:", visibleSkills.map(s => `level:${s.level} pos:${s.levelPosition} x:${s.x} y:${s.y} title:${s.title}`));
  
  // Also log as structured objects for easier inspection
  console.log("[SkillCanvas] visibleSkills details:", visibleSkills.map(s => ({
    title: s.title,
    level: s.level,
    levelPosition: s.levelPosition,
    x: s.x,
    y: s.y,
    status: s.status
  })));

  // Find the first skill of each level (lowest Y position per level)
  const firstSkillOfLevel = new Set<string>();
  const levelGroups = new Map<number, typeof visibleSkills>();
  
  visibleSkills.forEach(skill => {
    if (!levelGroups.has(skill.level)) {
      levelGroups.set(skill.level, []);
    }
    levelGroups.get(skill.level)!.push(skill);
  });
  
  console.log("[SkillCanvas] levelGroups keys (in order):", Array.from(levelGroups.keys()).sort((a, b) => a - b));
  
  levelGroups.forEach((skills) => {
    const firstSkill = skills.reduce((min, s) => s.y < min.y ? s : min, skills[0]);
    if (firstSkill) {
      firstSkillOfLevel.add(firstSkill.id);
    }
  });

  const maxY = Math.max(...visibleSkills.map((s: Skill) => s.y), 400);
  const containerHeight = maxY + 200;
  const maxX = visibleSkills.length > 0 ? Math.max(...visibleSkills.map((s: Skill) => s.x), 50) : 50;
  const containerMinWidth = `calc(${maxX}% + 100px)`;

  return (
    <div className="flex-1 relative bg-background flex flex-col overflow-auto">
      <AnimatePresence>
        {showLevelUp && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.span
              className="text-4xl font-bold tracking-widest uppercase text-foreground shadow-lg"
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -100, opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              Level {levelUpNumber}
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
      <AnimatePresence>
        {showQuestUpdated && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.span
              className="text-4xl font-bold tracking-widest uppercase text-amber-500 shadow-lg"
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -100, opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              Quest updated!
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex-1 overflow-y-auto p-8 scroll-smooth scrollbar-thin-on-scroll">
        <div className="w-full relative max-w-4xl mx-auto min-h-full">
          
          {/* Sticky Progress Bar */}
          <div className="sticky top-0 z-20 py-3 mb-6 -mx-8 px-8">
            <div className="flex justify-end">
              <div className="w-28 flex-shrink-0">
                <ProgressBar skills={activeItem.skills} size="sm" areaOrProjectId={activeItem.id} />
              </div>
            </div>
          </div>

          {/* Header Section */}
          <div className="mb-8 pb-6 border-b border-border/50">
            {/* Title */}
            <div className="mb-4">
              <h2 className="text-2xl font-bold tracking-tight">
                {activeItem.name}
              </h2>
            </div>

            {/* Completed Badge */}
            {(isProject ? activeProject?.skills : activeArea?.skills)?.some(
              s => s.isFinalNode === 1 && s.status === "mastered"
            ) && (
              <div className="mb-3">
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  Completed
                </span>
              </div>
            )}

            {/* Description */}
            <p className="text-muted-foreground max-w-md text-sm leading-relaxed mb-3">
              {activeItem.description}
            </p>

            {/* Stuck Button */}
            <button
              onClick={() => setIsStuckDialogOpen(true)}
              className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
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
            className="relative transition-all duration-500 ease-in-out overflow-x-auto sm:overflow-x-hidden scrollbar-hide"
            style={{ height: `${containerHeight}px`, minHeight: "600px", width: "100%", minWidth: containerMinWidth }}
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
                {Array.from(levelGroups.entries()).sort((a, b) => a[0] - b[0]).flatMap(([level, skills]) => {
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

                {/* Level Quest Labels */}
                {Array.from(levelGroups.entries()).sort((a, b) => a[0] - b[0]).flatMap(([level, skills]) => {
                  const sortedByY = [...skills].sort((a, b) => a.y - b.y);
                  if (sortedByY.length === 0) return [];
                  
                  const firstSkill = sortedByY[0];
                  const lastSkill = sortedByY[sortedByY.length - 1];
                  
                  // Check if all skills in level are mastered
                  const levelCompleted = skills.every(s => s.status === "mastered");
                  
                  // Find the first available (not mastered) node, or use first node if all are mastered
                  const firstAvailableSkill = sortedByY.find(s => s.status !== "mastered") || firstSkill;
                  
                  // Calculate midY: if level is completed, use middle position; otherwise use first available node
                  const midY = levelCompleted ? (firstSkill.y + lastSkill.y) / 2 : firstAvailableSkill.y;
                  
                  // Determine quest text based on the level position of the first available node
                  let questText = "Completed Quest:";
                  if (!levelCompleted) {
                    // If the first available node is the second node of the level (levelPosition === 2), show "New Quest"
                    // Otherwise show "Updated Quest" for subsequent nodes
                    questText = firstAvailableSkill.levelPosition === 2 ? "New Quest:" : "Updated Quest:";
                  }
                  
                  // Get level subtitle
                  const levelSubtitles = isProject ? (activeProject?.levelSubtitles || {}) : (activeArea?.levelSubtitles || {});
                  const subtitle = levelSubtitles[level.toString()] || "";
                  
                  // Si no hay subtítulo, no mostrar nada
                  if (!subtitle) return [];
                  
                  const isNewOrUpdatedQuest = !levelCompleted;
                  
                  // Calculate max width: leave some space before the node position
                  // Nodes are positioned at skill.x%, so we need to convert that to pixels
                  // Approximate max-width based on first available skill's X position
                  const maxWidthPercent = Math.max(firstAvailableSkill.x - 15, 30); // Leave 15% margin before node
                  
                  return [<motion.div
                    key={`quest-label-${level}-${activeItem.id}`}
                    initial={{ opacity: 0 }}
                    whileInView={isNewOrUpdatedQuest ? { opacity: 1 } : undefined}
                    transition={isNewOrUpdatedQuest ? { 
                      duration: 0.8,
                      ease: "easeIn"
                    } : undefined}
                    viewport={isNewOrUpdatedQuest ? { once: false, amount: 0.5 } : undefined}
                    className={cn(
                      "absolute -translate-y-1/2 flex flex-col items-start z-30",
                      "md:whitespace-nowrap",
                      "md:left-[20px]",
                      "left-[8px]",
                      "md:block",
                      !isMenuOpen && "block",
                      isMenuOpen && "md:block hidden"
                    )}
                    style={{ 
                      top: `${midY}px`,
                      maxWidth: `${maxWidthPercent}%`,
                    }}
                  >
                    <div 
                      className={`text-xs font-bold tracking-wider uppercase ${isNewOrUpdatedQuest ? 'text-amber-400' : 'text-muted-foreground'}`}
                      style={{
                        ...(isNewOrUpdatedQuest && {
                          textShadow: "0 0 20px rgba(251, 191, 36, 0.8), 0 0 40px rgba(251, 191, 36, 0.5), 0 0 60px rgba(251, 191, 36, 0.3)",
                        }),
                        letterSpacing: "0.15em",
                        fontSize: "clamp(0.5rem, 2vw, 0.75rem)"
                      }}
                    >
                      {questText.replace(":", "")}
                    </div>
                    <div 
                      className={`font-bold mt-1 ${isNewOrUpdatedQuest ? 'text-amber-300' : 'text-muted-foreground'}`}
                      style={{
                        ...(isNewOrUpdatedQuest && {
                          textShadow: "0 0 15px rgba(251, 191, 36, 0.6), 0 0 30px rgba(251, 191, 36, 0.3)",
                        }),
                        letterSpacing: "0.05em",
                        fontSize: "clamp(0.875rem, 3vw, 1.125rem)"
                      }}
                    >
                      {subtitle}
                    </div>
                  </motion.div>];
                })}

                {/* Nodes */}
                {visibleSkills.length > 0 && console.log("[SkillCanvas] About to render visibleSkills:", visibleSkills.map(s => `level:${s.level} pos:${s.levelPosition} x:${s.x} y:${s.y} title:${s.title}`)) || null}
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
  const [isDesignerOpen, setIsDesignerOpen] = useState(false);
  const [isProgressOpen, setIsProgressOpen] = useState(false);
  const [isHabitsOpen, setIsHabitsOpen] = useState(false);
  const [isStrengthOpen, setIsStrengthOpen] = useState(false);
  
  const handleCompleteOnboarding = () => {
    if (user?.id) {
      markComplete(user.id.toString());
    }
    closeGuide();
  };
  
  return (
    <DiaryProvider>
      <SkillTreeProvider>
        <MenuProvider>
          <div className="flex h-screen w-full bg-background text-foreground overflow-hidden font-body selection:bg-primary/30">
            <TopRightControls onOpenGuide={openGuide} onOpenDesigner={() => setIsDesignerOpen(true)} onOpenProgress={() => setIsProgressOpen(true)} onOpenHabits={() => setIsHabitsOpen(true)} onOpenStrength={() => setIsStrengthOpen(true)} />
            <ProgressModal open={isProgressOpen} onOpenChange={setIsProgressOpen} />
            <SkillDesigner open={isDesignerOpen} onOpenChange={setIsDesignerOpen} />
            <HabitStreakModal open={isHabitsOpen} onOpenChange={setIsHabitsOpen} />
            <SpaceRepetitionModal open={isStrengthOpen} onOpenChange={setIsStrengthOpen} />
            <AreaMenu />
            <SkillCanvas />
            <QuestDiary />
            <OnboardingGuide isOpen={showOnboarding} onComplete={handleCompleteOnboarding} />
          </div>
        </MenuProvider>
        </SkillTreeProvider>
    </DiaryProvider>
  );
}
