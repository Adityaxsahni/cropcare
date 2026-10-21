/**
 * Photo to probabilities, on the phone. Native parts only; the maths lives in
 * preprocess.ts and postprocess.ts where it is unit tested.
 */

import type { TensorflowModel } from 'react-native-fast-tflite';
import type { Photo } from 'react-native-vision-camera';

import type { ModelMeta } from './model';
import { readProbabilities } from './postprocess';
import { guideCrop, toModelInput, toRgb, type PreviewResizeMode } from './preprocess';

export type Geometry = { viewW: number; viewH: number; boxSide: number; mode: PreviewResizeMode };

export async function classifyPhoto(
  photo: Photo,
  geometry: Geometry,
  model: TensorflowModel,
  meta: ModelMeta,
): Promise<{ probs: number[]; inferenceMs: number }> {
  try {
    // toImageAsync applies the photo's orientation, so width and height match what the preview showed.
    const image = await photo.toImageAsync();
    const crop = guideCrop(image.width, image.height, geometry.viewW, geometry.viewH, geometry.boxSide, geometry.mode);
    const square = await image.cropAsync(crop.x, crop.y, crop.x + crop.size, crop.y + crop.size);
    const small = await square.resizeAsync(meta.image_size, meta.image_size);
    const raw = await small.toRawPixelDataAsync();
    const rgb = toRgb(raw.buffer, raw.width, raw.height, raw.pixelFormat);
    const input = toModelInput(rgb, meta.input);
    const start = performance.now();
    const [output] = await model.run([input]);
    const inferenceMs = performance.now() - start;
    return { probs: readProbabilities(output, meta.output, meta.labels.length), inferenceMs };
  } finally {
    photo.dispose();
  }
}
