import { useEffect, useState } from 'react';
import type { Block } from '../types';
import type { AmbientKind } from '../lib/ambient';
import { AMBIENT_KINDS, THEMES } from '../lib/ambient';
import { BLOCK_LABEL } from '../data/sessions';
import { categoriesOf, listTracks, type TrackMeta } from '../lib/tracks';
import { useApp } from '../state/AppStateContext';
import { haptic, HAPTIC } from '../lib/haptics';

const BLOCKS: Block[] = ['warmup', 'main', 'spine', 'mobility'];

const BLOCK_DOT: Record<Block, string> = {
  warmup: 'bg-warmup',
  main: 'bg-main',
  spine: 'bg-spine',
  mobility: 'bg-mobility',
};

/**
 * Different music for different parts of a session.
 *
 * The main block can carry more weight than the spine block wants — heavier
 * lifting and floor work at 22:00 are not the same room. One choice for a whole
 * session cannot express that.
 *
 * Behind a disclosure because it is genuinely optional: anything left unset
 * follows the session-wide choice, so this costs nothing until it is used.
 */
export function BlockAmbient() {
  const { state, updateSettings } = useApp();
  const [tracks, setTracks] = useState<TrackMeta[]>([]);

  useEffect(() => {
    void listTracks().then(setTracks);
  }, []);

  const set = (block: Block, kind: AmbientKind | null) => {
    haptic(HAPTIC.tick);
    const next = { ...state.settings.ambientByBlock };
    if (kind === null) delete next[block];
    else next[block] = kind;
    updateSettings({ ambientByBlock: next });
  };

  const options: Array<{ id: AmbientKind; label: string }> = [
    ...THEMES.map((t) => ({ id: t.id as AmbientKind, label: t.label })),
    ...categoriesOf(tracks).map((c) => ({ id: `cat:${c}` as AmbientKind, label: c })),
    ...AMBIENT_KINDS.filter((k) => k.id !== 'off').map((k) => ({
      id: k.id as AmbientKind,
      label: k.label,
    })),
  ];

  const used = Object.keys(state.settings.ambientByBlock).length;

  return (
    <details className="border-t border-line/50">
      <summary className="flex h-14 cursor-pointer list-none items-center justify-between px-4 text-sm font-medium text-ink [&::-webkit-details-marker]:hidden">
        Different per block
        <span className="text-xs text-faint">{used === 0 ? 'Off' : `${used} set`}</span>
      </summary>

      <div className="space-y-3 px-4 pb-4">
        {BLOCKS.map((block) => {
          const chosen = state.settings.ambientByBlock[block];
          return (
            <div key={block}>
              <div className="mb-1.5 flex items-center gap-2">
                <span className={`h-2.5 w-1 rounded-full ${BLOCK_DOT[block]}`} aria-hidden="true" />
                <span className="text-xs font-semibold uppercase tracking-wider text-faint">
                  {BLOCK_LABEL[block]}
                </span>
              </div>
              {/* Scrolls rather than wrapping: four wrapped rows of chips would
                  make this section taller than the rest of Settings combined. */}
              <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
                <Chip label="Same" active={chosen === undefined} onPick={() => set(block, null)} />
                <Chip
                  label="Silence"
                  active={chosen === 'off'}
                  onPick={() => set(block, 'off')}
                />
                {options.map((o) => (
                  <Chip
                    key={o.id}
                    label={o.label}
                    active={chosen === o.id}
                    onPick={() => set(block, o.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}

function Chip({
  label,
  active,
  onPick,
}: {
  label: string;
  active: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={active}
      className={[
        'h-9 shrink-0 whitespace-nowrap rounded-full px-3 text-xs font-semibold transition-colors',
        active ? 'bg-accent text-base' : 'bg-raised text-muted active:opacity-80',
      ].join(' ')}
    >
      {label}
    </button>
  );
}
