/*
 * Audio the user supplied themselves.
 *
 * The file comes from the phone's own picker and never leaves it, so this adds
 * real recorded sound without a single network call — CLAUDE.md rule 5 holds.
 * It also puts the licensing question where it belongs: whatever you are
 * entitled to play, you can play. The app ships no audio and makes no claim
 * about yours.
 *
 * IndexedDB rather than localStorage, which is a ~5MB string store and cannot
 * hold a blob at all.
 */

import type { TrackAnalysis } from './analyse';
import { analyse } from './analyse';

const DB_NAME = 'ridge-audio';
const STORE = 'tracks';

export interface Track extends TrackMeta {
  blob: Blob;
}

export interface TrackMeta {
  id: string;
  /** The filename, cleaned up. What the picker shows. */
  name: string;
  bytes: number;
  addedAt: string;
  /**
   * Free text, typed by the user at import. Deliberately not an enum: the
   * categories worth having are the ones whose music you actually own, and
   * that is not a list this file can guess.
   */
  category?: string;
  /** Absent when the file could not be decoded; playback then just loops it. */
  analysis?: TrackAnalysis;
  /**
   * The catalogue row this came from, when it was downloaded rather than
   * picked off the device. Lets the Library show what is already here and stops
   * a second tap producing a duplicate.
   */
  remoteId?: string;
}

/** Trimmed, lowercased, capped — so "  Medieval " and "medieval" are one thing. */
export function normaliseCategory(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').slice(0, 32);
}

export const UNCATEGORISED = 'Uncategorised';

export function categoryOf(track: TrackMeta): string {
  const c = track.category?.trim();
  return c && c.length > 0 ? c : UNCATEGORISED;
}

/** Categories that actually have tracks, in the order they were first used. */
export function categoriesOf(tracks: TrackMeta[]): string[] {
  const seen = new Map<string, string>();
  for (const t of tracks) {
    const label = categoryOf(t);
    const key = label.toLowerCase();
    if (!seen.has(key)) seen.set(key, label);
  }
  return [...seen.values()];
}

export function tracksIn(tracks: TrackMeta[], category: string): TrackMeta[] {
  const key = category.toLowerCase();
  return (
    tracks
      .filter((t) => categoryOf(t).toLowerCase() === key)
      // Busiest first, calmest last: the quietest music then lands on the spine
      // block at the end of the session. Ordering by anything else — filename,
      // import time — would be arbitrary, which is the thing to avoid.
      .sort((a, b) => (b.analysis?.busyness ?? 0.5) - (a.analysis?.busyness ?? 0.5))
  );
}

/**
 * 80MB. Roughly an hour at 192kbps, so a long mix fits, while a mis-picked
 * video file is still refused rather than quietly eating the storage quota.
 */
export const MAX_TRACK_BYTES = 80 * 1024 * 1024;

/**
 * Above this, analysis is skipped and the file simply loops.
 *
 * Not a storage limit — a memory one. Analysis decodes the file, and even at
 * mono 8kHz an hour-long track is well over a hundred megabytes of samples
 * while it runs. A phone will not thank you for that, and the file is perfectly
 * playable without it. Several shorter tracks in one category beat one long
 * one anyway: they all get analysed, and the collection can order them.
 *
 * 50MB is roughly an hour at 128kbps, which decodes to about 100MB of samples
 * for the second or two this runs. Past that the transient is not worth it, and
 * a file that long outlasts any session anyway — its loop points would never be
 * reached.
 */
export const MAX_ANALYSE_BYTES = 50 * 1024 * 1024;

/*
 * Anything holding a list of tracks needs to know when the set changes.
 *
 * Two screens read it — the picker and the library — and a download made in one
 * has to appear in the other without leaving and coming back. Each reads on
 * mount and then on notification; a store this small does not need anything
 * more than that.
 */
const listeners = new Set<() => void>();

export function onTracksChanged(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function notifyChanged() {
  for (const fn of [...listeners]) {
    try {
      fn();
    } catch {
      /* a listener throwing must not stop the others */
    }
  }
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
      }),
  );
}

/** Strips the extension and tidies separators — filenames are rarely readable. */
function tidy(filename: string): string {
  const base = filename.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim();
  return (base || 'Untitled').slice(0, 60);
}

export class TrackTooLarge extends Error {
  constructor(public bytes: number) {
    super('Track too large');
  }
}

export async function addTrack(file: File, category?: string): Promise<TrackMeta> {
  if (file.size > MAX_TRACK_BYTES) throw new TrackTooLarge(file.size);
  // The one and only decode. Failure is not fatal — an unreadable or oversized
  // file still imports and simply plays start to end.
  const analysis = file.size <= MAX_ANALYSE_BYTES ? await analyse(file) : null;
  const label = category ? normaliseCategory(category) : '';
  const meta: TrackMeta = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: tidy(file.name),
    bytes: file.size,
    addedAt: new Date().toISOString(),
    ...(label ? { category: label } : {}),
    ...(analysis ? { analysis } : {}),
  };
  // The File itself is a Blob; storing it directly avoids reading 40MB into a
  // string and back.
  await run('readwrite', (s) => s.put({ ...meta, blob: file } satisfies Track));
  notifyChanged();
  return meta;
}

/**
 * Store bytes that did not come from the file picker — today, a library
 * download. Shares the id, the size guard, the decode and the write with
 * addTrack(); only the origin of the bytes differs.
 */
export async function addBlob(
  blob: Blob,
  meta: { title: string; category?: string; remoteId?: string; analysis?: TrackAnalysis },
): Promise<TrackMeta> {
  if (blob.size > MAX_TRACK_BYTES) throw new TrackTooLarge(blob.size);
  // A catalogue that already carries the analysis saves this device the decode
  // entirely — that is the whole reason the column exists.
  const analysis =
    meta.analysis ?? (blob.size <= MAX_ANALYSE_BYTES ? await analyse(blob) : null);
  const label = meta.category ? normaliseCategory(meta.category) : '';
  const record: TrackMeta = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: meta.title.slice(0, 60) || 'Untitled',
    bytes: blob.size,
    addedAt: new Date().toISOString(),
    ...(label ? { category: label } : {}),
    ...(analysis ? { analysis } : {}),
    ...(meta.remoteId ? { remoteId: meta.remoteId } : {}),
  };
  await run('readwrite', (s) => s.put({ ...record, blob } satisfies Track));
  notifyChanged();
  return record;
}

export async function listTracks(): Promise<TrackMeta[]> {
  try {
    const all = await run<Track[]>('readonly', (s) => s.getAll());
    return all
      .map(({ blob: _blob, ...meta }) => meta)
      .sort((a, b) => a.addedAt.localeCompare(b.addedAt));
  } catch {
    // Private mode, blocked storage, a browser without IndexedDB. The app has
    // to keep working with no tracks rather than fail to render.
    return [];
  }
}

export async function getTrack(id: string): Promise<Track | null> {
  try {
    return (await run<Track | undefined>('readonly', (s) => s.get(id))) ?? null;
  } catch {
    return null;
  }
}

export async function setCategory(id: string, category: string): Promise<void> {
  try {
    const track = await getTrack(id);
    if (!track) return;
    const label = normaliseCategory(category);
    const { category: _old, ...rest } = track;
    await run('readwrite', (s) => s.put(label ? { ...rest, category: label } : rest));
    notifyChanged();
  } catch {
    /* no-op */
  }
}

export async function removeTrack(id: string): Promise<void> {
  try {
    await run('readwrite', (s) => s.delete(id));
    notifyChanged();
  } catch {
    /* no-op */
  }
}

/** Total stored, so "how much room am I using" is answerable from the phone. */
export async function totalBytes(): Promise<number> {
  const all = await listTracks();
  return all.reduce((n, t) => n + t.bytes, 0);
}

export function humanBytes(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
