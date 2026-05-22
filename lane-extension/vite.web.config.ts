import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { renameSync, existsSync } from 'fs';
import { resolve } from 'path';

// Standalone web build for GitHub Pages deployment.
// Uses chrome-mock.ts polyfill instead of real chrome.* APIs.
// base matches the GitHub repo name for correct asset paths on Pages.
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'rename-html-output',
      closeBundle() {
        const src = resolve(__dirname, 'dist-web/index.web.html');
        const dest = resolve(__dirname, 'dist-web/index.html');
        if (existsSync(src)) renameSync(src, dest);
      },
    },
  ],
  base: '/Job-Application-Status-Chrome-Extension/',
  build: {
    outDir: 'dist-web',
    emptyOutDir: true,
    rollupOptions: {
      input: 'index.web.html',
    },
  },
  root: '.',
});
