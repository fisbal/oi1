// Dark or light: the user picks in the top bar; the first visit follows the device's setting.
// index.html sets the same attribute before the page draws, so it never flashes the other theme.

import { useEffect, useState } from 'react';

export type ThemeMode = 'dark' | 'light';
const KEY = 'oi1.theme';
const listeners = new Set<(m: ThemeMode) => void>();

export function getTheme(): ThemeMode {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export function setTheme(mode: ThemeMode) {
  const root = document.documentElement;
  root.classList.add('theme-fade');
  root.dataset.theme = mode;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', mode === 'light' ? '#F3EFE6' : '#07070A');
  try { localStorage.setItem(KEY, mode); } catch { /* private window */ }
  window.setTimeout(() => root.classList.remove('theme-fade'), 400);
  listeners.forEach(fn => fn(mode));
}

export function useTheme(): ThemeMode {
  const [mode, setMode] = useState(getTheme);
  useEffect(() => { listeners.add(setMode); return () => { listeners.delete(setMode); }; }, []);
  return mode;
}
