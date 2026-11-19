import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pause, Play } from "lucide-react";
import { useAllTaskTimers, timerElapsedMs, type TaskTimerState } from "@/lib/task-timers";
import { conjugateTaskTitle } from "@/lib/voseo";

// Picture in picture de "Tareas de hoy": una ventanita flotante, encima de otras apps/pestañas,
// con la tarea de ahora (la que tiene el ▶ andando, o si no la desbloqueada) y su contador.
// - Chrome/Edge de escritorio: Document Picture-in-Picture (HTML de verdad, con botón ▶/⏸).
// - Safari (iPhone/iPad/Mac) y otros: un <video> que muestra un canvas redibujado cada segundo
//   (el PiP clásico de video, que solo muestra; el ▶/⏸ queda en la app).

export type PipTask = { timerKey: string; title: string; minutes: number | null };

type DocPipApi = { requestWindow: (opts?: { width?: number; height?: number }) => Promise<Window> };
type WebkitVideo = HTMLVideoElement & {
  webkitSupportsPresentationMode?: (mode: string) => boolean;
  webkitSetPresentationMode?: (mode: string) => void;
  webkitPresentationMode?: string;
};

const docPip = () => (window as unknown as { documentPictureInPicture?: DocPipApi }).documentPictureInPicture;

function videoPipSupported() {
  if (typeof HTMLCanvasElement === "undefined" || typeof HTMLCanvasElement.prototype.captureStream !== "function") return false;
  if (document.pictureInPictureEnabled) return true;
  const probe = document.createElement("video") as WebkitVideo;
  return !!probe.webkitSupportsPresentationMode?.("picture-in-picture");
}

export function pipSupported() {
  if (typeof window === "undefined") return false;
  return !!docPip() || videoPipSupported();
}

function formatClock(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

// Mismo criterio que el contador de la fila: cuenta para atrás el arranque y, cumplido, para arriba.
function timeInfo(state: TaskTimerState | undefined, minutes: number | null, now: number) {
  if (!state) return { caption: "Sin empezar", clock: minutes ? `${minutes}:00` : "0:00" };
  const elapsed = timerElapsedMs(state, now);
  if (state.starterMs > 0 && elapsed < state.starterMs) return { caption: "Arranque · quedan", clock: formatClock(state.starterMs - elapsed) };
  return { caption: state.starterMs > 0 ? "✓ Arranque cumplido · llevo" : "Llevo", clock: formatClock(elapsed) };
}

// Copia los estilos de la app a la ventanita (Tailwind, tema oscuro, animación de los puntitos).
function copyStyles(target: Window) {
  [...document.styleSheets].forEach((sheet) => {
    try {
      const style = target.document.createElement("style");
      style.textContent = [...sheet.cssRules].map((r) => r.cssText).join("\n");
      target.document.head.appendChild(style);
    } catch {
      if (!sheet.href) return;
      const link = target.document.createElement("link");
      link.rel = "stylesheet";
      link.href = sheet.href;
      target.document.head.appendChild(link);
    }
  });
  target.document.documentElement.className = document.documentElement.className;
  target.document.body.className = "bg-background text-foreground";
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width <= maxWidth || !line) line = next;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/\s*\S*$/, "") + "…";
    return kept;
  }
  return lines;
}

function drawCanvas(canvas: HTMLCanvasElement, title: string, caption: string, clock: string, running: boolean) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width: W, height: H } = canvas;
  ctx.fillStyle = "#18181b";
  ctx.fillRect(0, 0, W, H);
  const pad = 36;
  ctx.textBaseline = "top";
  ctx.fillStyle = "#fafafa";
  ctx.font = "600 38px system-ui, -apple-system, sans-serif";
  const lines = wrapLines(ctx, title + (running ? " …" : ""), W - pad * 2, 2);
  lines.forEach((l, i) => ctx.fillText(l, pad, pad + i * 46));
  ctx.fillStyle = "#a1a1aa";
  ctx.font = "26px system-ui, -apple-system, sans-serif";
  ctx.fillText(caption, pad, H - pad - 130);
  ctx.fillStyle = "#f59e0b";
  ctx.font = "700 96px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillText(clock, pad, H - pad - 96);
}

// task: lo que se muestra. onToggle: ▶/⏸ desde la ventanita (solo en la de HTML). enabled: prepara
// el video del modo Safari solo mientras "Tareas de hoy" está abierto (el PiP de video tiene que
// pedirse dentro del toque, con el video ya cargado).
export function useTaskPip(task: PipTask | null, onToggle: (() => void) | null, enabled: boolean) {
  const supported = useMemo(pipSupported, []);
  const [docWin, setDocWin] = useState<Window | null>(null);
  const [videoActive, setVideoActive] = useState(false);
  const videoRef = useRef<WebkitVideo | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timers = useAllTaskTimers();
  const [now, setNow] = useState(() => Date.now());
  const active = !!docWin || videoActive;
  const useVideo = supported && !docPip();
  const prepareVideo = useVideo && (enabled || videoActive);

  useEffect(() => {
    if (!active && !prepareVideo) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active, prepareVideo]);

  const state = task ? timers[task.timerKey] : undefined;
  const running = state?.status === "running";
  const title = task ? (running ? conjugateTaskTitle(task.title, "gerund") : task.title) : "No hay tarea ahora";
  const info = task ? timeInfo(state, task.minutes, now) : { caption: "", clock: "—" };

  // Modo video: canvas → stream → <video> escondido, ya reproduciéndose.
  useEffect(() => {
    if (!prepareVideo) return;
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 360;
    const video = document.createElement("video") as WebkitVideo;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.autoplay = true;
    Object.assign(video.style, { position: "fixed", left: "0", bottom: "0", width: "1px", height: "1px", opacity: "0", pointerEvents: "none" });
    canvasRef.current = canvas;
    videoRef.current = video;
    drawCanvas(canvas, "…", "", "", false);
    video.srcObject = canvas.captureStream();
    document.body.appendChild(video);
    video.play().catch(() => {});
    const onLeave = () => setVideoActive(false);
    const onMode = () => {
      if (video.webkitPresentationMode !== "picture-in-picture") setVideoActive(false);
    };
    video.addEventListener("leavepictureinpicture", onLeave);
    video.addEventListener("webkitpresentationmodechanged", onMode);
    return () => {
      video.removeEventListener("leavepictureinpicture", onLeave);
      video.removeEventListener("webkitpresentationmodechanged", onMode);
      if (document.pictureInPictureElement === video) document.exitPictureInPicture().catch(() => {});
      video.srcObject = null;
      video.remove();
      videoRef.current = null;
      canvasRef.current = null;
    };
  }, [prepareVideo]);

  useEffect(() => {
    if (canvasRef.current) drawCanvas(canvasRef.current, title, info.caption, info.clock, running);
  }, [title, info.caption, info.clock, running, prepareVideo]);

  // Cerrar la ventanita de HTML al desmontar.
  useEffect(() => () => docWin?.close(), [docWin]);

  const toggle = async () => {
    if (docWin) {
      docWin.close();
      return;
    }
    const video = videoRef.current;
    if (videoActive && video) {
      if (document.pictureInPictureElement === video) await document.exitPictureInPicture().catch(() => {});
      else video.webkitSetPresentationMode?.("inline");
      setVideoActive(false);
      return;
    }
    const dp = docPip();
    if (dp) {
      try {
        const w = await dp.requestWindow({ width: 340, height: 170 });
        copyStyles(w);
        w.addEventListener("pagehide", () => setDocWin(null));
        setDocWin(w);
      } catch {
        /* el navegador lo rechazó (sin gesto, cancelado…) */
      }
      return;
    }
    if (!video) return;
    // Sin await antes: el pedido tiene que salir dentro del toque.
    try {
      if (document.pictureInPictureEnabled && video.requestPictureInPicture) await video.requestPictureInPicture();
      else video.webkitSetPresentationMode?.("picture-in-picture");
      setVideoActive(true);
    } catch {
      /* rechazado */
    }
  };

  const portal = docWin
    ? createPortal(
        <div className="no-touch-select flex h-screen flex-col justify-center gap-1 px-4 py-3">
          <p className="line-clamp-2 text-base font-semibold leading-snug">
            {title}
            {running && (
              <span className="running-dots ml-1.5 inline-flex items-end gap-[2px] align-baseline text-amber-500" aria-label="En proceso">
                <span />
                <span />
                <span />
              </span>
            )}
          </p>
          {info.caption && <p className="text-xs text-muted-foreground">{info.caption}</p>}
          <div className="flex items-center gap-3">
            <span className="text-4xl font-bold tabular-nums text-amber-600 dark:text-amber-400">{info.clock}</span>
            {task && onToggle && (
              <button
                type="button"
                onClick={onToggle}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={running ? "Pausar" : "Iniciar"}
              >
                {running ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
              </button>
            )}
          </div>
        </div>,
        docWin.document.body,
      )
    : null;

  return { supported, active, toggle, portal };
}
