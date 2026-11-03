// In 1 Mail: my e-mail signatures (Martin, 2026-11-03): several (Pro, Perso…), each with name, title, company,
// phone, e-mail, website, address, a logo and the handwritten signature, in 20 looks; one chosen for new mails and
// one for replies. Everything stays on this device with the mailbox.
import { useState } from 'react';
import { t } from '../../shell/i18n';
import { safeHtml } from '../../shell/safeHtml';
import { Dialog } from '../../ui/kit';
import { SignatureDialog } from '../../ui/signature/SignatureDialog';
import { listSignatures } from '../../ui/signature/store';
import type { MailBox } from './model';
import { SIG_LOOKS, sigHtml, type MailSig } from './signatures';

const blank = (box: MailBox, label: string): MailSig => ({
  id: `s-${Date.now().toString(36)}`, label, name: box.me.name, title: '', company: '', phone: '', email: box.me.email, web: '', address: '', look: 0,
});

/** A picture file made smaller (logo: at most 240 px wide) as a PNG data URL. */
async function smallPicture(f: File, max = 240): Promise<string> {
  const src = await new Promise<string>((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = ko; r.readAsDataURL(f); });
  const img = new Image(); img.src = src; await img.decode();
  const k = Math.min(1, max / img.naturalWidth);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
  c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}

export function MailSigsDialog({ box, onClose, onSave }: { box: MailBox; onClose: () => void; onSave: (sigs: MailSig[], sigNew: string, sigReply: string) => void }) {
  const [sigs, setSigs] = useState<MailSig[]>(() => box.sigs?.length ? box.sigs : [blank(box, t('mail.sig.pro'))]);
  const [cur, setCur] = useState(0);
  const [sigNew, setSigNew] = useState(box.sigNew ?? box.sigs?.[0]?.id ?? sigs[0].id);
  const [sigReply, setSigReply] = useState(box.sigReply ?? '');
  const [making, setMaking] = useState(false);
  const [, bump] = useState(0);
  const s = sigs[Math.min(cur, sigs.length - 1)];
  const set = (patch: Partial<MailSig>) => setSigs(all => all.map((x, i) => (i === cur ? { ...x, ...patch } : x)));
  const hands = listSignatures();
  const field = (k: 'label' | 'name' | 'title' | 'company' | 'phone' | 'email' | 'web' | 'address', type = 'text') => (
    <label>{t(`mail.sig.f.${k}`)}<input type={type} value={s[k]} maxLength={k === 'label' ? 60 : 300} onChange={e => set({ [k]: e.target.value })} /></label>
  );

  return (
    <Dialog title={t('mail.sig.title')} onClose={onClose} onOk={() => { onSave(sigs, sigNew, sigReply); return false; }}>
      <div className="ml-sigs">
        <div className="ml-sig-tabs" role="tablist" aria-label={t('mail.sig.title')}>
          {sigs.map((x, i) => <button key={x.id} type="button" role="tab" aria-selected={i === cur} className={i === cur ? 'on' : ''} onClick={() => setCur(i)}>{x.label || t('mail.signature')}</button>)}
          <button type="button" onClick={() => { setSigs(a => [...a, blank(box, a.length === 1 ? t('mail.sig.perso') : `${t('mail.signature')} ${a.length + 1}`)]); setCur(sigs.length); }}>＋ {t('mail.sig.add')}</button>
        </div>
        <div className="ml-form ml-sig-form">
          {field('label')}{field('name')}{field('title')}{field('company')}{field('phone', 'tel')}{field('email', 'email')}{field('web', 'url')}{field('address')}
        </div>
        <div className="ml-sig-pics">
          <div>
            <b>{t('mail.sig.hand')}</b>
            <div className="ml-sig-hands">
              <button type="button" className={!s.hand ? 'on' : ''} onClick={() => set({ hand: undefined })}>{t('mail.sig.noHand')}</button>
              {hands.map(h => (
                <button key={h.id} type="button" className={s.hand === h.png ? 'on' : ''} title={h.name} onClick={() => set({ hand: h.png, handW: 180, handH: Math.round(180 * h.h / h.w) })}>
                  <img src={h.png} alt={t('sig.preview')} />
                </button>
              ))}
              <button type="button" onClick={() => setMaking(true)}>＋ {t('sig.new')}</button>
            </div>
          </div>
          <div>
            <b>{t('mail.sig.logo')}</b>
            <div className="ml-sig-hands">
              {s.logo && <img className="ml-sig-logo" src={s.logo} alt={t('mail.sig.logo')} />}
              <label className="ml-sig-file">{s.logo ? t('mail.sig.otherLogo') : t('mail.sig.pickLogo')}
                <input type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) void smallPicture(f).then(logo => set({ logo })); }} />
              </label>
              {s.logo && <button type="button" onClick={() => set({ logo: undefined })}>{t('mail.sig.noLogo')}</button>}
            </div>
          </div>
        </div>
        <b>{t('mail.sig.looks')}</b>
        <div className="ml-sig-looks" role="listbox" aria-label={t('mail.sig.looks')} data-gallery="Mail signature looks">
          {Array.from({ length: SIG_LOOKS }, (_, look) => (
            <button key={look} type="button" role="option" aria-selected={s.look === look} className={s.look === look ? 'on' : ''} title={t('mail.sig.look', { n: look + 1 })} onClick={() => set({ look })}>
              {/* faults-ok: the preview is our own signature HTML, cleaned by safeHtml */}
              <div className="ml-sig-mini" dangerouslySetInnerHTML={{ __html: safeHtml(sigHtml({ ...s, name: s.name || t('sig.sample'), title: s.title || t('sig.titlePh').replace(/^\S+\s/, ''), look })) }} />
            </button>
          ))}
        </div>
        <div className="ml-form ml-sig-use">
          <label>{t('mail.sig.forNew')}
            <select value={sigNew} onChange={e => setSigNew(e.target.value)}>
              <option value="">{t('mail.sig.none')}</option>
              {sigs.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
          </label>
          <label>{t('mail.sig.forReply')}
            <select value={sigReply} onChange={e => setSigReply(e.target.value)}>
              <option value="">{t('mail.sig.none')}</option>
              {sigs.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
            </select>
          </label>
        </div>
        {sigs.length > 1 && <button type="button" className="ml-sig-del" onClick={() => { const id = s.id; setSigs(a => a.filter(x => x.id !== id)); setCur(0); if (sigNew === id) setSigNew(''); if (sigReply === id) setSigReply(''); }}>{t('mail.sig.delete')}</button>}
        <p className="ml-hint">{t('sig.private')}</p>
      </div>
      {making && <SignatureDialog onClose={() => { setMaking(false); bump(n => n + 1); }} onSaved={h => set({ hand: h.png, handW: 180, handH: Math.round(180 * h.h / h.w) })} />}
    </Dialog>
  );
}
