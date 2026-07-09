import React, { useState } from "react";

export interface LevelNavItem {
  id: string;
  title: string;
}

interface LevelNavigationPanelProps {
  levels: LevelNavItem[];
  activeLevelId?: string | null;
  onSelect: (levelId: string) => void;
  title?: string;
  side?: "left" | "right";
  widthPx?: number;
  className?: string;
}

export function LevelNavigationPanel({
  levels,
  activeLevelId,
  onSelect,
  title = "NIVELES",
  side = "right",
  widthPx = 300,
  className,
}: LevelNavigationPanelProps) {
  const [isRailHovered, setIsRailHovered] = useState(false);
  const isLeft = side === "left";
  const sideClass = isLeft ? "left-3" : "right-3";
  const lineOffsetClass = isLeft ? "left-0" : "right-0";
  const labelOffsetClass = isLeft ? "left-6" : "right-6";
  const expandedWidth = Math.max(200, Math.min(widthPx, 320));

  if (levels.length === 0) return null;

  return (
    <aside
      aria-label={title}
      className={[
        "fixed z-40 hidden lg:flex",
        sideClass,
        "top-1/2 -translate-y-1/2",
        className || "",
      ].join(" ")}
      onMouseEnter={() => setIsRailHovered(true)}
      onMouseLeave={() => setIsRailHovered(false)}
    >
      <div
        className="overflow-hidden transition-[width] duration-200 ease-out"
        style={{ width: isRailHovered ? `${expandedWidth}px` : "20px" }}
      >
        <nav className="max-h-[62vh] overflow-y-auto overflow-x-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <ul className="flex flex-col gap-1 py-1">
          {levels.map((level) => {
            const isActive = level.id === activeLevelId;
            const showLabel = isRailHovered;

            return (
              <li key={level.id} className="relative">
                <button
                  type="button"
                  onClick={() => onSelect(level.id)}
                  className="group relative block h-2 w-full cursor-pointer"
                  aria-label={level.title}
                  title={level.title}
                >
                  <span
                    className={[
                      `absolute ${lineOffsetClass} top-1/2 h-px -translate-y-1/2 rounded-full transition-all duration-200`,
                      isActive ? "w-4 bg-zinc-100" : "w-3 bg-zinc-300/85 group-hover:w-4 group-hover:bg-zinc-100",
                    ].join(" ")}
                  />
                </button>

                <div
                  className={[
                    "pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-md px-2 py-1",
                    "max-w-[220px] truncate whitespace-nowrap text-[11px]",
                    "bg-zinc-800/95 text-zinc-100 shadow-[0_8px_22px_rgba(0,0,0,0.35)]",
                    "transition-all duration-150",
                    labelOffsetClass,
                    showLabel ? "opacity-100 translate-x-0" : "opacity-0 translate-x-1",
                  ].join(" ")}
                >
                  {level.title}
                </div>
              </li>
            );
          })}
          </ul>
        </nav>
      </div>
    </aside>
  );
}

export default LevelNavigationPanel;
