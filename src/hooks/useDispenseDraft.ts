/**
 * useDispenseDraft
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages "live-save" drafts for the Dispense form using IndexedDB.
 *
 * Key design decisions:
 *  - Uses IndexedDB (not localStorage) — no 5 MB cap, survives tab crashes.
 *  - Draft keys are namespaced by userId to prevent cross-user leakage.
 *  - Auto-saves on every state change (debounced 800 ms to avoid write storms).
 *  - Draft is cleared immediately & atomically on successful submit.
 *  - Restore is always gated behind a user-visible prompt (never silent).
 */

import { useEffect, useRef, useCallback } from 'react';

// ── IndexedDB helpers ────────────────────────────────────────────────────────

const DB_NAME  = 'rkhstock_drafts';
const DB_VER   = 1;
const STORE    = 'dispense_drafts';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror   = () => reject(req.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).delete(key);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

// ── Draft shape ──────────────────────────────────────────────────────────────

export interface DispenseDraftPayload {
  warehouseId: string;
  toWarehouseId: string;
  actorId: string;
  docDate: string;
  headerNote: string;
  rows: unknown[];         // serialised DispenseRow[] (opaque to this hook)
}

interface DraftRecord {
  savedAt: string;         // ISO timestamp
  payload: DispenseDraftPayload;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

interface Options {
  userId: string | null;    // null = not yet logged-in, draft ops are no-ops
  docDate: string;          // used to construct key, e.g. "2026-06-14"
  debounceMs?: number;      // default 800
}

interface UseDraftReturn {
  /** Call after every form state change to schedule an auto-save. */
  scheduleSave: (payload: DispenseDraftPayload) => void;
  /** Check IDB for an existing draft and return it; null if nothing found. */
  loadDraft: () => Promise<DraftRecord | null>;
  /** Permanently remove the draft — call immediately after a successful submit. */
  clearDraft: () => Promise<void>;
  /** The IDB key used for this session (useful for debugging). */
  draftKey: string | null;
}

export function useDispenseDraft({ userId, docDate, debounceMs = 800 }: Options): UseDraftReturn {
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Key pattern: dispense_draft_{userId}_{YYYYMMDD}
  // Each calendar-day gets its own slot so drafts don't bleed across shifts.
  const draftKey = userId ? `dispense_draft_${userId}_${docDate.replace(/-/g, '')}` : null;

  /** Debounced auto-save to IndexedDB. */
  const scheduleSave = useCallback((payload: DispenseDraftPayload) => {
    if (!draftKey) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const record: DraftRecord = {
          savedAt: new Date().toISOString(),
          payload,
        };
        await idbSet(draftKey, record);
      } catch (err) {
        // Silent fail — auto-save is best-effort, never block the user.
        console.warn('[Draft] Auto-save failed:', err);
      }
    }, debounceMs);
  }, [draftKey, debounceMs]);

  /** Load the latest draft for this key. Returns null if nothing stored. */
  const loadDraft = useCallback(async (): Promise<DraftRecord | null> => {
    if (!draftKey) return null;
    try {
      const record = await idbGet<DraftRecord>(draftKey);
      return record ?? null;
    } catch (err) {
      console.warn('[Draft] Load failed:', err);
      return null;
    }
  }, [draftKey]);

  /** Clear draft — MUST be called immediately after a successful submit. */
  const clearDraft = useCallback(async () => {
    if (!draftKey) return;
    try {
      await idbDelete(draftKey);
    } catch (err) {
      console.warn('[Draft] Clear failed:', err);
    }
  }, [draftKey]);

  // Cleanup pending timer on unmount.
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return { scheduleSave, loadDraft, clearDraft, draftKey };
}

// ── Timestamp formatter (Thai locale) ────────────────────────────────────────

export function formatDraftTimestamp(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleString('th-TH', {
      day:    'numeric',
      month:  'long',
      year:   'numeric',
      hour:   '2-digit',
      minute: '2-digit',
    }) + ' น.';
  } catch {
    return isoString;
  }
}
