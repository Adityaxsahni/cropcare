import type { TensorMeta } from './model';

/** Dequantize the model output into probabilities. */
export function readProbabilities(out: ArrayBuffer, meta: TensorMeta, numClasses: number): number[] {
  let values: number[];
  if (meta.dtype === 'float32') {
    values = Array.from(new Float32Array(out));
  } else {
    const q = meta.dtype === 'uint8' ? new Uint8Array(out) : new Int8Array(out);
    values = Array.from(q, (v) => (v - meta.zero_point) * meta.scale);
  }
  if (values.length !== numClasses) {
    throw new Error(`Model returned ${values.length} values, expected ${numClasses}`);
  }
  return values;
}

export type Decision = {
  kind: 'answer' | 'unsure';
  index: number;
  label: string;
  confidence: number;
};

export function decide(probs: number[], labels: string[], threshold: number): Decision {
  let index = 0;
  for (let i = 1; i < probs.length; i++) if (probs[i] > probs[index]) index = i;
  const confidence = Math.min(1, Math.max(0, probs[index]));
  return { kind: confidence >= threshold ? 'answer' : 'unsure', index, label: labels[index], confidence };
}

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export function confidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= 0.85) return 'high';
  if (confidence >= 0.6) return 'medium';
  return 'low';
}
