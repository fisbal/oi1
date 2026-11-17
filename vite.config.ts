/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';

/**
 * Office In 1 runs only its own scripts (OWASP CSP Cheat Sheet, "strict" script-src): a script slipped into a
 * document, a pasted page or an AI answer cannot run and cannot read the keys kept on the device.
 * - 'self': the app's own files; the small inline theme script is allowed by its SHA-256, computed here at build.
 * - 'wasm-unsafe-eval': WebAssembly (spelling, PDF, on-device AI) without allowing eval().
 * - Puter: the free web copilot's own script (src/shell/webAi.ts).
 * People's code in In 1 Code+ runs on its own sandbox page (public/preview.html, src/modules/code/sandboxFrame.ts).
 * Workers (spelling, on-device AI, dictation) are separate files with their own rules. Only for the build: the dev
 * server needs its own inline scripts. scripts/check-csp.mjs checks the policy and that nothing it blocks is ours.
 */
export const SCRIPT_SRC = ["'self'", "'wasm-unsafe-eval'", 'https://js.puter.com', 'https://puter.com', 'https://*.puter.com'];
function strictCsp(): Plugin {
  return {
    name: 'oi1-strict-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => `'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`);
        const policy = `object-src 'none'; base-uri 'self'; script-src ${[...SCRIPT_SRC, ...hashes].join(' ')}`;
        const out = html.replace(/(<meta http-equiv="Content-Security-Policy" content=")[^"]*(")/, `$1${policy}$2`);
        if (out === html) throw new Error('index.html lost its Content-Security-Policy meta tag');
        return out;
      },
    },
  };
}

// base './' makes the same build work on GitHub Pages (/oi1/), locally, and later inside Tauri.
export default defineConfig({
  base: './',
  plugins: [react(), strictCsp()],
  // The editor (TipTap) is one big chunk, loaded only when a letter opens.
  build: { chunkSizeWarningLimit: 700 },
  // Dictation runs Whisper in a module worker (it code-splits).
  worker: { format: 'es' },
  test: { environment: 'jsdom' },
});
