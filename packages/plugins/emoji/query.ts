// Emoji plugin domain helpers

export function buildOrQueryTerms(terms: string[]): string {
  return terms.filter(Boolean).join(" OR ");
}

