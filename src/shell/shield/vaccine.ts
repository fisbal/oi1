// The antidote for a document: a clean copy without what could run code.
// For Word, Excel and PowerPoint files (zip packages), the copy drops the macro project, embedded objects,
// ActiveX controls and links to outside templates or objects, and keeps all the text, tables, pictures and styles,
// like Microsoft's "Protected View" + "Content Disarm and Reconstruction" (CDR) gateways do.
import JSZip from 'jszip';

const DROP_RES = [/(^|\/)(vbaProject\.bin|vbaData\.xml|vbaProjectSignature\.bin|vbaProjectSignatureAgile\.bin)$/i, /(^|\/)(embeddings|activeX)\//i, /oleObject\d*\.bin$/i];
const dropped = (path: string) => DROP_RES.some(re => re.test(path));

/** A copy of an Office file without macros, embedded objects or outside links. Null when nothing needed cleaning. */
export async function disinfect(name: string, data: ArrayBuffer): Promise<{ name: string; data: ArrayBuffer; removed: string[] } | null> {
  let zip: JSZip;
  try { zip = await JSZip.loadAsync(data); } catch { return null; }
  const removed: string[] = [];
  for (const path of Object.keys(zip.files)) {
    if (dropped(path) || path.split('/').includes('..')) { zip.remove(path); removed.push(path); }
  }
  for (const path of Object.keys(zip.files).filter(p => p.endsWith('.rels'))) {
    const xml = await zip.file(path)!.async('string');
    const kept = xml.replace(/<Relationship\b[^>]*\/>/g, r => {
      const external = /TargetMode\s*=\s*"External"/i.test(r);
      const target = r.match(/Target\s*=\s*"([^"]*)"/i)?.[1] ?? '';
      const risky = (external && /oleObject|attachedTemplate|frame|subDocument/i.test(r)) || /^(mhtml|ms-msdt|ms-|search-ms|file:)/i.test(target)
        || /vbaProject|oleObject|activeX|embeddings/i.test(target);
      if (risky) removed.push(`${path}: ${target.slice(0, 80)}`);
      return risky ? '' : r;
    });
    if (kept !== xml) zip.file(path, kept);
  }
  // DDE fields become plain text.
  for (const path of Object.keys(zip.files).filter(p => /^word\/(document|header\d*|footer\d*)\.xml$/.test(p))) {
    const xml = await zip.file(path)!.async('string');
    const clean = xml.replace(/(<w:instrText[^>]*>)([^<]*\bDDE(AUTO)?\b[^<]*)(<\/w:instrText>)/g, (_m, a, _t, _d, b) => { removed.push(`${path}: DDE`); return `${a}${b}`; });
    if (clean !== xml) zip.file(path, clean);
  }
  const ct = zip.file('[Content_Types].xml');
  if (ct) {
    const xml = await ct.async('string');
    const clean = xml
      .replace(/application\/vnd\.ms-word\.document\.macroEnabled\.main\+xml/g, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml')
      .replace(/application\/vnd\.ms-excel\.sheet\.macroEnabled\.main\+xml/g, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml')
      .replace(/application\/vnd\.ms-powerpoint\.presentation\.macroEnabled\.main\+xml/g, 'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml')
      .replace(/<(Default|Override)\b[^>]*(vbaProject|vbaData|ms-office\.vbaProject|oleObject|activeX)[^>]*\/>/gi, '');
    if (clean !== xml) zip.file('[Content_Types].xml', clean);
  }
  if (!removed.length) return null;
  const out = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
  const clean = name.replace(/\.(doc|xls|ppt|pot|pps|dot|xlt)m$/i, (_m, b: string) => `.${b}x`).replace(/(\.[a-z]+)$/i, ' (sain)$1');
  return { name: clean, data: out, removed };
}
