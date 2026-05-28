import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import {
  BookOpen,
  Camera,
  Code,
  Compass,
  Dumbbell,
  Flame,
  Gamepad2,
  Heart,
  Home,
  Lightbulb,
  Music,
  Palette,
  Sparkles,
  Swords,
  Target,
  Trophy,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";

export interface ExperienceGainSnapshot {
  skillName: string;
  areaColor: string;
  xpBefore: number;
  xpAfter: number;
  xpMax: number | null;
  level: number;
}

interface ExperienceGainPopupProps {
  snapshot: ExperienceGainSnapshot | null;
  onClose: () => void;
}

const iconMap: Array<{ match: RegExp; icon: LucideIcon }> = [
  { match: /music|música|musica|guitarra|piano|song|canción|cancion/i, icon: Music },
  { match: /lectura|book|libro|reading/i, icon: BookOpen },
  { match: /fitness|dumbbell|gym|entren|fuerza/i, icon: Dumbbell },
  { match: /casa|home|house|hogar|clean|limpieza|orden/i, icon: Home },
  { match: /code|program|dev|react|git|software/i, icon: Code },
  { match: /art|dibujo|paint|color|palette/i, icon: Palette },
  { match: /camera|foto|photo|travel|viaje/i, icon: Camera },
  { match: /game|juego|gaming/i, icon: Gamepad2 },
  { match: /food|cocina|cook|utensil|aliment/i, icon: Utensils },
  { match: /mind|medit|respir|breath|focus/i, icon: Lightbulb },
  { match: /goal|meta|target|objetivo/i, icon: Target },
  { match: /sword|war|battle|lucha/i, icon: Swords },
  { match: /compass|orient|map/i, icon: Compass },
  { match: /heart|amor|salud|wellness/i, icon: Heart },
  { match: /flame|fire|fuego/i, icon: Flame },
  { match: /trophy|achievement|logro/i, icon: Trophy },
];

function resolveIcon(name: string): LucideIcon {
  return iconMap.find((entry) => entry.match.test(name))?.icon || Sparkles;
}

function getProgressColor(level: number) {
  if (level >= 4) return "#2ecc2e";
  if (level === 3) return "#24a024";
  if (level === 2) return "#1f7a1f";
  return "#1a5c1a";
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

export function ExperienceGainPopup({ snapshot, onClose }: ExperienceGainPopupProps) {
  const XP_PER_LEVEL = 100;
  const [barWidth, setBarWidth] = useState(0);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [barTransitionMs, setBarTransitionMs] = useState(1000);

  useEffect(() => {
    if (!snapshot) {
      setBarWidth(0);
      setShowLevelUp(false);
      setBarTransitionMs(1000);
      return;
    }

    const xpBefore = snapshot.xpBefore;
    const xpAfter = snapshot.xpAfter;
    const levelBefore = Math.floor(xpBefore / XP_PER_LEVEL);
    const levelAfter = Math.floor(xpAfter / XP_PER_LEVEL);
    const leveledUp = levelAfter > levelBefore;
    const xpInCurrentLevel = xpAfter % XP_PER_LEVEL;
    const progressPct = (xpInCurrentLevel / XP_PER_LEVEL) * 100;
    const progressPctBefore = ((xpBefore % XP_PER_LEVEL) / XP_PER_LEVEL) * 100;
    const cleanupTimers: number[] = [];

    setShowLevelUp(false);
    setBarTransitionMs(1000);
    setBarWidth(progressPctBefore);

    const rafId = window.requestAnimationFrame(() => {
      if (!leveledUp) {
        setBarWidth(progressPct);
        return;
      }

      setBarWidth(100);

      const firstTimer = window.setTimeout(() => {
        setBarTransitionMs(0);
        setBarWidth(0);

        const secondTimer = window.setTimeout(() => {
          setShowLevelUp(true);
        }, 0);

        const thirdTimer = window.setTimeout(() => {
          setBarTransitionMs(1000);
          setBarWidth(progressPct);
        }, 30);

        cleanupTimers.push(secondTimer, thirdTimer);
      }, 1200);

      cleanupTimers.push(firstTimer);
    });

    return () => {
      window.cancelAnimationFrame(rafId);
      cleanupTimers.forEach((timerId) => window.clearTimeout(timerId));
    };
  }, [snapshot]);

  useEffect(() => {
    if (!snapshot) return;

    const closeTimer = window.setTimeout(onClose, 7500);
    return () => window.clearTimeout(closeTimer);
  }, [snapshot, onClose]);

  if (!snapshot || typeof document === "undefined") {
    return null;
  }

  const Icon = resolveIcon(snapshot.skillName);
  const xpBefore = snapshot.xpBefore;
  const xpAfter = snapshot.xpAfter;
  const levelBefore = Math.floor(xpBefore / XP_PER_LEVEL);
  const levelAfter = Math.floor(xpAfter / XP_PER_LEVEL);
  const xpInCurrentLevel = xpAfter % XP_PER_LEVEL;
  const xpToNextLevel = XP_PER_LEVEL - xpInCurrentLevel;
  const progressPctBefore = ((xpBefore % XP_PER_LEVEL) / XP_PER_LEVEL) * 100;
  const progressPct = (xpInCurrentLevel / XP_PER_LEVEL) * 100;
  const nextLevel = levelAfter + 1;
  const leveledUp = levelAfter > levelBefore;
  const currentLevel = snapshot.level;
  const progressColor = getProgressColor(currentLevel);

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="experience-gain-popup"
        className="fixed inset-0 z-[260]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <button
          type="button"
          aria-label="Cerrar popup de experiencia"
          className="absolute inset-0 cursor-default bg-transparent"
          onClick={onClose}
        />

        <div
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translateX(-50%) translateY(-50%)",
            zIndex: 9999,
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="w-[min(92vw,356px)] rounded-[4px] border px-[16px] py-[14px] shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
            style={{
              backgroundColor: "#0e0c0a",
              borderColor: "#3a2a14",
            }}
          >
            <div className="flex items-center gap-2">
              <div className="relative flex h-8 w-8 shrink-0 items-center justify-center">
                <svg viewBox="0 0 32 32" className="absolute inset-0 h-full w-full">
                  <polygon
                    points="16,2 30,16 16,30 2,16"
                    fill="#15110b"
                    stroke={snapshot.areaColor}
                    strokeWidth="1.5"
                  />
                </svg>
                <Icon className="relative h-4 w-4" style={{ color: snapshot.areaColor }} strokeWidth={2.1} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-[#c8a96e]">{snapshot.skillName}</div>
              </div>

              <div
                className="shrink-0 rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#c8a96e]"
                style={{ borderColor: "#3a2a14", backgroundColor: "#15110b" }}
              >
                Lv {currentLevel}
              </div>
            </div>

            <div className="mt-3 text-center text-[13px] font-medium text-[#c8a96e]">
              {xpBefore} → {xpAfter} XP
            </div>

            <div className="mt-3">
              <div className="h-1 w-full overflow-hidden rounded-sm bg-[#1e180e]">
                <motion.div
                  initial={false}
                  animate={{ width: `${barWidth}%` }}
                  transition={barTransitionMs > 0 ? { duration: barTransitionMs / 1000, ease: [0.4, 0, 0.2, 1] } : { duration: 0 }}
                  className="h-full rounded-sm"
                  style={{ backgroundColor: progressColor }}
                />
              </div>

              <div className="mt-1 flex items-center justify-between text-[9px] text-[#5a4a2a]">
                <span>
                  {xpInCurrentLevel} / {XP_PER_LEVEL}
                </span>
                <span>{`Lv${nextLevel}`}</span>
              </div>

              <AnimatePresence>
                {showLevelUp && leveledUp && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mt-2 inline-flex rounded-[3px] border px-[10px] py-[4px] text-[11px] font-medium text-[#c8a96e]"
                    style={{
                      backgroundColor: "#1a1208",
                      borderColor: "#c8a96e",
                      borderWidth: "0.5px",
                    }}
                  >
                    ¡Nivel {levelAfter} alcanzado!
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}