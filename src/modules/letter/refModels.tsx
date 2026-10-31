// References > Models: the layout rules and a model per type of document for every citation style (APA 7 in
// English and French, MLA, Chicago, IEEE, ISO 690…), each with its pattern, a real example and "Use this model".
// References > Check sources: what each cited source still lacks for the chosen style.

import { useState } from 'react';
import { getLanguage, t, type MessageKey } from '../../shell/i18n';
import { Dialog } from '../../ui/kit';
import {
  CITATION_STYLES, CITATION_STYLE_IDS, SAMPLE_SOURCES, SOURCE_KINDS, entry, inTextCitation, missingFields, patternSource,
  type CitationStyle, type Seg, type Source, type SourceKind,
} from './references';

const DOUBLE: CitationStyle[] = ['apa', 'apaFr', 'mla', 'turabian', 'chicagoAD', 'chicagoNotes', 'asa', 'apsa'];
/** The French adaptations of APA 7 (Université de Montréal, UQAM, HEC Montréal guides). */
const FR_ADAPT: [string, string][] = [['&', 'et'], ['In', 'Dans'], ['Ed(s).', 'dir.'], ['p. / pp.', 'p.'], ['n.d.', 's. d.'], ['2nd ed.', '2e éd.'], ['Retrieved … from', 'Consulté le …, à']];

const Line = ({ segs }: { segs: Seg[] }) => (
  <span>{segs.map((s, i) => (s.italic ? <i key={i}>{s.text}</i> : s.bold ? <b key={i}>{s.text}</b> : <span key={i}>{s.text}</span>))}</span>
);

export function RefModelsDialog({ style, onClose, onUse, onStyle }: {
  style: CitationStyle; onClose: () => void;
  onUse: (kind: SourceKind, st: CitationStyle) => void; onStyle: (st: CitationStyle) => void;
}) {
  const [st, setSt] = useState<CitationStyle>(style);
  const d = CITATION_STYLES[st];
  const fr = st === 'apaFr' || st === 'nfz44' || (getLanguage() === 'fr' && st !== 'apa');
  const numeric = ['bracket', 'paren', 'super'].includes(d.cite);
  const order: MessageKey = d.cite === 'note' ? 'letter.refm.orderNote' : numeric ? 'letter.refm.orderCited' : 'letter.refm.orderAlpha';
  const sample = SAMPLE_SOURCES.article;
  return (
    <Dialog title={t('letter.refm.title')} onClose={onClose}>
      <p className="muted">{t('letter.refm.count', { n: CITATION_STYLE_IDS.length * SOURCE_KINDS.length, s: CITATION_STYLE_IDS.length })}</p>
      <div className="refm-tabs" role="tablist" aria-label={t('letter.citeStyle')}>
        {CITATION_STYLE_IDS.map(id => (
          <button key={id} type="button" role="tab" aria-selected={id === st} className={id === st ? 'on' : ''} onClick={() => setSt(id)}>
            {CITATION_STYLES[id].label}
          </button>
        ))}
      </div>
      <div className="refm-body" role="tabpanel">
        <section className="refm-rules">
          <h3>{t('letter.refm.rules')}</h3>
          <ul>
            <li>{t(order)}</li>
            <li>{t(numeric ? 'letter.refm.indentNum' : 'letter.refm.indent')}</li>
            <li>{t(DOUBLE.includes(st) ? 'letter.refm.double' : 'letter.refm.single')}</li>
            {d.cite !== 'note' && <li>{t('letter.refm.inText')} <code>{inTextCitation(sample, st, 1)}</code> · <code>{inTextCitation(SAMPLE_SOURCES.book, st, 2)}</code></li>}
          </ul>
          {st === 'apaFr' && (
            <>
              <h4>{t('letter.refm.frAdapt')}</h4>
              <ul className="refm-adapt">{FR_ADAPT.map(([a, b]) => <li key={a}><code>{a}</code> → <b>{b}</b></li>)}</ul>
            </>
          )}
          <button type="button" className="btn" onClick={() => { onStyle(st); }}>{t('letter.refm.useStyle')}</button>
        </section>
        {SOURCE_KINDS.map((kind, i) => (
          <section key={kind} className="refm-card">
            <h3>{i + 1}. {t(`letter.sourceKind.${kind}` as MessageKey)}</h3>
            <p><span className="refm-k">{t('letter.refm.format')}</span><Line segs={entry(patternSource(kind, fr), st)} /></p>
            <p><span className="refm-k">{t('letter.refm.example')}</span><Line segs={entry(SAMPLE_SOURCES[kind], st)} /></p>
            <button type="button" className="btn" onClick={() => onUse(kind, st)}>{t('letter.refm.use')}</button>
          </section>
        ))}
      </div>
    </Dialog>
  );
}

export function RefCheckDialog({ sources, style, onClose, onFix }: {
  sources: Source[]; style: CitationStyle; onClose: () => void; onFix: (src: Source, missing: (keyof Source)[]) => void;
}) {
  const rows = sources.map(src => ({ src, missing: missingFields(src, style) })).filter(r => r.missing.length);
  const label = (k: keyof Source) => t(`letter.source.${k}` as MessageKey).replace(/\s*\(.*\)$/, '');
  return (
    <Dialog title={t('letter.refCheck.title')} onClose={onClose}>
      {!rows.length ? <p>✓ {t('letter.refCheck.ok', { style: CITATION_STYLES[style].label })}</p> : (
        <ul className="refm-check">
          {rows.map(({ src, missing }) => (
            <li key={src.id}>
              <Line segs={entry(src, style)} />
              <div><span className="refm-miss">{t('letter.refCheck.missing')} {missing.map(label).join(', ')}</span>
                <button type="button" className="btn" onClick={() => onFix(src, missing)}>{t('letter.refCheck.fix')}</button></div>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
