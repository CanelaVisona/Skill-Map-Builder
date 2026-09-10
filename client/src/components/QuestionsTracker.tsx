"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ArrowLeft, Trash2, Pencil, ChevronRight, Swords, Check, RotateCcw } from "lucide-react";

interface AreaLite {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  archived?: 0 | 1 | null;
}

interface QuestionItem {
  id: string;
  problemId: string;
  question: string;
  answer: string;
  action: string;
}

interface QuestionProblem {
  id: string;
  areaId: string;
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
    mutationFn: async (body: { areaId: string; text: string }) => {
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

  const [view, setView] = useState<"active" | "found">("active");
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [selectedProblemId, setSelectedProblemId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const [addingProblem, setAddingProblem] = useState(false);
  const [addingQuestion, setAddingQuestion] = useState(false);
  const [newProblemText, setNewProblemText] = useState("");
  const [newQuestionText, setNewQuestionText] = useState("");

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

  // Default a la primera área disponible.
  useEffect(() => {
    if (!selectedAreaId && activeAreas.length > 0) {
      setSelectedAreaId(activeAreas[0].id);
    }
  }, [activeAreas, selectedAreaId]);

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
    setAddingProblem(false);
    setAddingQuestion(false);
    setProblemActionsId(null);
    setQuestionActionsId(null);
  };

  const problemsForArea = useMemo(
    () =>
      problems.filter(
        (p) => p.areaId === selectedAreaId && (view === "found" ? !!p.foundAt : !p.foundAt),
      ),
    [problems, selectedAreaId, view],
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

  const handleAddProblem = () => {
    const text = newProblemText.trim();
    if (!text || !selectedAreaId) {
      setAddingProblem(false);
      setNewProblemText("");
      return;
    }
    createProblem.mutate({ areaId: selectedAreaId, text });
    setNewProblemText("");
    setAddingProblem(false);
  };

  const handleAddQuestion = () => {
    const question = newQuestionText.trim();
    if (!question || !selectedProblem) {
      setAddingQuestion(false);
      setNewQuestionText("");
      return;
    }
    createItem.mutate({ problemId: selectedProblem.id, question });
    setNewQuestionText("");
    setAddingQuestion(false);
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

  const problemsPress = useBackgroundLongPress(() => {
    if (!selectedAreaId) return;
    setAddingProblem(true);
  });
  const questionsPress = useBackgroundLongPress(() => setAddingQuestion(true));
  const answerPress = useBackgroundLongPress(() => setEditingAnswer(true));
  const actionPress = useBackgroundLongPress(() => setEditingAction(true));

  const selectedArea = activeAreas.find((a) => a.id === selectedAreaId);

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

      {/* Área tabs */}
      {activeAreas.length > 0 ? (
        <div className="scrollbar-hide flex flex-nowrap gap-1 overflow-x-auto border-b border-border/30 px-3 py-2">
          {activeAreas.map((area) => (
            <button
              key={area.id}
              onClick={() => {
                setSelectedAreaId(area.id);
                resetSelection();
              }}
              className={cn(
                "shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                area.id === selectedAreaId
                  ? "bg-foreground text-background"
                  : "bg-muted/60 text-muted-foreground hover:text-foreground",
              )}
            >
              {area.name}
            </button>
          ))}
        </div>
      ) : (
        <div className="px-4 py-6 text-sm text-muted-foreground">No hay áreas todavía.</div>
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
                  Problemas{selectedArea ? ` · ${selectedArea.name}` : ""}
                </p>
              </div>
              <div className="space-y-1.5 pr-1">
                {addingProblem && (
                  <div className="flex items-center gap-1" data-no-longpress>
                    <Input
                      autoFocus
                      value={newProblemText}
                      onChange={(e) => setNewProblemText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddProblem();
                        if (e.key === "Escape") {
                          setAddingProblem(false);
                          setNewProblemText("");
                        }
                      }}
                      onBlur={handleAddProblem}
                      placeholder="Nuevo problema…"
                      className="h-8 text-xs"
                    />
                  </div>
                )}
                {problemsForArea.length === 0 && !addingProblem && (
                  <p className="text-xs text-muted-foreground">
                    Mantené presionado el fondo para agregar un problema.
                  </p>
                )}
                {problemsForArea.map((p) => {
                  const isEditing = editingProblemId === p.id;
                  const showActions = problemActionsId === p.id;
                  let pressTimer: ReturnType<typeof setTimeout> | null = null;
                  let longPressed = false;
                  const startPress = (e: React.PointerEvent) => {
                    if ((e.target as HTMLElement | null)?.closest("[data-no-longpress]")) return;
                    longPressed = false;
                    if (pressTimer) clearTimeout(pressTimer);
                    pressTimer = setTimeout(() => {
                      longPressed = true;
                      setProblemActionsId(p.id);
                    }, LONG_PRESS_MS);
                  };
                  const cancelPress = () => {
                    if (pressTimer) {
                      clearTimeout(pressTimer);
                      pressTimer = null;
                    }
                  };
                  const openProblem = () => {
                    if (longPressed) {
                      longPressed = false;
                      return;
                    }
                    setProblemActionsId(null);
                    setSelectedProblemId(p.id);
                    setSelectedItemId(null);
                  };
                  return (
                    <div
                      key={p.id}
                      data-entry-card
                      onPointerDown={startPress}
                      onPointerUp={cancelPress}
                      onPointerCancel={cancelPress}
                      onPointerLeave={cancelPress}
                      className={cn(
                        "select-none rounded-xl border p-2 text-sm transition-colors",
                        p.id === selectedProblemId
                          ? "border-foreground/40 bg-muted/60"
                          : "border-border/50 hover:bg-muted/40",
                      )}
                    >
                      {isEditing ? (
                        <div className="flex items-center gap-1" data-no-longpress>
                          <Input
                            autoFocus
                            value={editingProblemText}
                            onChange={(e) => setEditingProblemText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                updateProblem.mutate({ id: p.id, text: editingProblemText.trim() });
                                setEditingProblemId(null);
                              }
                              if (e.key === "Escape") setEditingProblemId(null);
                            }}
                            className="h-7 text-xs"
                          />
                          <button
                            onClick={() => {
                              updateProblem.mutate({ id: p.id, text: editingProblemText.trim() });
                              setEditingProblemId(null);
                            }}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Check size={14} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start gap-1" onClick={openProblem}>
                            <span className="flex-1 break-words">{p.text || "(sin texto)"}</span>
                            {problemHasFoundChain(p) && (
                              <ChevronRight size={14} className="mt-0.5 flex-shrink-0 text-muted-foreground" />
                            )}
                          </div>
                          {showActions && (
                            <div
                              className="mt-2 flex items-center gap-3 border-t border-border/40 pt-2"
                              data-no-longpress
                            >
                              <button
                                onClick={() => {
                                  setEditingProblemId(p.id);
                                  setEditingProblemText(p.text);
                                  setProblemActionsId(null);
                                }}
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                              >
                                <Pencil size={12} /> Editar
                              </button>
                              <button
                                onClick={() => {
                                  if (selectedProblemId === p.id) resetSelection();
                                  deleteProblem.mutate(p.id);
                                  setProblemActionsId(null);
                                }}
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
                })}
              </div>
            </ScrollArea>

            {/* Col 2 — Preguntas */}
            {showQuestionsCol && selectedProblem && (
              <ScrollArea className={colClass(1)} {...questionsPress}>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Preguntas
                </p>
                <div className="space-y-1.5 pr-1">
                  {addingQuestion && (
                    <div className="flex items-center gap-1" data-no-longpress>
                      <Input
                        autoFocus
                        value={newQuestionText}
                        onChange={(e) => setNewQuestionText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddQuestion();
                          if (e.key === "Escape") {
                            setAddingQuestion(false);
                            setNewQuestionText("");
                          }
                        }}
                        onBlur={handleAddQuestion}
                        placeholder="Nueva pregunta…"
                        className="h-8 text-xs"
                      />
                    </div>
                  )}
                  {selectedProblem.items.length === 0 && !addingQuestion && (
                    <p className="text-xs text-muted-foreground">
                      Mantené presionado el fondo para agregar una pregunta.
                    </p>
                  )}
                  {selectedProblem.items.map((it) => {
                    const isEditing = editingQuestionId === it.id;
                    const showActions = questionActionsId === it.id;
                    let pressTimer: ReturnType<typeof setTimeout> | null = null;
                    let longPressed = false;
                    const startPress = (e: React.PointerEvent) => {
                      if ((e.target as HTMLElement | null)?.closest("[data-no-longpress]")) return;
                      longPressed = false;
                      if (pressTimer) clearTimeout(pressTimer);
                      pressTimer = setTimeout(() => {
                        longPressed = true;
                        setQuestionActionsId(it.id);
                      }, LONG_PRESS_MS);
                    };
                    const cancelPress = () => {
                      if (pressTimer) {
                        clearTimeout(pressTimer);
                        pressTimer = null;
                      }
                    };
                    const openItem = () => {
                      if (longPressed) {
                        longPressed = false;
                        return;
                      }
                      setQuestionActionsId(null);
                      setSelectedItemId(it.id);
                    };
                    return (
                      <div
                        key={it.id}
                        data-entry-card
                        onPointerDown={startPress}
                        onPointerUp={cancelPress}
                        onPointerCancel={cancelPress}
                        onPointerLeave={cancelPress}
                        className={cn(
                          "select-none rounded-xl border p-2 text-sm transition-colors",
                          it.id === selectedItemId
                            ? "border-foreground/40 bg-muted/60"
                            : "border-border/50 hover:bg-muted/40",
                        )}
                      >
                        {isEditing ? (
                          <div className="flex items-center gap-1" data-no-longpress>
                            <Input
                              autoFocus
                              value={editingQuestionText}
                              onChange={(e) => setEditingQuestionText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  updateItem.mutate({ id: it.id, question: editingQuestionText.trim() });
                                  setEditingQuestionId(null);
                                }
                                if (e.key === "Escape") setEditingQuestionId(null);
                              }}
                              className="h-7 text-xs"
                            />
                            <button
                              onClick={() => {
                                updateItem.mutate({ id: it.id, question: editingQuestionText.trim() });
                                setEditingQuestionId(null);
                              }}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <Check size={14} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-start gap-1" onClick={openItem}>
                              <span className="flex-1 break-words">{it.question || "(sin texto)"}</span>
                              {chainComplete(it) && (
                                <ChevronRight size={14} className="mt-0.5 flex-shrink-0 text-muted-foreground" />
                              )}
                            </div>
                            {showActions && (
                              <div
                                className="mt-2 flex items-center gap-3 border-t border-border/40 pt-2"
                                data-no-longpress
                              >
                                <button
                                  onClick={() => {
                                    setEditingQuestionId(it.id);
                                    setEditingQuestionText(it.question);
                                    setQuestionActionsId(null);
                                  }}
                                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                                >
                                  <Pencil size={12} /> Editar
                                </button>
                                <button
                                  onClick={() => {
                                    if (selectedItemId === it.id) setSelectedItemId(null);
                                    deleteItem.mutate(it.id);
                                    setQuestionActionsId(null);
                                  }}
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
                  })}
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
    </div>
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
