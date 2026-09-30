import type { PackageItineraryDay } from '@/types';

/**
 * A day's own plan, one entry per line. Older packages had the first
 * sightseeing pick's notes copied into the day description as well, so any
 * line that just repeats a sightseeing description is dropped — otherwise it
 * shows twice (once as the plan, once under that sightseeing activity).
 */
export function dayPlanLines(d: PackageItineraryDay): string[] {
  const sightseeingText = new Set(
    (d.activityBlocks ?? []).map((b) => (b.description ?? '').trim().toLowerCase()).filter(Boolean),
  );
  return (d.description ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !sightseeingText.has(l.toLowerCase()));
}
