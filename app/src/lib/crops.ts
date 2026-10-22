/**
 * The three crops CropCare knows, and the guardrail for a photo of a
 * different crop than the farmer chose.
 */

export const CROPS = ['tomato', 'potato', 'maize'] as const;
export type Crop = (typeof CROPS)[number];

export function isCrop(value: unknown): value is Crop {
  return typeof value === 'string' && (CROPS as readonly string[]).includes(value);
}

/** Labels are named "<crop>_<condition>" in ml/class_map.json. */
export function cropOf(label: string): Crop | null {
  const crop = label.split('_')[0];
  return isCrop(crop) ? crop : null;
}

export function labelsOf(crop: Crop, labels: string[]): string[] {
  return labels.filter((l) => cropOf(l) === crop);
}

/**
 * The model looks at all 14 classes. When the farmer said "tomato" but the
 * best match is a maize class, the honest answer is to say so rather than
 * show maize advice for a tomato plant.
 */
export function cropMismatch(label: string, chosen: Crop | null): Crop | null {
  if (!chosen) return null;
  const detected = cropOf(label);
  return detected && detected !== chosen ? detected : null;
}
