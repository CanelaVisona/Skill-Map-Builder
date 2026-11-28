// Recuperación activa adaptativa para las "Repeticiones de conceptos".
//
// Es una capa encima de la repetición espaciada, con dos decisiones separadas:
//   - CUÁNDO repasar: lo siguen decidiendo los intervalos (D0…D30, D45…D270) de
//     SpaceRepetitionModal. Este módulo no los toca.
//   - CÓMO repasar: lo decide este módulo (releer, recuperar con pistas o sin pistas, y con
//     qué nivel de ayuda), a partir de lo que el usuario declara y de los resultados de cada sesión.
//
// Todo el estado vive en `practice.conceptLearning` (jsonb), uno por concepto, así que cada
// concepto progresa de forma independiente. Las funciones de este archivo son puras: reciben el
// estado y devuelven uno nuevo, sin efectos, para poder cambiar el algoritmo sin tocar la UI.

import type { ConceptPoint } from "@shared/schema";

export type { ConceptPoint };

// Autoevaluación de comprensión (no es una medición objetiva: es lo que el usuario declara).
export type Comprehension = "understood" | "partial" | "not_understood";
// A. Releer el concepto completo · B. Recuperación con pistas · C. Recuperación sin pistas.
export type ActivityType = "reread" | "hints" | "free";
// 1 = contenido completo visible … 5 = sin pistas.
export type HelpLevel = 1 | 2 | 3 | 4 | 5;
export type PointResult = "remembered" | "hinted" | "forgotten";
export type Rating = "yes" | "partial" | "no";
// Tipos de error, que no son equivalentes entre sí.
export type ErrorKind = "comprehension" | "recall" | "development";

export const COMPREHENSION_LABELS: Record<Comprehension, string> = {
  understood: "Comprendido",
  partial: "Parcialmente comprendido",
  not_understood: "Todavía no comprendido",
};

export const HELP_LEVELS: { level: HelpLevel; title: string; description: string }[] = [
  { level: 1, title: "Contenido completo", description: "Ves la respuesta completa y todos los puntos" },
  { level: 2, title: "Títulos de los puntos", description: "Ves el título de cada punto, de a uno" },
  { level: 3, title: "Palabras clave y preguntas", description: "Palabras clave o preguntas disparadoras, de a una" },
  { level: 4, title: "Imágenes", description: "La imagen asociada a cada punto, de a una" },
  { level: 5, title: "Sin pistas", description: "Reconstruís el concepto desde tu memoria" },
];

export const ACTIVITIES: Record<ActivityType, { emoji: string; title: string; objective: string; instructions: string[] }> = {
  reread: {
    emoji: "📖",
    title: "Releer el concepto completo",
    objective: "Comprender la idea general antes de intentar memorizar sus componentes.",
    instructions: [
      "Consultá la definición completa.",
      "Leé la explicación.",
      "Identificá la idea central.",
      "Intentá explicar qué significa el concepto con tus palabras.",
      "Después volvé a registrar tu nivel de comprensión.",
    ],
  },
  hints: {
    emoji: "💡",
    title: "Recuperación con pistas",
    objective: "Reconstruir la respuesta apoyándote en pistas, punto por punto.",
    instructions: [
      "Escribí lo que recordás.",
      "Cuando te trabes, pedí una pista: se muestran de a un punto.",
      "Usar pistas es parte del proceso, no un error.",
    ],
  },
  free: {
    emoji: "✍️",
    title: "Recuperación sin pistas",
    objective: "Reconstruir el concepto completo desde tu memoria.",
    instructions: [
      "Escribí el concepto con tus palabras, sin mirar el material.",
      "Si te bloqueás, podés pedir una pista cuando quieras.",
    ],
  },
};

export interface Recommendation {
  activity: ActivityType;
  helpLevel: HelpLevel;
  reason: string;
  focusPointIds: string[]; // Puntos a reforzar (los olvidados o que necesitaron pista)
  at: string; // ISO
}

export interface IndicatorValue {
  value: Rating | null;
  updatedAt: string | null;
}

// Cinco indicadores independientes de dominio.
export interface Indicators {
  comprehension: IndicatorValue; // Comprensión de la idea general (autoevaluada)
  recall: IndicatorValue; // Recordar todos los puntos principales
  development: IndicatorValue; // Desarrollar cada punto
  relations: IndicatorValue; // Explicar las relaciones entre los puntos
  freeRecall: IndicatorValue; // Reconstruir la respuesta sin consultar material
}

export const INDICATOR_LABELS: Record<keyof Indicators, string> = {
  comprehension: "Idea general",
  recall: "Recordar los puntos",
  development: "Desarrollar cada punto",
  relations: "Relacionar los puntos",
  freeRecall: "Reconstruir sin material",
};

export interface PointProgress {
  remembered: number;
  hinted: number;
  forgotten: number;
  last: PointResult | null;
  lastDate: string | null;
}

export interface ComprehensionChange {
  at: string;
  state: Comprehension;
  source: "initial" | "after_activity" | "changed";
  sessionNumber: number;
}

export interface ConceptSession {
  id: string;
  number: number;
  startedAt: string;
  completedAt: string | null; // null = sesión empezada y no terminada
  initialComprehension: Comprehension | null;
  initialComprehensionAt: string | null;
  canIdentifyPoints: boolean | null;
  canDevelopPoints: boolean | null;
  recommended: { activity: ActivityType; helpLevel: HelpLevel; reason: string; at: string } | null;
  activityStarted: boolean;
  activityCompleted: boolean;
  performedActivity: ActivityType | null; // Última actividad de la sesión (la que se evalúa)
  activitiesPerformed: ActivityType[]; // Todas las que se hicieron (p.ej. releer y después con pistas)
  helpLevel: HelpLevel | null;
  hintedPointIds: string[];
  consultedFullAnswer: boolean;
  answer: string;
  pointResults: Record<string, PointResult>;
  development: Rating | null;
  relations: Rating | null;
  afterComprehension: Comprehension | null; // Autoevaluación al terminar la actividad
  comprehensionChanges: ComprehensionChange[];
  errors: ErrorKind[];
  next: Recommendation | null;
  nextReviewDate: string | null;
}

export interface ConceptLearningState {
  version: 1;
  helpLevel: HelpLevel; // Nivel de ayuda actual de ESTE concepto
  comprehension: Comprehension | null;
  comprehensionAt: string | null;
  comprehensionHistory: ComprehensionChange[];
  indicators: Indicators;
  points: Record<string, PointProgress>;
  lastActivity: ActivityType | null;
  lastHelpLevel: HelpLevel | null;
  lastReviewAt: string | null;
  nextReviewDate: string | null;
  next: Recommendation | null;
  sessions: ConceptSession[];
}

// Lo mínimo que este módulo necesita de una práctica (evita depender de SpaceRepetitionModal).
export interface ConceptPracticeLike {
  startDate: string;
  level?: 1 | 2;
  completedIntervals?: number[];
  conceptHints?: string[];
  conceptPoints?: ConceptPoint[];
  conceptModelAnswer?: string;
  conceptLearning?: unknown;
}

const emptyIndicator = (): IndicatorValue => ({ value: null, updatedAt: null });

export function createInitialState(): ConceptLearningState {
  return {
    version: 1,
    helpLevel: 2,
    comprehension: null,
    comprehensionAt: null,
    comprehensionHistory: [],
    indicators: {
      comprehension: emptyIndicator(),
      recall: emptyIndicator(),
      development: emptyIndicator(),
      relations: emptyIndicator(),
      freeRecall: emptyIndicator(),
    },
    points: {},
    lastActivity: null,
    lastHelpLevel: null,
    lastReviewAt: null,
    nextReviewDate: null,
    next: null,
    sessions: [],
  };
}

export function clampLevel(level: number): HelpLevel {
  return Math.min(5, Math.max(1, Math.round(level))) as HelpLevel;
}

// Normaliza lo guardado (puede faltar o venir de una versión vieja) sin perder datos.
export function getLearningState(practice: ConceptPracticeLike): ConceptLearningState {
  const raw = practice.conceptLearning;
  const base = createInitialState();
  if (!raw || typeof raw !== "object") return base;
  const s = raw as Partial<ConceptLearningState>;
  return {
    ...base,
    ...s,
    helpLevel: clampLevel(s.helpLevel ?? base.helpLevel),
    indicators: { ...base.indicators, ...(s.indicators || {}) },
    points: s.points && typeof s.points === "object" ? s.points : {},
    comprehensionHistory: Array.isArray(s.comprehensionHistory) ? s.comprehensionHistory : [],
    sessions: Array.isArray(s.sessions) ? s.sessions : [],
    version: 1,
  };
}

let idCounter = 0;
export function newId(prefix = "p"): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}-${Math.random().toString(36).slice(2, 6)}`;
}

// Puntos del concepto. Los conceptos creados antes de esta capa solo tienen `conceptHints`
// (textos): se derivan de ahí con ids estables por posición, así el progreso por punto queda
// asociado aunque todavía no se hayan guardado `conceptPoints`.
export function getConceptPoints(practice: ConceptPracticeLike): ConceptPoint[] {
  if (Array.isArray(practice.conceptPoints) && practice.conceptPoints.length > 0) {
    return practice.conceptPoints.filter((p) => p && typeof p.title === "string");
  }
  const hints = Array.isArray(practice.conceptHints) ? practice.conceptHints : [];
  return hints.filter((h) => h.trim()).map((title, i) => ({ id: `hint-${i}`, title }));
}

// Al editar los títulos en el formulario, conserva las pistas extra (palabras clave, pregunta,
// imagen) del punto que estaba en la misma posición.
export function mergePointsWithTitles(existing: ConceptPoint[], titles: string[]): ConceptPoint[] {
  return titles
    .map((t) => t.trim())
    .filter(Boolean)
    .map((title, i) => (existing[i] ? { ...existing[i], title } : { id: newId(), title }));
}

// Campos a guardar cuando cambian los puntos: `conceptHints` se mantiene sincronizado con los
// títulos porque otras partes de la app lo siguen leyendo.
export function pointsToFields(points: ConceptPoint[]) {
  const clean = points.filter((p) => p.title.trim());
  return { conceptPoints: clean, conceptHints: clean.map((p) => p.title.trim()) };
}

function daysBetween(fromDate: string, to: Date = new Date()): number {
  const [y, m, d] = fromDate.split("-").map(Number);
  const start = new Date(y, (m || 1) - 1, d || 1);
  const today = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.floor((today.getTime() - start.getTime()) / 86400000);
}

// Los 3 primeros días (contados desde el primer registro) el repaso arranca con pistas por
// defecto, con la opción de ocultarlas.
export function isEarlyPhase(practice: ConceptPracticeLike): boolean {
  if ((practice.level || 1) !== 1) return false;
  const completed = Array.isArray(practice.completedIntervals) ? practice.completedIntervals : [];
  if (completed.length === 0) return true;
  return daysBetween(practice.startDate) < 3;
}

// ---------- Algoritmo de decisión ----------

// Paso 1: la autoevaluación de comprensión. Devuelve null si hay que seguir evaluando la
// recuperación (respondió "Sí").
export function recommendFromComprehension(state: ConceptLearningState, c: Comprehension, at: string): Recommendation | null {
  if (c === "not_understood") {
    return {
      activity: "reread",
      helpLevel: 1,
      reason: "Indicaste que necesitás releer el concepto: primero conviene comprender la idea general.",
      focusPointIds: [],
      at,
    };
  }
  if (c === "partial") {
    return {
      activity: "hints",
      helpLevel: clampLevel(Math.min(Math.max(state.helpLevel, 2), 3)),
      reason: "Comprendés la idea, pero querés revisar algunas partes: revisalas y después reconstruí con pistas.",
      focusPointIds: state.next?.focusPointIds ?? [],
      at,
    };
  }
  return null;
}

// Pasos 2 y 3: ¿identifica todos los puntos? ¿puede desarrollarlos?
export function recommendFromRecallChecks(
  state: ConceptLearningState,
  canIdentify: boolean,
  canDevelop: boolean | null,
  at: string,
): Recommendation {
  const focus = state.next?.focusPointIds ?? [];
  if (!canIdentify) {
    return {
      activity: "hints",
      helpLevel: clampLevel(Math.min(Math.max(state.helpLevel, 2), 4)),
      reason: "Comprendés la idea general pero no todos los puntos: reconstruilos con pistas.",
      focusPointIds: focus,
      at,
    };
  }
  if (!canDevelop) {
    return {
      activity: "hints",
      helpLevel: clampLevel(Math.min(Math.max(state.helpLevel, 3), 4)),
      reason: "Recordás los puntos pero necesitás ayuda para desarrollarlos: palabras clave y preguntas disparadoras.",
      focusPointIds: focus,
      at,
    };
  }
  return {
    activity: "free",
    helpLevel: 5,
    reason: "Comprendés la idea, identificás los puntos y podés desarrollarlos: el próximo paso es recuperarlo sin pistas.",
    focusPointIds: focus,
    at,
  };
}

export interface SessionOutcome {
  state: ConceptLearningState;
  session: ConceptSession;
}

function setIndicator(ind: Indicators, key: keyof Indicators, value: Rating | null, at: string): Indicators {
  if (value === null) return ind;
  return { ...ind, [key]: { value, updatedAt: at } };
}

function ratio(n: number, total: number): Rating {
  if (total === 0) return "yes";
  const r = n / total;
  return r >= 1 ? "yes" : r >= 0.5 ? "partial" : "no";
}

// Cierra una sesión: calcula errores, actualiza indicadores y el progreso por punto, y decide
// la próxima actividad. Nunca sube de nivel solo por haber pasado el tiempo ni obliga a pasar a
// "sin pistas": lo recomienda, y el usuario puede elegir otra cosa.
export function completeSession(
  prev: ConceptLearningState,
  session: ConceptSession,
  points: ConceptPoint[],
  at: string,
): SessionOutcome {
  let state: ConceptLearningState = { ...prev, indicators: { ...prev.indicators }, points: { ...prev.points } };
  const errors: ErrorKind[] = [];
  let next: Recommendation;
  const usedLevel: HelpLevel = session.helpLevel ?? state.helpLevel;

  // Comprensión: la última autoevaluación de la sesión (incluye cambios hechos a mitad de camino).
  const finalComprehension =
    session.comprehensionChanges[session.comprehensionChanges.length - 1]?.state ??
    session.afterComprehension ??
    session.initialComprehension;
  if (finalComprehension) {
    state.indicators = setIndicator(
      state.indicators,
      "comprehension",
      finalComprehension === "understood" ? "yes" : finalComprehension === "partial" ? "partial" : "no",
      at,
    );
  }

  if (session.performedActivity === "reread") {
    if (finalComprehension === "not_understood") errors.push("comprehension");
    next =
      finalComprehension === "understood"
        ? { activity: "hints", helpLevel: 2, reason: "Ahora comprendés la idea general: el próximo paso es recordar los puntos principales con pistas.", focusPointIds: [], at }
        : finalComprehension === "partial"
          ? { activity: "hints", helpLevel: 2, reason: "Comprendés mejor pero quedan dudas: revisá esas partes y seguí con pistas, sin apurarte a hacerlo sin ayuda.", focusPointIds: [], at }
          : { activity: "reread", helpLevel: 1, reason: "Todavía no comprendés la idea general: otra lectura comprensiva, revisando la explicación y los ejemplos.", focusPointIds: [], at };
    state.helpLevel = next.helpLevel;
  } else {
    const evaluated = points.filter((p) => session.pointResults[p.id]);
    const forgotten = evaluated.filter((p) => session.pointResults[p.id] === "forgotten").map((p) => p.id);
    const hinted = evaluated.filter((p) => session.pointResults[p.id] === "hinted").map((p) => p.id);
    const remembered = evaluated.length - forgotten.length - hinted.length;

    for (const p of evaluated) {
      const r = session.pointResults[p.id];
      const pp = state.points[p.id] || { remembered: 0, hinted: 0, forgotten: 0, last: null, lastDate: null };
      state.points[p.id] = { ...pp, [r]: (pp[r] as number) + 1, last: r, lastDate: at };
    }

    if (forgotten.length > 0) errors.push("recall");
    if (session.development === "no" || session.development === "partial") errors.push("development");

    // Recordar los puntos: cuenta como recordado solo lo que salió sin pista.
    if (evaluated.length > 0) state.indicators = setIndicator(state.indicators, "recall", ratio(remembered, evaluated.length), at);
    state.indicators = setIndicator(state.indicators, "development", session.development, at);
    state.indicators = setIndicator(state.indicators, "relations", session.relations, at);
    if (session.performedActivity === "free" && evaluated.length > 0) {
      state.indicators = setIndicator(state.indicators, "freeRecall", ratio(remembered, evaluated.length), at);
    }

    const allGood = evaluated.length > 0 && forgotten.length === 0 && hinted.length === 0 && session.development === "yes";
    const structureLost = evaluated.length > 0 && forgotten.length / evaluated.length > 0.5;

    if (allGood) {
      next = session.performedActivity === "free"
        ? { activity: "free", helpLevel: 5, reason: "Recordaste todos los puntos y los desarrollaste: mantené la recuperación sin pistas.", focusPointIds: [], at }
        : {
            activity: usedLevel + 1 >= 5 ? "free" : "hints",
            helpLevel: clampLevel(usedLevel + 1),
            reason: "Recordaste todo con este nivel de ayuda: la próxima vez vas a usar un poco menos de ayuda.",
            focusPointIds: [],
            at,
          };
    } else if (structureLost) {
      next = { activity: "hints", helpLevel: 2, reason: "Se perdió parte de la estructura: volvé a trabajar con los títulos de los puntos como pistas estructurales.", focusPointIds: [...forgotten, ...hinted], at };
    } else if (forgotten.length > 0 || hinted.length > 0) {
      next = {
        activity: "hints",
        helpLevel: session.performedActivity === "free" ? 4 : usedLevel,
        reason: "Reforzá con pistas solo los puntos que costaron; no hace falta releer todo el concepto.",
        focusPointIds: [...forgotten, ...hinted],
        at,
      };
    } else {
      // Recordó los puntos pero le costó desarrollarlos: error de desarrollo, no de recuperación.
      next = {
        activity: "hints",
        helpLevel: clampLevel(Math.min(usedLevel, 3)),
        reason: "Recordaste los puntos; para desarrollarlos mejor, apoyate en palabras clave y preguntas disparadoras.",
        focusPointIds: [],
        at,
      };
    }
    state.helpLevel = usedLevel;
  }

  const finished: ConceptSession = {
    ...session,
    completedAt: at,
    activityCompleted: true,
    errors,
    next,
  };

  state = {
    ...state,
    comprehension: finalComprehension ?? state.comprehension,
    comprehensionAt: finalComprehension ? at : state.comprehensionAt,
    comprehensionHistory: [...state.comprehensionHistory, ...session.comprehensionChanges],
    lastActivity: session.performedActivity,
    lastHelpLevel: usedLevel,
    lastReviewAt: at,
    nextReviewDate: session.nextReviewDate,
    next,
    sessions: [...state.sessions, finished],
  };
  return { state, session: finished };
}

// Sesión empezada y abandonada: se guarda como incompleta (no se sobrescribe nada anterior y
// la autoevaluación queda registrada), sin cambiar indicadores ni la recomendación.
export function saveIncompleteSession(prev: ConceptLearningState, session: ConceptSession): ConceptLearningState {
  const latest = [...session.comprehensionChanges].pop();
  return {
    ...prev,
    comprehension: latest?.state ?? prev.comprehension,
    comprehensionAt: latest?.at ?? prev.comprehensionAt,
    comprehensionHistory: [...prev.comprehensionHistory, ...session.comprehensionChanges],
    sessions: [...prev.sessions, { ...session, completedAt: null, activityCompleted: false }],
  };
}

export function createSession(state: ConceptLearningState, at: string): ConceptSession {
  return {
    id: newId("s"),
    number: state.sessions.length + 1,
    startedAt: at,
    completedAt: null,
    initialComprehension: null,
    initialComprehensionAt: null,
    canIdentifyPoints: null,
    canDevelopPoints: null,
    recommended: null,
    activityStarted: false,
    activityCompleted: false,
    performedActivity: null,
    activitiesPerformed: [],
    helpLevel: null,
    hintedPointIds: [],
    consultedFullAnswer: false,
    answer: "",
    pointResults: {},
    development: null,
    relations: null,
    afterComprehension: null,
    comprehensionChanges: [],
    errors: [],
    next: null,
    nextReviewDate: null,
  };
}

// Nivel de dominio: resumen de los cinco indicadores (no reemplaza a ninguno).
export function getMastery(state: ConceptLearningState): { score: number; label: string } {
  const values = Object.values(state.indicators).map((i) => i.value);
  if (values.every((v) => v === null)) return { score: 0, label: "Sin repasos todavía" };
  const points = values.reduce((acc, v) => acc + (v === "yes" ? 2 : v === "partial" ? 1 : 0), 0);
  const score = Math.round((points / 10) * 5);
  const labels = ["Empezando", "Comprendiendo", "Recordando con ayuda", "Desarrollando", "Casi dominado", "Dominado"];
  return { score, label: labels[score] };
}

// Pista de un punto según el nivel de ayuda. Si el punto no tiene la pista de ese nivel, usa la
// siguiente más cercana con más ayuda (imagen → palabras clave/pregunta → título).
export function hintForLevel(point: ConceptPoint, level: HelpLevel): { kind: "title" | "keywords" | "image"; title?: string; keywords?: string; question?: string; imageUrl?: string } {
  const hasKeywords = !!(point.keywords?.trim() || point.question?.trim());
  if (level >= 4 && point.imageUrl) return { kind: "image", imageUrl: point.imageUrl };
  if (level >= 3 && hasKeywords) return { kind: "keywords", keywords: point.keywords?.trim(), question: point.question?.trim() };
  return { kind: "title", title: point.title };
}
