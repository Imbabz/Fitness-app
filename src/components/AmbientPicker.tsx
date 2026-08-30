import { Check, CloudRain, Flame, Volume2, VolumeX, Waves, Wind } from 'lucide-react';
import type { AmbientKind } from '../lib/ambient';
import { AMBIENT_KINDS, startAmbient } from '../lib/ambient';
import { useApp } from '../state/AppStateContext';
import { haptic, HAPTIC } from '../lib/haptics';

const ICON: Record<AmbientKind, typeof Waves> = {
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
 * needs to let an AudioContext run at all.
 */
export function AmbientPicker() {
  const { state, updateSettings } = useApp();
  const chosen = state.settings.ambient;

  return (
    <div className="grid grid-cols-2 gap-2">
      {AMBIENT_KINDS.map((kind) => {
        const Icon = ICON[kind.id];
        const active = kind.id === chosen;
        return (
          <button
            key={kind.id}
            type="button"
            onClick={() => {
              haptic(HAPTIC.tick);
              updateSettings({ ambient: kind.id });
              startAmbient(kind.id);
            }}
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
  );
}
