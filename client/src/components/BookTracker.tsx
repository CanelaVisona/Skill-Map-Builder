"use client";

import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Trash2, Edit, Swords } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const GREEN_RAMP = [
  "#C0DD97",
  "#97C459",
  "#7aad3a",
  "#639922",
  "#4f7d1b",
  "#3B6D11",
  "#27500A",
  "#173404",
];

const DAY_NAMES = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"];

interface BookSession {
  id: string;
  date: string;
  page: number;
}

interface Book {
  id: string;
  userId: string;
  title: string;
  author: string;
  totalPages: number;
  mode: "pages" | "chapters";
  goalDays: number[];
  createdAt: string;
  updatedAt: string;
  sessions?: BookSession[];
}

// Opción A: Timestamps UTC + offset local
function todayStr(): string {
  const now = new Date();
  const offset = -now.getTimezoneOffset() * 60000;
  const localDate = new Date(now.getTime() + offset);
  return localDate.toISOString().split('T')[0];
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const newY = date.getFullYear();
  const newM = String(date.getMonth() + 1).padStart(2, "0");
  const newD = String(date.getDate()).padStart(2, "0");
  return `${newY}-${newM}-${newD}`;
}

function getDOW(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getDay();
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return d + "/" + m + "/" + y.slice(2);
}

function getUniqueDates(sessions: BookSession[]): string[] {
  return [...new Set(sessions.map((s) => s.date))].sort();
}

function getColorForDate(sessions: BookSession[], date: string): string {
  const dates = getUniqueDates(sessions);
  const today = todayStr();
  const allDatesIncToday = dates.includes(today) ? dates : [...dates, today];
  const total = allDatesIncToday.length;
  const idx = allDatesIncToday.indexOf(date);
  return getGreenForIndex(idx === -1 ? total - 1 : idx, Math.max(total, 2));
}

function getGreenForIndex(i: number, total: number): string {
  if (total <= 1) return GREEN_RAMP[3];
  const ratio = i / Math.max(total - 1, 1);
  const idx = Math.round(ratio * (GREEN_RAMP.length - 1));
  return GREEN_RAMP[Math.min(idx, GREEN_RAMP.length - 1)];
}

function getTodaySessions(sessions: BookSession[]): BookSession[] {
  return sessions.filter((s) => s.date === todayStr());
}

function getPrevPage(sessions: BookSession[]): number {
  const t = todayStr();
  const p = sessions.filter((s) => s.date < t);
  return p.length ? Math.max(...p.map((s) => s.page)) : 0;
}

// Complex registration logic: calculates which sessions to save based on rules
function calculateSessionsForPage(
  currentSessions: BookSession[],
  newPage: number,
  today: string
): BookSession[] {
  const todaySessions = currentSessions.filter((s) => s.date === today).map((s) => s.page).sort((a, b) => a - b);
  
  // Rule 1: No duplicates
  if (todaySessions.includes(newPage)) {
    return currentSessions; // No change
  }
  
  if (todaySessions.length === 0) {
    // First registration of the day
    return [...currentSessions, { id: "", date: today, page: newPage, createdAt: "", bookId: "", userId: "" }];
  }
  
  const minPage = Math.min(...todaySessions);
  const maxPage = Math.max(...todaySessions);
  
  // Rule 2: Smaller than all
  if (newPage < minPage) {
    // Delete all today sessions, save only new smaller number
    return [
      ...currentSessions.filter((s) => s.date !== today),
      { id: "", date: today, page: newPage, createdAt: "", bookId: "", userId: "" }
    ];
  }
  
  // Rule 3: Between two registrations (smaller than last, but not smaller than all)
  if (newPage < maxPage && newPage > minPage) {
    // Delete only the last (maximum) registration
    const nonLastToday = currentSessions.filter((s) => !(s.date === today && s.page === maxPage));
    return [
      ...nonLastToday,
      { id: "", date: today, page: newPage, createdAt: "", bookId: "", userId: "" }
    ];
  }
  
  // Rule 4: Greater than all - add as new registration
  if (newPage > maxPage) {
    return [
      ...currentSessions,
      { id: "", date: today, page: newPage, createdAt: "", bookId: "", userId: "" }
    ];
  }
  
  return currentSessions; // fallback
}

function computeStreak(book: Book): {
  streak: number;
  daysDisplay: Array<{ date: string; read: boolean; isToday?: boolean; isNext?: boolean }>;
} {
  const today = todayStr();
  const sessions = book.sessions || [];
  const readDates = new Set(getUniqueDates(sessions));
  const goalDays = new Set(book.goalDays);
  let streak = 0;
  let cur = addDays(today, -1);

  while (true) {
    if (!goalDays.has(getDOW(cur))) {
      cur = addDays(cur, -1);
      continue;
    }
    if (readDates.has(cur)) {
      streak++;
      cur = addDays(cur, -1);
    } else {
      break;
    }
  }

  if (readDates.has(today)) streak++;

  const daysDisplay = [];
  for (let i = streak - 1; i >= 0; i--) {
    daysDisplay.push({ date: addDays(today, -i), read: true, isToday: i === 0 });
  }

  let nextGoal = addDays(today, 1);
  while (!goalDays.has(getDOW(nextGoal))) nextGoal = addDays(nextGoal, 1);
  daysDisplay.push({ date: nextGoal, read: false, isNext: true });

  return { streak, daysDisplay };
}

// Hook para long press
function useLongPress(callback: () => void, duration = 500) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [isPressed, setIsPressed] = useState(false);
  const MOVE_THRESHOLD = 10;

  const clearPress = () => {
    setIsPressed(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const startPress = () => {
    setIsPressed(true);
    timeoutRef.current = setTimeout(() => {
      callback();
      setIsPressed(false);
    }, duration);
  };

  const handleMouseDown = () => startPress();
  const handleMouseUp = () => clearPress();
  const handleMouseLeave = () => clearPress();

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    startPress();
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartRef.current.y);
    if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) {
      clearPress();
    }
  };

  const handleTouchEnd = () => {
    touchStartRef.current = null;
    clearPress();
  };

  return {
    onMouseDown: handleMouseDown,
    onMouseUp: handleMouseUp,
    onMouseLeave: handleMouseLeave,
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    onTouchCancel: handleTouchEnd,
    isPressed,
    cancel: clearPress,
  };
}

// SVG Track Component with manual drag implementation
function SVGTrack({ book, sessions, onDragStart }: { book: Book; sessions: BookSession[]; onDragStart?: () => void }) {
  const today = todayStr();
  const todayColor = getColorForDate(sessions, today);
  const prevPage = getPrevPage(sessions);
  const outer = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [currentPage, setCurrentPage] = useState(Math.max(...(getTodaySessions(sessions).map((s) => s.page) || [prevPage])));

  const handleDrag = (clientX: number) => {
    if (!outer.current) return;
    const rect = outer.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    const newPage = Math.round(ratio * book.totalPages);
    setCurrentPage(Math.max(0, Math.min(newPage, book.totalPages)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    onDragStart?.();
    handleDrag(e.clientX);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      onDragStart?.();
      handleDrag(e.clientX);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    onDragStart?.();
    if (e.touches.length > 0) {
      handleDrag(e.touches[0].clientX);
    }
    e.preventDefault();
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (isDragging && e.touches.length > 0) {
      onDragStart?.();
      e.preventDefault();
      handleDrag(e.touches[0].clientX);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.addEventListener("touchmove", handleTouchMove, { passive: false });
      document.addEventListener("touchend", handleTouchEnd);
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDragging]);

  useEffect(() => {
    if (!outer.current) return;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "80");
    svg.style.overflow = "visible";
    svg.style.display = "block";

    const W = outer.current.clientWidth || 300;
    const TY = 40;
    const PAD = 0;
    const trackW = W - PAD * 2;
    const total = book.totalPages || 1;

    function px(p: number): number {
      return PAD + (p / total) * trackW;
    }

    // Background track
    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bg.setAttribute("x", String(PAD));
    bg.setAttribute("y", String(TY - 6));
    bg.setAttribute("width", String(trackW));
    bg.setAttribute("height", "12");
    bg.setAttribute("rx", "6");
    bg.setAttribute("fill", "var(--color-background-secondary)");
    svg.appendChild(bg);

    // Past day segments
    const pastDates = getUniqueDates(sessions).filter((d) => d < today);
    let cursor = 0;

    pastDates.forEach((date) => {
      const maxPage = Math.max(
        ...sessions.filter((s) => s.date === date).map((s) => s.page)
      );
      const col = getColorForDate(sessions, date);

      if (maxPage > cursor) {
        const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        r.setAttribute("x", String(px(cursor)));
        r.setAttribute("y", String(TY - 6));
        r.setAttribute("width", String(Math.max(0, px(maxPage) - px(cursor))));
        r.setAttribute("height", "12");
        r.setAttribute("rx", "6");
        r.setAttribute("fill", col);
        svg.appendChild(r);
        cursor = maxPage;
      }
    });

    // Live segment (today's reading)
    const todayPages = getTodaySessions(sessions)
      .map((s) => s.page)
      .sort((a, b) => a - b);

    const liveSegRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    liveSegRect.setAttribute("y", String(TY - 6));
    liveSegRect.setAttribute("height", "12");
    liveSegRect.setAttribute("rx", "6");
    liveSegRect.setAttribute("fill", todayColor);
    liveSegRect.id = "liveseg-" + book.id;
    liveSegRect.setAttribute("x", String(px(prevPage)));
    liveSegRect.setAttribute("width", String(Math.max(0, px(Math.max(...todayPages, currentPage)) - px(prevPage))));
    svg.appendChild(liveSegRect);

    // Today's intermediate markers
    todayPages.forEach((page, i) => {
      if (i < todayPages.length - 1) {
        const mark = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        mark.setAttribute("cx", String(px(page)));
        mark.setAttribute("cy", String(TY));
        mark.setAttribute("r", "8");
        mark.setAttribute("fill", todayColor);
        mark.setAttribute("stroke", "var(--color-background)");
        mark.setAttribute("stroke-width", "2");
        svg.appendChild(mark);
      }
    });

    // Main thumb circle (responsive, min 16px radius)
    const maxReg = currentPage;
    const circleRadius = Math.max(16, W > 414 ? 10 : 16);
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", String(px(maxReg)));
    circle.setAttribute("cy", String(TY));
    circle.setAttribute("r", String(circleRadius));
    circle.setAttribute("fill", todayColor);
    circle.setAttribute("stroke", "var(--color-background)");
    circle.setAttribute("stroke-width", "2");
    svg.appendChild(circle);

    // Number above the circle
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", String(px(maxReg)));
    text.setAttribute("y", String(TY - 18));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("font-size", "12");
    text.setAttribute("font-weight", "500");
    text.setAttribute("fill", todayColor);
    text.textContent = String(currentPage);
    svg.appendChild(text);

    // Clean old SVG
    outer.current.querySelectorAll("svg").forEach((s) => s.remove());
    outer.current.appendChild(svg);
  }, [book, sessions, currentPage]);

  return (
    <div
      ref={outer}
      style={{
        position: "relative",
        height: "80px",
        marginBottom: "0px",
        cursor: isDragging ? "grabbing" : "grab",
        touchAction: "none",
      }}
      onMouseDown={handleMouseDown as any}
      onTouchStart={handleTouchStart as any}
    />
  );
}

// Book Card with Long Press for Delete/Edit
function BookCardWithLongPress({
  book,
  sessions,
  onDetail,
  onDelete,
  onEdit,
  onRegisterPage,
  onArchive,
}: {
  book: Book;
  sessions: BookSession[];
  onDetail: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onRegisterPage: () => void;
  onArchive: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const longPressHandler = useLongPress(() => setShowMenu(true), 800);
  const { streak, daysDisplay } = computeStreak(book);
  const prevPage = getPrevPage(sessions);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const DRAG_THRESHOLD = 5;

  const handleClick = () => {
    if (!showMenu) {
      onDetail();
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const dx = Math.abs(touch.clientX - touchStartRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartRef.current.y);
    
    // Si movió más del threshold, no navegar
    if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
      touchStartRef.current = null;
      return;
    }
    
    // Si fue un tap limpio, navegar
    if (!showMenu) {
      onDetail();
    }
    touchStartRef.current = null;
  };

  // Determinar color según streak
  let borderColor = "border-green-500/30";
  let bgColor = "bg-green-500/5";
  let hoverBorder = "hover:border-green-500/50";
  let activeBg = "active:bg-green-500/10";
  
  if (streak === 0) {
    borderColor = "border-gray-500/30";
    bgColor = "bg-gray-500/5";
    hoverBorder = "hover:border-gray-500/50";
    activeBg = "active:bg-gray-500/10";
  }

  // Próximo día (solo el punteado con +1)
  const nextDayCircle = daysDisplay.find((d) => d.isNext);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      {...longPressHandler}
      className={`rounded-2xl border ${borderColor} ${bgColor} px-3 py-2.5 mb-2 cursor-pointer ${hoverBorder} transition-all ${activeBg}`}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header con título */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <span className="font-bold text-sm text-foreground block truncate">{book.title}</span>
          <span className="text-xs text-muted-foreground block">{book.author}</span>
        </div>
        <span className="text-xs bg-green-500/30 text-green-700 dark:text-green-400 px-2 py-1 rounded-full font-bold flex-shrink-0 whitespace-nowrap">
          {prevPage}/{book.totalPages}
        </span>
      </div>

      {/* SVG Track */}
      <div className="mb-3">
        <SVGTrack book={book} sessions={sessions} onDragStart={longPressHandler.cancel} />
      </div>

      {/* Streak */}
      <div className="text-xs font-medium text-foreground mb-2">
        {streak} día{streak !== 1 ? "s" : ""} 🔥
      </div>

      {/* Próximo día a leer */}
      {nextDayCircle && (
        <div className="flex gap-1 mb-2">
          <div
            className="w-5 h-5 rounded-full border-2 border-dashed border-green-600 flex items-center justify-center text-[10px]"
          >
            <span className="text-green-600">+1</span>
          </div>
        </div>
      )}

      {/* Botones */}
      {showMenu ? (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap gap-2"
        >
          <Button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(false);
            }}
            className="flex-1 min-w-[60px] rounded-xl bg-green-500/20 text-green-700 dark:text-green-400 hover:bg-green-500/30 border border-green-500/50 text-xs h-8"
          >
            Cancelar
          </Button>
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="flex-1 min-w-[60px] rounded-xl bg-blue-500/20 text-blue-700 dark:text-blue-400 hover:bg-blue-500/30 border border-blue-500/50 text-xs h-8"
          >
            <Edit className="h-3 w-3 mr-1" />
            Editar
          </Button>
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onArchive();
              setShowMenu(false);
            }}
            className="flex-1 min-w-[60px] rounded-xl bg-purple-500/20 text-purple-700 dark:text-purple-400 hover:bg-purple-500/30 border border-purple-500/50 text-xs h-8"
          >
            Archivar
          </Button>
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
              setShowMenu(false);
            }}
            className="flex-1 min-w-[60px] rounded-xl bg-red-500/20 text-red-700 dark:text-red-400 hover:bg-red-500/30 border border-red-500/50 text-xs h-8"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Eliminar
          </Button>
        </motion.div>
      ) : (
        <Button
          onClick={(e) => {
            e.stopPropagation();
            onRegisterPage();
          }}
          className="w-full rounded-xl bg-green-500/20 text-green-700 dark:text-green-400 hover:bg-green-500/30 border border-green-500/50 text-xs h-12 min-h-12"
        >
          Registrar
        </Button>
      )}
    </motion.div>
  );
}

// Detail Panel - Redesigned with timeline and today banner
function DetailPanel({
  book,
  sessions,
  onBack,
  isArchived = false,
  onArchive,
  onUnarchive,
  onDelete,
}: {
  book: Book;
  sessions: BookSession[];
  onBack: () => void;
  isArchived?: boolean;
  onArchive?: () => void;
  onUnarchive?: () => void;
  onDelete?: () => void;
}) {
  const today = todayStr();
  const { streak, daysDisplay } = computeStreak(book);
  const goalDaysStr = book.goalDays
    .map((dow) => DAY_NAMES[dow])
    .join(" · ");
  
  // Get today's sessions
  const todaySessions = getTodaySessions(sessions);
  const todayMaxPage = todaySessions.length > 0 ? Math.max(...todaySessions.map((s) => s.page)) : null;
  
  // Count unique dates with sessions
  const uniqueReadDates = getUniqueDates(sessions).length;
  
  // Get max page ever read (for progress metric)
  const maxPageEver = sessions.length > 0 ? Math.max(...sessions.map((s) => s.page)) : 0;
  
  // Remove duplicate sessions (keep only highest page per date)
  const sessionsNoDups: BookSession[] = [];
  const dateMap = new Map<string, BookSession>();
  sessions.forEach((s) => {
    const existing = dateMap.get(s.date);
    if (!existing || s.page > existing.page) {
      dateMap.set(s.date, s);
    }
  });
  dateMap.forEach((v) => sessionsNoDups.push(v));
  const sortedSessions = sessionsNoDups.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="border-b border-border/30 px-5 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0">
            <h2 className="font-black text-lg text-foreground truncate">{book.title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{book.author}</p>
          </div>
        </div>
        {isArchived && (
          <div className="flex gap-1.5 flex-shrink-0">
            {onUnarchive && (
              <Button
                onClick={onUnarchive}
                className="h-8 px-2 text-xs bg-green-500/20 text-green-700 dark:text-green-400 hover:bg-green-500/30 border border-green-500/50"
              >
                Restaurar
              </Button>
            )}
            {onDelete && (
              <Button
                onClick={onDelete}
                className="h-8 px-2 text-xs bg-red-500/20 text-red-700 dark:text-red-400 hover:bg-red-500/30 border border-red-500/50"
              >
                Eliminar
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 px-4 py-4 space-y-4">
        {/* Hoy Banner */}
        <div className="border border-yellow-500/40 bg-yellow-500/10 rounded-lg px-2.5 py-1.5 text-center">
          <div className="text-lg mb-0.5">🔥</div>
          <p className="text-xs font-black text-yellow-500/90 mb-0.5">Hoy</p>
          {todayMaxPage !== null ? (
            <p className="text-xs text-yellow-500/80">¡Estás en {book.mode === "chapters" ? "el capítulo" : "la página"} {todayMaxPage}!</p>
          ) : (
            <p className="text-xs text-yellow-500/80">¡Hoy es el día!</p>
          )}
        </div>

        {/* Timeline */}
        <div>
          <p className="text-xs font-bold text-muted-foreground mb-3 text-center">HISTORIAL DE LECTURA</p>
          {daysDisplay.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">Sin sesiones registradas</p>
          ) : (
            <div className="flex justify-center gap-3 flex-wrap">
              {daysDisplay.map((day) => {
                const color = day.read ? getColorForDate(sessions, day.date) : "#666";
                return (
                  <div key={day.date} className="flex flex-col items-center">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center text-base font-bold border-2 transition-all`}
                      style={{
                        backgroundColor: day.read ? color + "30" : "transparent",
                        borderColor: color,
                        borderStyle: day.read ? "solid" : "dashed",
                      }}
                      title={formatDate(day.date)}
                    >
                      {day.read ? "🔥" : "+1"}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{day.date.split("-").slice(2).join("/")}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Goal days */}
        {goalDaysStr && (
          <div className="text-center">
            <p className="text-xs text-muted-foreground">{goalDaysStr}</p>
          </div>
        )}

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-background-secondary/50 border border-border/30 px-3 py-4 text-center">
            <p className="text-2xl font-black text-foreground mb-1">{maxPageEver}/{book.totalPages}</p>
            <p className="text-xs text-muted-foreground font-medium">{book.mode === "chapters" ? "Capítulos" : "Páginas"}</p>
          </div>
          <div className="rounded-lg bg-background-secondary/50 border border-border/30 px-3 py-4 text-center">
            <p className="text-2xl font-black text-foreground mb-1">{uniqueReadDates}</p>
            <p className="text-xs text-muted-foreground font-medium">Días de lectura</p>
          </div>
        </div>

        {/* Sessions */}
        {sortedSessions.length > 0 && (
          <div>
            <p className="text-xs font-bold text-muted-foreground mb-2">SESIONES ({sortedSessions.length})</p>
            <div className="space-y-1">
              {sortedSessions.map((session) => (
                <div key={session.id} className="text-xs flex justify-between px-3 py-2 bg-background-secondary/50 rounded-lg border border-border/30">
                  <span className="font-medium text-foreground">{formatDate(session.date)}</span>
                  <span className="text-muted-foreground">{session.page} {book.mode === "chapters" ? "cap." : "pág."}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Add Panel
function AddPanel({
  onBack,
  onSubmit,
  editingBook,
}: {
  onBack: () => void;
  onSubmit: (data: {
    title: string;
    author: string;
    totalPages: number;
    mode: "pages" | "chapters";
    goalDays: number[];
  }) => void;
  editingBook?: Book;
}) {
  const [title, setTitle] = useState(editingBook?.title || "");
  const [author, setAuthor] = useState(editingBook?.author || "");
  const [total, setTotal] = useState(editingBook?.totalPages.toString() || "");
  const [mode, setMode] = useState<"pages" | "chapters">(editingBook?.mode || "pages");
  const [goalDays, setGoalDays] = useState<number[]>(editingBook?.goalDays || [1, 2, 3, 4, 5]);

  const toggleDay = (dow: number) => {
    if (goalDays.includes(dow)) {
      if (goalDays.length > 1) {
        setGoalDays(goalDays.filter((d) => d !== dow));
      }
    } else {
      setGoalDays([...goalDays, dow].sort());
    }
  };

  const handleSubmit = () => {
    if (!title || !total || isNaN(parseInt(total)) || parseInt(total) < 1) return;
    onSubmit({
      title,
      author,
      totalPages: parseInt(total),
      mode,
      goalDays,
    });
    if (!editingBook) {
      setTitle("");
      setAuthor("");
      setTotal("");
      setMode("pages");
      setGoalDays([1, 2, 3, 4, 5]);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="bg-background border-b border-border/30 px-5 py-3 flex items-center gap-2">
        <button
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-lg font-semibold text-foreground">{editingBook ? "Editar Libro" : "Agregar Libro"}</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-3 scrollbar-thin scrollbar-thumb-muted-foreground/20">
        <Input placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input placeholder="Autor" value={author} onChange={(e) => setAuthor(e.target.value)} />

        <div>
          <label className="text-xs text-muted-foreground block mb-1.5">Unidad de medida</label>
          <div className="flex gap-1.5">
            <button
              onClick={() => setMode("pages")}
              className={`flex-1 py-1.5 px-2 text-xs rounded font-medium transition-colors ${
                mode === "pages"
                  ? "bg-green-100 border border-green-600 text-green-900"
                  : "bg-background-secondary border border-border/30 text-muted-foreground"
              }`}
            >
              Páginas
            </button>
            <button
              onClick={() => setMode("chapters")}
              className={`flex-1 py-1.5 px-2 text-xs rounded font-medium transition-colors ${
                mode === "chapters"
                  ? "bg-green-100 border border-green-600 text-green-900"
                  : "bg-background-secondary border border-border/30 text-muted-foreground"
              }`}
            >
              Capítulos
            </button>
          </div>
        </div>

        <Input
          type="number"
          placeholder={mode === "pages" ? "Total de páginas" : "Total de capítulos"}
          value={total}
          onChange={(e) => setTotal(e.target.value)}
          min="1"
        />

        <div>
          <label className="text-xs text-muted-foreground block mb-1.5">Días de lectura</label>
          <div className="grid grid-cols-7 gap-1">
            {DAY_NAMES.map((name, dow) => (
              <button
                key={name}
                onClick={() => toggleDay(dow)}
                className={`aspect-square text-xs font-medium rounded transition-colors ${
                  goalDays.includes(dow)
                    ? "bg-green-100 border border-green-600 text-green-900"
                    : "bg-background-secondary border border-border/30 text-muted-foreground"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-background border-t border-border/30 px-5 py-3">
        <Button onClick={handleSubmit} className="w-full">
          {editingBook ? "Guardar cambios" : "Agregar Libro"}
        </Button>
      </div>
    </div>
  );
}

// Archived Panel
function ArchivedPanel({
  books,
  onBack,
  onDetail,
  onUnarchive,
  onDelete,
}: {
  books: Book[];
  onBack: () => void;
  onDetail: (bookId: string) => void;
  onUnarchive: (bookId: string) => void;
  onDelete: (bookId: string) => void;
}) {
  const longPressTimers = useRef<Record<string, NodeJS.Timeout>>({});

  const handleBookPressStart = (bookId: string) => {
    const timer = setTimeout(() => {
      // Show menu on long press
    }, 500);
    longPressTimers.current[bookId] = timer;
  };

  const handleBookPressEnd = (bookId: string) => {
    const timer = longPressTimers.current[bookId];
    if (timer) {
      clearTimeout(timer);
      delete longPressTimers.current[bookId];
    }
  };

  useEffect(() => {
    return () => {
      Object.values(longPressTimers.current).forEach(timer => clearTimeout(timer));
    };
  }, []);

  return (
    <div className="w-full flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-yellow-500/30 px-4 sm:px-6 py-5 bg-gradient-to-r from-yellow-500/5 to-amber-500/5">
        <div className="flex items-start gap-3 sm:gap-4">
          <button
            onClick={onBack}
            className="flex-shrink-0 mt-0.5 sm:mt-1 rounded hover:bg-yellow-500/10 p-1.5 sm:p-1 transition-colors h-8 w-8 sm:h-auto sm:w-auto touch-manipulation"
          >
            <ArrowLeft className="h-5 w-5 sm:h-5 sm:w-5 text-yellow-600 dark:text-yellow-400" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="font-black text-base sm:text-lg text-yellow-700 dark:text-yellow-300 flex items-center gap-2 flex-wrap">
              <span>⚔️ Conquistados</span>
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-yellow-600/70 dark:text-yellow-400/70">
              ¡Felicidades! Terminaste estos libros
            </p>
          </div>
        </div>
      </div>

      {/* Books List */}
      <div className="px-3 sm:px-5 py-3 flex flex-col gap-2 flex-1 overflow-y-auto">
        {!books || books.length === 0 ? (
          <p className="text-sm text-yellow-600/70 dark:text-yellow-400/70 py-4">
            No hay libros archivados
          </p>
        ) : (
          books.map((book) => {
            const prevPage = getPrevPage(book.sessions || []);
            return (
              <motion.button
                key={book.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => onDetail(book.id)}
                onMouseDown={() => handleBookPressStart(book.id)}
                onMouseUp={() => handleBookPressEnd(book.id)}
                onMouseLeave={() => handleBookPressEnd(book.id)}
                onTouchStart={() => handleBookPressStart(book.id)}
                onTouchEnd={() => handleBookPressEnd(book.id)}
                onTouchCancel={() => handleBookPressEnd(book.id)}
                className="w-full text-left rounded-2xl border-2 border-yellow-400/50 px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-br from-yellow-500/20 via-amber-500/10 to-yellow-500/10 hover:border-yellow-400 hover:from-yellow-500/30 hover:via-amber-500/20 active:scale-95 transition-all shadow-md hover:shadow-lg hover:shadow-yellow-500/20 touch-manipulation"
              >
                <div className="flex items-center gap-2 sm:gap-3 mb-1.5 sm:mb-2 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-xs sm:text-sm text-foreground block truncate">{book.title}</span>
                    <span className="text-xs text-muted-foreground block">{book.author}</span>
                  </div>
                  <span className="text-xs bg-yellow-500/30 text-yellow-700 dark:text-yellow-400 px-2 py-1 rounded-full font-bold flex-shrink-0 whitespace-nowrap">
                    {prevPage}/{book.totalPages}
                  </span>
                </div>
                <div className="flex gap-2 mt-2">
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      onUnarchive(book.id);
                    }}
                    className="flex-1 rounded-lg bg-green-500/20 text-green-700 dark:text-green-400 hover:bg-green-500/30 border border-green-500/50 text-xs h-8"
                  >
                    Restaurar
                  </Button>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(book.id);
                    }}
                    className="flex-1 rounded-lg bg-red-500/20 text-red-700 dark:text-red-400 hover:bg-red-500/30 border border-red-500/50 text-xs h-8"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Eliminar
                  </Button>
                </div>
              </motion.button>
            );
          })
        )}
      </div>
    </div>
  );
}

// Main Component
export function BookTracker() {
  const [currentPanel, setCurrentPanel] = useState<"main" | "add" | "detail" | "archived" | "archived-detail">("main");
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [selectedArchivedBookId, setSelectedArchivedBookId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: books = [], isLoading } = useQuery<Book[]>({
    queryKey: ["/api/books", "active"],
    queryFn: async () => {
      const res = await fetch("/api/books?archived=false");
      if (!res.ok) throw new Error("Failed to fetch books");
      const data = await res.json();

      const booksWithSessions = await Promise.all(
        data.map(async (book: Book) => {
          const sessionsRes = await fetch(`/api/books/${book.id}/sessions`);
          const sessions = await sessionsRes.json();
          return { ...book, sessions };
        })
      );
      return booksWithSessions;
    },
  });

  const { data: archivedBooks = [] } = useQuery<Book[]>({
    queryKey: ["/api/books", "archived"],
    queryFn: async () => {
      const res = await fetch("/api/books?archived=true");
      if (!res.ok) throw new Error("Failed to fetch archived books");
      const data = await res.json();

      const booksWithSessions = await Promise.all(
        data.map(async (book: Book) => {
          const sessionsRes = await fetch(`/api/books/${book.id}/sessions`);
          const sessions = await sessionsRes.json();
          return { ...book, sessions };
        })
      );
      return booksWithSessions;
    },
  });

  const createBook = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create book");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      setCurrentPanel("main");
    },
  });

  const updateBook = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/books/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update book");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      setCurrentPanel("main");
      setEditingBookId(null);
    },
  });

  const deleteBook = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/books/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete book");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
    },
  });

  const archiveBook = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/books/${id}/archive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to archive book");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      setSelectedBookId(null);
      setCurrentPanel("main");
    },
  });

  const unarchiveBook = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/books/${id}/unarchive`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to unarchive book");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      setSelectedArchivedBookId(null);
      setCurrentPanel("archived");
    },
  });

  const registerPage = useMutation({
    mutationFn: async ({ bookId, page }: { bookId: string; page: number }) => {
      const book = books.find((b) => b.id === bookId);
      if (!book) throw new Error("Book not found");

      const sessions = book.sessions || [];
      const today = todayStr();
      
      // Calculate final sessions based on complex registration logic
      const finalSessions = calculateSessionsForPage(sessions, page, today);
      
      // If no change, don't make request
      if (finalSessions === sessions) {
        return;
      }

      // Get today's sessions that will be deleted or modified
      const todaySessions = sessions.filter((s) => s.date === today);
      const finalTodaySessions = finalSessions.filter((s) => s.date === today);

      // Delete sessions that are no longer in final state
      for (const session of todaySessions) {
        if (!finalTodaySessions.find((s) => s.page === session.page)) {
          await fetch(`/api/books/${bookId}/sessions?date=${today}&page=${session.page}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
          });
        }
      }

      // Add new session
      const res = await fetch(`/api/books/${bookId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: today, page }),
      });
      if (!res.ok) throw new Error("Failed to register page");
      
      // Auto-archive if completed
      if (page === book.totalPages) {
        const archiveRes = await fetch(`/api/books/${bookId}/archive`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
        });
        if (!archiveRes.ok) console.error("Failed to auto-archive book");
      }
      
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
    },
  });

  const selectedBook = currentPanel === "detail" && selectedBookId
    ? books.find((b) => b.id === selectedBookId)
    : null;

  // Long press handler para el header
  const longPressHeader = useLongPress(() => {
    setCurrentPanel("add");
  }, 1000);

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      {currentPanel === "main" && (
        <div className="flex flex-col h-full">
          {/* Header con long press para agregar */}
          <div
            className="border-b border-border/30 px-5 py-3 cursor-pointer active:bg-muted/50 transition-colors"
            {...longPressHeader}
          >
            <h2 className="font-black text-lg text-foreground">Mis libros</h2>
          </div>

          {/* Book List */}
          <div className="flex-1 overflow-y-auto px-5 py-3 flex flex-col gap-2 scrollbar-thin scrollbar-thumb-muted-foreground/20">
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">Cargando libros...</div>
            ) : books.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No hay libros. Mantén presionado el título para crear uno.
              </div>
            ) : (
              books.map((book) => (
                <BookCardWithLongPress
                  key={book.id}
                  book={book}
                  sessions={book.sessions || []}
                  onDetail={() => {
                    setSelectedBookId(book.id);
                    setCurrentPanel("detail");
                  }}
                  onDelete={() => deleteBook.mutate(book.id)}
                  onEdit={() => {
                    setEditingBookId(book.id);
                    setCurrentPanel("add");
                  }}
                  onRegisterPage={() => {
                    const lastSession = getTodaySessions(book.sessions || []);
                    const currentMaxPage = lastSession.length > 0
                      ? Math.max(...lastSession.map((s) => s.page))
                      : getPrevPage(book.sessions || []);
                    const nextPage = Math.min(currentMaxPage + 1, book.totalPages);
                    registerPage.mutate({ bookId: book.id, page: nextPage });
                  }}
                  onArchive={() => archiveBook.mutate(book.id)}
                />
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border/30 flex items-center justify-end px-4 sm:px-6 py-3 gap-2">
            <button
              onClick={() => setCurrentPanel("archived")}
              className="inline-flex items-center justify-center rounded-full bg-purple-500/20 p-2 text-purple-700 hover:opacity-80 dark:text-purple-400 active:opacity-60 transition-colors touch-manipulation h-9 w-9"
              title="Libros archivados"
            >
              <Swords className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {currentPanel === "add" && (
        <AddPanel
          onBack={() => {
            setCurrentPanel("main");
            setEditingBookId(null);
          }}
          onSubmit={(data) => {
            if (editingBookId) {
              updateBook.mutate({ id: editingBookId, data });
            } else {
              createBook.mutate(data);
            }
          }}
          editingBook={editingBookId ? books.find((b) => b.id === editingBookId) : undefined}
        />
      )}

      {currentPanel === "detail" && selectedBook && (
        <DetailPanel
          book={selectedBook}
          sessions={selectedBook.sessions || []}
          onBack={() => {
            setCurrentPanel("main");
            setSelectedBookId(null);
          }}
          onArchive={() => archiveBook.mutate(selectedBook.id)}
        />
      )}

      {currentPanel === "archived" && (
        <ArchivedPanel
          books={archivedBooks}
          onBack={() => setCurrentPanel("main")}
          onDetail={(bookId) => {
            setSelectedArchivedBookId(bookId);
            setCurrentPanel("archived-detail");
          }}
          onUnarchive={(bookId) => unarchiveBook.mutate(bookId)}
          onDelete={(bookId) => deleteBook.mutate(bookId)}
        />
      )}

      {currentPanel === "archived-detail" && selectedArchivedBookId && (
        <DetailPanel
          book={archivedBooks.find((b) => b.id === selectedArchivedBookId)!}
          sessions={archivedBooks.find((b) => b.id === selectedArchivedBookId)?.sessions || []}
          isArchived={true}
          onBack={() => {
            setCurrentPanel("archived");
            setSelectedArchivedBookId(null);
          }}
          onUnarchive={() => unarchiveBook.mutate(selectedArchivedBookId)}
          onDelete={() => deleteBook.mutate(selectedArchivedBookId)}
        />
      )}
    </div>
  );
}
