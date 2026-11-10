/**
 * Performance budgets and Lighthouse CI gate definitions.
 *
 * These are the target numbers the CI pipeline validates against.
 * They are stored as code (not config) so the build agent can reference
 * them in CI scripts and the app can expose them to DevTools.
 */

export const PERFORMANCE_BUDGETS = {
  /** Max kilobytes for the main JS chunk (first load). */
  maxJsChunkKb: 250,
  /** Max kilobytes for CSS (first load). */
  maxCssChunkKb: 120,
  /** Max total transferred for the homepage (first visit, no cache). */
  maxTransferKb: 450,
  /** Lighthouse Performance score minimum (0–100). */
  minLighthousePerformance: 85,
  /** Largest Contentful Paint (ms). */
  maxLcpMs: 2500,
  /** First Input Delay (ms). */
  maxFidMs: 100,
  /** Cumulative Layout Shift. */
  maxCls: 0.05,
  /** Time to Interactive (ms). */
  maxTtiMs: 3500,
  /** Memory usage growth after a 5-minute session (MB). */
  maxMemoryGrowthMb: 20,
  /** Time to First Byte for /api/tmdb/* (ms, warm instance). */
  maxApiTtfbMs: 600,
  /** Max concurrent WebRTC peers per instance. */
  maxPeersPerInstance: 8,
} as const;

export type BudgetName = keyof typeof PERFORMANCE_BUDGETS;

export function formatBudget(name: BudgetName): string {
  const value = PERFORMANCE_BUDGETS[name];
  if (typeof value === "number" && name.includes("Ms")) return `${value}ms`;
  if (typeof value === "number" && name.includes("Kb")) return `${value}KB`;
  if (typeof value === "number" && name.includes("Mb")) return `${value}MB`;
  return String(value);
}

export default PERFORMANCE_BUDGETS;
