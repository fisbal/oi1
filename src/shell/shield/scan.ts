// Bouclier, part 1: looks inside a file before Office In 1 opens it.
// Office In 1 never runs macros, embedded programs or PDF scripts, so opening such a file here is already safe;
// the point is to WARN the person, because the same file opened in Word, Excel, Acrobat or Windows could infect
// the computer, and to refuse files that are not what their name says (a program renamed "facture.docx").
// What is looked for follows the usual attack routes seen by CERTs and Microsoft: VBA macros (vbaProject.bin),
// OLE/ActiveX objects, remote templates and links (CVE-2017-0199, CVE-2021-40444, "Follina" CVE-2022-30190),
// DDE fields, RTF \objdata, PDF /JavaScript /Launch /EmbeddedFile /OpenAction, programs disguised as documents,
// zip bombs and "../" paths in archives. Sources: MITRE ATT&CK T1204.002, T1221, T1559.002; Didier Stevens' pdfid
// and oletools (Philippe Lagadec) checks; OWASP File Upload Cheat Sheet.
import JSZip from 'jszip';

export type Level = 'ok' | 'info' | 'warn' | 'danger';
export interface Finding { level: Level; code: string; detail?: string }
export interface FileVerdict { level: Level; findings: Finding[]; kind: string }

const rank: Record<Level, number> = { ok: 0, info: 1, warn: 2, danger: 3 };
export const worst = (fs: { level: Level }[]): Level => fs.reduce<Level>((w, f) => (rank[f.level] > rank[w] ? f.level : w), 'ok');

const MAX_UNZIPPED = 600 * 1024 * 1024; // more than 600 MB once unzipped: a zip bomb, not a document
const MAX_RATIO = 200;
const MAX_ENTRIES = 20000;

function sniff(b: Uint8Array): string {
  const s = (i: number, str: string) => [...str].every((c, k) => b[i + k] === c.charCodeAt(0));
  if (s(0, 'MZ')) return 'exe';
  if (b[0] === 0x7f && s(1, 'ELF')) return 'elf';
  if ((b[0] === 0xcf || b[0] === 0xce) && b[1] === 0xfa && b[2] === 0xed && b[3] === 0xfe) return 'macho';
  if (b[0] === 0xca && b[1] === 0xfe && b[2] === 0xba && b[3] === 0xbe) return 'macho';
  if (s(0, '#!')) return 'script';
  if (s(0, 'PK\x03\x04') || s(0, 'PK\x05\x06')) return 'zip';
  if (b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0) return 'ole';
  if (s(0, '%PDF') || latin1(b.subarray(0, 1024)).includes('%PDF-')) return 'pdf';
  if (s(0, '{\\rt')) return 'rtf';
  if (s(0, '\x89PNG') || s(0, 'GIF8') || (b[0] === 0xff && b[1] === 0xd8) || s(8, 'WEBP')) return 'image';
  return 'other';
}

function latin1(b: Uint8Array): string {
  let out = '';
  for (let i = 0; i < b.length; i += 0x8000) out += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return out;
}

const ext = (name: string) => name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '';
const OFFICE_ZIP = ['docx', 'docm', 'dotx', 'dotm', 'xlsx', 'xlsm', 'xltx', 'xltm', 'xlsb', 'pptx', 'pptm', 'potx', 'potm', 'ppsx', 'ppsm', 'odt', 'ods', 'odp'];
const MACRO_EXT = ['docm', 'dotm', 'xlsm', 'xltm', 'xlsb', 'xlam', 'pptm', 'potm', 'ppsm', 'ppam'];
// Programs that start by a double-click. Script files (.js, .ps1, .bat…) opened in Code+ are only shown as text,
// so they are flagged only when hidden inside a document.
const BINARY_EXT = ['exe', 'scr', 'com', 'msi', 'lnk', 'jar', 'apk', 'dll', 'iso', 'img', 'pif', 'cpl'];
const RUNNABLE_EXT = [...BINARY_EXT, 'bat', 'cmd', 'ps1', 'vbs', 'vbe', 'jse', 'wsf', 'wsh', 'hta', 'reg'];

async function scanZip(bytes: Uint8Array, name: string, out: Finding[]) {
  let zip: JSZip;
  try { zip = await JSZip.loadAsync(bytes); } catch { out.push({ level: 'warn', code: 'broken' }); return; }
  const files = Object.values(zip.files);
  if (files.length > MAX_ENTRIES) out.push({ level: 'danger', code: 'zipbomb', detail: `${files.length}` });
  let total = 0;
  for (const f of files) {
    const size = (f as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
    total += size;
    const p = f.name.replace(/\\/g, '/');
    if (p.startsWith('/') || p.split('/').includes('..')) out.push({ level: 'danger', code: 'traversal', detail: p });
    const low = p.toLowerCase();
    if (/vbaproject\.bin$|vbadata\.xml$/.test(low)) out.push({ level: 'warn', code: 'macro', detail: p });
    else if (/(^|\/)(embeddings|activex)\//.test(low) || /oleobject\d*\.bin$/.test(low)) out.push({ level: 'warn', code: 'ole', detail: p });
    else if (RUNNABLE_EXT.includes(ext(low))) out.push({ level: OFFICE_ZIP.includes(ext(name)) ? 'danger' : 'warn', code: 'program', detail: p });
    if (/\.rels$/.test(low) && !f.dir) {
      const xml = await f.async('string');
      for (const m of xml.matchAll(/<Relationship\b[^>]*>/g)) {
        const r = m[0];
        if (!/TargetMode\s*=\s*"External"/i.test(r)) continue;
        const target = r.match(/Target\s*=\s*"([^"]*)"/i)?.[1] ?? '';
        const type = r.match(/Type\s*=\s*"([^"]*)"/i)?.[1] ?? '';
        if (/^(mhtml|ms-msdt|ms-|search-ms|file:|\\\\)/i.test(target) || /oleObject|attachedTemplate|frame/i.test(type)) out.push({ level: 'danger', code: 'remote', detail: target.slice(0, 120) });
      }
    }
    if (/^(word\/(document|header\d*|footer\d*)\.xml|xl\/externallinks\/.*\.xml)$/.test(low)) {
      const xml = await f.async('string');
      if (/\bDDE(AUTO)?\b/.test(xml) && /instrText|fldSimple|ddeLink/i.test(xml)) out.push({ level: 'danger', code: 'dde' });
    }
  }
  const ratio = bytes.length ? total / bytes.length : 0;
  if (total > MAX_UNZIPPED || (ratio > MAX_RATIO && total > 50 * 1024 * 1024)) out.push({ level: 'danger', code: 'zipbomb', detail: `${Math.round(total / 1048576)} MB` });
  if (MACRO_EXT.includes(ext(name)) && !out.some(f => f.code === 'macro')) out.push({ level: 'info', code: 'macroType' });
}

function scanPdf(text: string, out: Finding[]) {
  const n = (re: RegExp) => (text.match(re) ?? []).length;
  if (n(/\/JavaScript\b|\/JS\b/g)) out.push({ level: 'warn', code: 'pdfJs' });
  if (n(/\/Launch\b/g)) out.push({ level: 'danger', code: 'pdfLaunch' });
  if (n(/\/EmbeddedFiles?\b/g)) out.push({ level: 'warn', code: 'pdfEmbedded' });
  if (n(/\/OpenAction\b|\/AA\b/g) && n(/\/JavaScript\b|\/JS\b|\/Launch\b|\/URI\b|\/SubmitForm\b/g)) out.push({ level: 'warn', code: 'pdfAuto' });
  if (n(/\/RichMedia\b|\/XFA\b/g)) out.push({ level: 'info', code: 'pdfRich' });
}

function scanOle(text: string, name: string, out: Finding[]) {
  // Old .doc/.xls/.ppt: stream names are UTF-16 in the directory.
  const u16 = (s: string) => [...s].map(c => `${c}\0`).join('');
  if (text.includes(u16('_VBA_PROJECT')) || text.includes(u16('VBA')) || text.includes(u16('Macros'))) out.push({ level: 'warn', code: 'macro' });
  if (text.includes(u16('ObjectPool')) || text.includes(u16('\x01Ole10Native'))) out.push({ level: 'warn', code: 'ole' });
  if (/\.(doc|xls|ppt)$/i.test(name)) out.push({ level: 'info', code: 'legacy' });
}

function scanHtml(text: string, out: Finding[]) {
  if (/<script\b/i.test(text) || /\son[a-z]+\s*=/i.test(text) || /javascript:/i.test(text)) out.push({ level: 'info', code: 'htmlScript' });
  if (/<form\b[^>]*action=["']?https?:/i.test(text) && /type=["']?password/i.test(text)) out.push({ level: 'danger', code: 'htmlPhish' });
}

/** Looks inside a file. Never runs anything. */
export async function scanFile(name: string, data: ArrayBuffer): Promise<FileVerdict> {
  const bytes = new Uint8Array(data);
  const kind = sniff(bytes);
  const e = ext(name);
  const out: Finding[] = [];
  if (BINARY_EXT.includes(e)) out.push({ level: 'danger', code: 'program', detail: name });
  if (/\.[a-z0-9]{2,4}\.(exe|scr|com|bat|cmd|js|vbs|hta|lnk)$/i.test(name) || /[‮‭]/.test(name)) out.push({ level: 'danger', code: 'doubleExt', detail: name });
  if (['exe', 'elf', 'macho'].includes(kind) && !BINARY_EXT.includes(e)) out.push({ level: 'danger', code: 'disguised', detail: kind });
  if (kind === 'script' && !['sh', 'py', 'rb', 'pl', 'txt', 'md', 'js', 'mjs', 'cjs', 'ts'].includes(e)) out.push({ level: 'warn', code: 'disguised', detail: 'script' });
  if (OFFICE_ZIP.includes(e) && kind !== 'zip' && kind !== 'ole') out.push({ level: kind === 'other' ? 'warn' : 'danger', code: 'mismatch', detail: kind });
  if (kind === 'zip') await scanZip(bytes, name, out);
  else if (kind === 'ole') scanOle(latin1(bytes.subarray(0, Math.min(bytes.length, 4 * 1024 * 1024))), name, out);
  else if (kind === 'pdf') scanPdf(latin1(bytes), out);
  else if (kind === 'rtf') {
    const t = latin1(bytes);
    if (/\\objdata|\\objupdate|\\objautlink/i.test(t)) out.push({ level: 'danger', code: 'rtfObject' });
  } else if (['html', 'htm', 'svg', 'xhtml'].includes(e)) scanHtml(new TextDecoder().decode(bytes.subarray(0, 4 * 1024 * 1024)), out);
  const seen = new Set<string>();
  const findings = out.filter(f => { const k = `${f.code}|${f.detail ?? ''}`; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 30);
  return { level: worst(findings), findings, kind };
}
