import { Check, Church, CloudRain, Flame, ListMusic, Music, Plus, Trash2, Trees, Volume2, VolumeX, Waves, Wind } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { AmbientKind, SynthKind } from '../lib/ambient';
import { AMBIENT_KINDS, forgetTrack, startAmbient, THEMES } from '../lib/ambient';
import {
  addTrack,
  categoriesOf,
  categoryOf,
  humanBytes,
  listTracks,
  MAX_TRACK_BYTES,
  removeTrack,
  setCategory,
  TrackTooLarge,
  tracksIn,
  type TrackMeta,
} from '../lib/tracks';
import { useApp } from '../state/AppStateContext';
import { haptic, HAPTIC } from '../lib/haptics';

/** Each soundtrack reads as itself in the list; a shared icon made the four
 *  look like one repeated row. */
const THEME_ICON: Record<string, typeof Waves> = {
  rainfall: Trees,
  shore: Waves,
  hearth: Flame,
  cloister: Church,
};

const ICON: Record<'off' | SynthKind, typeof Waves> = {
  off: VolumeX,
  rain: CloudRain,
  waves: Waves,
  wind: Wind,
  fire: Flame,
  drone: Volume2,
};

/**
 * Choosing the bed. Selection starts it playing straight away — picking a
 * soundscape you cannot hear is guesswork, and the tap is the user gesture iOS
 * needs to let audio run at all.
 *
 * `manage` adds importing and deleting, which belong in Settings; the sheet
 * shown mid-session only picks.
 */
export function AmbientPicker({ manage = false }: { manage?: boolean }) {
  const { state, updateSettings } = useApp();
  const chosen = state.settings.ambient;
  const [tracks, setTracks] = useState<TrackMeta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  // A batch, not one file: adding a series and being asked once per track
  // would be six prompts for six files.
  const [naming, setNaming] = useState<TrackMeta[] | null>(null);
  const [draft, setDraft] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const categories = categoriesOf(tracks);

  useEffect(() => {
    void listTracks().then(setTracks);
  }, []);

  const choose = (kind: AmbientKind) => {
    haptic(HAPTIC.tick);
    updateSettings({ ambient: kind });
    startAmbient(kind);
  };

  const onFile = async (file: File) => {
    setError(null);
    setPending(file.name);
    try {
      const meta = await addTrack(file);
      setTracks(await listTracks());
      // Straight into naming: a file tagged at import is one you never have to
      // come back and organise.
      setNaming((batch) => [...(batch ?? []), meta]);
    } catch (e) {
      setError(
        e instanceof TrackTooLarge
          ? `That file is ${humanBytes(e.bytes)}. The limit is ${humanBytes(MAX_TRACK_BYTES)} — several shorter tracks in one category work better than one long one anyway.`
          : 'That file could not be stored. Nothing was changed.',
      );
    } finally {
      setPending(null);
    }
  };

  const assign = async (batch: TrackMeta[], category: string) => {
    for (const t of batch) await setCategory(t.id, category);
    setTracks(await listTracks());
    setNaming(null);
    setDraft('');
    if (batch.length > 0) choose(`cat:${category.trim()}`);
  };

  const drop = async (meta: TrackMeta) => {
    haptic(HAPTIC.tick);
    await removeTrack(meta.id);
    forgetTrack(meta.id);
    if (chosen === `track:${meta.id}`) updateSettings({ ambient: 'off' });
    setTracks(await listTracks());
  };

  const off = AMBIENT_KINDS[0];
  const beds = AMBIENT_KINDS.slice(1);

  return (
    <div className="space-y-2">
      {off && (
        <Tile
          label={off.label}
          note={off.note}
          icon={<VolumeX size={18} />}
          active={chosen === 'off'}
          onPick={() => choose('off')}
        />
      )}

      <Group title="Soundtracks" hint="They follow the session">
        <div className="space-y-1.5">
          {THEMES.map((t) => {
            const Icon = THEME_ICON[t.id] ?? Waves;
            return (
              <Tile
                key={t.id}
                label={t.label}
                note={t.note}
                icon={<Icon size={18} />}
                active={chosen === t.id}
                onPick={() => choose(t.id)}
              />
            );
          })}
        </div>
      </Group>

      <Group title="Constant beds" hint="One texture, unchanging">
      <div className="grid grid-cols-2 gap-2">
        {beds.map((kind) => {
          const Icon = ICON[kind.id];
          const active = kind.id === chosen;
          return (
            <button
              key={kind.id}
              type="button"
              onClick={() => choose(kind.id)}
              aria-pressed={active}
              className={[
                'flex items-center gap-2.5 rounded-card border px-3 py-3 text-left transition-colors',
                active
                  ? 'border-accent/60 bg-accent/[0.08]'
                  : 'border-line/60 bg-raised/40 active:bg-raised',
              ].join(' ')}
            >
              <Icon size={18} className={active ? 'text-accent' : 'text-faint'} />
              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate text-sm font-medium ${active ? 'text-ink' : 'text-muted'}`}
                >
                  {kind.label}
                </span>
                <span className="block truncate text-xs text-faint">{kind.note}</span>
              </span>
              {active && <Check size={15} className="shrink-0 text-accent" />}
            </button>
          );
        })}
      </div>
      </Group>

      {categories.length > 0 && (
        <Group title="Collections" hint="Played through, calmest last">
          <div className="space-y-1.5">
            {categories.map((name) => {
              const inIt = tracksIn(tracks, name);
              const active = chosen === `cat:${name}`;
              return (
                <Tile
                  key={name}
                  label={name}
                  note={`${inIt.length} track${inIt.length === 1 ? '' : 's'} · ${humanBytes(
                    inIt.reduce((n, t) => n + t.bytes, 0),
                  )}`}
                  icon={<ListMusic size={18} />}
                  active={active}
                  onPick={() => choose(`cat:${name}`)}
                />
              );
            })}
          </div>
        </Group>
      )}

      {tracks.length > 0 && (
        <div className="space-y-1.5 pt-1">
          {tracks.map((t) => {
            const active = chosen === `track:${t.id}`;
            return (
              <div
                key={t.id}
                className={[
                  'flex items-center gap-2.5 rounded-card border pl-3 transition-colors',
                  active ? 'border-accent/60 bg-accent/[0.08]' : 'border-line/60 bg-raised/40',
                ].join(' ')}
              >
                <button
                  type="button"
                  onClick={() => choose(`track:${t.id}`)}
                  aria-pressed={active}
                  className="flex min-w-0 flex-1 items-center gap-2.5 py-3 text-left"
                >
                  <Music size={18} className={active ? 'text-accent' : 'text-faint'} />
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-sm font-medium ${active ? 'text-ink' : 'text-muted'}`}
                    >
                      {t.name}
                    </span>
                    <span className="block truncate text-xs text-faint">
                      {categoryOf(t)} · {humanBytes(t.bytes)}
                      {t.analysis ? '' : ' · not analysed'}
                    </span>
                  </span>
                  {active && <Check size={15} className="shrink-0 text-accent" />}
                </button>
                {manage && (
                  <button
                    type="button"
                    onClick={() => {
                      setNaming([t]);
                      setDraft(t.category ?? '');
                    }}
                    aria-label={`Set category for ${t.name}`}
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-faint active:bg-raised"
                  >
                    <ListMusic size={16} />
                  </button>
                )}
                {manage && (
                  <button
                    type="button"
                    onClick={() => void drop(t)}
                    aria-label={`Remove ${t.name}`}
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-faint active:bg-raised"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {manage && naming && (
        <div className="rounded-card border border-accent/50 bg-accent/[0.06] p-3">
          <p className="text-sm font-medium text-ink">
            {naming.length === 1
              ? `Category for “${naming[0]?.name ?? ''}”`
              : `Category for ${naming.length} tracks`}
          </p>
          <p className="mt-0.5 text-xs text-faint">
            Type a new one or tap an existing. Tracks in a category play through in order, busiest
            first.
          </p>
          {categories.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => void assign(naming, c)}
                  className="h-9 rounded-full bg-raised px-3 text-xs font-semibold text-muted active:opacity-80"
                >
                  {c}
                </button>
              ))}
            </div>
          )}
          <div className="mt-2 flex gap-2">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && draft.trim()) void assign(naming, draft);
                if (e.key === 'Escape') setNaming(null);
              }}
              placeholder="Medieval, Chillstep, Classical…"
              className="h-11 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none placeholder:text-faint/70 focus:border-accent/60"
            />
            <button
              type="button"
              onClick={() => void assign(naming, draft)}
              disabled={!draft.trim()}
              className="h-11 shrink-0 rounded-lg bg-accent px-4 text-sm font-semibold text-base disabled:opacity-40"
            >
              Save
            </button>
          </div>
          <button
            type="button"
            onClick={() => setNaming(null)}
            className="mt-1.5 h-9 text-xs font-medium text-faint"
          >
            Skip for now
          </button>
        </div>
      )}

      {manage && (
        <>
          <button
            type="button"
            disabled={pending !== null}
            onClick={() => fileInput.current?.click()}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-card border border-dashed border-line text-sm font-medium text-muted active:bg-raised"
          >
            <Plus size={16} />
            {pending ? `Reading ${pending}…` : 'Add your own'}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="audio/*"
            className="hidden"
            multiple
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              e.target.value = '';
              // Sequentially: each import decodes, and running several decodes
              // at once is what would actually exhaust memory.
              void files.reduce<Promise<void>>(
                (chain, f) => chain.then(() => onFile(f)),
                Promise.resolve(),
              );
            }}
          />
          {error && <p className="px-1 text-xs leading-relaxed text-danger">{error}</p>}
        </>
      )}
    </div>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="pt-1">
      <div className="mb-1.5 flex items-baseline justify-between gap-2 px-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-faint">{title}</h3>
        {hint && <span className="truncate text-[11px] text-faint/80">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function Tile({
  label,
  note,
  icon,
  active,
  onPick,
}: {
  label: string;
  note: string;
  icon: ReactNode;
  active: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={active}
      className={[
        'flex w-full items-center gap-2.5 rounded-card border px-3 py-3 text-left transition-colors',
        active ? 'border-accent/60 bg-accent/[0.08]' : 'border-line/60 bg-raised/40 active:bg-raised',
      ].join(' ')}
    >
      <span className={active ? 'text-accent' : 'text-faint'}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm font-medium ${active ? 'text-ink' : 'text-muted'}`}>
          {label}
        </span>
        <span className="block truncate text-xs text-faint">{note}</span>
      </span>
      {active && <Check size={15} className="shrink-0 text-accent" />}
    </button>
  );
}
