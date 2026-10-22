export type Answer = 'yes' | 'no' | null;

export type UnsureReason = 'low_confidence' | 'other_crop';

export type Scan = {
  id: string;
  label: string;
  confidence: number;
  unsure: boolean;
  unsureReason?: UnsureReason;
  chosenCrop?: string; // the crop the farmer picked before taking the photo
  alternatives?: { label: string; confidence: number }[];
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

/** Checks of one crop (by the label the model gave), or all of them. */
export function filterByCrop(list: Scan[], crop: string | 'all'): Scan[] {
  return crop === 'all' ? list : list.filter((s) => s.label.split('_')[0] === crop);
}

/** Mean model time over the newest `n` scans, for the phone speed figure in results.md. */
export function averageInferenceMs(list: Scan[], n = 50): { mean: number; count: number } | null {
  const recent = list.slice(0, n);
  if (recent.length === 0) return null;
  return { mean: recent.reduce((sum, s) => sum + s.inferenceMs, 0) / recent.length, count: recent.length };
}
