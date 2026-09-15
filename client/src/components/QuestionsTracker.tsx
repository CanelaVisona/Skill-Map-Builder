"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ArrowLeft, Trash2, Pencil, ChevronRight, ChevronLeft, Swords, Check, RotateCcw } from "lucide-react";

// Frases a detectar en el paso 2 del planteo del problema ("no sé cómo…" / "no sé qué hacer…").
const FORBIDDEN_PHRASE_RE = /\bno s[eé] (c[oó]mo|qu[eé] hacer)\b/i;

// Estilo de la sección "más destacada" de la cadena Problema → Meta final → Preguntas: letra
// blanca sobre fondo oscuro con borde brillante. Las secciones ya superadas se atenúan en cambio
// con SUPERSEDED_STAGE_CLASS.
const CURRENT_STAGE_CLASS =
  "border-2 border-white/90 bg-zinc-900 text-white shadow-[0_0_14px_3px_rgba(255,255,255,0.45)]";
const SUPERSEDED_STAGE_CLASS = "border-border/30 text-muted-foreground/60";

interface AreaLite {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  archived?: 0 | 1 | null;
}

interface ProjectLite {
  id: string;
  name: string;
  icon?: string;
  archived?: 0 | 1 | null;
}

// Un "scope" es dónde vive un problema: un área o un quest (proyecto) -- ambos son quests en el
// resto de la app, así que se muestran juntos como pestañas.
type Scope = { kind: "area" | "project"; id: string };

interface QuestionItem {
  id: string;
  problemId: string;
  question: string;
  answer: string;
  action: string;
}

interface QuestionProblem {
  id: string;
  areaId: string | null;
  projectId: string | null;
  text: string;
  // Meta final: qué se busca realmente detrás del problema (experiencias, crecimiento o
  // contribución). Sección propia entre "Problemas" y "Preguntas".
  goal: string;
  foundAt: string | null;
  items: QuestionItem[];
}

const LONG_PRESS_MS = 550;

const chainComplete = (it: QuestionItem) =>
  it.question.trim().length > 0 && it.answer.trim().length > 0 && it.action.trim().length > 0;

const problemHasFoundChain = (p: QuestionProblem) => p.items.some(chainComplete);

// Mantener presionado el fondo de una columna (fuera de una tarjeta) para agregar.
function useBackgroundLongPress(onLongPress: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };
  return {
    onPointerDown: (e: React.PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-entry-card]") || target?.closest("[data-no-longpress]")) return;
      clear();
      timer.current = setTimeout(onLongPress, LONG_PRESS_MS);
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
  };
}

// Mantener presionada una tarjeta (problema o pregunta) abre la barra de Editar/Borrar; un toque
// corto la selecciona/abre. El estado "fue longpress" vive en un ref -- no en una variable local
// del render -- porque abrir la barra dispara un setState (y por lo tanto un re-render) mientras
// el dedo sigue apoyado; con una variable local, ese re-render la reiniciaría antes de que llegue
// el click posterior al soltar, y la tarjeta terminaba seleccionándose (dividiendo la pantalla en
// Problemas/Preguntas) en vez de mostrar la barra de acciones.
function useLongPressSelect(onLongPress: () => void, onSelect: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);
  const clear = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };
  return {
    onPointerDown: (e: React.PointerEvent) => {
      if ((e.target as HTMLElement | null)?.closest("[data-no-longpress]")) return;
      longPressed.current = false;
      clear();
      timer.current = setTimeout(() => {
        longPressed.current = true;
        onLongPress();
      }, LONG_PRESS_MS);
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onClick: () => {
      if (longPressed.current) {
        longPressed.current = false;
        return;
      }
      onSelect();
    },
  };
}

export function QuestionsTracker() {
  const queryClient = useQueryClient();

  const { data: areas = [] } = useQuery<AreaLite[]>({
    queryKey: ["/api/areas"],
    queryFn: async () => {
      const res = await fetch("/api/areas", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch areas");
      return res.json();
    },
  });

  const { data: projects = [] } = useQuery<ProjectLite[]>({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch projects");
      return res.json();
    },
  });

  const { data: problems = [], isLoading } = useQuery<QuestionProblem[]>({
    queryKey: ["/api/question-problems"],
    queryFn: async () => {
      const res = await fetch("/api/question-problems", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch question problems");
      return res.json();
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/question-problems"] });

  const createProblem = useMutation({
    mutationFn: async (body: { areaId?: string; projectId?: string; text: string }) => {
      const res = await fetch("/api/question-problems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to create problem");
      return res.json();
    },
    onSuccess: invalidate,
  });

  const updateProblem = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; text?: string; goal?: string; found?: boolean }) => {
      const res = await fetch(`/api/question-problems/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Failed to update problem");
      return res.json();
    },
    onSuccess: invalidate,
  });

  const deleteProblem = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/question-problems/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete problem");
    },
    onSuccess: invalidate,
  });

  const createItem = useMutation({
    mutationFn: async ({ problemId, question }: { problemId: string; question: string }) => {
      const res = await fetch(`/api/question-problems/${problemId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ question }),
      });
      if (!res.ok) throw new Error("Failed to create question");
      return res.json();
    },
    onSuccess: invalidate,
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; question?: string; answer?: string; action?: string }) => {
      const res = await fetch(`/api/question-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Failed to update question");
      return res.json();
    },
    onSuccess: invalidate,
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/question-items/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete question");
    },
    onSuccess: invalidate,
  });

  const activeAreas = useMemo(() => areas.filter((a) => !a.archived), [areas]);
  const activeProjects = useMemo(() => projects.filter((p) => !p.archived), [projects]);

  const [view, setView] = useState<"active" | "found">("active");
  const [scope, setScope] = useState<Scope | null>(null);
  const [selectedProblemId, setSelectedProblemId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Wizard "Planteo del problema": 3 pasos guiados para cargar un problema nuevo.
  const [problemWizardOpen, setProblemWizardOpen] = useState(false);
  const [problemWizardStep, setProblemWizardStep] = useState(0);
  const [pwRaw, setPwRaw] = useState(""); // paso 1: el problema tal como viene a la cabeza
  const [pwStep2, setPwStep2] = useState(""); // paso 2: qué pasa objetivamente y cómo te sentís con eso
  const [pwFinal, setPwFinal] = useState(""); // paso 3: versión final, limpia de "no sé cómo/qué hacer…"

  // Wizard "Hacer la pregunta": 2 pasos guiados para cargar una pregunta nueva.
  const [questionWizardOpen, setQuestionWizardOpen] = useState(false);
  const [questionWizardStep, setQuestionWizardStep] = useState(0);
  const [qwRaw, setQwRaw] = useState(""); // paso 1: la pregunta como salga
  const [qwFinal, setQwFinal] = useState(""); // paso 2: reformulada con la estructura guía

  const [editingProblemId, setEditingProblemId] = useState<string | null>(null);
  const [editingProblemText, setEditingProblemText] = useState("");
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editingQuestionText, setEditingQuestionText] = useState("");

  // Tarjeta con la barra "Editar / Borrar" abierta (se abre manteniendo presionada la tarjeta).
  const [problemActionsId, setProblemActionsId] = useState<string | null>(null);
  const [questionActionsId, setQuestionActionsId] = useState<string | null>(null);

  // Wizard "Meta final": 5 pasos guiados para derivar la meta final de un problema.
  const [metaWizardOpen, setMetaWizardOpen] = useState(false);
  const [metaWizardStep, setMetaWizardStep] = useState(0);
  const [mwStep1, setMwStep1] = useState(""); // qué se busca realmente (experiencias/crecimiento/contribución)
  const [mwStep2, setMwStep2] = useState(""); // por qué (para qué se lo busca)
  const [mwStep3, setMwStep3] = useState(""); // sin la meta intermedia ("de manera que")
  const [mwStep4, setMwStep4] = useState(""); // meta autoalimentada (depende 100% de uno)
  const [mwStep5, setMwStep5] = useState(""); // versión final, sin "no sé cómo/qué hacer…"

  const [answerDraft, setAnswerDraft] = useState("");
  const [actionDraft, setActionDraft] = useState("");
  const [editingAnswer, setEditingAnswer] = useState(false);
  const [editingAction, setEditingAction] = useState(false);

  // Default al primer área/quest disponible.
  useEffect(() => {
    if (!scope && activeAreas.length > 0) {
      setScope({ kind: "area", id: activeAreas[0].id });
    } else if (!scope && activeProjects.length > 0) {
      setScope({ kind: "project", id: activeProjects[0].id });
    }
  }, [activeAreas, activeProjects, scope]);

  const selectedProblem = useMemo(
    () => problems.find((p) => p.id === selectedProblemId) ?? null,
    [problems, selectedProblemId],
  );
  const selectedItem = useMemo(
    () => selectedProblem?.items.find((it) => it.id === selectedItemId) ?? null,
    [selectedProblem, selectedItemId],
  );

  // Sincroniza los borradores de respuesta/acción al cambiar de cadena.
  useEffect(() => {
    setAnswerDraft(selectedItem?.answer ?? "");
    setActionDraft(selectedItem?.action ?? "");
    setEditingAnswer(false);
    setEditingAction(false);
  }, [selectedItemId]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetSelection = () => {
    setSelectedProblemId(null);
    setSelectedItemId(null);
    setEditingProblemId(null);
    setEditingQuestionId(null);
    setProblemActionsId(null);
    setQuestionActionsId(null);
  };

  const problemsForArea = useMemo(
    () =>
      problems.filter((p) => {
        const inScope = scope?.kind === "project" ? p.projectId === scope.id : p.areaId === scope?.id;
        return inScope && (view === "found" ? !!p.foundAt : !p.foundAt);
      }),
    [problems, scope, view],
  );

  // "Meta final" aparece al seleccionar un problema activo (no encontrado); "Preguntas" recién
  // se desbloquea una vez que esa meta final quedó definida.
  const showMetaCol = !!selectedProblem && !selectedProblem.foundAt;
  const showQuestionsCol = showMetaCol && !!selectedProblem?.goal.trim();
  const showAnswerCol = showQuestionsCol && !!selectedItem;
  const showActionCol = showAnswerCol && answerDraft.trim().length > 0;

  // Cadena Problema → Meta final → Preguntas: la última sección completada es siempre la más
  // destacada (letra blanca, borde brillante) y las anteriores se atenúan a medida que el
  // problema avanza, para guiar la mirada hacia dónde seguir trabajando.
  const metaHasContent = !!selectedProblem?.goal.trim();
  const questionsHaveContent = (selectedProblem?.items.length ?? 0) > 0;
  const problemIsSuperseded = !!selectedProblem && metaHasContent;
  const metaIsCurrent = showMetaCol && metaHasContent && !questionsHaveContent;
  const metaIsSuperseded = showMetaCol && metaHasContent && questionsHaveContent;
  const questionsAreCurrent = showQuestionsCol && questionsHaveContent;

  const visibleCols =
    1 + (showMetaCol ? 1 : 0) + (showQuestionsCol ? 1 : 0) + (showAnswerCol ? 1 : 0) + (showActionCol ? 1 : 0);
  const colClass = (index: number) =>
    cn(
      "h-full pr-2",
      index === visibleCols - 1
        ? "flex-1 min-w-[190px]"
        : "w-[52%] sm:w-[210px] shrink-0 border-r border-border/40",
    );

  const closeProblemWizard = () => {
    setProblemWizardOpen(false);
    setProblemWizardStep(0);
    setPwRaw("");
    setPwStep2("");
    setPwFinal("");
  };

  const openProblemWizard = () => {
    if (!scope) return;
    closeProblemWizard();
    setProblemWizardOpen(true);
  };

  const pwHasForbiddenPhrase = FORBIDDEN_PHRASE_RE.test(pwFinal);

  const handleSubmitProblem = () => {
    const text = pwFinal.trim();
    if (!text || !scope || pwHasForbiddenPhrase) return;
    createProblem.mutate(
      scope.kind === "project" ? { projectId: scope.id, text } : { areaId: scope.id, text },
    );
    closeProblemWizard();
  };

  const closeQuestionWizard = () => {
    setQuestionWizardOpen(false);
    setQuestionWizardStep(0);
    setQwRaw("");
    setQwFinal("");
  };

  const openQuestionWizard = () => {
    if (!selectedProblem) return;
    closeQuestionWizard();
    setQuestionWizardOpen(true);
  };

  const handleSubmitQuestion = () => {
    if (!selectedProblem) return;
    const question = qwFinal.trim();
    if (!question) return;
    createItem.mutate({ problemId: selectedProblem.id, question });
    closeQuestionWizard();
  };

  const closeMetaWizard = () => {
    setMetaWizardOpen(false);
    setMetaWizardStep(0);
    setMwStep1("");
    setMwStep2("");
    setMwStep3("");
    setMwStep4("");
    setMwStep5("");
  };

  const openMetaWizard = () => {
    if (!selectedProblem) return;
    setMetaWizardStep(0);
    setMwStep1(selectedProblem.goal || "");
    setMwStep2("");
    setMwStep3("");
    setMwStep4("");
    setMwStep5("");
    setMetaWizardOpen(true);
  };

  const mwHasForbiddenPhrase = FORBIDDEN_PHRASE_RE.test(mwStep5);

  const handleSubmitMeta = () => {
    if (!selectedProblem) return;
    const text = mwStep5.trim();
    if (!text || mwHasForbiddenPhrase) return;
    updateProblem.mutate({ id: selectedProblem.id, goal: text });
    closeMetaWizard();
  };

  const commitAnswer = () => {
    setEditingAnswer(false);
    if (!selectedItem) return;
    if (answerDraft.trim() !== selectedItem.answer.trim()) {
      updateItem.mutate({ id: selectedItem.id, answer: answerDraft.trim() });
    }
  };

  const commitAction = () => {
    setEditingAction(false);
    if (!selectedItem) return;
    if (actionDraft.trim() !== selectedItem.action.trim()) {
      updateItem.mutate({ id: selectedItem.id, action: actionDraft.trim() });
    }
  };

  const handleFound = () => {
    if (!selectedProblem) return;
    updateProblem.mutate({ id: selectedProblem.id, found: true });
    resetSelection();
  };

  const problemsPress = useBackgroundLongPress(openProblemWizard);
  const questionsPress = useBackgroundLongPress(openQuestionWizard);
  const answerPress = useBackgroundLongPress(() => setEditingAnswer(true));
  const actionPress = useBackgroundLongPress(() => setEditingAction(true));

  const selectedScopeName =
    scope?.kind === "project"
      ? activeProjects.find((p) => p.id === scope.id)?.name
      : activeAreas.find((a) => a.id === scope?.id)?.name;

  // Cantidad de problemas activos (no encontrados) por área/quest, para el númerito de las pestañas.
  const activeProblemCountByAreaId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of problems) {
      if (p.foundAt || !p.areaId) continue;
      counts.set(p.areaId, (counts.get(p.areaId) ?? 0) + 1);
    }
    return counts;
  }, [problems]);
  const activeProblemCountByProjectId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of problems) {
      if (p.foundAt || !p.projectId) continue;
      counts.set(p.projectId, (counts.get(p.projectId) ?? 0) + 1);
    }
    return counts;
  }, [problems]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border/30 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {view === "found" && (
            <button
              onClick={() => {
                setView("active");
                resetSelection();
              }}
              className="flex-shrink-0 text-muted-foreground transition-colors hover:text-foreground"
              title="Volver"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <h2 className="truncate text-lg font-black text-foreground">
            {view === "found" ? "Encontrados ⚔️" : "Preguntas"}
          </h2>
        </div>
        {view === "active" ? (
          <button
            onClick={() => {
              setView("found");
              resetSelection();
            }}
            className="flex flex-shrink-0 items-center gap-1 rounded-full border border-border/50 px-3 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <Swords size={13} /> Encontrados
          </button>
        ) : null}
      </div>

      {/* Área / quest tabs */}
      {activeAreas.length > 0 || activeProjects.length > 0 ? (
        <div className="scrollbar-hide flex flex-nowrap items-center gap-1 overflow-x-auto border-b border-border/30 px-3 py-2">
          {activeAreas.map((area) => {
            const count = activeProblemCountByAreaId.get(area.id) ?? 0;
            const isSelected = scope?.kind === "area" && scope.id === area.id;
            return (
              <div key={`area-${area.id}`} className="relative shrink-0 pt-2.5">
                {count > 0 && (
                  <span className="absolute -top-0.5 left-1/2 z-10 -translate-x-1/2 text-[9px] font-bold leading-none text-muted-foreground">
                    {count}
                  </span>
                )}
                <button
                  onClick={() => {
                    setScope({ kind: "area", id: area.id });
                    resetSelection();
                  }}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                    isSelected
                      ? "bg-foreground text-background"
                      : "bg-muted/60 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {area.name}
                </button>
              </div>
            );
          })}
          {activeAreas.length > 0 && activeProjects.length > 0 && (
            <div className="mx-1 h-4 w-px shrink-0 bg-border/50" />
          )}
          {activeProjects.map((project) => {
            const count = activeProblemCountByProjectId.get(project.id) ?? 0;
            const isSelected = scope?.kind === "project" && scope.id === project.id;
            return (
              <div key={`project-${project.id}`} className="relative shrink-0 pt-2.5">
                {count > 0 && (
                  <span className="absolute -top-0.5 left-1/2 z-10 -translate-x-1/2 text-[9px] font-bold leading-none text-muted-foreground">
                    {count}
                  </span>
                )}
                <button
                  onClick={() => {
                    setScope({ kind: "project", id: project.id });
                    resetSelection();
                  }}
                  className={cn(
                    "flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                    isSelected
                      ? "bg-foreground text-background"
                      : "bg-muted/60 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Swords size={11} /> {project.name}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="px-4 py-6 text-sm text-muted-foreground">No hay áreas ni quests todavía.</div>
      )}

      {/* Body */}
      <div className="min-h-0 flex-1 px-3 py-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : view === "found" ? (
          <FoundList
            problems={problemsForArea}
            onRestore={(id) => updateProblem.mutate({ id, found: false })}
            onDelete={(id) => deleteProblem.mutate(id)}
          />
        ) : (
          <div className="flex h-full gap-2 overflow-x-auto">
            {/* Col 1 — Problemas */}
            <ScrollArea className={colClass(0)} {...problemsPress}>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Problemas{selectedScopeName ? ` · ${selectedScopeName}` : ""}
                </p>
              </div>
              <div className="space-y-1.5 pr-1">
                {problemsForArea.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Mantené presionado el fondo para agregar un problema.
                  </p>
                )}
                {problemsForArea.map((p) => (
                  <ProblemCard
                    key={p.id}
                    problem={p}
                    emphasis={
                      p.id !== selectedProblemId ? "none" : problemIsSuperseded ? "superseded" : "current"
                    }
                    isEditing={editingProblemId === p.id}
                    showActions={problemActionsId === p.id}
                    editingText={editingProblemText}
                    onEditingTextChange={setEditingProblemText}
                    onCommitEdit={() => {
                      updateProblem.mutate({ id: p.id, text: editingProblemText.trim() });
                      setEditingProblemId(null);
                    }}
                    onCancelEdit={() => setEditingProblemId(null)}
                    onOpen={() => {
                      setProblemActionsId(null);
                      setSelectedProblemId(p.id);
                      setSelectedItemId(null);
                    }}
                    onLongPress={() => setProblemActionsId(p.id)}
                    onStartEdit={() => {
                      setEditingProblemId(p.id);
                      setEditingProblemText(p.text);
                      setProblemActionsId(null);
                    }}
                    onDelete={() => {
                      if (selectedProblemId === p.id) resetSelection();
                      deleteProblem.mutate(p.id);
                      setProblemActionsId(null);
                    }}
                  />
                ))}
              </div>
            </ScrollArea>

            {/* Col 2 — Meta final */}
            {showMetaCol && selectedProblem && (
              <ScrollArea className={colClass(1)}>
                <p
                  className={cn(
                    "mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide",
                    metaIsCurrent ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {metaIsCurrent && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-foreground" />}
                  Meta final
                </p>
                <div
                  onClick={openMetaWizard}
                  className={cn(
                    "cursor-pointer select-none rounded-xl border p-2 text-sm transition-colors",
                    !selectedProblem.goal.trim()
                      ? "border-dashed border-border/60 hover:bg-muted/40"
                      : metaIsCurrent
                        ? CURRENT_STAGE_CLASS
                        : metaIsSuperseded
                          ? SUPERSEDED_STAGE_CLASS
                          : "border-border/50 hover:bg-muted/40",
                  )}
                >
                  <p
                    className={cn(
                      "break-words text-xs",
                      metaIsCurrent ? "text-white" : "text-muted-foreground",
                    )}
                  >
                    {selectedProblem.goal.trim() || "Tocá para definir la meta final y desbloquear las preguntas."}
                  </p>
                </div>
              </ScrollArea>
            )}

            {/* Col 3 — Preguntas */}
            {showQuestionsCol && selectedProblem && (
              <ScrollArea className={colClass(2)} {...questionsPress}>
                <p
                  className={cn(
                    "mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide",
                    questionsAreCurrent ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {questionsAreCurrent && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-foreground" />}
                  Preguntas
                </p>
                <div className="space-y-1.5 pr-1">
                  {selectedProblem.items.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Mantené presionado el fondo para agregar una pregunta.
                    </p>
                  )}
                  {selectedProblem.items.map((it) => (
                    <QuestionCard
                      key={it.id}
                      item={it}
                      isSelected={it.id === selectedItemId}
                      highlighted={questionsAreCurrent}
                      isEditing={editingQuestionId === it.id}
                      showActions={questionActionsId === it.id}
                      editingText={editingQuestionText}
                      onEditingTextChange={setEditingQuestionText}
                      onCommitEdit={() => {
                        updateItem.mutate({ id: it.id, question: editingQuestionText.trim() });
                        setEditingQuestionId(null);
                      }}
                      onCancelEdit={() => setEditingQuestionId(null)}
                      onOpen={() => {
                        setQuestionActionsId(null);
                        setSelectedItemId(it.id);
                      }}
                      onLongPress={() => setQuestionActionsId(it.id)}
                      onStartEdit={() => {
                        setEditingQuestionId(it.id);
                        setEditingQuestionText(it.question);
                        setQuestionActionsId(null);
                      }}
                      onDelete={() => {
                        if (selectedItemId === it.id) setSelectedItemId(null);
                        deleteItem.mutate(it.id);
                        setQuestionActionsId(null);
                      }}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}

            {/* Col 4 — Respuesta */}
            {showAnswerCol && selectedItem && (
              <ScrollArea className={colClass(3)} {...answerPress}>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Respuesta
                </p>
                <p className="mb-2 rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground break-words">
                  {selectedItem.question || "(sin pregunta)"}
                </p>
                {editingAnswer || answerDraft.trim() ? (
                  <Textarea
                    data-no-longpress
                    autoFocus={editingAnswer}
                    value={answerDraft}
                    onChange={(e) => setAnswerDraft(e.target.value)}
                    onFocus={() => setEditingAnswer(true)}
                    onBlur={commitAnswer}
                    placeholder="Escribí la respuesta…"
                    className="min-h-[120px] text-sm"
                  />
                ) : (
                  <p className="rounded-lg border border-dashed border-border/60 p-3 text-xs text-muted-foreground">
                    Mantené presionado el fondo para agregar la respuesta.
                  </p>
                )}
              </ScrollArea>
            )}

            {/* Col 5 — Acción */}
            {showActionCol && selectedItem && selectedProblem && (
              <ScrollArea className={colClass(4)} {...actionPress}>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Acción
                </p>
                <p className="mb-2 rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground break-words">
                  {answerDraft || "(sin respuesta)"}
                </p>
                {editingAction || actionDraft.trim() ? (
                  <Textarea
                    data-no-longpress
                    autoFocus={editingAction}
                    value={actionDraft}
                    onChange={(e) => setActionDraft(e.target.value)}
                    onFocus={() => setEditingAction(true)}
                    onBlur={commitAction}
                    placeholder="Escribí la acción…"
                    className="min-h-[120px] text-sm"
                  />
                ) : (
                  <p className="rounded-lg border border-dashed border-border/60 p-3 text-xs text-muted-foreground">
                    Mantené presionado el fondo para agregar la acción.
                  </p>
                )}
                {selectedItem.question.trim() && answerDraft.trim() && actionDraft.trim() && (
                  <Button
                    data-no-longpress
                    onClick={() => {
                      commitAction();
                      handleFound();
                    }}
                    className="mt-3 w-full bg-amber-500/20 text-amber-700 hover:bg-amber-500/30 dark:text-amber-400"
                    variant="outline"
                  >
                    Encontrado ⚔️
                  </Button>
                )}
              </ScrollArea>
            )}
          </div>
        )}
      </div>

      <ProblemWizardDialog
        open={problemWizardOpen}
        step={problemWizardStep}
        raw={pwRaw}
        step2={pwStep2}
        final={pwFinal}
        hasForbiddenPhrase={pwHasForbiddenPhrase}
        onRawChange={setPwRaw}
        onStep2Change={setPwStep2}
        onFinalChange={setPwFinal}
        onBack={() => setProblemWizardStep((s) => Math.max(s - 1, 0))}
        onEnterStep2={() => {
          setPwStep2(pwRaw);
          setProblemWizardStep(1);
        }}
        onEnterFinalStep={() => {
          setPwFinal(pwStep2);
          setProblemWizardStep(2);
        }}
        onSubmit={handleSubmitProblem}
        onOpenChange={(open) => {
          if (!open) closeProblemWizard();
        }}
      />

      <MetaWizardDialog
        open={metaWizardOpen}
        step={metaWizardStep}
        step1={mwStep1}
        step2={mwStep2}
        step3={mwStep3}
        step4={mwStep4}
        step5={mwStep5}
        hasForbiddenPhrase={mwHasForbiddenPhrase}
        onStep1Change={setMwStep1}
        onStep2Change={setMwStep2}
        onStep3Change={setMwStep3}
        onStep4Change={setMwStep4}
        onStep5Change={setMwStep5}
        onBack={() => setMetaWizardStep((s) => Math.max(s - 1, 0))}
        onEnterStep2={() => {
          setMwStep2(mwStep1);
          setMetaWizardStep(1);
        }}
        onEnterStep3={() => {
          setMwStep3(mwStep2);
          setMetaWizardStep(2);
        }}
        onEnterStep4={() => {
          setMwStep4(mwStep3);
          setMetaWizardStep(3);
        }}
        onEnterStep5={() => {
          setMwStep5(mwStep4);
          setMetaWizardStep(4);
        }}
        onSubmit={handleSubmitMeta}
        onOpenChange={(open) => {
          if (!open) closeMetaWizard();
        }}
      />

      <QuestionWizardDialog
        open={questionWizardOpen}
        step={questionWizardStep}
        raw={qwRaw}
        final={qwFinal}
        onRawChange={setQwRaw}
        onFinalChange={setQwFinal}
        onBack={() => setQuestionWizardStep(0)}
        onEnterFinalStep={() => {
          setQwFinal(qwRaw);
          setQuestionWizardStep(1);
        }}
        onSubmit={handleSubmitQuestion}
        onOpenChange={(open) => {
          if (!open) closeQuestionWizard();
        }}
      />
    </div>
  );
}

function ProblemCard({
  problem,
  emphasis,
  isEditing,
  showActions,
  editingText,
  onEditingTextChange,
  onCommitEdit,
  onCancelEdit,
  onOpen,
  onLongPress,
  onStartEdit,
  onDelete,
}: {
  problem: QuestionProblem;
  // "current": es el problema seleccionado y todavía no tiene meta final (destacado).
  // "superseded": es el seleccionado pero ya avanzó a meta/preguntas (atenuado).
  // "none": no es el problema seleccionado (estilo normal).
  emphasis: "current" | "superseded" | "none";
  isEditing: boolean;
  showActions: boolean;
  editingText: string;
  onEditingTextChange: (value: string) => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  onOpen: () => void;
  onLongPress: () => void;
  onStartEdit: () => void;
  onDelete: () => void;
}) {
  const press = useLongPressSelect(onLongPress, onOpen);
  return (
    <div
      data-entry-card
      onPointerDown={press.onPointerDown}
      onPointerUp={press.onPointerUp}
      onPointerCancel={press.onPointerCancel}
      onPointerLeave={press.onPointerLeave}
      className={cn(
        "select-none rounded-xl border p-2 text-sm transition-colors",
        emphasis === "current"
          ? CURRENT_STAGE_CLASS
          : emphasis === "superseded"
            ? SUPERSEDED_STAGE_CLASS
            : "border-border/50 hover:bg-muted/40",
      )}
    >
      {isEditing ? (
        <div className="flex items-center gap-1" data-no-longpress>
          <Input
            autoFocus
            value={editingText}
            onChange={(e) => onEditingTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onCommitEdit();
              if (e.key === "Escape") onCancelEdit();
            }}
            className="h-7 text-xs"
          />
          <button onClick={onCommitEdit} className="text-muted-foreground hover:text-foreground">
            <Check size={14} />
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-1" onClick={press.onClick}>
            <span className="flex-1 break-words">{problem.text || "(sin texto)"}</span>
            {problemHasFoundChain(problem) && (
              <ChevronRight size={14} className="mt-0.5 flex-shrink-0 text-muted-foreground" />
            )}
          </div>
          {showActions && (
            <div className="mt-2 flex items-center gap-3 border-t border-border/40 pt-2" data-no-longpress>
              <button
                onClick={onStartEdit}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <Pencil size={12} /> Editar
              </button>
              <button
                onClick={onDelete}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500"
              >
                <Trash2 size={12} /> Borrar
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function QuestionCard({
  item,
  isSelected,
  highlighted,
  isEditing,
  showActions,
  editingText,
  onEditingTextChange,
  onCommitEdit,
  onCancelEdit,
  onOpen,
  onLongPress,
  onStartEdit,
  onDelete,
}: {
  item: QuestionItem;
  isSelected: boolean;
  // true cuando "Preguntas" es la sección más destacada de la cadena (letra blanca, borde brillante).
  highlighted: boolean;
  isEditing: boolean;
  showActions: boolean;
  editingText: string;
  onEditingTextChange: (value: string) => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  onOpen: () => void;
  onLongPress: () => void;
  onStartEdit: () => void;
  onDelete: () => void;
}) {
  const press = useLongPressSelect(onLongPress, onOpen);
  return (
    <div
      data-entry-card
      onPointerDown={press.onPointerDown}
      onPointerUp={press.onPointerUp}
      onPointerCancel={press.onPointerCancel}
      onPointerLeave={press.onPointerLeave}
      className={cn(
        "select-none rounded-xl border p-2 text-sm transition-colors",
        isSelected
          ? "border-foreground/40 bg-muted/60"
          : highlighted
            ? CURRENT_STAGE_CLASS
            : "border-border/50 hover:bg-muted/40",
      )}
    >
      {isEditing ? (
        <div className="flex items-center gap-1" data-no-longpress>
          <Input
            autoFocus
            value={editingText}
            onChange={(e) => onEditingTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onCommitEdit();
              if (e.key === "Escape") onCancelEdit();
            }}
            className="h-7 text-xs"
          />
          <button onClick={onCommitEdit} className="text-muted-foreground hover:text-foreground">
            <Check size={14} />
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-1" onClick={press.onClick}>
            <span className={cn("flex-1 break-words", highlighted && !isSelected && "text-white")}>
              {item.question || "(sin texto)"}
            </span>
            {chainComplete(item) && (
              <ChevronRight size={14} className="mt-0.5 flex-shrink-0 text-muted-foreground" />
            )}
          </div>
          {showActions && (
            <div className="mt-2 flex items-center gap-3 border-t border-border/40 pt-2" data-no-longpress>
              <button
                onClick={onStartEdit}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <Pencil size={12} /> Editar
              </button>
              <button
                onClick={onDelete}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500"
              >
                <Trash2 size={12} /> Borrar
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Wizard de 3 pasos para el "Planteo del problema":
// 1. el problema tal como viene a la cabeza, 2. qué pasa objetivamente y cómo te sentís con eso,
// 3. la versión final, limpia de frases "no sé cómo…" / "no sé qué hacer…". (Qué se busca
// realmente detrás vive en "Meta final".)
function ProblemWizardDialog({
  open,
  step,
  raw,
  step2,
  final,
  hasForbiddenPhrase,
  onRawChange,
  onStep2Change,
  onFinalChange,
  onBack,
  onEnterStep2,
  onEnterFinalStep,
  onSubmit,
  onOpenChange,
}: {
  open: boolean;
  step: number;
  raw: string;
  step2: string;
  final: string;
  hasForbiddenPhrase: boolean;
  onRawChange: (value: string) => void;
  onStep2Change: (value: string) => void;
  onFinalChange: (value: string) => void;
  onBack: () => void;
  onEnterStep2: () => void;
  onEnterFinalStep: () => void;
  onSubmit: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] border-0 shadow-2xl">
        <div className="min-h-[220px] flex flex-col">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="problem-step-0"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex-1 flex flex-col"
              >
                <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
                  Planteo del problema · 1 de 3
                </Label>
                <p className="text-sm font-medium mb-3">Escribí tu problema tal como te viene a la cabeza.</p>
                <Textarea
                  autoFocus
                  value={raw}
                  onChange={(e) => onRawChange(e.target.value)}
                  placeholder="Mi problema es que…"
                  rows={4}
                  className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted resize-none"
                />
                <div className="flex justify-end mt-auto pt-6">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={!raw.trim()}
                    onClick={onEnterStep2}
                    className="h-10 w-10 bg-muted/50 hover:bg-muted"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="problem-step-1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex-1 flex flex-col"
              >
                <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
                  Planteo del problema · 2 de 3
                </Label>
                <p className="text-sm font-medium mb-3">¿Qué pasa objetivamente y cómo te sentís con eso?</p>
                <Textarea
                  autoFocus
                  value={step2}
                  onChange={(e) => onStep2Change(e.target.value)}
                  rows={4}
                  className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted resize-none"
                />
                <div className="flex justify-between mt-auto pt-6">
                  <Button variant="ghost" size="icon" onClick={onBack} className="h-10 w-10 bg-muted/50 hover:bg-muted">
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={!step2.trim()}
                    onClick={onEnterFinalStep}
                    className="h-10 w-10 bg-muted/50 hover:bg-muted"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="problem-step-2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex-1 flex flex-col"
              >
                <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
                  Planteo del problema · 3 de 3
                </Label>
                <p className="text-sm font-medium mb-3">
                  Tachá o eliminá cualquier frase que empiece con "no sé cómo…" o "no sé qué hacer…".
                </p>
                <Textarea
                  autoFocus
                  value={final}
                  onChange={(e) => onFinalChange(e.target.value)}
                  rows={4}
                  className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted resize-none"
                />
                {hasForbiddenPhrase && (
                  <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                    Todavía queda una frase "no sé cómo…" / "no sé qué hacer…". Reformulala o borrala para
                    continuar.
                  </p>
                )}
                <div className="flex justify-between mt-auto pt-6">
                  <Button variant="ghost" size="icon" onClick={onBack} className="h-10 w-10 bg-muted/50 hover:bg-muted">
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button onClick={onSubmit} disabled={!final.trim() || hasForbiddenPhrase} className="px-4">
                    Agregar problema
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Wizard de 5 pasos para "Meta final": qué se busca realmente detrás del problema, en cadena
// (cada paso arranca con la respuesta ya reformulada del paso anterior).
// 1. qué se busca realmente (experiencias/crecimiento/contribución).
// 2. por qué (para qué se lo busca).
// 3. eliminar la meta intermedia ("de manera que") y quedarse con la meta final real.
// 4. volverla autoalimentada: que dependa 100% de uno, no de la aprobación de otra persona.
// 5. tachar el "cómo": eliminar frases "no sé cómo…" / "no sé qué hacer…".
function MetaWizardDialog({
  open,
  step,
  step1,
  step2,
  step3,
  step4,
  step5,
  hasForbiddenPhrase,
  onStep1Change,
  onStep2Change,
  onStep3Change,
  onStep4Change,
  onStep5Change,
  onBack,
  onEnterStep2,
  onEnterStep3,
  onEnterStep4,
  onEnterStep5,
  onSubmit,
  onOpenChange,
}: {
  open: boolean;
  step: number;
  step1: string;
  step2: string;
  step3: string;
  step4: string;
  step5: string;
  hasForbiddenPhrase: boolean;
  onStep1Change: (value: string) => void;
  onStep2Change: (value: string) => void;
  onStep3Change: (value: string) => void;
  onStep4Change: (value: string) => void;
  onStep5Change: (value: string) => void;
  onBack: () => void;
  onEnterStep2: () => void;
  onEnterStep3: () => void;
  onEnterStep4: () => void;
  onEnterStep5: () => void;
  onSubmit: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] border-0 shadow-2xl">
        <div className="min-h-[220px] flex flex-col">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="meta-step-0"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex-1 flex flex-col"
              >
                <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
                  Meta final · 1 de 5
                </Label>
                <p className="text-sm font-medium mb-3">
                  ¿Qué es lo que realmente buscás detrás de esta preocupación: experiencias, crecimiento o
                  contribución?
                </p>
                <Textarea
                  autoFocus
                  value={step1}
                  onChange={(e) => onStep1Change(e.target.value)}
                  placeholder="Ej.: Ser una presencia constante de apoyo, valor e integridad"
                  rows={4}
                  className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted resize-none"
                />
                <div className="flex justify-end mt-auto pt-6">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={!step1.trim()}
                    onClick={onEnterStep2}
                    className="h-10 w-10 bg-muted/50 hover:bg-muted"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="meta-step-1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex-1 flex flex-col"
              >
                <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
                  Meta final · 2 de 5
                </Label>
                <p className="text-sm font-medium mb-3">¿Por qué?</p>
                <Textarea
                  autoFocus
                  value={step2}
                  onChange={(e) => onStep2Change(e.target.value)}
                  placeholder="Ej.: para experimentar paz mental, certeza interna, amor incondicional"
                  rows={4}
                  className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted resize-none"
                />
                <div className="flex justify-between mt-auto pt-6">
                  <Button variant="ghost" size="icon" onClick={onBack} className="h-10 w-10 bg-muted/50 hover:bg-muted">
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={!step2.trim()}
                    onClick={onEnterStep3}
                    className="h-10 w-10 bg-muted/50 hover:bg-muted"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="meta-step-2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex-1 flex flex-col"
              >
                <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
                  Meta final · 3 de 5
                </Label>
                <p className="text-sm font-medium mb-3">
                  Eliminá el «De manera que»: si escribiste una meta que requiere otra etapa previa (ej.
                  "conseguir X trabajo para poder estar tranquilo"), tachá la meta intermedia (el trabajo) y
                  quedate con la meta final real (la tranquilidad y la realización).
                </p>
                <Textarea
                  autoFocus
                  value={step3}
                  onChange={(e) => onStep3Change(e.target.value)}
                  rows={4}
                  className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted resize-none"
                />
                <div className="flex justify-between mt-auto pt-6">
                  <Button variant="ghost" size="icon" onClick={onBack} className="h-10 w-10 bg-muted/50 hover:bg-muted">
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={!step3.trim()}
                    onClick={onEnterStep4}
                    className="h-10 w-10 bg-muted/50 hover:bg-muted"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="meta-step-3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex-1 flex flex-col"
              >
                <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
                  Meta final · 4 de 5
                </Label>
                <p className="text-sm font-medium mb-3">
                  Hacé una Meta Autoalimentada: modificala para que el resultado dependa en un 100% de vos y
                  de tus estados internos, no de la aprobación o decisión de otra persona.
                </p>
                <Textarea
                  autoFocus
                  value={step4}
                  onChange={(e) => onStep4Change(e.target.value)}
                  rows={4}
                  className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted resize-none"
                />
                <div className="flex justify-between mt-auto pt-6">
                  <Button variant="ghost" size="icon" onClick={onBack} className="h-10 w-10 bg-muted/50 hover:bg-muted">
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={!step4.trim()}
                    onClick={onEnterStep5}
                    className="h-10 w-10 bg-muted/50 hover:bg-muted"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="meta-step-4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex-1 flex flex-col"
              >
                <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
                  Meta final · 5 de 5
                </Label>
                <p className="text-sm font-medium mb-3">
                  Tachá el «CÓMO»: eliminá cualquier frase que diga "no sé cómo…" o "no sé qué hacer…".
                </p>
                <Textarea
                  autoFocus
                  value={step5}
                  onChange={(e) => onStep5Change(e.target.value)}
                  rows={4}
                  className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted resize-none"
                />
                {hasForbiddenPhrase && (
                  <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                    Todavía queda una frase "no sé cómo…" / "no sé qué hacer…". Reformulala o borrala para
                    continuar.
                  </p>
                )}
                <div className="flex justify-between mt-auto pt-6">
                  <Button variant="ghost" size="icon" onClick={onBack} className="h-10 w-10 bg-muted/50 hover:bg-muted">
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button onClick={onSubmit} disabled={!step5.trim() || hasForbiddenPhrase} className="px-4">
                    Guardar meta final
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Wizard de 2 pasos para "Hacer la pregunta":
// 1. plantear la pregunta como salga, 2. reformularla siguiendo la estructura guía
// (prefijada con la respuesta del paso 1, lista para reformular).
function QuestionWizardDialog({
  open,
  step,
  raw,
  final,
  onRawChange,
  onFinalChange,
  onBack,
  onEnterFinalStep,
  onSubmit,
  onOpenChange,
}: {
  open: boolean;
  step: number;
  raw: string;
  final: string;
  onRawChange: (value: string) => void;
  onFinalChange: (value: string) => void;
  onBack: () => void;
  onEnterFinalStep: () => void;
  onSubmit: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] border-0 shadow-2xl">
        <div className="min-h-[220px] flex flex-col">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="question-step-0"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex-1 flex flex-col"
              >
                <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
                  Hacer la pregunta · 1 de 2
                </Label>
                <p className="text-sm font-medium mb-3">Planteá la pregunta como te salga.</p>
                <Textarea
                  autoFocus
                  value={raw}
                  onChange={(e) => onRawChange(e.target.value)}
                  placeholder="Mi pregunta es…"
                  rows={4}
                  className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted resize-none"
                />
                <div className="flex justify-end mt-auto pt-6">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={!raw.trim()}
                    onClick={onEnterFinalStep}
                    className="h-10 w-10 bg-muted/50 hover:bg-muted"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="question-step-1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex-1 flex flex-col"
              >
                <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
                  Hacer la pregunta · 2 de 2
                </Label>
                <p className="text-sm font-medium mb-1">
                  Reformulá la pregunta siguiendo esta estructura: «¿De qué maneras [Cualidad] puedo [QUÉ] y
                  así experimentar [POR QUÉ] en mi vida?»
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  Por ejemplo: «¿Qué pequeña idea o acción puedo hacer hoy para liberar la carga de trabajo
                  [QUÉ] y sentir alivio ahora [POR QUÉ]?»
                </p>
                <Textarea
                  autoFocus
                  value={final}
                  onChange={(e) => onFinalChange(e.target.value)}
                  rows={4}
                  className="border-0 bg-muted/50 focus-visible:ring-0 focus-visible:bg-muted resize-none"
                />
                <div className="flex justify-between mt-auto pt-6">
                  <Button variant="ghost" size="icon" onClick={onBack} className="h-10 w-10 bg-muted/50 hover:bg-muted">
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button onClick={onSubmit} disabled={!final.trim()} className="px-4">
                    Agregar pregunta
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FoundList({
  problems,
  onRestore,
  onDelete,
}: {
  problems: QuestionProblem[];
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [actionsId, setActionsId] = useState<string | null>(null);
  if (problems.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Todavía no encontraste nada en esta área.</p>
    );
  }
  return (
    <ScrollArea className="h-full pr-2">
      <div className="space-y-3">
        {problems.map((p) => {
          const showActions = actionsId === p.id;
          let pressTimer: ReturnType<typeof setTimeout> | null = null;
          const startPress = () => {
            if (pressTimer) clearTimeout(pressTimer);
            pressTimer = setTimeout(() => setActionsId((prev) => (prev === p.id ? null : p.id)), LONG_PRESS_MS);
          };
          const cancelPress = () => {
            if (pressTimer) {
              clearTimeout(pressTimer);
              pressTimer = null;
            }
          };
          return (
          <div
            key={p.id}
            className="select-none rounded-2xl border border-border/50 p-3"
            onPointerDown={startPress}
            onPointerUp={cancelPress}
            onPointerCancel={cancelPress}
            onPointerLeave={cancelPress}
          >
            <span className="text-sm font-bold text-foreground break-words">{p.text || "(sin texto)"}</span>
            {showActions && (
              <div className="mt-2 flex items-center gap-3 border-t border-border/40 pt-2">
                <button
                  onClick={() => {
                    onRestore(p.id);
                    setActionsId(null);
                  }}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw size={12} /> Restaurar
                </button>
                <button
                  onClick={() => {
                    onDelete(p.id);
                    setActionsId(null);
                  }}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500"
                >
                  <Trash2 size={12} /> Borrar
                </button>
              </div>
            )}
            <div className="mt-2 space-y-2">
              {p.items.filter(chainComplete).map((it) => (
                <div key={it.id} className="rounded-xl bg-muted/40 p-2 text-xs">
                  <p className="break-words">
                    <span className="font-semibold text-muted-foreground">P: </span>
                    {it.question}
                  </p>
                  <p className="break-words">
                    <span className="font-semibold text-muted-foreground">R: </span>
                    {it.answer}
                  </p>
                  <p className="break-words">
                    <span className="font-semibold text-muted-foreground">A: </span>
                    {it.action}
                  </p>
                </div>
              ))}
            </div>
          </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

export default QuestionsTracker;
