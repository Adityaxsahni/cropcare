import { describe, expect, it, jest } from '@jest/globals';

import { isCompleteAdvice, pickAdvice, fetchNewerAdvice, type Advice } from './advice';
import { cropMismatch, cropOf, isCrop, labelsOf } from './crops';
import { addScan, averageInferenceMs, filterByCrop, HISTORY_LIMIT, setAnswer, type Scan } from './history';
import { checkModelMatchesMeta, isTestModel, parseModelMeta } from './model';
import { alternatives, confidenceLevel, decide, readProbabilities } from './postprocess';
import { guideCrop, toModelInput, toRgb } from './preprocess';
import { enqueue, flush, hourOf, toPending, type PendingScan } from './queue';

const LABELS = ['a', 'b', 'c'];

const META = {
  version: '1.0.0',
  variant: 'int8',
  labels: LABELS,
  image_size: 2,
  threshold: 0.6,
  input: { dtype: 'uint8', shape: [1, 2, 2, 3], scale: 1, zero_point: 0 },
  output: { dtype: 'uint8', shape: [1, 3], scale: 1 / 256, zero_point: 0 },
};

function scan(id: string, extra: Partial<Scan> = {}): Scan {
  return {
    id, label: 'a', confidence: 0.9, unsure: false, createdAt: '2026-10-22T10:47:12.000Z',
    modelVersion: '1.0.0', inferenceMs: 40, totalMs: 300, answer: null, ...extra,
  };
}

describe('model meta', () => {
  it('accepts valid metadata', () => {
    expect(parseModelMeta(META).labels).toEqual(LABELS);
  });
  it('rejects a label count that does not match the output', () => {
    expect(() => parseModelMeta({ ...META, labels: ['a', 'b'] })).toThrow('output size');
  });
  it('rejects a threshold outside 0..1', () => {
    expect(() => parseModelMeta({ ...META, threshold: 1.2 })).toThrow('threshold');
  });
  it('rejects quantized tensors without a scale', () => {
    expect(() => parseModelMeta({ ...META, input: { ...META.input, scale: 0 } })).toThrow('scale');
  });
  it('recognises untrained stand-in models', () => {
    expect(isTestModel('0.0.0-standin')).toBe(true);
    expect(isTestModel('1.0.0')).toBe(false);
  });
  it('accepts the float16 phone model from convert.py (float32 input and output)', () => {
    const meta = parseModelMeta({
      ...META,
      variant: 'float16',
      input: { dtype: 'float32', shape: [1, 2, 2, 3], scale: 0, zero_point: 0 },
      output: { dtype: 'float32', shape: [1, 3], scale: 0, zero_point: 0 },
    });
    expect(meta.variant).toBe('float16');
    expect(() => checkModelMatchesMeta([{ dataType: 'float32', shape: [1, 2, 2, 3] }], [{ dataType: 'float32', shape: [1, 3] }], meta)).not.toThrow();
    const input = new Float32Array(toModelInput(new Uint8Array([0, 128, 255]), meta.input));
    expect(Array.from(input)).toEqual([0, 128, 255]);
    expect(readProbabilities(new Float32Array([0.1, 0.7, 0.2]).buffer, meta.output, 3)).toEqual([expect.closeTo(0.1), expect.closeTo(0.7), expect.closeTo(0.2)]);
  });
  it('checks the loaded model against the metadata', () => {
    const meta = parseModelMeta(META);
    const good = { inputs: [{ dataType: 'uint8', shape: [1, 2, 2, 3] }], outputs: [{ dataType: 'uint8', shape: [1, 3] }] };
    expect(() => checkModelMatchesMeta(good.inputs, good.outputs, meta)).not.toThrow();
    expect(() => checkModelMatchesMeta([{ dataType: 'float32', shape: [1, 2, 2, 3] }], good.outputs, meta)).toThrow('input');
  });
});

describe('preprocess', () => {
  it('maps the guide box to photo pixels with a cover preview', () => {
    // 1440x1920 photo on a 400x800 view: cover scale = max(400/1440, 800/1920) = 0.41667
    // a 360 px box covers 360 / 0.41667 = 864 photo pixels
    expect(guideCrop(1440, 1920, 400, 800, 360, 'cover')).toEqual({ x: 288, y: 528, size: 864 });
  });
  it('maps the guide box with a contain preview', () => {
    // contain scale = min(400/1440, 800/1920) = 0.27778 -> 360 / 0.27778 = 1296
    expect(guideCrop(1440, 1920, 400, 800, 360, 'contain')).toEqual({ x: 72, y: 312, size: 1296 });
  });
  it('never crops outside the photo', () => {
    const c = guideCrop(1000, 800, 100, 100, 100, 'contain');
    expect(c.size).toBe(800);
    expect(c.x).toBe(100);
    expect(c.y).toBe(0);
  });

  it('reorders BGRA to RGB and drops alpha', () => {
    const bgra = new Uint8Array([3, 2, 1, 255, 30, 20, 10, 255]);
    expect(Array.from(toRgb(bgra.buffer, 2, 1, 'BGRA'))).toEqual([1, 2, 3, 10, 20, 30]);
  });
  it('handles ARGB and row padding', () => {
    // 1x2 image, 4 bytes per pixel, stride 8 (4 bytes padding per row)
    const argb = new Uint8Array([255, 1, 2, 3, 0, 0, 0, 0, 255, 4, 5, 6, 0, 0, 0, 0]);
    expect(Array.from(toRgb(argb.buffer, 1, 2, 'ARGB'))).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it('rejects unknown formats', () => {
    expect(() => toRgb(new ArrayBuffer(3), 1, 1, 'unknown')).toThrow('Unsupported');
  });

  it('passes raw bytes through for identity uint8 quantization', () => {
    const rgb = new Uint8Array([0, 128, 255]);
    expect(Array.from(new Uint8Array(toModelInput(rgb, { dtype: 'uint8', shape: [], scale: 1, zero_point: 0 })))).toEqual([0, 128, 255]);
  });
  it('quantizes with scale and zero point', () => {
    const rgb = new Uint8Array([0, 100, 255]);
    const out = new Int8Array(toModelInput(rgb, { dtype: 'int8', shape: [], scale: 1, zero_point: -128 }));
    expect(Array.from(out)).toEqual([-128, -28, 127]);
    const u = new Uint8Array(toModelInput(rgb, { dtype: 'uint8', shape: [], scale: 2, zero_point: 10 }));
    expect(Array.from(u)).toEqual([10, 60, 138]);
  });
  it('gives float input for float models', () => {
    const out = new Float32Array(toModelInput(new Uint8Array([0, 255]), { dtype: 'float32', shape: [], scale: 0, zero_point: 0 }));
    expect(Array.from(out)).toEqual([0, 255]);
  });
});

describe('postprocess', () => {
  it('dequantizes uint8 output', () => {
    const probs = readProbabilities(new Uint8Array([0, 128, 128]).buffer, META.output as never, 3);
    expect(probs).toEqual([0, 0.5, 0.5]);
  });
  it('rejects the wrong number of outputs', () => {
    expect(() => readProbabilities(new Float32Array([1, 0]).buffer, { dtype: 'float32', shape: [], scale: 0, zero_point: 0 }, 3)).toThrow();
  });
  it('answers above the threshold and is unsure below it', () => {
    expect(decide([0.1, 0.7, 0.2], LABELS, 0.6)).toEqual({ kind: 'answer', index: 1, label: 'b', confidence: 0.7 });
    expect(decide([0.4, 0.35, 0.25], LABELS, 0.6).kind).toBe('unsure');
    expect(decide([0.1, 0.6, 0.3], LABELS, 0.6).kind).toBe('answer');
  });
  it('words confidence', () => {
    expect(confidenceLevel(0.9)).toBe('high');
    expect(confidenceLevel(0.7)).toBe('medium');
    expect(confidenceLevel(0.4)).toBe('low');
  });
});

describe('history', () => {
  it('keeps newest first and caps the list', () => {
    let list: Scan[] = [];
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) list = addScan(list, scan(`s${i}`));
    expect(list).toHaveLength(HISTORY_LIMIT);
    expect(list[0].id).toBe(`s${HISTORY_LIMIT + 4}`);
  });
  it('records an answer', () => {
    expect(setAnswer([scan('x'), scan('y')], 'y', 'no').map((s) => s.answer)).toEqual([null, 'no']);
  });
  it('averages model time over recent scans', () => {
    const list = [scan('a', { inferenceMs: 30 }), scan('b', { inferenceMs: 50 }), scan('c', { inferenceMs: 1000 })];
    expect(averageInferenceMs(list, 2)).toEqual({ mean: 40, count: 2 });
    expect(averageInferenceMs([])).toBeNull();
  });
});

describe('queue', () => {
  it('rounds the time to the hour and converts the answer', () => {
    expect(hourOf('2026-10-22T10:47:12.345Z')).toBe('2026-10-22T10:00:00.000Z');
    const p = toPending(scan('x', { answer: 'yes', confidence: 0.87654 }), '1.0.0');
    expect(p).toEqual({
      scan_id: 'x', predicted_class: 'a', confidence: 0.877, correct: true,
      model_version: '1.0.0', app_version: '1.0.0', scanned_at: '2026-10-22T10:00:00.000Z',
    });
    expect(toPending(scan('y'), '1').correct).toBeNull();
  });
  it('replaces an earlier copy of the same scan', () => {
    const q = enqueue(enqueue([], toPending(scan('x'), '1')), toPending(scan('x', { answer: 'no' }), '1'));
    expect(q).toHaveLength(1);
    expect(q[0].correct).toBe(false);
  });

  const items = (n: number): PendingScan[] => Array.from({ length: n }, (_, i) => toPending(scan(`s${i}`), '1'));

  it('sends batches of 50 and empties the queue on success', async () => {
    const sizes: number[] = [];
    const fetchFn = jest.fn(async (_url: string, init: { body: string }) => {
      sizes.push(JSON.parse(init.body).scans.length);
      return { status: 200 };
    });
    expect(await flush(items(120), { apiUrl: 'https://api.example/', installId: 'i', fetchFn })).toEqual([]);
    expect(sizes).toEqual([50, 50, 20]);
    expect(fetchFn.mock.calls[0][0]).toBe('https://api.example/feedback');
  });
  it('keeps everything when offline or the server fails', async () => {
    const q = items(3);
    expect(await flush(q, { apiUrl: 'x', installId: 'i', fetchFn: async () => { throw new Error('offline'); } })).toEqual(q);
    expect(await flush(q, { apiUrl: 'x', installId: 'i', fetchFn: async () => ({ status: 503 }) })).toEqual(q);
    expect(await flush(q, { apiUrl: 'x', installId: 'i', fetchFn: async () => ({ status: 429 }) })).toEqual(q);
  });
  it('drops a batch the server rejects for good', async () => {
    expect(await flush(items(3), { apiUrl: 'x', installId: 'i', fetchFn: async () => ({ status: 422 }) })).toEqual([]);
  });
});

describe('advice', () => {
  const entry = { crop: 'tomato' as const, healthy: false, en: { name: 'A', steps: ['s'] }, hi: { name: 'अ', steps: ['स'] } };
  const make = (version: number, reviewed: boolean): Advice => ({
    version, review: { reviewed, reviewer: reviewed ? 'Dr. R, KVK' : '', date: '', notes: '' }, sources: [],
    classes: { a: entry, b: entry, c: entry },
  });

  it('checks every label has names and steps in both languages', () => {
    expect(isCompleteAdvice(make(1, true), LABELS)).toBe(true);
    expect(isCompleteAdvice(make(1, true), [...LABELS, 'd'])).toBe(false);
  });
  it('only replaces bundled advice with newer reviewed advice', () => {
    const bundled = make(0, false);
    expect(pickAdvice(bundled, make(2, true), LABELS).version).toBe(2);
    expect(pickAdvice(bundled, make(2, false), LABELS).version).toBe(0);
    expect(pickAdvice(make(3, true), make(2, true), LABELS).version).toBe(3);
    expect(pickAdvice(bundled, { junk: true }, LABELS).version).toBe(0);
  });
  it('downloads only when the server version is newer', async () => {
    const getFn = jest.fn(async (url: string) => ({
      status: 200,
      json: async () => (url.endsWith('/advice/version') ? { version: 2 } : make(2, true)),
    }));
    expect(await fetchNewerAdvice('https://x/', 2, getFn)).toBeNull();
    expect(getFn).toHaveBeenCalledTimes(1);
    expect(((await fetchNewerAdvice('https://x', 1, getFn)) as Advice).version).toBe(2);
  });
});

describe('crops', () => {
  const all = ['tomato_late_blight', 'tomato_healthy', 'potato_healthy', 'maize_common_rust'];
  it('reads the crop from a label', () => {
    expect(cropOf('maize_common_rust')).toBe('maize');
    expect(cropOf('rice_blast')).toBeNull();
    expect(isCrop('potato')).toBe(true);
    expect(labelsOf('tomato', all)).toEqual(['tomato_late_blight', 'tomato_healthy']);
  });
  it('flags a photo of another crop', () => {
    expect(cropMismatch('maize_common_rust', 'tomato')).toBe('maize');
    expect(cropMismatch('tomato_healthy', 'tomato')).toBeNull();
    expect(cropMismatch('tomato_healthy', null)).toBeNull();
  });
});

describe('alternatives and filters', () => {
  it('lists the next likely conditions, skipping tiny ones', () => {
    expect(alternatives([0.7, 0.2, 0.01, 0.09], ['a', 'b', 'c', 'd'])).toEqual([
      { label: 'b', confidence: 0.2 },
      { label: 'd', confidence: 0.09 },
    ]);
    expect(alternatives([0.99, 0.005, 0.005], ['a', 'b', 'c'])).toEqual([]);
  });
  it('filters history by crop', () => {
    const list = [scan('1', { label: 'tomato_healthy' }), scan('2', { label: 'maize_healthy' })];
    expect(filterByCrop(list, 'maize').map((s) => s.id)).toEqual(['2']);
    expect(filterByCrop(list, 'all')).toHaveLength(2);
  });
});
