/*
 * The remote catalogue.
 *
 * The one place in Ridge that touches the network, and it does so only when you
 * tap something on the Library screen. Nothing here runs during a session:
 * a track is downloaded once, stored in IndexedDB, and from that moment is
 * indistinguishable from a file picked off the phone. See CLAUDE.md rule 5.
 *
 * Raw fetch rather than the Supabase SDK. Three endpoints do not justify a
 * client library, and the dependency cap stands.
 */

import type { TrackAnalysis } from './analyse';

export interface LibraryCredentials {
  /** Project URL, e.g. https://abcdefg.supabase.co */
  url: string;
  /** Anon key. A password in practice — see supabase/schema.sql. */
  key: string;
}

export interface RemoteTrack {
  id: string;
  title: string;
  category: string;
  licence: string;
  storagePath: string;
  bytes: number;
  durationSec: number | null;
  analysis: TrackAnalysis | null;
}

export class LibraryError extends Error {}

/** Trailing slashes and a pasted `/rest/v1` are both common; normalise both. */
export function normaliseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
}

export function credentialsLook(creds: unknown): creds is LibraryCredentials {
  if (typeof creds !== 'object' || creds === null) return false;
  const c = creds as Partial<LibraryCredentials>;
  return (
    typeof c.url === 'string' &&
    /^https:\/\/[\w.-]+/.test(c.url) &&
    typeof c.key === 'string' &&
    c.key.length >= 20
  );
}

function headers(creds: LibraryCredentials): HeadersInit {
  return { apikey: creds.key, Authorization: `Bearer ${creds.key}` };
}

/**
 * Turn whatever went wrong into something a person can act on. A blank screen
 * or "TypeError: failed to fetch" tells you nothing about which of the four
 * likely causes it was, and this runs on a phone with no console.
 */
function explain(status: number, body: string): string {
  if (status === 401 || status === 403) {
    return 'That key was refused. Check it is the anon key, and that schema.sql has been run.';
  }
  if (status === 404) {
    return 'No `tracks` table found. Run supabase/schema.sql in the SQL editor first.';
  }
  if (status === 0) {
    return 'Could not reach the project. Check the URL, and that you are online.';
  }
  return `The project answered ${status}. ${body.slice(0, 120)}`;
}

async function get(creds: LibraryCredentials, path: string): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${creds.url}${path}`, { headers: headers(creds) });
  } catch {
    // A CORS rejection and a dead network are indistinguishable from here;
    // both land as a thrown TypeError with no detail.
    throw new LibraryError(explain(0, ''));
  }
  if (!res.ok) throw new LibraryError(explain(res.status, await res.text().catch(() => '')));
  return res;
}

function coerce(row: unknown): RemoteTrack | null {
  if (typeof row !== 'object' || row === null) return null;
  const r = row as Record<string, unknown>;
  if (typeof r.id !== 'string' || typeof r.storage_path !== 'string') return null;
  return {
    id: r.id,
    title: typeof r.title === 'string' && r.title ? r.title : r.storage_path,
    category: typeof r.category === 'string' && r.category ? r.category : 'Uncategorised',
    licence: typeof r.licence === 'string' ? r.licence : '',
    storagePath: r.storage_path,
    bytes: typeof r.bytes === 'number' ? r.bytes : 0,
    durationSec: typeof r.duration_sec === 'number' ? r.duration_sec : null,
    // Trusted only as far as its shape; a malformed blob just means this
    // device decodes the file itself, which is the pre-existing path.
    analysis:
      typeof r.analysis === 'object' && r.analysis !== null
        ? (r.analysis as TrackAnalysis)
        : null,
  };
}

/** Fetch the catalogue. Doubles as the credential check on first connect. */
export async function fetchCatalogue(creds: LibraryCredentials): Promise<RemoteTrack[]> {
  const res = await get(creds, '/rest/v1/tracks?select=*&order=category.asc,title.asc');
  const body: unknown = await res.json().catch(() => null);
  if (!Array.isArray(body)) throw new LibraryError('The catalogue came back in a shape I cannot read.');
  return body.map(coerce).filter((t): t is RemoteTrack => t !== null);
}

/** Download one track's bytes. */
export async function fetchAudio(
  creds: LibraryCredentials,
  track: RemoteTrack,
): Promise<Blob> {
  // Encode each segment separately: the bucket name and the filename are
  // separated by a slash that must survive, and filenames routinely contain
  // spaces.
  const path = track.storagePath.split('/').map(encodeURIComponent).join('/');
  const res = await get(creds, `/storage/v1/object/${path}`);
  return res.blob();
}

/**
 * Hand the analysis back so no other device has to decode this file. Failure is
 * deliberately silent: the download already succeeded and the track already
 * works locally, so a write-back problem is not worth an error in the user's
 * face.
 */
export async function pushAnalysis(
  creds: LibraryCredentials,
  id: string,
  analysis: TrackAnalysis,
  durationSec: number,
): Promise<void> {
  try {
    await fetch(`${creds.url}/rest/v1/tracks?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: {
        ...headers(creds),
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ analysis, duration_sec: durationSec }),
    });
  } catch {
    /* no-op */
  }
}
