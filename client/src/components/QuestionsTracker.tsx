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

// Plantillas de la técnica "Hacer la pregunta": frases con huecos para reformular
// un problema como una pregunta orientada a explorar, crecer o contribuir.
type QuestionTemplateKey = "A" | "B";
type QuestionField = { key: "quality" | "what" | "why"; label: string; placeholder: string };

const QUESTION_TEMPLATES: Record<
  QuestionTemplateKey,
  { label: string; fields: QuestionField[]; build: (f: Record<string, string>) => string }
> = {
  A: {
    label: "¿De qué maneras [Cualidad] puedo [QUÉ] y así experimentar [POR QUÉ] en mi vida?",
    fields: [
      { key: "quality", label: "Cualidad", placeholder: "ej. curiosa, valiente…" },
      { key: "what", label: "QUÉ", placeholder: "ej. explorar nuevos lenguajes…" },
      { key: "why", label: "POR QUÉ", placeholder: "ej. más libertad creativa…" },
    ],
    build: (f) =>
      `¿De qué maneras ${(f.quality || "…").trim()} puedo ${(f.what || "…").trim()} y así experimentar ${(f.why || "…").trim()} en mi vida?`,
  },
  B: {
    label: "¿Qué pequeña idea o acción puedo activar hoy para acercarme a [QUÉ] y sentir [POR QUÉ]?",
    fields: [
      { key: "what", label: "QUÉ", placeholder: "ej. terminar el proyecto…" },
      { key: "why", label: "POR QUÉ", placeholder: "ej. orgullo, avance…" },
    ],
    build: (f) =>
      `¿Qué pequeña idea o acción puedo activar hoy para acercarme a ${(f.what || "…").trim()} y sentir ${(f.why || "…").trim()}?`,
  },
};

// Frases a detectar en el paso 3 del planteo del problema ("no sé cómo…" / "no sé qué hacer…").
const FORBIDDEN_PHRASE_RE = /\bno s[eé] (c[oó]mo|qu[eé] hacer)\b/i;

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
    mutationFn: async ({ id, ...patch }: { id: string; text?: string; found?: boolean }) => {
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
  const [pwPurpose, setPwPurpose] = useState(""); // paso 2: qué se busca realmente (reflexión, no se guarda)
  const [pwFinal, setPwFinal] = useState(""); // paso 3: versión final, limpia de "no sé cómo/qué hacer…"

  // Wizard "Hacer la pregunta": elegir una estructura y completar sus huecos.
  const [questionWizardOpen, setQuestionWizardOpen] = useState(false);
  const [questionWizardStep, setQuestionWizardStep] = useState(0);
  const [qwTemplate, setQwTemplate] = useState<QuestionTemplateKey | null>(null);
  const [qwFields, setQwFields] = useState<Record<string, string>>({});

  const [editingProblemId, setEditingProblemId] = useState<string | null>(null);
  const [editingProblemText, setEditingProblemText] = useState("");
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editingQuestionText, setEditingQuestionText] = useState("");

  // Tarjeta con la barra "Editar / Borrar" abierta (se abre manteniendo presionada la tarjeta).
  const [problemActionsId, setProblemActionsId] = useState<string | null>(null);
  const [questionActionsId, setQuestionActionsId] = useState<string | null>(null);

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

  const showQuestionsCol = !!selectedProblem && !selectedProblem.foundAt;
  const showAnswerCol = showQuestionsCol && !!selectedItem;
  const showActionCol = showAnswerCol && answerDraft.trim().length > 0;

  const visibleCols = 1 + (showQuestionsCol ? 1 : 0) + (showAnswerCol ? 1 : 0) + (showActionCol ? 1 : 0);
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
    setPwPurpose("");
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
    setQwTemplate(null);
    setQwFields({});
  };

  const openQuestionWizard = () => {
    if (!selectedProblem) return;
    closeQuestionWizard();
    setQuestionWizardOpen(true);
  };

  const handleSubmitQuestion = () => {
    if (!qwTemplate || !selectedProblem) return;
    const question = QUESTION_TEMPLATES[qwTemplate].build(qwFields).trim();
    if (!question) return;
    createItem.mutate({ problemId: selectedProblem.id, question });
    closeQuestionWizard();
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
              <button
                key={`area-${area.id}`}
                onClick={() => {
                  setScope({ kind: "area", id: area.id });
                  resetSelection();
                }}
                className={cn(
                  "flex shrink-0 flex-col items-center rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                  isSelected
                    ? "bg-foreground text-background"
                    : "bg-muted/60 text-muted-foreground hover:text-foreground",
                )}
              >
                {count > 0 && (
                  <span
                    className={cn(
                      "mb-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none",
                      isSelected ? "bg-background/25 text-background" : "bg-foreground/15 text-foreground",
                    )}
                  >
                    {count}
                  </span>
                )}
                {area.name}
              </button>
            );
          })}
          {activeAreas.length > 0 && activeProjects.length > 0 && (
            <div className="mx-1 h-4 w-px shrink-0 bg-border/50" />
          )}
          {activeProjects.map((project) => {
            const count = activeProblemCountByProjectId.get(project.id) ?? 0;
            const isSelected = scope?.kind === "project" && scope.id === project.id;
            return (
              <button
                key={`project-${project.id}`}
                onClick={() => {
                  setScope({ kind: "project", id: project.id });
                  resetSelection();
                }}
                className={cn(
                  "flex shrink-0 flex-col items-center rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                  isSelected
                    ? "bg-foreground text-background"
                    : "bg-muted/60 text-muted-foreground hover:text-foreground",
                )}
              >
                {count > 0 && (
                  <span
                    className={cn(
                      "mb-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none",
                      isSelected ? "bg-background/25 text-background" : "bg-foreground/15 text-foreground",
                    )}
                  >
                    {count}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Swords size={11} /> {project.name}
                </span>
              </button>
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
                    isSelected={p.id === selectedProblemId}
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

            {/* Col 2 — Preguntas */}
            {showQuestionsCol && selectedProblem && (
              <ScrollArea className={colClass(1)} {...questionsPress}>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
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

            {/* Col 3 — Respuesta */}
            {showAnswerCol && selectedItem && (
              <ScrollArea className={colClass(2)} {...answerPress}>
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

            {/* Col 4 — Acción */}
            {showActionCol && selectedItem && selectedProblem && (
              <ScrollArea className={colClass(3)} {...actionPress}>
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
        purpose={pwPurpose}
        final={pwFinal}
        hasForbiddenPhrase={pwHasForbiddenPhrase}
        onRawChange={setPwRaw}
        onPurposeChange={setPwPurpose}
        onFinalChange={setPwFinal}
        onNext={() => setProblemWizardStep((s) => Math.min(s + 1, 2))}
        onBack={() => setProblemWizardStep((s) => Math.max(s - 1, 0))}
        onEnterFinalStep={() => {
          setPwFinal(pwRaw);
          setProblemWizardStep(2);
        }}
        onSubmit={handleSubmitProblem}
        onOpenChange={(open) => {
          if (!open) closeProblemWizard();
        }}
      />

      <QuestionWizardDialog
        open={questionWizardOpen}
        step={questionWizardStep}
        template={qwTemplate}
        fields={qwFields}
        onPickTemplate={(key) => {
          setQwTemplate(key);
          setQwFields({});
          setQuestionWizardStep(1);
        }}
        onFieldChange={(key, value) => setQwFields((prev) => ({ ...prev, [key]: value }))}
        onBack={() => setQuestionWizardStep(0)}
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
  isSelected,
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
  isSelected: boolean;
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
        isSelected ? "border-foreground/40 bg-muted/60" : "border-border/50 hover:bg-muted/40",
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
        isSelected ? "border-foreground/40 bg-muted/60" : "border-border/50 hover:bg-muted/40",
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
            <span className="flex-1 break-words">{item.question || "(sin texto)"}</span>
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
// 1. el problema tal como viene a la cabeza, 2. qué se busca realmente detrás (reflexión),
// 3. la versión final, limpia de frases "no sé cómo…" / "no sé qué hacer…".
function ProblemWizardDialog({
  open,
  step,
  raw,
  purpose,
  final,
  hasForbiddenPhrase,
  onRawChange,
  onPurposeChange,
  onFinalChange,
  onNext,
  onBack,
  onEnterFinalStep,
  onSubmit,
  onOpenChange,
}: {
  open: boolean;
  step: number;
  raw: string;
  purpose: string;
  final: string;
  hasForbiddenPhrase: boolean;
  onRawChange: (value: string) => void;
  onPurposeChange: (value: string) => void;
  onFinalChange: (value: string) => void;
  onNext: () => void;
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
                    onClick={onNext}
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
                <p className="text-sm font-medium mb-3">
                  ¿Qué es lo que realmente buscás detrás de esta preocupación: experiencias, crecimiento o
                  contribución?
                </p>
                <Textarea
                  autoFocus
                  value={purpose}
                  onChange={(e) => onPurposeChange(e.target.value)}
                  placeholder="Lo que realmente busco es…"
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

// Wizard de 2 pasos para "Hacer la pregunta": elegir una de las estructuras de ejemplo
// y completar sus huecos ([Cualidad] / [QUÉ] / [POR QUÉ]) con vista previa en vivo.
function QuestionWizardDialog({
  open,
  step,
  template,
  fields,
  onPickTemplate,
  onFieldChange,
  onBack,
  onSubmit,
  onOpenChange,
}: {
  open: boolean;
  step: number;
  template: QuestionTemplateKey | null;
  fields: Record<string, string>;
  onPickTemplate: (key: QuestionTemplateKey) => void;
  onFieldChange: (key: string, value: string) => void;
  onBack: () => void;
  onSubmit: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const activeTemplate = template ? QUESTION_TEMPLATES[template] : null;
  const canSubmit = !!activeTemplate && activeTemplate.fields.every((f) => (fields[f.key] ?? "").trim());
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
                  Hacer la pregunta · elegí una estructura
                </Label>
                <div className="space-y-2">
                  {(Object.keys(QUESTION_TEMPLATES) as QuestionTemplateKey[]).map((key) => (
                    <button
                      key={key}
                      onClick={() => onPickTemplate(key)}
                      className="w-full rounded-xl border border-border/50 p-3 text-left text-sm transition-colors hover:bg-muted/50"
                    >
                      {QUESTION_TEMPLATES[key].label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 1 && activeTemplate && (
              <motion.div
                key="question-step-1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex-1 flex flex-col"
              >
                <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
                  Hacer la pregunta · completá los espacios
                </Label>
                <div className="space-y-2">
                  {activeTemplate.fields.map((f, i) => (
                    <Input
                      key={f.key}
                      autoFocus={i === 0}
                      value={fields[f.key] ?? ""}
                      onChange={(e) => onFieldChange(f.key, e.target.value)}
                      placeholder={`${f.label} — ${f.placeholder}`}
                      className="h-9 text-sm"
                    />
                  ))}
                </div>
                <p className="mt-3 rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground break-words">
                  {activeTemplate.build(fields)}
                </p>
                <div className="flex justify-between mt-auto pt-6">
                  <Button variant="ghost" size="icon" onClick={onBack} className="h-10 w-10 bg-muted/50 hover:bg-muted">
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button onClick={onSubmit} disabled={!canSubmit} className="px-4">
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
