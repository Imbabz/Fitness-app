import { AlertTriangle, Check, Cloud, Download, Eye, EyeOff, Loader, Unplug } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  fetchAudio,
  fetchCatalogue,
  LibraryError,
  normaliseUrl,
  pushAnalysis,
  type LibraryCredentials,
  type RemoteTrack,
} from '../lib/library';
import {
  addBlob,
  humanBytes,
  listTracks,
  onTracksChanged,
  TrackTooLarge,
  type TrackMeta,
} from '../lib/tracks';
import { useApp } from '../state/AppStateContext';
import { haptic, HAPTIC } from '../lib/haptics';

/**
 * The one screen in Ridge that goes to the network, and only when tapped.
 *
 * A track downloaded here is written to IndexedDB and is from that moment
 * indistinguishable from one picked off the phone: same analysis, same
 * collections, same offline guarantee. Nothing on this screen runs during a
 * session. See CLAUDE.md rule 5.
 */
export function Library() {
  const { state, updateSettings } = useApp();
  const creds = state.settings.library;

  const [url, setUrl] = useState(creds?.url ?? '');
  const [key, setKey] = useState(creds?.key ?? '');
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remote, setRemote] = useState<RemoteTrack[] | null>(null);
  const [local, setLocal] = useState<TrackMeta[]>([]);
  const [pulling, setPulling] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => void listTracks().then(setLocal);
    refresh();
    return onTracksChanged(refresh);
  }, []);

  const load = useCallback(async (c: LibraryCredentials) => {
    setBusy(true);
    setError(null);
    try {
      setRemote(await fetchCatalogue(c));
    } catch (e) {
      setRemote(null);
      setError(e instanceof LibraryError ? e.message : 'Could not read the catalogue.');
    } finally {
      setBusy(false);
    }
  }, []);

  // Reconnect on open when credentials are already stored, so the catalogue is
  // there without a tap. Failure is silent here: being offline is normal and
  // is not an error worth shouting about on a screen you may be passing through.
  useEffect(() => {
    if (creds) void load(creds);
  }, [creds, load]);

  const connect = async () => {
    haptic(HAPTIC.tick);
    const next: LibraryCredentials = { url: normaliseUrl(url), key: key.trim() };
    setBusy(true);
    setError(null);
    try {
      setRemote(await fetchCatalogue(next));
      updateSettings({ library: next });
    } catch (e) {
      setError(e instanceof LibraryError ? e.message : 'Could not connect.');
    } finally {
      setBusy(false);
    }
  };

  const disconnect = () => {
    haptic(HAPTIC.tick);
    updateSettings({ library: null });
    setRemote(null);
    setKey('');
    setError(null);
  };

  const download = async (track: RemoteTrack) => {
    if (!creds || pulling) return;
    haptic(HAPTIC.tick);
    setPulling(track.id);
    setError(null);
    try {
      const blob = await fetchAudio(creds, track);
      const saved = await addBlob(blob, {
        title: track.title,
        category: track.category,
        remoteId: track.id,
        ...(track.analysis ? { analysis: track.analysis } : {}),
      });
      // Hand the analysis back so the next device skips the decode. Only when
      // this device is the one that computed it.
      if (!track.analysis && saved.analysis) {
        void pushAnalysis(creds, track.id, saved.analysis, saved.analysis.durationSec);
      }
    } catch (e) {
      setError(
        e instanceof TrackTooLarge
          ? `That track is ${humanBytes(e.bytes)}, over the per-file limit.`
          : e instanceof LibraryError
            ? e.message
            : 'That download failed. Nothing was changed.',
      );
    } finally {
      setPulling(null);
    }
  };

  const have = new Set(local.map((t) => t.remoteId).filter(Boolean));

  if (!creds) {
    return (
      <div className="space-y-3 p-3">
        <p className="text-xs leading-relaxed text-faint">
          Point Ridge at a Supabase project and its tracks become downloadable on any device. Run{' '}
          <code className="text-muted">supabase/schema.sql</code> in the SQL editor first.
        </p>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://yourproject.supabase.co"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          className="h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none placeholder:text-faint/70 focus:border-accent/60"
        />
        <div className="flex gap-2">
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="anon key"
            type={reveal ? 'text' : 'password'}
            autoCapitalize="off"
            autoCorrect="off"
            className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none placeholder:text-faint/70 focus:border-accent/60"
          />
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            aria-label={reveal ? 'Hide key' : 'Show key'}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-line text-muted active:bg-raised"
          >
            {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <button
          type="button"
          onClick={() => void connect()}
          disabled={busy || url.trim().length < 8 || key.trim().length < 20}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-card bg-accent text-sm font-semibold text-base disabled:opacity-40"
        >
          {busy ? <Loader size={16} className="animate-spin" /> : <Cloud size={16} />}
          {busy ? 'Connecting…' : 'Connect'}
        </button>
        {error && <Problem text={error} />}
        <p className="text-xs leading-relaxed text-faint">
          The anon key is a password for that bucket: anyone who has it can download your tracks. It
          is stored on this device only, is left out of exports, and must never be committed — this
          repository is public.
        </p>
      </div>
    );
  }

  const byCategory = new Map<string, RemoteTrack[]>();
  for (const t of remote ?? []) {
    byCategory.set(t.category, [...(byCategory.get(t.category) ?? []), t]);
  }

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-xs text-faint">
          {creds.url.replace(/^https:\/\//, '')}
        </span>
        <button
          type="button"
          onClick={disconnect}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-raised px-3 text-xs font-semibold text-muted active:opacity-80"
        >
          <Unplug size={13} />
          Disconnect
        </button>
      </div>

      {error && <Problem text={error} />}

      {busy && !remote && (
        <p className="flex items-center gap-2 py-2 text-sm text-muted">
          <Loader size={15} className="animate-spin" />
          Reading the catalogue…
        </p>
      )}

      {remote?.length === 0 && (
        <p className="text-sm leading-relaxed text-muted">
          Connected, but the catalogue is empty. Upload to the bucket and add a row to{' '}
          <code className="text-faint">tracks</code>.
        </p>
      )}

      {[...byCategory.entries()].map(([category, tracks]) => (
        <section key={category}>
          <h3 className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">
            {category}
          </h3>
          <div className="space-y-1.5">
            {tracks.map((t) => {
              const downloaded = have.has(t.id);
              return (
                <div
                  key={t.id}
                  className="flex items-center gap-3 rounded-card border border-line/60 bg-raised/40 px-3 py-2.5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-muted">{t.title}</span>
                    <span className="block truncate text-xs text-faint">
                      {t.bytes > 0 ? humanBytes(t.bytes) : 'unknown size'}
                      {t.licence ? ` · ${t.licence}` : ''}
                      {t.analysis ? ' · analysed' : ''}
                    </span>
                  </span>
                  {downloaded ? (
                    <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-accent">
                      <Check size={14} />
                      On device
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void download(t)}
                      disabled={pulling !== null}
                      aria-label={`Download ${t.title}`}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line text-muted active:bg-raised disabled:opacity-40"
                    >
                      {pulling === t.id ? (
                        <Loader size={16} className="animate-spin" />
                      ) : (
                        <Download size={16} />
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function Problem({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-2 rounded-lg bg-danger/[0.08] p-2.5 text-xs leading-relaxed text-muted">
      <AlertTriangle size={13} className="mt-0.5 shrink-0 text-danger" />
      {text}
    </p>
  );
}
