// Word fidelity in In 1 Letter (Martin, 2026-10-31: "teste Convertir avec In 1 Letter, vérifier si tout est ok" with his
// 3-page Conversion Test A). Opens that file like a person, on PC and phone, and checks what his checklist asks: 3 pages
// when printed to PDF, the tab stops at 2", 4" (center) and 6.5" (right), the numbered list going 1, a, b, 2, 3, the
// bullets on 3 levels, the footnote, the link, the table and the control sentence; then saves it as .docx and checks
// the tab stops and the table come back.
// Run after `npm run build`:
//   node scripts/check-fidelity.mjs
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4198;
const FILE = 'src/modules/letter/__tests__/fixtures/conversion-test-a.docx';
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 500)); }

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const problems = [], passed = [];
const check = (ok, what) => (ok ? passed : problems).push(what);
const BODY = '.module-host:not([hidden]) .sheet .ProseMirror:not(.header-text):not(.footer-text)';

for (const [name, viewport, mobile] of [['PC', { width: 1440, height: 900 }, false], ['Phone', { width: 390, height: 844 }, true]]) {
  const ctx = await browser.newContext({ viewport, locale: 'en-US', isMobile: mobile, hasTouch: mobile, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(`${name}: script error: ${e.message}`));
  await page.addInitScript(() => { delete window.showOpenFilePicker; delete window.showSaveFilePicker; });
  await page.goto(url);
  await page.locator('.slab:has-text("In 1 Letter")').first().click();
  await page.waitForTimeout(1500);
  await page.locator(BODY).first().click();
  const chooser = page.waitForEvent('filechooser');
  await page.keyboard.press('Control+o');
  await (await chooser).setFiles(FILE);
  await page.waitForFunction(b => document.querySelector(b)?.textContent.includes('END-OF-DOCUMENT'), BODY, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(800);

  const r = await page.evaluate(b => {
    const body = document.querySelector(b);
    const para = body.querySelector('[data-tabs]');
    const scale = para ? para.getBoundingClientRect().width / para.offsetWidth : 1;
    const x0 = para?.getBoundingClientRect().left ?? 0;
    const at = node => (node ? (node.getBoundingClientRect().left - x0) / scale : NaN);
    const tabs = para ? [...para.querySelectorAll('.tab-x')] : [];
    // Where each piece of text after a tab starts and ends (px from the margin).
    const piece = t => { const r = document.createRange(); r.setStartAfter(t); const n = t.nextSibling; if (n) r.setEndAfter(n); const b = r.getBoundingClientRect(); return [(b.left - x0) / scale, (b.right - x0) / scale]; };
    const nested = [...body.querySelectorAll('ol ol')][0];
    return {
      tabs: tabs.length, left: tabs[0] ? piece(tabs[0])[0] : NaN,
      center: tabs[1] ? (piece(tabs[1])[0] + piece(tabs[1])[1]) / 2 : NaN, right: tabs[2] ? piece(tabs[2])[1] : NaN,
      nestedType: nested ? getComputedStyle(nested).listStyleType : '',
      bulletDepth: body.querySelectorAll('ul ul ul li').length,
      footnotes: body.querySelectorAll('.fn-ref, [data-footnote]').length,
      links: body.querySelectorAll('a[href]').length,
      rows: body.querySelector('table')?.querySelectorAll('tr').length ?? 0,
      cols: body.querySelector('table tr')?.children.length ?? 0,
      control: body.textContent.includes('Le vif renard brun saute par-dessus le chien paresseux — 0123456789'),
      width: para ? para.offsetWidth : 0,
      inside: para ? tabs.every(t => at(t) + t.getBoundingClientRect().width / scale <= para.offsetWidth + 1) : false,
    };
  }, BODY);
  const near = (v, want) => Math.abs(v - want) <= 3;
  check(r.tabs === 3, `${name}: the three tabs are laid out (${r.tabs})`);
  check(near(r.left, 192), `${name}: "Left 2″" starts at 2″ (${r.left.toFixed(1)} px of 192)`);
  if (r.width >= 624) {
    check(near(r.center, 384), `${name}: "Center 4″" is centered on 4″ (${r.center.toFixed(1)} px of 384)`);
    check(near(r.right, 624), `${name}: "Right 6.5″" ends at 6.5″ (${r.right.toFixed(1)} px of 624)`);
  } else {
    // The phone's reading view is narrower than 6.5″: stops past the line are skipped, no tab runs off the line.
    check(r.inside, `${name}: on the narrow phone view, no tab runs past the end of the line`);
  }
  check(r.nestedType === 'lower-alpha', `${name}: the numbered list goes 1, a, b, 2, 3 (${r.nestedType})`);
  check(r.bulletDepth >= 1, `${name}: the bullet list keeps 3 levels`);
  check(r.footnotes === 1 && r.links >= 1, `${name}: 1 footnote and the link are there (${r.footnotes}, ${r.links})`);
  check(r.rows === 5 && r.cols === 4, `${name}: the table has 5 rows × 4 columns (${r.rows} × ${r.cols})`);
  check(r.control, `${name}: the control sentence is word for word`);

  if (!mobile) {
    // Printed to PDF: exactly 3 pages.
    await page.emulateMedia({ media: 'print' });
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    check(pages === 3, `${name}: printed to PDF it has exactly 3 pages (${pages})`);
    await page.emulateMedia({ media: 'screen' });
    // Saved as .docx: the tab stops and the table margins are written.
    const dl = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
    await page.locator(BODY).first().click();
    await page.keyboard.press('Control+s');
    const d = await dl;
    if (d) {
      const JSZip = (await import('jszip')).default;
      const xml = await (await JSZip.loadAsync(readFileSync(await d.path()))).file('word/document.xml').async('string');
      check(xml.includes('w:pos="2880"') && xml.includes('w:val="center" w:pos="5760"') && xml.includes('w:val="right" w:pos="9360"'), `${name}: the saved .docx keeps the tab stops`);
      check(/<w:tblCellMar>/.test(xml) && (xml.match(/<w:tr[ >]/g) ?? []).length === 5, `${name}: the saved .docx keeps the table and its cell margins`);
    } else check(false, `${name}: saving gives a .docx`);
  }
  await ctx.close();
}

await browser.close();
try { process.kill(-server.pid); } catch { /* already gone */ }
for (const p of passed) console.log(`ok  ${p}`);
for (const p of problems) console.log(`NO  ${p}`);
console.log(`\n${passed.length} passed, ${problems.length} problems`);
process.exit(problems.length ? 1 : 0);
