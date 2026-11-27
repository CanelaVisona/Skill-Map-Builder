import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, ChevronRight, Lightbulb, BookOpen, EyeOff, Eye, Plus, Trash2, ImagePlus, X } from "lucide-react";
import {
  ACTIVITIES,
  COMPREHENSION_LABELS,
  HELP_LEVELS,
  INDICATOR_LABELS,
  clampLevel,
  completeSession,
  createSession,
  getConceptPoints,
  getLearningState,
  getMastery,
  hintForLevel,
  isEarlyPhase,
  newId,
  pointsToFields,
  recommendFromComprehension,
  recommendFromRecallChecks,
  saveIncompleteSession,
  type ActivityType,
  type Comprehension,
  type ConceptPoint,
  type ConceptPracticeLike,
  type ConceptSession,
  type HelpLevel,
  type PointResult,
  type Rating,
  type Recommendation,
} from "@/lib/conceptLearning";
import {
  createAchievement,
  getAchievements,
  toggleAchievement,
  type AchievementType,
  type ConceptAchievement,
  type HelpContext,
} from "@/lib/conceptAchievements";
import { ConceptAchievementsPanel } from "@/components/ConceptAchievementsPanel";

// Sesión de repaso de una "Repetición de conceptos": la capa de CÓMO repasar (recuperación
// activa adaptativa) encima del CUÁNDO de la repetición espaciada. El intervalo se registra
// recién al tocar "Guardar repaso" (onDone); si se cierra antes, la sesión se guarda como
// incompleta (onPersist) sin registrar el intervalo. El algoritmo vive en lib/conceptLearning.

type Step =
  | "comprehension"
  | "reread"
  | "after_reread"
  | "review_parts"
  | "check_points"
  | "check_develop"
  | "activity"
  | "compare"
  | "result";

type Editing = { kind: "point"; id: string } | { kind: "new" } | { kind: "answer" } | null;

export interface ConceptRecallPractice extends ConceptPracticeLike {
  conceptAchievements?: unknown;
  id: string;
  name: string;
  emoji?: string;
}

const COMPREHENSION_OPTIONS: { value: Comprehension; emoji: string; label: string }[] = [
  { value: "understood", emoji: "😊", label: "Sí, la comprendo y puedo explicarla con mis palabras" },
  { value: "partial", emoji: "🤔", label: "Más o menos: comprendo la idea, pero necesito revisar algunas partes" },
  { value: "not_understood", emoji: "📖", label: "No, necesito releer el concepto" },
];

const AFTER_ACTIVITY_OPTIONS: { value: Comprehension; emoji: string; label: string }[] = [
  { value: "understood", emoji: "😊", label: "Ahora comprendo la idea general" },
  { value: "partial", emoji: "🤔", label: "Comprendo mejor, pero todavía tengo dudas" },
  { value: "not_understood", emoji: "📖", label: "Todavía no comprendo la idea general" },
];

const POINT_RESULT_OPTIONS: { value: PointResult; label: string; cls: string }[] = [
  { value: "remembered", label: "Lo recordé", cls: "border-green-500/60 bg-green-500/15 text-green-700 dark:text-green-400" },
  { value: "hinted", label: "Con pista", cls: "border-amber-500/60 bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  { value: "forgotten", label: "Se me olvidó", cls: "border-sky-500/60 bg-sky-500/15 text-sky-700 dark:text-sky-400" },
];

const RATING_OPTIONS: { value: Rating; label: string }[] = [
  { value: "yes", label: "Sí" },
  { value: "partial", label: "En parte" },
  { value: "no", label: "Todavía no" },
];

function formatDate(date: string | null): string {
  if (!date) return "";
  const [y, m, d] = date.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
}

// Mantener apretado para editar. Devuelve también `consumed()` para que el click que sigue al
// soltar no dispare la acción normal (p.ej. revelar la pista).
function useHold(onHold: () => void, ms = 600) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);
  const start = () => {
    fired.current = false;
    timer.current = setTimeout(() => {
      fired.current = true;
      onHold();
    }, ms);
  };
  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  return {
    handlers: {
      onMouseDown: start,
      onMouseUp: clear,
      onMouseLeave: clear,
      onTouchStart: start,
      onTouchEnd: clear,
      onTouchMove: clear,
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    },
    consumed: () => {
      const f = fired.current;
      fired.current = false;
      return f;
    },
  };
}

// Achica la imagen antes de guardarla como data URL (se guarda dentro del concepto).
async function compressImage(file: File, maxSide = 640): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.75);
}

export function ConceptRecallSession({
  open,
  practice,
  nextReviewDate,
  onCancel,
  onPersist,
  onDone,
}: {
  open: boolean;
  practice: ConceptRecallPractice | null | undefined;
  // Fecha del próximo repaso según la repetición espaciada si se registra hoy (null = último intervalo).
  nextReviewDate: string | null;
  onCancel: () => void;
  // Guarda campos del concepto sin registrar el intervalo (ediciones, sesión incompleta).
  onPersist: (fields: Record<string, unknown>) => Promise<void> | void;
  // Registra el intervalo y guarda la sesión.
  onDone: (answer: string, fields: Record<string, unknown>) => Promise<void> | void;
}) {
  const learning = useMemo(() => (practice ? getLearningState(practice) : null), [practice]);
  const [points, setPoints] = useState<ConceptPoint[]>([]);
  const [modelAnswer, setModelAnswer] = useState("");
  const [session, setSession] = useState<ConceptSession | null>(null);
  const [step, setStep] = useState<Step>("comprehension");
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [mode, setMode] = useState<"hints" | "free">("hints");
  const [level, setLevel] = useState<HelpLevel>(2);
  const [revealed, setRevealed] = useState<string[]>([]);
  const [hintsHidden, setHintsHidden] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const [expandedDoubts, setExpandedDoubts] = useState<string[]>([]);
  const [rereadNote, setRereadNote] = useState("");
  const [nextOverride, setNextOverride] = useState<Partial<Recommendation> | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [saving, setSaving] = useState(false);
  // Logros (capa independiente): TODOS los del concepto, de esta y de sesiones anteriores.
  const [achievements, setAchievements] = useState<ConceptAchievement[]>([]);
  const [achievementSave, setAchievementSave] = useState<"idle" | "saving" | "saved" | "error">("idle");
  // Los guardados se encadenan para que un toque rápido no pise al anterior.
  const achievementQueue = useRef<Promise<void>>(Promise.resolve());
  const early = practice ? isEarlyPhase(practice) : false;

  // Reinicia la sesión cada vez que se abre (no cuando cambia la práctica por una edición).
  useEffect(() => {
    if (!open || !practice || !learning) return;
    setPoints(getConceptPoints(practice));
    setModelAnswer(practice.conceptModelAnswer ?? "");
    setSession(createSession(learning, new Date().toISOString()));
    setStep("comprehension");
    setRec(null);
    setMode("hints");
    setLevel(clampLevel(Math.min(learning.next?.helpLevel ?? learning.helpLevel, 4)));
    setRevealed([]);
    setHintsHidden(false);
    setShowFull(false);
    setExpandedDoubts([]);
    setRereadNote("");
    setNextOverride(null);
    setEditing(null);
    setSaving(false);
    setAchievements(getAchievements(practice));
    setAchievementSave("idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, practice?.id]);

  if (!practice || !learning || !session) return null;

  const now = () => new Date().toISOString();
  const patchSession = (patch: Partial<ConceptSession>) => setSession((s) => (s ? { ...s, ...patch } : s));
  const pointById = (id: string) => points.find((p) => p.id === id);
  const focusIds = (rec?.focusPointIds ?? learning.next?.focusPointIds ?? []).filter((id) => pointById(id));

  const recordComprehension = (c: Comprehension, source: "initial" | "after_activity" | "changed") => {
    const at = now();
    setSession((s) => {
      if (!s) return s;
      const change = { at, state: c, source, sessionNumber: s.number };
      return {
        ...s,
        initialComprehension: s.initialComprehension ?? c,
        initialComprehensionAt: s.initialComprehensionAt ?? at,
        afterComprehension: source === "initial" ? s.afterComprehension : c,
        comprehensionChanges: [...s.comprehensionChanges, change],
      };
    });
  };

  const applyRecommendation = (r: Recommendation) => {
    setRec(r);
    patchSession({ recommended: { activity: r.activity, helpLevel: r.helpLevel, reason: r.reason, at: r.at } });
  };

  // ---- Paso 1: autoevaluación de comprensión (inicial o cambiada durante la sesión) ----
  const answerComprehension = (c: Comprehension) => {
    const source = session.initialComprehension ? "changed" : "initial";
    recordComprehension(c, source);
    const r = recommendFromComprehension(learning, c, now());
    if (c === "understood") {
      setStep("check_points");
      return;
    }
    if (r) applyRecommendation(r);
    setStep(c === "not_understood" ? "reread" : "review_parts");
  };

  const answerAfterReread = (c: Comprehension) => {
    recordComprehension(c, "after_activity");
    if (c === "understood") setStep("check_points");
    else if (c === "partial") setStep("review_parts");
    else setStep("result");
  };

  // Arranca directo la actividad recomendada (sin preguntar con o sin pistas). Los 3 primeros
  // días arranca con pistas; dentro de la actividad se pueden ocultar o cambiar de nivel.
  const goActivity = (r: Recommendation) => {
    applyRecommendation(r);
    const m = early ? "hints" : r.activity === "free" ? "free" : "hints";
    const l = clampLevel(Math.min(r.helpLevel, 4));
    setMode(m);
    setLevel(l);
    startActivity(m, l, r.focusPointIds.filter((id) => pointById(id)));
  };

  const startActivity = (m: "hints" | "free" = mode, l: HelpLevel = level, focus: string[] = focusIds) => {
    const usedLevel: HelpLevel = m === "free" ? 5 : l;
    // Los puntos a reforzar arrancan con su pista visible; en los 3 primeros días también el primero.
    const initial = m === "hints" ? [...focus] : [];
    if (m === "hints" && early && points[0] && !initial.includes(points[0].id)) initial.push(points[0].id);
    setRevealed(initial);
    setHintsHidden(false);
    setShowFull(usedLevel === 1);
    patchSession({
      activityStarted: true,
      performedActivity: m,
      helpLevel: usedLevel,
      hintedPointIds: initial,
      answer: "",
      pointResults: {},
      development: null,
      relations: null,
    });
    setStep("activity");
  };

  const startReread = () => {
    patchSession({ activityStarted: true, performedActivity: "reread", helpLevel: 1 });
    setStep("reread");
  };

  const revealNext = () => {
    const nextPoint = points.find((p) => !revealed.includes(p.id));
    if (!nextPoint) return;
    revealPoint(nextPoint.id);
  };
  const revealPoint = (id: string) => {
    if (revealed.includes(id)) return;
    const updated = [...revealed, id];
    setRevealed(updated);
    setHintsHidden(false);
    patchSession({ hintedPointIds: Array.from(new Set([...session.hintedPointIds, id])) });
  };

  const openFull = () => {
    setShowFull((v) => !v);
    patchSession({ consultedFullAnswer: true });
  };

  const goCompare = () => {
    // Los puntos cuya pista se vio arrancan marcados como "Con pista" (se puede cambiar).
    const preset: Record<string, PointResult> = {};
    for (const id of session.hintedPointIds) if (pointById(id)) preset[id] = "hinted";
    patchSession({ pointResults: { ...preset, ...session.pointResults } });
    setStep("compare");
  };

  // ---- Resultado (vista previa: se guarda recién en "Guardar repaso") ----
  const finalSession: ConceptSession = {
    ...session,
    performedActivity: session.performedActivity ?? "reread",
    activitiesPerformed: session.activitiesPerformed,
    answer: session.performedActivity === "reread" || !session.performedActivity ? rereadNote.trim() : session.answer,
    nextReviewDate,
  };
  const outcome = step === "result" ? completeSession(learning, finalSession, points, now()) : null;
  const next: Recommendation | null = outcome
    ? { ...outcome.state.next!, ...(nextOverride || {}) }
    : null;

  const save = async () => {
    if (!outcome || !next || saving) return;
    setSaving(true);
    try {
      const sessionSaved = { ...outcome.session, next };
      const state = {
        ...outcome.state,
        next,
        sessions: [...outcome.state.sessions.slice(0, -1), sessionSaved],
      };
      await achievementQueue.current;
      await onDone(finalSession.answer, { conceptLearning: state, conceptAchievements: achievements });
    } finally {
      setSaving(false);
    }
  };

  const cancel = async () => {
    if (saving) return;
    // Los logros ya se guardaron al marcarlos; se espera a que termine el último guardado.
    await achievementQueue.current;
    // La autoevaluación ya quedó registrada: se guarda la sesión como incompleta.
    if (session.initialComprehension) {
      try {
        await onPersist({ conceptLearning: saveIncompleteSession(learning, finalSession) });
      } catch (e) {
        console.error("Error saving incomplete concept session:", e);
      }
    }
    onCancel();
  };

  const repeatSameLevel = () => {
    setNextOverride(null);
    if (session.performedActivity === "reread" || !session.performedActivity) {
      setStep("reread");
      return;
    }
    const m = session.performedActivity === "free" ? "free" : "hints";
    const l = session.helpLevel && session.helpLevel < 5 ? session.helpLevel : level;
    setMode(m);
    setLevel(l);
    startActivity(m, l);
  };

  // ---- Edición de pistas / respuesta modelo (mantener apretado) ----
  const savePoints = async (updated: ConceptPoint[]) => {
    setPoints(updated);
    await onPersist(pointsToFields(updated));
  };
  const saveModelAnswer = async (text: string) => {
    setModelAnswer(text);
    await onPersist({ conceptModelAnswer: text });
  };

  // Al marcar una actividad como hecha se suma al registro de la sesión.
  const markActivity = (a: ActivityType) =>
    setSession((s) => (s && !s.activitiesPerformed.includes(a) ? { ...s, activitiesPerformed: [...s.activitiesPerformed, a] } : s));

  // ---- Logros durante la respuesta (se guardan al instante; no tocan la evaluación) ----
  const persistAchievements = (list: ConceptAchievement[]) => {
    setAchievements(list);
    setAchievementSave("saving");
    achievementQueue.current = achievementQueue.current
      .then(() => onPersist({ conceptAchievements: list }))
      .then(() => setAchievementSave("saved"))
      .catch((e) => {
        console.error("Error saving concept achievements:", e);
        setAchievementSave("error");
      });
  };
  // Ayuda que se estaba usando en el momento de marcar el logro.
  const currentHelpContext = (): HelpContext =>
    session.consultedFullAnswer || session.performedActivity === "reread" || session.helpLevel === 1
      ? "after_material"
      : session.performedActivity === "hints" || session.hintedPointIds.length > 0
        ? "hints"
        : "free";
  const newAchievement = (type: AchievementType, description?: string) =>
    createAchievement({
      conceptId: practice.id,
      sessionId: session.id,
      sessionNumber: session.number,
      type,
      activity: step === "reread" ? "reread" : session.performedActivity,
      helpContext: currentHelpContext(),
      helpLevel: step === "reread" ? 1 : session.helpLevel,
      ...(description ? { description } : {}),
    });
  const sessionAchievements = achievements.filter((a) => a.sessionId === session.id);
  const achievementsPanel = (summary?: boolean) => (
    <ConceptAchievementsPanel
      achievements={sessionAchievements}
      summary={summary}
      saveState={achievementSave}
      onToggle={(type) => persistAchievements(toggleAchievement(achievements, session.id, type, () => newAchievement(type)))}
      onAddCustom={(description) => persistAchievements([...achievements, newAchievement("custom", description)])}
      onRemove={(id) => persistAchievements(achievements.filter((a) => a.id !== id))}
    />
  );

  const activityType: ActivityType | null =
    step === "reread" || step === "after_reread" ? "reread" : step === "activity" || step === "compare" ? (session.performedActivity ?? null) : null;

  const pointsRated = points.every((p) => session.pointResults[p.id]);
  const canSeeResult = pointsRated && session.development !== null && (points.length < 2 || session.relations !== null);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) cancel(); }}>
      <DialogContent className="max-w-lg rounded-3xl max-h-[90vh] overflow-y-auto minimal-scrollbar">
        <DialogTitle className="flex items-center gap-2 text-lg font-black pr-6">
          {practice.emoji && <span>{practice.emoji}</span>}
          <span>{practice.name}</span>
        </DialogTitle>
        <DialogDescription asChild>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground">Repaso {session.number}</span>
            {activityType && (
              <span className="rounded-full bg-purple-500/15 px-2 py-0.5 font-bold text-purple-700 dark:text-purple-300">
                {ACTIVITIES[activityType].emoji} {ACTIVITIES[activityType].title}
              </span>
            )}
            {step !== "comprehension" && step !== "result" && (
              <button
                type="button"
                onClick={() => setStep("comprehension")}
                className="ml-auto text-muted-foreground underline-offset-2 hover:underline"
              >
                Cambiar mi evaluación
              </button>
            )}
          </div>
        </DialogDescription>

        {editing ? (
          editing.kind === "answer" ? (
            <ModelAnswerEditor
              value={modelAnswer}
              onCancel={() => setEditing(null)}
              onSave={async (text) => { await saveModelAnswer(text); setEditing(null); }}
            />
          ) : (
            <PointEditor
              point={editing.kind === "point" ? pointById(editing.id) ?? null : null}
              onCancel={() => setEditing(null)}
              onDelete={editing.kind === "point" ? async () => { await savePoints(points.filter((p) => p.id !== editing.id)); setEditing(null); } : undefined}
              onSave={async (p) => {
                const exists = points.some((x) => x.id === p.id);
                await savePoints(exists ? points.map((x) => (x.id === p.id ? p : x)) : [...points, p]);
                setEditing(null);
              }}
            />
          )
        ) : (
          <>
            {/* ---------- 1. ¿Comprendés la idea general? ---------- */}
            {step === "comprehension" && (
              <div className="flex flex-col gap-3">
                {learning.comprehension && (
                  <div className="rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                    La última vez: <b>{COMPREHENSION_LABELS[learning.comprehension]}</b>
                    {learning.next && <> · Sugerido: {ACTIVITIES[learning.next.activity].title.toLowerCase()}</>}
                  </div>
                )}
                <p className="font-bold text-foreground">¿Comprendés la idea general de este concepto?</p>
                {COMPREHENSION_OPTIONS.map((o) => (
                  <OptionButton key={o.value} emoji={o.emoji} label={o.label} onClick={() => answerComprehension(o.value)} />
                ))}
                <p className="text-[11px] text-muted-foreground">Es una autoevaluación: respondé lo que sentís, se puede cambiar en cualquier momento.</p>
              </div>
            )}

            {/* ---------- A. Releer el concepto completo ---------- */}
            {step === "reread" && (
              <div className="flex flex-col gap-3">
                <ActivityCard activity="reread" reason={rec?.activity === "reread" ? rec.reason : undefined} />
                <FullContent
                  modelAnswer={modelAnswer}
                  points={points}
                  onEditAnswer={() => setEditing({ kind: "answer" })}
                  onEditPoint={(id) => setEditing({ kind: "point", id })}
                  onAddPoint={() => setEditing({ kind: "new" })}
                />
                <Textarea
                  value={rereadNote}
                  onChange={(e) => setRereadNote(e.target.value)}
                  placeholder="Opcional: explicá con tus palabras qué significa el concepto"
                  className="min-h-28 rounded-xl"
                />
                <Button
                  onClick={() => {
                    if (!session.activityStarted) patchSession({ activityStarted: true });
                    patchSession({ performedActivity: "reread", helpLevel: 1 });
                    markActivity("reread");
                    setStep("after_reread");
                  }}
                  className="rounded-xl bg-purple-500 hover:bg-purple-600 text-white"
                >
                  Terminé la actividad
                </Button>
              </div>
            )}

            {step === "after_reread" && (
              <div className="flex flex-col gap-3">
                {achievementsPanel()}
                <p className="font-bold text-foreground">Después de realizar esta actividad, ¿cómo describirías tu comprensión del concepto?</p>
                {AFTER_ACTIVITY_OPTIONS.map((o) => (
                  <OptionButton key={o.value} emoji={o.emoji} label={o.label} onClick={() => answerAfterReread(o.value)} />
                ))}
              </div>
            )}

            {/* ---------- "Más o menos": revisar las partes que generan dudas ---------- */}
            {step === "review_parts" && (
              <div className="flex flex-col gap-3">
                <p className="font-bold text-foreground">Revisá las partes que te generan dudas</p>
                <p className="text-xs text-muted-foreground">Tocá un punto para abrirlo. No hace falta releer todo.</p>
                {points.length === 0 && <EmptyPoints onAdd={() => setEditing({ kind: "new" })} />}
                {points.map((p, i) => (
                  <PointCard
                    key={p.id}
                    point={p}
                    index={i}
                    open={expandedDoubts.includes(p.id)}
                    onClick={() => setExpandedDoubts((ids) => (ids.includes(p.id) ? ids.filter((x) => x !== p.id) : [...ids, p.id]))}
                    onHold={() => setEditing({ kind: "point", id: p.id })}
                  />
                ))}
                <Button variant="outline" onClick={openFull} className="rounded-xl">
                  <BookOpen className="h-4 w-4 mr-2" /> {showFull ? "Ocultar respuesta completa" : "Ver respuesta completa"}
                </Button>
                {showFull && <ModelAnswerBlock text={modelAnswer} onHold={() => setEditing({ kind: "answer" })} />}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={startReread} className="flex-1 rounded-xl">Releer todo</Button>
                  <Button
                    onClick={() => goActivity(rec && rec.activity !== "reread" ? rec : recommendFromComprehension(learning, "partial", now())!)}
                    className="flex-1 rounded-xl bg-purple-500 hover:bg-purple-600 text-white"
                  >
                    Continuar con pistas
                  </Button>
                </div>
              </div>
            )}

            {/* ---------- 2 y 3. ¿Identificás los puntos? ¿Los desarrollás? ---------- */}
            {step === "check_points" && (
              <div className="flex flex-col gap-3">
                <p className="font-bold text-foreground">¿Podés identificar todos los puntos principales?</p>
                <OptionButton emoji="✅" label="Sí, sé cuáles son" onClick={() => { patchSession({ canIdentifyPoints: true }); setStep("check_develop"); }} />
                <OptionButton emoji="🧩" label="Todavía no recuerdo todos" onClick={() => { patchSession({ canIdentifyPoints: false }); goActivity(recommendFromRecallChecks(learning, false, null, now())); }} />
              </div>
            )}

            {step === "check_develop" && (
              <div className="flex flex-col gap-3">
                <p className="font-bold text-foreground">¿Podés desarrollar cada punto con tus palabras?</p>
                <OptionButton emoji="✍️" label="Sí, puedo desarrollarlos" onClick={() => { patchSession({ canDevelopPoints: true }); goActivity(recommendFromRecallChecks(learning, true, true, now())); }} />
                <OptionButton emoji="💡" label="Necesito ayuda para desarrollarlos" onClick={() => { patchSession({ canDevelopPoints: false }); goActivity(recommendFromRecallChecks(learning, true, false, now())); }} />
              </div>
            )}

            {/* ---------- B / C. Recuperación con o sin pistas ---------- */}
            {step === "activity" && (
              <div className="flex flex-col gap-3">
                {rec && rec.activity !== "reread" && <p className="text-xs text-muted-foreground">{rec.reason}</p>}
                <p className="text-xs text-muted-foreground">{ACTIVITIES[session.performedActivity === "free" ? "free" : "hints"].instructions.join(" ")}</p>
                {focusIds.length > 0 && (
                  <p className="text-xs text-muted-foreground">🎯 Para reforzar: {focusIds.map((id) => pointById(id)?.title).join(", ")}</p>
                )}

                {/* Nivel de ayuda: 1–4 con pistas, 5 = sin pistas. Se cambia en cualquier momento. */}
                <div className="flex items-center gap-2">
                  <LevelStepper
                    level={session.helpLevel ?? level}
                    compact
                    onChange={(l) => {
                      if (l < 5) setLevel(l);
                      setMode(l === 5 ? "free" : "hints");
                      patchSession({ helpLevel: l, performedActivity: l === 5 ? "free" : "hints" });
                      setShowFull(l === 1);
                    }}
                  />
                  {session.performedActivity === "hints" && (
                    <button
                      type="button"
                      onClick={() => setHintsHidden((v) => !v)}
                      className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      {hintsHidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      {hintsHidden ? "Mostrar pistas" : "Ocultar pistas"}
                    </button>
                  )}
                </div>

                {!hintsHidden && (session.performedActivity === "hints" || revealed.length > 0) && (session.helpLevel ?? 5) !== 1 && (
                  <HintsPanel
                    points={points}
                    revealed={revealed}
                    focusIds={focusIds}
                    level={session.performedActivity === "free" ? 3 : (session.helpLevel ?? level)}
                    onReveal={revealPoint}
                    onEdit={(id) => setEditing({ kind: "point", id })}
                    onAdd={() => setEditing({ kind: "new" })}
                  />
                )}

                <Textarea
                  autoFocus
                  value={session.answer}
                  onChange={(e) => patchSession({ answer: e.target.value })}
                  placeholder="Escribí lo que recordás del concepto…"
                  className="min-h-40 rounded-xl"
                />

                <div className="flex flex-wrap gap-2">
                  {points.some((p) => !revealed.includes(p.id)) && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={revealNext}
                      className="rounded-xl border-amber-500/50 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                    >
                      <Lightbulb className="h-4 w-4 mr-2" />
                      {session.performedActivity === "free" && revealed.length === 0 ? "Me trabé: pedir una pista" : "Siguiente pista"}
                    </Button>
                  )}
                  <Button type="button" variant="outline" onClick={openFull} className="rounded-xl">
                    <BookOpen className="h-4 w-4 mr-2" />
                    {showFull ? "Ocultar respuesta completa" : "Ver respuesta completa"}
                  </Button>
                </div>

                {showFull && (
                  <FullContent
                    modelAnswer={modelAnswer}
                    points={points}
                    onEditAnswer={() => setEditing({ kind: "answer" })}
                    onEditPoint={(id) => setEditing({ kind: "point", id })}
                    onAddPoint={() => setEditing({ kind: "new" })}
                  />
                )}

                <Button
                  onClick={() => { markActivity(session.performedActivity === "free" && session.hintedPointIds.length === 0 ? "free" : "hints"); goCompare(); }}
                  disabled={!session.answer.trim()}
                  className="rounded-xl bg-purple-500 hover:bg-purple-600 text-white"
                >
                  Comparar con el original
                </Button>
              </div>
            )}

            {/* ---------- Comparar con el contenido original ---------- */}
            {step === "compare" && (
              <div className="flex flex-col gap-3">
                <div className="rounded-xl border border-border/50 px-3 py-2">
                  <p className="text-[11px] font-bold uppercase text-muted-foreground mb-1">Tu respuesta</p>
                  <p className="text-sm whitespace-pre-wrap">{session.answer}</p>
                </div>
                {achievementsPanel()}
                <ModelAnswerBlock text={modelAnswer} onHold={() => setEditing({ kind: "answer" })} />

                {points.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="font-bold text-sm text-foreground">¿Qué puntos recordaste?</p>
                    {points.map((p, i) => (
                      <div key={p.id} className="rounded-xl border border-border/40 px-3 py-2">
                        <p className="text-sm font-semibold">{i + 1}. {p.title}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {POINT_RESULT_OPTIONS.map((o) => (
                            <button
                              key={o.value}
                              type="button"
                              onClick={() => patchSession({ pointResults: { ...session.pointResults, [p.id]: o.value } })}
                              className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors ${
                                session.pointResults[p.id] === o.value ? o.cls : "border-border/50 text-muted-foreground hover:border-border"
                              }`}
                            >
                              {o.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <RatingRow label="¿Pudiste desarrollar cada punto con tus palabras?" value={session.development} onChange={(v) => patchSession({ development: v })} />
                {points.length >= 2 && (
                  <RatingRow label="¿Pudiste explicar cómo se relacionan los puntos?" value={session.relations} onChange={(v) => patchSession({ relations: v })} />
                )}

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep("activity")} className="flex-1 rounded-xl">Volver</Button>
                  <Button onClick={() => setStep("result")} disabled={!canSeeResult} className="flex-1 rounded-xl bg-purple-500 hover:bg-purple-600 text-white">
                    Ver resultado
                  </Button>
                </div>
              </div>
            )}

            {/* ---------- Resultado de la sesión ---------- */}
            {step === "result" && outcome && next && (
              <>
              <ResultView
                outcome={outcome}
                points={points}
                next={next}
                nextReviewDate={nextReviewDate}
                onChangeNextLevel={(l) => setNextOverride({ helpLevel: l, activity: l === 5 ? "free" : l === 1 && next.activity === "reread" ? "reread" : "hints" })}
                onNotReady={() => setNextOverride({ activity: "hints", helpLevel: 4, reason: "Preferís seguir con pistas un tiempo más. Está perfecto: se intenta sin pistas cuando te sientas cómodo." })}
                onRepeat={repeatSameLevel}
                onSave={save}
                saving={saving}
              />
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Subcomponentes ----------------

function OptionButton({ emoji, label, onClick }: { emoji: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-2xl border border-border/50 px-4 py-3 text-left text-sm transition-colors hover:border-purple-500/60 hover:bg-purple-500/10"
    >
      <span className="text-xl">{emoji}</span>
      <span className="text-foreground">{label}</span>
    </button>
  );
}

function ActivityCard({ activity, reason }: { activity: ActivityType; reason?: string }) {
  const a = ACTIVITIES[activity];
  return (
    <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 px-4 py-3">
      <p className="text-[11px] font-bold uppercase text-purple-700 dark:text-purple-300">Actividad recomendada</p>
      <p className="font-bold text-foreground">{a.emoji} {a.title}</p>
      {reason && <p className="text-xs text-muted-foreground mt-1">{reason}</p>}
      <p className="text-xs mt-2"><b>Objetivo:</b> {a.objective}</p>
      <ol className="mt-1 list-decimal pl-5 text-xs text-muted-foreground space-y-0.5">
        {a.instructions.map((s, i) => <li key={i}>{s}</li>)}
      </ol>
    </div>
  );
}

export function LevelStepper({ level, onChange, max = 5, compact }: { level: HelpLevel; onChange: (l: HelpLevel) => void; max?: number; compact?: boolean }) {
  const info = HELP_LEVELS[level - 1];
  return (
    <div className={`flex items-center gap-2 ${compact ? "" : "rounded-xl bg-muted/40 px-2 py-1.5"}`}>
      <button type="button" disabled={level <= 1} onClick={() => onChange(clampLevel(level - 1))} className="rounded-lg p-1 text-muted-foreground hover:text-foreground disabled:opacity-30" title="Más ayuda">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1 text-center">
        <p className="text-xs font-bold text-foreground">Nivel {level} · {info.title}</p>
        {!compact && <p className="text-[11px] text-muted-foreground">{info.description}</p>}
      </div>
      <button type="button" disabled={level >= max} onClick={() => onChange(clampLevel(level + 1))} className="rounded-lg p-1 text-muted-foreground hover:text-foreground disabled:opacity-30" title="Menos ayuda">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function EmptyPoints({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-border/60 px-3 py-3 text-center text-xs text-muted-foreground">
      Este concepto todavía no tiene puntos.
      <button type="button" onClick={onAdd} className="ml-1 font-semibold text-purple-600 dark:text-purple-400 hover:underline">Agregar uno</button>
    </div>
  );
}

// Pistas punto por punto: los puntos ocultos se revelan de a uno.
function HintsPanel({
  points,
  revealed,
  focusIds,
  level,
  onReveal,
  onEdit,
  onAdd,
}: {
  points: ConceptPoint[];
  revealed: string[];
  focusIds: string[];
  level: HelpLevel;
  onReveal: (id: string) => void;
  onEdit: (id: string) => void;
  onAdd: () => void;
}) {
  if (points.length === 0) return <EmptyPoints onAdd={onAdd} />;
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
      <p className="mb-1.5 text-[11px] font-bold uppercase text-amber-700 dark:text-amber-400">
        Pistas · {revealed.filter((id) => points.some((p) => p.id === id)).length}/{points.length}
      </p>
      <div className="flex flex-col gap-1.5">
        {points.map((p, i) => (
          <HintRow
            key={p.id}
            point={p}
            index={i}
            level={level}
            shown={revealed.includes(p.id)}
            focus={focusIds.includes(p.id)}
            onReveal={() => onReveal(p.id)}
            onEdit={() => onEdit(p.id)}
          />
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground">Mantené apretada una pista para editarla.</p>
    </div>
  );
}

function HintRow({ point, index, level, shown, focus, onReveal, onEdit }: {
  point: ConceptPoint; index: number; level: HelpLevel; shown: boolean; focus: boolean; onReveal: () => void; onEdit: () => void;
}) {
  const hold = useHold(onEdit);
  const hint = hintForLevel(point, level);
  return (
    <div
      {...hold.handlers}
      onClick={() => { if (hold.consumed()) return; if (!shown) onReveal(); }}
      className={`select-none rounded-lg px-2 py-1.5 text-sm ${shown ? "bg-background/60" : "cursor-pointer bg-background/30 text-muted-foreground hover:bg-background/50"}`}
    >
      <span className="mr-1 font-bold text-amber-700 dark:text-amber-400">{index + 1}.</span>
      {focus && <span className="mr-1 rounded-full bg-sky-500/20 px-1.5 text-[10px] font-bold text-sky-700 dark:text-sky-300">🎯 Reforzar</span>}
      {!shown ? (
        <span className="italic">Tocá para ver esta pista</span>
      ) : hint.kind === "image" ? (
        <img src={hint.imageUrl} alt="" className="mt-1 max-h-40 rounded-lg" draggable={false} />
      ) : hint.kind === "keywords" ? (
        <span>
          {hint.keywords && <span className="font-semibold">{hint.keywords}</span>}
          {hint.keywords && hint.question && " · "}
          {hint.question && <span className="italic">{hint.question}</span>}
        </span>
      ) : (
        <span className="font-semibold">{hint.title}</span>
      )}
    </div>
  );
}

function PointCard({ point, index, open, onClick, onHold }: { point: ConceptPoint; index: number; open: boolean; onClick: () => void; onHold: () => void }) {
  const hold = useHold(onHold);
  return (
    <div
      {...hold.handlers}
      onClick={() => { if (!hold.consumed()) onClick(); }}
      className="select-none cursor-pointer rounded-xl border border-border/40 px-3 py-2 hover:border-border"
    >
      <p className="text-sm font-semibold">{index + 1}. {point.title}</p>
      {open && <PointDetails point={point} />}
    </div>
  );
}

function PointDetails({ point }: { point: ConceptPoint }) {
  return (
    <div className="mt-1 flex flex-col gap-1 text-xs text-muted-foreground">
      {point.keywords && <p><b>Palabras clave:</b> {point.keywords}</p>}
      {point.question && <p><b>Pregunta:</b> {point.question}</p>}
      {point.imageUrl && <img src={point.imageUrl} alt="" className="max-h-40 rounded-lg" draggable={false} />}
    </div>
  );
}

function ModelAnswerBlock({ text, onHold }: { text: string; onHold: () => void }) {
  const hold = useHold(onHold);
  return (
    <div {...hold.handlers} className="select-none rounded-xl border border-purple-500/30 bg-purple-500/10 px-3 py-2">
      <p className="text-[11px] font-bold uppercase text-purple-700 dark:text-purple-300 mb-1">Respuesta completa</p>
      {text.trim() ? (
        <p className="text-sm whitespace-pre-wrap text-foreground">{text}</p>
      ) : (
        <p className="text-xs italic text-muted-foreground">Todavía no cargaste la respuesta completa.</p>
      )}
      <p className="mt-1 text-[10px] text-muted-foreground">Mantené apretado para editarla.</p>
    </div>
  );
}

// Contenido original: respuesta completa + todos los puntos con sus detalles.
function FullContent({ modelAnswer, points, onEditAnswer, onEditPoint, onAddPoint }: {
  modelAnswer: string; points: ConceptPoint[]; onEditAnswer: () => void; onEditPoint: (id: string) => void; onAddPoint: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <ModelAnswerBlock text={modelAnswer} onHold={onEditAnswer} />
      {points.map((p, i) => (
        <PointCard key={p.id} point={p} index={i} open onClick={() => {}} onHold={() => onEditPoint(p.id)} />
      ))}
      <button type="button" onClick={onAddPoint} className="flex items-center justify-center gap-1 rounded-xl border border-dashed border-border/60 py-1.5 text-xs text-muted-foreground hover:text-foreground">
        <Plus className="h-3.5 w-3.5" /> Agregar punto
      </button>
    </div>
  );
}

function RatingRow({ label, value, onChange }: { label: string; value: Rating | null; onChange: (v: Rating) => void }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-bold text-foreground">{label}</p>
      <div className="flex gap-1.5">
        {RATING_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`flex-1 rounded-xl border px-2 py-1.5 text-xs font-semibold transition-colors ${
              value === o.value ? "border-purple-500 bg-purple-500/15 text-foreground" : "border-border/50 text-muted-foreground hover:border-border"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ResultView({ outcome, points, next, nextReviewDate, onChangeNextLevel, onNotReady, onRepeat, onSave, saving }: {
  outcome: ReturnType<typeof completeSession>;
  points: ConceptPoint[];
  next: Recommendation;
  nextReviewDate: string | null;
  onChangeNextLevel: (l: HelpLevel) => void;
  onNotReady: () => void;
  onRepeat: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const { session, state } = outcome;
  const mastery = getMastery(state);
  const byResult = (r: PointResult) => points.filter((p) => session.pointResults[p.id] === r);
  const comprehension = session.comprehensionChanges[session.comprehensionChanges.length - 1]?.state ?? session.initialComprehension;
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl border border-green-500/30 bg-green-500/10 px-4 py-3">
        <p className="font-bold text-foreground">🌱 Repaso hecho</p>
        {comprehension && <p className="text-xs text-muted-foreground mt-0.5">Comprensión (autoevaluada): {COMPREHENSION_LABELS[comprehension]}</p>}
        {session.performedActivity !== "reread" && points.length > 0 && (
          <div className="mt-2 flex flex-col gap-1 text-xs">
            {byResult("remembered").length > 0 && <p>✅ Recordaste: {byResult("remembered").map((p) => p.title).join(", ")}</p>}
            {byResult("hinted").length > 0 && <p>💡 Con pista: {byResult("hinted").map((p) => p.title).join(", ")}</p>}
            {byResult("forgotten").length > 0 && <p>🔁 Para reforzar: {byResult("forgotten").map((p) => p.title).join(", ")}</p>}
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Dominio: <b className="text-foreground">{mastery.label}</b></p>
      </div>

      <div className="grid grid-cols-5 gap-1">
        {(Object.keys(INDICATOR_LABELS) as (keyof typeof INDICATOR_LABELS)[]).map((k) => {
          const v = state.indicators[k].value;
          return (
            <div key={k} className="flex flex-col items-center gap-1 text-center" title={INDICATOR_LABELS[k]}>
              <span className={`h-2 w-full rounded-full ${v === "yes" ? "bg-green-500" : v === "partial" ? "bg-amber-400" : v === "no" ? "bg-sky-400" : "bg-muted"}`} />
              <span className="text-[9px] leading-tight text-muted-foreground">{INDICATOR_LABELS[k]}</span>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 px-4 py-3">
        <p className="text-[11px] font-bold uppercase text-purple-700 dark:text-purple-300">Próxima vez</p>
        <p className="font-bold text-foreground">{ACTIVITIES[next.activity].emoji} {ACTIVITIES[next.activity].title}</p>
        <p className="text-xs text-muted-foreground mt-1">{next.reason}</p>
        {next.activity !== "reread" && (
          <div className="mt-2"><LevelStepper level={next.helpLevel} onChange={onChangeNextLevel} /></div>
        )}
        {next.activity === "free" && (
          <button type="button" onClick={onNotReady} className="mt-2 text-xs font-semibold text-purple-700 dark:text-purple-300 hover:underline">
            Todavía no me siento listo para sin pistas
          </button>
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {nextReviewDate ? <>📅 Próximo repaso: <b className="text-foreground">{formatDate(nextReviewDate)}</b></> : "🏁 Es el último intervalo de esta repetición"}
      </p>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onRepeat} disabled={saving} className="flex-1 rounded-xl">
          {session.performedActivity === "reread" ? "Releer otra vez" : "Repetir con este nivel"}
        </Button>
        <Button onClick={onSave} disabled={saving} className="flex-1 rounded-xl bg-purple-500 hover:bg-purple-600 text-white">
          Guardar repaso
        </Button>
      </div>
    </div>
  );
}

function PointEditor({ point, onSave, onCancel, onDelete }: {
  point: ConceptPoint | null; onSave: (p: ConceptPoint) => Promise<void>; onCancel: () => void; onDelete?: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<ConceptPoint>(point ?? { id: newId(), title: "" });
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<ConceptPoint>) => setDraft((d) => ({ ...d, ...patch }));
  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };
  return (
    <div className="flex flex-col gap-3">
      <p className="font-bold text-foreground">{point ? "Editar punto" : "Nuevo punto"}</p>
      <label className="text-xs font-semibold text-muted-foreground">Título del punto
        <Input value={draft.title} onChange={(e) => set({ title: e.target.value })} className="mt-1 rounded-xl" autoFocus />
      </label>
      <label className="text-xs font-semibold text-muted-foreground">Palabras clave
        <Input value={draft.keywords ?? ""} onChange={(e) => set({ keywords: e.target.value })} placeholder="Por ej: luz, clorofila, glucosa" className="mt-1 rounded-xl" />
      </label>
      <label className="text-xs font-semibold text-muted-foreground">Pregunta disparadora
        <Input value={draft.question ?? ""} onChange={(e) => set({ question: e.target.value })} placeholder="Por ej: ¿De dónde saca la energía?" className="mt-1 rounded-xl" />
      </label>
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-1">Imagen asociada</p>
        {draft.imageUrl ? (
          <div className="relative inline-block">
            <img src={draft.imageUrl} alt="" className="max-h-40 rounded-lg" />
            <button type="button" onClick={() => set({ imageUrl: undefined })} className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white" title="Quitar imagen">
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} className="rounded-xl text-xs">
            <ImagePlus className="h-4 w-4 mr-2" /> Agregar imagen
          </Button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) set({ imageUrl: await compressImage(file) });
          }}
        />
      </div>
      <div className="flex gap-2">
        {onDelete && (
          <Button type="button" variant="outline" disabled={busy} onClick={() => run(onDelete)} className="rounded-xl text-red-600 hover:text-red-700" title="Eliminar punto">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
        <Button type="button" variant="outline" disabled={busy} onClick={onCancel} className="flex-1 rounded-xl">Cancelar</Button>
        <Button
          type="button"
          disabled={busy || !draft.title.trim()}
          onClick={() => run(() => onSave({
            ...draft,
            title: draft.title.trim(),
            keywords: draft.keywords?.trim() || undefined,
            question: draft.question?.trim() || undefined,
          }))}
          className="flex-1 rounded-xl bg-purple-500 hover:bg-purple-600 text-white"
        >
          Guardar
        </Button>
      </div>
    </div>
  );
}

function ModelAnswerEditor({ value, onSave, onCancel }: { value: string; onSave: (v: string) => Promise<void>; onCancel: () => void }) {
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <p className="font-bold text-foreground">Respuesta completa</p>
      <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus placeholder="La explicación completa del concepto" className="min-h-40 rounded-xl" />
      <div className="flex gap-2">
        <Button variant="outline" disabled={busy} onClick={onCancel} className="flex-1 rounded-xl">Cancelar</Button>
        <Button
          disabled={busy}
          onClick={async () => { setBusy(true); try { await onSave(draft.trim()); } finally { setBusy(false); } }}
          className="flex-1 rounded-xl bg-purple-500 hover:bg-purple-600 text-white"
        >
          Guardar
        </Button>
      </div>
    </div>
  );
}
