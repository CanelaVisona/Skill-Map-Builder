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

// Format date for timeline: dd/mm (or dd/mm/yy if year differs from current)
function formatDateWithMonth(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  const currentYear = new Date().getFullYear().toString();
  const isCurrentYear = y === currentYear;
  return isCurrentYear ? `${d}/${m}` : `${d}/${m}/${y.slice(2)}`;
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

// Get the current display page for progress indicator: today's max OR previous max
function getCurrentDisplayPage(sessions: BookSession[]): number {
  const todayPages = getTodaySessions(sessions).map((s) => s.page);
  if (todayPages.length > 0) {
    return Math.max(...todayPages);
  }
  return getPrevPage(sessions);
}

// Complex registration logic: calculates which sessions to save based on rules
// Returns { sessions: newSessions, didChange: boolean, registerPageNumber: number }
function calculateSessionsForPage(
  currentSessions: BookSession[],
  newPage: number,
  today: string
): { sessions: BookSession[]; didChange: boolean } {
  if (newPage <= 0) {
    return { sessions: currentSessions, didChange: false };
  }

  const todaySessionPages = currentSessions
    .filter((s) => s.date === today)
    .map((s) => s.page)
    .sort((a, b) => a - b);

  // Rule 1: Ignore if same number already exists today
  if (todaySessionPages.includes(newPage)) {
    return { sessions: currentSessions, didChange: false };
  }

  // First registration of the day
  if (todaySessionPages.length === 0) {
    return {
      sessions: [
        ...currentSessions,
        { id: "", date: today, page: newPage } as BookSession,
      ],
      didChange: true,
    };
  }

  const minPage = todaySessionPages[0];
  const maxPage = todaySessionPages[todaySessionPages.length - 1];

  // Rule 2: Smaller than all - delete all today sessions, save only new
  if (newPage < minPage) {
    return {
      sessions: [
        ...currentSessions.filter((s) => s.date !== today),
        { id: "", date: today, page: newPage } as BookSession,
      ],
      didChange: true,
    };
  }

  // Rule 3: Between min and max - delete all sessions greater than new, and save new
  if (newPage < maxPage) {
    return {
      sessions: [
        ...currentSessions.filter(
          (s) => !(s.date === today && s.page > newPage)
        ),
        { id: "", date: today, page: newPage } as BookSession,
      ],
      didChange: true,
    };
  }

  // Rule 4: Greater than max - add as new registration
  return {
    sessions: [
      ...currentSessions,
      { id: "", date: today, page: newPage } as BookSession,
    ],
    didChange: true,
  };
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
function SVGTrack({ book, sessions, onDragStart, onPreviewPage }: { book: Book; sessions: BookSession[]; onDragStart?: () => void; onPreviewPage?: (page: number) => void }) {
  const today = todayStr();
  const todayColor = getColorForDate(sessions, today);
  const prevPage = getPrevPage(sessions);
  const outer = useRef<HTMLDivElement>(null);
  const circleRef = useRef<SVGCircleElement | null>(null); // Store reference to the circle
  
  // Refs for values that change (avoid dependency changes)
  const onPreviewPageRef = useRef(onPreviewPage);
  const totalPagesRef = useRef(book.totalPages);
  
  // Update refs when props change (without triggering useEffect)
  useEffect(() => { onPreviewPageRef.current = onPreviewPage; }, [onPreviewPage]);
  useEffect(() => { totalPagesRef.current = book.totalPages; }, [book.totalPages]);

  const [isDragging, setIsDragging] = useState(false);
  const todayPages = getTodaySessions(sessions).map((s) => s.page).sort((a, b) => a - b);
  const lastRegisteredToday = todayPages.length > 0 ? todayPages[todayPages.length - 1] : null;
  
  // currentPage is the PREVIEW (where cursor is during drag), starts at lastRegisteredToday or prevPage
  const [currentPage, setCurrentPage] = useState(
    lastRegisteredToday !== null ? lastRegisteredToday : prevPage
  );
  
  // Update currentPage initial value when sessions change
  useEffect(() => {
    const todayPages = getTodaySessions(sessions).map((s) => s.page).sort((a, b) => a - b);
    const lastRegistered = todayPages.length > 0 ? todayPages[todayPages.length - 1] : null;
    setCurrentPage(lastRegistered !== null ? lastRegistered : getPrevPage(sessions));
  }, [sessions]);

  // CRITICAL: Unified Pointer Events for mouse, touch, and Windows touchscreen
  // Pointer events are registered ONLY on the circle, not the entire SVG container
  // setPointerCapture ensures drag continues even if pointer moves outside circle
  // Re-registers whenever circle reference updates (when SVG re-renders)
  useEffect(() => {
    const container = outer.current;
    const circle = circleRef.current;
    
    if (!container || !circle) {
      console.log('[SVGTrack] Circle not yet available for Pointer Events');
      return;
    }

    console.log('[SVGTrack] Registering Pointer Events only on circle');
    
    let startX = 0;
    let startY = 0;
    let dragging = false;
    let pointerId: number | null = null;
    const DRAG_THRESHOLD = 8;
    const PAD = 0;

    const onPointerDown = (e: PointerEvent) => {
      console.log('[SVGTrack] Pointer down on circle');
      e.stopPropagation(); // Don't activate card click
      circle.setPointerCapture(e.pointerId); // Capture events even outside circle
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      dragging = false;
      setIsDragging(true);
      onDragStart?.();
    };

    const onPointerMove = (e: PointerEvent) => {
      // Only process events from the pointer we're tracking
      if (pointerId === null || e.pointerId !== pointerId) return;

      const dx = Math.abs(e.clientX - startX);
      const dy = Math.abs(e.clientY - startY);
      
      // Don't start dragging until threshold exceeded
      if (!dragging && dx < DRAG_THRESHOLD && dy < DRAG_THRESHOLD) return;
      
      if (!dragging) {
        dragging = true;
        console.log('[SVGTrack] Pointer drag started from circle');
      }

      // Prevent default behavior (scrolling, selection, etc.)
      try {
        e.preventDefault();
      } catch (err) {
        console.warn('[SVGTrack] preventDefault error:', err);
      }

      const rect = container.getBoundingClientRect();
      const trackW = rect.width - PAD * 2;
      const relX = e.clientX - rect.left - PAD;
      const ratio = Math.max(0, Math.min(1, relX / trackW));
      const rawValue = ratio * totalPagesRef.current;
      const previewPage = Math.max(0, Math.min(rawValue, totalPagesRef.current));
      
      console.log('[SVGTrack] Pointer drag: ratio:', ratio, 'previewPage:', previewPage);
      setCurrentPage(previewPage);
      onPreviewPageRef.current?.(previewPage);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (pointerId === null || e.pointerId !== pointerId) return;
      console.log('[SVGTrack] Pointer up');
      dragging = false;
      pointerId = null;
      setIsDragging(false);
    };

    const onPointerCancel = (e: PointerEvent) => {
      if (pointerId === null || e.pointerId !== pointerId) return;
      console.log('[SVGTrack] Pointer cancel');
      dragging = false;
      pointerId = null;
      setIsDragging(false);
    };

    // Register Pointer Events ONLY on the circle
    circle.addEventListener('pointerdown', onPointerDown);
    circle.addEventListener('pointermove', onPointerMove);
    circle.addEventListener('pointerup', onPointerUp);
    circle.addEventListener('pointercancel', onPointerCancel);

    return () => {
      console.log('[SVGTrack] Removing Pointer Event listeners from circle');
      circle.removeEventListener('pointerdown', onPointerDown);
      circle.removeEventListener('pointermove', onPointerMove);
      circle.removeEventListener('pointerup', onPointerUp);
      circle.removeEventListener('pointercancel', onPointerCancel);
    };
  }, [circleRef]); // Re-register when circle reference updates

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

    // Small markers for past days' maximums
    pastDates.forEach((date) => {
      const maxPage = Math.max(
        ...sessions.filter((s) => s.date === date).map((s) => s.page)
      );
      const col = getColorForDate(sessions, date);
      const marker = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      marker.setAttribute("cx", String(px(maxPage)));
      marker.setAttribute("cy", String(TY));
      marker.setAttribute("r", "4");
      marker.setAttribute("fill", col);
      marker.setAttribute("stroke", "var(--color-background)");
      marker.setAttribute("stroke-width", "1.5");
      svg.appendChild(marker);
    });

    // Today's markers for ALL sessions (including final/last registered)
    todayPages.forEach((page) => {
      const mark = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      mark.setAttribute("cx", String(px(page)));
      mark.setAttribute("cy", String(TY));
      mark.setAttribute("r", "5");
      mark.setAttribute("fill", todayColor);
      mark.setAttribute("stroke", "var(--color-background)");
      mark.setAttribute("stroke-width", "1.5");
      svg.appendChild(mark);
    });

    // Main thumb circle (responsive, min 16px radius)
    const maxReg = currentPage;
    const circleRadius = Math.max(16, W > 414 ? 10 : 16);
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("id", "svg-track-circle"); // ID for pointer event capture
    circle.setAttribute("cx", String(px(maxReg)));
    circle.setAttribute("cy", String(TY));
    circle.setAttribute("r", String(circleRadius));
    circle.setAttribute("fill", todayColor);
    circle.setAttribute("stroke", "var(--color-background)");
    circle.setAttribute("stroke-width", "2");
    svg.appendChild(circle);
    
    // Store circle reference for Pointer Events
    circleRef.current = circle as any as SVGCircleElement;

    // Number above the circle (always rounded for display)
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", String(px(maxReg)));
    text.setAttribute("y", String(TY - 18));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("font-size", "12");
    text.setAttribute("font-weight", "500");
    text.setAttribute("fill", todayColor);
    text.textContent = String(Math.round(currentPage));
    svg.appendChild(text);

    // Clean old SVG
    outer.current.querySelectorAll("svg").forEach((s) => s.remove());
    outer.current.appendChild(svg);
  }, [book, sessions, currentPage]);

  return (
    <div
      ref={outer}
      data-slider="true"
      touch-action="none"
      onClick={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      style={{
        position: "relative",
        height: "80px",
        marginBottom: "0px",
        cursor: isDragging ? "grabbing" : "grab",
        touchAction: "none",
      }}
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
  onArchive,
  onRegisterPage,
}: {
  book: Book;
  sessions: BookSession[];
  onDetail: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onRegisterPage: (bookId: string, page: number) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [previewPage, setPreviewPage] = useState<number>(0);
  // Use both ref (for data persistence across re-renders) and state (for causing re-renders)
  const justRegisteredRef = useRef(false);
  const [justRegisteredCounter, setJustRegisteredCounter] = useState(0);
  const { streak, daysDisplay } = computeStreak(book);
  const currentPage = getCurrentDisplayPage(sessions);
  
  // Touch refs for native listener handling
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const hasMoveDetected = useRef(false);
  // Track last registered page to reset button state when user moves circle
  const lastRegisteredPage = useRef<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  
  // Derive justRegistered from ref (survives re-renders from invalidateQueries)
  const justRegistered = justRegisteredRef.current;

  const handleClick = () => {
    if (!showMenu) {
      onDetail();
    }
  };

  const handleRegister = () => {
    console.log('[BookCard] handleRegister called, previewPage:', previewPage);
    if (previewPage > 0) {
      const pageToRegister = Math.round(previewPage);
      console.log('[BookCard] Registering page:', pageToRegister, 'for book:', book.title);
      
      // FIRST: Set visual state immediately (before server call)
      lastRegisteredPage.current = pageToRegister;
      justRegisteredRef.current = true;
      setJustRegisteredCounter(c => c + 1);
      console.log('[BookCard] Set justRegisteredRef.current = true');
      
      // THEN: Call server (which may trigger invalidateQueries and re-renders)
      onRegisterPage(book.id, pageToRegister);
      setPreviewPage(0);
    } else {
      console.log('[BookCard] previewPage is 0, not registering');
    }
  };

  // Reset button state when user moves circle away from last registered position
  useEffect(() => {
    if (justRegistered && lastRegisteredPage.current !== null) {
      if (Math.round(previewPage) !== lastRegisteredPage.current) {
        console.log('[BookCard] User moved circle, resetting justRegistered from', lastRegisteredPage.current, 'to', Math.round(previewPage));
        justRegisteredRef.current = false;
        setJustRegisteredCounter(c => c + 1); // Force re-render
      }
    }
  }, [previewPage, justRegisteredCounter]); // Use counter as dep instead of justRegistered

  // Exclusive touch-based long press using native listeners ONLY
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    console.log('[BookCard] Registering native touch listeners for long press');

    const onCardTouchStart = (e: TouchEvent) => {
      console.log('[BookCard] Native touch start');
      // Don't trigger long press if touch starts on slider
      if ((e.target as HTMLElement).closest('[data-slider]')) {
        console.log('[BookCard] Touch on slider, ignoring long press');
        return;
      }

      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      hasMoveDetected.current = false;

      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      hasMoveDetected.current = false;

      const timerId = setTimeout(() => {
        if (!hasMoveDetected.current) {
          console.log('[BookCard] Long press detected');
          setShowMenu(true);
          navigator.vibrate?.(50);
        }
      }, 500);
      
      // Store timeout id in refs for cleanup
      const currentRefs = (cardRef as any).current as any;
      if (currentRefs) currentRefs._longPressTimer = timerId;
    };

    const onCardTouchMove = (e: TouchEvent) => {
      const dx = Math.abs(e.touches[0].clientX - touchStartX.current);
      const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
      
      if (dx > 8 || dy > 8) {
        console.log('[BookCard] Touch move detected, cancelling long press');
        hasMoveDetected.current = true;
        const currentRefs = (cardRef as any).current as any;
        if (currentRefs && currentRefs._longPressTimer) {
          clearTimeout(currentRefs._longPressTimer);
          currentRefs._longPressTimer = null;
        }
      }
    };

    const onCardTouchEnd = () => {
      console.log('[BookCard] Native touch end');
      const currentRefs = (cardRef as any).current as any;
      if (currentRefs && currentRefs._longPressTimer) {
        clearTimeout(currentRefs._longPressTimer);
        currentRefs._longPressTimer = null;
      }
    };

    // Register native listeners ONLY
    card.addEventListener('touchstart' as any, onCardTouchStart, { passive: true });
    card.addEventListener('touchmove' as any, onCardTouchMove, { passive: true });
    card.addEventListener('touchend' as any, onCardTouchEnd, { passive: true });

    return () => {
      console.log('[BookCard] Removing native touch listeners');
      card.removeEventListener('touchstart' as any, onCardTouchStart);
      card.removeEventListener('touchmove' as any, onCardTouchMove);
      card.removeEventListener('touchend' as any, onCardTouchEnd);
    };
  }, []); // Empty dependencies - register ONCE

  // Cleanup on unmount is handled by the native listeners useEffect above

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

  // Debug log on every render
  if (justRegistered || previewPage > 0) {
    console.log('[BookCard] RENDER: justRegistered:', justRegistered, 'previewPage:', previewPage, 'disabled:', previewPage === 0);
  }

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border ${borderColor} ${bgColor} px-3 py-2.5 mb-2 cursor-pointer ${hoverBorder} transition-all ${activeBg}`}
      onClick={handleClick}
    >
      {/* Header con título */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <span className="font-bold text-sm text-foreground block truncate">{book.title}</span>
          <span className="text-xs text-muted-foreground block">{book.author}</span>
        </div>
        <span className="text-xs bg-green-500/30 text-green-700 dark:text-green-400 px-2 py-1 rounded-full font-bold flex-shrink-0 whitespace-nowrap">
          {currentPage}/{book.totalPages}
        </span>
      </div>

      {/* SVG Track - NO React touch handlers! Use native listeners only */}
      <div 
        className="mb-3" 
        data-slider="true" 
        style={{ position: "relative", touchAction: "none" }}
      >
            <SVGTrack 
              book={book} 
              sessions={sessions} 
              onDragStart={() => setShowMenu(false)}
              onPreviewPage={setPreviewPage}
            />
      </div>

      {/* Register Button */}
      <div className="mb-3">
        <Button
          onClick={(e) => {
            e.stopPropagation();
            handleRegister();
          }}
          disabled={previewPage === 0}
          style={{
            background: justRegistered ? '#3B6D11' : undefined,
            color: justRegistered ? 'white' : undefined,
          }}
          className="w-full rounded-xl bg-green-500/20 text-green-700 dark:text-green-400 hover:bg-green-500/30 border border-green-500/50 text-xs h-10 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {justRegistered ? 'Registrado ✓' : `Registrar ${previewPage > 0 ? `${Math.round(previewPage)}/${book.totalPages}` : ''}`}
        </Button>
      </div>

      <div className="text-xs font-medium text-foreground mb-2">
        {streak} día{streak !== 1 ? "s" : ""} 🔥
      </div>

      {/* Racha de lectura */}
      <div className="flex gap-1 mb-2 flex-wrap">
        {daysDisplay.map((day, idx) =>
          day.read ? (
            <div
              key={idx}
              className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-[14px]"
            >
              🔥
            </div>
          ) : day.isNext ? (
            <div
              key={idx}
              className="w-5 h-5 rounded-full border-2 border-dashed border-green-600 flex items-center justify-center text-[10px]"
            >
              <span className="text-green-600">+1</span>
            </div>
          ) : null
        )}
      </div>

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
      ) : null}
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
  const todayPages = todaySessions.length > 0 
    ? todaySessions
        .map((s) => s.page)
        .sort((a, b) => a - b)
        .join(" · ")
    : null;
  
  // Count unique dates with sessions
  const uniqueReadDates = getUniqueDates(sessions).length;
  
  // Get max page ever read (for progress metric)
  const maxPageEver = sessions.length > 0 ? Math.max(...sessions.map((s) => s.page)) : 0;
  
  // Remove duplicate sessions (keep only highest page per date) - for reference only
  // But display ALL sessions in the list
  const sessionsNoDups: BookSession[] = [];
  const dateMap = new Map<string, BookSession>();
  sessions.forEach((s) => {
    const existing = dateMap.get(s.date);
    if (!existing || s.page > existing.page) {
      dateMap.set(s.date, s);
    }
  });
  dateMap.forEach((v) => sessionsNoDups.push(v));
  
  // For display, show ALL sessions (including multiple per day)
  const sortedSessions = sessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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

      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/10 px-4 py-4 space-y-4">
        {/* Hoy Banner */}
        <div className="border border-yellow-500/40 bg-yellow-500/10 rounded-lg px-2.5 py-1.5 text-center">
          <div className="text-lg mb-0.5">🔥</div>
          <p className="text-xs font-black text-yellow-500/90 mb-0.5">Hoy</p>
          {todayPages !== null ? (
            <p className="text-xs text-yellow-500/80">¡Estás en {book.mode === "chapters" ? "los capítulos" : "las páginas"} {todayPages}!</p>
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
                    <p className="text-xs text-muted-foreground mt-1">{formatDateWithMonth(day.date)}</p>
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

      <div className="flex-1 overflow-y-auto p-5 space-y-3 scrollbar-thin scrollbar-thumb-muted-foreground/10">
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
  const [showButtonsForBook, setShowButtonsForBook] = useState<Record<string, boolean>>({});
  const panelRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<Record<string, number>>({});
  const touchStartY = useRef<Record<string, number>>({});
  const hasMoveDetected = useRef<Record<string, boolean>>({});

  // Register native touch listeners for archived book items - ONCE on mount
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    console.log('[ArchivedPanel] Registering native touch listeners');

    // Find all archived book buttons and register listeners
    const bookButtons = panel.querySelectorAll('[data-book-id]') as NodeListOf<Element>;
    const listeners: Map<Element, { touchstart: (e: TouchEvent) => void; touchmove: (e: TouchEvent) => void; touchend: (e: TouchEvent) => void }> = new Map();

    bookButtons.forEach((button) => {
      const bookId = (button as HTMLElement).getAttribute('data-book-id');
      if (!bookId) return;

      const handleBookTouchStart = (e: TouchEvent) => {
        console.log('[ArchivedPanel] Native touch start on book:', bookId);
        touchStartX.current[bookId] = e.touches[0].clientX;
        touchStartY.current[bookId] = e.touches[0].clientY;
        hasMoveDetected.current[bookId] = false;

        const timerId = setTimeout(() => {
          if (!hasMoveDetected.current[bookId]) {
            console.log('[ArchivedPanel] Long press detected on book:', bookId);
            setShowButtonsForBook(prev => ({ ...prev, [bookId]: true }));
            navigator.vibrate?.(50);
          }
        }, 500);
        
        // Store timeout id for cleanup
        (button as any)._longPressTimer = timerId;
      };

      const handleBookTouchMove = (e: TouchEvent) => {
        const dx = Math.abs(e.touches[0].clientX - (touchStartX.current[bookId] || 0));
        const dy = Math.abs(e.touches[0].clientY - (touchStartY.current[bookId] || 0));
        
        if (dx > 8 || dy > 8) {
          console.log('[ArchivedPanel] Touch move detected on book:', bookId);
          hasMoveDetected.current[bookId] = true;
          if ((button as any)._longPressTimer) {
            clearTimeout((button as any)._longPressTimer);
            (button as any)._longPressTimer = null;
          }
        }
      };

      const handleBookTouchEnd = () => {
        console.log('[ArchivedPanel] Native touch end on book:', bookId);
        if ((button as any)._longPressTimer) {
          clearTimeout((button as any)._longPressTimer);
          (button as any)._longPressTimer = null;
        }
      };

      button.addEventListener('touchstart' as any, handleBookTouchStart, { passive: true });
      button.addEventListener('touchmove' as any, handleBookTouchMove, { passive: true });
      button.addEventListener('touchend' as any, handleBookTouchEnd, { passive: true });

      listeners.set(button, { touchstart: handleBookTouchStart, touchmove: handleBookTouchMove, touchend: handleBookTouchEnd });
    });

    return () => {
      console.log('[ArchivedPanel] Removing native touch listeners');
      listeners.forEach((handlers, button) => {
        button.removeEventListener('touchstart' as any, handlers.touchstart);
        button.removeEventListener('touchmove' as any, handlers.touchmove);
        button.removeEventListener('touchend' as any, handlers.touchend);
      });
    };
  }, []); // Empty dependencies - register ONCE

  const handleBookClick = (bookId: string) => {
    if (!showButtonsForBook[bookId]) {
      onDetail(bookId);
    }
  };

  return (
    <div ref={panelRef} className="w-full flex flex-col h-full">
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
              <Swords className="h-5 w-5 text-green-700 dark:text-green-400" />
              <span>Experiencias</span>
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-yellow-600/70 dark:text-yellow-400/70">
              Viviste estos libros
            </p>
          </div>
        </div>
      </div>

      {/* Books List */}
      <div className="px-3 sm:px-5 py-3 flex flex-col gap-2 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/10">
        {!books || books.length === 0 ? (
          <p className="text-sm text-yellow-600/70 dark:text-yellow-400/70 py-4">
            No hay libros archivados
          </p>
        ) : (
          books.map((book) => {
            const prevPage = getPrevPage(book.sessions || []);
            const showButtons = showButtonsForBook[book.id] || false;
            return (
              <motion.button
                key={book.id}
                data-book-id={book.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => handleBookClick(book.id)}
                className="w-full text-left rounded-2xl border-2 border-yellow-400/50 px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-br from-yellow-500/20 via-amber-500/10 to-yellow-500/10 hover:border-yellow-400 hover:from-yellow-500/30 hover:via-amber-500/20 active:scale-95 transition-all shadow-md hover:shadow-lg hover:shadow-yellow-500/20 touch-manipulation"
              >
                <div className="flex items-center gap-2 sm:gap-3 mb-1.5 sm:mb-2 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-xs sm:text-sm text-foreground block truncate">{book.title}</span>
                    <span className="text-xs text-muted-foreground block">{book.author}</span>
                  </div>
                  <span className="text-xs bg-yellow-500/30 text-yellow-700 dark:text-yellow-400 px-2 py-1 rounded-full font-bold flex-shrink-0 whitespace-nowrap">
                    {getCurrentDisplayPage(book.sessions || [])}/{book.totalPages}
                  </span>
                </div>
                {showButtons && (
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
                )}
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
      
      // Ensure page is a valid number
      const validatedPage = Math.round(Number(page));
      if (validatedPage <= 0 || isNaN(validatedPage)) throw new Error("Invalid page number");
      
      console.log("[registerPage] Starting registration", { bookId, page, validatedPage });

      const sessions = book.sessions || [];
      const today = todayStr();
      
      console.log("[registerPage] Today:", today, "Current sessions:", sessions);
      
      // Calculate final sessions based on complex registration logic
      const { sessions: finalSessions, didChange } = calculateSessionsForPage(sessions, validatedPage, today);
      
      // If no change, don't make request
      if (!didChange) {
        console.log("[registerPage] No change detected, skipping POST");
        return { page: validatedPage, noChange: true };
      }

      // Get today's sessions that will be deleted
      const todaySessions = sessions.filter((s) => s.date === today);
      const finalTodaySessions = finalSessions.filter((s) => s.date === today);

      console.log("[registerPage] Sessions to delete:", todaySessions.filter(s => !finalTodaySessions.find(fs => fs.page === s.page)));
      
      // Delete sessions that are no longer in final state
      for (const session of todaySessions) {
        if (!finalTodaySessions.find((s) => s.page === session.page)) {
          console.log("[registerPage] Deleting session:", session.id);
          await fetch(`/api/books/${bookId}/sessions/${session.id}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
          }).catch((e) => console.error("Failed to delete session:", e));
        }
      }

      // Add new session
      const payload = { date: today, page: validatedPage };
      console.log("[registerPage] Posting to /api/books/:id/sessions");
      console.log("[registerPage] Payload:", JSON.stringify(payload));
      console.log("[registerPage] Date type:", typeof payload.date, "Page type:", typeof payload.page);
      
      const res = await fetch(`/api/books/${bookId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      const responseText = await res.text();
      console.log("[registerPage] Response status:", res.status);
      console.log("[registerPage] Response body:", responseText);
      
      if (!res.ok) {
        try {
          const errorData = JSON.parse(responseText);
          console.error("[registerPage] Error response:", errorData);
        } catch {
          console.error("[registerPage] Error (not JSON):", responseText);
        }
        throw new Error("Failed to register page");
      }
      
      // Auto-archive if completed
      if (validatedPage === book.totalPages) {
        console.log("[registerPage] Auto-archiving book");
        const archiveRes = await fetch(`/api/books/${bookId}/archive`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
        });
        if (!archiveRes.ok) console.error("Failed to auto-archive book");
      }
      
      return JSON.parse(responseText);
    },
    onSuccess: () => {
      console.log("[registerPage] Mutation successful, invalidating queries");
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
    },
  });

  const selectedBook = currentPanel === "detail" && selectedBookId
    ? books.find((b) => b.id === selectedBookId)
    : null;

  // Refs for header native long press
  const headerRef = useRef<HTMLDivElement>(null);
  const headerLongPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const headerTouchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Register native long press on header
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    console.log('[BookTracker] Registering native header long press');

    const handleHeaderTouchStart = (e: TouchEvent) => {
      console.log('[BookTracker] Header native touch start');
      const touch = e.touches[0];
      headerTouchStartRef.current = { x: touch.clientX, y: touch.clientY };
      
      headerLongPressTimerRef.current = setTimeout(() => {
        console.log('[BookTracker] Header long press detected');
        setCurrentPanel("add");
      }, 1000);
    };

    const handleHeaderTouchMove = (e: TouchEvent) => {
      if (!headerTouchStartRef.current) return;
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - headerTouchStartRef.current.x);
      const dy = Math.abs(touch.clientY - headerTouchStartRef.current.y);
      
      if (dx > 10 || dy > 10) {
        console.log('[BookTracker] Header touch move, cancelling long press');
        if (headerLongPressTimerRef.current) {
          clearTimeout(headerLongPressTimerRef.current);
          headerLongPressTimerRef.current = null;
        }
      }
    };

    const handleHeaderTouchEnd = () => {
      console.log('[BookTracker] Header native touch end');
      headerTouchStartRef.current = null;
      if (headerLongPressTimerRef.current) {
        clearTimeout(headerLongPressTimerRef.current);
        headerLongPressTimerRef.current = null;
      }
    };

    header.addEventListener('touchstart' as any, handleHeaderTouchStart, { passive: true });
    header.addEventListener('touchmove' as any, handleHeaderTouchMove, { passive: true });
    header.addEventListener('touchend' as any, handleHeaderTouchEnd, { passive: true });

    return () => {
      console.log('[BookTracker] Removing native header long press');
      header.removeEventListener('touchstart' as any, handleHeaderTouchStart);
      header.removeEventListener('touchmove' as any, handleHeaderTouchMove);
      header.removeEventListener('touchend' as any, handleHeaderTouchEnd);
    };
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (headerLongPressTimerRef.current) {
        clearTimeout(headerLongPressTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      {currentPanel === "main" && (
        <div className="flex flex-col h-full">
          {/* Header con long press para agregar */}
          <div
            ref={headerRef}
            className="border-b border-border/30 px-5 py-3 cursor-pointer active:bg-muted/50 transition-colors"
          >
            <h2 className="font-black text-lg text-foreground">Mis libros</h2>
          </div>

          {/* Book List */}
          <div 
            className="flex-1 overflow-y-auto px-5 py-3 flex flex-col gap-2 scrollbar-thin scrollbar-thumb-muted-foreground/10"
            style={{
              maxHeight: 'calc(100vh - 200px)',
              overflowY: 'auto',
              scrollBehavior: 'smooth',
              WebkitOverflowScrolling: 'touch',
            }}
          >
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
                  onArchive={() => archiveBook.mutate(book.id)}
                  onRegisterPage={(bookId, page) => registerPage.mutate({ bookId, page })}
                />
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border/30 flex items-center justify-end px-4 sm:px-6 py-3 gap-2">
            <button
              onClick={() => setCurrentPanel("archived")}
              className="inline-flex items-center justify-center rounded-full bg-green-500/20 p-2 text-green-700 hover:opacity-80 dark:text-green-400 active:opacity-60 transition-colors touch-manipulation h-9 w-9"
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
