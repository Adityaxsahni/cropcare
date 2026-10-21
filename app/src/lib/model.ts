/**
 * The model metadata written by ml/scripts/convert.py. The app trusts nothing
 * about the model that is not in this file: label order, input type and
 * quantization all come from here.
 */

export type TensorDtype = 'uint8' | 'int8' | 'float32';

export type TensorMeta = {
  dtype: TensorDtype;
  shape: number[];
  scale: number;
  zero_point: number;
};

export type ModelMeta = {
  version: string;
  variant: string;
  labels: string[];
  image_size: number;
  threshold: number;
  input: TensorMeta;
  output: TensorMeta;
};

const DTYPES: TensorDtype[] = ['uint8', 'int8', 'float32'];

function tensor(raw: unknown, name: string): TensorMeta {
  const t = raw as Partial<TensorMeta> | null;
  if (!t || !DTYPES.includes(t.dtype as TensorDtype)) throw new Error(`model_meta: ${name}.dtype must be one of ${DTYPES.join(', ')}`);
  if (!Array.isArray(t.shape) || !t.shape.every(Number.isInteger)) throw new Error(`model_meta: ${name}.shape is invalid`);
  if (typeof t.scale !== 'number' || typeof t.zero_point !== 'number') throw new Error(`model_meta: ${name} quantization is missing`);
  if (t.dtype !== 'float32' && !(t.scale > 0)) throw new Error(`model_meta: ${name}.scale must be positive for ${t.dtype}`);
  return { dtype: t.dtype as TensorDtype, shape: t.shape, scale: t.scale, zero_point: t.zero_point };
}

export function parseModelMeta(raw: unknown): ModelMeta {
  const m = raw as Partial<ModelMeta> | null;
  if (!m || typeof m.version !== 'string' || !m.version) throw new Error('model_meta: version is missing');
  if (!Array.isArray(m.labels) || m.labels.length === 0) throw new Error('model_meta: labels are missing');
  if (typeof m.image_size !== 'number' || m.image_size <= 0) throw new Error('model_meta: image_size is invalid');
  if (typeof m.threshold !== 'number' || m.threshold <= 0 || m.threshold >= 1) throw new Error('model_meta: threshold must be between 0 and 1');
  const input = tensor(m.input, 'input');
  const output = tensor(m.output, 'output');
  const [batch, h, w, c] = input.shape;
  if (batch !== 1 || h !== m.image_size || w !== m.image_size || c !== 3) {
    throw new Error(`model_meta: input shape ${JSON.stringify(input.shape)} does not match image_size ${m.image_size}`);
  }
  if (output.shape[output.shape.length - 1] !== m.labels.length) {
    throw new Error('model_meta: output size does not match the number of labels');
  }
  return { version: m.version, variant: String(m.variant ?? ''), labels: m.labels, image_size: m.image_size, threshold: m.threshold, input, output };
}

/** The loaded .tflite must agree with its metadata, or results would be silently wrong. */
export function checkModelMatchesMeta(
  modelInputs: { dataType: string; shape: number[] }[],
  modelOutputs: { dataType: string; shape: number[] }[],
  meta: ModelMeta,
): void {
  const same = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);
  const inp = modelInputs[0];
  const out = modelOutputs[0];
  if (!inp || inp.dataType !== meta.input.dtype || !same(inp.shape, meta.input.shape)) {
    throw new Error('The model file does not match model_meta.json (input).');
  }
  if (!out || out.dataType !== meta.output.dtype || !same(out.shape, meta.output.shape)) {
    throw new Error('The model file does not match model_meta.json (output).');
  }
}
