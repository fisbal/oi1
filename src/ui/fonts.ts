// Fonts that ship with OI1, so every letter looks the same on Windows, Mac, Linux and phones.
// All are free (SIL Open Font License or Apache 2.0) through Fontsource; a font file only downloads when text uses it.
// fonts.css is made by scripts/fonts-css.mjs (`npm run fonts`).

import './fonts.css';

export type FontKind = 'sans' | 'serif' | 'mono' | 'display' | 'hand' | 'alike';
/** `lh`: the tightest line height at which a hanging letter (y, g) never touches an accented capital (Ê, Â) on the
 *  next line, measured from the font's own letters; only fonts that need more than 1.2 have one. */
export interface BundledFont { name: string; css: string; kind: FontKind; lh?: number }

export const BUNDLED_FONTS: BundledFont[] = [
  { name: 'Inter', css: 'Inter Variable', kind: 'sans' },
  { name: 'Roboto', css: 'Roboto Variable', kind: 'sans' },
  { name: 'Open Sans', css: 'Open Sans Variable', kind: 'sans', lh: 1.23 },
  { name: 'Lato', css: 'Lato', kind: 'sans' },
  { name: 'Montserrat', css: 'Montserrat Variable', kind: 'sans' },
  { name: 'Poppins', css: 'Poppins', kind: 'sans', lh: 1.3 },
  { name: 'Nunito', css: 'Nunito Variable', kind: 'sans' },
  { name: 'Raleway', css: 'Raleway Variable', kind: 'sans' },
  { name: 'Source Sans 3', css: 'Source Sans 3 Variable', kind: 'sans' },
  { name: 'Work Sans', css: 'Work Sans Variable', kind: 'sans' },
  { name: 'Noto Sans', css: 'Noto Sans Variable', kind: 'sans', lh: 1.22 },
  { name: 'IBM Plex Sans', css: 'IBM Plex Sans', kind: 'sans' },
  { name: 'Outfit', css: 'Outfit Variable', kind: 'sans', lh: 1.24 },
  { name: 'Manrope', css: 'Manrope Variable', kind: 'sans', lh: 1.27 },
  { name: 'Quicksand', css: 'Quicksand Variable', kind: 'sans' },
  { name: 'Space Grotesk', css: 'Space Grotesk Variable', kind: 'sans' },
  { name: 'DM Sans', css: 'DM Sans Variable', kind: 'sans', lh: 1.25 },
  { name: 'Merriweather', css: 'Merriweather Variable', kind: 'serif', lh: 1.3 },
  { name: 'Lora', css: 'Lora Variable', kind: 'serif', lh: 1.27 },
  { name: 'EB Garamond', css: 'EB Garamond Variable', kind: 'serif' },
  { name: 'Libre Baskerville', css: 'Libre Baskerville', kind: 'serif', lh: 1.3 },
  { name: 'Source Serif 4', css: 'Source Serif 4 Variable', kind: 'serif' },
  { name: 'Crimson Pro', css: 'Crimson Pro Variable', kind: 'serif' },
  { name: 'PT Serif', css: 'PT Serif', kind: 'serif' },
  { name: 'Noto Serif', css: 'Noto Serif Variable', kind: 'serif', lh: 1.22 },
  { name: 'Cormorant Garamond', css: 'Cormorant Garamond Variable', kind: 'serif' },
  { name: 'Playfair Display', css: 'Playfair Display Variable', kind: 'serif' },
  { name: 'JetBrains Mono', css: 'JetBrains Mono Variable', kind: 'mono' },
  { name: 'Fira Code', css: 'Fira Code Variable', kind: 'mono', lh: 1.23 },
  { name: 'Source Code Pro', css: 'Source Code Pro Variable', kind: 'mono' },
  { name: 'Bebas Neue', css: 'Bebas Neue', kind: 'display' },
  { name: 'Oswald', css: 'Oswald Variable', kind: 'display', lh: 1.38 },
  { name: 'Abril Fatface', css: 'Abril Fatface', kind: 'display', lh: 1.23 },
  { name: 'Archivo Black', css: 'Archivo Black', kind: 'display' },
  { name: 'Comfortaa', css: 'Comfortaa Variable', kind: 'display', lh: 1.34 },
  { name: 'Caveat', css: 'Caveat Variable', kind: 'hand' },
  { name: 'Dancing Script', css: 'Dancing Script Variable', kind: 'hand', lh: 1.22 },
  { name: 'Pacifico', css: 'Pacifico', kind: 'hand', lh: 1.72 },
  { name: 'Great Vibes', css: 'Great Vibes', kind: 'hand', lh: 1.4 },
  { name: 'Permanent Marker', css: 'Permanent Marker', kind: 'hand', lh: 1.48 },
  { name: 'Carlito', css: 'Carlito', kind: 'alike' },
  { name: 'Caladea', css: 'Caladea', kind: 'alike' },
  { name: 'Arimo', css: 'Arimo Variable', kind: 'alike' },
  { name: 'Tinos', css: 'Tinos', kind: 'alike' },
  { name: 'Cousine', css: 'Cousine', kind: 'alike' },
  { name: 'Gelasio', css: 'Gelasio Variable', kind: 'alike', lh: 1.26 },
];

const byName = new Map(BUNDLED_FONTS.map(f => [f.name.toLowerCase(), f]));

/** The CSS family OI1 ships for a font name, if it ships one. */
export const bundledFamily = (name: string): string | undefined => byName.get(name.toLowerCase())?.css;

/** The line height a font needs so its letters never touch the next line (see `lh`); 0 when any is fine. */
export const fontLineMin = (name: string): number => byName.get(name.toLowerCase())?.lh ?? 0;
