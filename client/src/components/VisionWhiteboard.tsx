import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
  type MouseEvent as ReactMouseEvent,
  type CSSProperties,
} from "react";
import { flushSync } from "react-dom";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import {
  Archive,
  ArchiveRestore,
  Check,
  Eraser,
  ImagePlus,
  LocateFixed,
  MousePointer2,
  Pencil,
  Plus,
  Redo2,
  SquarePen,
  Trash,
  Trash2,
  Type,
  Undo2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Storage format
//
// Each board is one row in `source_vision`:
//   name        = WHITEBOARD_MARKER + JSON(BoardMeta)   (title / archived)
//   description = JSON(BoardData)                       (drawn content)
// Keeping metadata and content in different columns lets renames/archiving
// and drawing autosave never overwrite each other.
// ---------------------------------------------------------------------------

export const WHITEBOARD_MARKER = "__whiteboard__";

const LOGICAL_W = 1000; // logical units across the visible width
const SAVE_DEBOUNCE_MS = 700;
const MAX_PAYLOAD_CHARS = 4_500_000; // server JSON limit is 5mb
const MAX_UNDO = 100;
const HANDLE_PX = 22;
const LINE_HEIGHT = 1.25;
const FONT_FAMILY = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";

const PALETTE = {
  ink: { light: "#111827", dark: "#f5f5f5" },
  red: { light: "#dc2626", dark: "#f87171" },
  blue: { light: "#2563eb", dark: "#60a5fa" },
  green: { light: "#16a34a", dark: "#4ade80" },
  orange: { light: "#ea580c", dark: "#fb923c" },
  purple: { light: "#9333ea", dark: "#c084fc" },
  yellow: { light: "#ca8a04", dark: "#facc15" },
} as const;
type ColorToken = keyof typeof PALETTE;
const COLOR_TOKENS = Object.keys(PALETTE) as ColorToken[];

const PEN_SIZES = [3, 6, 12];
const TEXT_SIZES = [20, 32, 52];

const BOARD_BG = { light: "#ffffff", dark: "#141414" };
const SELECTION_COLOR = "#3b82f6";

type Point = [number, number];
type StrokeItem = { id: string; type: "stroke"; color: string; size: number; points: Point[] };
type TextItem = { id: string; type: "text"; x: number; y: number; text: string; color: string; size: number };
type ImageItem = { id: string; type: "image"; x: number; y: number; w: number; h: number; src: string };
type Item = StrokeItem | TextItem | ImageItem;
type BoardData = { version: 2; items: Item[] };
type BoardMeta = { title: string; archived: boolean; createdAt: number };
type Bounds = { x: number; y: number; w: number; h: number };

type VisionEntry = { id: string; name: string; description: string };

const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const isWhiteboardEntry = (name: string | undefined) => !!name && name.startsWith(WHITEBOARD_MARKER);

function parseMeta(name: string): BoardMeta {
  const fallback: BoardMeta = { title: "Pizarra", archived: false, createdAt: 0 };
  const rest = name.slice(WHITEBOARD_MARKER.length);
  if (!rest) return fallback;
  try {
    const parsed = JSON.parse(rest) as Partial<BoardMeta>;
    return {
      title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title : fallback.title,
      archived: !!parsed.archived,
      createdAt: typeof parsed.createdAt === "number" ? parsed.createdAt : 0,
    };
  } catch {
    return fallback;
  }
}

const serializeMeta = (meta: BoardMeta) => WHITEBOARD_MARKER + JSON.stringify(meta);

function legacyColorToToken(color: string): string {
  const token = COLOR_TOKENS.find((t) => PALETTE[t].light.toLowerCase() === color.toLowerCase());
  return token ?? color;
}

function parseItems(raw: string | undefined): Item[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.version === 2 && Array.isArray(parsed.items)) return parsed.items as Item[];
    // v1: { strokes: [{ color, size, points }] }
    if (Array.isArray(parsed?.strokes)) {
      return parsed.strokes.map((s: { color: string; size: number; points: Point[] }) => ({
        id: newId(),
        type: "stroke" as const,
        color: legacyColorToToken(s.color),
        size: s.size,
        points: s.points,
      }));
    }
  } catch {
    // ignore
  }
  return [];
}

function resolveColor(color: string, dark: boolean) {
  const entry = PALETTE[color as ColorToken];
  if (entry) return dark ? entry.dark : entry.light;
  return color;
}

// --- geometry ---------------------------------------------------------------

let measureCtx: CanvasRenderingContext2D | null = null;
function getMeasureCtx() {
  if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d");
  return measureCtx;
}

const fontFor = (size: number) => `${size}px ${FONT_FAMILY}`;

function measureText(text: string, size: number) {
  const ctx = getMeasureCtx();
  const lines = text.split("\n");
  let w = 0;
  if (ctx) {
    ctx.font = fontFor(size);
    for (const line of lines) w = Math.max(w, ctx.measureText(line).width);
  } else {
    w = Math.max(...lines.map((l) => l.length)) * size * 0.55;
  }
  return { w, h: lines.length * size * LINE_HEIGHT };
}

function itemBounds(item: Item): Bounds {
  if (item.type === "image") return { x: item.x, y: item.y, w: item.w, h: item.h };
  if (item.type === "text") {
    const m = measureText(item.text, item.size);
    return { x: item.x, y: item.y, w: Math.max(m.w, item.size * 0.5), h: m.h };
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of item.points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const r = item.size / 2;
  return { x: minX - r, y: minY - r, w: maxX - minX + item.size, h: maxY - minY + item.size };
}

function distToSegment(p: Point, a: Point, b: Point) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function strokeHit(stroke: StrokeItem, p: Point, radius: number) {
  const r = radius + stroke.size / 2;
  const pts = stroke.points;
  if (pts.length === 1) return Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]) <= r;
  for (let i = 1; i < pts.length; i++) {
    if (distToSegment(p, pts[i - 1], pts[i]) <= r) return true;
  }
  return false;
}

function inBounds(b: Bounds, p: Point, pad: number) {
  return p[0] >= b.x - pad && p[0] <= b.x + b.w + pad && p[1] >= b.y - pad && p[1] <= b.y + b.h + pad;
}

function itemHit(item: Item, p: Point, radius: number) {
  if (item.type === "stroke") return strokeHit(item, p, radius);
  return inBounds(itemBounds(item), p, radius / 2);
}

function translateItem(item: Item, dx: number, dy: number): Item {
  if (item.type === "stroke") {
    return { ...item, points: item.points.map(([x, y]) => [x + dx, y + dy] as Point) };
  }
  return { ...item, x: item.x + dx, y: item.y + dy };
}

function scaleItem(item: Item, origin: Bounds, f: number): Item {
  if (item.type === "image") return { ...item, w: item.w * f, h: item.h * f };
  if (item.type === "text") return { ...item, size: Math.min(400, Math.max(6, item.size * f)) };
  return {
    ...item,
    points: item.points.map(([x, y]) => [origin.x + (x - origin.x) * f, origin.y + (y - origin.y) * f] as Point),
  };
}

// --- images -----------------------------------------------------------------

async function fileToImage(file: File): Promise<{ src: string; w: number; h: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("No se pudo leer la imagen"));
      i.src = url;
    });
    const max = 1280;
    const r = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * r));
    const h = Math.max(1, Math.round(img.naturalHeight * r));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("Canvas no disponible");
    const mayHaveAlpha = /png|webp|gif/i.test(file.type);
    let src = "";
    if (mayHaveAlpha) {
      ctx.drawImage(img, 0, 0, w, h);
      src = c.toDataURL("image/png");
    }
    if (!src || src.length > 700_000) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      src = c.toDataURL("image/jpeg", 0.82);
    }
    return { src, w, h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ===========================================================================
// Board manager: list / create / rename / archive boards
// ===========================================================================

interface VisionWhiteboardsProps {
  sourceType: "area" | "project";
  sourceId: string;
  enabled: boolean;
}

export function VisionWhiteboards({ sourceType, sourceId, enabled }: VisionWhiteboardsProps) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => [`/api/source-vision/${sourceType}/${sourceId}`], [sourceType, sourceId]);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const storageKey = `vision-board:${sourceType}:${sourceId}`;

  const { data: entries, isSuccess, isError } = useQuery<VisionEntry[]>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/source-vision/${sourceType}/${sourceId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled,
  });

  const boards = useMemo(
    () =>
      (Array.isArray(entries) ? entries : [])
        .filter((e) => isWhiteboardEntry(e.name))
        .map((e) => ({ entry: e, meta: parseMeta(e.name) }))
        .sort((a, b) => a.meta.createdAt - b.meta.createdAt),
    [entries]
  );
  const activeBoards = boards.filter((b) => !b.meta.archived);
  const archivedBoards = boards.filter((b) => b.meta.archived);

  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(storageKey);
    } catch {
      return null;
    }
  });
  const [showArchived, setShowArchived] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selected = activeBoards.find((b) => b.entry.id === selectedId) ?? null;

  useEffect(() => {
    if (!isSuccess) return;
    if (!selected && activeBoards.length > 0) setSelectedId(activeBoards[activeBoards.length - 1].entry.id);
  }, [isSuccess, selected, activeBoards]);

  useEffect(() => {
    if (!selectedId) return;
    try {
      localStorage.setItem(storageKey, selectedId);
    } catch {
      // ignore
    }
  }, [selectedId, storageKey]);

  const setRow = (id: string, patch: Partial<VisionEntry>) =>
    queryClient.setQueryData<VisionEntry[]>(queryKey, (old) =>
      Array.isArray(old) ? old.map((e) => (e.id === id ? { ...e, ...patch } : e)) : old
    );

  const createBoard = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const meta: BoardMeta = { title: `Pizarra ${boards.length + 1}`, archived: false, createdAt: Date.now() };
      const base = { name: serializeMeta(meta), description: JSON.stringify({ version: 2, items: [] } satisfies BoardData) };
      const body = sourceType === "area" ? { ...base, areaId: sourceId } : { ...base, projectId: sourceId };
      const res = await fetch("/api/source-vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const created = (await res.json()) as VisionEntry;
      queryClient.setQueryData<VisionEntry[]>(queryKey, (old) => [...(Array.isArray(old) ? old : []), created]);
      setShowArchived(false);
      setSelectedId(created.id);
    } catch {
      window.alert("No se pudo crear la pizarra");
    } finally {
      setBusy(false);
    }
  };

  const updateMeta = async (id: string, meta: BoardMeta) => {
    const name = serializeMeta(meta);
    setRow(id, { name });
    try {
      const res = await fetch(`/api/source-vision/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      window.alert("No se pudo guardar el cambio");
      queryClient.invalidateQueries({ queryKey });
    }
  };

  const deleteBoard = async (id: string, title: string) => {
    if (!window.confirm(`¿Eliminar definitivamente "${title}"?`)) return;
    queryClient.setQueryData<VisionEntry[]>(queryKey, (old) => (Array.isArray(old) ? old.filter((e) => e.id !== id) : old));
    try {
      await fetch(`/api/source-vision/${id}`, { method: "DELETE" });
    } catch {
      queryClient.invalidateQueries({ queryKey });
    }
  };

  const iconBtn =
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border transition-colors hover:bg-muted disabled:opacity-40";

  if (isError) {
    return <p className="text-sm text-destructive">No se pudieron cargar las pizarras.</p>;
  }
  if (!isSuccess) {
    return <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">Cargando…</div>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {/* Board selector row */}
      <div className="flex items-center gap-1.5">
        {showArchived ? (
          <p className="flex-1 text-sm font-medium">Pizarras archivadas</p>
        ) : renaming !== null && selected ? (
          <form
            className="flex flex-1 items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              const title = renaming.trim();
              if (title) void updateMeta(selected.entry.id, { ...selected.meta, title });
              setRenaming(null);
            }}
          >
            <input
              autoFocus
              value={renaming}
              onChange={(e) => setRenaming(e.target.value)}
              className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-base sm:text-sm"
              maxLength={80}
            />
            <button type="submit" className={iconBtn} title="Guardar nombre">
              <Check className="h-4 w-4" />
            </button>
            <button type="button" className={iconBtn} title="Cancelar" onClick={() => setRenaming(null)}>
              <X className="h-4 w-4" />
            </button>
          </form>
        ) : (
          <>
            {activeBoards.length > 0 ? (
              <select
                value={selected?.entry.id ?? ""}
                onChange={(e) => setSelectedId(e.target.value)}
                className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-base sm:text-sm"
              >
                {activeBoards.map((b) => (
                  <option key={b.entry.id} value={b.entry.id}>
                    {b.meta.title}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex-1" />
            )}
            <button type="button" className={iconBtn} title="Nueva pizarra" onClick={createBoard} disabled={busy}>
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={iconBtn}
              title="Renombrar"
              disabled={!selected}
              onClick={() => selected && setRenaming(selected.meta.title)}
            >
              <SquarePen className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={iconBtn}
              title="Archivar pizarra"
              disabled={!selected}
              onClick={() => selected && void updateMeta(selected.entry.id, { ...selected.meta, archived: true })}
            >
              <Archive className="h-4 w-4" />
            </button>
          </>
        )}
        <button
          type="button"
          className={cn(
            "flex h-8 shrink-0 items-center gap-1 rounded-md border px-2 text-xs transition-colors",
            showArchived ? "border-primary bg-primary/15 text-primary" : "border-border hover:bg-muted"
          )}
          title={showArchived ? "Volver a las pizarras" : "Ver archivadas"}
          onClick={() => {
            setShowArchived((v) => !v);
            setRenaming(null);
          }}
        >
          {showArchived ? <X className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}
          {!showArchived && <span>{archivedBoards.length}</span>}
        </button>
      </div>

      {showArchived ? (
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
          {archivedBoards.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No hay pizarras archivadas.</p>
          ) : (
            archivedBoards.map((b) => (
              <div key={b.entry.id} className="flex items-center gap-2 rounded-md border border-border p-2">
                <span className="min-w-0 flex-1 truncate text-sm">{b.meta.title}</span>
                <button
                  type="button"
                  className="flex h-8 items-center gap-1 rounded-md border border-border px-2 text-xs hover:bg-muted"
                  onClick={() => {
                    void updateMeta(b.entry.id, { ...b.meta, archived: false });
                    setSelectedId(b.entry.id);
                    setShowArchived(false);
                  }}
                >
                  <ArchiveRestore className="h-4 w-4" /> Restaurar
                </button>
                <button
                  type="button"
                  className={iconBtn}
                  title="Eliminar definitivamente"
                  onClick={() => void deleteBoard(b.entry.id, b.meta.title)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </button>
              </div>
            ))
          )}
        </div>
      ) : selected ? (
        <BoardEditor
          key={selected.entry.id}
          entryId={selected.entry.id}
          initialDescription={selected.entry.description}
          queryKey={queryKey}
          queryClient={queryClient}
          isDark={isDark}
        />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-md border border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">No hay pizarras activas.</p>
          <button
            type="button"
            onClick={createBoard}
            disabled={busy}
            className="flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Nueva pizarra
          </button>
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// Board editor
// ===========================================================================

type Tool = "select" | "pen" | "eraser" | "text";

type Gesture =
  | { kind: "draw" }
  | { kind: "erase"; before: Item[]; changed: boolean }
  | { kind: "move"; before: Item[]; start: Point; orig: Item; changed: boolean }
  | { kind: "resize"; before: Item[]; start: Point; orig: Item; origBounds: Bounds; changed: boolean }
  | { kind: "pan"; startClient: Point; startView: Point }
  | { kind: "text"; startClient: Point; p: Point };

type EditingText = { id: string | null; x: number; y: number; text: string; color: string; size: number };

interface BoardEditorProps {
  entryId: string;
  initialDescription: string;
  queryKey: string[];
  queryClient: QueryClient;
  isDark: boolean;
}

function BoardEditor({ entryId, initialDescription, queryKey, queryClient, isDark }: BoardEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const itemsRef = useRef<Item[]>(parseItems(initialDescription));
  const undoRef = useRef<Item[][]>([]);
  const redoRef = useRef<Item[][]>([]);
  const viewRef = useRef<Point>([0, 0]);
  const currentStrokeRef = useRef<StrokeItem | null>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const activePointerRef = useRef<number | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const editingRef = useRef<EditingText | null>(null);
  const imageCacheRef = useRef(new Map<string, HTMLImageElement>());
  const isDarkRef = useRef(isDark);
  isDarkRef.current = isDark;

  const dirtyRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef<Promise<void>>(Promise.resolve());

  const [tool, setToolState] = useState<Tool>("pen");
  const toolRef = useRef<Tool>("pen");
  const [color, setColor] = useState<string>("ink");
  const [sizeIndex, setSizeIndex] = useState(1);
  const [history, setHistory] = useState({ canUndo: false, canRedo: false, hasItems: itemsRef.current.length > 0 });
  const [selectedId, setSelectedIdState] = useState<string | null>(null);
  const [editing, setEditingState] = useState<EditingText | null>(null);
  const [viewMoved, setViewMoved] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error" | "toolarge">("idle");

  const getScale = () => {
    const canvas = canvasRef.current;
    return canvas && canvas.clientWidth > 0 ? canvas.clientWidth / LOGICAL_W : 1;
  };

  const syncHistory = () =>
    setHistory({
      canUndo: undoRef.current.length > 0,
      canRedo: redoRef.current.length > 0,
      hasItems: itemsRef.current.length > 0,
    });

  const setSelected = (id: string | null) => {
    selectedIdRef.current = id;
    setSelectedIdState(id);
  };

  const setEditing = (value: EditingText | null) => {
    editingRef.current = value;
    setEditingState(value);
  };

  // --- rendering ------------------------------------------------------------

  const getImage = (src: string) => {
    const cache = imageCacheRef.current;
    let img = cache.get(src);
    if (!img) {
      img = new Image();
      img.onload = () => redrawRef.current();
      img.src = src;
      cache.set(src, img);
    }
    return img;
  };

  const drawItem = (ctx: CanvasRenderingContext2D, item: Item, dark: boolean) => {
    if (item.type === "image") {
      const img = getImage(item.src);
      if (img.complete && img.naturalWidth > 0) ctx.drawImage(img, item.x, item.y, item.w, item.h);
      else {
        ctx.fillStyle = dark ? "#262626" : "#f3f4f6";
        ctx.fillRect(item.x, item.y, item.w, item.h);
      }
      return;
    }
    const c = resolveColor(item.color, dark);
    if (item.type === "text") {
      ctx.fillStyle = c;
      ctx.font = fontFor(item.size);
      ctx.textBaseline = "top";
      item.text.split("\n").forEach((line, i) => ctx.fillText(line, item.x, item.y + i * item.size * LINE_HEIGHT));
      return;
    }
    const pts = item.points;
    if (pts.length === 0) return;
    ctx.strokeStyle = c;
    ctx.fillStyle = c;
    ctx.lineWidth = item.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (pts.length === 1) {
      ctx.beginPath();
      ctx.arc(pts[0][0], pts[0][1], item.size / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last[0], last[1]);
    ctx.stroke();
  };

  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dark = isDarkRef.current;
    const dpr = window.devicePixelRatio || 1;
    const scale = getScale();
    const [vx, vy] = viewRef.current;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = dark ? BOARD_BG.dark : BOARD_BG.light;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const k = dpr * scale;
    ctx.setTransform(k, 0, 0, k, -vx * k, -vy * k);
    const editingId = editingRef.current?.id;
    for (const item of itemsRef.current) {
      if (item.id === editingId) continue;
      drawItem(ctx, item, dark);
    }
    if (currentStrokeRef.current) drawItem(ctx, currentStrokeRef.current, dark);

    const sel = selectedIdRef.current && toolRef.current === "select"
      ? itemsRef.current.find((i) => i.id === selectedIdRef.current)
      : null;
    if (sel) {
      const b = itemBounds(sel);
      const pad = 4 / scale;
      ctx.strokeStyle = SELECTION_COLOR;
      ctx.lineWidth = 1.5 / scale;
      ctx.setLineDash([6 / scale, 4 / scale]);
      ctx.strokeRect(b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2);
      ctx.setLineDash([]);
      const hs = 12 / scale;
      ctx.fillStyle = SELECTION_COLOR;
      ctx.fillRect(b.x + b.w + pad - hs / 2, b.y + b.h + pad - hs / 2, hs, hs);
    }
  };
  const redrawRef = useRef(redraw);
  redrawRef.current = redraw;

  useEffect(() => {
    redrawRef.current();
  }, [isDark, tool, selectedId, editing?.id]);

  // Keep backing store matched to the displayed size
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(wrapper.clientWidth * dpr));
      canvas.height = Math.max(1, Math.round(wrapper.clientHeight * dpr));
      redrawRef.current();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  // --- persistence ----------------------------------------------------------

  const persist = useCallback(() => {
    if (!dirtyRef.current) return savingRef.current;
    const description = JSON.stringify({ version: 2, items: itemsRef.current } satisfies BoardData);
    if (description.length > MAX_PAYLOAD_CHARS) {
      setSaveState("toolarge");
      return savingRef.current;
    }
    dirtyRef.current = false;
    setSaveState("saving");
    savingRef.current = savingRef.current.then(async () => {
      try {
        const res = await fetch(`/api/source-vision/${entryId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setSaveState(dirtyRef.current ? "saving" : "saved");
        queryClient.setQueryData<VisionEntry[]>(queryKey, (old) =>
          Array.isArray(old) ? old.map((e) => (e.id === entryId ? { ...e, description } : e)) : old
        );
      } catch {
        dirtyRef.current = true;
        setSaveState("error");
      }
    });
    return savingRef.current;
  }, [entryId, queryClient, queryKey]);

  const flush = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    void persist();
  }, [persist]);

  const scheduleSave = () => {
    dirtyRef.current = true;
    setSaveState("saving");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void persist();
    }, SAVE_DEBOUNCE_MS);
  };

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);

  // --- history --------------------------------------------------------------

  const pushUndo = (before: Item[]) => {
    undoRef.current = [...undoRef.current.slice(-(MAX_UNDO - 1)), before];
    redoRef.current = [];
  };

  const commit = (next: Item[]) => {
    pushUndo(itemsRef.current);
    itemsRef.current = next;
    syncHistory();
    redraw();
    scheduleSave();
  };

  const handleUndo = () => {
    const prev = undoRef.current[undoRef.current.length - 1];
    if (!prev) return;
    undoRef.current = undoRef.current.slice(0, -1);
    redoRef.current = [...redoRef.current, itemsRef.current];
    itemsRef.current = prev;
    syncHistory();
    redraw();
    scheduleSave();
  };

  const handleRedo = () => {
    const next = redoRef.current[redoRef.current.length - 1];
    if (!next) return;
    redoRef.current = redoRef.current.slice(0, -1);
    undoRef.current = [...undoRef.current, itemsRef.current];
    itemsRef.current = next;
    syncHistory();
    redraw();
    scheduleSave();
  };

  const handleClear = () => {
    if (itemsRef.current.length === 0) return;
    if (!window.confirm("¿Borrar todo el contenido de esta pizarra?")) return;
    setSelected(null);
    commit([]);
  };

  const handleDeleteSelected = () => {
    const id = selectedIdRef.current;
    if (!id) return;
    setSelected(null);
    commit(itemsRef.current.filter((i) => i.id !== id));
  };

  // --- text editing ---------------------------------------------------------

  const commitText = () => {
    const ed = editingRef.current;
    if (!ed) return;
    setEditing(null);
    if (document.activeElement === textareaRef.current) textareaRef.current?.blur();
    const text = ed.text.replace(/\s+$/, "");
    if (ed.id) {
      const existing = itemsRef.current.find((i) => i.id === ed.id);
      if (!existing) return redraw();
      if (!text.trim()) commit(itemsRef.current.filter((i) => i.id !== ed.id));
      else if (existing.type === "text" && existing.text !== text) {
        commit(itemsRef.current.map((i) => (i.id === ed.id ? { ...existing, text } : i)));
      } else redraw();
    } else if (text.trim()) {
      commit([...itemsRef.current, { id: newId(), type: "text", x: ed.x, y: ed.y, text, color: ed.color, size: ed.size }]);
    } else redraw();
  };

  const startEditing = (value: EditingText) => {
    flushSync(() => setEditing(value));
    const ta = textareaRef.current;
    if (ta) {
      ta.focus();
      const len = ta.value.length;
      ta.setSelectionRange(len, len);
    }
  };

  // --- tools ----------------------------------------------------------------

  const setTool = (t: Tool) => {
    if (editingRef.current) commitText();
    toolRef.current = t;
    setToolState(t);
    if (t !== "select") setSelected(null);
  };

  const toLogical = (clientX: number, clientY: number): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scale = getScale();
    return [(clientX - rect.left) / scale + viewRef.current[0], (clientY - rect.top) / scale + viewRef.current[1]];
  };

  const hitTest = (p: Point, radius: number, filter?: (i: Item) => boolean) => {
    const items = itemsRef.current;
    for (let i = items.length - 1; i >= 0; i--) {
      if (filter && !filter(items[i])) continue;
      if (itemHit(items[i], p, radius)) return items[i];
    }
    return null;
  };

  const handlePointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (activePointerRef.current !== null) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    // A tap while editing text just finishes the edit
    if (editingRef.current) {
      commitText();
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    activePointerRef.current = e.pointerId;
    const p = toLogical(e.clientX, e.clientY);
    const scale = getScale();
    const t = toolRef.current;

    if (t === "pen") {
      gestureRef.current = { kind: "draw" };
      currentStrokeRef.current = { id: newId(), type: "stroke", color, size: PEN_SIZES[sizeIndex], points: [p] };
      redraw();
    } else if (t === "eraser") {
      gestureRef.current = { kind: "erase", before: itemsRef.current, changed: false };
      eraseAt(p);
    } else if (t === "text") {
      gestureRef.current = { kind: "text", startClient: [e.clientX, e.clientY], p };
    } else {
      const sel = selectedIdRef.current ? itemsRef.current.find((i) => i.id === selectedIdRef.current) : null;
      if (sel) {
        const b = itemBounds(sel);
        const pad = 4 / scale;
        const hx = b.x + b.w + pad;
        const hy = b.y + b.h + pad;
        if (Math.abs(p[0] - hx) <= HANDLE_PX / scale && Math.abs(p[1] - hy) <= HANDLE_PX / scale) {
          gestureRef.current = { kind: "resize", before: itemsRef.current, start: p, orig: sel, origBounds: b, changed: false };
          return;
        }
      }
      const hit = hitTest(p, 8 / scale);
      if (hit) {
        setSelected(hit.id);
        gestureRef.current = { kind: "move", before: itemsRef.current, start: p, orig: hit, changed: false };
      } else {
        setSelected(null);
        gestureRef.current = { kind: "pan", startClient: [e.clientX, e.clientY], startView: [...viewRef.current] as Point };
      }
      redraw();
    }
  };

  const eraseAt = (p: Point) => {
    const g = gestureRef.current;
    if (!g || g.kind !== "erase") return;
    const radius = 10 / getScale();
    const remaining = itemsRef.current.filter((i) => i.type === "image" || !itemHit(i, p, radius));
    if (remaining.length !== itemsRef.current.length) {
      itemsRef.current = remaining;
      g.changed = true;
      redraw();
    }
  };

  const replaceItem = (item: Item) => {
    itemsRef.current = itemsRef.current.map((i) => (i.id === item.id ? item : i));
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (activePointerRef.current !== e.pointerId) return;
    e.preventDefault();
    const g = gestureRef.current;
    if (!g) return;

    if (g.kind === "draw" || g.kind === "erase") {
      const native = e.nativeEvent;
      const events = typeof native.getCoalescedEvents === "function" ? native.getCoalescedEvents() : [];
      const pts = (events.length > 0 ? events : [native]).map((ev) => toLogical(ev.clientX, ev.clientY));
      if (g.kind === "erase") {
        pts.forEach(eraseAt);
        return;
      }
      const stroke = currentStrokeRef.current;
      if (!stroke) return;
      const minDist = 1.5 / getScale();
      for (const p of pts) {
        const last = stroke.points[stroke.points.length - 1];
        if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= minDist) {
          stroke.points.push([Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]);
        }
      }
      redraw();
      return;
    }

    const p = toLogical(e.clientX, e.clientY);
    if (g.kind === "move") {
      const dx = p[0] - g.start[0];
      const dy = p[1] - g.start[1];
      if (!g.changed && Math.hypot(dx, dy) * getScale() < 3) return;
      g.changed = true;
      replaceItem(translateItem(g.orig, dx, dy));
      redraw();
    } else if (g.kind === "resize") {
      const dx = p[0] - g.start[0];
      const dy = p[1] - g.start[1];
      const ob = g.origBounds;
      const denom = ob.w * ob.w + ob.h * ob.h || 1;
      const f = Math.max(0.05, 1 + (dx * ob.w + dy * ob.h) / denom);
      g.changed = true;
      replaceItem(scaleItem(g.orig, ob, f));
      redraw();
    } else if (g.kind === "pan") {
      const scale = getScale();
      viewRef.current = [
        g.startView[0] - (e.clientX - g.startClient[0]) / scale,
        g.startView[1] - (e.clientY - g.startClient[1]) / scale,
      ];
      setViewMoved(viewRef.current[0] !== 0 || viewRef.current[1] !== 0);
      redraw();
    }
  };

  const finishGesture = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (activePointerRef.current !== e.pointerId) return;
    activePointerRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    const g = gestureRef.current;
    gestureRef.current = null;
    if (!g) return;

    if (g.kind === "draw") {
      const stroke = currentStrokeRef.current;
      currentStrokeRef.current = null;
      if (stroke && stroke.points.length > 0) commit([...itemsRef.current, stroke]);
      else redraw();
    } else if (g.kind === "erase" || g.kind === "move" || g.kind === "resize") {
      if (g.changed) {
        pushUndo(g.before);
        syncHistory();
        scheduleSave();
      }
      redraw();
    } else if (g.kind === "text" && e.type === "pointerup") {
      if (Math.hypot(e.clientX - g.startClient[0], e.clientY - g.startClient[1]) > 10) return;
      const hit = hitTest(g.p, 6 / getScale(), (i) => i.type === "text");
      if (hit && hit.type === "text") {
        startEditing({ id: hit.id, x: hit.x, y: hit.y, text: hit.text, color: hit.color, size: hit.size });
      } else {
        const size = TEXT_SIZES[sizeIndex];
        startEditing({ id: null, x: g.p[0], y: g.p[1] - size / 2, text: "", color, size });
      }
    }
  };

  const handleDoubleClick = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    if (toolRef.current !== "select") return;
    const hit = hitTest(toLogical(e.clientX, e.clientY), 6 / getScale(), (i) => i.type === "text");
    if (hit && hit.type === "text") {
      setSelected(null);
      startEditing({ id: hit.id, x: hit.x, y: hit.y, text: hit.text, color: hit.color, size: hit.size });
    }
  };

  // Wheel / trackpad scroll pans the board
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const scale = getScale();
      viewRef.current = [viewRef.current[0] + ev.deltaX / scale, viewRef.current[1] + ev.deltaY / scale];
      setViewMoved(true);
      redrawRef.current();
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  const resetView = () => {
    viewRef.current = [0, 0];
    setViewMoved(false);
    redraw();
  };

  // --- images ---------------------------------------------------------------

  const addImageFiles = async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    if (images.length === 0) return;
    if (editingRef.current) commitText();
    const added: ImageItem[] = [];
    let currentLength = JSON.stringify(itemsRef.current).length;
    const canvas = canvasRef.current;
    const scale = getScale();
    const viewW = canvas ? canvas.clientWidth / scale : LOGICAL_W;
    const viewH = canvas ? canvas.clientHeight / scale : LOGICAL_W * 0.6;
    for (const file of images) {
      try {
        const { src, w, h } = await fileToImage(file);
        if (currentLength + src.length > MAX_PAYLOAD_CHARS) {
          window.alert("La pizarra ya tiene demasiadas imágenes. Creá otra pizarra o quitá alguna.");
          break;
        }
        currentLength += src.length;
        const maxW = viewW * 0.6;
        const maxH = viewH * 0.7;
        const f = Math.min(maxW / w, maxH / h, 1.5);
        const iw = w * f;
        const ih = h * f;
        const offset = added.length * 24;
        added.push({
          id: newId(),
          type: "image",
          x: viewRef.current[0] + (viewW - iw) / 2 + offset,
          y: viewRef.current[1] + (viewH - ih) / 2 + offset,
          w: iw,
          h: ih,
          src,
        });
      } catch {
        window.alert(`No se pudo cargar "${file.name}"`);
      }
    }
    if (added.length === 0) return;
    commit([...itemsRef.current, ...added]);
    toolRef.current = "select";
    setToolState("select");
    setSelected(added[added.length - 1].id);
    redraw();
  };

  const addImageFilesRef = useRef(addImageFiles);
  addImageFilesRef.current = addImageFiles;

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    void addImageFiles(files);
  };

  // Paste images from the clipboard
  useEffect(() => {
    const onPaste = (ev: ClipboardEvent) => {
      const target = ev.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const files = Array.from(ev.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (files.length === 0) return;
      ev.preventDefault();
      void addImageFilesRef.current(files);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  const handleDrop = (e: ReactDragEvent<HTMLDivElement>) => {
    e.preventDefault();
    void addImageFiles(Array.from(e.dataTransfer.files));
  };

  // --- UI -------------------------------------------------------------------

  const toolButton = (active: boolean) =>
    cn(
      "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors disabled:opacity-40",
      active ? "border-primary bg-primary/15 text-primary" : "border-border hover:bg-muted"
    );

  const isDrawTool = tool === "pen" || tool === "text";
  const scaleNow = getScale();
  let textareaStyle: CSSProperties = {
    position: "absolute",
    left: -9999,
    top: 0,
    width: 10,
    height: 10,
    opacity: 0,
    pointerEvents: "none",
  };
  if (editing) {
    const base = editing.size * scaleNow;
    const fs = Math.max(16, base); // >=16px avoids iOS auto-zoom on focus
    const k = base / fs;
    const m = measureText(editing.text || " ", editing.size);
    textareaStyle = {
      position: "absolute",
      left: (editing.x - viewRef.current[0]) * scaleNow,
      top: (editing.y - viewRef.current[1]) * scaleNow,
      width: (Math.max(m.w + editing.size, editing.size * 4) * scaleNow) / k,
      height: (m.h * scaleNow) / k + 4,
      fontSize: fs,
      lineHeight: LINE_HEIGHT,
      fontFamily: FONT_FAMILY,
      transform: `scale(${k})`,
      transformOrigin: "top left",
      color: resolveColor(editing.color, isDark),
      background: "transparent",
      border: `1px dashed ${SELECTION_COLOR}`,
      outline: "none",
      padding: 0,
      margin: 0,
      resize: "none",
      overflow: "hidden",
      whiteSpace: "pre",
    };
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" title="Seleccionar / mover" className={toolButton(tool === "select")} onClick={() => setTool("select")}>
          <MousePointer2 className="h-4 w-4" />
        </button>
        <button type="button" title="Lápiz" className={toolButton(tool === "pen")} onClick={() => setTool("pen")}>
          <Pencil className="h-4 w-4" />
        </button>
        <button type="button" title="Goma (borra trazos y textos)" className={toolButton(tool === "eraser")} onClick={() => setTool("eraser")}>
          <Eraser className="h-4 w-4" />
        </button>
        <button type="button" title="Texto" className={toolButton(tool === "text")} onClick={() => setTool("text")}>
          <Type className="h-4 w-4" />
        </button>
        <button type="button" title="Agregar imagen" className={toolButton(false)} onClick={() => fileInputRef.current?.click()}>
          <ImagePlus className="h-4 w-4" />
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />

        <div className="mx-0.5 h-6 w-px bg-border" />
        {COLOR_TOKENS.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            onClick={() => {
              setColor(c);
              if (!isDrawTool) setTool("pen");
            }}
            className={cn(
              "h-6 w-6 shrink-0 rounded-full border-2 transition-transform",
              color === c && isDrawTool ? "scale-110 border-primary" : "border-border"
            )}
            style={{ backgroundColor: resolveColor(c, isDark) }}
          />
        ))}
        <div className="mx-0.5 h-6 w-px bg-border" />
        {PEN_SIZES.map((s, i) => (
          <button
            key={s}
            type="button"
            title={tool === "text" ? `Tamaño de texto ${TEXT_SIZES[i]}` : `Grosor ${s}`}
            className={toolButton(sizeIndex === i && isDrawTool)}
            onClick={() => {
              setSizeIndex(i);
              if (!isDrawTool) setTool("pen");
            }}
          >
            {tool === "text" ? (
              <span className="font-semibold leading-none" style={{ fontSize: 9 + i * 4 }}>A</span>
            ) : (
              <span className="rounded-full bg-current" style={{ width: Math.max(3, s / 1.5), height: Math.max(3, s / 1.5) }} />
            )}
          </button>
        ))}
        <div className="mx-0.5 h-6 w-px bg-border" />
        <button type="button" title="Deshacer" className={toolButton(false)} onClick={handleUndo} disabled={!history.canUndo}>
          <Undo2 className="h-4 w-4" />
        </button>
        <button type="button" title="Rehacer" className={toolButton(false)} onClick={handleRedo} disabled={!history.canRedo}>
          <Redo2 className="h-4 w-4" />
        </button>
        {selectedId && tool === "select" && (
          <button type="button" title="Eliminar elemento seleccionado" className={toolButton(false)} onClick={handleDeleteSelected}>
            <Trash className="h-4 w-4" />
          </button>
        )}
        <button type="button" title="Borrar todo" className={toolButton(false)} onClick={handleClear} disabled={!history.hasItems}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </button>
        {viewMoved && (
          <button type="button" title="Volver al inicio" className={toolButton(false)} onClick={resetView}>
            <LocateFixed className="h-4 w-4" />
          </button>
        )}
        <span className="ml-auto text-[11px] text-muted-foreground">
          {saveState === "saving" && "Guardando…"}
          {saveState === "saved" && "Guardado"}
          {saveState === "error" && <span className="text-destructive">Error al guardar</span>}
          {saveState === "toolarge" && <span className="text-destructive">Muy grande: quitá una imagen</span>}
        </span>
      </div>

      <div
        ref={wrapperRef}
        className="relative min-h-[200px] flex-1 overflow-hidden rounded-md border border-border"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <canvas
          ref={canvasRef}
          className={cn(
            "absolute inset-0 block h-full w-full touch-none select-none",
            tool === "select" ? "cursor-default" : tool === "text" ? "cursor-text" : tool === "eraser" ? "cursor-cell" : "cursor-crosshair"
          )}
          style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishGesture}
          onPointerCancel={finishGesture}
          onDoubleClick={handleDoubleClick}
          onContextMenu={(e) => e.preventDefault()}
        />
        <textarea
          ref={textareaRef}
          tabIndex={editing ? 0 : -1}
          aria-hidden={!editing}
          value={editing?.text ?? ""}
          onChange={(e) => {
            if (!editingRef.current) return;
            setEditing({ ...editingRef.current, text: e.target.value });
          }}
          onBlur={commitText}
          spellCheck={false}
          style={textareaStyle}
        />
      </div>
    </div>
  );
}
