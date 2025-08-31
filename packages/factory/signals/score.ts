export function median(arr: number[]): number {
  if (!arr.length) return 0;
  const a = [...arr].sort((x,y)=>x-y);
  const m = Math.floor(a.length/2);
  return a.length % 2 ? a[m] : (a[m-1] + a[m]) / 2;
}

export function scoreGrowth(series: number[]): number {
  if (series.length < 2) return series[0] ?? 0;
  const prev = median(series.slice(0, -1));
  const latest = series[series.length - 1];
  if (prev <= 0) return latest;
  return ((latest - prev) / Math.max(1, prev)) * 100;
}

export function noveltyScore(term: string, history: Record<string, number[]>) {
  const series = history[term] ?? [];
  return Math.max(0, Math.min(100, scoreGrowth(series)));
}

export function overlapScore(evidenceCount: number) {
  return Math.min(30, (evidenceCount || 0) * 10);
}

export function finalScore(base: number, novelty: number, overlap: number) {
  return Math.round(0.6*base + 0.25*novelty + 0.15*overlap);
}

