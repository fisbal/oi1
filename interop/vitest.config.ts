import { defineConfig } from 'vitest/config';

// The interop check runs on its own (npm run check:interop): it needs Python with openpyxl, python-docx, python-pptx.
export default defineConfig({ test: { environment: 'jsdom', include: ['interop/**/*.check.ts'], testTimeout: 180_000 } });
