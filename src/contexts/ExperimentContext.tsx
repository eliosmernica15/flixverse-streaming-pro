"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface ExperimentVariant {
  id: string;
  name: string;
  weight: number;
}

interface Experiment {
  id: string;
  variants: ExperimentVariant[];
  enabled: boolean;
}

interface ExperimentContextValue {
  getVariant: (experimentId: string) => string | null;
  isInVariant: (experimentId: string, variantId: string) => boolean;
}

const ExperimentContext = createContext<ExperimentContextValue | null>(null);

// Default experiments — add new A/B tests here
const DEFAULT_EXPERIMENTS: Experiment[] = [
  {
    id: "hero-cta",
    variants: [
      { id: "control", name: "Play Now", weight: 50 },
      { id: "variant-a", name: "Start Watching", weight: 50 },
    ],
    enabled: true,
  },
  {
    id: "install-prompt",
    variants: [
      { id: "control", name: "standard", weight: 70 },
      { id: "variant-a", name: "aggressive", weight: 30 },
    ],
    enabled: true,
  },
  {
    id: "card-preview",
    variants: [
      { id: "control", name: "enabled", weight: 80 },
      { id: "variant-a", name: "disabled", weight: 20 },
    ],
    enabled: true,
  },
];

const STORAGE_KEY = "flixverse-experiments";

function loadAssignments(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveAssignments(assignments: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(assignments));
  } catch {
    // ignore
  }
}

function assignVariant(experiment: Experiment, existing?: string): string {
  if (existing) return existing;
  if (!experiment.enabled) return experiment.variants[0]?.id || "";

  // Weighted random selection
  const totalWeight = experiment.variants.reduce((sum, v) => sum + v.weight, 0);
  let random = Math.random() * totalWeight;
  for (const variant of experiment.variants) {
    random -= variant.weight;
    if (random <= 0) return variant.id;
  }
  return experiment.variants[0]?.id || "";
}

export function ExperimentProvider({ children }: { children: ReactNode }) {
  const [assignments, setAssignments] = useState<Record<string, string>>({});

  useEffect(() => {
    const existing = loadAssignments();
    const newAssignments = { ...existing };

    for (const exp of DEFAULT_EXPERIMENTS) {
      if (!newAssignments[exp.id]) {
        newAssignments[exp.id] = assignVariant(exp, existing[exp.id]);
      }
    }

    setAssignments(newAssignments);
    saveAssignments(newAssignments);
  }, []);

  const getVariant = (experimentId: string): string | null => {
    return assignments[experimentId] || null;
  };

  const isInVariant = (experimentId: string, variantId: string): boolean => {
    return assignments[experimentId] === variantId;
  };

  return (
    <ExperimentContext.Provider value={{ getVariant, isInVariant }}>
      {children}
    </ExperimentContext.Provider>
  );
}

export function useExperiment() {
  const ctx = useContext(ExperimentContext);
  if (!ctx) {
    // Fallback when not inside provider — return defaults
    return {
      getVariant: () => null,
      isInVariant: () => false,
    };
  }
  return ctx;
}
