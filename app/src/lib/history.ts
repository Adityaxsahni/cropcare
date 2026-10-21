export type Answer = 'yes' | 'no' | null;

export type Scan = {
  id: string;
  label: string;
  confidence: number;
  unsure: boolean;
  createdAt: string; // ISO time
  modelVersion: string;
  inferenceMs: number; // model.run only
  totalMs: number; // photo taken to result
  answer: Answer;
};

export const HISTORY_LIMIT = 200;

export function addScan(list: Scan[], scan: Scan): Scan[] {
  return [scan, ...list.filter((s) => s.id !== scan.id)].slice(0, HISTORY_LIMIT);
}

export function setAnswer(list: Scan[], id: string, answer: Answer): Scan[] {
  return list.map((s) => (s.id === id ? { ...s, answer } : s));
}

/** Mean model time over the newest `n` scans, for the phone speed figure in results.md. */
export function averageInferenceMs(list: Scan[], n = 50): { mean: number; count: number } | null {
  const recent = list.slice(0, n);
  if (recent.length === 0) return null;
  return { mean: recent.reduce((sum, s) => sum + s.inferenceMs, 0) / recent.length, count: recent.length };
}
