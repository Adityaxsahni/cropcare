/**
 * Web build only, used to preview the screens in a browser. The disease
 * model runs only in the Android app, so on the web it reports that plainly.
 */
import { createContext, useContext, type ReactNode } from 'react';

import rawMeta from '../assets/model/model_meta.json';
import { isTestModel, type ModelMeta } from './lib/model';

type ModelState = { state: 'loading' } | { state: 'error'; error: string } | { state: 'ready'; model: never; meta: ModelMeta };

const WEB_STATE: ModelState = { state: 'error', error: 'The disease model runs only in the Android app.' };
const Ctx = createContext<ModelState>(WEB_STATE);

export const IS_TEST_MODEL = isTestModel(String((rawMeta as { version?: unknown }).version ?? ''));

export function ModelProvider({ children }: { children: ReactNode }) {
  return <Ctx.Provider value={WEB_STATE}>{children}</Ctx.Provider>;
}

export function useModel(): ModelState {
  return useContext(Ctx);
}
