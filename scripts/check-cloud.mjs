// AutoSave to the cloud, GitHub first (Martin chose "les trois, dans l'ordre": GitHub, Google Drive, OneDrive).
// GitHub is played by the test (same answers as api.github.com), so it runs offline and never touches a real account.
// Connect once, type in Letter, Class and Stage: each document lands in the private repository by itself, the app bar
// says "Saved to GitHub", and documents in the cloud open again from the list. On PC and phone.
// Run after `npm run build`:
//   node scripts/check-cloud.mjs
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4191;
const CLOUD_MS = 9000; // 6 s pause after the last change, then the commit
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 60; i++) { try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ } await new Promise(r => setTimeout(r, 500)); }

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const problems = [], passed = [];
const check = (ok, what) => (ok ? passed : problems).push(what);

/** A tiny api.github.com for one person, "martin", whose token is "tok". */
async function fakeGitHub(ctx) {
  const gh = { repos: new Map(), puts: [] };
  let n = 0;
  await ctx.route('https://api.github.com/**', async route => {
    const req = route.request();
    const u = new URL(req.url());
    const path = decodeURIComponent(u.pathname);
    const method = req.method();
    const reply = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body), headers: { 'Access-Control-Allow-Origin': '*' } });
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' } });
    if (req.headers().authorization !== 'Bearer tok') return reply(401, { message: 'Bad credentials' });
    if (path === '/user') return reply(200, { login: 'martin', name: 'Martin' });
    if (method === 'POST' && path === '/user/repos') { const b = req.postDataJSON(); gh.repos.set(b.name, { private: b.private, files: new Map() }); return reply(201, { default_branch: 'main' }); }
    const m = path.match(/^\/repos\/martin\/([^/]+)(?:\/contents\/(.*))?$/);
    const repo = m && gh.repos.get(m[1]);
    if (!repo) return reply(404, { message: 'Not Found' });
    if (m[2] === undefined) return reply(200, { default_branch: 'main' });
    const file = m[2];
    if (method === 'GET' && file === '') return reply(200, [...repo.files].map(([p, f]) => ({ type: 'file', name: p, path: p, size: f.bytes.length, sha: f.sha })));
    if (method === 'GET') {
      const f = repo.files.get(file);
      if (!f) return reply(404, { message: 'Not Found' });
      if ((req.headers().accept ?? '').includes('raw')) return route.fulfill({ status: 200, body: f.bytes, headers: { 'Access-Control-Allow-Origin': '*' } });
      return reply(200, { sha: f.sha });
    }
    if (method === 'PUT') {
      const b = req.postDataJSON();
      const now = repo.files.get(file);
      if (now && b.sha !== now.sha) return reply(409, { message: 'sha does not match' });
      const sha = `s${++n}`;
      repo.files.set(file, { bytes: Buffer.from(b.content, 'base64'), sha });
      gh.puts.push({ file, size: Buffer.from(b.content, 'base64').length, message: b.message });
      return reply(now ? 200 : 201, { content: { sha } });
    }
    return reply(405, { message: 'no' });
  });
  return gh;
}

const APPS = [
  { app: 'Letter', ext: '.docx', magic: 'PK', type: async page => { await page.locator('.app-frame:not([hidden]) .body-text').click(); await page.keyboard.type('Hello cloud. ', { delay: 10 }); } },
  { app: 'Class', ext: '.xlsx', magic: 'PK', type: async page => { const a = await page.locator('.app-frame:not([hidden]) .cells-area').boundingBox(); await page.mouse.click(a.x + 60, a.y + 12); await page.keyboard.type('4242'); await page.keyboard.press('Enter'); } },
  { app: 'Stage', ext: '.pptx', magic: 'PK', type: async page => { await page.locator('.app-frame:not([hidden]) .st-canvas .st-item').first().click(); await page.waitForTimeout(200); await page.keyboard.type('Cloud', { delay: 10 }); await page.keyboard.press('Escape'); } },
];

async function connect(page, where) {
  const panel = page.locator('.cloud-panel');
  check(await panel.isVisible(), `${where}: the cloud panel opens`);
  const box = await panel.boundingBox();
  const vp = page.viewportSize();
  check(!!box && box.x >= -1 && box.x + box.width <= vp.width + 1 && box.y + box.height <= vp.height + 1, `${where}: the cloud panel fits the screen (${Math.round(box?.x)}..${Math.round((box?.x ?? 0) + (box?.width ?? 0))} of ${vp.width})`);
  check(await panel.locator('a[href*="github.com/settings/tokens/new"]').count() === 1, `${where}: a link makes the token in one click`);
  await panel.locator('input[type=password]').fill('wrong');
  await panel.locator('button.primary').click();
  await page.waitForTimeout(500);
  check(/Bad credentials/.test(await panel.innerText()), `${where}: a wrong token says why`);
  await panel.locator('input[type=password]').fill('tok');
  await panel.locator('button.primary').click();
  const on = await page.waitForFunction(() => /martin\/office-in-1-docs/.test(document.querySelector('.cloud-panel')?.textContent ?? ''), null, { timeout: 5000 }).then(() => true, () => false);
  check(on, `${where}: connected, it names the private repository`);
}

// PC: connect from the home page, then every app saves to GitHub by itself.
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
  const gh = await fakeGitHub(ctx);
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(`PC: script error: ${e.message}`));
  page.on('dialog', d => d.dismiss());
  await page.goto(url);
  await page.locator('.home-cloud button').first().click();
  await connect(page, 'PC');
  check(gh.repos.get('office-in-1-docs')?.private === true, 'PC: the repository is private');
  await page.locator('.cloud-x').click();

  for (const { app, ext, magic, type } of APPS) {
    await page.locator('.tab-new').first().click().catch(() => {});
    await page.waitForTimeout(300);
    await page.locator(`.slab:has-text("Office ${app}")`).first().click();
    await page.waitForTimeout(1200);
    const before = gh.puts.length;
    await type(page);
    const t0 = Date.now();
    const ok = await page.waitForFunction(() => /Saved to GitHub/.test(document.querySelector('.app-frame:not([hidden]) .save-badge')?.textContent ?? ''), null, { timeout: CLOUD_MS + 2000 }).then(() => true, () => false);
    const ms = Date.now() - t0;
    check(ok && ms <= CLOUD_MS, `${app}: "Saved to GitHub" ${ms} ms after typing (limit ${CLOUD_MS})`);
    const put = gh.puts.slice(before).find(p => p.file.endsWith(ext));
    check(!!put && put.size > 200, `${app}: a real ${ext} is committed to the repository (${put?.file}, ${put?.size} bytes)`);
    const f = put && gh.repos.get('office-in-1-docs').files.get(put.file);
    check(!!f && f.bytes.subarray(0, 2).toString() === magic, `${app}: the committed file is a real Office file`);
    check(await page.locator('.app-frame:not([hidden]) .cloud-btn.on').count() === 1, `${app}: the cloud button shows GitHub is on`);
  }

  // A second change updates the same file (no copy per save).
  const files = gh.repos.get('office-in-1-docs').files.size;
  await APPS[2].type(page);
  await page.waitForTimeout(CLOUD_MS);
  check(gh.repos.get('office-in-1-docs').files.size === files, `PC: later saves update the same file (${files} files)`);

  // Open from the cloud.
  await page.locator('.app-frame:not([hidden]) .cloud-btn').click();
  const items = page.locator('.cloud-panel .cloud-files button');
  await items.first().waitFor({ timeout: 4000 }).catch(() => {});
  const names = await items.allInnerTexts();
  check(names.length === 3, `PC: the cloud list shows the 3 documents (${names.map(s => s.split('\n')[0]).join(', ')})`);
  const tabs = await page.locator('.tabs .tab, .tab[data-app]').count();
  const docx = page.locator('.cloud-panel .cloud-files button', { hasText: '.docx' }).first();
  if (await docx.count()) await docx.click(); else problems.push(`PC: no .docx in the cloud list (${names.join(' | ')})`);
  await page.waitForTimeout(1500);
  check(await page.locator('.tabs .tab, .tab[data-app]').count() === tabs + 1, 'PC: a cloud document opens in a new tab');
  check((await page.locator('.app-frame:not([hidden]) .body-text').innerText().catch(() => '')).includes('Hello cloud'), 'PC: it opens with its text');

  // Stop: back to the device only.
  if (!(await page.locator('.cloud-panel').count())) await page.locator('.app-frame:not([hidden]) .cloud-btn').click();
  await page.locator('.cloud-off').click({ timeout: 5000 }).catch(async () => problems.push(`PC: no stop button (${await page.locator('.cloud-panel').innerText().catch(() => 'no panel')})`));
  check(await page.locator('.app-frame:not([hidden]) .cloud-btn.on').count() === 0, 'PC: "Stop saving to the cloud" turns it off');
  await ctx.close();
}

// Phone: connect from the app bar.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR', isMobile: true, hasTouch: true });
  const gh = await fakeGitHub(ctx);
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(`Phone: script error: ${e.message}`));
  await page.goto(url);
  await page.locator('.slab:has-text("Office Letter")').first().click();
  await page.waitForTimeout(1200);
  const bar = await page.locator('.app-frame:not([hidden]) .app-bar').boundingBox();
  check(!!bar && bar.width <= 391, 'Phone: the app bar with the cloud button fits the screen');
  await page.locator('.app-frame:not([hidden]) .cloud-btn').click();
  await connect(page, 'Phone');
  await page.locator('.cloud-x').click();
  await page.locator('.app-frame:not([hidden]) .body-text').click();
  await page.keyboard.type('Bonjour nuage', { delay: 10 });
  const ok = await page.waitForFunction(() => /Enregistré sur GitHub/.test(document.querySelector('.app-frame:not([hidden]) .save-badge')?.textContent ?? ''), null, { timeout: CLOUD_MS + 2000 }).then(() => true, () => false);
  check(ok && gh.puts.some(p => p.file.endsWith('.docx')), 'Phone: "Enregistré sur GitHub" and the letter is in the repository');
  await ctx.close();
}

await browser.close();
try { process.kill(-server.pid); } catch { /* already stopped */ }
for (const p of passed) console.log(`ok  ${p}`);
for (const p of problems) console.log(`BAD ${p}`);
console.log(`\n${passed.length} passed, ${problems.length} problems`);
process.exit(problems.length ? 1 : 0);
