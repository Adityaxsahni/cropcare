import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useTensorflowModel, type TensorflowModel } from 'react-native-fast-tflite';

import rawMeta from '../assets/model/model_meta.json';
import { checkModelMatchesMeta, isTestModel, parseModelMeta, type ModelMeta } from './lib/model';

type ModelState =
  | { state: 'loading' }
  | { state: 'error'; error: string }
  | { state: 'ready'; model: TensorflowModel; meta: ModelMeta };

const Ctx = createContext<ModelState>({ state: 'loading' });

/** True when the bundled model is an untrained stand-in: the app then warns on every result. */
export const IS_TEST_MODEL = isTestModel(String((rawMeta as { version?: unknown }).version ?? ''));

// fast-tflite loads bundled models by asset id, which only require() provides.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const MODEL_FILE = require('../assets/model/cropcare.tflite');

export function ModelProvider({ children }: { children: ReactNode }) {
  const plugin = useTensorflowModel(MODEL_FILE, []);
  const value = useMemo<ModelState>(() => {
    if (plugin.state === 'loading') return { state: 'loading' };
    if (plugin.state === 'error') return { state: 'error', error: plugin.error.message };
    try {
      const meta = parseModelMeta(rawMeta);
      checkModelMatchesMeta(plugin.model.inputs, plugin.model.outputs, meta);
      return { state: 'ready', model: plugin.model, meta };
    } catch (e) {
      return { state: 'error', error: (e as Error).message };
    }
  }, [plugin]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useModel(): ModelState {
  return useContext(Ctx);
}
