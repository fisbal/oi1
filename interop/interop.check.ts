// Office In 1's files open in the equivalent apps, and theirs open in Office In 1, with their look (Martin, 2026-11-06:
// "les fichiers sortant de Office In 1 devraient être lus des autres apps équivalentes et vice versa"). openpyxl,
// python-docx and python-pptx (interop/office.py) stand in for Excel, Word and PowerPoint: independent readers and
// writers that follow the Office file rules with none of Office In 1's code. When LibreOffice is installed it also
// opens each file and turns it into a PDF, like a person opening it in another office suite.
// Run: npm run check:interop   (needs: pip install openpyxl python-docx python-pptx)
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { JSONContent } from '@tiptap/core';
import { readXlsx, xlsxBytes } from '../src/formats/xlsx';
import { computeBook, display, key, type WorkbookData } from '../src/formats/sheet';
import { readPptx, writePptx } from '../src/formats/pptx';
import { newDeck, newSlide, placeholder, THEMES, type Deck } from '../src/formats/slides';
import { readDocx } from '../src/modules/letter/docx/read';
import { letterToDocx } from '../src/modules/letter/docx/write';
import { defaultStyles, type LetterDoc } from '../src/modules/letter/model';
import { contactsFrom, fromEml, newMail, toEml, toVcf } from '../src/modules/mail/model';
import { newPlan, newTask, toIcs } from '../src/modules/plan/model';

const dir = mkdtempSync(join(tmpdir(), 'oi1-interop-'));
const py = (cmd: string, file: string) => execFileSync('python3', ['interop/office.py', cmd, file], { encoding: 'utf8', maxBuffer: 1 << 26 });
const read = (kind: string, file: string) => JSON.parse(py(`read-${kind}`, file));
const bytes = (file: string) => { const b = readFileSync(file); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; };
const blobBytes = (b: Blob) => new Promise<ArrayBuffer>(r => { const fr = new FileReader(); fr.onload = () => r(fr.result as ArrayBuffer); fr.readAsArrayBuffer(b); });
const soffice = ['/usr/bin/soffice', '/usr/bin/libreoffice', '/Applications/LibreOffice.app/Contents/MacOS/soffice'].find(p => existsSync(p));
/** LibreOffice opens the file and prints it to PDF; the PDF's text is returned. */
function libreOffice(file: string): string | null {
  if (!soffice) return null;
  execFileSync(soffice, ['--headless', '--convert-to', 'pdf', '--outdir', dir, file], { stdio: 'ignore', timeout: 120_000 });
  const pdf = file.replace(/\.\w+$/, '.pdf');
  try { return execFileSync('pdftotext', [pdf, '-'], { encoding: 'utf8' }); } catch { return readFileSync(pdf).length > 1000 ? '' : null; }
}
const words = (s: string) => s.replace(/\s+/g, ' ');

describe('In 1 Class and Excel', () => {
  it('a Class workbook opens in Excel with its values, formulas, colours, money, merges and sheets', async () => {
    const book: WorkbookData = {
      currency: 'EUR',
      sheets: [{
        name: 'Budget', widths: { 0: 180 }, merges: [{ c1: 0, r1: 6, c2: 1, r2: 6 }],
        cells: {
          [key(0, 0)]: { input: 'Poste', style: { bold: true, color: '#FFFFFF', fill: '#4472C4' } },
          [key(1, 0)]: { input: 'Montant', style: { bold: true, color: '#FFFFFF', fill: '#4472C4' } },
          [key(0, 1)]: { input: 'Loyer' }, [key(1, 1)]: { input: '1227.5', style: { format: 'currency', currency: 'CAD' } },
          [key(0, 2)]: { input: 'Rent' }, [key(1, 2)]: { input: '900', style: { format: 'currency', currency: 'USD', signFirst: true, italic: true, color: '#C00000', fill: '#FFFF00' } },
          [key(0, 3)]: { input: 'Miete' }, [key(1, 3)]: { input: '750.25', style: { format: 'currency' } },
          [key(0, 4)]: { input: 'Total' }, [key(1, 4)]: { input: '=SUM(B2:B4)', style: { bold: true, borders: { bottom: { style: 'double' } } } },
          [key(0, 5)]: { input: 'Taux' }, [key(1, 5)]: { input: '0.15', style: { format: 'percent' } },
          [key(0, 6)]: { input: 'Fusion', style: { align: 'center' } },
        },
      }, { name: 'Notes', widths: {}, cells: { [key(0, 0)]: { input: 'Deuxième feuille' } } }],
    };
    const file = join(dir, 'class.xlsx');
    writeFileSync(file, Buffer.from(await xlsxBytes(book, 'fr')));
    const x = read('xlsx', file);
    const [s, s2] = x.sheets;
    expect(s.name).toBe('Budget');
    expect(s2.cells.A1.value).toBe('Deuxième feuille');
    expect(s.cells.A1).toMatchObject({ value: 'Poste', bold: true, color: '#ffffff', fill: '#4472c4' });
    expect(s.cells.B2.value).toBe(1227.5);
    expect(s.cells.B2.format).toMatch(/\$-C0C|CA\$/);
    expect(s.cells.B3).toMatchObject({ value: 900, italic: true, color: '#c00000', fill: '#ffff00' });
    expect(s.cells.B3.format).toMatch(/^"\$"/);
    expect(s.cells.B4.format).toMatch(/€/);
    expect(s.cells.B5).toMatchObject({ value: '=SUM(B2:B4)', bold: true, border: 'double' });
    expect(s.cells.B6.format).toBe('0%');
    expect(s.merged).toContain('A7:B7');
    expect(s.widths.A).toBeGreaterThan(20);
    const pdf = libreOffice(file);
    if (pdf !== null) expect(words(pdf)).toMatch(/Poste/);
  });

  it('an Excel workbook opens in Class with its values, formulas, colours, money, dates and merges', async () => {
    const file = join(dir, 'excel.xlsx');
    py('make-xlsx', file);
    const book = await readXlsx(bytes(file));
    const s = book.sheets[0], vals = computeBook(book)[0];
    expect(book.sheets.map(x => x.name)).toEqual(['Budget', 'Notes']);
    expect(s.cells[key(0, 0)]).toMatchObject({ input: 'Poste', style: { bold: true, color: '#FFFFFF', fill: '#4472C4' } });
    const shown = (c: number, r: number) => display(vals.get(key(c, r)) ?? '', s.cells[key(c, r)]?.style, 'fr', book.currency ?? 'EUR').replace(/[\s  ]+/g, ' ');
    expect(shown(1, 1)).toBe('1 227,50 $');
    expect(s.cells[key(1, 1)].style?.currency ?? book.currency).toBe('CAD');
    expect(shown(1, 2)).toBe('$900,00');
    expect(shown(1, 3)).toBe('750,25 €');
    expect(s.cells[key(1, 3)].style).toMatchObject({ italic: true, color: '#C00000', fill: '#FFFF00' });
    expect(s.cells[key(1, 4)].input).toBe('=SUM(B2:B4)');
    expect(vals.get(key(1, 4))).toBeCloseTo(2877.75);
    expect(s.cells[key(1, 4)].style?.borders?.bottom?.style).toBe('double');
    expect(shown(1, 5)).toMatch(/^(06\/11\/2026|2026-11-06)$/);
    expect(shown(1, 6)).toBe('15 %');
    expect(s.merges).toEqual([{ c1: 0, r1: 8, c2: 1, r2: 8 }]);
    expect(s.widths[0]).toBeGreaterThan(104);
  });
});

const text = (t: string, marks?: JSONContent['marks']): JSONContent => (marks ? { type: 'text', text: t, marks } : { type: 'text', text: t });
const para = (content: JSONContent[], attrs?: Record<string, unknown>): JSONContent => ({ type: 'paragraph', attrs, content });
const allText = (n: JSONContent | null | undefined): string => (!n ? '' : n.text ?? (n.content ?? []).map(allText).join(n.type === 'doc' ? '\n' : ''));
const find = (n: JSONContent | undefined, pred: (x: JSONContent) => boolean): JSONContent[] => (!n ? [] : [...(pred(n) ? [n] : []), ...(n.content ?? []).flatMap(k => find(k, pred))]);

describe('In 1 Letter and Word', () => {
  it('a Letter document opens in Word with its headings, bold red text, lists, table, picture, header and page', async () => {
    const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAUCAIAAABwJOjsAAAAJElEQVR4nGM4uUh9QBDDqMWjFo9aPGrxqMWjFo9aPGrxyLEYAB5P6H3GayASAAAAAElFTkSuQmCC';
    const letter: LetterDoc = {
      page: { size: 'letter', orientation: 'portrait', margins: { top: 1, right: 1, bottom: 1, left: 1.25 }, headerDistance: 0.5, footerDistance: 0.5 },
      styles: defaultStyles(), lang: 'fr-FR',
      header: { type: 'doc', content: [para([text('En-tête Office In 1')])] },
      footer: { type: 'doc', content: [para([text('Pied de page')], { textAlign: 'center' })] },
      body: { type: 'doc', content: [
        { type: 'heading', attrs: { level: 1 }, content: [text('Rapport annuel')] },
        para([text('Texte '), text('gras rouge', [{ type: 'bold' }, { type: 'textStyle', attrs: { color: '#C00000' } }]), text(' et '), text('italique', [{ type: 'italic' }])]),
        para([text('Centré')], { textAlign: 'center' }),
        { type: 'bulletList', content: [{ type: 'listItem', content: [para([text('Premier point')])] }, { type: 'listItem', content: [para([text('Deuxième point')])] }] },
        { type: 'table', content: [
          { type: 'tableRow', content: [{ type: 'tableHeader', content: [para([text('Poste')])] }, { type: 'tableHeader', content: [para([text('Montant')])] }] },
          { type: 'tableRow', content: [{ type: 'tableCell', content: [para([text('Loyer')])] }, { type: 'tableCell', content: [para([text('1 227 $')])] }] },
        ] },
        para([{ type: 'image', attrs: { src: PNG, alt: 'logo', width: 40 } }]),
        para([text('Fin du document')]),
      ] },
    };
    const file = join(dir, 'letter.docx');
    writeFileSync(file, Buffer.from(await letterToDocx(letter, 'Rapport')));
    const w = read('docx', file);
    const p = (t: string) => w.paragraphs.find((x: { text: string }) => x.text === t);
    expect(p('Rapport annuel')?.style).toMatch(/Heading 1|Titre 1/);
    const red = p('Texte gras rouge et italique')?.runs.find((r: { text: string }) => r.text.includes('gras rouge'));
    expect(red).toMatchObject({ bold: true, color: '#c00000' });
    expect(p('Texte gras rouge et italique')?.runs.find((r: { text: string }) => r.text.includes('italique'))?.italic).toBe(true);
    expect(p('Centré')?.align).toMatch(/CENTER/);
    expect(p('Premier point')).toBeTruthy();
    expect(w.tables[0]).toEqual([['Poste', 'Montant'], ['Loyer', '1 227 $']]);
    expect(w.images).toBeGreaterThanOrEqual(1);
    expect(w.page).toMatchObject({ width_in: 8.5, height_in: 11, left_in: 1.25 });
    expect(w.header).toContain('En-tête Office In 1');
    expect(w.footer).toContain('Pied de page');
    const pdf = libreOffice(file);
    if (pdf !== null) expect(words(pdf)).toMatch(/Rapport annuel/);
  });

  it('a Word document opens in Letter with its headings, run colours and fonts, lists, table, picture and header', async () => {
    const file = join(dir, 'word.docx');
    py('make-docx', file);
    const d = await readDocx(bytes(file));
    const body = allText(d.body);
    for (const t of ['Rapport annuel', 'Texte gras rouge et italique Georgia 14', 'Centré', 'Premier point', 'Étape un', 'Chiffres', 'Fin du document']) expect(body).toContain(t);
    expect(find(d.body, n => n.type === 'heading' && n.attrs?.level === 1).map(allText)).toContain('Rapport annuel');
    expect(find(d.body, n => n.type === 'heading' && n.attrs?.level === 2).map(allText)).toContain('Chiffres');
    const red = find(d.body, n => n.type === 'text' && n.text === 'gras rouge')[0];
    expect(red.marks?.map(m => m.type)).toContain('bold');
    expect(String(red.marks?.find(m => m.type === 'textStyle')?.attrs?.color).toUpperCase()).toBe('#C00000');
    const georgia = find(d.body, n => n.type === 'text' && !!n.text?.includes('Georgia'))[0];
    expect(georgia.marks?.map(m => m.type)).toContain('italic');
    expect(georgia.marks?.find(m => m.type === 'textStyle')?.attrs).toMatchObject({ fontFamily: expect.stringContaining('Georgia') });
    expect(find(d.body, n => n.type === 'paragraph' && n.attrs?.textAlign === 'center').map(allText)).toContain('Centré');
    expect(find(d.body, n => n.type === 'bulletList')).toHaveLength(1);
    expect(find(d.body, n => n.type === 'orderedList')).toHaveLength(1);
    expect(find(d.body, n => n.type === 'table')[0] && allText(find(d.body, n => n.type === 'table')[0])).toContain('1 227 $');
    expect(find(d.body, n => n.type === 'image')).toHaveLength(1);
    expect(allText(d.header)).toContain('En-tête Word');
    expect(d.page.size).toBe('letter');
  });
});

describe('In 1 Stage and PowerPoint', () => {
  it('a Stage deck opens in PowerPoint with its titles, list, colours, shape, table, picture and notes', async () => {
    const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const d: Deck = newDeck(THEMES[1]);
    d.slides[0].items[0] = { ...d.slides[0].items[0], html: '<p>Présentation <strong>Stage</strong></p>' } as typeof d.slides[0]['items'][0];
    const s = newSlide('content', d);
    s.items = [
      placeholder('content', 'title', d.w, d.h, '<p>Plan</p>'),
      placeholder('content', 'body', d.w, d.h, '<ul><li><p>Un</p></li><li><p><span style="color: #FF0000">Deux en rouge</span></p></li></ul>'),
      { id: 'r', kind: 'shape', geom: 'roundRect', x: 800, y: 500, w: 300, h: 100, html: '<p>Forme verte</p>', fill: '#70AD47' },
      { id: 't', kind: 'table', x: 800, y: 200, w: 360, h: 120, rows: [['A', 'B'], ['1', '2']], header: true },
      { id: 'p', kind: 'image', x: 100, y: 550, w: 100, h: 100, src: PNG, alt: 'point' },
    ] as typeof s.items;
    s.notes = 'Notes du présentateur';
    d.slides.push(s);
    const file = join(dir, 'stage.pptx');
    writeFileSync(file, Buffer.from(await blobBytes(await writePptx(d, 'fr-FR', 'Test'))));
    const p = read('pptx', file);
    expect(p.slides).toHaveLength(2);
    const texts = (i: number) => p.slides[i].shapes.map((x: { text: string | null }) => x.text ?? '').join('\n');
    expect(texts(0)).toContain('Présentation Stage');
    expect(texts(1)).toContain('Plan');
    expect(texts(1)).toContain('Deux en rouge');
    expect(p.slides[1].shapes.flatMap((x: { colors?: string[] }) => x.colors ?? [])).toContain('#ff0000');
    expect(p.slides[1].shapes.find((x: { text: string | null }) => x.text === 'Forme verte')?.fill).toBe('#70ad47');
    expect(p.slides[1].shapes.find((x: { table?: string[][] }) => x.table)?.table).toEqual([['A', 'B'], ['1', '2']]);
    expect(p.slides[1].shapes.some((x: { picture?: boolean }) => x.picture)).toBe(true);
    expect(p.slides[1].notes).toBe('Notes du présentateur');
    const pdf = libreOffice(file);
    if (pdf !== null) expect(words(pdf)).toMatch(/Plan/);
  });

  it('a PowerPoint deck opens in Stage with its titles, list levels, colours, shape, table, picture and notes', async () => {
    const file = join(dir, 'ppt.pptx');
    py('make-pptx', file);
    const d = await readPptx(bytes(file));
    expect(d.slides).toHaveLength(2);
    const html = (i: number) => d.slides[i].items.map(it => ('html' in it ? String(it.html ?? '') : '')).join('\n');
    expect(html(0)).toContain('Présentation PowerPoint');
    expect(html(1)).toContain('Plan');
    expect(html(1)).toMatch(/<ul>.*Un.*<ul>.*Un et demi/s);
    expect(html(1)).toMatch(/Deux en rouge/);
    expect(html(1).toLowerCase()).toMatch(/color:\s*(#ff0000|rgb\(255, 0, 0\))/);
    const shape = d.slides[1].items.find(it => 'html' in it && String(it.html).includes('Forme verte')) as { fill?: string } | undefined;
    expect(shape?.fill?.toUpperCase()).toBe('#70AD47');
    const table = d.slides[1].items.find(it => it.kind === 'table') as { rows?: string[][] } | undefined;
    expect(table?.rows).toEqual([['A', 'B'], ['1', '2']]);
    expect(d.slides[1].items.some(it => it.kind === 'image')).toBe(true);
    expect(d.slides[1].notes).toBe('Notes du présentateur');
  });
});

describe('In 1 Mail and Plan with mail and calendar apps', () => {
  it('a Mail message opens in Outlook, Gmail or Apple Mail with its accents, HTML and attachment', () => {
    const m = newMail('drafts', {
      to: ['Martin <martin@example.com>'], cc: ['Équipe <equipe@example.com>'], subject: 'Budget 2027 — réunion',
      html: '<p>Bonjour <b>Martin</b>, voici le budget.</p>',
      attachments: [{ name: 'note.txt', type: 'text/plain', size: 5, data: btoa('salut') }],
    });
    const file = join(dir, 'mail.eml');
    writeFileSync(file, toEml(m, 'Zoé <zoe@example.com>'));
    const e = read('eml', file);
    expect(e.defects).toEqual([]);
    expect(e.subject).toBe('Budget 2027 — réunion');
    expect(e.from).toContain('Zoé');
    expect(e.cc).toContain('Équipe');
    expect(e.html).toContain('<b>Martin</b>');
    expect(e.text).toContain('voici le budget');
    expect(e.attachments).toEqual([{ name: 'note.txt', type: 'text/plain', size: 5 }]);
  });

  it('a mail from another app opens in Mail with its sender, accents, HTML, colours and attachment', () => {
    const file = join(dir, 'other.eml');
    py('make-eml', file);
    const m = fromEml(readFileSync(file, 'latin1'));
    expect(m.subject).toBe('Réunion de lundi — budget 2027');
    expect(m.from).toContain('Zoé Tremblay');
    expect(m.to).toHaveLength(2);
    expect(m.cc[0]).toContain('Équipe');
    expect(m.html).toContain('<b>Martin</b>');
    expect(m.html).toContain('color:#c00000');
    expect(m.attachments.map(a => [a.name, a.type])).toEqual([['graphique.png', 'image/png']]);
  });

  it('Plan tasks open in Google, Outlook or Apple calendars', () => {
    const p = newPlan('Projet', ['À faire']);
    p.tasks = [{ ...newTask(p.buckets[0].id, 'Réunion, budget; été', '2026-11-09', 2), notes: 'Ligne 1\nLigne 2' }];
    p.tasks[0].due = '2026-11-10';
    const file = join(dir, 'plan.ics');
    writeFileSync(file, toIcs(p));
    const c = read('ics', file);
    expect(c.events).toEqual([{ summary: 'Réunion, budget; été', start: '2026-11-09', end: '2026-11-11', description: 'Ligne 1\nLigne 2' }]);
  });

  it('contacts go to and come from Outlook, Google or Apple contacts (vCard)', () => {
    const file = join(dir, 'contacts.vcf');
    writeFileSync(file, toVcf([{ id: 'a', name: 'Zoé Tremblay', email: 'zoe@example.com', group: 'Travail' }]));
    expect(read('vcf', file).cards).toEqual([{ name: 'Zoé Tremblay', emails: ['zoe@example.com'] }]);
    const other = join(dir, 'other.vcf');
    py('make-vcf', other);
    expect(contactsFrom(readFileSync(other, 'utf8')).map(c => [c.name, c.email])).toEqual([['Zoé Tremblay', 'zoe@example.com'], ['Ana Souza', 'ana@example.com']]);
  });
});
