import { Volume2 } from 'lucide-react';
import { useState } from 'react';
import { context, contextState } from '../lib/audio';
import { beep } from '../lib/sound';
import { AMBIENT_KINDS, THEMES } from '../lib/ambient';
import { useApp } from '../state/AppStateContext';

/**
 * "The sounds are not playing" — answered from the device rather than guessed at.
 *
 * There are three quite different causes and they are indistinguishable from
 * the outside: the browser refusing to start audio, the phone being muted, or
 * nothing having been switched on in the first place. Everything in Ridge is
 * off by default, so silence is the correct behaviour far more often than it is
 * a fault. This says which.
 */
export function SoundCheck() {
  const { state, updateSettings } = useApp();
  const [result, setResult] = useState<string | null>(null);

  const label = (() => {
    const a = state.settings.ambient;
    if (a === 'off') return null;
    if (a.startsWith('cat:')) return `the "${a.slice(4)}" collection`;
    if (a.startsWith('track:')) return 'one of your files';
    return (
      THEMES.find((t) => t.id === a)?.label ??
      AMBIENT_KINDS.find((k) => k.id === a)?.label ??
      a
    );
  })();

  const countdowns = Object.values(state.settings.countdown).filter(Boolean).length;

  const run = () => {
    // Inside the tap on purpose: it is the only moment iOS will let an
    // AudioContext start.
    const ac = context();
    beep(660, 0.35);
    window.setTimeout(() => beep(880, 0.35), 400);

    if (!ac) {
      setResult('This browser has no Web Audio at all. Nothing can play here.');
      return;
    }
    window.setTimeout(() => {
      const st = contextState();
      if (st !== 'running') {
        setResult(
          `The browser is holding audio at "${st}". Tap Test again — if it stays, the page needs reloading.`,
        );
        return;
      }
      setResult(
        'Two tones just played. If you heard nothing: on an iPhone the side ring/silent switch mutes this, and the volume rocker controls the ringer rather than media until something is already playing.',
      );
    }, 900);
  };

  return (
    <div className="space-y-2 p-3">
      <div className="flex items-start justify-between gap-3 pb-1">
        <div className="min-w-0">
          <span className="block text-sm font-medium text-ink">Play like a music app</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-faint">
            Your own music sounds through the iPhone ring/silent switch and keeps playing when the
            screen locks, with lock-screen controls. Costs the filter and reverb on it. The
            synthesised soundtracks cannot do this — a browser is only given the choice for real
            files, not for generated sound.
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={state.settings.musicAppMode}
          aria-label="Play like a music app"
          onClick={() => updateSettings({ musicAppMode: !state.settings.musicAppMode })}
          className={[
            'relative mt-0.5 h-8 w-14 shrink-0 rounded-full transition-colors',
            state.settings.musicAppMode ? 'bg-accent' : 'bg-raised',
          ].join(' ')}
        >
          <span
            className={[
              'absolute top-1 h-6 w-6 rounded-full bg-ink transition-transform duration-200',
              state.settings.musicAppMode ? 'translate-x-7' : 'translate-x-1',
            ].join(' ')}
          />
        </button>
      </div>

      <button
        type="button"
        onClick={run}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-card bg-raised text-sm font-medium text-ink active:opacity-80"
      >
        <Volume2 size={16} />
        Test sound
      </button>

      {result && <p className="px-1 text-xs leading-relaxed text-muted">{result}</p>}

      <p className="px-1 text-xs leading-relaxed text-faint">
        Right now:{' '}
        {label ? (
          <>
            ambience is <span className="text-muted">{label}</span>
          </>
        ) : (
          <>
            ambience is <span className="text-muted">off</span> — nothing will play during a
            session until one is chosen above
          </>
        )}
        {'. '}
        Countdown beeps on{' '}
        <span className="text-muted">
          {countdowns === 0 ? 'no exercises' : `${countdowns} exercise${countdowns === 1 ? '' : 's'}`}
        </span>
        {countdowns === 0 ? ' — set them per exercise at the trailhead' : ''}. Timer end tone{' '}
        <span className="text-muted">{state.settings.soundOnTimerEnd ? 'on' : 'off'}</span>.
      </p>
    </div>
  );
}
