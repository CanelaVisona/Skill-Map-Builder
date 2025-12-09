import React, { useState } from "react";
import { SkillTreeProvider, useSkillTree, type Skill } from "@/lib/skill-context";
import { AreaMenu } from "@/components/AreaMenu";
import { SkillNode } from "@/components/SkillNode";
import { SkillConnection } from "@/components/SkillConnection";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Sun, Moon, BookOpen, Trash2, Plus, Users, Map as MapIcon, Skull, Scroll, Pencil, X } from "lucide-react";
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
import type { JournalCharacter, JournalPlace, JournalShadow } from "@shared/schema";

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

function TopRightControls() {
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
        title="Quest Diary"
      >
        <BookOpen className="h-5 w-5" />
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
  type: "characters" | "places" | "shadows";
  entries: JournalEntry[];
  isLoading: boolean;
  onAdd: (entry: { name: string; action: string; description: string }) => void;
  onEdit: (id: string, entry: { name: string; action: string; description: string }) => void;
  onDelete: (id: string) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [extraInfo, setExtraInfo] = useState("");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const longPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const entryLongPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLongPressStart = () => {
    longPressTimer.current = setTimeout(() => {
      setIsAdding(true);
      setEditingId(null);
      setName("");
      setDescription("");
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleEntryLongPressStart = (entry: JournalEntry) => {
    entryLongPressTimer.current = setTimeout(() => {
      setSelectedEntryId(entry.id);
      setEditingId(entry.id);
      setName(entry.name);
      setDescription(entry.description || "");
      setShowDeleteConfirm(true);
    }, 500);
  };

  const handleEntryLongPressEnd = () => {
    if (entryLongPressTimer.current) {
      clearTimeout(entryLongPressTimer.current);
      entryLongPressTimer.current = null;
    }
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    if (editingId) {
      onEdit(editingId, { name: name.trim().toUpperCase(), action: "", description: description.trim() });
      setEditingId(null);
      setShowDeleteConfirm(false);
    } else {
      onAdd({ name: name.trim().toUpperCase(), action: "", description: description.trim() });
      setIsAdding(false);
    }
    setName("");
    setDescription("");
    setSelectedEntryId(null);
  };

  const handleAddInfo = () => {
    if (!extraInfo.trim()) return;
    const newDescription = description ? `${description}\n${extraInfo.trim()}` : extraInfo.trim();
    setDescription(newDescription);
    setExtraInfo("");
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setName("");
    setDescription("");
    setSelectedEntryId(null);
    setShowDeleteConfirm(false);
  };

  const handleDelete = () => {
    if (selectedEntryId) {
      onDelete(selectedEntryId);
      setSelectedEntryId(null);
      setEditingId(null);
      setShowDeleteConfirm(false);
    }
  };

  const emptyMessage = type === "characters" ? "No characters" : type === "places" ? "No places" : "No shadows";
  const countLabel = type === "characters" ? "characters" : type === "places" ? "places" : "shadows";
  const Icon = type === "characters" ? Users : type === "places" ? MapIcon : Skull;

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Loading...</div>;
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">
          {entries.length} {countLabel}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { setIsAdding(true); setEditingId(null); setName(""); setDescription(""); }}
          className="h-7 px-2"
          data-testid={`button-add-${type}`}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {(isAdding || editingId) && (
        <div className="mb-4 p-3 border border-border rounded-lg space-y-2">
          <Input
            placeholder="NAME"
            value={name}
            onChange={(e) => setName(e.target.value.toUpperCase())}
            className="uppercase"
            data-testid={`input-${type}-name`}
          />
          <Textarea
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            data-testid={`input-${type}-description`}
          />
          {editingId && (
            <div className="flex gap-2">
              <Input
                placeholder="Add more info..."
                value={extraInfo}
                onChange={(e) => setExtraInfo(e.target.value)}
                className="flex-1"
                data-testid={`input-${type}-extra`}
              />
              <Button size="sm" variant="outline" onClick={handleAddInfo} disabled={!extraInfo.trim()}>
                +
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSubmit} data-testid={`button-save-${type}`}>
              {editingId ? "Save" : "Add"}
            </Button>
            {showDeleteConfirm && (
              <Button size="sm" variant="destructive" onClick={handleDelete}>
                Delete
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1">
        {entries.length === 0 ? (
          <div 
            className="flex flex-col items-center justify-center py-12 text-center cursor-pointer select-none"
            onTouchStart={handleLongPressStart}
            onTouchEnd={handleLongPressEnd}
            onTouchCancel={handleLongPressEnd}
            onMouseDown={handleLongPressStart}
            onMouseUp={handleLongPressEnd}
            onMouseLeave={handleLongPressEnd}
          >
            <Icon className="h-8 w-8 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground text-sm">{emptyMessage}</p>
            <p className="text-muted-foreground/50 text-xs mt-2">Hold to add</p>
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="p-3 border border-border rounded-lg cursor-pointer select-none"
                data-testid={`card-${type}-${entry.id}`}
                onTouchStart={() => handleEntryLongPressStart(entry)}
                onTouchEnd={handleEntryLongPressEnd}
                onTouchCancel={handleEntryLongPressEnd}
                onMouseDown={() => handleEntryLongPressStart(entry)}
                onMouseUp={handleEntryLongPressEnd}
                onMouseLeave={handleEntryLongPressEnd}
              >
                <h4 className="font-medium text-sm text-foreground uppercase">{entry.name}</h4>
                {entry.description && (
                  <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line">{entry.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
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
  
  // From areas
  areas.forEach(area => {
    const completedSkills = area.skills
      .filter(s => s.status === "mastered" && s.title.toLowerCase() !== "inicio")
      .map(skill => ({ ...skill, sourceName: area.name, sourceSkills: area.skills }));
    if (completedSkills.length > 0) {
      sourceGroups.push({ name: area.name, skills: completedSkills });
    }
  });
  
  // From main quests
  mainQuests.forEach(project => {
    const completedSkills = project.skills
      .filter(s => s.status === "mastered" && s.title.toLowerCase() !== "inicio")
      .map(skill => ({ ...skill, sourceName: project.name, sourceSkills: project.skills }));
    if (completedSkills.length > 0) {
      sourceGroups.push({ name: project.name, skills: completedSkills });
    }
  });
  
  // From side quests
  sideQuests.forEach(project => {
    const completedSkills = project.skills
      .filter(s => s.status === "mastered" && s.title.toLowerCase() !== "inicio")
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
      const visibleSubtasks = allSubtasks.filter((s: Skill) => {
        const title = s.title.toLowerCase();
        const isPlaceholder = title === "inicio" || title.includes("next challenge") || title.includes("next challange");
        return visibleLevels.has(s.level) && !isPlaceholder;
      });
      setSelectedSubtasks(visibleSubtasks);
    } catch {
      setSelectedSubtasks([]);
    }
  };

  return (
    <div className="flex h-full">
      <div className={`${hasSubtasks ? 'w-1/3' : 'w-1/2'} flex flex-col border-r border-border pr-4`}>
        <ScrollArea className="flex-1">
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
        <div className="w-1/3 flex flex-col border-r border-border px-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Subtasks</p>
          <ScrollArea className="flex-1">
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
      
      <div className={`${hasSubtasks ? 'w-1/3' : 'w-1/2'} flex flex-col pl-4`}>
        <ScrollArea className="flex-1">
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
              <div className="pt-2">
                <p className="text-xs text-foreground uppercase tracking-wide mb-2">Feedback</p>
                {nextSubtaskForSelected?.feedback ? (
                  <p className="text-sm text-yellow-500 dark:text-yellow-400 leading-relaxed">
                    {nextSubtaskForSelected.feedback}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground/40 italic leading-relaxed">
                    No comments
                  </p>
                )}
              </div>
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
              <div className="pt-2">
                <p className="text-xs text-foreground uppercase tracking-wide mb-2">Feedback</p>
                {nextSkillForSelected?.feedback ? (
                  <p className="text-sm text-yellow-500 dark:text-yellow-400 leading-relaxed">
                    {nextSkillForSelected.feedback}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground/40 italic leading-relaxed">
                    No comments
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground/40 text-sm">
              Select a task
            </div>
          )}
        </ScrollArea>
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

  const deleteShadow = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/journal/shadows/${id}`, { method: "DELETE" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/journal/shadows"] }),
  });
  
  return (
    <Dialog open={isDiaryOpen} onOpenChange={(open) => !open && closeDiary()}>
      <DialogContent className="max-w-4xl h-[75vh] p-0 overflow-hidden bg-background border border-border">
        <VisuallyHidden>
          <DialogTitle>Journal</DialogTitle>
        </VisuallyHidden>
        <div className="flex h-full">
          <Tabs defaultValue="achievements" className="flex-1 flex" orientation="vertical">
            <TabsList className="flex flex-col h-full justify-start gap-1 p-2 rounded-none border-r border-border bg-transparent">
              <TabsTrigger value="achievements" className="p-2" data-testid="tab-achievements" title="Achievements">
                <Scroll className="h-5 w-5" />
              </TabsTrigger>
              <TabsTrigger value="characters" className="p-2" data-testid="tab-characters" title="Characters">
                <Users className="h-5 w-5" />
              </TabsTrigger>
              <TabsTrigger value="places" className="p-2" data-testid="tab-places" title="Places">
                <MapIcon className="h-5 w-5" />
              </TabsTrigger>
              <TabsTrigger value="shadows" className="p-2" data-testid="tab-shadows" title="Shadows">
                <Skull className="h-5 w-5" />
              </TabsTrigger>
            </TabsList>
            
            <div className="flex-1 p-6 overflow-hidden">
              <div className="mb-4">
                <h2 className="text-2xl font-bold tracking-tight">Journal</h2>
              </div>
              
              <TabsContent value="achievements" className="h-[calc(100%-4rem)] mt-0">
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
                <JournalSection
                  type="shadows"
                  entries={shadows}
                  isLoading={loadingShadows}
                  onAdd={(data) => createShadow.mutate(data)}
                  onEdit={(id, data) => updateShadow.mutate({ id, data })}
                  onDelete={(id) => deleteShadow.mutate(id)}
                />
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
    showCompleted
  } = useSkillTree();

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
                  {currentParent?.title || "Sub-Skills"}
                </h2>
              </div>
              <p className="text-muted-foreground max-w-md text-sm leading-relaxed ml-11">
                Sub-habilidades de {currentParent?.title}
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

                  {visibleSkills.map(skill => {
                    const itemColor = "text-zinc-800 dark:text-zinc-200";
                    const handleClick = () => toggleSubSkillStatus(skill.id);
                    return (
                      <SkillNode
                        key={skill.id}
                        skill={skill}
                        areaColor={itemColor}
                        onClick={handleClick}
                        isFirstOfLevel={firstSkillOfLevel.has(skill.id)}
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
          </div>

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
                {visibleSkills.map(skill => {
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
  return (
    <DiaryProvider>
      <SkillTreeProvider>
        <div className="flex h-screen w-full bg-background text-foreground overflow-hidden font-body selection:bg-primary/30">
          <TopRightControls />
          <AreaMenu />
          <SkillCanvas />
          <QuestDiary />
        </div>
      </SkillTreeProvider>
    </DiaryProvider>
  );
}
