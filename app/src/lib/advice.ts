export type Language = 'hi' | 'en';

export type AdviceText = { name: string; steps: string[] };

export type AdviceEntry = {
  crop: 'tomato' | 'potato' | 'maize';
  healthy: boolean;
  en: AdviceText;
  hi: AdviceText;
};

export type Advice = {
  version: number;
  review: { reviewed: boolean; reviewer: string; date: string; notes: string };
  sources: string[];
  classes: Record<string, AdviceEntry>;
};

export function isCompleteAdvice(advice: unknown, labels: string[]): advice is Advice {
  const a = advice as Partial<Advice> | null;
  if (!a || typeof a.version !== 'number' || !a.review || !a.classes) return false;
  return labels.every((label) => {
    const e = a.classes?.[label];
    return !!e && !!e.en?.name && !!e.hi?.name && (e.en.steps?.length ?? 0) > 0 && (e.hi.steps?.length ?? 0) > 0;
  });
}

/**
 * Use downloaded advice only if it is newer, complete and expert-reviewed;
 * otherwise keep the copy bundled with the app.
 */
export function pickAdvice(bundled: Advice, downloaded: unknown, labels: string[]): Advice {
  if (isCompleteAdvice(downloaded, labels) && downloaded.version > bundled.version && downloaded.review.reviewed && downloaded.review.reviewer) {
    return downloaded;
  }
  return bundled;
}

type GetFn = (url: string) => Promise<{ status: number; json: () => Promise<unknown> }>;

/** Download newer advice from the backend, or return null if there is none. */
export async function fetchNewerAdvice(apiUrl: string, current: number, getFn: GetFn): Promise<unknown | null> {
  const base = apiUrl.replace(/\/+$/, '');
  const v = await getFn(`${base}/advice/version`);
  if (v.status !== 200) return null;
  const { version } = (await v.json()) as { version?: number };
  if (typeof version !== 'number' || version <= current) return null;
  const a = await getFn(`${base}/advice`);
  return a.status === 200 ? a.json() : null;
}
