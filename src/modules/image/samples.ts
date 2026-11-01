// Twenty photos painted in code, so In 1 Image always has something to try (no download, no copyright).
export const SAMPLES = ['sunset', 'lake', 'city', 'flowers', 'beach', 'forest', 'mountains', 'desert', 'snow', 'aurora', 'stars', 'wheat',
  'autumn', 'rainbow', 'island', 'canyon', 'storm', 'harbor', 'lavender', 'balloons'] as const;
export type SampleId = typeof SAMPLES[number];

function rng(seed: number) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

export function paintSample(id: SampleId, w = 1600, h = 1067): string {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  const r = rng(SAMPLES.indexOf(id) * 977 + 13);
  const sky = (stops: [number, string][]) => { const s = g.createLinearGradient(0, 0, 0, h); for (const [o, col] of stops) s.addColorStop(o, col); g.fillStyle = s; g.fillRect(0, 0, w, h); };
  const hills = (y: number, amp: number, col: string, n = 6) => {
    g.fillStyle = col; g.beginPath(); g.moveTo(0, h);
    for (let i = 0; i <= 40; i++) { const x = (i / 40) * w; g.lineTo(x, y + Math.sin(i / 40 * Math.PI * n * 0.5 + r() * 0.4) * amp + r() * amp * 0.3); }
    g.lineTo(w, h); g.closePath(); g.fill();
  };
  const sun = (x: number, y: number, rad: number, col: string) => {
    const s = g.createRadialGradient(x, y, 0, x, y, rad * 4); s.addColorStop(0, col); s.addColorStop(0.25, col); s.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = s; g.fillRect(0, 0, w, h);
  };
  switch (id) {
    case 'sunset':
      sky([[0, '#2b1d4f'], [0.45, '#c2507a'], [0.7, '#f39a4a'], [1, '#3a2340']]);
      sun(w * 0.62, h * 0.62, h * 0.07, 'rgba(255,214,140,1)');
      hills(h * 0.7, h * 0.04, '#5b2d4c'); hills(h * 0.78, h * 0.05, '#3c1f3b'); hills(h * 0.88, h * 0.03, '#22142a');
      break;
    case 'lake': {
      sky([[0, '#7fb2e5'], [0.5, '#d9ecf7'], [0.52, '#5f8fb4'], [1, '#27465f']]);
      g.fillStyle = '#6d7f96';
      for (let i = 0; i < 5; i++) { const x = (i / 4) * w; g.beginPath(); g.moveTo(x - w * 0.3, h * 0.52); g.lineTo(x, h * (0.18 + r() * 0.12)); g.lineTo(x + w * 0.3, h * 0.52); g.fill(); }
      g.fillStyle = '#f5f8fb';
      for (let i = 0; i < 5; i++) { const x = (i / 4) * w, top = h * 0.2; g.beginPath(); g.moveTo(x - w * 0.05, top + h * 0.08); g.lineTo(x, top); g.lineTo(x + w * 0.05, top + h * 0.08); g.fill(); }
      hills(h * 0.5, h * 0.02, '#2f5b3a', 10);
      g.globalAlpha = 0.25; g.scale(1, -1); g.drawImage(c, 0, -h * 1.04, w, h * 0.52); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
      break;
    }
    case 'city':
      sky([[0, '#0b1026'], [0.6, '#24305e'], [1, '#0c0d16']]);
      for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.8})`; g.fillRect(r() * w, r() * h * 0.4, 2, 2); }
      for (let x = 0; x < w;) {
        const bw = w * (0.04 + r() * 0.06), bh = h * (0.25 + r() * 0.45);
        g.fillStyle = `hsl(230, 25%, ${10 + r() * 10}%)`; g.fillRect(x, h - bh, bw, bh);
        for (let wy = h - bh + 12; wy < h - 10; wy += 22) for (let wx = x + 6; wx < x + bw - 8; wx += 16) if (r() > 0.45) { g.fillStyle = r() > 0.2 ? '#ffd27a' : '#7ad3ff'; g.fillRect(wx, wy, 8, 11); }
        x += bw + 4;
      }
      break;
    case 'flowers':
      sky([[0, '#9fd3ff'], [0.55, '#e7f6ff'], [0.56, '#5aa152'], [1, '#2f6d2c']]);
      for (let i = 0; i < 160; i++) {
        const x = r() * w, y = h * (0.6 + r() * 0.4), s = 6 + (y / h) * 22, hue = [340, 50, 280, 20, 0][Math.floor(r() * 5)];
        g.strokeStyle = '#2e6b2a'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + s * 2); g.stroke();
        for (let p = 0; p < 6; p++) { g.fillStyle = `hsl(${hue}, 85%, ${55 + r() * 15}%)`; g.beginPath(); g.ellipse(x + Math.cos(p) * s * 0.6, y + Math.sin(p) * s * 0.6, s * 0.55, s * 0.3, p, 0, 7); g.fill(); }
        g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(x, y, s * 0.3, 0, 7); g.fill();
      }
      break;
    case 'beach':
      sky([[0, '#4aa7e8'], [0.45, '#bfe6fb'], [0.46, '#1d8fb8'], [0.62, '#5fd0d6'], [0.64, '#f2e0b0'], [1, '#e2c58c']]);
      sun(w * 0.8, h * 0.15, h * 0.05, 'rgba(255,255,230,1)');
      g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 3;
      for (let i = 0; i < 8; i++) { g.beginPath(); const y = h * (0.5 + i * 0.016); g.moveTo(0, y); for (let x = 0; x <= w; x += 40) g.lineTo(x, y + Math.sin(x / 60 + i) * 3); g.stroke(); }
      g.fillStyle = '#5a3d1e'; g.fillRect(w * 0.18, h * 0.38, 14, h * 0.32);
      g.fillStyle = '#2f8a3a'; for (let i = 0; i < 7; i++) { g.beginPath(); g.ellipse(w * 0.18 + 7, h * 0.38, w * 0.08, h * 0.02, i * 0.9, 0, 7); g.fill(); }
      break;
    case 'forest':
      sky([[0, '#c9d9c2'], [0.5, '#8fb08a'], [1, '#22351f']]);
      for (let layer = 0; layer < 4; layer++) {
        for (let i = 0; i < 22; i++) {
          const x = r() * w, base = h * (0.55 + layer * 0.12), th = h * (0.25 + r() * 0.2);
          g.fillStyle = `hsl(${120 + r() * 20}, ${30 + layer * 8}%, ${38 - layer * 8}%)`;
          g.beginPath(); g.moveTo(x, base - th); g.lineTo(x - th * 0.25, base); g.lineTo(x + th * 0.25, base); g.fill();
        }
      }
      g.fillStyle = 'rgba(255,255,240,.18)'; g.fillRect(0, h * 0.45, w, h * 0.1);
      break;
    case 'mountains':
      sky([[0, '#5d8fd0'], [0.6, '#cfe2f3'], [1, '#e9eef2']]);
      g.fillStyle = '#7d8aa3'; for (let i = 0; i < 4; i++) { const x = w * (0.1 + i * 0.28); g.beginPath(); g.moveTo(x - w * 0.25, h * 0.75); g.lineTo(x, h * (0.22 + r() * 0.1)); g.lineTo(x + w * 0.25, h * 0.75); g.fill(); }
      g.fillStyle = '#ffffff'; for (let i = 0; i < 4; i++) { const x = w * (0.1 + i * 0.28), top = h * 0.26; g.beginPath(); g.moveTo(x - w * 0.06, top + h * 0.1); g.lineTo(x, top - h * 0.03); g.lineTo(x + w * 0.06, top + h * 0.1); g.fill(); }
      hills(h * 0.72, h * 0.04, '#4f6b48'); hills(h * 0.84, h * 0.03, '#34502f');
      break;
    case 'desert':
      sky([[0, '#f6b26b'], [0.5, '#fde3b5'], [1, '#fde3b5']]);
      sun(w * 0.3, h * 0.3, h * 0.06, 'rgba(255,240,200,1)');
      hills(h * 0.62, h * 0.06, '#e3a15c', 3); hills(h * 0.74, h * 0.07, '#d08a43', 2); hills(h * 0.88, h * 0.05, '#b8722f', 3);
      g.fillStyle = '#4c6b2f'; g.fillRect(w * 0.7, h * 0.55, w * 0.02, h * 0.25); g.fillRect(w * 0.68, h * 0.6, w * 0.02, h * 0.08); g.fillRect(w * 0.72, h * 0.58, w * 0.02, h * 0.07);
      break;
    case 'snow':
      sky([[0, '#9fb6cc'], [0.55, '#e8eef4'], [1, '#ffffff']]);
      hills(h * 0.6, h * 0.04, '#f4f7fa'); hills(h * 0.75, h * 0.03, '#ffffff');
      for (let i = 0; i < 9; i++) { const x = r() * w, b = h * (0.62 + r() * 0.2), th = h * 0.18; g.fillStyle = '#2f4a3a'; g.beginPath(); g.moveTo(x, b - th); g.lineTo(x - th * 0.3, b); g.lineTo(x + th * 0.3, b); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x, b - th); g.lineTo(x - th * 0.1, b - th * 0.65); g.lineTo(x + th * 0.1, b - th * 0.65); g.fill(); }
      g.fillStyle = 'rgba(255,255,255,.85)'; for (let i = 0; i < 300; i++) { g.beginPath(); g.arc(r() * w, r() * h, 1 + r() * 3, 0, 7); g.fill(); }
      break;
    case 'aurora': {
      sky([[0, '#030b1c'], [0.7, '#0b2340'], [1, '#05101f']]);
      for (let i = 0; i < 80; i++) { g.fillStyle = `rgba(255,255,255,${r()})`; g.fillRect(r() * w, r() * h * 0.6, 2, 2); }
      for (let band = 0; band < 3; band++) {
        const a = g.createLinearGradient(0, h * 0.15, 0, h * 0.6); a.addColorStop(0, 'rgba(120,255,180,0)'); a.addColorStop(0.5, band === 1 ? 'rgba(170,120,255,.45)' : 'rgba(80,255,170,.5)'); a.addColorStop(1, 'rgba(80,255,170,0)');
        g.fillStyle = a; g.beginPath(); g.moveTo(0, h * 0.6);
        for (let x = 0; x <= w; x += 20) g.lineTo(x, h * (0.25 + band * 0.06) + Math.sin(x / (180 + band * 40) + band) * h * 0.08);
        g.lineTo(w, h * 0.6); g.fill();
      }
      hills(h * 0.78, h * 0.03, '#06131f');
      break;
    }
    case 'stars':
      sky([[0, '#060a1f'], [0.8, '#1b2a55'], [1, '#2d3d6b']]);
      for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(255,${230 + r() * 25},${200 + r() * 55},${r()})`; g.beginPath(); g.arc(r() * w, r() * h * 0.85, r() * 1.8, 0, 7); g.fill(); }
      g.fillStyle = 'rgba(200,210,255,.08)'; g.beginPath(); g.ellipse(w * 0.5, h * 0.4, w * 0.6, h * 0.08, -0.4, 0, 7); g.fill();
      hills(h * 0.86, h * 0.03, '#05060c');
      break;
    case 'wheat':
      sky([[0, '#6fb3e8'], [0.45, '#dff0fb'], [0.46, '#e7c25a'], [1, '#b8862a']]);
      sun(w * 0.75, h * 0.2, h * 0.05, 'rgba(255,250,220,1)');
      g.strokeStyle = 'rgba(140,95,25,.5)'; g.lineWidth = 2; for (let i = 0; i < 600; i++) { const x = r() * w, y = h * (0.47 + r() * 0.53); g.beginPath(); g.moveTo(x, y); g.lineTo(x + 4, y - 10 - (y / h) * 18); g.stroke(); }
      break;
    case 'autumn':
      sky([[0, '#f3d9a8'], [0.6, '#e9b97a'], [1, '#6b3d1e']]);
      for (let i = 0; i < 18; i++) { const x = r() * w, y = h * (0.35 + r() * 0.3), rad = h * (0.06 + r() * 0.08); g.fillStyle = `hsl(${10 + r() * 35}, 80%, ${40 + r() * 15}%)`; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill(); g.fillStyle = '#4a2c17'; g.fillRect(x - 5, y, 10, h * 0.4); }
      for (let i = 0; i < 200; i++) { g.fillStyle = `hsl(${15 + r() * 30}, 85%, 50%)`; g.beginPath(); g.ellipse(r() * w, h * (0.8 + r() * 0.2), 7, 4, r() * 3, 0, 7); g.fill(); }
      break;
    case 'rainbow': {
      sky([[0, '#5f7f9f'], [0.5, '#bcd3e6'], [1, '#bcd3e6']]);
      const cols = ['#ff4d4d', '#ff9f40', '#ffe14d', '#5fd35f', '#4da6ff', '#6a5cff', '#b45cff'];
      g.globalAlpha = 0.55; g.lineWidth = h * 0.025;
      cols.forEach((c2, i) => { g.strokeStyle = c2; g.beginPath(); g.arc(w * 0.5, h * 0.95, h * (0.62 - i * 0.025), Math.PI, 0); g.stroke(); });
      g.globalAlpha = 1;
      hills(h * 0.78, h * 0.04, '#5c9c4a'); hills(h * 0.88, h * 0.03, '#3f7a34');
      break;
    }
    case 'island':
      sky([[0, '#3fa3e3'], [0.5, '#c6ecfb'], [0.51, '#2bb3c8'], [1, '#0a6e91']]);
      g.fillStyle = '#f0dba2'; g.beginPath(); g.ellipse(w * 0.5, h * 0.53, w * 0.2, h * 0.04, 0, 0, 7); g.fill();
      g.fillStyle = '#3c8f3a'; g.beginPath(); g.ellipse(w * 0.5, h * 0.5, w * 0.12, h * 0.05, 0, Math.PI, 0); g.fill();
      g.fillStyle = '#5a3d1e'; g.fillRect(w * 0.53, h * 0.3, 10, h * 0.2);
      g.fillStyle = '#2f8a3a'; for (let i = 0; i < 7; i++) { g.beginPath(); g.ellipse(w * 0.53 + 5, h * 0.3, w * 0.06, h * 0.015, i * 0.9, 0, 7); g.fill(); }
      break;
    case 'canyon':
      sky([[0, '#4f9ad8'], [0.4, '#d3e8f5'], [1, '#d3e8f5']]);
      for (let l = 0; l < 5; l++) { g.fillStyle = `hsl(${15 + l * 4}, ${55 + l * 5}%, ${55 - l * 7}%)`; g.beginPath(); g.moveTo(0, h); for (let i = 0; i <= 20; i++) { const x = (i / 20) * w; g.lineTo(x, h * (0.35 + l * 0.12) + (i % 3 === 0 ? -h * 0.06 : 0) + r() * h * 0.02); } g.lineTo(w, h); g.fill(); }
      break;
    case 'storm':
      sky([[0, '#1c222b'], [0.6, '#4a5563'], [1, '#2a3038']]);
      for (let i = 0; i < 12; i++) { g.fillStyle = `rgba(30,35,45,${0.4 + r() * 0.4})`; g.beginPath(); g.ellipse(r() * w, h * r() * 0.35, w * 0.15, h * 0.06, 0, 0, 7); g.fill(); }
      g.strokeStyle = '#fffbe0'; g.lineWidth = 4; g.shadowColor = '#fff7b0'; g.shadowBlur = 20; g.beginPath(); g.moveTo(w * 0.6, h * 0.2);
      for (let y = h * 0.2, x = w * 0.6; y < h * 0.75;) { x += (r() - 0.5) * w * 0.06; y += h * 0.06; g.lineTo(x, y); }
      g.stroke(); g.shadowBlur = 0;
      hills(h * 0.8, h * 0.03, '#161a20');
      break;
    case 'harbor':
      sky([[0, '#f7a26b'], [0.45, '#fbd5a8'], [0.46, '#3b6e8f'], [1, '#1d3e57']]);
      for (let i = 0; i < 6; i++) { const x = w * (0.1 + i * 0.15), y = h * (0.55 + (i % 2) * 0.08); g.fillStyle = ['#d64545', '#f2f2f2', '#3a7bd5', '#f2c94c'][i % 4]; g.beginPath(); g.moveTo(x - 60, y); g.lineTo(x + 60, y); g.lineTo(x + 40, y + 24); g.lineTo(x - 40, y + 24); g.fill(); g.fillStyle = '#5a4636'; g.fillRect(x - 2, y - 110, 4, 110); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x + 4, y - 105); g.lineTo(x + 50, y - 10); g.lineTo(x + 4, y - 10); g.fill(); }
      g.strokeStyle = 'rgba(255,220,180,.35)'; g.lineWidth = 2; for (let i = 0; i < 30; i++) { const y = h * (0.6 + r() * 0.4), x = r() * w; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 40, y); g.stroke(); }
      break;
    case 'lavender':
      sky([[0, '#8fb7e6'], [0.4, '#f4e3f2'], [0.41, '#8a6bbf'], [1, '#4b2f7a']]);
      for (let row = 0; row < 14; row++) { const y = h * (0.42 + (row / 14) ** 1.6 * 0.58); for (let x = 0; x < w; x += 10 + row * 2) { g.fillStyle = `hsl(${265 + r() * 15}, 55%, ${45 + r() * 20}%)`; g.beginPath(); g.ellipse(x + r() * 6, y, 2 + row * 0.8, 4 + row * 1.6, 0, 0, 7); g.fill(); } }
      break;
    case 'balloons':
      sky([[0, '#7cc3f2'], [0.7, '#fbe3c4'], [1, '#f7c99a']]);
      hills(h * 0.82, h * 0.03, '#7a9a5b');
      for (let i = 0; i < 7; i++) {
        const x = w * (0.1 + r() * 0.8), y = h * (0.15 + r() * 0.5), rad = h * (0.03 + r() * 0.06), hue = Math.floor(r() * 360);
        g.fillStyle = `hsl(${hue}, 80%, 55%)`; g.beginPath(); g.arc(x, y, rad, 0, 7); g.fill();
        g.fillStyle = `hsl(${(hue + 40) % 360}, 80%, 65%)`; g.fillRect(x - rad * 0.2, y - rad, rad * 0.4, rad * 2);
        g.strokeStyle = '#5a4636'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - rad * 0.6, y + rad * 0.8); g.lineTo(x - rad * 0.2, y + rad * 1.5); g.moveTo(x + rad * 0.6, y + rad * 0.8); g.lineTo(x + rad * 0.2, y + rad * 1.5); g.stroke();
        g.fillStyle = '#7b5a3a'; g.fillRect(x - rad * 0.2, y + rad * 1.5, rad * 0.4, rad * 0.3);
      }
      break;
  }
  return c.toDataURL('image/jpeg', 0.9);
}
