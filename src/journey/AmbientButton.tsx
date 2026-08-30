import { Volume2, VolumeX, X } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AmbientPicker } from '../components/AmbientPicker';
import { useApp } from '../state/AppStateContext';

/**
 * The ambience control while a session is running. Sits in the header beside
 * the progress arc because that is the one strip of the screen the stages never
 * own — mid-set, the whole page below belongs to the tracker.
 */
export function AmbientButton() {
  const { state } = useApp();
  const [open, setOpen] = useState(false);
  const on = state.settings.ambient !== 'off';

  return (
    <>
      <button
        type="button"
        data-no-swipe
        onClick={() => setOpen(true)}
        aria-label={`Ambience ${on ? state.settings.ambient : 'off'}`}
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition-colors ${
          on ? 'text-accent' : 'text-faint/70'
        } active:bg-raised`}
      >
        {on ? <Volume2 size={17} /> : <VolumeX size={17} />}
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex flex-col justify-end bg-base/70 backdrop-blur-sm">
            <button type="button" aria-label="Close" className="flex-1" onClick={() => setOpen(false)} />
            <div className="ridge-sheet rounded-t-[1.75rem] border-t border-line bg-surface px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl ridge-title text-ink">Ambience</h2>
                  <p className="mt-0.5 text-xs text-faint">
                    Plays until you leave the session. Tap one to hear it.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="-mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted active:bg-raised"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="mt-4">
                <AmbientPicker />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
