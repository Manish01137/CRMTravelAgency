/**
 * Options for a list that keeps itself up to date by polling. Every poll makes
 * the server read the database (billed by data transferred), so:
 *   - nothing is fetched while the browser tab is hidden;
 *   - coming back to the tab fetches straight away, instead of waiting for
 *     the next tick.
 * Spread into a useQuery: `useQuery({ queryKey, queryFn, ...livePolling(20_000) })`.
 */
export function livePolling(intervalMs: number) {
  return {
    refetchInterval: intervalMs,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always' as const,
  };
}

/** How often each live screen checks for changes. */
export const POLL = {
  openChat: 10_000,
  chatList: 20_000,
  chatBot: 20_000,
  stageCounts: 60_000,
  leads: 20_000,
  dashboard: 15_000,
} as const;
