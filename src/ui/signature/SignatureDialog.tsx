// Make a signature (Martin, 2026-11-03): draw it with a finger, mouse or pen; type it in one of 21 handwriting
// styles; or import a photo of it (the paper is made transparent). Initials come with it. Kept on this device only.
import { useEffect, useRef, useState } from 'react';
import { t } from '../../shell/i18n';
import { Dialog } from '../kit';
import {
  INK_COLORS, SIGNATURE_FONTS, fontLabel, importedInk, initialsOf, newId, saveSignature, trimCanvas, typedInk,
  type Ink, type Signature, type SignatureKind,
} from './store';
import './signature.css';

const PAD_W = 560, PAD_H = 190, SCALE = 2;

export function SignatureDialog({ onClose, onSaved, start = 'draw' }: { onClose: () => void; onSaved: (s: Signature) => void; start?: SignatureKind }) {
  const [kind, setKind] = useState<SignatureKind>(start);
  const [name, setName] = useState(() => { try { return localStorage.getItem('oi1.signatures.name') ?? ''; } catch { return ''; } });
  const [title, setTitle] = useState(() => { try { return localStorage.getItem('oi1.signatures.title') ?? ''; } catch { return ''; } });
  const [color, setColor] = useState(INK_COLORS[1]);
  const [font, setFont] = useState(SIGNATURE_FONTS[0]);
  const [typed, setTyped] = useState('');
  const [photo, setPhoto] = useState<Ink | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pad = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<{ x: number; y: number }[][]>([]);
  const [inked, setInked] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const text = typed || name;

  // ---- the drawing pad: smooth strokes (midpoint curves), a little thinner when the hand moves fast
  const redraw = () => {
    const c = pad.current; const g = c?.getContext('2d');
    if (!c || !g) return;
    g.clearRect(0, 0, c.width, c.height);
    g.strokeStyle = color; g.lineCap = 'round'; g.lineJoin = 'round';
    for (const s of strokes.current) {
      if (s.length === 1) { g.beginPath(); g.fillStyle = color; g.arc(s[0].x, s[0].y, 2.2 * SCALE, 0, Math.PI * 2); g.fill(); continue; }
      for (let i = 1; i < s.length; i++) {
        const a = s[i - 1], b = s[i];
        const speed = Math.hypot(b.x - a.x, b.y - a.y);
        g.lineWidth = Math.max(1.6, 4.2 - speed / 14) * SCALE / 2 + 1.2;
        const m0 = i > 1 ? { x: (s[i - 2].x + a.x) / 2, y: (s[i - 2].y + a.y) / 2 } : a;
        const m1 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        g.beginPath(); g.moveTo(m0.x, m0.y); g.quadraticCurveTo(a.x, a.y, m1.x, m1.y); g.stroke();
      }
    }
  };
  useEffect(redraw); // colour change
  const at = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (e.currentTarget.width / r.width), y: (e.clientY - r.top) * (e.currentTarget.height / r.height) };
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    strokes.current.push([at(e)]); setInked(true); redraw();
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!e.buttons && e.pointerType === 'mouse') return;
    const s = strokes.current[strokes.current.length - 1];
    if (!s || !e.currentTarget.hasPointerCapture?.(e.pointerId)) return;
    s.push(at(e)); redraw();
  };
  const up = (e: React.PointerEvent<HTMLCanvasElement>) => { try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* */ } };

  const pickPhoto = async (f: File | undefined) => {
    if (!f) return;
    setError('');
    const src = await new Promise<string>((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = ko; r.readAsDataURL(f); });
    try { setPhoto(await importedInk(src)); } catch { setError(t('sig.badPhoto')); }
  };

  const make = async (): Promise<Ink | null> => {
    if (kind === 'draw') return pad.current ? trimCanvas(pad.current) : null;
    if (kind === 'type') return typedInk(text, font, color);
    return photo;
  };
  const ok = () => {
    if (busy) return false;
    setBusy(true); setError('');
    void (async () => {
      try {
        const ink = await make();
        if (!ink) { setError(t(kind === 'draw' ? 'sig.drawFirst' : kind === 'type' ? 'sig.typeFirst' : 'sig.photoFirst')); return; }
        const ini = initialsOf(name || text);
        const s: Signature = {
          ...ink, id: newId(), kind, name: name.trim(), title: title.trim(), color, created: Date.now(),
          font: kind === 'type' ? font : undefined,
          initials: ini ? await typedInk(ini, font, color) ?? undefined : undefined,
        };
        try { localStorage.setItem('oi1.signatures.name', name.trim()); localStorage.setItem('oi1.signatures.title', title.trim()); } catch { /* */ }
        try { saveSignature(s); } catch { setError(t('sig.full')); return; }
        onSaved(s); onClose();
      } finally { setBusy(false); }
    })();
    return false;
  };

  return (
    <Dialog title={t('sig.make')} onClose={onClose} onOk={ok}>
      <div className="sig-maker">
        <div className="sig-modes" role="tablist" aria-label={t('sig.make')}>
          {(['draw', 'type', 'image'] as const).map(k => (
            <button key={k} type="button" role="tab" aria-selected={kind === k} className={kind === k ? 'on' : ''} onClick={() => { setKind(k); setError(''); }}>
              {t(`sig.mode.${k}`)}
            </button>
          ))}
        </div>
        <div className="sig-fields">
          <label>{t('sig.name')}<input value={name} maxLength={80} onChange={e => setName(e.target.value)} placeholder={t('sig.namePh')} /></label>
          <label>{t('sig.title')}<input value={title} maxLength={80} onChange={e => setTitle(e.target.value)} placeholder={t('sig.titlePh')} /></label>
        </div>
        <div className="sig-colors" role="radiogroup" aria-label={t('sig.color')}>
          {INK_COLORS.map(c => (
            <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={t(`sig.ink.${INK_COLORS.indexOf(c) as 0 | 1 | 2 | 3}`)} title={t(`sig.ink.${INK_COLORS.indexOf(c) as 0 | 1 | 2 | 3}`)}
              className={color === c ? 'on' : ''} style={{ background: c }} onClick={() => setColor(c)} />
          ))}
        </div>

        {kind === 'draw' && (
          <div className="sig-pad-wrap">
            <canvas ref={pad} className="sig-pad" width={PAD_W * SCALE} height={PAD_H * SCALE} aria-label={t('sig.padLabel')}
              onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
            {!inked && <span className="sig-pad-hint" aria-hidden="true">{t('sig.padHint')}</span>}
            <div className="sig-pad-line" aria-hidden="true" />
            <div className="sig-pad-tools">
              <button type="button" onClick={() => { strokes.current.pop(); setInked(strokes.current.length > 0); redraw(); }} disabled={!inked}>{t('sig.undoStroke')}</button>
              <button type="button" onClick={() => { strokes.current = []; setInked(false); redraw(); }} disabled={!inked}>{t('sig.clear')}</button>
            </div>
          </div>
        )}

        {kind === 'type' && (
          <>
            <label className="sig-typed">{t('sig.typeLabel')}<input value={text} maxLength={60} onChange={e => setTyped(e.target.value)} placeholder={t('sig.namePh')} /></label>
            <div className="sig-styles" role="listbox" aria-label={t('sig.styles')} data-gallery="Signature styles">
              {SIGNATURE_FONTS.map(f => (
                <button key={f} type="button" role="option" aria-selected={font === f} className={font === f ? 'on' : ''} title={fontLabel(f)} onClick={() => setFont(f)}>
                  <span style={{ fontFamily: `"${f}", cursive`, color, ['--n' as string]: Math.max(6, (text || t('sig.sample')).length) }}>{text || t('sig.sample')}</span>
                  <small translate="no">{fontLabel(f)}</small>
                </button>
              ))}
            </div>
          </>
        )}

        {kind === 'image' && (
          <div className="sig-photo">
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => void pickPhoto(e.target.files?.[0])} />
            <button type="button" className="sig-photo-pick" onClick={() => fileRef.current?.click()}>{photo ? t('sig.otherPhoto') : t('sig.pickPhoto')}</button>
            <p className="sig-note">{t('sig.photoTip')}</p>
            {photo && <div className="sig-preview"><img src={photo.png} alt={t('sig.preview')} /></div>}
          </div>
        )}

        {kind !== 'image' || photo ? (
          <p className="sig-note">{t('sig.initialsNote', { ini: initialsOf(name || text) || '—' })} {t('sig.private')}</p>
        ) : <p className="sig-note">{t('sig.private')}</p>}
        {error && <p className="sig-error" role="alert">{error}</p>}
      </div>
    </Dialog>
  );
}
