// The Office In 1 promo kit, made again from the real app at every build, so it is never out of date:
//   dist/promo/info.json            version, date, the apps that are ready (names and lines read from the
//                                   home screen in French and English), links (public/promo/config.json)
//   dist/promo/shots/<lang>-<app>.jpg   a fresh phone screenshot of every ready app, in both languages
//   dist/promo/qr.svg, qr.png       QR code to the install page (get/), which never changes address
//   dist/promo/OfficeIn1-Demo-FR.mp4 / -EN.mp4   the demo (promo/video.html) recorded at 1080x1920, 30 fps
//   dist/promo/OfficeIn1-Guide-FR.pdf / -EN.pdf  the social media guide (promo/guide.html)
//   dist/promo/poster-<lang>-square.png (1080x1080) and -story.png (1080x1920) for posts and statuses
// Run after `npm run build` (CI runs it on every push):  node scripts/promo.mjs
// Exits with an error when a part is missing, so a broken kit is seen on the PR.

import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);
const qrcode = require('qrcode-generator');

const PORT = 4197;
const ROOT = `http://localhost:${PORT}/`;
const OUT = 'dist/promo';
const LANGS = { fr: 'fr-FR', en: 'en-US' };
// Apps filmed in the demo, in this order, when they are ready on the home screen. ProDFos is its own site
// (loaded from the web inside OI1): it is filmed only once its page has really opened, otherwise left out.
const FILMED = ['Letter', 'Class', 'Stage', 'ProDFos', 'Assistant', 'Plan', 'Notes', 'Draw', 'Form', 'Code+'];
const problems = [];

if (!existsSync('dist/index.html')) { console.error('Run `npm run build` first.'); process.exit(1); }
mkdirSync(`${OUT}/shots`, { recursive: true });
mkdirSync(`${OUT}/fonts`, { recursive: true });

// The suite's own fonts, so the kit looks like the app (Playfair Display and DM Sans).
for (const [pkg, file] of [['playfair-display', 'playfair-display-latin-wght-normal.woff2'], ['dm-sans', 'dm-sans-latin-wght-normal.woff2']]) {
  try { copyFileSync(require.resolve(`@fontsource-variable/${pkg}/files/${file}`), `${OUT}/fonts/${file}`); }
  catch { problems.push(`font ${file} not found`); }
}

// Colors of each app, from the module list (one place: src/shell/modules.ts).
const colors = {};
for (const m of readFileSync('src/shell/modules.ts', 'utf8').matchAll(/name: '([^']+)'[^}]*?color: '(#[0-9A-Fa-f]{6})'/g)) colors[m[1]] = m[2];

const config = JSON.parse(readFileSync('public/promo/config.json', 'utf8'));
const upcoming = config.upcoming ?? [];
for (const k of Object.keys(config)) if (k.startsWith('_') || k === 'upcoming') delete config[k];
const version = process.env.OI1_VERSION || JSON.parse(readFileSync('package.json', 'utf8')).version;

// QR code to the install page: the address never changes, so printed codes keep working forever.
const qr = qrcode(0, 'H');
qr.addData(config.get);
qr.make();
writeFileSync(`${OUT}/qr.svg`, qr.createSvgTag({ cellSize: 10, margin: 4, scalable: true }).replace('<svg ', '<svg role="img" aria-label="QR Office In 1" '));

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
for (let i = 0; i < 80; i++) {
  try { if ((await fetch(ROOT)).ok) break; } catch { /* not up yet */ }
  await new Promise(r => setTimeout(r, 500));
}

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, colorScheme: 'dark' };
const info = { version, built: new Date().toISOString(), commit: (process.env.GITHUB_SHA || '').slice(0, 7), links: config, apps: {}, shots: {} };

try {
  // 1. The apps that are ready, read from the real home screen, and a fresh screenshot of each.
  for (const [lang, locale] of Object.entries(LANGS)) {
    const ctx = await browser.newContext({ ...PHONE, locale });
    const page = await ctx.newPage();
    await page.goto(ROOT);
    await page.waitForTimeout(1500);
    const slabs = await page.$$eval('.slab', els => els.map(e => ({
      name: e.querySelector('.name')?.textContent?.trim() ?? '', kind: e.querySelector('.kind')?.textContent?.trim() ?? '',
      ready: !e.classList.contains('soon'),
    })));
    if (slabs.filter(s => s.ready).length < 3) problems.push(`${lang}: only ${slabs.filter(s => s.ready).length} ready apps on the home screen`);
    info.apps[lang] = slabs.map(s => ({ ...s, short: s.name.replace(/^In 1 /, ''), color: colors[s.name] ?? '#D4A843' }));
    // Announced apps not on the home screen yet (config.json "upcoming") count as coming soon.
    for (const u of upcoming) if (!slabs.some(s => s.name === u.name)) {
      info.apps[lang].push({ name: u.name, kind: u.kind?.[lang] ?? '', ready: false, short: u.name.replace(/^In 1 /, ''), color: u.color ?? '#D4A843' });
    }
    await page.screenshot({ path: `${OUT}/shots/${lang}-home.jpg`, type: 'jpeg', quality: 84 });
    info.shots[lang] = { home: `shots/${lang}-home.jpg` };
    await ctx.close();

    for (const app of FILMED) {
      if (!slabs.some(s => s.ready && s.name === `In 1 ${app}`)) continue;
      const c = await browser.newContext({ ...PHONE, locale });
      const p = await c.newPage();
      const errors = [];
      p.on('pageerror', e => errors.push(e.message));
      await p.goto(ROOT);
      await p.waitForTimeout(600);
      await p.locator(`.slab:has-text("In 1 ${app}")`).first().click();
      await p.waitForTimeout(1800);
      const host = p.locator('.module-host:not([hidden])');
      try {
        // A document worth seeing rather than an empty page (best effort: the plain app is kept otherwise).
        if (app === 'Letter') {
          await host.locator('.ribbon-tabs [role=tab]').nth(8).click({ timeout: 2000 });
          await p.waitForTimeout(300);
          await host.locator('.ribbon-panel .drop').nth(2).locator('button').first().click({ timeout: 2000 });
          await p.waitForTimeout(300);
          await p.locator('.drop-panel .menu-item').first().click({ timeout: 2000 });
          await p.waitForTimeout(900);
        }
        if (app === 'Stage') {
          await host.locator('.ribbon-tabs [role=tab]').nth(2).click({ timeout: 2000 });
          await p.waitForTimeout(600);
        }
        if (app === 'Class') {
          // A small table, typed like a person would, so the sheet is not empty.
          const rows = lang === 'fr' ? [['Mois', 'Ventes', 'Dépenses'], ['Janvier', '1200', '800'], ['Février', '1850', '950'], ['Mars', '2400', '1100'], ['Total', '=SUM(B2:B4)', '=SUM(C2:C4)']]
            : [['Month', 'Sales', 'Costs'], ['January', '1200', '800'], ['February', '1850', '950'], ['March', '2400', '1100'], ['Total', '=SUM(B2:B4)', '=SUM(C2:C4)']];
          const area = await host.locator('.cells-area').boundingBox({ timeout: 2000 });
          await p.mouse.click(area.x + 12, area.y + 8);
          for (const r of rows) {
            for (const [i, v] of r.entries()) { await p.keyboard.type(v); await p.keyboard.press(i < r.length - 1 ? 'Tab' : 'Enter'); }
          }
          await p.waitForTimeout(500);
        }
        if (app === 'Code+') {
          const tpl = p.locator('.code .tpl').first();
          if (await tpl.count()) { await tpl.click({ timeout: 2000 }); await p.waitForTimeout(1200); }
        }
      } catch { /* the plain app is a fine picture too */ }
      if (app === 'ProDFos') {
        let up = false;
        for (let i = 0; i < 30 && !up; i++) {
          await p.waitForTimeout(500);
          for (const f of p.frames()) if (f !== p.mainFrame() && /prodfos/.test(f.url())) up = await f.evaluate(() => !!document.querySelector('flutter-view, flt-glass-pane, flt-scene-host')).catch(() => false);
        }
        if (!up) { console.log(`${lang}: ProDFos did not open (no network?), left out of the demo`); await c.close(); continue; }
        await p.waitForTimeout(1500);
      }
      const key = app.replace('+', 'plus').toLowerCase();
      await p.screenshot({ path: `${OUT}/shots/${lang}-${key}.jpg`, type: 'jpeg', quality: 84 });
      info.shots[lang][key] = `shots/${lang}-${key}.jpg`;
      for (const e of errors) problems.push(`${lang} ${app}: script error: ${e}`);
      await c.close();
    }
  }
  writeFileSync(`${OUT}/info.json`, JSON.stringify(info, null, 2));

  // 2. QR as PNG too (WhatsApp and printing like a picture better than an SVG).
  {
    const c = await browser.newContext({ viewport: { width: 1024, height: 1024 } });
    const p = await c.newPage();
    await p.setContent(`<body style="margin:0;background:#fff">${readFileSync(`${OUT}/qr.svg`, 'utf8').replace('<svg ', '<svg style="width:1024px;height:1024px;display:block" ')}</body>`);
    await p.screenshot({ path: `${OUT}/qr.png` });
    await c.close();
  }

  // 3. The demo video, filmed at 1080x1920 from the HTML demo, then made into MP4 (H.264, works everywhere).
  const ffmpeg = process.env.FFMPEG || 'ffmpeg';
  for (const lang of Object.keys(LANGS)) {
    const dir = `${OUT}/rec-${lang}`;
    rmSync(dir, { recursive: true, force: true });
    const c = await browser.newContext({ viewport: { width: 1080, height: 1920 }, recordVideo: { dir, size: { width: 1080, height: 1920 } } });
    const opened = Date.now();
    const p = await c.newPage();
    await p.goto(`${ROOT}promo/video.html?lang=${lang}&rec=1`);
    await p.waitForFunction(() => window.promoReady === true, null, { timeout: 30000 });
    const start = (Date.now() - opened) / 1000;
    const length = await p.evaluate(() => window.promoLength);
    await p.waitForFunction(() => window.promoDone === true, null, { timeout: (length + 20) * 1000 });
    await p.waitForTimeout(400);
    await c.close();
    const webm = readdirSync(dir).find(f => f.endsWith('.webm'));
    const mp4 = `${OUT}/OfficeIn1-Demo-${lang.toUpperCase()}.mp4`;
    const r = spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-ss', String(Math.max(0, start)), '-i', `${dir}/${webm}`, '-t', String(length),
      '-vf', 'fps=30,scale=1080:1920:flags=lanczos', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart', '-an', mp4], { stdio: 'inherit' });
    if (r.status !== 0) problems.push(`${lang}: ffmpeg could not make the MP4`);
    rmSync(dir, { recursive: true, force: true });
    info.videoSeconds = length;
  }
  writeFileSync(`${OUT}/info.json`, JSON.stringify(info, null, 2));

  // 4. Posters (square post and story) from the demo's last scene, in both languages.
  for (const lang of Object.keys(LANGS)) {
    for (const [kind, size] of [['square', { width: 1080, height: 1080 }], ['story', { width: 1080, height: 1920 }]]) {
      const c = await browser.newContext({ viewport: size });
      const p = await c.newPage();
      await p.goto(`${ROOT}promo/video.html?lang=${lang}&scene=end&rec=1&format=${kind}`);
      await p.waitForFunction(() => window.promoReady === true, null, { timeout: 30000 });
      await p.waitForTimeout(2600);
      await p.screenshot({ path: `${OUT}/poster-${lang}-${kind}.png` });
      await c.close();
    }
  }

  // 5. The guide (after the video, so it states its real length) as PDF (US Letter, as printed in Québec).
  for (const lang of Object.keys(LANGS)) {
    const c = await browser.newContext({ viewport: { width: 816, height: 1056 } });
    const p = await c.newPage();
    await p.goto(`${ROOT}promo/guide.html?lang=${lang}`);
    await p.waitForFunction(() => window.promoReady === true, null, { timeout: 30000 });
    await p.waitForTimeout(500);
    // More apps or longer lines must never push a section under a page's footer.
    const over = await p.evaluate(() => [...document.querySelectorAll('.page')].map((pg, i) => {
      const f = pg.querySelector('.foot'); if (!f) return null;
      const top = f.getBoundingClientRect().top;
      const worst = Math.max(...[...pg.querySelectorAll('.apps, .why, .caps, table, .note, .src, .install, ul')].map(e => e.getBoundingClientRect().bottom));
      return worst > top + 1 ? `page ${i + 1} runs under its footer by ${Math.round(worst - top)}px` : null;
    }).filter(Boolean));
    for (const o of over) problems.push(`guide ${lang}: ${o}`);
    await p.pdf({ path: `${OUT}/OfficeIn1-Guide-${lang.toUpperCase()}.pdf`, format: 'Letter', printBackground: true, preferCSSPageSize: true });
    await c.close();
  }

} finally {
  await browser.close();
  server.kill();
}

// Everything the kit page links to must exist and not be empty.
const need = ['info.json', 'qr.svg', 'qr.png'];
for (const l of Object.keys(LANGS)) need.push(`OfficeIn1-Demo-${l.toUpperCase()}.mp4`, `OfficeIn1-Guide-${l.toUpperCase()}.pdf`, `poster-${l}-square.png`, `poster-${l}-story.png`);
for (const f of need) if (!existsSync(`${OUT}/${f}`) || statSync(`${OUT}/${f}`).size < 500) problems.push(`${f} is missing`);
for (const lang of Object.keys(LANGS)) if (Object.keys(info.shots[lang] ?? {}).length < 4) problems.push(`${lang}: fewer than 4 screenshots`);

if (problems.length) { console.error('Promo kit problems:\n- ' + problems.join('\n- ')); process.exit(1); }
console.log(`Promo kit ${version}: ${need.length} files, ${Object.keys(info.shots.fr).length} screenshots per language.`);
