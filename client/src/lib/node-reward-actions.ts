import { useSkillTree } from "@/lib/skill-context";
import { useXpPopup } from "@/lib/xp-popup-context";
import { useBodyGainPopup } from "@/lib/body-gain-popup-context";
import { useBodyProgress, type BodyZone, type BodyDimension } from "@/lib/body-progress-context";
import { useErrorProgressPopup } from "@/lib/error-progress-popup-context";
import { useErrorCelebration } from "@/lib/error-celebration-context";
import { runPopupQueueAsync, getPopupBusyDelay } from "@/lib/popup-coordinator";
import { type ExperienceGainSnapshot } from "@/components/ExperienceGainPopup";
import { queryClient } from "@/lib/queryClient";

// Lógica de recompensas compartida entre SkillNode.tsx (árbol) y el modal de feedback post-
// confirmación (node-confirm-feedback-context.tsx), que también se abre al confirmar un nodo
// desde "Tareas de hoy", donde no hay ningún SkillNode montado.

export const FIXED_XP_AMOUNT = 10;

type ShowPopup = (fn: () => void) => void;
const showNow: ShowPopup = (fn) => fn();

// Suma FIXED_XP_AMOUNT a un skill (legacy en localStorage, o GlobalSkill vía API con cascada al
// padre) y muestra su pop-up de XP. `showPopup` deja que el llamador encole el pop-up junto a
// otros de la misma tanda; si se omite, se muestra de inmediato.
export function useApplyExperienceGain() {
  const { globalSkills, addXpToGlobalSkill } = useSkillTree();
  const { showXpPopup } = useXpPopup();
  const { hideBodyGainPopup } = useBodyGainPopup();

  return async (skillId: string, areaColor: string, showPopup: ShowPopup = showNow) => {
    const xpToAdd = FIXED_XP_AMOUNT;

    const buildSnapshot = (skillName: string, xpBefore: number, level: number, xpMax: number | null): ExperienceGainSnapshot => ({
      skillName,
      areaColor,
      xpBefore,
      xpAfter: xpBefore + xpToAdd,
      xpMax,
      level,
      celebrateLevelUp: true,
    });

    if (skillId.startsWith("legacy:")) {
      const legacySkillName = skillId.replace("legacy:", "");
      let skills: Record<string, { name: string; currentXp: number; level: number }> = {};
      const skillsProgress = localStorage.getItem("skillsProgress");
      if (skillsProgress) {
        try {
          skills = JSON.parse(skillsProgress);
        } catch (error) {
          console.error("[applyExperienceGain] Error parsing skillsProgress:", error);
        }
      }
      if (!skills[legacySkillName]) {
        skills[legacySkillName] = { name: legacySkillName, currentXp: 0, level: 1 };
      }

      const legacySnapshot = buildSnapshot(legacySkillName, skills[legacySkillName].currentXp, skills[legacySkillName].level, 500);

      const xpPerLevel = 500;
      skills[legacySkillName].currentXp += xpToAdd;
      skills[legacySkillName].level = Math.floor(skills[legacySkillName].currentXp / xpPerLevel) + 1;
      localStorage.setItem("skillsProgress", JSON.stringify(skills));

      try {
        await fetch("/api/skills-progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            skillName: legacySkillName,
            currentXp: skills[legacySkillName].currentXp,
            level: skills[legacySkillName].level,
          }),
        });
      } catch (error) {
        console.error("[applyExperienceGain] Error saving to server:", error);
      }

      window.dispatchEvent(new CustomEvent("skillXpAdded", {
        detail: { skillName: legacySkillName, currentXp: skills[legacySkillName].currentXp },
      }));

      showPopup(() => {
        hideBodyGainPopup(); // evita solaparse con el pop-up de fuerza/flexibilidad
        showXpPopup(legacySnapshot);
      });
      return;
    }

    // GlobalSkill -- buscado en la lista completa (no solo la del área activa), porque "Otra
    // área" permite que el skill sea de otra área/quest.
    const currentSkill = globalSkills.find((s) => s.id === skillId);
    const globalSnapshot = buildSnapshot(
      currentSkill?.name || skillId,
      currentSkill?.currentXp || 0,
      currentSkill?.level || 1,
      currentSkill?.goalXp && currentSkill.goalXp > 0 ? currentSkill.goalXp : null
    );

    try {
      const updatedSkill = await addXpToGlobalSkill(skillId, xpToAdd);
      if (updatedSkill) {
        window.dispatchEvent(new CustomEvent("skillXpAdded", {
          detail: { skillId, currentXp: updatedSkill.currentXp, level: updatedSkill.level },
        }));
        // Solo el pop-up del XP propio del skill: agregar experiencia no toca la barra de nivel
        // del área/quest (esa sube únicamente al completar nodos).
        showPopup(() => {
          hideBodyGainPopup();
          showXpPopup(globalSnapshot);
        });
      }
    } catch (error) {
      console.error("[applyExperienceGain] Error adding XP:", error);
    }
  };
}

export interface ErrorAdjustResult {
  errorProgress: { errorName: string; pointsBefore: number; pointsAfter: number; estrategia?: string | null; disparador?: string | null };
  vencido: boolean;
  // Título de la estrategia que este +10 sumó a las "Estrategias" del Journal (null si ya estaba).
  newStrategy?: string | null;
}

export interface ErrorLinks {
  skillIds: string[];
  bodyLinks: Array<{ zone: BodyZone; dimension: BodyDimension }>;
}

// Pop-ups de un +10/-10 sobre un error: barra del error, "¡Error vencido!" si llegó a 50, y
// Flexibilidad mental (siempre). Con un +10 además suman los skills/componentes linkeados al
// error. Todo en una sola secuencia, para que nada se solape con nada.
export function useErrorAdjustPopups() {
  const applyExperienceGain = useApplyExperienceGain();
  const { addBodyBlock } = useBodyProgress();
  const { showBodyGainPopup } = useBodyGainPopup();
  const { showErrorProgressPopup } = useErrorProgressPopup();
  const { showErrorCelebration } = useErrorCelebration();

  return async (result: ErrorAdjustResult, delta: 10 | -10, links: ErrorLinks | undefined, areaColor: string) => {
    const blocks: Array<(enqueue: ShowPopup) => Promise<void> | void> = [];

    blocks.push((enqueue) => {
      enqueue(() => showErrorProgressPopup(result.errorProgress));
      if (result.vencido) {
        enqueue(() => showErrorCelebration({ name: result.errorProgress.errorName, kind: "vencido" }));
      }
      if (result.newStrategy) {
        const strategyName = result.newStrategy;
        queryClient.invalidateQueries({ queryKey: ["/api/journal/strategies"] });
        enqueue(() => showErrorCelebration({ name: strategyName, kind: "estrategia" }));
      }
      const { before, after } = addBodyBlock("mente", "flex");
      enqueue(() => showBodyGainPopup({ zone: "mente", dimension: "flex", before, after }));
    });

    if (delta > 0 && links) {
      for (const skillId of links.skillIds) {
        blocks.push((enqueue) => applyExperienceGain(skillId, areaColor, enqueue));
      }
      for (const link of links.bodyLinks) {
        blocks.push((enqueue) => {
          const { before, after } = addBodyBlock(link.zone, link.dimension);
          enqueue(() => showBodyGainPopup({ zone: link.zone, dimension: link.dimension, before, after }));
        });
      }
    }

    for (const block of blocks) {
      const tasks: Array<() => void> = [];
      await block((fn) => tasks.push(fn));
      await runPopupQueueAsync(tasks);
      while (getPopupBusyDelay() > 0) {
        await new Promise((resolve) => setTimeout(resolve, getPopupBusyDelay() + 150));
      }
    }
  };
}
