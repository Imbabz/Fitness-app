/*
 * Fetch a track by link, server-side, and file it in the bucket.
 *
 * This exists because the browser cannot do it. Pulling audio from an
 * arbitrary host into the page is blocked by CORS, and almost no music site
 * sends permissive headers — which is exactly why a plain "list of links"
 * would fail at the first fetch, silently. Deno has no such restriction.
 *
 * So adding a sound becomes pasting a URL, rather than: download it, move it to
 * a computer, upload it, write a row. That is the whole point.
 *
 * verify_jwt is off because the app calls this with the anon key, which is the
 * same credential that already reads the catalogue. The function's own guards —
 * https only, audio content-type only, size cap — are what stop it being a
 * general-purpose fetcher.
 *
 * Deploy:  supabase functions deploy ingest --project-ref <ref>
 */

const BUCKET = 'Musics';
/** Refuse anything that would be absurd as a single ambient track. */
const MAX_BYTES = 120 * 1024 * 1024;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const fail = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

/** Keep the extension, drop everything that would be awkward in a path. */
function safeName(url: string, contentType: string): string {
  let base = 'track';
  try {
    const last = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    if (last) base = last;
  } catch {
    /* keep the default */
  }
  base = base.replace(/[^\w.\- ]+/g, '').trim() || 'track';
  if (!/\.[A-Za-z0-9]{2,5}$/.test(base)) {
    const ext = contentType.includes('mpeg')
      ? '.mp3'
      : contentType.includes('wav')
        ? '.wav'
        : contentType.includes('ogg')
          ? '.ogg'
          : contentType.includes('mp4') || contentType.includes('m4a')
            ? '.m4a'
            : '.audio';
    base += ext;
  }
  // Distinct prefix so re-adding the same link never overwrites the original.
  return `${Date.now().toString(36)}-${base}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return fail(405, 'POST only.');

  const projectUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!projectUrl || !serviceKey) return fail(500, 'The function is missing its project keys.');

  let body: { url?: string; title?: string; category?: string; licence?: string };
  try {
    body = await req.json();
  } catch {
    return fail(400, 'That request was not JSON.');
  }

  const source = (body.url ?? '').trim();
  if (!/^https:\/\//i.test(source)) return fail(400, 'Give an https link to an audio file.');

  // ── Fetch it, and be strict about what came back ────────────────────────
  let upstream: Response;
  try {
    upstream = await fetch(source, { redirect: 'follow' });
  } catch {
    return fail(502, 'That link could not be reached.');
  }
  if (!upstream.ok) return fail(502, `That link answered ${upstream.status}.`);

  const contentType = (upstream.headers.get('content-type') ?? '').toLowerCase();
  if (!contentType.startsWith('audio/') && !contentType.includes('ogg')) {
    // A page rather than a file is the common mistake: someone pastes the link
    // to a track's *page* instead of the file. Saying so beats storing HTML.
    return fail(415, `That link returned ${contentType || 'no content type'}, not audio. Link the file itself, not the page it sits on.`);
  }

  const declared = Number(upstream.headers.get('content-length') ?? '0');
  if (declared > MAX_BYTES) return fail(413, 'That file is over 120 MB.');

  const bytes = new Uint8Array(await upstream.arrayBuffer());
  if (bytes.byteLength === 0) return fail(502, 'That link returned nothing.');
  if (bytes.byteLength > MAX_BYTES) return fail(413, 'That file is over 120 MB.');

  // ── Store it ────────────────────────────────────────────────────────────
  const name = safeName(source, contentType);
  const put = await fetch(`${projectUrl}/storage/v1/object/${BUCKET}/${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': contentType,
      'x-upsert': 'false',
    },
    body: bytes,
  });
  if (!put.ok) return fail(502, `Storage refused it (${put.status}).`);

  /*
   * The storage trigger has already created the row. This fills in what only
   * the caller knows — title, category, licence, where it came from — and is a
   * PATCH rather than an INSERT so the two cannot race into a duplicate.
   */
  const patch: Record<string, unknown> = {
    source_url: source,
    bytes: bytes.byteLength,
  };
  if (body.title?.trim()) patch.title = body.title.trim().slice(0, 120);
  if (body.category?.trim()) patch.category = body.category.trim().slice(0, 32);
  if (body.licence?.trim()) patch.licence = body.licence.trim().slice(0, 120);

  const path = `${BUCKET}/${name}`;
  const row = await fetch(
    `${projectUrl}/rest/v1/tracks?storage_path=eq.${encodeURIComponent(path)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(patch),
    },
  );

  // Storage succeeded, so the track exists either way; a failed patch only
  // means it is catalogued under its filename with no licence recorded.
  const saved = row.ok ? await row.json().catch(() => null) : null;

  return new Response(
    JSON.stringify({ ok: true, storagePath: path, bytes: bytes.byteLength, track: saved?.[0] ?? null }),
    { headers: { ...CORS, 'Content-Type': 'application/json' } },
  );
});
