/**
 * Upload queue for anonymous scan results. Nothing is queued unless the
 * farmer agreed to share. Matches backend/app/schemas.py.
 */

import type { Scan } from './history';

export type PendingScan = {
  scan_id: string;
  predicted_class: string;
  confidence: number;
  correct: boolean | null;
  model_version: string;
  app_version: string;
  scanned_at: string;
};

export const BATCH_SIZE = 50;

/** Scan time rounded down to the hour, in UTC, so uploads carry no precise timestamp. */
export function hourOf(iso: string): string {
  const d = new Date(iso);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
}

export function toPending(scan: Scan, appVersion: string): PendingScan {
  return {
    scan_id: scan.id,
    predicted_class: scan.label,
    confidence: Math.round(scan.confidence * 1000) / 1000,
    correct: scan.answer === null ? null : scan.answer === 'yes',
    model_version: scan.modelVersion,
    app_version: appVersion,
    scanned_at: hourOf(scan.createdAt),
  };
}

/** Add or replace by scan_id, so a later answer replaces the unanswered copy. */
export function enqueue(queue: PendingScan[], item: PendingScan): PendingScan[] {
  return [...queue.filter((q) => q.scan_id !== item.scan_id), item];
}

type FetchFn = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ status: number }>;

/**
 * Send the queue in batches. Returns what is still left to send.
 * Network errors and 5xx / 429 keep the batch for later. Other 4xx answers
 * mean the server will never accept it, so it is dropped instead of blocking
 * the queue forever.
 */
export async function flush(
  queue: PendingScan[],
  opts: { apiUrl: string; installId: string; fetchFn: FetchFn },
): Promise<PendingScan[]> {
  let remaining = queue;
  while (remaining.length > 0) {
    const batch = remaining.slice(0, BATCH_SIZE);
    let status: number;
    try {
      const res = await opts.fetchFn(`${opts.apiUrl.replace(/\/+$/, '')}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ install_id: opts.installId, scans: batch }),
      });
      status = res.status;
    } catch {
      return remaining;
    }
    if (status >= 500 || status === 429) return remaining;
    remaining = remaining.slice(batch.length);
  }
  return remaining;
}
