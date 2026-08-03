import { Component, useState, type ReactNode } from 'react';
import { History as HistoryIcon, House, Moon, Settings as SettingsIcon, Sun } from 'lucide-react';
import type { Session, View } from './types';
import { AppStateProvider, useApp } from './state/AppStateContext';
import { SESSION_BY_ID } from './data/sessions';
import { Home } from './screens/Home';
import { History } from './screens/History';
import { Settings } from './screens/Settings';
import { Journey } from './journey/Journey';
import { haptic, HAPTIC } from './lib/haptics';
import { clearState } from './state/store';

export default function App() {
  return (
    <Boundary>
      <AppStateProvider>
        <Shell />
      </AppStateProvider>
    </Boundary>
  );
}

function Shell() {
  const { state, toggleMode } = useApp();
  const [view, setView] = useState<View>('home');
  const [session, setSession] = useState<Session | null>(() =>
    state.activeSession ? (SESSION_BY_ID[state.activeSession.sessionId] ?? null) : null,
  );

  // A session in progress owns the screen — no header, no nav, one thing to do.
  if ((view === 'session' || view === 'routine') && session) {
    return (
      <main className="mx-auto min-h-dvh w-full max-w-md">
        <Journey
          session={session}
          onExit={() => {
            setSession(null);
            setView('home');
          }}
        />
      </main>
    );
  }

  const open = (s: Session) => {
    haptic(HAPTIC.transition);
    setSession(s);
    setView(s.mode === 'night' ? 'routine' : 'session');
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <header className="flex items-center justify-between px-5 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <span className="text-sm font-bold uppercase tracking-[0.28em] text-faint">Ridge</span>
        <button
          type="button"
          onClick={() => {
            haptic(HAPTIC.tick);
            toggleMode();
          }}
          aria-label={`Switch to ${state.mode === 'day' ? 'night' : 'day'} mode`}
          className="grid h-11 w-11 place-items-center rounded-full border border-line/60 bg-surface text-accent active:bg-raised"
        >
          {state.mode === 'day' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </header>

      <main className="flex-1 px-5 pb-28 pt-3">
        {view === 'home' && <Home onOpen={open} />}
        {view === 'history' && <History />}
        {view === 'settings' && <Settings />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md border-t border-line/50 bg-base/90 px-5 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-md">
        <div className="flex justify-around">
          {(
            [
              ['home', House, 'Home'],
              ['history', HistoryIcon, 'History'],
              ['settings', SettingsIcon, 'Settings'],
            ] as const
          ).map(([id, Icon, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              aria-current={view === id ? 'page' : undefined}
              className={[
                'flex h-14 flex-1 flex-col items-center justify-center gap-1 rounded-lg text-[10px] font-medium transition-colors',
                view === id ? 'text-accent' : 'text-faint active:bg-raised',
              ].join(' ')}
            >
              <Icon size={20} />
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

/**
 * A parse failure or a bad render must never leave a blank screen in a gym.
 * The escape hatch clears the store, because a corrupt store is the only thing
 * that realistically gets you here twice.
 */
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-5 px-8 text-center">
        <h1 className="text-2xl font-bold text-ink">Something broke.</h1>
        <p className="text-sm leading-relaxed text-muted">
          Reload first — nothing is lost. If it keeps happening, clearing the saved state will fix
          it, at the cost of your logged history.
        </p>
        <div className="flex w-full flex-col gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="h-14 w-full rounded-card bg-accent text-base font-semibold text-base"
          >
            Reload
          </button>
          <button
            type="button"
            onClick={() => {
              clearState();
              window.location.reload();
            }}
            className="h-12 w-full rounded-card border border-danger/40 text-sm font-medium text-danger"
          >
            Clear saved data and reload
          </button>
        </div>
      </div>
    );
  }
}
