import { useEffect, useState } from "react";
import { Brain, Lightbulb, AlertCircle, Target, Wrench, Zap, Star, Check, ChevronLeft, Plus } from "lucide-react";
import { type GlobalSkill } from "@/lib/skill-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SkillLinkPicker } from "@/components/SkillLinkPicker";
import { BodyLinkPicker, type BodyLink } from "@/components/BodyLinkPicker";
import { SkillPickerList, ChipListInput } from "@/components/skill-node-pickers";

// Modal de "feedback" que aparece al confirmar un nodo: después del pop-up de la barra de nivel
// del área/quest y antes de "Quest updated!" (ver confirmNode en SkillNode.tsx). Se divide en
// cubos (pensamiento, aprendizaje, herramienta, error nuevo, error existente, XP, poder); cada cubo abre su formulario por pasos y,
// al guardarlo, vuelve a los cubos. Nada se registra acá adentro: todo queda en un borrador que
// se le entrega a onFinish al apretar "Listo" (o al cerrar el modal tocando afuera), y recién
// ahí SkillNode lo guarda y muestra los pop-ups de lo que se cargó.

export interface NodeFeedbackEntry {
  title: string;
  sentence: string;
}

export interface NodeFeedbackError {
  nombre: string;
  comoSi: string;
  estrategias: string[];
  disparadores: string[];
  skillIds: string[];
  bodyLinks: BodyLink[];
}

// Movimiento sobre un error ya registrado (lo que antes era la tab "Bugs"): confirmar uno
// recién detectado, o +10p con una estrategia / -10p con un disparador. `isNew` marca que la
// estrategia/disparador se tipeó acá y hay que sumarla a la lista guardada del error.
export type NodeFeedbackErrorAction =
  | { type: "confirm"; errorId: string; errorName: string }
  | { type: "adjust"; errorId: string; errorName: string; delta: 10 | -10; value: string; isNew: boolean };

export interface NodeFeedbackExistingError {
  id: string;
  nombre: string;
  points: number;
  confirmed: 0 | 1;
  estrategias: string[];
  disparadores: string[];
}

export interface NodeFeedbackDraft {
  thoughts: NodeFeedbackEntry[];
  learnings: NodeFeedbackEntry[];
  tools: NodeFeedbackEntry[];
  errors: NodeFeedbackError[];
  errorActions: NodeFeedbackErrorAction[];
  xpSkillIds: string[];
  powerIds: string[];
}

export interface NodeFeedbackPower {
  id: string;
  name: string;
  description: string;
  isUnlocked: 0 | 1 | 2;
}

const EMPTY_DRAFT: NodeFeedbackDraft = { thoughts: [], learnings: [], tools: [], errors: [], errorActions: [], xpSkillIds: [], powerIds: [] };

export const isNodeFeedbackDraftEmpty = (draft: NodeFeedbackDraft) =>
  draft.thoughts.length === 0 &&
  draft.learnings.length === 0 &&
  draft.tools.length === 0 &&
  draft.errors.length === 0 &&
  draft.errorActions.length === 0 &&
  draft.xpSkillIds.length === 0 &&
  draft.powerIds.length === 0;

type CubeId = "thought" | "learning" | "tool" | "error" | "errorAction" | "xp" | "power";

const CUBES: Array<{ id: CubeId; label: string; icon: typeof Brain }> = [
  { id: "thought", label: "Nuevo pensamiento", icon: Brain },
  { id: "learning", label: "Nuevo aprendizaje", icon: Lightbulb },
  { id: "tool", label: "Nueva herramienta", icon: Wrench },
  { id: "error", label: "Nuevo error", icon: AlertCircle },
  { id: "errorAction", label: "Error", icon: Target },
  { id: "xp", label: "Nuevo XP", icon: Zap },
  { id: "power", label: "Nuevo poder", icon: Star },
];

interface NodeConfirmFeedbackModalProps {
  open: boolean;
  onFinish: (draft: NodeFeedbackDraft) => void;
  xpAmount: number;
  skillDisplayName: (id: string) => string;
  powers: NodeFeedbackPower[];
  errors: NodeFeedbackExistingError[];
  // Skill picker (XP) -- mismos datos que el picker del Step 3 del diálogo de edición.
  legacySkills: string[];
  scopedGlobalSkills: GlobalSkill[];
  areas: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; name: string }>;
  currentAreaId?: string;
  currentProjectId?: string;
  getGlobalSkillsForArea: (areaId: string) => GlobalSkill[];
  getGlobalSkillsForProject: (projectId: string) => GlobalSkill[];
}

export function NodeConfirmFeedbackModal({
  open,
  onFinish,
  xpAmount,
  skillDisplayName,
  powers,
  errors,
  legacySkills,
  scopedGlobalSkills,
  areas,
  projects,
  currentAreaId,
  currentProjectId,
  getGlobalSkillsForArea,
  getGlobalSkillsForProject,
}: NodeConfirmFeedbackModalProps) {
  const [draft, setDraft] = useState<NodeFeedbackDraft>(EMPTY_DRAFT);
  const [activeCube, setActiveCube] = useState<CubeId | null>(null);
  const [step, setStep] = useState(0);

  // Campos del formulario abierto (se resetean al abrir cada cubo).
  const [title, setTitle] = useState("");
  const [sentence, setSentence] = useState("");
  const [errorComoSi, setErrorComoSi] = useState("");
  const [errorEstrategias, setErrorEstrategias] = useState<string[]>([]);
  const [errorEstrategiaDraft, setErrorEstrategiaDraft] = useState("");
  const [errorDisparadores, setErrorDisparadores] = useState<string[]>([]);
  const [errorDisparadorDraft, setErrorDisparadorDraft] = useState("");
  const [errorSkillIds, setErrorSkillIds] = useState<string[]>([]);
  const [errorBodyLinks, setErrorBodyLinks] = useState<BodyLink[]>([]);
  const [xpSkillIds, setXpSkillIds] = useState<string[]>([]);
  const [powerId, setPowerId] = useState<string | null>(null);
  const [actionErrorId, setActionErrorId] = useState<string | null>(null);
  const [actionDelta, setActionDelta] = useState<10 | -10 | null>(null);
  const [actionValue, setActionValue] = useState<string | null>(null);
  const [actionNewValue, setActionNewValue] = useState("");

  // Cada apertura arranca de cero, en la vista de cubos.
  useEffect(() => {
    if (open) {
      setDraft(EMPTY_DRAFT);
      setActiveCube(null);
      setStep(0);
    }
  }, [open]);

  const openCube = (cube: CubeId) => {
    setTitle("");
    setSentence("");
    setErrorComoSi("");
    setErrorEstrategias([]);
    setErrorEstrategiaDraft("");
    setErrorDisparadores([]);
    setErrorDisparadorDraft("");
    setErrorSkillIds([]);
    setErrorBodyLinks([]);
    setXpSkillIds([]);
    setPowerId(null);
    setActionErrorId(null);
    setActionDelta(null);
    setActionValue(null);
    setActionNewValue("");
    setStep(0);
    setActiveCube(cube);
  };

  const backToCubes = () => {
    setActiveCube(null);
    setStep(0);
  };

  const finish = () => onFinish(draft);

  const cubeCount = (cube: CubeId): number => {
    switch (cube) {
      case "thought": return draft.thoughts.length;
      case "learning": return draft.learnings.length;
      case "tool": return draft.tools.length;
      case "error": return draft.errors.length;
      case "errorAction": return draft.errorActions.length;
      case "xp": return draft.xpSkillIds.length;
      case "power": return draft.powerIds.length;
    }
  };

  const addChip = (draftText: string, items: string[], setItems: (v: string[]) => void, setDraftText: (v: string) => void) => {
    const text = draftText.trim();
    if (text && !items.includes(text)) setItems([...items, text]);
    setDraftText("");
  };

  // Un chip escrito pero sin apretar "+" igual cuenta al guardar el error.
  const withPendingChip = (items: string[], draftText: string) => {
    const text = draftText.trim();
    return text && !items.includes(text) ? [...items, text] : items;
  };

  const selectablePowers = powers.filter((p) => p.isUnlocked !== 2 && !draft.powerIds.includes(p.id));
  const selectedPower = powers.find((p) => p.id === powerId) || null;

  const actionError = errors.find((e) => e.id === actionErrorId) || null;
  // Lo ya encolado en este modal cuenta para los topes -50/50 y para "ya confirmado".
  const effectiveError = (error: NodeFeedbackExistingError) => {
    const actions = draft.errorActions.filter((a) => a.errorId === error.id);
    return {
      points: error.points + actions.reduce((sum, a) => sum + (a.type === "adjust" ? a.delta : 0), 0),
      confirmed: error.confirmed === 1 || actions.some((a) => a.type === "confirm"),
    };
  };
  const actionErrorState = actionError ? effectiveError(actionError) : null;
  const actionOptions = actionError && actionDelta !== null
    ? (actionDelta === 10 ? actionError.estrategias : actionError.disparadores)
    : [];

  // "Error" sobre uno sin confirmar: elegir + confirmar (2 pasos). Confirmado: elegir, +10/-10,
  // estrategia/disparador (3 pasos).
  const stepCount = (cube: CubeId): number => {
    switch (cube) {
      case "error":
        return 4;
      case "errorAction":
        return actionErrorState && !actionErrorState.confirmed ? 2 : 3;
      default:
        return 2;
    }
  };

  const canAdvance = (): boolean => {
    if (!activeCube) return false;
    if ((activeCube === "thought" || activeCube === "learning" || activeCube === "tool" || activeCube === "error") && step === 0) {
      return !!title.trim();
    }
    if (activeCube === "xp" && step === 0) return xpSkillIds.length > 0;
    if (activeCube === "power" && step === 0) return !!selectedPower;
    if (activeCube === "errorAction") {
      if (step === 0) return !!actionError;
      if (step === 1 && actionErrorState?.confirmed) return actionDelta !== null;
      if (step === 2) return !!actionValue || !!actionNewValue.trim();
    }
    return true;
  };

  const save = () => {
    if (!activeCube) return;
    setDraft((prev) => {
      switch (activeCube) {
        case "thought":
          return { ...prev, thoughts: [...prev.thoughts, { title: title.trim(), sentence: sentence.trim() }] };
        case "learning":
          return { ...prev, learnings: [...prev.learnings, { title: title.trim(), sentence: sentence.trim() }] };
        case "tool":
          return { ...prev, tools: [...prev.tools, { title: title.trim(), sentence: sentence.trim() }] };
        case "error":
          return {
            ...prev,
            errors: [...prev.errors, {
              nombre: title.trim(),
              comoSi: errorComoSi.trim(),
              estrategias: withPendingChip(errorEstrategias, errorEstrategiaDraft),
              disparadores: withPendingChip(errorDisparadores, errorDisparadorDraft),
              skillIds: errorSkillIds,
              bodyLinks: errorBodyLinks,
            }],
          };
        case "xp":
          return { ...prev, xpSkillIds: Array.from(new Set([...prev.xpSkillIds, ...xpSkillIds])) };
        case "power":
          return powerId ? { ...prev, powerIds: [...prev.powerIds, powerId] } : prev;
        case "errorAction": {
          if (!actionError || !actionErrorState) return prev;
          if (!actionErrorState.confirmed) {
            return { ...prev, errorActions: [...prev.errorActions, { type: "confirm", errorId: actionError.id, errorName: actionError.nombre }] };
          }
          if (actionDelta === null) return prev;
          const typed = actionNewValue.trim();
          const value = typed || actionValue;
          if (!value) return prev;
          const savedOptions = actionDelta === 10 ? actionError.estrategias : actionError.disparadores;
          return {
            ...prev,
            errorActions: [...prev.errorActions, {
              type: "adjust",
              errorId: actionError.id,
              errorName: actionError.nombre,
              delta: actionDelta,
              value,
              isNew: !!typed && !savedOptions.includes(typed),
            }],
          };
        }
      }
    });
    backToCubes();
  };

  const isLastStep = activeCube !== null && step === stepCount(activeCube) - 1;

  const next = () => {
    if (!canAdvance()) return;
    if (isLastStep) save();
    else setStep((s) => s + 1);
  };

  const back = () => {
    if (step === 0) backToCubes();
    else setStep((s) => s - 1);
  };

  const activeCubeMeta = CUBES.find((c) => c.id === activeCube) || null;

  const renderForm = () => {
    switch (activeCube) {
      case "thought":
      case "learning":
      case "tool":
        return step === 0 ? (
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground uppercase tracking-wide block">Título</Label>
            <Input
              placeholder="TITLE"
              value={title}
              onChange={(e) => setTitle(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); next(); } }}
              className="uppercase border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted"
              data-testid={`confirm-feedback-${activeCube}-title`}
              autoFocus
            />
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground uppercase tracking-wide block">Descripción</Label>
            <Textarea
              placeholder={activeCube === "thought" ? "Descripción, notas o reflexión..." : "Descripción"}
              value={sentence}
              onChange={(e) => setSentence(e.target.value)}
              rows={3}
              className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted resize-none"
              data-testid={`confirm-feedback-${activeCube}-sentence`}
              autoFocus
            />
          </div>
        );

      case "error":
        if (step === 0) {
          return (
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground uppercase tracking-wide block">Nombre</Label>
              <Input
                placeholder="NOMBRE"
                value={title}
                onChange={(e) => setTitle(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); next(); } }}
                className="uppercase border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted"
                data-testid="confirm-feedback-error-name"
                autoFocus
              />
            </div>
          );
        }
        if (step === 1) {
          return (
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground uppercase tracking-wide block">¿Cómo sí?</Label>
              <Textarea
                placeholder="En vez del error, ¿cómo sería la situación que sí querés?"
                value={errorComoSi}
                onChange={(e) => setErrorComoSi(e.target.value)}
                rows={3}
                className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted resize-none"
                data-testid="confirm-feedback-error-como-si"
                autoFocus
              />
            </div>
          );
        }
        if (step === 2) {
          return (
            <div className="space-y-3">
              <ChipListInput
                label="Estrategias"
                placeholder="Nueva estrategia"
                items={errorEstrategias}
                draft={errorEstrategiaDraft}
                onDraftChange={setErrorEstrategiaDraft}
                onAdd={() => addChip(errorEstrategiaDraft, errorEstrategias, setErrorEstrategias, setErrorEstrategiaDraft)}
                onRemove={(i) => setErrorEstrategias((prev) => prev.filter((_, idx) => idx !== i))}
                testIdPrefix="confirm-feedback-error-estrategia"
              />
              <ChipListInput
                label="Disparadores"
                placeholder="Nuevo disparador"
                items={errorDisparadores}
                draft={errorDisparadorDraft}
                onDraftChange={setErrorDisparadorDraft}
                onAdd={() => addChip(errorDisparadorDraft, errorDisparadores, setErrorDisparadores, setErrorDisparadorDraft)}
                onRemove={(i) => setErrorDisparadores((prev) => prev.filter((_, idx) => idx !== i))}
                testIdPrefix="confirm-feedback-error-disparador"
              />
            </div>
          );
        }
        return (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground block">Skills a linkear</Label>
              <SkillLinkPicker
                skills={scopedGlobalSkills.map((s) => ({ id: s.id, name: s.name }))}
                value={errorSkillIds}
                onChange={setErrorSkillIds}
                emptyLabel="No hay skills disponibles"
                areas={areas}
                currentAreaId={currentAreaId}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground block">Componentes a linkear</Label>
              <BodyLinkPicker value={errorBodyLinks} onChange={setErrorBodyLinks} />
              <p className="text-[10px] text-muted-foreground/70">
                Flexibilidad mental crece siempre, no hace falta linkearla. Estos, y los skills de arriba, solo suman con +10p.
              </p>
            </div>
          </div>
        );

      case "errorAction":
        if (step === 0) {
          return errors.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay errores registrados todavía. Usá "Nuevo error" para cargar uno.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto minimal-scrollbar">
              {errors.map((error) => {
                const state = effectiveError(error);
                return (
                  <button
                    key={error.id}
                    type="button"
                    onClick={() => { setActionErrorId(error.id); setActionDelta(null); setActionValue(null); setActionNewValue(""); }}
                    className={cn(
                      "w-full rounded-lg border p-3 text-left transition-colors",
                      actionErrorId === error.id ? "border-primary/50 bg-primary/10" : "border-border/60 bg-muted/40 hover:bg-muted/60"
                    )}
                    data-testid={`confirm-feedback-error-action-${error.id}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">{error.nombre}</p>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {state.confirmed ? `${Math.abs(state.points)} / 50` : "Sin confirmar"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          );
        }
        if (!actionError || !actionErrorState) return null;
        if (step === 1) {
          if (!actionErrorState.confirmed) {
            return (
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Error nuevo detectado</p>
                <p className="mt-1 text-sm font-medium">{actionError.nombre}</p>
                <p className="mt-1 text-xs text-muted-foreground">Al guardar se confirma este error.</p>
              </div>
            );
          }
          return (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium truncate">{actionError.nombre}</p>
                <p className="text-[11px] text-muted-foreground shrink-0">
                  {Math.abs(actionErrorState.points)} / 50{actionErrorState.points < 0 ? " (en contra)" : ""}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {([-10, 10] as const).map((delta) => {
                  const disabled = delta === 10 ? actionErrorState.points >= 50 : actionErrorState.points <= -50;
                  return (
                    <button
                      key={delta}
                      type="button"
                      disabled={disabled}
                      onClick={() => { setActionDelta(delta); setActionValue(null); setActionNewValue(""); }}
                      className={cn(
                        "rounded-lg border p-3 text-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                        actionDelta === delta ? "border-primary/50 bg-primary/10" : "border-border/60 bg-muted/40 hover:bg-muted/60"
                      )}
                      data-testid={`confirm-feedback-error-action-${delta > 0 ? "plus" : "minus"}`}
                    >
                      <p className="text-sm font-semibold">{delta > 0 ? "+10p" : "-10p"}</p>
                      <p className="text-[11px] text-muted-foreground">{delta > 0 ? "Usé una estrategia" : "Hubo un disparador"}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        }
        return (
          <div className="space-y-2">
            <Label className="text-[11px] text-muted-foreground uppercase tracking-wide block">
              {actionDelta === 10 ? "¿Qué estrategia usaste?" : "¿Qué lo disparó?"}
            </Label>
            {actionOptions.length > 0 && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto minimal-scrollbar">
                {actionOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => { setActionValue(option); setActionNewValue(""); }}
                    className={cn(
                      "w-full rounded-md border px-3 py-2 text-left text-sm transition-colors",
                      actionValue === option && !actionNewValue.trim() ? "border-primary/50 bg-primary/10" : "border-border/60 bg-muted/40 hover:bg-muted/60"
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <Input
                placeholder={actionDelta === 10 ? "Estrategia nueva" : "Disparador nuevo"}
                value={actionNewValue}
                onChange={(e) => setActionNewValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); next(); } }}
                className="h-8 text-sm border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted"
                data-testid="confirm-feedback-error-action-new-option"
              />
            </div>
          </div>
        );

      case "xp":
        return step === 0 ? (
          <div className="space-y-2">
            <Label className="text-[11px] text-muted-foreground uppercase tracking-wide block">Elegí el/los skill(s)</Label>
            <div className="rounded-md bg-muted/30 p-1">
              <SkillPickerList
                selectedSkillIds={xpSkillIds}
                onToggle={(id) => setXpSkillIds((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id])}
                legacySkills={legacySkills}
                scopedGlobalSkills={scopedGlobalSkills}
                areas={areas}
                projects={projects}
                currentAreaId={currentAreaId}
                currentProjectId={currentProjectId}
                getGlobalSkillsForArea={getGlobalSkillsForArea}
                getGlobalSkillsForProject={getGlobalSkillsForProject}
                testIdPrefix="confirm-feedback-xp"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 py-2">
              <div className="w-24 rounded-md bg-muted/50 px-3 py-2 text-center text-lg font-bold">{xpAmount}</div>
              <span className="text-lg font-medium text-muted-foreground">xp</span>
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Para: <span className="text-foreground">{xpSkillIds.map(skillDisplayName).join(", ")}</span>
            </p>
          </div>
        );

      case "power":
        if (step === 0) {
          return selectablePowers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay poderes disponibles para este contexto todavía.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto minimal-scrollbar">
              {selectablePowers.map((power) => (
                <button
                  key={power.id}
                  type="button"
                  onClick={() => setPowerId(power.id)}
                  className={cn(
                    "w-full rounded-lg border p-3 text-left transition-colors",
                    powerId === power.id ? "border-primary/50 bg-primary/10" : "border-border/60 bg-muted/40 hover:bg-muted/60"
                  )}
                  data-testid={`confirm-feedback-power-${power.id}`}
                >
                  <p className="text-sm font-medium">{power.name}</p>
                  {power.description && <p className="mt-1 text-xs text-muted-foreground break-words">{power.description}</p>}
                </button>
              ))}
            </div>
          );
        }
        return selectedPower ? (
          <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {selectedPower.isUnlocked === 0 ? "Desbloquear" : "Dominar"}
            </p>
            <p className="mt-1 text-sm font-medium">{selectedPower.name}</p>
            {selectedPower.description && <p className="mt-1 text-sm text-muted-foreground">{selectedPower.description}</p>}
          </div>
        ) : null;

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) finish(); }}>
      {/* Título y botones (Listo / Atrás-Siguiente) quedan fijos; solo el cuerpo scrollea, con
          barra minimalista, así "Listo" siempre está a la vista sin tener que scrollear. */}
      <DialogContent className="sm:max-w-[400px] border-0 shadow-2xl max-h-[90dvh] flex flex-col gap-3 overflow-hidden">
        <DialogTitle className="text-lg font-medium shrink-0">{activeCubeMeta ? activeCubeMeta.label : "¿Qué te dejó este nodo?"}</DialogTitle>
        <DialogDescription className="sr-only">Registrá pensamientos, aprendizajes, herramientas, errores, XP o poderes del nodo confirmado</DialogDescription>

        {activeCube === null ? (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto minimal-scrollbar -mx-1 px-1">
              <div className="grid grid-cols-4 gap-2">
                {CUBES.map(({ id, label, icon: Icon }) => {
                  const count = cubeCount(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => openCube(id)}
                      className={cn(
                        "relative aspect-square rounded-xl border flex flex-col items-center justify-center gap-1 p-1.5 text-center transition-colors",
                        count > 0 ? "border-primary/50 bg-primary/10" : "border-border/60 bg-muted/40 hover:bg-muted/70"
                      )}
                      data-testid={`confirm-feedback-cube-${id}`}
                    >
                      <Icon className="h-5 w-5 shrink-0" />
                      <span className="text-[10px] leading-tight font-medium">{label}</span>
                      {count > 0 && (
                        <span className="absolute top-1 right-1 flex items-center gap-0.5 rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
                          <Check className="h-2 w-2" />
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <Button onClick={finish} className="w-full shrink-0" data-testid="confirm-feedback-done">
              Listo
            </Button>
          </>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto minimal-scrollbar -mx-1 px-1 space-y-4">
              <p className="text-[11px] text-muted-foreground">Paso {step + 1} de {stepCount(activeCube)}</p>
              {renderForm()}
            </div>
            <div className="flex items-center justify-between gap-2 shrink-0">
              <Button variant="ghost" size="sm" onClick={back} className="bg-muted/50 hover:bg-muted" data-testid="confirm-feedback-back">
                <ChevronLeft className="h-4 w-4 mr-1" />
                {step === 0 ? "Cubos" : "Atrás"}
              </Button>
              <Button size="sm" onClick={next} disabled={!canAdvance()} data-testid="confirm-feedback-next">
                {isLastStep ? "Guardar" : "Siguiente"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
