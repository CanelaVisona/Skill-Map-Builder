import { createContext, useContext, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSkillTree } from "@/lib/skill-context";
import { useInsightsCounterPopup } from "@/lib/insights-counter-popup-context";
import { usePowerCelebration } from "@/lib/power-celebration-context";
import { useErrorCelebration } from "@/lib/error-celebration-context";
import { beginPopupChain, endPopupChain, getPopupBusyDelay, runPopupQueueAsync } from "@/lib/popup-coordinator";
import { FIXED_XP_AMOUNT, useApplyExperienceGain, useErrorAdjustPopups, type ErrorAdjustResult } from "@/lib/node-reward-actions";
import { type BodyLink } from "@/components/BodyLinkPicker";
import {
  NodeConfirmFeedbackModal,
  isNodeFeedbackDraftEmpty,
  type FeedbackScope,
  type NodeFeedbackDraft,
  type NodeFeedbackPower,
} from "@/components/NodeConfirmFeedbackModal";

// Modal de feedback post-confirmación ("¿Qué te dejó este nodo?"), global: se abre al confirmar
// un nodo de un área/quest tanto desde el árbol (SkillNode.tsx) como desde "Tareas de hoy"
// (TodayProgressModal.tsx) -- y ahí también al confirmar una tarea suelta, un hábito o una
// práctica, que no tienen nodo ni área/quest. Por eso el modal, sus datos y el guardado de lo
// cargado viven acá y no en SkillNode.
//
// Orden de pop-ups: barra de nivel del área/quest -> (recompensas encoladas del nodo, o los
// pop-ups de XP del hábito/práctica) -> este modal -> pop-ups de lo cargado en él -> "Quest
// updated!" / "¡Subiste de nivel!" / progreso de hoy. Cada pedido abre su propia cadena de
// pop-ups (beginPopupChain) en el mismo tick del click, y esos últimos esperan a que no haya
// cadenas pendientes (runAfterPopupsClear en skill-context.tsx), así que siempre quedan después.
// La cadena se cierra recién cuando lo cargado ya se guardó y sus pop-ups terminaron (o
// enseguida, si no se cargó nada).

export interface NodeConfirmFeedbackTarget {
  // Nodo confirmado. Sin nodo (tarea suelta, hábito, práctica), lo cargado queda sin nodo.
  skillId?: string;
  // Área/quest de lo confirmado. Sin ella, los cubos de error/poder la preguntan.
  scopeType?: "area" | "project";
  scopeId?: string;
}

interface NodeConfirmFeedbackContextValue {
  // `waitFor`: algo que tiene que terminar antes de abrir el modal (p.ej. la secuencia de
  // recompensas encoladas del nodo en SkillNode.tsx, o el confirm de un hábito).
  requestNodeConfirmFeedback: (target: NodeConfirmFeedbackTarget, waitFor?: Promise<unknown>) => void;
  // true mientras el feedback de ese nodo está pendiente/abierto/guardándose -- SkillNode lo usa
  // para ignorar un segundo tap que volvería a confirmar el nodo y duplicaría sus pop-ups.
  isNodeConfirmFeedbackPending: (skillId: string) => boolean;
}

const NodeConfirmFeedbackContext = createContext<NodeConfirmFeedbackContextValue | null>(null);

// Mismo color que SkillTree.tsx le pasa a SkillNode como areaColor (usado por el pop-up de XP).
const AREA_COLOR = "text-zinc-800 dark:text-zinc-200";

const LEGACY_SKILLS = ["Limpieza", "Guitarra", "Lectura", "Growth mindset", "Acertividad"];

// Skills legacy asociados al área/quest (localStorage "legacySkillAssociations", mismo formato
// que lee SkillNode: array de {type, id} o, en datos viejos, un solo objeto).
function readLegacySkillsFor(scope: FeedbackScope): string[] {
  if (!scope) return [];
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(localStorage.getItem("legacySkillAssociations") || "{}");
  } catch {
    return [];
  }
  return LEGACY_SKILLS.filter((name) => {
    const raw = parsed[name];
    const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return list.some((a: any) => a && a.type === scope.type && a.id === scope.id);
  });
}

const targetScope = (target: NodeConfirmFeedbackTarget): FeedbackScope =>
  target.scopeType && target.scopeId ? { type: target.scopeType, id: target.scopeId } : null;

const scopeBody = (scope: FeedbackScope) =>
  !scope ? {} : scope.type === "area" ? { areaId: scope.id } : { projectId: scope.id };

interface ScopeError {
  id: string;
  nombre: string;
  points: number;
  confirmed: 0 | 1;
  estrategias: string[];
  disparadores: string[];
  skillIds: string[];
  bodyLinks: BodyLink[];
  skillId?: string | null;
  areaId?: string | null;
  projectId?: string | null;
}

interface RewardBlock {
  label: string;
  run: (enqueue: (fn: () => void) => void) => Promise<void> | void;
}

const waitForPopupsBusyClear = async () => {
  while (getPopupBusyDelay() > 0) {
    await new Promise((resolve) => setTimeout(resolve, getPopupBusyDelay() + 150));
  }
};

export function NodeConfirmFeedbackProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { areas, projects, globalSkills, getGlobalSkillsForArea, getGlobalSkillsForProject } = useSkillTree();
  const { showInsightsCounterPopup } = useInsightsCounterPopup();
  const { showPowerCelebration } = usePowerCelebration();
  const { showErrorCelebration } = useErrorCelebration();
  const applyExperienceGain = useApplyExperienceGain();
  const runErrorAdjustPopups = useErrorAdjustPopups();

  const [active, setActive] = useState<NodeConfirmFeedbackTarget | null>(null);
  // Área/quest elegida dentro del modal (cubos de error/poder) cuando lo confirmado no tiene.
  const [pickedScope, setPickedScope] = useState<FeedbackScope>(null);
  const queue = useRef<Array<{ target: NodeConfirmFeedbackTarget; waitFor?: Promise<unknown> }>>([]);
  const processing = useRef(false);
  const pendingSkillIds = useRef<Map<string, number>>(new Map());
  const finishResolver = useRef<((draft: NodeFeedbackDraft) => void) | null>(null);

  const activeScope = active ? targetScope(active) : null;
  // Área/quest cuyos poderes/errores se listan en el modal.
  const listScope: FeedbackScope = activeScope ?? pickedScope;

  const powersUrl = listScope ? `/api/source-powers/${listScope.type}/${listScope.id}` : "/api/source-powers/none/none";
  const { data: powers = [] } = useQuery<NodeFeedbackPower[]>({
    queryKey: [powersUrl],
    queryFn: async () => {
      const res = await fetch(powersUrl);
      if (!res.ok) throw new Error("Failed to fetch powers");
      return res.json();
    },
    enabled: !!active,
  });

  // Nodo con área/quest: misma query que SkillNode (comparten caché e invalidaciones).
  const { data: nodeErrors = [] } = useQuery<ScopeError[]>({
    queryKey: [`/api/node-errors/${active?.skillId}`, activeScope?.type, activeScope?.id],
    queryFn: async () => {
      if (!active?.skillId || !activeScope) return [];
      const param = activeScope.type === "area" ? "areaId" : "projectId";
      const res = await fetch(`/api/node-errors/${active.skillId}?${param}=${activeScope.id}`);
      if (!res.ok) throw new Error("Failed to fetch node errors");
      return res.json();
    },
    enabled: !!active?.skillId && !!activeScope,
  });

  // Sin nodo: todos los errores, filtrados por el área/quest elegida (o los sueltos).
  const { data: allErrors = [] } = useQuery<ScopeError[]>({
    queryKey: ["/api/node-errors"],
    queryFn: async () => {
      const res = await fetch("/api/node-errors");
      if (!res.ok) throw new Error("Failed to fetch node errors");
      return res.json();
    },
    enabled: !!active && !(active.skillId && activeScope),
  });

  const listErrors: ScopeError[] = active?.skillId && activeScope
    ? nodeErrors
    : allErrors.filter((e) =>
        !listScope
          ? !e.skillId && !e.areaId && !e.projectId
          : listScope.type === "area" ? e.areaId === listScope.id : e.projectId === listScope.id
      );

  const getJournalEntryCount = async (kind: "learnings" | "strategies" | "tools" | "thoughts", scope: FeedbackScope) => {
    const url = scope
      ? `/api/journal/${kind}?${scope.type === "area" ? "areaId" : "projectId"}=${scope.id}`
      : `/api/journal/${kind}`;
    const entries = await queryClient.fetchQuery<Array<unknown>>({ queryKey: [url], staleTime: 0 });
    return entries?.length ?? 0;
  };

  const postJson = async <T,>(url: string, method: "POST" | "PATCH", body: unknown): Promise<T> => {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`${method} ${url} failed: ${res.status}`);
    return res.json();
  };

  const invalidateScope = (scope: FeedbackScope) => {
    queryClient.invalidateQueries({ queryKey: ["/api/node-errors"] });
    if (scope) {
      queryClient.invalidateQueries({ queryKey: [`/api/source-bugs/${scope.type}/${scope.id}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/source-powers/${scope.type}/${scope.id}`] });
    } else {
      queryClient.invalidateQueries({ queryKey: ["/api/source-powers/none/none"] });
    }
  };

  const confirmError = async (scope: FeedbackScope, errorId: string, enqueue: (fn: () => void) => void) => {
    // Con área/quest, el confirm crea su bug vinculado.
    const updated = await postJson<{ nombre: string }>(`/api/node-errors/${errorId}`, "PATCH", { confirmed: 1 });
    invalidateScope(scope);
    enqueue(() => showErrorCelebration({ name: updated.nombre, kind: "detected" }));
  };

  const unlockOrMasterPower = async (scope: FeedbackScope, power: NodeFeedbackPower, enqueue: (fn: () => void) => void) => {
    if (power.isUnlocked === 2) return;
    const nextState = power.isUnlocked === 0 ? 1 : 2;
    await postJson(`/api/source-powers/${power.id}`, "PATCH", { isUnlocked: nextState });
    invalidateScope(scope);
    enqueue(() => showPowerCelebration({ name: power.name, kind: nextState === 1 ? "unlocked" : "confirmed" }));
  };

  // Guarda lo cargado en el modal y muestra sus pop-ups, de a un bloque por vez.
  const commit = async (target: NodeConfirmFeedbackTarget, draft: NodeFeedbackDraft) => {
    const skillId = target.skillId ?? null;
    const confirmedScope = targetScope(target);
    const blocks: RewardBlock[] = [];

    const journalBlock = (kind: "thoughts" | "learnings" | "strategies" | "tools", popupType: "thought" | "learning" | "strategy" | "tool", entry: { title: string; sentence: string }): RewardBlock => ({
      label: `+${popupType}: ${entry.title}`,
      run: async (enqueue) => {
        const countBefore = await getJournalEntryCount(kind, confirmedScope);
        await postJson(`/api/journal/${kind}`, "POST", { title: entry.title, sentence: entry.sentence, skillId });
        queryClient.invalidateQueries({ queryKey: [`/api/journal/${kind}`] });
        enqueue(() => showInsightsCounterPopup({ type: popupType, countBefore, countAfter: countBefore + 1 }));
      },
    });

    draft.thoughts.forEach((t) => blocks.push(journalBlock("thoughts", "thought", t)));
    draft.learnings.forEach((l) => blocks.push(journalBlock("learnings", "learning", l)));
    draft.strategies.forEach((st) => blocks.push(journalBlock("strategies", "strategy", st)));
    draft.tools.forEach((t) => blocks.push(journalBlock("tools", "tool", t)));

    // Error nuevo: se crea y se confirma de una ("¡Error nuevo detectado!"). Va con el nodo solo
    // si es de la misma área/quest que el nodo confirmado.
    for (const { scope, ...error } of draft.errors) {
      blocks.push({
        label: `+Error: ${error.nombre}`,
        run: async (enqueue) => {
          const created = await postJson<{ id: string }>("/api/node-errors", "POST", {
            ...(skillId && confirmedScope ? { skillId } : {}),
            ...scopeBody(scope),
            ...error,
          });
          await confirmError(scope, created.id, enqueue);
        },
      });
    }

    // Error existente: confirmar uno recién detectado, o +10p/-10p con estrategia/disparador.
    for (const action of draft.errorActions) {
      blocks.push({
        label: `Error: ${action.errorName}`,
        run: async (enqueue) => {
          if (action.type === "confirm") {
            await confirmError(action.scope, action.errorId, enqueue);
            return;
          }
          const field = action.delta > 0 ? "estrategias" : "disparadores";
          if (action.isNew) {
            await postJson(`/api/node-errors/${action.errorId}`, "PATCH", { [field]: [...action.savedOptions, action.value] });
          }
          const result = await postJson<ErrorAdjustResult>(`/api/node-errors/${action.errorId}/records`, "POST", {
            delta: action.delta,
            estrategia: action.delta > 0 ? action.value : null,
            disparador: action.delta < 0 ? action.value : null,
          });
          invalidateScope(action.scope);
          await runErrorAdjustPopups(result, action.delta, action.links, AREA_COLOR);
        },
      });
    }

    for (const xpSkillId of draft.xpSkillIds) {
      blocks.push({
        label: `+${FIXED_XP_AMOUNT}xp ${xpSkillId}`,
        run: (enqueue) => applyExperienceGain(xpSkillId, AREA_COLOR, enqueue),
      });
    }

    for (const { power, scope } of draft.powers) {
      blocks.push({ label: `+${power.name}`, run: (enqueue) => unlockOrMasterPower(scope, power, enqueue) });
    }

    // Poder nuevo: se crea bloqueado y se desbloquea de una, con su pop-up de "desbloqueado".
    for (const { scope, ...newPower } of draft.newPowers) {
      blocks.push({
        label: `+Poder: ${newPower.name}`,
        run: async (enqueue) => {
          const created = await postJson<NodeFeedbackPower>("/api/source-powers", "POST", {
            name: newPower.name,
            description: newPower.description,
            isUnlocked: 0,
            ...scopeBody(scope),
          });
          await unlockOrMasterPower(scope, created, enqueue);
        },
      });
    }

    for (const block of blocks) {
      try {
        const tasks: Array<() => void> = [];
        await block.run((fn) => tasks.push(fn));
        await runPopupQueueAsync(tasks);
      } catch (error) {
        console.error("[nodeConfirmFeedback] Reward block failed:", block.label, error);
      }
      await waitForPopupsBusyClear();
    }

    if (skillId) {
      queryClient.invalidateQueries({ queryKey: [`/api/node-errors/${skillId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/journal/thoughts", skillId] });
      queryClient.invalidateQueries({ queryKey: ["/api/journal/learnings", skillId] });
      queryClient.invalidateQueries({ queryKey: ["/api/journal/strategies", skillId] });
      queryClient.invalidateQueries({ queryKey: ["/api/journal/tools", skillId] });
    }
  };

  // processQueue corre a lo largo de varios renders: siempre usa el commit del último render.
  const commitRef = useRef(commit);
  commitRef.current = commit;

  const processQueue = async () => {
    processing.current = true;
    while (queue.current.length > 0) {
      const { target, waitFor } = queue.current.shift()!;
      try {
        if (waitFor) await waitFor.catch(() => undefined);
        // Busy tiene que quedar libre un rato: el pop-up de la barra de nivel recién aparece
        // ~150ms después de que vence su reserva de busy (runAfterBusyClears en skill-context),
        // así que un solo chequeo justo al liberarse le podría ganar y abrir el modal encima.
        do {
          await waitForPopupsBusyClear();
          await new Promise((resolve) => setTimeout(resolve, 400));
        } while (getPopupBusyDelay() > 0);

        const draft = await new Promise<NodeFeedbackDraft>((resolve) => {
          finishResolver.current = resolve;
          setPickedScope(null);
          setActive(target);
        });
        if (!isNodeFeedbackDraftEmpty(draft)) await commitRef.current(target, draft);
      } catch (error) {
        console.error("[nodeConfirmFeedback] Failed:", error);
      } finally {
        if (target.skillId) {
          const left = (pendingSkillIds.current.get(target.skillId) ?? 1) - 1;
          if (left > 0) pendingSkillIds.current.set(target.skillId, left);
          else pendingSkillIds.current.delete(target.skillId);
        }
        endPopupChain();
      }
    }
    processing.current = false;
  };

  const requestNodeConfirmFeedback = (target: NodeConfirmFeedbackTarget, waitFor?: Promise<unknown>) => {
    // Sincrónico, en el mismo tick que la confirmación: "Quest updated!" ya sabe que tiene que
    // esperar.
    beginPopupChain();
    if (target.skillId) {
      pendingSkillIds.current.set(target.skillId, (pendingSkillIds.current.get(target.skillId) ?? 0) + 1);
    }
    queue.current.push({ target, waitFor });
    if (!processing.current) void processQueue();
  };

  const handleFinish = (draft: NodeFeedbackDraft) => {
    const resolve = finishResolver.current;
    if (!resolve) return;
    finishResolver.current = null;
    setActive(null);
    resolve(draft);
  };

  const skillDisplayName = (id: string) =>
    id.startsWith("legacy:") ? id.replace("legacy:", "") : (globalSkills.find((s) => s.id === id)?.name || "Skill");

  return (
    <NodeConfirmFeedbackContext.Provider
      value={{ requestNodeConfirmFeedback, isNodeConfirmFeedbackPending: (skillId) => pendingSkillIds.current.has(skillId) }}
    >
      {children}
      <NodeConfirmFeedbackModal
        open={!!active}
        onFinish={handleFinish}
        xpAmount={FIXED_XP_AMOUNT}
        skillDisplayName={skillDisplayName}
        fixedScope={activeScope ?? undefined}
        onListScopeChange={setPickedScope}
        powers={powers}
        errors={listErrors}
        legacySkills={readLegacySkillsFor(activeScope)}
        scopedGlobalSkills={activeScope ? (activeScope.type === "area" ? getGlobalSkillsForArea(activeScope.id) : getGlobalSkillsForProject(activeScope.id)) : globalSkills}
        areas={areas}
        projects={projects}
        currentAreaId={activeScope?.type === "area" ? activeScope.id : undefined}
        currentProjectId={activeScope?.type === "project" ? activeScope.id : undefined}
        getGlobalSkillsForArea={getGlobalSkillsForArea}
        getGlobalSkillsForProject={getGlobalSkillsForProject}
      />
    </NodeConfirmFeedbackContext.Provider>
  );
}

export function useNodeConfirmFeedback() {
  const ctx = useContext(NodeConfirmFeedbackContext);
  if (!ctx) throw new Error("useNodeConfirmFeedback must be used within NodeConfirmFeedbackProvider");
  return ctx;
}
