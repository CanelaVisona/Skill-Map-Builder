import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eraser, Pencil, Trash2, Undo2, Redo2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const WHITEBOARD_ENTRY_NAME = "__whiteboard__";

const LOGICAL_W = 1000;
const LOGICAL_H = 640;
const SAVE_DEBOUNCE_MS = 700;

const COLORS = ["#111827", "#dc2626", "#2563eb", "#16a34a", "#ea580c", "#9333ea", "#ca8a04"];
const SIZES = [3, 6, 12];

type Point = [number, number];
type Stroke = { color: string; size: number; points: Point[] };
type WhiteboardData = { version: 1; strokes: Stroke[] };

type VisionEntry = { id: string; name: string; description: string };

interface VisionWhiteboardProps {
  sourceType: "area" | "project";
  sourceId: string;
  enabled: boolean;
}

function parseData(raw: string | undefined): Stroke[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as WhiteboardData;
    return Array.isArray(parsed?.strokes) ? parsed.strokes : [];
  } catch {
    return [];
  }
}

function distToSegment(p: Point, a: Point, b: Point) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const x = a[0] + t * dx;
  const y = a[1] + t * dy;
  return Math.hypot(p[0] - x, p[1] - y);
}

function strokeHit(stroke: Stroke, p: Point, radius: number) {
  const r = radius + stroke.size / 2;
  const pts = stroke.points;
  if (pts.length === 1) return Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]) <= r;
  for (let i = 1; i < pts.length; i++) {
    if (distToSegment(p, pts[i - 1], pts[i]) <= r) return true;
  }
  return false;
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  const pts = stroke.points;
  if (pts.length === 0) return;
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineWidth = stroke.size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (pts.length === 1) {
    ctx.beginPath();
    ctx.arc(pts[0][0], pts[0][1], stroke.size / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const midX = (pts[i][0] + pts[i + 1][0]) / 2;
    const midY = (pts[i][1] + pts[i + 1][1]) / 2;
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], midX, midY);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last[0], last[1]);
  ctx.stroke();
}

export function VisionWhiteboard({ sourceType, sourceId, enabled }: VisionWhiteboardProps) {
  const queryClient = useQueryClient();
  const queryKey = [`/api/source-vision/${sourceType}/${sourceId}`];

  const { data: entries, isSuccess } = useQuery<VisionEntry[]>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/source-vision/${sourceType}/${sourceId}`);
      return res.json();
    },
    enabled,
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const redoRef = useRef<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const activePointerRef = useRef<number | null>(null);
  const erasedDuringGestureRef = useRef(false);
  const loadedRef = useRef(false);
  const entryIdRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef<Promise<void>>(Promise.resolve());

  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(SIZES[1]);
  const [history, setHistory] = useState({ canUndo: false, canRedo: false });
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const syncHistory = () =>
    setHistory({ canUndo: strokesRef.current.length > 0, canRedo: redoRef.current.length > 0 });

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const scale = canvas.width / LOGICAL_W;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    for (const stroke of strokesRef.current) drawStroke(ctx, stroke);
    if (currentStrokeRef.current) drawStroke(ctx, currentStrokeRef.current);
  }, []);

  // Size canvas backing store to its displayed size for crisp lines
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.round(wrapper.clientWidth * dpr));
      canvas.width = w;
      canvas.height = Math.round((w * LOGICAL_H) / LOGICAL_W);
      redraw();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [redraw]);

  // Load saved drawing once
  useEffect(() => {
    if (loadedRef.current || !isSuccess || !Array.isArray(entries)) return;
    const entry = entries.find((e) => e.name === WHITEBOARD_ENTRY_NAME);
    entryIdRef.current = entry?.id ?? null;
    strokesRef.current = parseData(entry?.description);
    redoRef.current = [];
    loadedRef.current = true;
    syncHistory();
    redraw();
  }, [entries, isSuccess, redraw]);

  const persist = useCallback(() => {
    if (!loadedRef.current || !dirtyRef.current) return savingRef.current;
    dirtyRef.current = false;
    const payload: WhiteboardData = { version: 1, strokes: strokesRef.current };
    const description = JSON.stringify(payload);
    setSaveState("saving");
    savingRef.current = savingRef.current.then(async () => {
      try {
        let res: Response;
        if (entryIdRef.current) {
          res = await fetch(`/api/source-vision/${entryIdRef.current}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description }),
          });
        } else {
          const body = sourceType === "area"
            ? { name: WHITEBOARD_ENTRY_NAME, description, areaId: sourceId }
            : { name: WHITEBOARD_ENTRY_NAME, description, projectId: sourceId };
          res = await fetch("/api/source-vision", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          if (res.ok) {
            const created = (await res.clone().json()) as VisionEntry;
            entryIdRef.current = created.id;
          }
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setSaveState(dirtyRef.current ? "saving" : "saved");
        queryClient.setQueryData<VisionEntry[]>(queryKey, (old) => {
          const list = Array.isArray(old) ? old.filter((e) => e.name !== WHITEBOARD_ENTRY_NAME) : [];
          return [...list, { id: entryIdRef.current!, name: WHITEBOARD_ENTRY_NAME, description }];
        });
      } catch {
        dirtyRef.current = true;
        setSaveState("error");
      }
    });
    return savingRef.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceType, sourceId, queryClient]);

  const scheduleSave = useCallback(() => {
    dirtyRef.current = true;
    setSaveState("saving");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void persist();
    }, SAVE_DEBOUNCE_MS);
  }, [persist]);

  // Flush pending changes when the board unmounts (modal closed / tab switched)
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      void persist();
    };
  }, [persist]);

  const toLogical = (e: ReactPointerEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * LOGICAL_W;
    const y = ((e.clientY - rect.top) / rect.height) * LOGICAL_H;
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
  };

  const eraseAt = (p: Point) => {
    const radius = 10;
    const before = strokesRef.current.length;
    const remaining = strokesRef.current.filter((s) => !strokeHit(s, p, radius));
    if (remaining.length !== before) {
      strokesRef.current = remaining;
      erasedDuringGestureRef.current = true;
      redraw();
    }
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!loadedRef.current || activePointerRef.current !== null) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    activePointerRef.current = e.pointerId;
    const p = toLogical(e);
    if (tool === "eraser") {
      erasedDuringGestureRef.current = false;
      eraseAt(p);
    } else {
      currentStrokeRef.current = { color, size, points: [p] };
      redraw();
    }
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (activePointerRef.current !== e.pointerId) return;
    e.preventDefault();
    const events = typeof e.nativeEvent.getCoalescedEvents === "function"
      ? e.nativeEvent.getCoalescedEvents()
      : [];
    const rect = e.currentTarget.getBoundingClientRect();
    const pointsFromEvents: Point[] = (events.length > 0 ? events : [e.nativeEvent]).map((ev) => [
      Math.round(((ev.clientX - rect.left) / rect.width) * LOGICAL_W * 10) / 10,
      Math.round(((ev.clientY - rect.top) / rect.height) * LOGICAL_H * 10) / 10,
    ]);
    if (tool === "eraser") {
      pointsFromEvents.forEach(eraseAt);
      return;
    }
    const stroke = currentStrokeRef.current;
    if (!stroke) return;
    for (const p of pointsFromEvents) {
      const last = stroke.points[stroke.points.length - 1];
      if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= 1.5) stroke.points.push(p);
    }
    redraw();
  };

  const finishGesture = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (activePointerRef.current !== e.pointerId) return;
    activePointerRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (tool === "eraser") {
      if (erasedDuringGestureRef.current) {
        redoRef.current = [];
        syncHistory();
        scheduleSave();
      }
      return;
    }
    const stroke = currentStrokeRef.current;
    currentStrokeRef.current = null;
    if (stroke && stroke.points.length > 0) {
      strokesRef.current = [...strokesRef.current, stroke];
      redoRef.current = [];
      syncHistory();
      scheduleSave();
    }
    redraw();
  };

  const handleUndo = () => {
    const last = strokesRef.current[strokesRef.current.length - 1];
    if (!last) return;
    strokesRef.current = strokesRef.current.slice(0, -1);
    redoRef.current = [...redoRef.current, last];
    syncHistory();
    redraw();
    scheduleSave();
  };

  const handleRedo = () => {
    const next = redoRef.current[redoRef.current.length - 1];
    if (!next) return;
    redoRef.current = redoRef.current.slice(0, -1);
    strokesRef.current = [...strokesRef.current, next];
    syncHistory();
    redraw();
    scheduleSave();
  };

  const handleClear = () => {
    if (strokesRef.current.length === 0) return;
    if (!window.confirm("¿Borrar toda la pizarra?")) return;
    strokesRef.current = [];
    redoRef.current = [];
    syncHistory();
    redraw();
    scheduleSave();
  };

  const toolButton = (active: boolean) =>
    cn(
      "flex h-8 w-8 items-center justify-center rounded-md border transition-colors disabled:opacity-40",
      active ? "border-primary bg-primary/15 text-primary" : "border-border hover:bg-muted"
    );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" title="Lápiz" className={toolButton(tool === "pen")} onClick={() => setTool("pen")}>
          <Pencil className="h-4 w-4" />
        </button>
        <button type="button" title="Goma (borra trazos)" className={toolButton(tool === "eraser")} onClick={() => setTool("eraser")}>
          <Eraser className="h-4 w-4" />
        </button>
        <div className="mx-1 h-6 w-px bg-border" />
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            onClick={() => {
              setColor(c);
              setTool("pen");
            }}
            className={cn(
              "h-6 w-6 rounded-full border-2 transition-transform",
              color === c && tool === "pen" ? "scale-110 border-primary" : "border-border"
            )}
            style={{ backgroundColor: c }}
          />
        ))}
        <div className="mx-1 h-6 w-px bg-border" />
        {SIZES.map((s) => (
          <button
            key={s}
            type="button"
            title={`Grosor ${s}`}
            className={toolButton(size === s && tool === "pen")}
            onClick={() => {
              setSize(s);
              setTool("pen");
            }}
          >
            <span className="rounded-full bg-current" style={{ width: Math.max(3, s / 1.5), height: Math.max(3, s / 1.5) }} />
          </button>
        ))}
        <div className="mx-1 h-6 w-px bg-border" />
        <button type="button" title="Deshacer" className={toolButton(false)} onClick={handleUndo} disabled={!history.canUndo}>
          <Undo2 className="h-4 w-4" />
        </button>
        <button type="button" title="Rehacer" className={toolButton(false)} onClick={handleRedo} disabled={!history.canRedo}>
          <Redo2 className="h-4 w-4" />
        </button>
        <button type="button" title="Borrar todo" className={toolButton(false)} onClick={handleClear} disabled={!history.canUndo}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </button>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {saveState === "saving" && "Guardando…"}
          {saveState === "saved" && "Guardado"}
          {saveState === "error" && <span className="text-destructive">Error al guardar</span>}
        </span>
      </div>
      <div
        ref={wrapperRef}
        className="relative mx-auto w-full overflow-hidden rounded-md border border-border"
        style={{
          aspectRatio: `${LOGICAL_W} / ${LOGICAL_H}`,
          maxWidth: `calc(min(52dvh, 320px) * ${LOGICAL_W / LOGICAL_H})`,
        }}
      >
        <canvas
          ref={canvasRef}
          className={cn("block h-full w-full touch-none select-none", tool === "eraser" ? "cursor-cell" : "cursor-crosshair")}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishGesture}
          onPointerCancel={finishGesture}
          onContextMenu={(e) => e.preventDefault()}
        />
        {!isSuccess && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-500">Cargando…</div>
        )}
      </div>
    </div>
  );
}
