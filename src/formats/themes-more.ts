// More In 1 Stage themes: 20 for everyday life (family, school, travel, seasons...) and 5 military ones.
// Each has its colors, two bundled fonts and decorations drawn behind the slides (and saved in the .pptx master).
// Decorations are in parts of the slide (0 to 1); `geom` draws a star, heart, chevron... instead of a box.

import type { DeckTheme, Deco } from './slides';

const dots = (color: string, pts: [number, number, number][], opacity = 1): Deco[] =>
  pts.map(([x, y, r]) => ({ x, y, w: r, h: r * 16 / 9, color, opacity, round: true }));

export const LIFE_THEMES: DeckTheme[] = [
  {
    id: 'wedding', name: 'Wedding', group: 'life', bg: { color: '#FFFDF8' }, title: '#8A6D3B', text: '#4A4038',
    accents: ['#C9A961', '#D9A3A3', '#A3B8A0', '#8A6D3B', '#C9A28A', '#B08DA8'], head: 'Cormorant Garamond', body: 'Lora', dark: false,
    deco: [
      { x: 0.06, y: 0.05, w: 0.88, h: 0.004, color: '#C9A961' },
      { x: 0.06, y: 0.945, w: 0.88, h: 0.004, color: '#C9A961' },
      { x: 0.86, y: 0.08, w: 0.07, h: 0.11, color: '#D9A3A3', opacity: 0.35, geom: 'heart' },
      { x: 0.9, y: 0.15, w: 0.045, h: 0.07, color: '#C9A961', opacity: 0.35, geom: 'heart' },
    ],
  },
  {
    id: 'birthday', name: 'Birthday', group: 'life', bg: { color: '#FFF4E6', to: '#FFE3EC', angle: 135 }, title: '#D63A6E', text: '#3D2B3D',
    accents: ['#E2457A', '#FFB547', '#2FB3A3', '#7C6CF0', '#3FA0D8', '#FF8A5B'], head: 'Pacifico', body: 'Nunito', dark: false,
    deco: [
      ...dots('#FFB547', [[0.04, 0.08, 0.02], [0.93, 0.82, 0.025]], 0.8),
      ...dots('#2FB3A3', [[0.9, 0.1, 0.018], [0.08, 0.86, 0.015]], 0.8),
      ...dots('#7C6CF0', [[0.95, 0.4, 0.012], [0.03, 0.5, 0.012]], 0.7),
      { x: 0.84, y: 0.05, w: 0.05, h: 0.09, color: '#E2457A', opacity: 0.7, geom: 'star5', rot: 12 },
      { x: 0.12, y: 0.06, w: 0.03, h: 0.055, color: '#FFB547', opacity: 0.8, geom: 'star5', rot: -10 },
    ],
  },
  {
    id: 'baby', name: 'Baby', group: 'life', bg: { color: '#F3F8FC' }, title: '#4F80AB', text: '#4A5568',
    accents: ['#7FB0E6', '#EE9BBA', '#F2C46D', '#6FC2B4', '#A98BE6', '#4F80AB'], head: 'Comfortaa', body: 'Quicksand', dark: false,
    deco: [
      { x: -0.05, y: 0.82, w: 0.3, h: 0.35, color: '#DCEBF7', round: true },
      { x: 0.15, y: 0.86, w: 0.25, h: 0.3, color: '#E6F0F9', round: true },
      { x: 0.78, y: 0.85, w: 0.32, h: 0.32, color: '#F9E3EC', round: true },
      { x: 0.88, y: 0.06, w: 0.04, h: 0.07, color: '#F2C46D', opacity: 0.8, geom: 'star5' },
      { x: 0.83, y: 0.15, w: 0.025, h: 0.045, color: '#EE9BBA', opacity: 0.8, geom: 'star5' },
    ],
  },
  {
    id: 'family', name: 'Family', group: 'life', bg: { color: '#FFF8EE' }, title: '#A84A33', text: '#3B302A',
    accents: ['#E07A52', '#C9A961', '#6B8F4E', '#5B8DB8', '#B5523B', '#8C6D58'], head: 'Merriweather', body: 'Nunito', dark: false,
    deco: [
      { x: 0.8, y: -0.18, w: 0.3, h: 0.53, color: '#F2B263', opacity: 0.25, round: true },
      { x: 0, y: 0.965, w: 1, h: 0.035, color: '#E07A52', to: '#C9A961' },
    ],
  },
  {
    id: 'travel', name: 'Travel', group: 'life', bg: { color: '#0E3B4F', to: '#0A2533', angle: 160 }, title: '#FFD27F', text: '#E6F1F5',
    accents: ['#FFD27F', '#4FC4B5', '#FF8A5B', '#9FD8F5', '#E26FC2', '#A3B86C'], head: 'Bebas Neue', body: 'Montserrat', dark: true,
    deco: [
      { x: 0.72, y: 0.5, w: 0.4, h: 0.71, color: '#9FD8F5', opacity: 0.07, round: true },
      { x: 0.8, y: 0.62, w: 0.24, h: 0.43, color: '#9FD8F5', opacity: 0.07, round: true },
      { x: 0.87, y: 0.1, w: 0.05, h: 0.06, color: '#FFD27F', opacity: 0.9, geom: 'triangle', rot: 60 },
      { x: 0.07, y: 0.245, w: 0.1, h: 0.006, color: '#FFD27F' },
    ],
  },
  {
    id: 'beach', name: 'Beach', group: 'life', bg: { color: '#E9F7FB', to: '#FFF6E0', angle: 180 }, title: '#0E7490', text: '#1F3A44',
    accents: ['#0EA5C6', '#E9A23B', '#FF7F6B', '#2EC4B6', '#E8B730', '#0E7490'], head: 'Poppins', body: 'Open Sans', dark: false,
    deco: [
      { x: 0.84, y: 0.06, w: 0.1, h: 0.178, color: '#FFD166', opacity: 0.85, round: true },
      { x: 0, y: 0.86, w: 1, h: 0.05, color: '#7FD3E6', opacity: 0.8 },
      { x: 0, y: 0.91, w: 1, h: 0.09, color: '#F4D9A6' },
    ],
  },
  {
    id: 'cooking', name: 'Cooking', group: 'life', bg: { color: '#FFFBF5' }, title: '#B83227', text: '#3A2E28',
    accents: ['#C0392B', '#E67E22', '#D4A20F', '#27AE60', '#8E5A3C', '#D35400'], head: 'Abril Fatface', body: 'Lato', dark: false,
    deco: [
      { x: 0, y: 0, w: 1, h: 0.02, color: '#C0392B' },
      ...Array.from({ length: 20 }, (_, i): Deco => ({ x: i * 0.05, y: 0.955, w: 0.025, h: 0.045, color: '#C0392B', opacity: 0.22 })),
    ],
  },
  {
    id: 'garden', name: 'Garden', group: 'life', bg: { color: '#F2F7EC' }, title: '#3F6B2E', text: '#2F3A2A',
    accents: ['#5C9E3F', '#8DB255', '#E8A33D', '#D96C8E', '#7B5E3B', '#3F6B2E'], head: 'Lora', body: 'Source Sans 3', dark: false,
    deco: [
      { x: -0.04, y: 0.7, w: 0.14, h: 0.4, color: '#8DB255', opacity: 0.35, round: true, rot: 35 },
      { x: 0.05, y: 0.78, w: 0.09, h: 0.3, color: '#5C9E3F', opacity: 0.35, round: true, rot: -20 },
      { x: 0.9, y: -0.08, w: 0.12, h: 0.34, color: '#8DB255', opacity: 0.3, round: true, rot: -35 },
      { x: 0.93, y: 0.2, w: 0.035, h: 0.062, color: '#D96C8E', opacity: 0.7, round: true },
    ],
  },
  {
    id: 'sport', name: 'Sport', group: 'life', bg: { color: '#0F1A2E' }, title: '#FFFFFF', text: '#D6DEEA',
    accents: ['#FF4D2E', '#FFC300', '#2ECC71', '#3FA9F5', '#9B59B6', '#FFFFFF'], head: 'Oswald', body: 'Roboto', dark: true,
    deco: [
      { x: 0.8, y: -0.2, w: 0.05, h: 1.4, color: '#FF4D2E', opacity: 0.85, rot: 20 },
      { x: 0.87, y: -0.2, w: 0.025, h: 1.4, color: '#FFC300', opacity: 0.85, rot: 20 },
      { x: 0.07, y: 0.245, w: 0.08, h: 0.008, color: '#FF4D2E' },
    ],
  },
  {
    id: 'fitness', name: 'Fitness', group: 'life', bg: { color: '#111111' }, title: '#C6FF3D', text: '#E5E5E5',
    accents: ['#C6FF3D', '#00E0FF', '#FF3D7F', '#FFB800', '#8C7BFF', '#FFFFFF'], head: 'Archivo Black', body: 'Inter', dark: true,
    deco: [
      { x: 0, y: 0, w: 0.012, h: 1, color: '#C6FF3D' },
      { x: 0.84, y: 0.82, w: 0.04, h: 0.1, color: '#C6FF3D', opacity: 0.25, geom: 'chevron' },
      { x: 0.885, y: 0.82, w: 0.04, h: 0.1, color: '#C6FF3D', opacity: 0.45, geom: 'chevron' },
      { x: 0.93, y: 0.82, w: 0.04, h: 0.1, color: '#C6FF3D', opacity: 0.7, geom: 'chevron' },
    ],
  },
  {
    id: 'school', name: 'School', group: 'life', bg: { color: '#2F4F3E', to: '#27443A', angle: 135 }, title: '#FFFFFF', text: '#E8EFE9',
    accents: ['#F7D08A', '#9FD8F5', '#F2A7C3', '#A3E4A0', '#FFFFFF', '#FFB37A'], head: 'Caveat', body: 'Nunito', dark: true,
    deco: [
      { x: 0, y: 0, w: 1, h: 0.025, color: '#8C6D58' },
      { x: 0, y: 0.975, w: 1, h: 0.025, color: '#8C6D58' },
      { x: 0.07, y: 0.25, w: 0.18, h: 0.005, color: '#FFFFFF', opacity: 0.5 },
      { x: 0.86, y: 0.935, w: 0.06, h: 0.02, color: '#FFFFFF', opacity: 0.8 },
    ],
  },
  {
    id: 'graduation', name: 'Graduation', group: 'life', bg: { color: '#14213D' }, title: '#FCA311', text: '#E5E5E5',
    accents: ['#FCA311', '#E5E5E5', '#5FB8E8', '#B48CF0', '#5FC79A', '#E8875F'], head: 'Playfair Display', body: 'Lato', dark: true,
    deco: [
      { x: 0.83, y: 0.07, w: 0.1, h: 0.1, color: '#FCA311', opacity: 0.9, geom: 'diamond' },
      { x: 0.872, y: 0.16, w: 0.016, h: 0.1, color: '#FCA311', opacity: 0.9 },
      { x: 0.07, y: 0.245, w: 0.12, h: 0.006, color: '#FCA311' },
    ],
  },
  {
    id: 'faith', name: 'Faith', group: 'life', bg: { color: '#FBF7EF' }, title: '#5B3A29', text: '#3B302A',
    accents: ['#B08D57', '#5B3A29', '#7A8B99', '#A44A3F', '#6B8F71', '#C4A97A'], head: 'EB Garamond', body: 'Crimson Pro', dark: false,
    deco: [
      { x: 0.25, y: -0.55, w: 0.5, h: 0.9, color: '#F2D78B', opacity: 0.25, round: true },
      { x: 0.35, y: -0.3, w: 0.3, h: 0.5, color: '#F2D78B', opacity: 0.25, round: true },
      { x: 0.45, y: 0.955, w: 0.1, h: 0.004, color: '#B08D57' },
    ],
  },
  {
    id: 'christmas', name: 'Christmas', group: 'life', bg: { color: '#7A1E24', to: '#4E1016', angle: 160 }, title: '#F5E6C8', text: '#FBEFEF',
    accents: ['#3FA36A', '#F2C14E', '#FFFFFF', '#F07A7A', '#7FB8A4', '#C9A961'], head: 'Playfair Display', body: 'Nunito', dark: true,
    deco: [
      { x: 0.86, y: 0.06, w: 0.07, h: 0.125, color: '#F2C14E', geom: 'star5' },
      ...dots('#FFFFFF', [[0.08, 0.1, 0.008], [0.2, 0.05, 0.006], [0.7, 0.08, 0.007], [0.95, 0.35, 0.006], [0.04, 0.6, 0.007], [0.6, 0.93, 0.006], [0.9, 0.88, 0.008]], 0.55),
      { x: 0, y: 0.97, w: 1, h: 0.03, color: '#3FA36A' },
    ],
  },
  {
    id: 'autumn', name: 'Autumn', group: 'life', bg: { color: '#FFF5EA' }, title: '#9C3D10', text: '#3E2A1E',
    accents: ['#D9622B', '#D9952D', '#9C3D10', '#7B5E3B', '#B5523B', '#6B8F4E'], head: 'Libre Baskerville', body: 'Lato', dark: false,
    deco: [
      { x: 0.86, y: -0.1, w: 0.18, h: 0.32, color: '#D9622B', opacity: 0.25, round: true },
      { x: 0.93, y: 0.16, w: 0.08, h: 0.14, color: '#E8A33D', opacity: 0.35, round: true },
      { x: -0.05, y: 0.8, w: 0.15, h: 0.27, color: '#9C3D10', opacity: 0.18, round: true },
    ],
  },
  {
    id: 'spring', name: 'Spring', group: 'life', bg: { color: '#F7FBF3' }, title: '#3F7D4C', text: '#33413A',
    accents: ['#E88BAE', '#8DB255', '#E8B730', '#7FB0E6', '#B98AD4', '#3F7D4C'], head: 'Quicksand', body: 'Nunito', dark: false,
    deco: [
      { x: 0.9, y: 0.05, w: 0.04, h: 0.1, color: '#F2A7C3', opacity: 0.7, round: true, rot: 30 },
      { x: 0.86, y: 0.1, w: 0.04, h: 0.1, color: '#C9A0DC', opacity: 0.6, round: true, rot: -40 },
      { x: 0.93, y: 0.13, w: 0.035, h: 0.09, color: '#F2A7C3', opacity: 0.6, round: true, rot: 80 },
      { x: 0, y: 0.97, w: 1, h: 0.03, color: '#A3C76D' },
    ],
  },
  {
    id: 'winter', name: 'Winter', group: 'life', bg: { color: '#EAF2FA', to: '#FFFFFF', angle: 180 }, title: '#2B4C7E', text: '#2F3B4C',
    accents: ['#5B8DB8', '#7FAFD8', '#2B4C7E', '#8FA9C2', '#7FA7E8', '#4F6D8A'], head: 'Raleway', body: 'Raleway', dark: false,
    deco: [
      { x: 0.55, y: 0.72, w: 0.3, h: 0.3, color: '#C9D9EA', geom: 'triangle' },
      { x: 0.72, y: 0.66, w: 0.36, h: 0.36, color: '#B4C9DF', geom: 'triangle' },
      ...dots('#9FC5E8', [[0.1, 0.1, 0.008], [0.3, 0.06, 0.006], [0.9, 0.12, 0.008], [0.6, 0.08, 0.005]], 0.8),
    ],
  },
  {
    id: 'music', name: 'Music', group: 'life', bg: { color: '#1A1033', to: '#2D0B3A', angle: 135 }, title: '#FF6EC7', text: '#EDE6F7',
    accents: ['#FF6EC7', '#7DF9FF', '#FFD166', '#9B5DE5', '#00F5D4', '#F15BB5'], head: 'Bebas Neue', body: 'Outfit', dark: true,
    deco: [0.12, 0.2, 0.08, 0.16, 0.24, 0.1, 0.18].map((h, i): Deco => ({
      x: 0.8 + i * 0.026, y: 0.96 - h, w: 0.016, h, color: i % 2 ? '#7DF9FF' : '#FF6EC7', opacity: 0.6,
    })),
  },
  {
    id: 'health', name: 'Health', group: 'life', bg: { color: '#FFFFFF' }, title: '#0F766E', text: '#334155',
    accents: ['#14B8A6', '#0EA5E9', '#22C55E', '#F59E0B', '#6366F1', '#0F766E'], head: 'Manrope', body: 'Inter', dark: false,
    deco: [
      { x: 0, y: 0, w: 1, h: 0.015, color: '#14B8A6', to: '#0EA5E9' },
      { x: 0.84, y: 0.66, w: 0.14, h: 0.25, color: '#14B8A6', opacity: 0.12, geom: 'plus' },
    ],
  },
  {
    id: 'home', name: 'Home', group: 'life', bg: { color: '#F7F3EE' }, title: '#3D5A6C', text: '#33302D',
    accents: ['#3D5A6C', '#C08552', '#7E967C', '#C9A27C', '#6E7F8D', '#A26769'], head: 'DM Sans', body: 'DM Sans', dark: false,
    deco: [
      { x: 0.82, y: 0.6, w: 0.14, h: 0.14, color: '#C08552', opacity: 0.18, geom: 'triangle' },
      { x: 0.84, y: 0.74, w: 0.1, h: 0.17, color: '#3D5A6C', opacity: 0.12 },
      { x: 0.07, y: 0.245, w: 0.08, h: 0.006, color: '#C08552' },
    ],
  },
];

export const MILITARY_THEMES: DeckTheme[] = [
  {
    id: 'army', name: 'Army', group: 'military', bg: { color: '#3B4A2F', to: '#2A3522', angle: 160 }, title: '#E6D9A8', text: '#ECE8D9',
    accents: ['#C2A86B', '#8A9A5B', '#D9CBA0', '#6B7B4A', '#B0643A', '#E6D9A8'], head: 'Oswald', body: 'Roboto', dark: true,
    deco: [
      // Three rank chevrons pointing up (drawn sideways, then turned).
      { x: 0.88, y: 0.04, w: 0.035, h: 0.1, color: '#C2A86B', geom: 'chevron', rot: -90 },
      { x: 0.88, y: 0.1, w: 0.035, h: 0.1, color: '#C2A86B', geom: 'chevron', rot: -90 },
      { x: 0.88, y: 0.16, w: 0.035, h: 0.1, color: '#C2A86B', geom: 'chevron', rot: -90 },
      { x: 0, y: 0.965, w: 1, h: 0.035, color: '#C2A86B', opacity: 0.8 },
    ],
  },
  {
    id: 'navy', name: 'Navy', group: 'military', bg: { color: '#0B1F3A', to: '#06142A', angle: 160 }, title: '#D4AF37', text: '#E8EEF5',
    accents: ['#D4AF37', '#5B8DB8', '#FFFFFF', '#9FC5E8', '#D0504A', '#8A99AA'], head: 'Libre Baskerville', body: 'Source Sans 3', dark: true,
    deco: [
      { x: 0, y: 0.9, w: 1, h: 0.012, color: '#D4AF37' },
      { x: 0, y: 0.93, w: 1, h: 0.006, color: '#D4AF37' },
      { x: 0.84, y: 0.05, w: 0.08, h: 0.142, color: '#D4AF37', opacity: 0.85, geom: 'star5' },
      { x: 0.7, y: -0.3, w: 0.5, h: 0.89, color: '#5B8DB8', opacity: 0.06, round: true },
    ],
  },
  {
    id: 'airforce', name: 'Air Force', group: 'military', bg: { color: '#E8EEF4', to: '#C9D6E3', angle: 180 }, title: '#1F3A5F', text: '#24324A',
    accents: ['#1F3A5F', '#5B8DB8', '#C0392B', '#7E95AD', '#D9A62B', '#4A5568'], head: 'Montserrat', body: 'Open Sans', dark: false,
    deco: [
      { x: 0.85, y: 0.06, w: 0.09, h: 0.16, color: '#1F3A5F', round: true },
      { x: 0.865, y: 0.087, w: 0.06, h: 0.107, color: '#FFFFFF', round: true },
      { x: 0.88, y: 0.113, w: 0.03, h: 0.053, color: '#C0392B', round: true },
      { x: -0.1, y: 0.86, w: 1.3, h: 0.006, color: '#FFFFFF', opacity: 0.9, rot: -4 },
    ],
  },
  {
    id: 'camo', name: 'Camouflage', group: 'military', bg: { color: '#5A6B47' }, title: '#F0E9D2', text: '#F0E9D2',
    accents: ['#C9B98B', '#8A9A5B', '#E0D5B5', '#B3A47A', '#D08A4A', '#F0E9D2'], head: 'Archivo Black', body: 'Roboto', dark: true,
    deco: [
      { x: -0.05, y: -0.08, w: 0.3, h: 0.35, color: '#3E4A32', opacity: 0.8, round: true, rot: 20 },
      { x: 0.2, y: 0.7, w: 0.35, h: 0.4, color: '#8A7A55', opacity: 0.7, round: true, rot: -15 },
      { x: 0.65, y: -0.1, w: 0.3, h: 0.32, color: '#2F3826', opacity: 0.75, round: true, rot: 40 },
      { x: 0.8, y: 0.55, w: 0.28, h: 0.5, color: '#3E4A32', opacity: 0.8, round: true, rot: -30 },
      { x: 0.45, y: 0.25, w: 0.18, h: 0.22, color: '#8A7A55', opacity: 0.55, round: true, rot: 10 },
      { x: 0.05, y: 0.45, w: 0.16, h: 0.25, color: '#2F3826', opacity: 0.6, round: true, rot: 60 },
      // A dark panel keeps the text easy to read over the pattern.
      { x: 0.045, y: 0.06, w: 0.91, h: 0.88, color: '#1E2418', opacity: 0.6 },
    ],
  },
  {
    id: 'command', name: 'Command', group: 'military', bg: { color: '#0B0F0C' }, title: '#FFB000', text: '#D7E3D4',
    accents: ['#FFB000', '#39FF88', '#FF4D4D', '#7FD1FF', '#C9D6C3', '#8A9A5B'], head: 'JetBrains Mono', body: 'IBM Plex Sans', dark: true,
    deco: [
      ...[0.2, 0.4, 0.6, 0.8].map((x): Deco => ({ x, y: 0, w: 0.0015, h: 1, color: '#39FF88', opacity: 0.1 })),
      ...[0.25, 0.5, 0.75].map((y): Deco => ({ x: 0, y, w: 1, h: 0.0025, color: '#39FF88', opacity: 0.1 })),
      { x: 0.03, y: 0.05, w: 0.05, h: 0.006, color: '#FFB000' },
      { x: 0.03, y: 0.05, w: 0.0035, h: 0.09, color: '#FFB000' },
      { x: 0.92, y: 0.944, w: 0.05, h: 0.006, color: '#FFB000' },
      { x: 0.9665, y: 0.86, w: 0.0035, h: 0.09, color: '#FFB000' },
    ],
  },
];
