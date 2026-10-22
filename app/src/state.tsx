import NetInfo from '@react-native-community/netinfo';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import bundledAdvice from '../assets/advice.json';
import { strings, type Strings } from './i18n';
import { fetchNewerAdvice, pickAdvice, type Advice, type Language } from './lib/advice';
import type { Crop } from './lib/crops';
import { addScan, setAnswer, type Answer, type Scan } from './lib/history';
import { enqueue, flush, toPending, type PendingScan } from './lib/queue';
import { KEYS, load, remove, save } from './lib/storage';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').trim();
export const PRIVACY_URL = (process.env.EXPO_PUBLIC_PRIVACY_URL ?? '').trim();
const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';
const BUNDLED = bundledAdvice as Advice;
const LABELS = Object.keys(BUNDLED.classes);

export type Consent = 'yes' | 'no' | null;
type Settings = { language: Language; consent: Consent; onboarded?: boolean; lastCrop?: Crop };

type AppState = {
  ready: boolean;
  s: Strings;
  language: Language;
  setLanguage: (l: Language) => void;
  /** null until the farmer has answered; sharing is only offered when a server is configured. */
  consent: Consent;
  sharingAvailable: boolean;
  setConsent: (c: Exclude<Consent, null>) => void;
  onboarded: boolean;
  completeOnboarding: () => void;
  lastCrop: Crop;
  setLastCrop: (c: Crop) => void;
  history: Scan[];
  recordScan: (scan: Scan) => void;
  answerScan: (id: string, answer: Exclude<Answer, null>) => void;
  pendingUploads: number;
  advice: Advice;
};

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>({ language: 'hi', consent: null });
  const [history, setHistory] = useState<Scan[]>([]);
  const [queue, setQueue] = useState<PendingScan[]>([]);
  const [advice, setAdvice] = useState<Advice>(BUNDLED);
  const syncing = useRef(false);
  const queueRef = useRef(queue);
  const historyRef = useRef(history);
  const consentRef = useRef<Consent>(null);

  useEffect(() => {
    (async () => {
      const [s, h, q, a] = await Promise.all([
        load<Settings>(KEYS.settings, { language: 'hi', consent: null }),
        load<Scan[]>(KEYS.history, []),
        load<PendingScan[]>(KEYS.queue, []),
        load<unknown>(KEYS.advice, null),
      ]);
      setSettings(s);
      consentRef.current = s.consent;
      historyRef.current = h;
      setHistory(h);
      queueRef.current = s.consent === 'yes' ? q : [];
      setQueue(queueRef.current);
      setAdvice(pickAdvice(BUNDLED, a, LABELS));
      setReady(true);
    })();
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    if (patch.consent !== undefined) consentRef.current = patch.consent;
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      save(KEYS.settings, next);
      return next;
    });
  }, []);

  const updateQueue = useCallback((next: PendingScan[]) => {
    queueRef.current = next;
    setQueue(next);
    save(KEYS.queue, next);
  }, []);

  const sync = useCallback(async () => {
    if (!API_URL || syncing.current) return;
    syncing.current = true;
    try {
      const net = await NetInfo.fetch();
      if (!net.isConnected) return;
      const newer = await fetchNewerAdvice(API_URL, advice.version, (url) => fetch(url)).catch(() => null);
      if (newer) {
        const picked = pickAdvice(advice, newer, LABELS);
        if (picked !== advice) {
          setAdvice(picked);
          save(KEYS.advice, picked);
        }
      }
      if (consentRef.current === 'yes' && queueRef.current.length > 0) {
        const installId = await load<string | null>(KEYS.installId, null);
        if (!installId) return;
        const sent = queueRef.current;
        const left = await flush(sent, { apiUrl: API_URL, installId, fetchFn: (url, init) => fetch(url, init) });
        // Keep anything queued while the upload was running.
        const sentIds = new Set(sent.map((p) => p.scan_id));
        const leftIds = new Set(left.map((p) => p.scan_id));
        updateQueue(queueRef.current.filter((p) => !sentIds.has(p.scan_id) || leftIds.has(p.scan_id)));
      }
    } finally {
      syncing.current = false;
    }
  }, [advice, updateQueue]);

  useEffect(() => {
    if (!ready) return;
    sync();
    return NetInfo.addEventListener((state) => {
      if (state.isConnected) sync();
    });
  }, [ready, sync]);

  const setConsent = useCallback(
    async (consent: Exclude<Consent, null>) => {
      if (consent === 'yes') {
        const existing = await load<string | null>(KEYS.installId, null);
        if (!existing) await save(KEYS.installId, Crypto.randomUUID());
      } else {
        // Withdrawing consent deletes unsent results and the install ID.
        updateQueue([]);
        await remove(KEYS.installId);
      }
      updateSettings({ consent });
    },
    [updateQueue, updateSettings],
  );

  const updateHistory = useCallback((next: Scan[]) => {
    historyRef.current = next;
    setHistory(next);
    save(KEYS.history, next);
  }, []);

  const recordScan = useCallback(
    (scan: Scan) => {
      updateHistory(addScan(historyRef.current, scan));
      if (consentRef.current === 'yes') {
        updateQueue(enqueue(queueRef.current, toPending(scan, APP_VERSION)));
        sync();
      }
    },
    [sync, updateHistory, updateQueue],
  );

  const answerScan = useCallback(
    (id: string, answer: Exclude<Answer, null>) => {
      const next = setAnswer(historyRef.current, id, answer);
      updateHistory(next);
      const scan = next.find((x) => x.id === id);
      if (scan && consentRef.current === 'yes') {
        updateQueue(enqueue(queueRef.current, toPending(scan, APP_VERSION)));
        sync();
      }
    },
    [sync, updateHistory, updateQueue],
  );

  const value = useMemo<AppState>(
    () => ({
      ready,
      s: strings[settings.language],
      language: settings.language,
      setLanguage: (language) => updateSettings({ language }),
      consent: settings.consent,
      sharingAvailable: API_URL.length > 0,
      setConsent,
      onboarded: settings.onboarded === true,
      completeOnboarding: () => updateSettings({ onboarded: true }),
      lastCrop: settings.lastCrop ?? 'tomato',
      setLastCrop: (lastCrop) => updateSettings({ lastCrop }),
      history,
      recordScan,
      answerScan,
      pendingUploads: queue.length,
      advice,
    }),
    [ready, settings, updateSettings, setConsent, history, recordScan, answerScan, queue.length, advice],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used inside AppStateProvider');
  return ctx;
}
