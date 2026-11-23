import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Lightbulb } from "lucide-react";

// Pop-up de "Repetición de conceptos": al confirmar un intervalo de una repetición de tipo
// "concept" se muestra el concepto/pregunta, un espacio para responder y un botón "Pistas" con
// el punteo de lo que tiene que decir. El intervalo recién se confirma al apretar "Listo".
// También lo usa la "Repetición por contexto" (con otros textos): muestra la situación, un
// espacio para anotar cómo se respondió y el punteo de cómo se quería responder.
export function ConceptReviewDialog({
  open,
  concept,
  emoji,
  hints,
  onCancel,
  onDone,
  context,
  description = "Escribí lo que recordás de este concepto antes de mirar las pistas.",
  placeholder = "Tu respuesta...",
  hintsLabel = "Pistas",
  emptyHintsText = "Este concepto no tiene pistas cargadas.",
}: {
  open: boolean;
  concept: string;
  emoji?: string;
  hints: string[];
  onCancel: () => void;
  onDone: (answer: string) => void | Promise<void>;
  context?: string;
  description?: string;
  placeholder?: string;
  hintsLabel?: string;
  emptyHintsText?: string;
}) {
  const [answer, setAnswer] = useState("");
  const [showHints, setShowHints] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setAnswer("");
      setShowHints(false);
      setSubmitting(false);
    }
  }, [open]);

  const validHints = hints.filter((h) => h.trim());

  const handleDone = async () => {
    if (!answer.trim() || submitting) return;
    setSubmitting(true);
    try {
      await onDone(answer.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !submitting) onCancel(); }}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogTitle className="flex items-center gap-2 text-lg font-black pr-6">
          {emoji && <span>{emoji}</span>}
          <span>{concept}</span>
        </DialogTitle>
        <DialogDescription className="text-xs">{description}</DialogDescription>

        {context && context.trim() && (
          <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3">
            <p className="text-[11px] font-bold uppercase text-sky-700 dark:text-sky-400 mb-1">Contexto</p>
            <p className="text-sm text-foreground whitespace-pre-wrap">{context}</p>
          </div>
        )}

        <Textarea
          autoFocus
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder={placeholder}
          className="min-h-32 rounded-xl"
        />

        <div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowHints((v) => !v)}
            className="rounded-xl border-amber-500/50 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
          >
            <Lightbulb className="h-4 w-4 mr-2" />
            {hintsLabel}
          </Button>
          {showHints && (
            <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
              {validHints.length === 0 ? (
                <p className="text-sm text-muted-foreground">{emptyHintsText}</p>
              ) : (
                <ul className="list-disc pl-5 space-y-1 text-sm text-foreground">
                  {validHints.map((hint, i) => (
                    <li key={i}>{hint}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel} disabled={submitting} className="flex-1 rounded-xl">
            Cancelar
          </Button>
          <Button
            onClick={handleDone}
            disabled={!answer.trim() || submitting}
            className="flex-1 rounded-xl bg-purple-500 hover:bg-purple-600 text-white"
          >
            Listo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
