/**
 * Photo to model input: crop the region shown inside the guide box, then
 * convert raw pixels to the tensor type the model expects. Matches the
 * evaluation preprocessing in ml/cropcare/data.py (square crop, 224 x 224,
 * RGB values 0 to 255).
 */

import type { TensorMeta } from './model';

export type PreviewResizeMode = 'cover' | 'contain';

export type Crop = { x: number; y: number; size: number };

/**
 * The square of the photo, in photo pixels, that the user saw inside a
 * centred guide box of side `boxSide` on a preview of size viewW x viewH.
 */
export function guideCrop(
  photoW: number,
  photoH: number,
  viewW: number,
  viewH: number,
  boxSide: number,
  mode: PreviewResizeMode,
): Crop {
  if (photoW <= 0 || photoH <= 0 || viewW <= 0 || viewH <= 0 || boxSide <= 0) {
    throw new Error('guideCrop: sizes must be positive');
  }
  const scale = mode === 'cover' ? Math.max(viewW / photoW, viewH / photoH) : Math.min(viewW / photoW, viewH / photoH);
  const size = Math.min(Math.round(boxSide / scale), photoW, photoH);
  return { x: Math.floor((photoW - size) / 2), y: Math.floor((photoH - size) / 2), size };
}

/** The largest centred square of a photo with no guide box (from the phone's camera app or gallery). */
export function centreSquare(photoW: number, photoH: number): Crop {
  if (photoW <= 0 || photoH <= 0) throw new Error('centreSquare: sizes must be positive');
  const size = Math.min(photoW, photoH);
  return { x: Math.floor((photoW - size) / 2), y: Math.floor((photoH - size) / 2), size };
}

type Layout = { bpp: 3 | 4; r: number; g: number; b: number };

const LAYOUTS: Record<string, Layout> = {
  RGB: { bpp: 3, r: 0, g: 1, b: 2 },
  BGR: { bpp: 3, r: 2, g: 1, b: 0 },
  RGBA: { bpp: 4, r: 0, g: 1, b: 2 },
  RGBX: { bpp: 4, r: 0, g: 1, b: 2 },
  BGRA: { bpp: 4, r: 2, g: 1, b: 0 },
  BGRX: { bpp: 4, r: 2, g: 1, b: 0 },
  ARGB: { bpp: 4, r: 1, g: 2, b: 3 },
  XRGB: { bpp: 4, r: 1, g: 2, b: 3 },
  ABGR: { bpp: 4, r: 3, g: 2, b: 1 },
  XBGR: { bpp: 4, r: 3, g: 2, b: 1 },
};

/** Packed RGB bytes from a raw pixel buffer in any of the formats nitro-image reports. */
export function toRgb(buffer: ArrayBuffer, width: number, height: number, pixelFormat: string): Uint8Array {
  const layout = LAYOUTS[pixelFormat];
  if (!layout) throw new Error(`Unsupported pixel format: ${pixelFormat}`);
  const src = new Uint8Array(buffer);
  const rowBytes = width * layout.bpp;
  const stride = src.length / height;
  if (!Number.isInteger(stride) || stride < rowBytes) {
    throw new Error(`Pixel buffer of ${src.length} bytes does not fit ${width}x${height} ${pixelFormat}`);
  }
  const out = new Uint8Array(width * height * 3);
  let o = 0;
  for (let y = 0; y < height; y++) {
    let i = y * stride;
    for (let x = 0; x < width; x++, i += layout.bpp) {
      out[o++] = src[i + layout.r];
      out[o++] = src[i + layout.g];
      out[o++] = src[i + layout.b];
    }
  }
  return out;
}

/** RGB 0-255 bytes to the model's input tensor, quantized with the model's own parameters. */
export function toModelInput(rgb: Uint8Array, input: TensorMeta): ArrayBuffer {
  if (input.dtype === 'float32') {
    return Float32Array.from(rgb).buffer;
  }
  const { scale, zero_point: zp } = input;
  const [lo, hi] = input.dtype === 'uint8' ? [0, 255] : [-128, 127];
  if (input.dtype === 'uint8' && Math.abs(scale - 1) < 1e-6 && zp === 0) {
    return rgb.slice().buffer;
  }
  const out = input.dtype === 'uint8' ? new Uint8Array(rgb.length) : new Int8Array(rgb.length);
  for (let i = 0; i < rgb.length; i++) {
    out[i] = Math.min(hi, Math.max(lo, Math.round(rgb[i] / scale + zp)));
  }
  return out.buffer;
}
