import { motion, AnimatePresence } from "framer-motion";
import { type Skill, type GlobalSkill, useSkillTree } from "@/lib/skill-context";
import { type JournalThought, type JournalLearning, type JournalTool } from "@shared/schema";
import { cn } from "@/lib/utils";
import { Check, Lock, Trash2, ChevronUp, ChevronDown, Pencil, Plus, Star, ChevronRight, ChevronLeft, Wrench, Lightbulb, BicepsFlexed, Zap, Bug } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { type ExperienceGainSnapshot } from "./ExperienceGainPopup";
import { useXpPopup } from "@/lib/xp-popup-context";
import { useInsightsCounterPopup } from "@/lib/insights-counter-popup-context";
import { useBodyProgress, BODY_ZONES, BODY_ZONE_LABELS, type BodyZone, type BodyDimension } from "@/lib/body-progress-context";
import { useBodyGainPopup } from "@/lib/body-gain-popup-context";
import { useLevelUpCelebration } from "@/lib/level-up-celebration-context";
import { usePowerCelebration } from "@/lib/power-celebration-context";
import { usePendingRewards } from "@/lib/pending-rewards-context";
import { beginPopupChain, endPopupChain, runPopupQueueAsync, getPopupBusyDelay } from "@/lib/popup-coordinator";
import { getNodeTitleWordLimit, clampToWordLimit } from "@/lib/node-title-settings";
import {
  Popover,
  PopoverContent,
  PopoverAnchor,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectContent, SelectItem } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";

const WEEKDAY_NAMES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const WEEKDAY_IDS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
const CUSTOM_DATE_VALUE = "__custom__";

interface QuickDateOption {
  id: string;
  label: string;
  value: string;
}

const CUSTOM_DURATION_VALUE = "__custom_duration__";

interface QuickDurationOption {
  id: string;
  label: string;
  value: number;
}

const QUICK_DURATION_OPTIONS: QuickDurationOption[] = [
  { id: "5min", label: "5 min", value: 5 },
  { id: "10min", label: "10 min", value: 10 },
  { id: "15min", label: "15 min", value: 15 },
  { id: "30min", label: "30 min", value: 30 },
];

// Renders a saved plannedDuration the same way the "Time" selector does: as one of the
// quick-option labels (e.g. "15 min") when it matches, otherwise as a plain "X min".
function getPlannedDurationLabel(plannedDuration: number | null | undefined): string | null {
  if (!plannedDuration) return null;
  const matched = QUICK_DURATION_OPTIONS.find((opt) => opt.value === plannedDuration);
  if (matched) return matched.label;
  return `${plannedDuration} min`;
}

function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Hoy, Mañana, then the 6 remaining weekday names in chronological order (starting the day
// after tomorrow, wrapping around through next week up to — and including — today's own
// weekday). The day that falls on "Mañana" is skipped since it would just repeat that
// shortcut. E.g. if today is Tuesday: Hoy, Mañana, Jueves, Viernes, Sábado, Domingo, Lunes,
// Martes (next week's Tuesday) — Miércoles (tomorrow) is left out.
// Renders a saved plannedDate the same way the "When exactly?" selector does: as one of
// the quick-option labels (e.g. "Mañana") when it matches, otherwise as a plain date.
function getPlannedDateLabel(plannedDate: string | null | undefined): string | null {
  if (!plannedDate) return null;
  // A date that has already gone by is no longer useful info to surface on the node.
  if (plannedDate < formatLocalDate(new Date())) return null;
  const matched = getQuickDateOptions().find((opt) => opt.value === plannedDate);
  if (matched) return matched.label;
  return new Date(plannedDate + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function getQuickDateOptions(): QuickDateOption[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const options: QuickDateOption[] = [
    { id: "hoy", label: "Hoy", value: formatLocalDate(today) },
  ];

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  options.push({ id: "manana", label: "Mañana", value: formatLocalDate(tomorrow) });

  const todayDow = today.getDay() === 0 ? 6 : today.getDay() - 1; // Monday = 0 ... Sunday = 6
  for (let step = 2; step <= 7; step++) {
    const dow = (todayDow + step) % 7;
    const date = new Date(today);
    date.setDate(today.getDate() + step);
    options.push({ id: WEEKDAY_IDS[dow], label: WEEKDAY_NAMES[dow], value: formatLocalDate(date) });
  }

  return options;
}

// Shared body of the "select skill" popover used both by the node long-press Journal's
// Experience tab and by the title long-press edit dialog's Step 3 (Paso 3: XP). Besides the
// legacy/global skills already scoped to the current area/quest, it offers an "Otra área"
// escape hatch: pick any other area or quest, then pick one of its skills, for cases where the
// XP earned here actually belongs to a skill tracked elsewhere.
interface CrossAreaTarget {
  type: "area" | "project";
  id: string;
  name: string;
}

interface SkillPickerListProps {
  // Several skills can be picked at once -- picking toggles membership instead of
  // replacing the selection, and the popover stays open so more can be picked.
  selectedSkillIds: string[];
  onToggle: (id: string) => void;
  legacySkills: string[];
  scopedGlobalSkills: GlobalSkill[];
  areas: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; name: string }>;
  currentAreaId?: string;
  currentProjectId?: string;
  getGlobalSkillsForArea: (areaId: string) => GlobalSkill[];
  getGlobalSkillsForProject: (projectId: string) => GlobalSkill[];
  testIdPrefix: string;
}

function SkillPickerList({
  selectedSkillIds,
  onToggle,
  legacySkills,
  scopedGlobalSkills,
  areas,
  projects,
  currentAreaId,
  currentProjectId,
  getGlobalSkillsForArea,
  getGlobalSkillsForProject,
  testIdPrefix,
}: SkillPickerListProps) {
  const [otherAreaTarget, setOtherAreaTarget] = useState<CrossAreaTarget | null>(null);
  const [browsingOtherAreas, setBrowsingOtherAreas] = useState(false);

  // Doesn't close the popover or reset the current browsing view -- multi-select relies on
  // staying put so several skills (including several from the same "Otra área") can be picked
  // in a row.
  const pick = (id: string) => {
    onToggle(id);
  };

  // Skills of the chosen other area/quest
  if (otherAreaTarget) {
    const skillsThere = otherAreaTarget.type === "area"
      ? getGlobalSkillsForArea(otherAreaTarget.id)
      : getGlobalSkillsForProject(otherAreaTarget.id);

    return (
      <div
        className="max-h-56 overflow-y-auto overscroll-contain touch-pan-y"
        style={{ WebkitOverflowScrolling: "touch" }}
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start h-7 px-2 mb-1 text-xs text-muted-foreground hover:bg-muted/50"
          onClick={() => setOtherAreaTarget(null)}
          data-testid={`${testIdPrefix}-button-other-area-skills-back`}
        >
          <ChevronLeft className="h-3 w-3 mr-1" /> {otherAreaTarget.name}
        </Button>
        {skillsThere.length === 0 ? (
          <p className="text-xs text-muted-foreground px-2 py-3">No hay skills en {otherAreaTarget.name}</p>
        ) : (
          <div className="space-y-1">
            {skillsThere.filter(s => !s.parentSkillId).map((gSkill) => (
              <div key={gSkill.id}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`w-full justify-start h-8 px-3 text-xs font-medium ${
                    selectedSkillIds.includes(gSkill.id) ? "bg-muted text-foreground" : "hover:bg-muted/50"
                  }`}
                  onClick={() => pick(gSkill.id)}
                  data-testid={`${testIdPrefix}-button-select-otherarea-skill-${gSkill.id}`}
                >
                  {selectedSkillIds.includes(gSkill.id) ? "✓ " : ""}{gSkill.name}
                  <span className="ml-auto text-muted-foreground">Lv.{gSkill.level}</span>
                </Button>
                {skillsThere
                  .filter(s => s.parentSkillId === gSkill.id)
                  .map((subSkill) => (
                    <Button
                      key={subSkill.id}
                      variant="ghost"
                      size="sm"
                      className={`w-full justify-start h-7 px-3 pl-6 text-xs font-normal ${
                        selectedSkillIds.includes(subSkill.id) ? "bg-muted text-foreground" : "hover:bg-muted/50 text-muted-foreground"
                      }`}
                      onClick={() => pick(subSkill.id)}
                      data-testid={`${testIdPrefix}-button-select-otherarea-subskill-${subSkill.id}`}
                    >
                      ↳ {selectedSkillIds.includes(subSkill.id) ? "✓ " : ""}{subSkill.name}
                      <span className="ml-auto">Lv.{subSkill.level}</span>
                    </Button>
                  ))
                }
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // List of other areas/quests to browse into
  if (browsingOtherAreas) {
    const otherAreas = areas.filter(a => a.id !== currentAreaId);
    const otherProjects = projects.filter(p => p.id !== currentProjectId);

    return (
      <div
        className="max-h-56 overflow-y-auto overscroll-contain touch-pan-y"
        style={{ WebkitOverflowScrolling: "touch" }}
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start h-7 px-2 mb-1 text-xs text-muted-foreground hover:bg-muted/50"
          onClick={() => setBrowsingOtherAreas(false)}
          data-testid={`${testIdPrefix}-button-other-area-list-back`}
        >
          <ChevronLeft className="h-3 w-3 mr-1" /> Volver
        </Button>
        {otherAreas.length === 0 && otherProjects.length === 0 ? (
          <p className="text-xs text-muted-foreground px-2 py-3">No hay otras áreas o quests</p>
        ) : (
          <div className="space-y-1">
            {otherAreas.map((area) => (
              <Button
                key={area.id}
                variant="ghost"
                size="sm"
                className="w-full justify-start h-8 px-3 text-xs font-normal hover:bg-muted/50"
                onClick={() => setOtherAreaTarget({ type: "area", id: area.id, name: area.name })}
                data-testid={`${testIdPrefix}-button-other-area-${area.id}`}
              >
                {area.name}
              </Button>
            ))}
            {otherProjects.map((project) => (
              <Button
                key={project.id}
                variant="ghost"
                size="sm"
                className="w-full justify-start h-8 px-3 text-xs font-normal hover:bg-muted/50"
                onClick={() => setOtherAreaTarget({ type: "project", id: project.id, name: project.name })}
                data-testid={`${testIdPrefix}-button-other-quest-${project.id}`}
              >
                {project.name}
              </Button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Default view: skills already scoped to the current area/quest, plus the "Otra área" escape hatch
  return (
    <div
      className="max-h-56 overflow-y-auto overscroll-contain touch-pan-y"
      style={{ WebkitOverflowScrolling: "touch" }}
      onWheel={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
    >
      {/* Legacy skills (only those associated with this area/project) */}
      {legacySkills.length > 0 && (
        <div className="space-y-1 mb-2">
          {legacySkills.map((skillName) => {
            const optionId = `legacy:${skillName}`;
            return (
              <Button
                key={skillName}
                variant="ghost"
                size="sm"
                className={`w-full justify-start h-8 px-3 text-xs font-normal ${
                  selectedSkillIds.includes(optionId) ? "bg-muted text-foreground" : "hover:bg-muted/50"
                }`}
                onClick={() => pick(optionId)}
                data-testid={`${testIdPrefix}-button-select-legacy-${skillName}`}
              >
                {selectedSkillIds.includes(optionId) ? "✓ " : ""}{skillName}
              </Button>
            );
          })}
        </div>
      )}

      {/* GlobalSkills for this area/quest */}
      {scopedGlobalSkills.length > 0 && (
        <>
          <div className="border-t border-muted my-2" />
          <div className="space-y-1">
            {/* Parent skills (not subskills) */}
            {scopedGlobalSkills.filter(s => !s.parentSkillId).map((gSkill) => (
              <div key={gSkill.id}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`w-full justify-start h-8 px-3 text-xs font-medium ${
                    selectedSkillIds.includes(gSkill.id) ? "bg-muted text-foreground" : "hover:bg-muted/50"
                  }`}
                  onClick={() => pick(gSkill.id)}
                  data-testid={`${testIdPrefix}-button-select-skill-${gSkill.id}`}
                >
                  {selectedSkillIds.includes(gSkill.id) ? "✓ " : ""}{gSkill.name}
                  <span className="ml-auto text-muted-foreground">Lv.{gSkill.level}</span>
                </Button>
                {/* Subskills of this parent */}
                {scopedGlobalSkills
                  .filter(s => s.parentSkillId === gSkill.id)
                  .map((subSkill) => (
                    <Button
                      key={subSkill.id}
                      variant="ghost"
                      size="sm"
                      className={`w-full justify-start h-7 px-3 pl-6 text-xs font-normal ${
                        selectedSkillIds.includes(subSkill.id) ? "bg-muted text-foreground" : "hover:bg-muted/50 text-muted-foreground"
                      }`}
                      onClick={() => pick(subSkill.id)}
                      data-testid={`${testIdPrefix}-button-select-subskill-${subSkill.id}`}
                    >
                      ↳ {selectedSkillIds.includes(subSkill.id) ? "✓ " : ""}{subSkill.name}
                      <span className="ml-auto">Lv.{subSkill.level}</span>
                    </Button>
                  ))
                }
              </div>
            ))}
          </div>
        </>
      )}

      <div className="border-t border-muted my-2" />
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start h-8 px-3 text-xs font-normal text-muted-foreground hover:bg-muted/50"
        onClick={() => setBrowsingOtherAreas(true)}
        data-testid={`${testIdPrefix}-button-other-area`}
      >
        Otra área
      </Button>
    </div>
  );
}

interface SkillNodeProps {
  skill: Skill;
  areaColor: string;
  onClick: () => void;
  isFirstOfLevel?: boolean;
  isOnboardingTarget?: boolean;
  availableNodePosition?: number | null;
}

export function SkillNode({ skill, areaColor, onClick, isFirstOfLevel, isOnboardingTarget, availableNodePosition }: SkillNodeProps) {
  const isInicioNode = skill.title.toLowerCase() === "inicio"; // "inicio" nodes are text-only, not interactive
  const FIXED_XP_AMOUNT = 10;
  
  const { 
    activeAreaId, 
    activeProjectId,
    activeParentSkillId,
    activeArea,
    activeProject,
    areas,
    projects,
    subSkills,
    deleteSkill, 
    toggleLock, 
    moveSkill, 
    updateSkill,
    deleteProjectSkill,
    toggleProjectLock,
    moveProjectSkill,
    updateProjectSkill,
    deleteSubSkill,
    toggleSubSkillLock,
    moveSubSkill,
    updateSubSkill,
    enterSubSkillTree,
    addSkillBelow,
    addProjectSkillBelow,
    addSubSkillBelow,
    duplicateSkill,
    duplicateProjectSkill,
    duplicateSubSkill,
    updateLevelSubtitle,
    updateProjectLevelSubtitle,
    toggleFinalNode,
    toggleProjectFinalNode,
    globalSkills,
    getGlobalSkillsForArea,
    getGlobalSkillsForProject,
    addXpToGlobalSkill
  } = useSkillTree();

  const isProject = !activeAreaId && !!activeProjectId;
  const activeId = activeAreaId || activeProjectId;
  const isSubSkillView = !!activeParentSkillId;

  // Calculate if all nodes in this level are mastered
  const currentSkills = isSubSkillView 
    ? subSkills 
    : isProject 
      ? (activeProject?.skills || []) 
      : (activeArea?.skills || []);
  const skillsInLevel = currentSkills.filter(s => s.level === skill.level);
  const isLevelCompleted = skillsInLevel.length > 0 && skillsInLevel.every(s => s.status === "mastered");
  
  // Calculate if this node is the last node of its level (by levelPosition, not Y)
  // This ensures visibility is always based on the current sequential position after reorders
  const isLastNodeOfLevel = skillsInLevel.length > 0 && 
    skill.levelPosition === Math.max(...skillsInLevel.map(s => s.levelPosition || 0));
  
  // Star is active only when endOfAreaLevel is set to this level
  // isFinalNode: 1 is just an identifier (always on Node 6), not the control
  //
  // Sub-skill trees don't have a user-togglable "end" the way areas/projects do
  // (endOfAreaLevel isn't a real column on skills, so it never persisted there --
  // see toggleSubSkillFinalNode). Instead, the true final-final node of a sub-skill
  // tree -- the last node of its deepest level -- is always considered active and
  // can't be turned off; it's derived from structure, not a stored flag.
  const subSkillMaxLevel = isSubSkillView
    ? Math.max(...currentSkills.map(s => s.level))
    : null;
  const isStarActive = isSubSkillView
    ? (isLastNodeOfLevel && skill.level === subSkillMaxLevel)
    : isProject
      ? (activeProject?.endOfAreaLevel === skill.level)
      : (activeArea?.endOfAreaLevel === skill.level);

  // Calculate effective locked state: final nodes (by position) should appear locked
  // if not all other nodes in level are mastered (UNLESS star is active, then node itself blocks)
  const isFinalNodeByPosition = isLastNodeOfLevel;
  const otherNodesInLevel = skillsInLevel.filter(s => s.id !== skill.id);
  const allOthersMastered = otherNodesInLevel.every(s => s.status === "mastered");
  
  // CRITICAL: First node of any level MUST ALWAYS appear mastered, never locked
  const isFirstNodeOfLevel = skill.levelPosition === 1;
  
  // Effective states: final nodes show as locked if others aren't mastered
  const shouldForceLock = isFinalNodeByPosition && skill.status !== "mastered" && !allOthersMastered;
  const isLocked = isFirstNodeOfLevel ? false : (skill.status === "locked" || shouldForceLock);
  const isMastered = isFirstNodeOfLevel ? true : skill.status === "mastered";

  // Mastered/confirmed nodes can only be used as the source for adding a new node
  // if they're the one immediately before the currently unlocked ("available") node
  // in this level. Older confirmed nodes further back in the chain can't spawn new
  // nodes, since that would let the user branch off history instead of the frontier.
  const isPredecessorOfAvailable = availableNodePosition != null && skill.levelPosition === availableNodePosition - 1;
  const canAddFromNode = !isMastered || isPredecessorOfAvailable;

  // Calculate distance-based opacity for locked nodes (Rule 6)
  let lockedNodeOpacity = 1; // default
  if (isLocked && availableNodePosition !== undefined && availableNodePosition !== null) {
    const distance = (skill.levelPosition ?? 0) - availableNodePosition;
    if (distance === 1) {
      lockedNodeOpacity = 0.7;
    } else if (distance === 2) {
      lockedNodeOpacity = 0.55;
    } else if (distance >= 3) {
      lockedNodeOpacity = 0.35;
    }
  }

  // Detect if node has default name (generated Nodo X format)
  const hasDefaultName = skill.title.startsWith("Nodo ") || skill.title === "Next challenge" || skill.title === "Next objetive quest" || skill.title === "Objective quest";

  const plannedDateLabel = getPlannedDateLabel(skill.plannedDate);
  const plannedDurationLabel = getPlannedDurationLabel(skill.plannedDuration);

  // Default-named nodes get a mild extra fade, but distance to the active node stays
  // the dominant signal: a freshly-added node (necessarily still default-named) must
  // never look fainter than an already-named node sitting further away.
  if (isLocked && hasDefaultName) {
    lockedNodeOpacity *= 0.85;
  }
  
  // Check if swap would violate mastered/available constraint
  const canMoveUp = (): boolean | null => {
    // Rule 1: Node 1 (levelPosition === 1) - hide both arrows
    if (skill.levelPosition === 1) return null;
    
    // Rule 3: First non-Node-1 (levelPosition === 2) - hide up arrow
    if (skill.levelPosition === 2) return null;
    
    const sorted = [...skillsInLevel].sort((a, b) => a.y - b.y);
    const index = sorted.findIndex(s => s.id === skill.id);
    if (index <= 0) return false;
    
    const neighbor = sorted[index - 1];
    if (!neighbor) return false;
    
    // Hide button if mastered/available swap
    if ((skill.status === "mastered" && neighbor.status === "available") ||
        (skill.status === "available" && neighbor.status === "mastered")) {
      return null;
    }
    
    return true;
  };

  const canMoveDown = (): boolean | null => {
    // Rule 1: Node 1 (levelPosition === 1) - hide both arrows
    if (skill.levelPosition === 1) return null;
    
    // Rule 2: Final node - hide down arrow
    if (skill.isFinalNode === 1 || isLastNodeOfLevel) return null;
    
    const sorted = [...skillsInLevel].sort((a, b) => a.y - b.y);
    const index = sorted.findIndex(s => s.id === skill.id);
    if (index >= sorted.length - 1) return false;
    
    const neighbor = sorted[index + 1];
    if (!neighbor) return false;
    
    // Hide button if mastered/available swap
    if ((skill.status === "mastered" && neighbor.status === "available") ||
        (skill.status === "available" && neighbor.status === "mastered")) {
      return null;
    }
    
    return true;
  };
  
  const [isOpen, setIsOpen] = useState(false);
  const [popoverStep, setPopoverStep] = useState(0); // 0 = menu, 1 = journal tabs
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editStep, setEditStep] = useState(0);
  const [editTitle, setEditTitle] = useState(skill.title);
  const [editAction, setEditAction] = useState(skill.description?.split("\n\nWhen: ")[0] || "");
  const [editPlannedDate, setEditPlannedDate] = useState(skill.plannedDate || "");
  const [showCustomCalendar, setShowCustomCalendar] = useState(false);
  // True right after picking "Elegir fecha" and before a day is actually chosen in the popup
  // calendar. Without this, the Select's controlled `value` (derived from editPlannedDate,
  // which hasn't changed yet) would snap back to the previous option on the very next render,
  // fighting with what the user just clicked and causing the popover to flash open/closed.
  const [pendingCustomDate, setPendingCustomDate] = useState(false);
  // Controlled open state for the "When exactly?" Select. Needed so re-clicking the
  // already-selected option (see suppressWhenOptionClickRef below) can close the dropdown
  // itself, since in that case Radix's own close-on-select logic is deliberately skipped.
  const [isWhenSelectOpen, setIsWhenSelectOpen] = useState(false);
  // Radix Select never calls onValueChange when the clicked item is already the selected
  // value (its controlled value wouldn't change), so re-clicking the active option to
  // deselect it has to be intercepted at the pointer level instead. Mouse selection
  // resolves on pointerup while touch resolves on the click that follows, so this ref
  // records which option id we've just deselected on pointerup, letting the subsequent
  // click on that same item be swallowed before it can re-select it out from under us.
  const suppressWhenOptionClickRef = useRef<string | null>(null);
  const [editPlannedDuration, setEditPlannedDuration] = useState<number | null>(skill.plannedDuration ?? null);
  const [showCustomDurationInput, setShowCustomDurationInput] = useState(false);
  // Mirrors pendingCustomDate above, but for the custom duration input.
  const [pendingCustomDuration, setPendingCustomDuration] = useState(false);
  const [customDurationInputValue, setCustomDurationInputValue] = useState("");
  // Mirrors isWhenSelectOpen/suppressWhenOptionClickRef above, for the "Time" Select.
  const [isDurationSelectOpen, setIsDurationSelectOpen] = useState(false);
  const suppressDurationOptionClickRef = useRef<string | null>(null);
  const [editDescription, setEditDescription] = useState(skill.description || "");
  const [editFeedback, setEditFeedback] = useState(skill.feedback || "");
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);
  const lastClickTime = useRef<number>(0); // Debounce flag to prevent duplicate onClick calls

  // Speech-bubble feedback shown when tapping a node that can't be interacted with yet
  // (still locked, or available but blocked on its own incomplete subskills). Cleared
  // automatically after a couple seconds, and reset on every new tap so a rapid re-click
  // restarts the visible timer instead of the bubble abruptly vanishing mid-message.
  const [lockedFeedback, setLockedFeedback] = useState<string | null>(null);
  const lockedFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showLockedFeedback = (message: string) => {
    if (lockedFeedbackTimer.current) {
      clearTimeout(lockedFeedbackTimer.current);
    }
    setLockedFeedback(message);
    lockedFeedbackTimer.current = setTimeout(() => {
      setLockedFeedback(null);
      lockedFeedbackTimer.current = null;
    }, 2200);
  };
  useEffect(() => {
    return () => {
      if (lockedFeedbackTimer.current) clearTimeout(lockedFeedbackTimer.current);
    };
  }, []);

  const [isSubtitleDialogOpen, setIsSubtitleDialogOpen] = useState(false);
  const [isSubtaskConfirmOpen, setIsSubtaskConfirmOpen] = useState(false);
  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);
  const levelSubtitles = isProject ? (activeProject?.levelSubtitles || {}) : (activeArea?.levelSubtitles || {});
  const levelSubtitleDescriptions = isProject ? (activeProject?.levelSubtitleDescriptions || {}) : (activeArea?.levelSubtitleDescriptions || {});
  const currentSubtitle = levelSubtitles[skill.level.toString()] || "";
  const currentSubtitleDescription = levelSubtitleDescriptions[skill.level.toString()] || "";
  const trimmedLevelSubtitle = currentSubtitle.trim();
  const showCompletedLevelSubtitle = isFirstOfLevel && isLevelCompleted && trimmedLevelSubtitle.length > 0;
  const [editSubtitle, setEditSubtitle] = useState(currentSubtitle);
  const [editSubtitleDescription, setEditSubtitleDescription] = useState(currentSubtitleDescription);
  const levelLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTitleLongPress = useRef(false);

  // Tools & Learnings form state
  const queryClient = useQueryClient();
  const [feedbackActiveTab, setFeedbackActiveTab] = useState<"thoughts" | "tools" | "learnings" | "experience" | "body" | "powers" | "bugs">("thoughts");
  const [thoughtTitle, setThoughtTitle] = useState("");
  const [thoughtSentence, setThoughtSentence] = useState("");
  const [toolTitle, setToolTitle] = useState("");
  const [toolSentence, setToolSentence] = useState("");
  const [learningTitle, setLearningTitle] = useState("");
  const [learningSentence, setLearningSentence] = useState("");
  const [selectedPowerId, setSelectedPowerId] = useState<string | null>(null);
  const [selectedBugId, setSelectedBugId] = useState<string | null>(null);
  
  const [hasIncompleteSubtasks, setHasIncompleteSubtasks] = useState(false);
  // Whether this node has a sub-skill tree at all (as opposed to hasIncompleteSubtasks being
  // false simply because there are no subskills yet) -- needed to tell "no subtree" apart from
  // "subtree exists and is fully mastered" so the completed-tree badge only shows for the latter.
  const [hasSubskillTree, setHasSubskillTree] = useState(false);

  const { showXpPopup, hideXpPopup } = useXpPopup();
  const { showInsightsCounterPopup } = useInsightsCounterPopup();
  const { showLevelUpCelebration } = useLevelUpCelebration();
  const { showPowerCelebration } = usePowerCelebration();
  const { addBodyBlock } = useBodyProgress();
  const { showBodyGainPopup, hideBodyGainPopup } = useBodyGainPopup();
  const [selectedBodyDimension, setSelectedBodyDimension] = useState<BodyDimension>("fuerza");
  const [selectedBodyZones, setSelectedBodyZones] = useState<BodyZone[]>([]);
  const [showBodyZoneSelector, setShowBodyZoneSelector] = useState(false);

  const toggleBodyZone = (zone: BodyZone) => {
    setSelectedBodyZones((prev) =>
      prev.includes(zone) ? prev.filter((z) => z !== zone) : [...prev, zone]
    );
  };

  // Step 3 of the title-long-press edit dialog (xp/fuerza/poderes preview). Picking here only
  // stages a choice -- it must NOT touch the skill's XP, body progress, or power state. Those
  // mutations (and their celebration pop-ups) only run once the node itself gets confirmed
  // (see runConfirmSequence), so this state is deliberately kept separate from the Journal
  // tab's own experienceSelectedSkills/selectedBodyZones/selectedPowerId, which apply immediately.
  // Held in PendingRewardsContext (keyed by skill.id) instead of local useState so the staged
  // choice survives this component unmounting -- which happens on every "page" change, since
  // switching area/quest/Journal swaps out which skill nodes are mounted.
  const {
    getPendingRewards,
    setPendingRewardsTab: setPendingRewardsTabFor,
    setPendingXpSkillIds: setPendingXpSkillIdsFor,
    setPendingBodyDimension: setPendingBodyDimensionFor,
    setPendingBodyZones: setPendingBodyZonesFor,
    setPendingPowerId: setPendingPowerIdFor,
    setPendingLearning: setPendingLearningFor,
    setPendingTools: setPendingToolsFor,
  } = usePendingRewards();
  const {
    rewardsTab: pendingRewardsTab,
    xpSkillIds: pendingXpSkillIds,
    bodyDimension: pendingBodyDimension,
    bodyZones: pendingBodyZones,
    powerId: pendingPowerId,
    learning: pendingLearning,
    tools: pendingTools,
  } = getPendingRewards(skill.id);
  const setPendingRewardsTab = (tab: "experience" | "body" | "powers" | "learning") => setPendingRewardsTabFor(skill.id, tab);
  const setPendingXpSkillIds = (update: string[] | ((prev: string[]) => string[])) =>
    setPendingXpSkillIdsFor(skill.id, update);
  const setPendingBodyDimension = (dimension: BodyDimension) => setPendingBodyDimensionFor(skill.id, dimension);
  const setPendingBodyZones = (update: BodyZone[] | ((prev: BodyZone[]) => BodyZone[])) =>
    setPendingBodyZonesFor(skill.id, update);
  const setPendingPowerId = (powerId: string | null) => setPendingPowerIdFor(skill.id, powerId);
  const setPendingLearning = (learning: { title: string; sentence: string } | null) => setPendingLearningFor(skill.id, learning);
  const setPendingTools = (
    update: Array<{ title: string; sentence: string }> | ((prev: Array<{ title: string; sentence: string }>) => Array<{ title: string; sentence: string }>)
  ) => setPendingToolsFor(skill.id, update);
  const [showPendingXpSkillSelector, setShowPendingXpSkillSelector] = useState(false);
  const [showPendingBodyZoneSelector, setShowPendingBodyZoneSelector] = useState(false);

  const togglePendingXpSkillId = (id: string) => {
    setPendingXpSkillIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const togglePendingBodyZone = (zone: BodyZone) => {
    setPendingBodyZones((prev) =>
      prev.includes(zone) ? prev.filter((z) => z !== zone) : [...prev, zone]
    );
  };
  // Nota: la barra de nivel del área/quest (ProgressBar / AreaLevelGainPopup) ya no se toca
  // desde acá -- sube únicamente al completar nodos del skill tree de ese nivel (ver
  // toggleSkillStatus en skill-context.tsx). Agregar experiencia a un skill (este archivo)
  // sólo afecta el XP propio del skill, mostrado con showXpPopup más abajo.

  // Cuántos pensamientos/aprendizajes/herramientas hay ya registrados para ESTA área/quest
  // (todos sus nodos, incluidos sub-skill trees -- no mezclado con otras áreas/quests) -- cada
  // tipo lleva su propio conteo, para el pop-up que dispara
  // handleAddThought/Learning/LearningNow/Tool. El server resuelve el sub-skill tree vía
  // getAllSkillIdsInScope. Fuerza su propio fetch de red (staleTime: 0) para garantizar que
  // countBefore sea exacto incluso si esa query nunca se activó antes.
  const getJournalEntryCount = async (kind: "learnings" | "tools" | "thoughts"): Promise<number> => {
    const scopeParam = activeAreaId
      ? `areaId=${activeAreaId}`
      : activeProjectId
        ? `projectId=${activeProjectId}`
        : "";
    const url = `/api/journal/${kind}${scopeParam ? `?${scopeParam}` : ""}`;
    const entries = await queryClient.fetchQuery<Array<unknown>>({
      queryKey: [url],
      staleTime: 0,
    });
    return entries?.length ?? 0;
  };

  // Queries for archivements (learnings, tools, thoughts by skillId)
  const { data: skillLearnings = [] } = useQuery({
    queryKey: ["/api/journal/learnings", skill.id],
    queryFn: async () => {
      const res = await fetch(`/api/journal/learnings?skillId=${skill.id}`);
      return res.json();
    },
  });

  const { data: skillTools = [] } = useQuery({
    queryKey: ["/api/journal/tools", skill.id],
    queryFn: async () => {
      const res = await fetch(`/api/journal/tools?skillId=${skill.id}`);
      return res.json();
    },
  });

  const { data: skillThoughts = [] } = useQuery({
    queryKey: ["/api/journal/thoughts", skill.id],
    queryFn: async () => {
      const res = await fetch(`/api/journal/thoughts?skillId=${skill.id}`);
      return res.json();
    },
  });

  interface SkillNodeSourcePower {
    id: string;
    name: string;
    description: string;
    isUnlocked: 0 | 1 | 2;
  }

  const sourceType = activeAreaId ? "area" : activeProjectId ? "project" : null;
  const sourceId = activeAreaId || activeProjectId;

  const { data: sourcePowers = [] } = useQuery<SkillNodeSourcePower[]>({
    queryKey: [`/api/source-powers/${sourceType}/${sourceId}`],
    queryFn: async () => {
      if (!sourceType || !sourceId) return [];
      const res = await fetch(`/api/source-powers/${sourceType}/${sourceId}`);
      if (!res.ok) {
        throw new Error("Failed to fetch powers");
      }
      return res.json();
    },
    enabled: !!sourceType && !!sourceId,
  });

  useEffect(() => {
    if (sourcePowers.length === 0) {
      setSelectedPowerId(null);
      return;
    }

    if (!selectedPowerId || !sourcePowers.some((power) => power.id === selectedPowerId)) {
      setSelectedPowerId(sourcePowers[0].id);
    }
  }, [sourcePowers, selectedPowerId]);

  const selectedPower = sourcePowers.find((power) => power.id === selectedPowerId) || null;
  const pendingSelectedPower = sourcePowers.find((power) => power.id === pendingPowerId) || null;

  const updateSourcePower = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SkillNodeSourcePower> }) => {
      const res = await fetch(`/api/source-powers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update power");
      }
      return res.json() as Promise<SkillNodeSourcePower>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/source-powers/${sourceType}/${sourceId}`] });
    },
    onError: (error) => {
      console.error("updateSourcePower error:", error);
    },
  });

  // Core power unlock/master logic, shared by the Journal tab's immediate "Desbloquear"/"Dominar"
  // button and by runConfirmSequence.
  const applyPowerAction = async (power: SkillNodeSourcePower, showPopup: (fn: () => void) => void = (fn) => fn()) => {
    if (power.isUnlocked === 2) return;

    const nextState = power.isUnlocked === 0 ? 1 : 2;

    try {
      await updateSourcePower.mutateAsync({ id: power.id, data: { isUnlocked: nextState } });
      showPopup(() => showPowerCelebration({ name: power.name, kind: nextState === 1 ? "unlocked" : "confirmed" }));
    } catch {
      // Mutation error is already handled by the mutation's onError callback.
    }
  };

  const handlePowerAction = async () => {
    if (!selectedPower) return;
    await applyPowerAction(selectedPower);
  };

  interface SkillNodeSourceBug {
    id: string;
    nombre: string;
    status: "identificado" | "debugueando" | "debugueado";
    victoryCount: number;
    desc: string;
  }

  const { data: sourceBugs = [] } = useQuery<SkillNodeSourceBug[]>({
    queryKey: [`/api/source-bugs/${sourceType}/${sourceId}`],
    queryFn: async () => {
      if (!sourceType || !sourceId) return [];
      const res = await fetch(`/api/source-bugs/${sourceType}/${sourceId}`);
      if (!res.ok) {
        throw new Error("Failed to fetch bugs");
      }
      return res.json();
    },
    enabled: !!sourceType && !!sourceId,
  });

  useEffect(() => {
    if (sourceBugs.length === 0) {
      setSelectedBugId(null);
      return;
    }

    if (!selectedBugId || !sourceBugs.some((bug) => bug.id === selectedBugId)) {
      setSelectedBugId(sourceBugs[0].id);
    }
  }, [sourceBugs, selectedBugId]);

  const selectedBug = sourceBugs.find((bug) => bug.id === selectedBugId) || null;
  const bugProgressCount = selectedBug?.status === "debugueado" ? 5 : Math.min(selectedBug?.victoryCount || 0, 5);

  const bugStatusLabel: Record<SkillNodeSourceBug["status"], string> = {
    identificado: "Identificado",
    debugueando: "Debugueando",
    debugueado: "Debugueado",
  };

  const bugStatusColor: Record<SkillNodeSourceBug["status"], string> = {
    identificado: "bg-red-400",
    debugueando: "bg-amber-400",
    debugueado: "bg-emerald-400",
  };

  // Experience tab state for editStep 2 -- several skills can be picked at once, each gets the
  // full XP amount (see handleAddExperience).
  const [experienceSelectedSkills, setExperienceSelectedSkills] = useState<string[]>([]);
  const toggleExperienceSkill = (id: string) => {
    setExperienceSelectedSkills((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };
  const [showExperienceSkillSelector, setShowExperienceSkillSelector] = useState(false);
  
  // Legacy skill associations from localStorage
  const [legacySkillAssociations, setLegacySkillAssociations] = useState<Record<string, Array<{ type: "area" | "project"; id: string }>>>({});
  
  // Load legacy skill associations
  useEffect(() => {
    const stored = localStorage.getItem("legacySkillAssociations");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Migration: convert old single association to array
        const migrated: Record<string, Array<{ type: "area" | "project"; id: string }>> = {};
        Object.entries(parsed).forEach(([skill, assoc]) => {
          if (Array.isArray(assoc)) {
            migrated[skill] = assoc.filter(a =>
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
            migrated[skill] = [{
              type: (assoc as any).type,
              id: (assoc as any).id
            }];
          }
        });
        setLegacySkillAssociations(migrated);
      } catch (e) {
        console.error("Error parsing legacy skill associations:", e);
      }
    }
  }, []);
  
  // Filter legacy skills to only show ones associated with current area/project
  const filteredLegacySkills = ["Limpieza", "Guitarra", "Lectura", "Growth mindset", "Acertividad"].filter(skillName => {
    const associations = Array.isArray(legacySkillAssociations[skillName]) ? legacySkillAssociations[skillName] : [];
    if (associations.length === 0) return false;
    if (activeAreaId) {
      return associations.some(a => a.type === "area" && a.id === activeAreaId);
    }
    if (activeProjectId) {
      return associations.some(a => a.type === "project" && a.id === activeProjectId);
    }
    return false;
  });
  
  // XP state
  const [xpValue, setXpValue] = useState(FIXED_XP_AMOUNT.toString());
  const [showXpAnimation, setShowXpAnimation] = useState(false);
  const [animatedXpValue, setAnimatedXpValue] = useState("");

  // Learning/tool finalize dialog shown right before a node with a staged learning gets
  // confirmed -- see runConfirmSequence and the isLearningFinalizeOpen Dialog below.
  const [isLearningFinalizeOpen, setIsLearningFinalizeOpen] = useState(false);
  const [finalizeLearningTitle, setFinalizeLearningTitle] = useState("");
  const [finalizeLearningSentence, setFinalizeLearningSentence] = useState("");
  // Set the moment "Confirmar" is pressed in that dialog, so a second tap on the node while
  // the confirm PATCH is still in flight (skill.status/pendingLearning haven't updated yet --
  // that round-trip plus the popup-chain busy-wait in runConfirmSequence can take a couple of
  // seconds) doesn't re-open the same "Terminar aprendizaje" dialog. Reset back to false
  // whenever a fresh learning gets staged (handleAddLearning), so a later legitimate
  // stage-then-confirm cycle on this node isn't permanently blocked.
  const learningFinalizeSubmittedRef = useRef(false);

  const pendingXpValue = useRef<string>("");
  const prevStatus = useRef<string>(skill.status);
  const wasDialogOpen = useRef(false);
  
  // Add options popup state
  const [isAddOptionsOpen, setIsAddOptionsOpen] = useState(false);

  // Get available Global Skills for the current area/quest
  const availableGlobalSkills = activeAreaId 
    ? getGlobalSkillsForArea(activeAreaId)
    : activeProjectId 
      ? getGlobalSkillsForProject(activeProjectId) 
      : [];

  // Show XP animation when skill becomes mastered
  useEffect(() => {
    const justConfirmed = prevStatus.current !== "mastered" && skill.status === "mastered";
    if (justConfirmed && pendingXpValue.current) {
      setAnimatedXpValue(pendingXpValue.current);
      setShowXpAnimation(true);
      setTimeout(() => {
        setShowXpAnimation(false);
        pendingXpValue.current = "";
      }, 1500);
    }
    prevStatus.current = skill.status;
  }, [skill.status]);

  // Update ref to track dialog open/close state
  useEffect(() => {
    wasDialogOpen.current = isEditDialogOpen;
  }, [isEditDialogOpen]);

  useEffect(() => {
    const checkSubtasks = async () => {
      if (!isInicioNode) {
        try {
          const response = await fetch(`/api/skills/${skill.id}/subskills`);
          const subskills = await response.json();
          if (Array.isArray(subskills) && subskills.length > 0) {
            const hasIncomplete = subskills.some(s => s.status !== "mastered");
            setHasIncompleteSubtasks(hasIncomplete);
            setHasSubskillTree(true);
          } else {
            setHasIncompleteSubtasks(false);
            setHasSubskillTree(false);
          }
        } catch {
          setHasIncompleteSubtasks(false);
          setHasSubskillTree(false);
        }
      }
    };
    checkSubtasks();
  }, [skill.id, skill.status, activeParentSkillId]);

  const hasUnlockedWithIncompleteSubtasks = !isLocked && !isMastered && hasIncompleteSubtasks;
  // The node has its own sub-skill tree and every node in it is mastered.
  const hasCompletedSubskillTree = hasSubskillTree && !hasIncompleteSubtasks;
  // While the node's own subskills are still incomplete, the node itself must not pulse
  // (it can't be confirmed yet) -- instead the title that leads into the subskill tree
  // pulses, pointing the player there. Once the subskills are all mastered, this flips:
  // the node pulses like any other available node and the title goes still.
  const shouldPulseNode = skill.status === "available" && !hasUnlockedWithIncompleteSubtasks;
  const shouldPulseTitle = hasUnlockedWithIncompleteSubtasks;

  const createThought = useMutation({
    mutationFn: async (data: { title: string; sentence: string; skillId: string }) => {
      const res = await fetch("/api/journal/thoughts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        console.error("Failed to create thought:", error);
        throw new Error(error.message || "Failed to create thought");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal/thoughts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/journal/thoughts", skill.id] });
    },
    onError: (error) => {
      console.error("createThought error:", error);
    },
  });

  const createLearning = useMutation({
    mutationFn: async (data: { title: string; sentence: string; skillId: string }) => {
      const res = await fetch("/api/journal/learnings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        console.error("Failed to create learning:", error);
        throw new Error(error.message || "Failed to create learning");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal/learnings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/journal/learnings", skill.id] });
    },
    onError: (error) => {
      console.error("createLearning error:", error);
    },
  });

  const createTool = useMutation({
    mutationFn: async (data: { title: string; sentence: string; skillId: string }) => {
      const res = await fetch("/api/journal/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        console.error("Failed to create tool:", error);
        throw new Error(error.message || "Failed to create tool");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal/tools"] });
      queryClient.invalidateQueries({ queryKey: ["/api/journal/tools", skill.id] });
    },
    onError: (error) => {
      console.error("createTool error:", error);
    },
  });

  const deleteThought = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/journal/thoughts/${id}`, {
        method: "DELETE",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal/thoughts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/journal/thoughts", skill.id] });
    },
  });

  const deleteLearning = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/journal/learnings/${id}`, {
        method: "DELETE",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal/learnings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/journal/learnings", skill.id] });
    },
  });

  const deleteTool = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/journal/tools/${id}`, {
        method: "DELETE",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal/tools"] });
      queryClient.invalidateQueries({ queryKey: ["/api/journal/tools", skill.id] });
    },
  });

  const handleAddThought = async () => {
    console.log("[handleAddThought] Called", {
      thoughtTitle: thoughtTitle.trim(),
      thoughtSentence: thoughtSentence.trim(),
      skillId: skill.id,
    });
    
    if (!thoughtTitle.trim()) {
      console.log("[handleAddThought] Title is empty, returning");
      return;
    }

    // Evita que un doble click (o un submit repetido antes de que resuelva el anterior) lea el
    // mismo countBefore dos veces -- el segundo pop-up mostraría "de más" en vez de encadenar.
    if (createThought.isPending) {
      return;
    }

    const payload = {
      title: thoughtTitle.trim(),
      sentence: thoughtSentence.trim(),
      skillId: skill.id
    };
    console.log("[handleAddThought] Calling mutation with:", payload);

    try {
      const countBefore = await getJournalEntryCount("thoughts");
      await createThought.mutateAsync(payload);
      setThoughtTitle("");
      setThoughtSentence("");
      showInsightsCounterPopup({ type: "thought", countBefore, countAfter: countBefore + 1 });
    } catch {
      // Mutation error is already handled by the mutation's onError callback.
    }
  };

  // Always creates the learning right away -- used by the node long-press Journal's own
  // "New Learning" button (step 2): that entry point registers immediately, it never stages.
  const handleAddLearningNow = async () => {
    console.log("[handleAddLearningNow] Called", {
      learningTitle: learningTitle.trim(),
      learningSentence: learningSentence.trim(),
      skillId: skill.id,
    });

    if (!learningTitle.trim()) {
      console.log("[handleAddLearningNow] Title is empty, returning");
      return;
    }

    if (createLearning.isPending) {
      return;
    }

    const payload = {
      title: learningTitle.trim(),
      sentence: learningSentence.trim(),
      skillId: skill.id
    };
    console.log("[handleAddLearningNow] Calling mutation with:", payload);

    try {
      const countBefore = await getJournalEntryCount("learnings");
      await createLearning.mutateAsync(payload);
      setLearningTitle("");
      setLearningSentence("");
      showInsightsCounterPopup({ type: "learning", countBefore, countAfter: countBefore + 1 });
    } catch {
      // Mutation error is already handled by the mutation's onError callback.
    }
  };

  // Step 3 (title long-press) only: stages the learning until the node gets confirmed (see
  // runConfirmSequence), so it's not saved to the server nor counted in the Quest Diary until
  // then. Replaces any previously staged draft -- only one learning can be in flight per node
  // at a time. Falls back to registering right away (same as handleAddLearningNow) once the
  // node is already mastered, since there's no future confirm left to hook into.
  const handleAddLearning = async () => {
    if (!learningTitle.trim()) {
      return;
    }

    if (skill.status === "available") {
      setPendingLearning({ title: learningTitle.trim(), sentence: learningSentence.trim() });
      // Fresh draft staged -- a previous "Confirmar" submission (if any) is no longer the
      // relevant one, so re-arm the finalize dialog for this new draft.
      learningFinalizeSubmittedRef.current = false;
      setLearningTitle("");
      setLearningSentence("");
      return;
    }

    await handleAddLearningNow();
  };

  const handleAddTool = async () => {
    console.log("[handleAddTool] Called", {
      toolTitle: toolTitle.trim(),
      toolSentence: toolSentence.trim(),
      skillId: skill.id,
    });

    if (!toolTitle.trim()) {
      console.log("[handleAddTool] Title is empty, returning");
      return;
    }

    // Same staging as handleAddLearning above, but tools accumulate as a list instead of
    // replacing -- a node can reasonably pick up more than one tool before being confirmed.
    if (skill.status === "available") {
      setPendingTools((prev) => [...prev, { title: toolTitle.trim(), sentence: toolSentence.trim() }]);
      setToolTitle("");
      setToolSentence("");
      return;
    }

    if (createTool.isPending) {
      return;
    }

    const payload = {
      title: toolTitle.trim(),
      sentence: toolSentence.trim(),
      skillId: skill.id
    };
    console.log("[handleAddTool] Calling mutation with:", payload);

    try {
      const countBefore = await getJournalEntryCount("tools");
      await createTool.mutateAsync(payload);
      setToolTitle("");
      setToolSentence("");
      showInsightsCounterPopup({ type: "tool", countBefore, countAfter: countBefore + 1 });
    } catch {
      // Mutation error is already handled by the mutation's onError callback.
    }
  };

  // Core XP-gain logic, shared by the Journal tab's immediate "+ Experience" button and by
  // runConfirmSequence (which runs it later, once the node is actually confirmed). `showPopup`
  // lets callers stagger the XP celebration pop-up against other pop-ups firing in the same
  // batch; when omitted it fires immediately, matching the old inline behavior.
  const applyExperienceGain = async (skillId: string, showPopup: (fn: () => void) => void = (fn) => fn()) => {
    console.log("[applyExperienceGain] Called", { skillId });

    const xpToAdd = FIXED_XP_AMOUNT;
    console.log("[applyExperienceGain] XP to add:", xpToAdd, "SkillId:", skillId);

    const buildSnapshot = (
      skillName: string,
      xpBefore: number,
      level: number,
      xpMax: number | null
    ): ExperienceGainSnapshot => ({
      skillName,
      areaColor,
      xpBefore,
      xpAfter: xpBefore + xpToAdd,
      xpMax,
      level,
      celebrateLevelUp: true,
    });

    // Check if it's a legacy skill
    if (skillId.startsWith("legacy:")) {
      const legacySkillName = skillId.replace("legacy:", "");
      console.log("[applyExperienceGain] Adding XP to legacy skill:", legacySkillName);

      const skillsProgress = localStorage.getItem("skillsProgress");
      let skills: Record<string, { name: string; currentXp: number; level: number }> = {};

      if (skillsProgress) {
        try {
          skills = JSON.parse(skillsProgress);
        } catch (error) {
          console.error("[applyExperienceGain] Error parsing skillsProgress:", error);
        }
      }

      // Initialize if skill doesn't exist
      if (!skills[legacySkillName]) {
        skills[legacySkillName] = { name: legacySkillName, currentXp: 0, level: 1 };
      }

      const legacySnapshot = buildSnapshot(
        legacySkillName,
        skills[legacySkillName].currentXp,
        skills[legacySkillName].level,
        500
      );

      const xpPerLevel = 500;
      skills[legacySkillName].currentXp += xpToAdd;
      skills[legacySkillName].level = Math.floor(skills[legacySkillName].currentXp / xpPerLevel) + 1;
      localStorage.setItem("skillsProgress", JSON.stringify(skills));

      // Save to server
      try {
        await fetch("/api/skills-progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            skillName: legacySkillName,
            currentXp: skills[legacySkillName].currentXp,
            level: skills[legacySkillName].level
          })
        });
      } catch (error) {
        console.error('[applyExperienceGain] Error saving to server:', error);
      }

      window.dispatchEvent(new CustomEvent('skillXpAdded', {
        detail: { skillName: legacySkillName, currentXp: skills[legacySkillName].currentXp }
      }));

      setXpValue(FIXED_XP_AMOUNT.toString());
      showPopup(() => {
        hideBodyGainPopup(); // evita solaparse con el pop-up de fuerza/flexibilidad
        showXpPopup(legacySnapshot);
      });
      return;
    }

    // GlobalSkill flow -- looked up against the full globalSkills list (not just
    // availableGlobalSkills) since "Otra área" lets skillId belong to a different area/quest
    // than the one currently active.
    const currentSkill = globalSkills.find(s => s.id === skillId);
    const globalSnapshot = buildSnapshot(
      currentSkill?.name || skillId,
      currentSkill?.currentXp || 0,
      currentSkill?.level || 1,
      currentSkill?.goalXp && currentSkill.goalXp > 0 ? currentSkill.goalXp : null
    );

    try {
      // Use the GlobalSkills API to add XP (with cascade to parent)
      const updatedSkill = await addXpToGlobalSkill(skillId, xpToAdd);

      if (updatedSkill) {
        console.log("[applyExperienceGain] Updated skill via API:", updatedSkill);

        // Dispatch event to update UI (for compatibility)
        window.dispatchEvent(new CustomEvent('skillXpAdded', {
          detail: { skillId: skillId, currentXp: updatedSkill.currentXp, level: updatedSkill.level }
        }));

        // Clear inputs and show feedback -- solo el pop-up del XP propio del skill (la barra que
        // llega a 100% en el tab de skills del diary/quest). Agregar experiencia a un skill ya
        // no toca la barra de nivel del área/quest: esa sube únicamente al completar nodos del
        // skill tree de ese nivel.
        setXpValue(FIXED_XP_AMOUNT.toString());
        showPopup(() => {
          hideBodyGainPopup(); // evita solaparse con el pop-up de fuerza/flexibilidad
          showXpPopup(globalSnapshot);
        });
      }
    } catch (error) {
      console.error("[applyExperienceGain] Error adding XP:", error);
    }
  };

  // Shared by every place that shows a picked skill id as text (legacy skills are prefixed
  // "legacy:", global skills are looked up by id against the full globalSkills list).
  const skillDisplayName = (id: string): string =>
    id.startsWith("legacy:") ? id.replace("legacy:", "") : (globalSkills.find(s => s.id === id)?.name || "Skill");

  const handleAddExperience = async () => {
    if (experienceSelectedSkills.length === 0) return;
    for (const id of experienceSelectedSkills) {
      await applyExperienceGain(id);
      // Lets each skill's celebration pop-up (and a possible level-up banner) finish before the
      // next one's is shown, instead of stacking them all at once.
      while (getPopupBusyDelay() > 0) {
        await new Promise((resolve) => setTimeout(resolve, getPopupBusyDelay() + 150));
      }
    }
    setExperienceSelectedSkills([]);
  };

  // Core fuerza/flex-gain logic, shared by the Journal tab's immediate "Agregar fuerza" button
  // and by runConfirmSequence. One block is added per chosen zone; `showPopup` lets callers
  // stagger each zone's celebration pop-up (defaults to the original immediate + 1800ms-apart
  // behavior when omitted).
  const applyBodyGain = (
    dimension: BodyDimension,
    zones: BodyZone[],
    showPopup: (fn: () => void) => void = (() => {
      let index = 0;
      return (fn: () => void) => {
        if (index === 0) fn();
        else setTimeout(fn, index * 1800);
        index += 1;
      };
    })()
  ) => {
    if (zones.length === 0) return;

    zones.forEach((zone) => {
      const { before, after } = addBodyBlock(zone, dimension);
      showPopup(() => showBodyGainPopup({ zone, dimension, before, after }));
    });
  };

  const handleAddBody = () => {
    if (selectedBodyZones.length === 0) return;
    hideXpPopup(); // evita solaparse con el pop-up de XP si sigue visible
    applyBodyGain(selectedBodyDimension, selectedBodyZones);
    setSelectedBodyZones([]);
  };

  // Whatever was picked in Step 3 (xp/fuerza/poderes/aprendizaje) of the title-long-press edit
  // dialog, or staged from the node long-press Journal's Learnings/Tools tabs, is only a
  // preview until this runs -- it fires once, right when the node itself gets confirmed
  // (available -> mastered), and is what actually creates the learning/tools, grants the
  // XP/body progress/power, and shows their celebration pop-ups (see runConfirmSequence below).
  const hasPendingRewards = pendingXpSkillIds.length > 0 || pendingBodyZones.length > 0 || !!pendingPowerId || !!pendingLearning || pendingTools.length > 0;
  // Human-readable labels for the pending-rewards subtitle shown under the node title.
  const pendingXpSkillNames = pendingXpSkillIds.map(skillDisplayName);
  const pendingPowerName = pendingSelectedPower?.name ?? null;

  interface ConfirmRewardBlock {
    label: string;
    run: (enqueue: (fn: () => void) => void) => Promise<void> | void;
  }

  // Runs the full "node confirmed" reward sequence: each staged reward is granted one at a
  // time -- its own preview line flies away, its celebration pop-up(s) show, then the next.
  // `learningOverride` carries whatever was just edited in the "Terminar aprendizaje" dialog
  // (title/description can differ from what was originally staged in the Journal/Step 3), and
  // is used instead of the raw staged draft when present.
  const runConfirmSequence = async (learningOverride?: { title: string; sentence: string }) => {
    // Opens the popup chain FIRST, synchronously, before anything else below (including the
    // busy-wait right after) -- confirmNode calls onClick() then this in the same tick, so this
    // runs synchronously right alongside skill-context.tsx's own synchronous busy-gate claim for
    // the area/quest "progress bar filling up" pop-up. Anything that reacts to node-confirmation
    // asynchronously elsewhere (the today-progress pop-up, "Quest updated!", the final-node
    // "¡Subiste de nivel!" banner) checks hasPendingPopupChain() and knows from this very first
    // instant that it has to wait its turn, instead of only finding out once this function
    // actually gets around to processing a reward block -- which used to leave a small gap
    // (between the area pop-up's placeholder busy claim expiring and this chain opening) where
    // those could race ahead and show before the reward sequence even started.
    beginPopupChain();

    // The node confirm itself (the onClick() call in confirmNode, which runs just before this)
    // may already be showing the area/quest "progress bar filling up" pop-up -- see the
    // synchronous markPopupActive + beginPopupChain claim in skill-context.tsx. That one always
    // has to play first, so if it's busy right now, wait for it to clear before doing anything
    // else here (its own matching endPopupChain is what lets this busy-wait resolve). Re-checks
    // on every wake-up instead of computing the wait once: the placeholder busy claimed at click
    // time is just a stand-in for "the PATCH round-trip hasn't resolved yet" -- once the área
    // pop-up actually fires (after that PATCH resolves), it re-marks busy for its own real
    // POPUP_VISIBLE_MS, which is longer than what was left of the original placeholder. A
    // one-shot wait computed up front would miss that extension and let the reward sequence
    // below start while the área pop-up is still on screen.
    while (getPopupBusyDelay() > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, getPopupBusyDelay() + 150));
    }

    // Snapshot + clear every staged reward up front -- the preview row below the title
    // disappears immediately, the moment its state is cleared.
    const learning = learningOverride ?? pendingLearning;
    const tools = pendingTools;
    const xpSkillIds = pendingXpSkillIds;
    const bodyDimension = pendingBodyDimension;
    const bodyZones = pendingBodyZones;
    const powerId = pendingPowerId;
    setPendingLearning(null);
    setPendingTools([]);
    setPendingXpSkillIds([]);
    setPendingBodyZones([]);
    setPendingPowerId(null);

    // Same order the preview lines are rendered below the title (learning, tools, xp, body,
    // power) -- that's also the order the celebration pop-ups play in.
    const blocks: ConfirmRewardBlock[] = [];

    if (learning) {
      blocks.push({
        label: `+Aprendizaje: ${learning.title}`,
        run: async (enqueue) => {
          const countBefore = await getJournalEntryCount("learnings");
          await createLearning.mutateAsync({ title: learning.title, sentence: learning.sentence, skillId: skill.id });
          enqueue(() => showInsightsCounterPopup({ type: "learning", countBefore, countAfter: countBefore + 1 }));
        },
      });
    }

    if (tools.length > 0) {
      blocks.push({
        label: `+${tools.length} tool${tools.length > 1 ? "s" : ""}`,
        run: async (enqueue) => {
          for (const tool of tools) {
            const countBefore = await getJournalEntryCount("tools");
            await createTool.mutateAsync({ title: tool.title, sentence: tool.sentence, skillId: skill.id });
            enqueue(() => showInsightsCounterPopup({ type: "tool", countBefore, countAfter: countBefore + 1 }));
          }
        },
      });
    }

    // One block per staged skill -- each gets the full XP amount and its own celebration pop-up.
    for (const xpSkillId of xpSkillIds) {
      blocks.push({
        label: `+${FIXED_XP_AMOUNT}xp ${skillDisplayName(xpSkillId)}`,
        run: (enqueue) => applyExperienceGain(xpSkillId, enqueue),
      });
    }

    if (bodyZones.length > 0) {
      blocks.push({
        label: `+${bodyDimension === "fuerza" ? "Fuerza" : "Flexibilidad"}`,
        run: (enqueue) => { applyBodyGain(bodyDimension, bodyZones, enqueue); },
      });
    }

    if (powerId) {
      const power = sourcePowers.find((p) => p.id === powerId) || null;
      if (power) {
        blocks.push({
          label: `+${power.name}`,
          run: (enqueue) => applyPowerAction(power, enqueue),
        });
      }
    }

    if (blocks.length === 0) {
      endPopupChain();
      return;
    }

    // Each block's own preview row (below the title) disappears the instant its underlying
    // pending state is cleared above; this just runs the block's actual mutation/API call and
    // shows its celebration pop-up(s) right after. Wrapped in try/finally so a failed mutation
    // (e.g. a dropped request while creating the learning) can't leave the popup chain stuck
    // open forever -- which would otherwise silently block "Quest updated!"/the area pop-up/the
    // level-up banner for every confirm from then on.
    try {
      for (const block of blocks) {
        try {
          const tasks: Array<() => void> = [];
          await block.run((fn) => tasks.push(fn));
          await runPopupQueueAsync(tasks);
        } catch (error) {
          console.error("[runConfirmSequence] Reward block failed:", block.label, error);
        }
        // Re-checks on every wake-up instead of computing the wait once -- a block that just
        // finished can still have something trailing behind it that extends busy AFTER this is
        // first computed (e.g. an xp block that leveled up the skill: ExperienceGainPopup only
        // hands off to the full-screen "¡Subiste de nivel!" celebration -- re-marking busy for
        // its own POPUP_VISIBLE_MS -- near the end of its own bar animation, well after
        // runPopupQueueAsync above already resolved). A one-shot wait computed right after that
        // resolves would miss that extension and let the next block (e.g. fuerza/flexibilidad)
        // start while the level-up celebration is still on screen.
        while (getPopupBusyDelay() > 0) {
          await new Promise((resolve) => setTimeout(resolve, getPopupBusyDelay() + 150));
        }
      }
    } finally {
      endPopupChain();
    }
  };

  const handleTitleLongPressStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.stopPropagation();
    isTitleLongPress.current = false;
    titleLongPressTimer.current = setTimeout(() => {
      isTitleLongPress.current = true;
      setEditTitle(skill.title);
      const descParts = (skill.description || "").split("\n\nWhen: ");
      setEditAction(descParts[0] || "");
      setEditPlannedDate(skill.plannedDate || "");
      setShowCustomCalendar(false);
      setPendingCustomDate(false);
      setEditPlannedDuration(skill.plannedDuration ?? null);
      setShowCustomDurationInput(false);
      setPendingCustomDuration(false);
      setCustomDurationInputValue("");
      setEditFeedback(skill.feedback || "");
      setXpValue(FIXED_XP_AMOUNT.toString());
      // First node of level (levelPosition === 1) starts at step 2 (background/date),
      // skipping the name+time step -- it's auto-named and can't be renamed.
      const initialStep = skill.levelPosition === 1 ? 1 : 0;
      setEditStep(initialStep);
      setIsEditDialogOpen(true);
    }, 500);
  };
  
  const handleXpConfirm = () => {
    setAnimatedXpValue(FIXED_XP_AMOUNT.toString());
    setIsEditDialogOpen(false);
    setShowXpAnimation(true);
    setTimeout(() => setShowXpAnimation(false), 1500);
  };

  const handleTitleLongPressEnd = () => {
    if (titleLongPressTimer.current) {
      clearTimeout(titleLongPressTimer.current);
      titleLongPressTimer.current = null;
    }
  };

  const handleTitleClick = async (e: React.MouseEvent) => {
    if (isTitleLongPress.current) {
      e.preventDefault();
      e.stopPropagation();
      isTitleLongPress.current = false;
      return;
    }
    // Locked nodes (including not-yet-reached future/staged nodes) must not be
    // interactable here: without this, tapping a locked node's title could open the
    // "add a subtask tree?" prompt and attach real (locked-by-default) subskills to it,
    // leaving it permanently flagged as "has incomplete subtasks" even once it becomes
    // genuinely available later.
    if (isLocked) {
      showLockedFeedback("Completá el nodo desbloqueado primero");
      return;
    }
    if (!isSubSkillView && !isInicioNode) {
      e.stopPropagation();
      try {
        const response = await fetch(`/api/skills/${skill.id}/subskills`);
        const subskills = await response.json();
        if (subskills && subskills.length > 0) {
          enterSubSkillTree(skill.id, skill.title);
        } else {
          setIsSubtaskConfirmOpen(true);
        }
      } catch {
        setIsSubtaskConfirmOpen(true);
      }
    }
  };

  const handleConfirmSubtasks = () => {
    setIsSubtaskConfirmOpen(false);
    enterSubSkillTree(skill.id, skill.title);
  };

  const handleDeclineSubtasks = () => {
    setIsSubtaskConfirmOpen(false);
  };

  const handleLevelLongPressStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.stopPropagation();
    levelLongPressTimer.current = setTimeout(() => {
      setEditSubtitle(currentSubtitle);
      setEditSubtitleDescription(currentSubtitleDescription);
      setIsSubtitleDialogOpen(true);
    }, 500);
  };

  const handleLevelLongPressEnd = () => {
    if (levelLongPressTimer.current) {
      clearTimeout(levelLongPressTimer.current);
      levelLongPressTimer.current = null;
    }
  };

  const handleSubtitleSave = () => {
    if (isProject) {
      updateProjectLevelSubtitle(activeId, skill.level, editSubtitle, editSubtitleDescription);
    } else {
      updateLevelSubtitle(activeId, skill.level, editSubtitle, editSubtitleDescription);
    }
    setIsSubtitleDialogOpen(false);
  };

  const handleFeedbackOpen = () => {
    setEditFeedback(skill.feedback || "");
    setIsOpen(false);
    setIsFeedbackDialogOpen(true);
  };

  const handleFeedbackSave = () => {
    if (isSubSkillView) {
      updateSubSkill(skill.id, { feedback: editFeedback });
    } else if (isProject) {
      updateProjectSkill(activeId, skill.id, { feedback: editFeedback });
    } else {
      updateSkill(activeId, skill.id, { feedback: editFeedback });
    }
    setIsFeedbackDialogOpen(false);
  };

  const handleEditSave = async () => {
    // Prepare data first
    const combinedDescription = editAction;

    const xpNumber = FIXED_XP_AMOUNT;
    
    // Add XP to each selected skill (before mutations)
    for (const experienceSelectedSkill of experienceSelectedSkills) {
      const xpToAdd = FIXED_XP_AMOUNT;

      // Check if it's a legacy skill
      if (experienceSelectedSkill.startsWith("legacy:")) {
        const legacySkillName = experienceSelectedSkill.replace("legacy:", "");
        const skillsProgress = localStorage.getItem("skillsProgress");
        let skills: Record<string, { name: string; currentXp: number; level: number }> = {};
        
        if (skillsProgress) {
          try {
            skills = JSON.parse(skillsProgress);
          } catch (error) {
            console.error("[handleEditSave] Error parsing skillsProgress:", error);
          }
        }
        
        if (!skills[legacySkillName]) {
          skills[legacySkillName] = { name: legacySkillName, currentXp: 0, level: 1 };
        }
        
        const xpPerLevel = 500;
        const oldLevel = skills[legacySkillName].level;
        skills[legacySkillName].currentXp += xpToAdd;
        skills[legacySkillName].level = Math.floor(skills[legacySkillName].currentXp / xpPerLevel) + 1;

        if (skills[legacySkillName].level > oldLevel) {
          showLevelUpCelebration({ name: legacySkillName, level: skills[legacySkillName].level });
        }

        localStorage.setItem("skillsProgress", JSON.stringify(skills));
        
        try {
          await fetch("/api/skills-progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              skillName: legacySkillName,
              currentXp: skills[legacySkillName].currentXp,
              level: skills[legacySkillName].level
            })
          });
        } catch (error) {
          console.error('[handleEditSave] Error saving to server:', error);
        }
        
        window.dispatchEvent(new CustomEvent('skillXpAdded', { 
          detail: { skillName: legacySkillName, currentXp: skills[legacySkillName].currentXp }
        }));
      } else {
        // GlobalSkill flow (looked up against the full globalSkills list -- see applyExperienceGain)
        const currentSkill = globalSkills.find(s => s.id === experienceSelectedSkill);
        const oldLevel = currentSkill?.level || 1;
        
        try {
          const updatedSkill = await addXpToGlobalSkill(experienceSelectedSkill, xpToAdd);

          if (updatedSkill && updatedSkill.level > oldLevel) {
            showLevelUpCelebration({
              name: currentSkill?.name || "Skill",
              level: updatedSkill.level,
            });
          }

          window.dispatchEvent(new CustomEvent('skillXpAdded', {
            detail: { skillId: experienceSelectedSkill, currentXp: updatedSkill?.currentXp, level: updatedSkill?.level }
          }));
        } catch (error) {
          console.error('[handleEditSave] Error adding XP:', error);
        }
      }
    }

    // Call mutations immediately (autosave without closing dialog)
    if (editTitle.trim() || editAction.trim()) {
      if (isSubSkillView) {
        updateSubSkill(skill.id, {
          title: editTitle,
          description: combinedDescription,
          feedback: editFeedback,
          experiencePoints: xpNumber,
          plannedDate: editPlannedDate || null,
          plannedDuration: editPlannedDuration
        });
      } else if (isProject) {
        updateProjectSkill(activeId, skill.id, {
          title: editTitle,
          description: combinedDescription,
          feedback: editFeedback,
          experiencePoints: xpNumber,
          plannedDate: editPlannedDate || null,
          plannedDuration: editPlannedDuration
        });
      } else {
        updateSkill(activeId, skill.id, {
          title: editTitle,
          description: combinedDescription,
          feedback: editFeedback,
          experiencePoints: xpNumber,
          plannedDate: editPlannedDate || null,
          plannedDuration: editPlannedDuration
        });
      }
      
      // Create journal learning entry when XP is added
      if (experienceSelectedSkills.length > 0 && xpNumber > 0) {
        // Build the sentence from action and feedback
        const parts = [];
        if (editAction.trim()) parts.push(editAction.trim());
        if (editFeedback.trim()) parts.push(editFeedback.trim());
        const sentence = parts.length > 0 ? parts.join(" - ") : `${xpNumber} XP agregado`;

        const learningEntry = {
          title: `${editTitle || skill.title} (+${xpNumber} XP en ${experienceSelectedSkills.join(", ")})`,
          sentence: sentence,
          skillId: skill.id,
        };
        createLearning.mutate(learningEntry);
      }
    }
  };

  // Autosave effect with debounce for step 1 and 2 fields
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isEditDialogOpen && (editTitle !== skill.title || editAction !== skill.description?.split("\n\nWhen: ")[0] || editPlannedDate !== (skill.plannedDate || "") || editPlannedDuration !== (skill.plannedDuration ?? null))) {
        const combinedDescription = editAction;

        // Autosave without closing dialog
        if (isSubSkillView) {
          updateSubSkill(skill.id, {
            title: editTitle,
            description: combinedDescription,
            plannedDate: editPlannedDate || null,
            plannedDuration: editPlannedDuration
          });
        } else if (isProject) {
          updateProjectSkill(activeId, skill.id, {
            title: editTitle,
            description: combinedDescription,
            plannedDate: editPlannedDate || null,
            plannedDuration: editPlannedDuration
          });
        } else {
          updateSkill(activeId, skill.id, {
            title: editTitle,
            description: combinedDescription,
            plannedDate: editPlannedDate || null,
            plannedDuration: editPlannedDuration
          });
        }
      }
    }, 1500); // Save after user stops typing for 1.5 seconds

    return () => clearTimeout(timer);
  }, [editTitle, editAction, editPlannedDate, editPlannedDuration, isEditDialogOpen, skill.id, skill.title, skill.description, skill.plannedDate, skill.plannedDuration, isSubSkillView, isProject, activeId, updateSubSkill, updateProjectSkill, updateSkill]);

  const handleTouchStart = () => {
    if (isInicioNode) return; // "inicio" nodes are not interactive
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setIsOpen(true);
    }, 1500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // Actually confirms the node (calls the parent's onClick, which flips available -> mastered
  // in skill-context.tsx), running the staged-rewards sequence first if there's anything to
  // grant. `learningOverride` is threaded straight through to runConfirmSequence -- see there.
  const confirmNode = (learningOverride?: { title: string; sentence: string }) => {
    // onClick() first: it's what runs skill-context.tsx's toggleSkillStatus, which -- for a
    // regular confirm -- synchronously claims the busy-gate for the area/quest "progress bar
    // filling up" pop-up before returning here. runConfirmSequence checks that busy-gate as
    // its very first step, so calling onClick() before it is what guarantees that pop-up
    // always gets to play first, ahead of our own staged-reward sequence.
    onClick();
    if (hasPendingRewards) {
      runConfirmSequence(learningOverride);
    }
  };

  const handleLearningFinalizeConfirm = () => {
    const finalTitle = finalizeLearningTitle.trim() || pendingLearning?.title || "";
    const finalSentence = finalizeLearningSentence.trim();
    // Mark this draft as already submitted right away -- confirmNode() below kicks off an
    // async PATCH (+ the popup-chain busy-wait in runConfirmSequence) before skill.status and
    // pendingLearning actually update, so without this an impatient second tap on the node in
    // that window would see the same stale "available" + pendingLearning and reopen this same
    // dialog (see handleClick).
    learningFinalizeSubmittedRef.current = true;
    setIsLearningFinalizeOpen(false);
    confirmNode({ title: finalTitle, sentence: finalSentence });
  };

  const handleLearningFinalizeCancel = () => {
    // Just closes the dialog -- the node stays "available" and the staged learning stays
    // staged, so the player can pick this up again later without losing the draft.
    setIsLearningFinalizeOpen(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isInicioNode) return; // "inicio" nodes are not interactive
    if (skill.isAutoComplete === 1 || skill.levelPosition === 1) return; // Node 1 is not clickable
    if (isLongPress.current) {
      e.preventDefault();
      e.stopPropagation();
      isLongPress.current = false;
      return;
    }
    
    // Debounce: prevent multiple onClick invocations within 100ms
    // This prevents duplicate fires from touch/mouse event synthesis
    const now = Date.now();
    if (now - lastClickTime.current < 100) {
      console.log(`[SkillNode] onClick debounced (${now - lastClickTime.current}ms since last click)`);
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    lastClickTime.current = now;
    
    // Allow unlocking manually locked nodes by clicking.
    // Gate on the node still being "locked": a node can carry a stale manualLock=1
    // flag (leftover from when it was created as a future/staged placeholder) even
    // after its status has genuinely become "available" for real play. Without the
    // status check here, the first click on such a node would re-lock it instead of
    // confirming it, requiring lock -> unlock -> confirm across three clicks.
    if (skill.manualLock === 1 && skill.status === "locked") {
      if (isSubSkillView) {
        toggleSubSkillLock(skill.id);
      } else if (isProject) {
        toggleProjectLock(activeId, skill.id);
      } else {
        toggleLock(activeId, skill.id);
      }
      return;
    }
    if (isLocked) {
      // Locked nodes cannot be clicked - only unlock when the previous node is mastered
      showLockedFeedback("Completá el nodo desbloqueado primero");
      return;
    }
    if (hasUnlockedWithIncompleteSubtasks) {
      // This node is available, but it can't be confirmed straight from its circle while
      // it still has subskills pending -- those have to be resolved from its subskill tree
      // (via the title) first.
      showLockedFeedback("Entrá al árbol de subskill primero");
      return;
    }

    console.log(`[SkillNode] onClick triggered for skill "${skill.title}" (id: ${skill.id})`);
    // This click is what confirms the node (available -> mastered). If there's a learning
    // staged for this node, finish writing it (title/description) in the "Terminar
    // aprendizaje" dialog before actually confirming -- see the Dialog below and
    // handleLearningFinalizeConfirm. Otherwise confirm right away, granting whatever else
    // (XP/fuerza/poder/tools) was staged in Step 3 / the Journal.
    if (skill.status === "available" && pendingLearning && !learningFinalizeSubmittedRef.current) {
      setFinalizeLearningTitle(pendingLearning.title);
      setFinalizeLearningSentence(pendingLearning.sentence);
      setIsLearningFinalizeOpen(true);
      return;
    }
    confirmNode();
  };

  const handleMouseDown = () => {
    if (isInicioNode) return; // "inicio" nodes are not interactive
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setIsOpen(true);
    }, 1500);
  };

  const handleMouseUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setIsOpen(false);
      setPopoverStep(0); // Reset to menu step when closing
      isLongPress.current = false;
    }
  };

  return (
    <>
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverAnchor asChild>
        <div
          className={cn(
            "absolute -translate-x-1/2 -translate-y-1/2 z-20 touch-none select-none",
            isInicioNode ? "cursor-default" : "cursor-pointer"
          )}
          style={{ left: `${skill.x}%`, top: `${skill.y}px` }}
          data-skill-id={skill.id}
          onClick={handleClick}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          {...(isOnboardingTarget ? { "data-onboarding": "skill-node" } : {})}
        >
          {/* Level Marker */}
          {isFirstOfLevel && (
            <div
              className="absolute right-14 top-1/2 -translate-y-1/2 w-max text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-2xl border border-border cursor-pointer select-none"
              style={{
                // This badge sits to the LEFT of the node, growing further left as its
                // content gets wider — but it lives inside the node's own tiny (~40px)
                // absolutely-positioned wrapper, which is NOT the same width as the
                // screen. A viewport-percent or fixed max-width can't "know" how close
                // the node is to the left edge of the screen, so on a node positioned
                // near the left (or on narrow phones like the iPhone XR) the badge can
                // grow past x=0 and get clipped by the canvas's scroll container.
                // skill.x is the node's own horizontal position (0-100, i.e. vw-ish)
                // in the canvas, so we derive a max-width straight from it: the space
                // between the screen's left edge and the node, minus the 56px gap
                // (right-14) and a 24px safety margin, is guaranteed to fit.
                maxWidth: `clamp(80px, calc(${skill.x}vw - 80px), 380px)`,
              }}
              onTouchStart={handleLevelLongPressStart}
              onTouchEnd={handleLevelLongPressEnd}
              onTouchCancel={handleLevelLongPressEnd}
              onMouseDown={handleLevelLongPressStart}
              onMouseUp={handleLevelLongPressEnd}
              onMouseLeave={handleLevelLongPressEnd}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="whitespace-nowrap text-xs font-semibold">{`Level ${skill.level}`}</div>
              {showCompletedLevelSubtitle && (
                <div className="whitespace-normal break-words leading-snug font-normal italic tracking-wide text-muted-foreground/80 text-[9px] sm:text-[10px] md:text-[11px]">
                  {trimmedLevelSubtitle}
                </div>
              )}
            </div>
          )}

          {/* Node Circle */}
          <motion.div
            initial={{
              scale: shouldPulseNode ? 1 : (isMastered ? 1.05 : 1),
              boxShadow: shouldPulseNode ? "0 0 0px 1px rgba(255, 255, 255, 1)" : "none",
              opacity: isLocked ? lockedNodeOpacity : 1,
            }}
            animate={{
              scale: isMastered ? 1.05 : shouldPulseNode ? [1, 1.3, 1] : 1,
              boxShadow: shouldPulseNode ? [
                "0 0 0px 1px rgba(255, 255, 255, 1)",
                "0 0 0px 1.5px rgba(255, 255, 255, 1)",
                "0 0 0px 1px rgba(255, 255, 255, 1)"
              ] : "none",
              opacity: isLocked ? lockedNodeOpacity : 1,
            }}
            transition={{
              scale: shouldPulseNode ? {
                duration: 2,
                repeat: Infinity,
                repeatType: "loop"
              } : { duration: 0.3 },
              boxShadow: shouldPulseNode ? {
                duration: 2,
                repeat: Infinity,
                repeatType: "loop"
              } : { duration: 0 },
              opacity: { duration: 0.3 }
            }}
            className={cn(
              "w-10 h-10 rounded-full border-2 flex items-center justify-center relative",
              // Locked nodes: border/text saturation stays constant: distance from the
              // active node (via lockedNodeOpacity above) is the single source of truth
              // for how faded a locked node looks, so it can't be overridden by whether
              // the node still has its default "Nodo X" name.
              isLocked && !isLastNodeOfLevel && "bg-muted border-muted-foreground/70 text-muted-foreground/90",
              isLocked && isLastNodeOfLevel && "bg-muted border-amber-400 text-muted-foreground/90",
              // Available nodes (not locked, not mastered)
              !isLocked && !isMastered && !isLastNodeOfLevel && "bg-card border-border",
              !isLocked && !isMastered && isLastNodeOfLevel && "bg-card border-amber-400",
              // Mastered nodes - not last node of level and level not completed
              isMastered && !isLastNodeOfLevel && !isLevelCompleted && "bg-foreground border-foreground text-background shadow-sm",
              // Mastered last node of level (always orange, whether level completed or not)
              isMastered && isLastNodeOfLevel && "bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-500/30",
              // Level completed - all nodes turn orange
              isMastered && isLevelCompleted && "bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-500/30"
            )}
          >
            {hasUnlockedWithIncompleteSubtasks ? (
              <Lock size={14} className="text-white" />
            ) : isLocked ? (
              <Lock size={14} />
            ) : isMastered ? (
              <Check size={18} strokeWidth={3} />
            ) : (
              <div className="w-2.5 h-2.5 rounded-full bg-foreground" />
            )}
          </motion.div>

          {/* Locked-tap feedback: an animated speech bubble rising from the node that was
              just clicked, telling the player why nothing happened. */}
          <AnimatePresence>
            {lockedFeedback && (
              <motion.div
                className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 z-40 pointer-events-none"
                initial={{ opacity: 0, y: 6, scale: 0.5 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.6 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                <div className="relative whitespace-nowrap rounded-lg bg-foreground text-background text-xs font-medium px-3 py-1.5 shadow-lg">
                  {lockedFeedback}
                  <div className="absolute left-1/2 top-full -translate-x-1/2 w-0 h-0 border-x-[6px] border-x-transparent border-t-[6px] border-t-foreground" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Final Node Star Icon - shows on the actual final-final node as soon as it's
              marked active (isStarActive), so toggling it gives immediate visible feedback
              instead of waiting for it to be mastered. Hidden once the area/project is
              fully conquered (hasCompletionStar), since the permanent completion star below
              takes over then -- otherwise both would show at once. */}
          {isStarActive && isLastNodeOfLevel && skill.hasCompletionStar !== 1 && (
            <div className="absolute -top-1 -right-1 z-30" title={isSubSkillView ? "Nodo final del subskill" : "Nodo final del área (activo)"}>
              <Star
                size={14}
                className="fill-amber-400 text-amber-400 drop-shadow-lg"
              />
            </div>
          )}

          {/* Completion Star - permanent badge on every node once the area/project this
              node belongs to has been fully conquered (its star node was mastered) */}
          {skill.hasCompletionStar === 1 && (
            <div className="absolute -bottom-1 -right-1 z-30" title="Quest conquistada">
              <Star
                size={12}
                className="fill-amber-300 text-amber-500 drop-shadow-lg"
              />
            </div>
          )}

          {/* Label */}
          <div className={cn(
            "absolute left-14 top-1/2 -translate-y-1/2 font-medium transition-colors text-sm flex items-start gap-2",
            isLocked ? "text-muted-foreground" : "text-foreground",
            isMastered && "text-foreground",
            (skill.title.startsWith("Nodo ") || skill.title === "Next challenge" || skill.title === "Next objetive quest" || skill.title === "Objective quest") && "text-muted-foreground/60"
          )}>
            <div className="flex flex-col relative">
              <motion.span
                onClick={handleTitleClick}
                onTouchStart={handleTitleLongPressStart}
                onTouchEnd={handleTitleLongPressEnd}
                onTouchCancel={handleTitleLongPressEnd}
                onMouseDown={handleTitleLongPressStart}
                onMouseUp={handleTitleLongPressEnd}
                onMouseLeave={handleTitleLongPressEnd}
                animate={{ scale: shouldPulseTitle ? [1, 1.15, 1] : 1 }}
                transition={shouldPulseTitle ? {
                  duration: 1.2,
                  repeat: Infinity,
                  repeatType: "loop"
                } : { duration: 0.2 }}
                style={{ transformOrigin: "left center" }}
                className={cn(
                  "whitespace-nowrap block transition-transform duration-150",
                  !isSubSkillView && !isLocked && !isInicioNode && !shouldPulseTitle && "cursor-pointer hover:translate-y-0.5 active:translate-y-1",
                  !isInicioNode && "cursor-pointer"
                )}
                data-testid={`link-skill-title-${skill.id}`}
              >
                {skill.isAutoComplete === 1 || skill.levelPosition === 1 ? "" : skill.title}
              </motion.span>
              {/* Small day/time tags under the title when this node has a plannedDate and/or
                  plannedDuration assigned, shown side by side when both are set. Hidden once
                  the node is confirmed/mastered — they were only relevant as a reminder while
                  the node was still pending. */}
              {skill.isAutoComplete !== 1 && skill.levelPosition !== 1 && !isInicioNode && !isMastered && (plannedDateLabel || plannedDurationLabel) && (
                <div className="flex items-center gap-1 font-normal italic tracking-wide text-muted-foreground/70 text-[10px] leading-tight">
                  {plannedDateLabel && <span className="whitespace-nowrap">{plannedDateLabel}</span>}
                  {plannedDateLabel && plannedDurationLabel && <span>·</span>}
                  {plannedDurationLabel && <span className="whitespace-nowrap">{plannedDurationLabel}</span>}
                </div>
              )}
              {/* Preview of whatever was staged for this node -- a learning/tools from the
                  Journal (long-press the node), or xp/fuerza/poder/aprendizaje from Step 3 of
                  the title-long-press edit dialog. Shown the same way the planned date/time is,
                  above -- none of it is granted/saved until this node is actually confirmed
                  (see runConfirmSequence), in the same order as it's listed here. */}
              {skill.isAutoComplete !== 1 && skill.levelPosition !== 1 && !isInicioNode && !isMastered && hasPendingRewards && (
                <div className="flex items-center gap-1 flex-wrap font-normal italic tracking-wide text-muted-foreground/70 text-[10px] leading-tight">
                  {pendingLearning && (
                    <span className="whitespace-nowrap">+Aprendizaje: {pendingLearning.title}</span>
                  )}
                  {pendingTools.length > 0 && (
                    <span className="whitespace-nowrap">+{pendingTools.length} tool{pendingTools.length > 1 ? "s" : ""}</span>
                  )}
                  {pendingXpSkillNames.map((name, i) => (
                    <span key={pendingXpSkillIds[i]} className="whitespace-nowrap">+{FIXED_XP_AMOUNT}xp {name}</span>
                  ))}
                  {pendingBodyZones.length > 0 && (
                    <span className="whitespace-nowrap">
                      +{pendingBodyDimension === "fuerza" ? "Fuerza" : "Flexibilidad"}
                    </span>
                  )}
                  {pendingPowerId && (
                    <span className="whitespace-nowrap">+{pendingPowerName || "Poder"}</span>
                  )}
                </div>
              )}
              {/* Sub-skill tree completion badge: this node's own sub-skill tree is fully
                  mastered. Shown even once this node itself gets confirmed later, since it
                  stays true -- the small circle mirrors the mastered-node circle above. */}
              {!isInicioNode && !isLocked && hasCompletedSubskillTree && (
                <div className="flex items-center gap-1.5 font-normal text-muted-foreground/70 text-[10px] leading-tight">
                  <span className="w-3.5 h-3.5 rounded-full bg-foreground text-background flex items-center justify-center shrink-0">
                    <Check size={8} strokeWidth={3} />
                  </span>
                  <span>Árbol de subskills completado</span>
                </div>
              )}
            </div>
            {/* Don't show the "ready to confirm" mark alongside the incomplete-subtasks
                lock icon (hasUnlockedWithIncompleteSubtasks above) — the two signals
                contradict each other visually. */}
            {!isLocked && !isMastered && !hasIncompleteSubtasks && (
              <span className="text-2xl font-bold text-amber-400">!</span>
            )}
            {/* XP subtitle - only show when not mastered and has XP > 0 */}
            {!isMastered && typeof skill.experiencePoints === 'number' && skill.experiencePoints > 0 && (
              <div className="text-muted-foreground/70 text-center text-[0.8em]">
                +{skill.experiencePoints}xp
              </div>
            )}
          </div>

        </div>
      </PopoverAnchor>
      <PopoverContent 
        side="top" 
        collisionPadding={16} 
        className={cn(
          "border-border bg-popover/95 backdrop-blur-xl shadow-xl p-4 z-50",
          popoverStep === 0 ? "w-64" : "w-96"
        )}
      >
        {isFirstNodeOfLevel ? (
          // Node 1 of each level is always mastered and has no title; its only
          // available action is adding the next node, and only once that next
          // node is unlocked (available).
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-xs bg-muted/50 hover:bg-muted"
              disabled={!canAddFromNode}
              title={!canAddFromNode ? "Solo se puede agregar cuando el siguiente nodo está desbloqueado" : undefined}
              onClick={() => {
                if (!canAddFromNode) return;
                if (isSubSkillView) {
                  addSubSkillBelow(skill.id, "");
                } else if (isProject) {
                  addProjectSkillBelow(activeId, skill.id, "");
                } else {
                  addSkillBelow(activeId, skill.id, "");
                }
                setIsOpen(false);
              }}
              data-testid="button-add-skill-below-node1"
            >
              <Plus className="h-4 w-4 mr-1" />
              Agregar nodo debajo
            </Button>
          </div>
        ) : popoverStep === 0 ? (
          // STEP 1: Menu (current)
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              {canMoveUp() === null ? (
                <div className="h-8 w-8" />
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={canMoveUp() === false}
                  title={canMoveUp() === false ? "No puedes reordenar el Nodo 1" : "Mover arriba"}
                  onClick={() => {
                    if (isSubSkillView) {
                      moveSubSkill(skill.id, "up");
                    } else if (isProject) {
                      moveProjectSkill(activeId, skill.id, "up");
                    } else {
                      moveSkill(activeId, skill.id, "up");
                    }
                  }}
                  data-testid="button-move-up"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
              )}
              <span className="text-xs text-muted-foreground">Mover</span>
              {canMoveDown() === null ? (
                <div className="h-8 w-8" />
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={canMoveDown() === false}
                  title={canMoveDown() === false ? "No puedes reordenar el Nodo 1" : "Mover abajo"}
                  onClick={() => {
                    if (isSubSkillView) {
                      moveSubSkill(skill.id, "down");
                    } else if (isProject) {
                      moveProjectSkill(activeId, skill.id, "down");
                    } else {
                      moveSkill(activeId, skill.id, "down");
                    }
                  }}
                  data-testid="button-move-down"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
              <h4 className="font-semibold leading-none mb-1.5">{skill.title}</h4>
              {skill.description && (
                <p className="text-sm text-muted-foreground leading-relaxed break-words">
                  {skill.description}
                </p>
              )}
              {skill.feedback && (
                <div className="mt-2 pt-2 border-t border-border/50">
                  <p className="text-xs text-muted-foreground font-medium mb-1">Thoughts:</p>
                  <p className="text-sm text-foreground/80 leading-relaxed break-words italic">
                    {skill.feedback}
                  </p>
                </div>
              )}
            </div>
            
            <div className="pt-2 border-t border-border flex flex-wrap justify-between gap-2">
               <Popover open={isAddOptionsOpen} onOpenChange={setIsAddOptionsOpen}>
                 <PopoverTrigger asChild>
                   <Button 
                     variant="ghost" 
                     size="sm" 
                     className="h-8 w-8 p-0 text-xs bg-muted/50 hover:bg-muted"
                     data-testid="button-add-skill-below"
                   >
                     +
                   </Button>
                 </PopoverTrigger>
                 <PopoverContent 
                   className="w-auto p-1 border-0 bg-background/95 backdrop-blur-sm" 
                   align="center" 
                   side="top"
                   sideOffset={4}
                 >
                   <div className="flex flex-col gap-0.5">
                     <Button
                       variant="ghost"
                       size="sm"
                       className="h-7 px-3 text-xs justify-start font-normal hover:bg-muted/50"
                       disabled={!canAddFromNode}
                       title={!canAddFromNode ? "Solo se puede agregar desde el nodo confirmado anterior al desbloqueado" : undefined}
                       onClick={() => {
                         if (!canAddFromNode) return;
                         if (isSubSkillView) {
                           addSubSkillBelow(skill.id, "");
                         } else if (isProject) {
                           addProjectSkillBelow(activeId, skill.id, "");
                         } else {
                           addSkillBelow(activeId, skill.id, "");
                         }
                         setIsAddOptionsOpen(false);
                         setIsOpen(false);
                       }}
                       data-testid="button-add-new"
                     >
                       Agregar
                     </Button>
                     <Button
                       variant="ghost"
                       size="sm"
                       className="h-7 px-3 text-xs justify-start font-normal hover:bg-muted/50"
                       disabled={!canAddFromNode}
                       title={!canAddFromNode ? "Solo se puede duplicar desde el nodo confirmado anterior al desbloqueado" : undefined}
                       onClick={() => {
                         if (!canAddFromNode) return;
                         if (isSubSkillView) {
                           duplicateSubSkill(skill);
                         } else if (isProject) {
                           duplicateProjectSkill(activeId, skill);
                         } else {
                           duplicateSkill(activeId, skill);
                         }
                         setIsAddOptionsOpen(false);
                         setIsOpen(false);
                       }}
                       data-testid="button-duplicate"
                     >
                       Duplicar
                     </Button>
                   </div>
                 </PopoverContent>
               </Popover>

               {/* Star button - show for last node of level OR if star is currently active (to allow removal).
                   Sub-skill trees have no toggle: their final-final node is always active and can't be
                   deactivated (see isStarActive above), so the button is skipped entirely there. */}
               {!isSubSkillView && (isLastNodeOfLevel || isStarActive) && (
                 <Button 
                   variant="ghost"
                   size="sm" 
                   className={cn(
                     "h-8 w-8 p-0 text-xs",
                     isStarActive ? "bg-amber-500 hover:bg-amber-600 text-white" : "bg-muted/50 hover:bg-muted"
                   )}
                   onClick={() => {
                     if (isProject) {
                       toggleProjectFinalNode(activeId, skill.id);
                     } else {
                       toggleFinalNode(activeId, skill.id);
                     }
                     setIsOpen(false);
                   }}
                   data-testid="button-toggle-final"
                   title={isStarActive ? "Quitar nodo final final" : "Marcar como nodo final final"}
                 >
                   <Star className={cn("h-3 w-3", isStarActive && "fill-white")} />
                 </Button>
               )}

               {/* Delete button - deleting the last node of a level promotes the previous
                   node to final; if that node was already mastered, the context layer
                   retroactively completes the level and opens the next one. */}
               <Button
                 variant="ghost"
                 size="sm"
                 className="h-8 w-8 p-0 bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
                 onClick={() => {
                   if (isSubSkillView) {
                     deleteSubSkill(skill.id);
                   } else if (isProject) {
                     deleteProjectSkill(activeId, skill.id);
                   } else {
                     deleteSkill(activeId, skill.id);
                   }
                   setIsOpen(false);
                 }}
                 data-testid="button-delete"
               >
                 <Trash2 className="h-3 w-3" />
               </Button>

               {/* Next button to go to journal tabs step */}
               <Button 
                 variant="ghost" 
                 size="sm" 
                 className="h-8 w-8 p-0 bg-muted/50 hover:bg-muted ml-auto"
                 onClick={() => setPopoverStep(1)}
                 title="Thoughts, Learnings, Experience, Fuerza, Tools"
               >
                 <ChevronRight className="h-4 w-4" />
               </Button>
            </div>
          </div>
        ) : (
          // STEP 2: Journal Tabs (from previous Edit Dialog Step 3)
          <div className="flex flex-col h-full">
            <div className="mb-3">
              <span className="text-xs font-medium text-muted-foreground">Journal</span>
            </div>

            <Tabs value={feedbackActiveTab} onValueChange={(v) => setFeedbackActiveTab(v as "thoughts" | "tools" | "learnings" | "experience" | "body" | "powers" | "bugs")} className="w-full flex flex-col flex-1">
              <TabsList className="w-full grid grid-cols-7 bg-muted/50">
                <TabsTrigger value="thoughts" className="text-xs" data-testid="feedback-tab-thoughts">
                  <Pencil className="h-3 w-3 mr-1" />
                  Thoughts
                </TabsTrigger>
                <TabsTrigger value="learnings" className="text-xs" data-testid="feedback-tab-learnings">
                  <Lightbulb className="h-3 w-3 mr-1" />
                  Learnings
                </TabsTrigger>
                <TabsTrigger value="experience" className="text-xs" data-testid="feedback-tab-experience">
                  <span className="text-xs font-bold mr-1">XP</span>
                </TabsTrigger>
                <TabsTrigger value="body" className="text-xs" data-testid="feedback-tab-body" title="Fuerza / Flexibilidad">
                  <BicepsFlexed className="h-3 w-3" />
                </TabsTrigger>
                <TabsTrigger value="powers" className="text-xs" data-testid="feedback-tab-powers">
                  <Zap className="h-3 w-3 mr-1" />
                  Poderes
                </TabsTrigger>
                <TabsTrigger value="bugs" className="text-xs" data-testid="feedback-tab-bugs">
                  <Bug className="h-3 w-3 mr-1" />
                  Bugs
                </TabsTrigger>
                <TabsTrigger value="tools" className="text-xs" data-testid="feedback-tab-tools">
                  <Wrench className="h-3 w-3 mr-1" />
                  Tools
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="thoughts" className="mt-4 space-y-3 flex flex-col flex-1">
                <div className="flex-1">
                  <Input
                    placeholder="TITLE"
                    value={thoughtTitle}
                    onChange={(e) => setThoughtTitle(e.target.value.toUpperCase())}
                    className="uppercase border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted"
                    data-testid="input-thought-title"
                  />
                  <Textarea
                    placeholder="Descripción, notas o reflexión..."
                    value={thoughtSentence}
                    onChange={(e) => setThoughtSentence(e.target.value)}
                    rows={3}
                    className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted resize-none mt-2"
                    data-testid="input-thought-sentence"
                  />
                </div>
                <div className="flex justify-end items-center gap-2 pt-2">
                  
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={handleAddThought}
                    disabled={!thoughtTitle.trim() || createThought.isPending}
                    className="bg-muted/50 hover:bg-muted"
                    data-testid="button-new-thought"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    New Thought
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="learnings" className="mt-4 space-y-3 flex flex-col flex-1">
                <div className="flex-1">
                  <Input
                    placeholder="TITLE"
                    value={learningTitle}
                    onChange={(e) => setLearningTitle(e.target.value.toUpperCase())}
                    className="uppercase border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted"
                    data-testid="input-learning-title"
                  />
                  <Input
                    placeholder="Description"
                    value={learningSentence}
                    onChange={(e) => setLearningSentence(e.target.value)}
                    className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted mt-2"
                    data-testid="input-learning-sentence"
                  />
                </div>
                <div className="flex justify-end items-center gap-2 pt-2">
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleAddLearningNow}
                    disabled={!learningTitle.trim() || createLearning.isPending}
                    className="bg-muted/50 hover:bg-muted"
                    data-testid="button-new-learning"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    New Learning
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="experience" className="mt-4 space-y-3 flex flex-col flex-1">
                <div className="flex items-center justify-center gap-2 py-4">
                  <div className="w-24 rounded-md bg-muted/50 px-3 py-2 text-center text-lg font-bold">
                    {FIXED_XP_AMOUNT}
                  </div>
                  <span className="text-lg font-medium text-muted-foreground">xp</span>
                </div>
                <Popover open={showExperienceSkillSelector} onOpenChange={setShowExperienceSkillSelector}>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="bg-muted/50 hover:bg-muted w-full"
                      data-testid="button-select-skill"
                    >
                      {experienceSelectedSkills.length > 0
                        ? `✓ ${experienceSelectedSkills.map(skillDisplayName).join(", ")}`
                        : "Seleccionar skill(s)"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-56 p-2 border-0 bg-background/95 backdrop-blur-sm z-[9999]"
                    align="center"
                    side="top"
                    sideOffset={8}
                    collisionPadding={16}
                  >
                    <SkillPickerList
                      selectedSkillIds={experienceSelectedSkills}
                      onToggle={toggleExperienceSkill}
                      legacySkills={filteredLegacySkills}
                      scopedGlobalSkills={availableGlobalSkills}
                      areas={areas}
                      projects={projects}
                      currentAreaId={activeAreaId}
                      currentProjectId={activeProjectId}
                      getGlobalSkillsForArea={getGlobalSkillsForArea}
                      getGlobalSkillsForProject={getGlobalSkillsForProject}
                      testIdPrefix="feedback"
                    />
                  </PopoverContent>
                </Popover>
                <div className="flex justify-end items-center gap-2 pt-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleAddExperience}
                    disabled={experienceSelectedSkills.length === 0}
                    className="bg-muted/50 hover:bg-muted"
                    data-testid="button-new-experience"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Experience
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="body" className="mt-4 space-y-3 flex flex-col flex-1">
                <div className="flex gap-2 justify-center">
                  {(["fuerza", "flex"] as BodyDimension[]).map((dimension) => (
                    <Button
                      key={dimension}
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedBodyDimension(dimension)}
                      className={selectedBodyDimension === dimension ? "bg-primary/20 text-foreground" : "bg-muted/50 hover:bg-muted text-muted-foreground"}
                      data-testid={`button-body-dimension-${dimension}`}
                    >
                      {dimension === "fuerza" ? "Fuerza" : "Flexibilidad"}
                    </Button>
                  ))}
                </div>
                <Popover open={showBodyZoneSelector} onOpenChange={setShowBodyZoneSelector}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="bg-muted/50 hover:bg-muted w-full"
                      data-testid="button-select-body-zone"
                    >
                      {selectedBodyZones.length > 0
                        ? `✓ ${selectedBodyZones.map((z) => BODY_ZONE_LABELS[z]).join(", ")}`
                        : "Seleccionar componente(s)"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-56 p-2 border-0 bg-background/95 backdrop-blur-sm z-[9999]"
                    align="center"
                    side="top"
                    sideOffset={8}
                    collisionPadding={16}
                  >
                    <div className="space-y-1">
                      {BODY_ZONES.map((zone) => (
                        <Button
                          key={zone}
                          variant="ghost"
                          size="sm"
                          className={`w-full justify-start h-8 px-3 text-xs font-normal ${
                            selectedBodyZones.includes(zone) ? "bg-muted text-foreground" : "hover:bg-muted/50"
                          }`}
                          onClick={() => toggleBodyZone(zone)}
                          data-testid={`button-select-body-zone-${zone}`}
                        >
                          {selectedBodyZones.includes(zone) ? "✓ " : ""}
                          {BODY_ZONE_LABELS[zone]}
                        </Button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
                <div className="flex justify-end items-center gap-2 pt-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleAddBody}
                    disabled={selectedBodyZones.length === 0}
                    className="bg-muted/50 hover:bg-muted"
                    data-testid="button-add-body"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Agregar {selectedBodyDimension === "fuerza" ? "fuerza" : "flexibilidad"}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="powers" className="mt-4 space-y-3 flex flex-col flex-1">
                <div className="flex-1 space-y-3">
                  {sourcePowers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay poderes disponibles para este contexto todavía.</p>
                  ) : (
                    <>
                      <div className="space-y-2">
                        {sourcePowers.map((power) => {
                          const isSelected = selectedPowerId === power.id;
                          return (
                            <button
                              key={power.id}
                              type="button"
                              onClick={() => setSelectedPowerId(power.id)}
                              className={cn(
                                "w-full rounded-lg border p-3 text-left transition-colors",
                                isSelected ? "border-primary/50 bg-primary/10" : "border-border/60 bg-muted/40 hover:bg-muted/60"
                              )}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium">{power.name}</p>
                                  {power.description && (
                                    <p className="mt-1 text-xs text-muted-foreground break-words">{power.description}</p>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {selectedPower && (
                        <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Poder seleccionado</p>
                          <p className="mt-1 text-sm font-medium">{selectedPower.name}</p>
                          {selectedPower.description && (
                            <p className="mt-1 text-sm text-muted-foreground">{selectedPower.description}</p>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="flex justify-end items-center gap-2 pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handlePowerAction}
                    disabled={!selectedPower || selectedPower.isUnlocked === 2}
                    className="bg-muted/50 hover:bg-muted"
                    data-testid="button-power-action"
                  >
                    {selectedPower?.isUnlocked === 0 ? "Desbloquear" : selectedPower?.isUnlocked === 1 ? "Dominar" : "Dominado"}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="bugs" className="mt-4 space-y-3 flex flex-col flex-1">
                <div className="flex-1 space-y-3">
                  {sourceBugs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay bugs registrados para este contexto todavía.</p>
                  ) : (
                    <>
                      <div className="space-y-2">
                        {sourceBugs.map((bug) => {
                          const isSelected = selectedBugId === bug.id;
                          return (
                            <button
                              key={bug.id}
                              type="button"
                              onClick={() => setSelectedBugId(bug.id)}
                              className={cn(
                                "w-full rounded-lg border p-3 text-left transition-colors",
                                isSelected ? "border-primary/50 bg-primary/10" : "border-border/60 bg-muted/40 hover:bg-muted/60"
                              )}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-medium truncate">{bug.nombre}</p>
                                <span className={`h-2 w-2 shrink-0 rounded-full ${bugStatusColor[bug.status]}`} />
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {selectedBug && (
                        <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium">{selectedBug.nombre}</p>
                            <span className="text-[11px] px-2 py-0.5 rounded border uppercase tracking-wide text-muted-foreground">
                              {bugStatusLabel[selectedBug.status]}
                            </span>
                          </div>
                          {selectedBug.desc && (
                            <p className="text-sm text-muted-foreground">{selectedBug.desc}</p>
                          )}
                          <div>
                            <div className="flex items-center justify-end mb-1">
                              <p className="text-[11px] text-muted-foreground">{bugProgressCount} / 5</p>
                            </div>
                            <div className="w-full h-2.5 flex gap-0.5">
                              {Array.from({ length: 5 }).map((_, index) => (
                                <div
                                  key={index}
                                  className={`flex-1 h-full rounded-sm transition-colors duration-300 ${
                                    index < bugProgressCount ? "bg-emerald-500" : "bg-muted"
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="tools" className="mt-4 space-y-3 flex flex-col flex-1">
                <div className="flex-1">
                  <Input
                    placeholder="TITLE"
                    value={toolTitle}
                    onChange={(e) => setToolTitle(e.target.value.toUpperCase())}
                    className="uppercase border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted"
                    data-testid="input-tool-title"
                  />
                  <Input
                    placeholder="Description"
                    value={toolSentence}
                    onChange={(e) => setToolSentence(e.target.value)}
                    className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted mt-2"
                    data-testid="input-tool-sentence"
                  />
                </div>
                <div className="flex justify-end items-center gap-2 pt-2">
                  
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={handleAddTool}
                    disabled={!toolTitle.trim() || createTool.isPending}
                    className="bg-muted/50 hover:bg-muted"
                    data-testid="button-new-tool"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    New Tool
                  </Button>
                </div>
              </TabsContent>
            </Tabs>

            <div className="mt-auto pt-4">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setPopoverStep(0)}
                className="h-8 w-8"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>

    <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
      if (!open) {
        // Autosave when closing modal
        if (editTitle.trim() || editAction.trim()) {
          const combinedDescription = editAction;

          if (isSubSkillView) {
            updateSubSkill(skill.id, {
              title: editTitle,
              description: combinedDescription,
              feedback: editFeedback,
              plannedDate: editPlannedDate || null,
              plannedDuration: editPlannedDuration
            });
          } else if (isProject) {
            updateProjectSkill(activeId, skill.id, {
              title: editTitle,
              description: combinedDescription,
              feedback: editFeedback,
              plannedDate: editPlannedDate || null,
              plannedDuration: editPlannedDuration
            });
          } else {
            updateSkill(activeId, skill.id, {
              title: editTitle,
              description: combinedDescription,
              feedback: editFeedback,
              plannedDate: editPlannedDate || null,
              plannedDuration: editPlannedDuration
            });
          }
        }
        setEditStep(0);
      }
      setIsEditDialogOpen(open);
    }}>
      <DialogContent className="sm:max-w-[400px] border-0 shadow-2xl max-h-[90vh] overflow-y-auto minimal-scrollbar">
        <DialogTitle className="sr-only">{skill.title}</DialogTitle>
        <DialogDescription className="sr-only">Edit skill details</DialogDescription>
        <div className="min-h-[180px] flex flex-col">
          <AnimatePresence mode="wait">
            {editStep === 0 && skill.levelPosition !== 1 && (
              <motion.div
                key="step-name"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex-1 flex flex-col gap-4"
              >
                <div>
                  <Label htmlFor="edit-title" className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">PASO 1: Nombre y tiempo</Label>
                  <Input
                    id="edit-title"
                    value={editTitle}
                    onChange={(e) => {
                      setEditTitle(clampToWordLimit(e.target.value, getNodeTitleWordLimit()));
                    }}
                    placeholder="Name your move..."
                    className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted text-lg"
                    data-testid="input-edit-title"
                    autoFocus
                  />
                </div>
                <div>
                  <Label htmlFor="edit-duration" className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">Time</Label>
                  {(() => {
                    const matchedDurationOption = editPlannedDuration != null
                      ? QUICK_DURATION_OPTIONS.find((opt) => opt.value === editPlannedDuration)
                      : undefined;
                    // Mirrors pendingCustomDate's role in the date Select below.
                    const durationSelectValue = pendingCustomDuration
                      ? CUSTOM_DURATION_VALUE
                      : editPlannedDuration != null
                        ? (matchedDurationOption ? matchedDurationOption.id : CUSTOM_DURATION_VALUE)
                        : "";
                    const durationTriggerLabel = pendingCustomDuration
                      ? "Seleccionar"
                      : matchedDurationOption
                        ? matchedDurationOption.label
                        : editPlannedDuration != null
                          ? `${editPlannedDuration} min`
                          : null;

                    // Deselects the given quick option (or the custom duration), clearing the
                    // planned duration entirely. Also closes the dropdown ourselves, since we
                    // preempt Radix's own select-and-close handling for this case below.
                    const deselectDurationOption = (id: string) => {
                      suppressDurationOptionClickRef.current = id;
                      setEditPlannedDuration(null);
                      setPendingCustomDuration(false);
                      setShowCustomDurationInput(false);
                      setIsDurationSelectOpen(false);
                    };

                    return (
                      <Popover open={showCustomDurationInput} onOpenChange={setShowCustomDurationInput}>
                        <PopoverAnchor asChild>
                          <div>
                            <Select
                              open={isDurationSelectOpen}
                              onOpenChange={setIsDurationSelectOpen}
                              value={durationSelectValue}
                              onValueChange={(value) => {
                                if (value === CUSTOM_DURATION_VALUE) {
                                  setPendingCustomDuration(true);
                                  setCustomDurationInputValue(editPlannedDuration != null ? String(editPlannedDuration) : "");
                                  setShowCustomDurationInput(true);
                                } else {
                                  const chosen = QUICK_DURATION_OPTIONS.find((opt) => opt.id === value);
                                  if (chosen) setEditPlannedDuration(chosen.value);
                                  setPendingCustomDuration(false);
                                  setShowCustomDurationInput(false);
                                }
                              }}
                            >
                              <SelectTrigger id="edit-duration" className="border-0 bg-muted/50 focus:ring-0" data-testid="input-edit-duration">
                                <span className={durationTriggerLabel ? "" : "text-muted-foreground"}>
                                  {durationTriggerLabel || "Elegir..."}
                                </span>
                              </SelectTrigger>
                              <SelectContent className="border-0 minimal-scrollbar">
                                {QUICK_DURATION_OPTIONS.map((opt) => (
                                  <SelectItem
                                    key={opt.id}
                                    value={opt.id}
                                    // Mouse selection resolves on pointerup; intercept it there
                                    // (before Radix's own handleSelect runs in the same event)
                                    // so we can block it and deselect instead.
                                    onPointerUp={(e) => {
                                      if (durationSelectValue === opt.id) {
                                        e.preventDefault();
                                        deselectDurationOption(opt.id);
                                      }
                                    }}
                                    // Touch selection resolves on the click that follows pointerup;
                                    // swallow it if this item is the one we just deselected above.
                                    onClick={(e) => {
                                      if (suppressDurationOptionClickRef.current === opt.id) {
                                        e.preventDefault();
                                        suppressDurationOptionClickRef.current = null;
                                      }
                                    }}
                                  >
                                    {opt.label}
                                  </SelectItem>
                                ))}
                                <SelectItem
                                  value={CUSTOM_DURATION_VALUE}
                                  onPointerUp={(e) => {
                                    if (durationSelectValue === CUSTOM_DURATION_VALUE) {
                                      e.preventDefault();
                                      deselectDurationOption(CUSTOM_DURATION_VALUE);
                                    }
                                  }}
                                  onClick={(e) => {
                                    if (suppressDurationOptionClickRef.current === CUSTOM_DURATION_VALUE) {
                                      e.preventDefault();
                                      suppressDurationOptionClickRef.current = null;
                                    }
                                  }}
                                >
                                  Seleccionar
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </PopoverAnchor>
                        <PopoverContent
                          className="w-56 p-3"
                          align="start"
                          onOpenAutoFocus={(e) => e.preventDefault()}
                          onFocusOutside={(e) => e.preventDefault()}
                          onPointerDownOutside={(e) => {
                            // Same reasoning as the date calendar's guard above: the Select's
                            // trigger lives outside this popover's own content, so closing it
                            // must not be misread as an "outside" click that dismisses us first.
                            const target = e.target as HTMLElement;
                            if (target.closest('[id="edit-duration"]')) {
                              e.preventDefault();
                            }
                          }}
                        >
                          <div className="flex flex-col gap-2">
                            <Label htmlFor="custom-duration-input" className="text-xs text-muted-foreground">Minutos</Label>
                            <Input
                              id="custom-duration-input"
                              type="number"
                              min={1}
                              value={customDurationInputValue}
                              onChange={(e) => setCustomDurationInputValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  const parsed = parseInt(customDurationInputValue, 10);
                                  if (!Number.isNaN(parsed) && parsed > 0) {
                                    setEditPlannedDuration(parsed);
                                    setPendingCustomDuration(false);
                                    setShowCustomDurationInput(false);
                                  }
                                }
                              }}
                              placeholder="Minutos"
                              className="border-0 bg-muted/50 focus-visible:ring-0"
                              autoFocus
                            />
                            <Button
                              size="sm"
                              onClick={() => {
                                const parsed = parseInt(customDurationInputValue, 10);
                                if (!Number.isNaN(parsed) && parsed > 0) {
                                  setEditPlannedDuration(parsed);
                                  setPendingCustomDuration(false);
                                  setShowCustomDurationInput(false);
                                }
                              }}
                            >
                              Confirmar
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    );
                  })()}
                </div>
                <div className="flex justify-end mt-auto pt-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditStep(1)}
                    className="h-10 w-10 bg-muted/50 hover:bg-muted"
                    data-testid="button-next-step"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
              </motion.div>
            )}

            {editStep === 1 && (
              <motion.div
                key="step-action"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex-1 flex flex-col gap-4"
              >
                <div>
                  <Label htmlFor="edit-action" className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">PASO 2: Background</Label>
                  <Textarea
                    id="edit-action"
                    value={editAction}
                    onChange={(e) => setEditAction(e.target.value)}
                    placeholder="Describe your next action..."
                    rows={2}
                    className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted resize-none"
                    data-testid="input-edit-action"
                    autoFocus
                  />
                </div>
                <div>
                  <Label htmlFor="edit-when" className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">When exactly?</Label>
                  {(() => {
                    const quickOptions = getQuickDateOptions();
                    // Find which quick option (if any) matches the currently saved date, so
                    // the Select can show it as selected.
                    const matchedOption = editPlannedDate
                      ? quickOptions.find((opt) => opt.value === editPlannedDate)
                      : undefined;
                    // While pendingCustomDate is true, force the Select to show "Elegir fecha"
                    // as selected immediately (instead of waiting for editPlannedDate to
                    // change), so its controlled value never mismatches what was just clicked.
                    const selectValue = pendingCustomDate
                      ? CUSTOM_DATE_VALUE
                      : editPlannedDate
                        ? (matchedOption ? matchedOption.id : CUSTOM_DATE_VALUE)
                        : "";
                    // Rendered fully by hand instead of via <SelectValue> children, which only
                    // shows the *matched item's own* label — it can't display an arbitrary date
                    // that doesn't correspond to any SelectItem.
                    const triggerLabel = pendingCustomDate
                      ? "Elegir fecha"
                      : matchedOption
                        ? matchedOption.label
                        : editPlannedDate
                          ? new Date(editPlannedDate + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
                          : null;

                    // Deselects the given quick option (or the custom date), clearing the
                    // planned date entirely. Also closes the dropdown ourselves, since we
                    // preempt Radix's own select-and-close handling for this case below.
                    const deselectWhenOption = (id: string) => {
                      suppressWhenOptionClickRef.current = id;
                      setEditPlannedDate("");
                      setPendingCustomDate(false);
                      setShowCustomCalendar(false);
                      setIsWhenSelectOpen(false);
                    };

                    return (
                      <Popover open={showCustomCalendar} onOpenChange={setShowCustomCalendar}>
                        <PopoverAnchor asChild>
                          <div>
                            <Select
                              open={isWhenSelectOpen}
                              onOpenChange={setIsWhenSelectOpen}
                              value={selectValue}
                              onValueChange={(value) => {
                                if (value === CUSTOM_DATE_VALUE) {
                                  setPendingCustomDate(true);
                                  setShowCustomCalendar(true);
                                } else {
                                  const chosen = quickOptions.find((opt) => opt.id === value);
                                  if (chosen) setEditPlannedDate(chosen.value);
                                  setPendingCustomDate(false);
                                  setShowCustomCalendar(false);
                                }
                              }}
                            >
                              <SelectTrigger id="edit-when" className="border-0 bg-muted/50 focus:ring-0" data-testid="input-edit-when">
                                <span className={triggerLabel ? "" : "text-muted-foreground"}>
                                  {triggerLabel || "Elegir..."}
                                </span>
                              </SelectTrigger>
                              <SelectContent className="border-0 minimal-scrollbar">
                                {quickOptions.map((opt) => (
                                  <SelectItem
                                    key={opt.id}
                                    value={opt.id}
                                    // Mouse selection resolves on pointerup; intercept it there
                                    // (before Radix's own handleSelect runs in the same event)
                                    // so we can block it and deselect instead.
                                    onPointerUp={(e) => {
                                      if (selectValue === opt.id) {
                                        e.preventDefault();
                                        deselectWhenOption(opt.id);
                                      }
                                    }}
                                    // Touch selection resolves on the click that follows pointerup;
                                    // swallow it if this item is the one we just deselected above.
                                    onClick={(e) => {
                                      if (suppressWhenOptionClickRef.current === opt.id) {
                                        e.preventDefault();
                                        suppressWhenOptionClickRef.current = null;
                                      }
                                    }}
                                  >
                                    {opt.label}
                                  </SelectItem>
                                ))}
                                <SelectItem
                                  value={CUSTOM_DATE_VALUE}
                                  onPointerUp={(e) => {
                                    if (selectValue === CUSTOM_DATE_VALUE) {
                                      e.preventDefault();
                                      deselectWhenOption(CUSTOM_DATE_VALUE);
                                    }
                                  }}
                                  onClick={(e) => {
                                    if (suppressWhenOptionClickRef.current === CUSTOM_DATE_VALUE) {
                                      e.preventDefault();
                                      suppressWhenOptionClickRef.current = null;
                                    }
                                  }}
                                >
                                  Elegir fecha
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </PopoverAnchor>
                        <PopoverContent
                          className="w-auto max-h-[70vh] overflow-y-auto minimal-scrollbar p-0"
                          align="start"
                          onOpenAutoFocus={(e) => e.preventDefault()}
                          onFocusOutside={(e) => e.preventDefault()}
                          onPointerDownOutside={(e) => {
                            // The Select's own trigger/content live inside the anchor, not inside
                            // this popover's content — closing the Select routes focus back to
                            // the trigger right as this popover mounts, and without this guard
                            // Radix reads that as an "outside" interaction and dismisses the
                            // calendar before it's ever visible.
                            const target = e.target as HTMLElement;
                            if (target.closest('[id="edit-when"]')) {
                              e.preventDefault();
                            }
                          }}
                        >
                          <Calendar
                            mode="single"
                            selected={editPlannedDate ? new Date(editPlannedDate + "T00:00:00") : undefined}
                            onSelect={(date) => {
                              if (date) {
                                setEditPlannedDate(formatLocalDate(date));
                                setPendingCustomDate(false);
                                setShowCustomCalendar(false);
                              }
                            }}
                          />
                        </PopoverContent>
                      </Popover>
                    );
                  })()}
                </div>
                <div className="flex justify-between mt-auto pt-4">
                  {skill.levelPosition !== 1 ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditStep(0)}
                      className="h-10 w-10 bg-muted/50 hover:bg-muted"
                      data-testid="button-prev-step"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                  ) : (
                    <div className="h-10 w-10" />
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditStep(2)}
                    className="h-10 w-10 bg-muted/50 hover:bg-muted"
                    data-testid="button-next-step-2"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
              </motion.div>
            )}

            {editStep === 2 && (
              <motion.div
                key="step-rewards"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex-1 flex flex-col"
              >
                <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">PASO 3: XP, Fuerza, Poderes y Aprendizaje</Label>
                <p className="text-[11px] text-muted-foreground/70 mb-2">Se sumará recién al confirmar el nodo</p>

                <Tabs value={pendingRewardsTab} onValueChange={(v) => setPendingRewardsTab(v as "experience" | "body" | "powers" | "learning")} className="w-full flex flex-col flex-1">
                  <TabsList className="w-full grid grid-cols-4 bg-muted/50">
                    <TabsTrigger value="experience" className="text-xs" data-testid="step3-tab-experience">
                      <span className="text-xs font-bold mr-1">XP</span>
                    </TabsTrigger>
                    <TabsTrigger value="body" className="text-xs" data-testid="step3-tab-body" title="Fuerza / Flexibilidad">
                      <BicepsFlexed className="h-3 w-3 mr-1" />
                      Fuerza
                    </TabsTrigger>
                    <TabsTrigger value="powers" className="text-xs" data-testid="step3-tab-powers">
                      <Zap className="h-3 w-3 mr-1" />
                      Poderes
                    </TabsTrigger>
                    <TabsTrigger value="learning" className="text-xs" data-testid="step3-tab-learning">
                      <Lightbulb className="h-3 w-3 mr-1" />
                      Aprendizaje
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="experience" className="mt-4 space-y-3 flex flex-col flex-1">
                    <div className="flex items-center justify-center gap-2 py-4">
                      <div className="w-24 rounded-md bg-muted/50 px-3 py-2 text-center text-lg font-bold">
                        {FIXED_XP_AMOUNT}
                      </div>
                      <span className="text-lg font-medium text-muted-foreground">xp</span>
                    </div>
                    <Popover open={showPendingXpSkillSelector} onOpenChange={setShowPendingXpSkillSelector}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="bg-muted/50 hover:bg-muted w-full"
                          data-testid="step3-button-select-skill"
                        >
                          {pendingXpSkillIds.length > 0
                            ? `✓ ${pendingXpSkillNames.join(", ")}`
                            : "Seleccionar skill(s)"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-56 p-2 border-0 bg-background/95 backdrop-blur-sm z-[9999]"
                        align="center"
                        side="top"
                        sideOffset={8}
                        collisionPadding={16}
                      >
                        <SkillPickerList
                          selectedSkillIds={pendingXpSkillIds}
                          onToggle={togglePendingXpSkillId}
                          legacySkills={filteredLegacySkills}
                          scopedGlobalSkills={availableGlobalSkills}
                          areas={areas}
                          projects={projects}
                          currentAreaId={activeAreaId}
                          currentProjectId={activeProjectId}
                          getGlobalSkillsForArea={getGlobalSkillsForArea}
                          getGlobalSkillsForProject={getGlobalSkillsForProject}
                          testIdPrefix="step3"
                        />
                      </PopoverContent>
                    </Popover>
                  </TabsContent>

                  <TabsContent value="body" className="mt-4 space-y-3 flex flex-col flex-1">
                    <div className="flex gap-2 justify-center">
                      {(["fuerza", "flex"] as BodyDimension[]).map((dimension) => (
                        <Button
                          key={dimension}
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setPendingBodyDimension(dimension)}
                          className={pendingBodyDimension === dimension ? "bg-primary/20 text-foreground" : "bg-muted/50 hover:bg-muted text-muted-foreground"}
                          data-testid={`step3-button-body-dimension-${dimension}`}
                        >
                          {dimension === "fuerza" ? "Fuerza" : "Flexibilidad"}
                        </Button>
                      ))}
                    </div>
                    <Popover open={showPendingBodyZoneSelector} onOpenChange={setShowPendingBodyZoneSelector}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="bg-muted/50 hover:bg-muted w-full"
                          data-testid="step3-button-select-body-zone"
                        >
                          {pendingBodyZones.length > 0
                            ? `✓ ${pendingBodyZones.map((z) => BODY_ZONE_LABELS[z]).join(", ")}`
                            : "Seleccionar componente(s)"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-56 p-2 border-0 bg-background/95 backdrop-blur-sm z-[9999]"
                        align="center"
                        side="top"
                        sideOffset={8}
                        collisionPadding={16}
                      >
                        <div className="space-y-1">
                          {BODY_ZONES.map((zone) => (
                            <Button
                              key={zone}
                              variant="ghost"
                              size="sm"
                              className={`w-full justify-start h-8 px-3 text-xs font-normal ${
                                pendingBodyZones.includes(zone) ? "bg-muted text-foreground" : "hover:bg-muted/50"
                              }`}
                              onClick={() => togglePendingBodyZone(zone)}
                              data-testid={`step3-button-select-body-zone-${zone}`}
                            >
                              {pendingBodyZones.includes(zone) ? "✓ " : ""}
                              {BODY_ZONE_LABELS[zone]}
                            </Button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </TabsContent>

                  <TabsContent value="powers" className="mt-4 space-y-3 flex flex-col flex-1">
                    <div className="flex-1 space-y-3">
                      {sourcePowers.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No hay poderes disponibles para este contexto todavía.</p>
                      ) : (
                        <>
                          <div className="space-y-2">
                            {sourcePowers.map((power) => {
                              const isSelected = pendingPowerId === power.id;
                              return (
                                <button
                                  key={power.id}
                                  type="button"
                                  onClick={() => setPendingPowerId(isSelected ? null : power.id)}
                                  className={cn(
                                    "w-full rounded-lg border p-3 text-left transition-colors",
                                    isSelected ? "border-primary/50 bg-primary/10" : "border-border/60 bg-muted/40 hover:bg-muted/60"
                                  )}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium">{power.name}</p>
                                      {power.description && (
                                        <p className="mt-1 text-xs text-muted-foreground break-words">{power.description}</p>
                                      )}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>

                          {pendingSelectedPower && (
                            <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Poder seleccionado</p>
                              <p className="mt-1 text-sm font-medium">{pendingSelectedPower.name}</p>
                              {pendingSelectedPower.description && (
                                <p className="mt-1 text-sm text-muted-foreground">{pendingSelectedPower.description}</p>
                              )}
                              <p className="mt-2 text-[11px] text-muted-foreground">
                                Al confirmar el nodo: {pendingSelectedPower.isUnlocked === 0 ? "se desbloqueará" : pendingSelectedPower.isUnlocked === 1 ? "se dominará" : "ya dominado"}
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="learning" className="mt-4 space-y-3 flex flex-col flex-1">
                    {pendingLearning && (
                      <p className="text-[11px] text-muted-foreground">
                        ✓ Aprendizaje en espera: <span className="font-medium text-foreground">{pendingLearning.title}</span>
                      </p>
                    )}
                    <div className="flex-1">
                      <Input
                        placeholder="TITLE"
                        value={learningTitle}
                        onChange={(e) => setLearningTitle(e.target.value.toUpperCase())}
                        className="uppercase border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted"
                        data-testid="step3-input-learning-title"
                      />
                      <Input
                        placeholder="Description"
                        value={learningSentence}
                        onChange={(e) => setLearningSentence(e.target.value)}
                        className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted mt-2"
                        data-testid="step3-input-learning-sentence"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground/70">
                      Queda registrado debajo del título del nodo al presionar Guardar.
                    </p>
                  </TabsContent>
                </Tabs>

                <div className="flex justify-between mt-auto pt-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditStep(1)}
                    className="h-10 w-10 bg-muted/50 hover:bg-muted"
                    data-testid="button-prev-step-3"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button
                    onClick={async () => {
                      // The Aprendizaje tab no longer has its own "add" button -- typing a
                      // title there and pressing this Guardar is what stages it (shown below
                      // the node title, same as the other Step 3 tabs).
                      if (learningTitle.trim()) {
                        await handleAddLearning();
                      }
                      setIsEditDialogOpen(false);
                    }}
                    disabled={!editTitle.trim()}
                    className="border-0"
                    data-testid="button-save-edit"
                  >
                    Guardar
                  </Button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>

    {/* Shown right before a node with a staged learning gets confirmed (see handleClick /
        confirmNode): lets the player finish writing the learning -- title and description --
        before it's actually created and shown in the growth/counter pop-up sequence. Only
        appears when there's something staged; otherwise the node confirms straight away. */}
    <Dialog open={isLearningFinalizeOpen} onOpenChange={(open) => { if (!open) handleLearningFinalizeCancel(); }}>
      <DialogContent className="sm:max-w-[400px] border-0 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">Terminar aprendizaje</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Completá la descripción y, si querés, editá el título antes de registrarlo en el Quest Diary.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">Título</Label>
            <Input
              value={finalizeLearningTitle}
              onChange={(e) => setFinalizeLearningTitle(e.target.value.toUpperCase())}
              className="uppercase border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted"
              data-testid="input-finalize-learning-title"
              autoFocus
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-1 block">Descripción</Label>
            <Textarea
              value={finalizeLearningSentence}
              onChange={(e) => setFinalizeLearningSentence(e.target.value)}
              placeholder="¿Qué aprendiste?"
              rows={4}
              className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted resize-none"
              data-testid="input-finalize-learning-sentence"
            />
          </div>
        </div>
        <DialogFooter className="flex gap-2 pt-2 sm:justify-between">
          <Button variant="ghost" onClick={handleLearningFinalizeCancel} className="flex-1 bg-muted/50 hover:bg-muted" data-testid="button-cancel-finalize-learning">
            Cancelar
          </Button>
          <Button onClick={handleLearningFinalizeConfirm} className="flex-1 border-0" data-testid="button-confirm-finalize-learning">
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={isSubtitleDialogOpen} onOpenChange={setIsSubtitleDialogOpen}>
      <DialogContent className="sm:max-w-[400px] border-0 shadow-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">Subtítulo del Nivel {skill.level}</DialogTitle>
          <DialogDescription className="sr-only">Edit level subtitle</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-subtitle" className="text-xs text-muted-foreground uppercase tracking-wide">Subtítulo</Label>
            <Input
              id="edit-subtitle"
              value={editSubtitle}
              onChange={(e) => setEditSubtitle(e.target.value)}
              placeholder="Ej: Fundamentos, Intermedio..."
              className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted"
              data-testid="input-edit-subtitle"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-subtitle-description" className="text-xs text-muted-foreground uppercase tracking-wide">Descripción</Label>
            <Textarea
              id="edit-subtitle-description"
              value={editSubtitleDescription}
              onChange={(e) => setEditSubtitleDescription(e.target.value)}
              placeholder="Describe este nivel..."
              rows={3}
              className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted resize-none"
              data-testid="input-edit-subtitle-description"
            />
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="ghost" onClick={() => setIsSubtitleDialogOpen(false)} className="flex-1 bg-muted/50 hover:bg-muted" data-testid="button-cancel-subtitle">
            Cancelar
          </Button>
          <Button onClick={handleSubtitleSave} className="flex-1 border-0" data-testid="button-save-subtitle">
            Guardar
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={isSubtaskConfirmOpen} onOpenChange={setIsSubtaskConfirmOpen}>
      <DialogContent className="sm:max-w-[350px] border-0 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">{skill.title}</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground">¿Esta tarea necesita una red de subtareas?</p>
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="ghost" onClick={handleDeclineSubtasks} className="flex-1 bg-muted/50 hover:bg-muted" data-testid="button-no-subtasks">
            No
          </Button>
          <Button onClick={handleConfirmSubtasks} className="flex-1 border-0" data-testid="button-yes-subtasks">
            Sí
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={isFeedbackDialogOpen} onOpenChange={(open) => {
      if (!open) setFeedbackActiveTab("thoughts");
      setIsFeedbackDialogOpen(open);
    }}>
      <DialogContent className="sm:max-w-[400px] border-0 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">Feedback</DialogTitle>
        </DialogHeader>
        
        <Tabs value={feedbackActiveTab} onValueChange={(v) => setFeedbackActiveTab(v as "thoughts" | "tools" | "learnings")} className="w-full">
          <TabsList className="w-full grid grid-cols-3 bg-muted/50">
            <TabsTrigger value="thoughts" className="text-xs" data-testid="feedback-tab-thoughts">
              <Pencil className="h-3 w-3 mr-1" />
              Thoughts
            </TabsTrigger>
            <TabsTrigger value="tools" className="text-xs" data-testid="feedback-tab-tools">
              <Wrench className="h-3 w-3 mr-1" />
              Tools
            </TabsTrigger>
            <TabsTrigger value="learnings" className="text-xs" data-testid="feedback-tab-learnings">
              <Lightbulb className="h-3 w-3 mr-1" />
              Learnings
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="thoughts" className="mt-4">
            <Textarea
              value={editFeedback}
              onChange={(e) => setEditFeedback(e.target.value)}
              placeholder="Notas, comentarios o retroalimentación..."
              rows={4}
              className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted resize-none"
              data-testid="input-feedback"
              autoFocus
            />
            <div className="flex gap-2 pt-4">
              <Button variant="ghost" onClick={() => setIsFeedbackDialogOpen(false)} className="flex-1 bg-muted/50 hover:bg-muted" data-testid="button-cancel-feedback">
                Cancelar
              </Button>
              <Button onClick={handleFeedbackSave} className="flex-1 border-0" data-testid="button-save-feedback">
                Guardar
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="tools" className="mt-4 space-y-3 flex flex-col">
            <div className="flex-1">
              <Input
                placeholder="TITLE"
                value={toolTitle}
                onChange={(e) => setToolTitle(e.target.value.toUpperCase())}
                className="uppercase border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted"
                data-testid="input-tool-title"
              />
              <Input
                placeholder="Description"
                value={toolSentence}
                onChange={(e) => setToolSentence(e.target.value)}
                className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted mt-2"
                data-testid="input-tool-sentence"
              />
            </div>
            <div className="flex justify-end items-center gap-2 pt-2">
              
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleAddTool}
                disabled={!toolTitle.trim() || createTool.isPending}
                className="bg-muted/50 hover:bg-muted"
                data-testid="button-new-tool"
              >
                <Plus className="h-3 w-3 mr-1" />
                New Tool
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="learnings" className="mt-4 space-y-3 flex flex-col">
            <div className="flex-1">
              <Input
                placeholder="TITLE"
                value={learningTitle}
                onChange={(e) => setLearningTitle(e.target.value.toUpperCase())}
                className="uppercase border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted"
                data-testid="input-learning-title"
              />
              <Input
                placeholder="Description"
                value={learningSentence}
                onChange={(e) => setLearningSentence(e.target.value)}
                className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted mt-2"
                data-testid="input-learning-sentence"
              />
            </div>
            <div className="flex justify-end items-center gap-2 pt-2">
              
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleAddLearning}
                disabled={!learningTitle.trim() || createLearning.isPending}
                className="bg-muted/50 hover:bg-muted"
                data-testid="button-new-learning"
              >
                <Plus className="h-3 w-3 mr-1" />
                New Learning
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>


    {/* Floating XP Animation */}
    <AnimatePresence>
      {showXpAnimation && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.span
            className="text-2xl font-bold tracking-wide text-foreground"
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            +{animatedXpValue}xp
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>

  </>
  );
}


