import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { BodyDimension, BodyZone } from "@/lib/body-progress-context";

// Step 3 of the title-long-press edit dialog (xp/fuerza/poderes/aprendizaje), and the node
// long-press Journal's Learnings/Tools tabs, only *stage* a choice for an unconfirmed node --
// it's applied for real once the node itself gets confirmed (see runConfirmSequence in
// SkillNode.tsx). That staged choice used to live in useState inside SkillNode, which meant it
// was wiped the moment the component unmounted -- which happens on every "page" change
// (switching area/quest, opening Journal, etc., all of which swap out the mounted skill nodes).
// Keeping it here instead, keyed by skillId and held above the views that come and go, makes
// the selection survive navigation; localStorage makes it survive a reload too.

export type PendingRewardsTab = "experience" | "body" | "powers" | "learning";

export interface PendingLearningDraft {
  title: string;
  sentence: string;
}

export interface PendingRewardSelection {
  rewardsTab: PendingRewardsTab;
  xpSkillId: string | null;
  bodyDimension: BodyDimension;
  bodyZones: BodyZone[];
  powerId: string | null;
  // Staged the same way as xp/body/power above: set from the node long-press
  // Journal's Learnings/Tools tabs (and Step 3's own Learning tab), only actually
  // saved to the server -- and its counter pop-up shown -- once the node is
  // confirmed. Only one learning can be staged per node at a time (a second staged
  // learning replaces the first); tools accumulate as a list since a node can
  // reasonably pick up several.
  learning: PendingLearningDraft | null;
  tools: PendingLearningDraft[];
}

function defaultSelection(): PendingRewardSelection {
  return { rewardsTab: "experience", xpSkillId: null, bodyDimension: "fuerza", bodyZones: [], powerId: null, learning: null, tools: [] };
}

type PendingRewardsState = Record<string, PendingRewardSelection>;

const STORAGE_KEY = "skill-map-pending-rewards-v1";

function loadState(): PendingRewardsState {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

// An entry with nothing staged is worth dropping entirely instead of storing the default --
// keeps the persisted map from growing forever with empty/cleared-out entries. Also checks
// rewardsTab: without this, switching Step 3 to a tab other than "experience" (e.g.
// "Aprendizaje") while nothing else is staged yet would itself count as "empty" and get
// deleted right away -- which, on the very next render, snaps rewardsTab back to its default
// ("experience"), making the tab look like it refuses to switch unless something (like an xp
// skill) was already staged first.
function isEmptySelection(entry: PendingRewardSelection): boolean {
  return !entry.xpSkillId && entry.bodyZones.length === 0 && !entry.powerId && !entry.learning && entry.tools.length === 0
    && entry.rewardsTab === "experience";
}

// Merges in defaults for any field missing on an entry loaded from an older localStorage
// payload (from before `learning`/`tools` existed), so callers never see `undefined` here.
function withDefaults(entry: PendingRewardSelection | undefined): PendingRewardSelection {
  return { ...defaultSelection(), ...entry };
}

interface PendingRewardsContextValue {
  getPendingRewards: (skillId: string) => PendingRewardSelection;
  setPendingRewardsTab: (skillId: string, tab: PendingRewardsTab) => void;
  setPendingXpSkillId: (skillId: string, xpSkillId: string | null) => void;
  setPendingBodyDimension: (skillId: string, dimension: BodyDimension) => void;
  setPendingBodyZones: (skillId: string, update: BodyZone[] | ((prev: BodyZone[]) => BodyZone[])) => void;
  setPendingPowerId: (skillId: string, powerId: string | null) => void;
  setPendingLearning: (skillId: string, learning: PendingLearningDraft | null) => void;
  setPendingTools: (skillId: string, update: PendingLearningDraft[] | ((prev: PendingLearningDraft[]) => PendingLearningDraft[])) => void;
  clearPendingRewards: (skillId: string) => void;
}

const PendingRewardsContext = createContext<PendingRewardsContextValue | undefined>(undefined);

export function PendingRewardsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PendingRewardsState>(() => loadState());

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Every setter funnels through the functional form of setState so rapid-fire updates (e.g.
  // toggling body zones) always build on the latest value instead of a stale closure over `state`.
  const updateEntry = (
    skillId: string,
    patch: Partial<PendingRewardSelection> | ((current: PendingRewardSelection) => Partial<PendingRewardSelection>)
  ) => {
    setState((prev) => {
      const current = withDefaults(prev[skillId]);
      const resolvedPatch = typeof patch === "function" ? patch(current) : patch;
      const next = { ...current, ...resolvedPatch };
      const nextState = { ...prev };
      if (isEmptySelection(next)) {
        delete nextState[skillId];
      } else {
        nextState[skillId] = next;
      }
      return nextState;
    });
  };

  const getPendingRewards = (skillId: string) => withDefaults(state[skillId]);

  const value: PendingRewardsContextValue = {
    getPendingRewards,
    setPendingRewardsTab: (skillId, tab) => updateEntry(skillId, { rewardsTab: tab }),
    setPendingXpSkillId: (skillId, xpSkillId) => updateEntry(skillId, { xpSkillId }),
    setPendingBodyDimension: (skillId, bodyDimension) => updateEntry(skillId, { bodyDimension }),
    setPendingBodyZones: (skillId, update) => {
      updateEntry(skillId, (current) => ({
        bodyZones: typeof update === "function" ? update(current.bodyZones) : update,
      }));
    },
    setPendingPowerId: (skillId, powerId) => updateEntry(skillId, { powerId }),
    setPendingLearning: (skillId, learning) => updateEntry(skillId, { learning }),
    setPendingTools: (skillId, update) => {
      updateEntry(skillId, (current) => ({
        tools: typeof update === "function" ? update(current.tools) : update,
      }));
    },
    clearPendingRewards: (skillId) => {
      setState((prev) => {
        if (!(skillId in prev)) return prev;
        const nextState = { ...prev };
        delete nextState[skillId];
        return nextState;
      });
    },
  };

  return <PendingRewardsContext.Provider value={value}>{children}</PendingRewardsContext.Provider>;
}

export function usePendingRewards() {
  const context = useContext(PendingRewardsContext);
  if (!context) {
    throw new Error("usePendingRewards must be used within a PendingRewardsProvider");
  }
  return context;
}
