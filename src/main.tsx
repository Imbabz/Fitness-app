import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

/*
 * The service worker is what makes this openable from the home screen with no
 * network, and what stops a stale build sticking around. It only exists in a
 * production build — in dev it would just cache things you are editing.
 *
 * `updateViaCache: 'none'` keeps the browser from serving sw.js itself out of
 * the HTTP cache, which is the one way this could pin an old version in place.
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  // Read before registering: by the time controllerchange fires, `controller`
  // is already the new worker, so it cannot tell a first install from an update.
  const hadController = !!navigator.serviceWorker.controller;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, {
        scope: import.meta.env.BASE_URL,
        updateViaCache: 'none',
      })
      .catch(() => {
        // Private mode, an unsupported browser, a blocked scope — the app works
        // fine without it, so there is nothing worth telling the user here.
      });

    // A new worker taking over means new code is on disk. Reload once so the
    // running tab picks it up; `refreshing` guards against a reload loop, and
    // `hadController` skips the reload on a first install, where the takeover
    // is expected and the page is already current.
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing || !hadController) return;
      refreshing = true;
      window.location.reload();
    });
  });
}
