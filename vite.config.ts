/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' makes the same build work on GitHub Pages (/oi1/), locally, and later inside Tauri.
export default defineConfig({
  base: './',
  plugins: [react()],
  // The editor (TipTap) is one big chunk, loaded only when a letter opens.
  build: { chunkSizeWarningLimit: 700 },
  test: { environment: 'jsdom' },
});
