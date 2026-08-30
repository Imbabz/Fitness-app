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
}

/**
 * 40MB. Comfortably holds an hour of ambience at a sane bitrate, and refuses a
 * mis-picked video file rather than quietly eating the storage quota.
 */
export const MAX_TRACK_BYTES = 40 * 1024 * 1024;

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

export async function addTrack(file: File): Promise<TrackMeta> {
  if (file.size > MAX_TRACK_BYTES) throw new TrackTooLarge(file.size);
  const meta: TrackMeta = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name: tidy(file.name),
    bytes: file.size,
    addedAt: new Date().toISOString(),
  };
  // The File itself is a Blob; storing it directly avoids reading 40MB into a
  // string and back.
  await run('readwrite', (s) => s.put({ ...meta, blob: file } satisfies Track));
  return meta;
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

export async function removeTrack(id: string): Promise<void> {
  try {
    await run('readwrite', (s) => s.delete(id));
  } catch {
    /* no-op */
  }
}

export function humanBytes(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
