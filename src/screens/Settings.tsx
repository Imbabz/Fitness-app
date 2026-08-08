import { Download, Moon, RotateCcw, Sun, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { useApp } from '../state/AppStateContext';
import { exportState, flushState, importState } from '../state/store';
import { todayKey } from '../lib/time';

export function Settings() {
  const { state, setMode, updateSettings, replaceState, resetAll, resetAllTuning } = useApp();
  const [confirmReset, setConfirmReset] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const doExport = () => {
    const blob = new Blob([exportState(state)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ridge-${todayKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = async (file: File) => {
    try {
      replaceState(importState(await file.text()));
      flushState();
      setMessage('Imported.');
    } catch {
      setMessage('That file could not be read. Nothing was changed.');
    }
  };

  return (
    <div className="ridge-enter space-y-7">
      <h1 className="text-[2rem] font-bold tracking-tight text-ink">Settings</h1>

      <Group title="Mode">
        <div className="grid grid-cols-2 gap-2 p-3">
          {(['day', 'night'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={[
                'flex h-12 items-center justify-center gap-2 rounded-lg text-sm font-semibold capitalize transition-colors',
                state.mode === m ? 'bg-accent text-base' : 'bg-raised text-muted',
              ].join(' ')}
            >
              {m === 'day' ? <Sun size={16} /> : <Moon size={16} />}
              {m}
            </button>
          ))}
        </div>
        <p className="border-t border-line/50 px-4 py-3 text-xs leading-relaxed text-faint">
          Defaults to day before 18:00 and night after. Choosing one here holds it for the rest of
          today, then the time-of-day default takes over again.
        </p>
      </Group>

      <Group title="Session">
        <Row label="Default rest" hint="Used when an exercise has no rest of its own.">
          <div className="flex gap-1.5">
            {[60, 90, 120].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => updateSettings({ restDefaultSeconds: s })}
                className={[
                  'h-10 w-14 rounded-lg text-sm font-semibold tabular-nums transition-colors',
                  state.settings.restDefaultSeconds === s
                    ? 'bg-accent text-base'
                    : 'bg-raised text-muted',
                ].join(' ')}
              >
                {s}s
              </button>
            ))}
          </div>
        </Row>
        <Row
          label="Adjusted exercises"
          hint="Sets, reps and rest you changed at the trailhead."
        >
          {(() => {
            const count = Object.keys(state.tuning).length;
            return count === 0 ? (
              <span className="text-sm text-faint">None</span>
            ) : (
              <button
                type="button"
                onClick={resetAllTuning}
                className="h-10 rounded-lg bg-raised px-3 text-sm font-semibold text-muted active:opacity-80"
              >
                Restore {count}
              </button>
            );
          })()}
        </Row>
        <Toggle
          label="Timer sound"
          hint="A short tone when a rest or duration timer ends."
          value={state.settings.soundOnTimerEnd}
          onChange={(v) => updateSettings({ soundOnTimerEnd: v })}
        />
        <Toggle
          label="Haptics"
          hint="A short buzz on each rep and at the end of a set."
          value={state.settings.haptics}
          onChange={(v) => updateSettings({ haptics: v })}
        />
      </Group>

      <Group title="Data">
        <div className="grid grid-cols-2 gap-2 p-3">
          <button
            type="button"
            onClick={doExport}
            className="flex h-12 items-center justify-center gap-2 rounded-lg bg-raised text-sm font-medium text-ink active:opacity-80"
          >
            <Download size={16} />
            Export
          </button>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="flex h-12 items-center justify-center gap-2 rounded-lg bg-raised text-sm font-medium text-ink active:opacity-80"
          >
            <Upload size={16} />
            Import
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void doImport(f);
              e.target.value = '';
            }}
          />
        </div>
        <p className="border-t border-line/50 px-4 py-3 text-xs leading-relaxed text-faint">
          Everything lives in this browser and nowhere else. Export is the only backup there is —
          worth doing before clearing site data or changing phone.
        </p>
      </Group>

      <Group title="Danger">
        <div className="p-3">
          {confirmReset ? (
            <div className="space-y-2">
              <p className="px-1 text-sm text-muted">
                This deletes every logged session and all history. It cannot be undone.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="h-12 rounded-lg bg-raised text-sm font-medium text-ink"
                >
                  Keep it
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetAll();
                    flushState();
                    setConfirmReset(false);
                    setMessage('All data cleared.');
                  }}
                  className="h-12 rounded-lg bg-danger text-sm font-semibold text-base"
                >
                  Delete everything
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-danger/40 text-sm font-medium text-danger"
            >
              <RotateCcw size={16} />
              Reset all data
            </button>
          )}
        </div>
      </Group>

      {message && <p className="text-center text-sm text-muted">{message}</p>}

      <p className="pb-2 text-center text-xs leading-relaxed text-faint">
        Ridge is a training log, not medical advice. It surfaces patterns and never adjusts a load
        on its own — those decisions stay with you and your physio.
      </p>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-faint">
        {title}
      </h2>
      <div className="divide-y divide-line/50 overflow-hidden rounded-card border border-line/50 bg-surface">
        {children}
      </div>
    </section>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
      <div className="min-w-0">
        <div className="text-sm font-medium text-ink">{label}</div>
        {hint && <div className="mt-0.5 text-xs text-faint">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Row label={label} {...(hint !== undefined ? { hint } : {})}>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={() => onChange(!value)}
        className={[
          'relative h-8 w-14 rounded-full transition-colors',
          value ? 'bg-accent' : 'bg-raised',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-1 h-6 w-6 rounded-full bg-ink transition-transform duration-200',
            value ? 'translate-x-7' : 'translate-x-1',
          ].join(' ')}
        />
      </button>
    </Row>
  );
}
