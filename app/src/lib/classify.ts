/**
 * Photo to probabilities, on the phone. Native parts only; the maths lives in
 * preprocess.ts and postprocess.ts where it is unit tested.
 */

import { File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { loadImage } from 'react-native-nitro-image';
import type { TensorflowModel } from 'react-native-fast-tflite';

import type { ModelMeta } from './model';
import { readProbabilities } from './postprocess';
import { centreSquare, guideCrop, toModelInput, toRgb, type Crop, type PreviewResizeMode } from './preprocess';

/** Where the guide box sat on the in-app preview; null for a photo from the phone's camera app or gallery. */
export type Geometry = { viewW: number; viewH: number; boxSide: number; mode: PreviewResizeMode } | null;

export async function classifyPhoto(
  uri: string,
  geometry: Geometry,
  model: TensorflowModel,
  meta: ModelMeta,
): Promise<{ probs: number[]; inferenceMs: number }> {
  const temporary = [uri];
  try {
    return await run(uri, geometry, model, meta, temporary);
  } finally {
    // The privacy page promises photos are discarded after the check.
    discardCachedCopies(temporary);
  }
}

/**
 * Deletes our temporary copies: the camera's photo, the picker's cropped copy and the 224 px PNG.
 * Only files inside this app's cache folder; a photo picked from the gallery is never touched.
 */
function discardCachedCopies(uris: string[]) {
  const cache = Paths.cache.uri;
  for (const uri of uris) {
    if (!uri.startsWith(cache)) continue;
    try {
      const file = new File(uri);
      if (file.exists) file.delete();
    } catch {
      // A leftover cache file is cleared by Android later; never fail a check over it.
    }
  }
}

async function run(
  uri: string,
  geometry: Geometry,
  model: TensorflowModel,
  meta: ModelMeta,
  temporary: string[],
): Promise<{ probs: number[]; inferenceMs: number }> {
  // Decode once to learn the size the manipulator actually sees (after any rotation), then crop in those pixels.
  const full = await ImageManipulator.manipulate(uri).renderAsync();
  const crop: Crop = geometry
    ? guideCrop(full.width, full.height, geometry.viewW, geometry.viewH, geometry.boxSide, geometry.mode)
    : centreSquare(full.width, full.height);
  const small = await ImageManipulator.manipulate(full)
    .crop({ originX: crop.x, originY: crop.y, width: crop.size, height: crop.size })
    .resize({ width: meta.image_size, height: meta.image_size })
    .renderAsync();
  // PNG keeps the 224 x 224 pixels exactly; nitro-image then gives the raw bytes.
  const saved = await small.saveAsync({ format: SaveFormat.PNG });
  temporary.push(saved.uri);
  const image = await loadImage({ filePath: saved.uri });
  const raw = await image.toRawPixelDataAsync();
  const rgb = toRgb(raw.buffer, raw.width, raw.height, raw.pixelFormat);
  if (raw.width !== meta.image_size || raw.height !== meta.image_size) {
    throw new Error(`Expected ${meta.image_size}x${meta.image_size} pixels, got ${raw.width}x${raw.height}`);
  }
  const input = toModelInput(rgb, meta.input);
  const start = performance.now();
  const [output] = await model.run([input]);
  const inferenceMs = performance.now() - start;
  return { probs: readProbabilities(output, meta.output, meta.labels.length), inferenceMs };
}
