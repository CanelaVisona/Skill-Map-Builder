import { useState } from "react";
import { ChevronLeft, Plus, X } from "lucide-react";
import { type GlobalSkill } from "@/lib/skill-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

export interface SkillPickerListProps {
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

export function SkillPickerList({
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
        className="max-h-56 overflow-y-auto overscroll-contain touch-pan-y minimal-scrollbar"
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
        className="max-h-56 overflow-y-auto overscroll-contain touch-pan-y minimal-scrollbar"
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
      className="max-h-56 overflow-y-auto overscroll-contain touch-pan-y minimal-scrollbar"
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

// Editor chico de "lista de chips de texto" -- usado tanto para las Estrategias/Disparadores
// que ya tiene un error guardado (onAdd/onRemove pegan al servidor), como para las que se
// cargan al vuelo en el formulario de "nuevo error" (onAdd/onRemove solo tocan estado local,
// recién se mandan al crear el error).
export function ChipListInput({
  label,
  placeholder,
  items,
  draft,
  onDraftChange,
  onAdd,
  onRemove,
  addDisabled,
  testIdPrefix,
}: {
  label: string;
  placeholder: string;
  items: string[];
  draft: string;
  onDraftChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  addDisabled?: boolean;
  testIdPrefix: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground block">{label}</Label>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {items.map((item, i) => (
            <span key={i} className="inline-flex items-center gap-1 text-[11px] rounded border border-border/60 bg-muted/40 pl-2 pr-1 py-0.5">
              {item}
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="text-muted-foreground hover:text-foreground"
                data-testid={`${testIdPrefix}-remove-${i}`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <Input
          placeholder={placeholder}
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAdd(); } }}
          className="h-7 text-[11px] border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted"
          data-testid={`${testIdPrefix}-input`}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onAdd}
          disabled={!draft.trim() || addDisabled}
          className="h-7 px-2 bg-muted/50 hover:bg-muted shrink-0"
          data-testid={`${testIdPrefix}-add`}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
