import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base` targets GitHub Pages at https://<user>.github.io/fitness-app/.
// Serving from a custom domain or a user-page root? Set BASE_PATH=/ at build time.
const base = process.env.BASE_PATH ?? '/fitness-app/';

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    // The whole app is one bundle; there is nothing worth code-splitting in a
    // four-screen SPA and a single file caches better offline.
    chunkSizeWarningLimit: 400,
  },
});
