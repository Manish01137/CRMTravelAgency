export interface PackageMatchCandidate {
  id: string;
  name: string;
  destination: string;
}

/**
 * Deterministic, Gemini-free check for which of `candidates` a traveller's
 * free-text message names directly (by package name or destination), e.g.
 * "do you have the Goa package?" or just "kashmir". Word-boundary matching
 * (not plain substring) so "Goa" doesn't match "Agoda"; terms under 3 chars
 * are skipped as too noisy. Shared by Smart Bot and Bot Flow's CAROUSEL step.
 */
export function matchPackagesInText<T extends PackageMatchCandidate>(text: string, candidates: T[]): T[] {
  const matches: T[] = [];
  for (const pkg of candidates) {
    const terms = [pkg.name, pkg.destination].filter((t): t is string => !!t && t.trim().length >= 3);
    const hit = terms.some((term) => {
      const escaped = term.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
    });
    if (hit) matches.push(pkg);
  }
  return matches;
}
