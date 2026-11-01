// Checks In 1 Mail like a person would, on every kind of screen (rule 16): a phone upright and sideways, a tablet
// both ways, a Windows PC and a Mac. A new mail typed with a recipient, a subject and a message; a wrong address is
// shown; a ready mail from 22, labels and tones from 22; undo; sending through Gmail (the link carries the mail) and
// as a .eml file (the file holds it); a real .eml opened, read and answered (Re:, quoted); a mail merge from a pasted
// list (one draft per person, names filled in); contacts; zoom; the phone shows one pane at a time with a back button;
// everything still there after reopening; no sideways scrolling. Then "Write with AI" with an AI key (Claude's answer
// played back) and with the default AI website (the answer pasted back), on PC and phone.
// Run after `npm run build`:
//   node scripts/check-mail.mjs

import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT) || 4214;
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore', detached: true });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ }
  await new Promise(r => setTimeout(r, 500));
}

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const problems = [], passed = [];
const check = (ok, what) => (ok ? passed : problems).push(what);

const MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const WIN_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const DEVICES = [
  { name: 'Windows PC', viewport: { width: 1366, height: 768 }, ua: WIN_UA },
  { name: 'Mac', viewport: { width: 1440, height: 900 }, ua: MAC_UA },
  { name: 'tablet', viewport: { width: 820, height: 1180 }, mobile: true },
  { name: 'tablet sideways', viewport: { width: 1180, height: 820 }, mobile: true },
  { name: 'phone', viewport: { width: 390, height: 844 }, mobile: true },
  { name: 'phone sideways', viewport: { width: 844, height: 390 }, mobile: true },
];
const ev = (type, data) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
const sse = text => ev('message_start', { message: { id: 'msg_1', type: 'message', role: 'assistant', model: 'x', content: [], stop_reason: null, usage: { input_tokens: 1, output_tokens: 1 } } })
  + ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } })
  + ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text } })
  + ev('content_block_stop', { index: 0 }) + ev('message_delta', { delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 10 } }) + ev('message_stop', {});

const P = '.module-host:not([hidden]) .mailapp';
const TAB_OF = { 'mail.templates': 'Insert', 'mail.aiWrite': 'AI', 'mail.tone': 'AI', 'mail.via.gmail': 'Send', 'mail.via.eml': 'Send', 'mail.merge': 'Mailing', 'mail.contacts': 'Mailing', 'letter.zoomIn': 'View', 'ui.fitAll': 'View' };
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const closePeek = async page => {
  if (!(await page.locator('.module-host:not([hidden]) .ribbon.open').count())) return;
  const s = page.locator(`${P} .ml-scroll, ${P} .ml-list`).first();
  const b = await s.boundingBox();
  await page.mouse.click(b.x + 4, b.y + b.height - 8);
  await page.waitForTimeout(150);
};
const help = (page, key, tabLabel) => ({
  async click() {
    const b = page.locator(`${P} [data-help="${key}"]:visible`).first();
    if (!(await b.count())) await page.locator(`${P} .ribbon-tabs button:text-is("${tabLabel ?? TAB_OF[key] ?? 'Home'}")`).first().click();
    await page.locator(`${P} [data-help="${key}"]:visible`).first().click();
  },
});
// The mailbox as saved on the device (autosave waits half a second).
const drafts = async page => { await page.waitForTimeout(700); return page.evaluate(() => new Promise(res => {
  const rq = indexedDB.open('oi1');
  rq.onsuccess = () => { const tx = rq.result.transaction('kv', 'readonly'); const st = tx.objectStore('kv'); const keys = st.getAllKeys(); const vals = st.getAll();
    tx.oncomplete = () => { const i = keys.result.findIndex(k => String(k).endsWith(':mail')); res(i < 0 ? null : JSON.parse(vals.result[i])); }; };
  rq.onerror = () => res(null);
})); };
async function openMail(page) {
  await page.goto(url);
  await page.waitForTimeout(400);
  await page.locator('.slab:has-text("In 1 Mail")').first().click();
  await page.locator(`${P} .ml-compose, ${P} .ml-list`).first().waitFor({ timeout: 10000 });
  await page.waitForTimeout(300);
}
async function newPage(d, setup) {
  const ctx = await browser.newContext({ viewport: d.viewport, isMobile: !!d.mobile, hasTouch: !!d.mobile, userAgent: d.ua, locale: d.locale ?? 'en-US', acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => problems.push(`${d.name}: script error: ${e.message}`));
  page.on('dialog', x => x.accept());
  await page.addInitScript(`try { window.showSaveFilePicker = undefined; window.open = u => { (window.__opened ||= []).push(String(u)); return null; }; if (!sessionStorage.getItem('set')) { localStorage.setItem('oi1:language', ${JSON.stringify(d.lang ?? 'en')}); ${setup ?? ''}; sessionStorage.setItem('set', '1'); } } catch {}`);
  return { ctx, page };
}
const EML = ['From: =?UTF-8?B?Q2zDqW1lbnQgRHVwb250?= <clement@example.org>', 'To: me@example.org', 'Subject: =?UTF-8?Q?Caf=C3=A9_on_Monday=3F?=', 'Date: Mon, 03 Nov 2026 09:00:00 +0100',
  'MIME-Version: 1.0', 'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: quoted-printable', '', 'Hello, shall we have a caf=C3=A9 on Monday at 10?', 'Cl=C3=A9ment', ''].join('\r\n');
const AI_MAIL = { subject: 'Heating repair', body: 'Hello,\n\nThe heating in my flat has stopped working. Could you send someone this week?\n\nThank you,' };

try {
  for (const d of DEVICES.filter(x => !process.env.ONLY || x.name.includes(process.env.ONLY))) {
    const n = d.name;
    const phone = d.viewport.width < 760;
    const { ctx, page } = await newPage(d);
    try {
      await openMail(page);
      // A fresh mailbox opens on a new mail, ready to type
      const comp = page.locator(`${P} .ml-compose`);
      check(await comp.isVisible(), `${n}: a new mail is ready to write`);
      check(await overflow(page) <= 1, `${n}: no sideways scrolling`);
      const to = comp.locator('.ml-field input').first();
      await to.fill('bob@');
      await comp.locator('.ml-field input').last().click();
      check(await comp.locator('.ml-bad').isVisible(), `${n}: a wrong address is shown at once`);
      await to.fill('Anna <anna@example.com>');
      await comp.locator('.ml-field input').last().fill('Lunch on Friday');
      await comp.locator('.ml-text').click();
      await page.keyboard.type('Hello Anna, are you free for lunch on Friday?');
      await page.waitForTimeout(600);
      check(!(await comp.locator('.ml-bad').count()), `${n}: a right address clears the warning`);
      check((await comp.locator('.ml-text').textContent()).includes('free for lunch'), `${n}: typing goes into the message`);
      const cb = await comp.boundingBox();
      check(cb.x >= -1 && cb.x + cb.width <= d.viewport.width + 1, `${n}: the mail being written fits the screen`);

      // Bold from the Format tab works on typed text
      await page.keyboard.press('ControlOrMeta+a');
      await help(page, 'letter.bold', 'Format').click();
      check(await comp.locator('.ml-text strong').count() >= 1, `${n}: Bold works on the message`);
      await closePeek(page);

      // Ready mails: 20+, a new draft from one; undo takes it away
      const before = (await drafts(page))?.mails?.length ?? 0;
      await help(page, 'mail.templates').click();
      const gal = page.locator('.ml-templates').first();
      await gal.waitFor({ timeout: 3000 });
      const gb = await gal.boundingBox();
      check(gb.x >= -1 && gb.x + gb.width <= d.viewport.width + 1, `${n}: the ready mails list is on screen`);
      check(await gal.locator('.ml-tpl').count() >= 20, `${n}: at least 20 ready mails`);
      await gal.locator('.ml-tpl').first().click();
      await page.waitForTimeout(900);
      const subj = await page.locator(`${P} .ml-compose .ml-field input`).last().inputValue();
      check(subj.startsWith('Meeting request'), `${n}: a ready mail opens as a new draft (${subj})`);
      const after = (await drafts(page))?.mails?.length ?? 0;
      check(after === before + 1, `${n}: one more draft (${before} → ${after})`);
      await closePeek(page);
      await page.locator(`${P}`).focus();
      await help(page, 'letter.undo', 'Home').click();
      await page.waitForTimeout(700);
      check(((await drafts(page))?.mails?.length ?? 0) === before, `${n}: undo takes the ready mail away`);
      await closePeek(page);

      // Back to the first draft (list on the phone), labels 20+
      if (phone && await page.locator(`${P} .ml-back`).count()) await page.locator(`${P} .ml-back`).click();
      await page.locator(`${P} .ml-item:has-text("Lunch on Friday")`).click();
      await help(page, 'mail.labels', 'Home').click();
      const labels = page.locator('.ml-labels').first();
      await labels.waitFor({ timeout: 3000 });
      check(await labels.locator('.ml-label-pick').count() >= 20, `${n}: at least 20 labels`);
      await labels.locator('.ml-label-pick').first().click();
      check(((await drafts(page)).mails.find(m => m.subject === 'Lunch on Friday')?.labels ?? []).includes('work'), `${n}: a label is put on the mail`);
      await closePeek(page);

      // Tones 20+
      await help(page, 'mail.tone').click();
      const tones = page.locator('.ml-tones').first();
      await tones.waitFor({ timeout: 3000 });
      check(await tones.locator('button').count() >= 20, `${n}: at least 20 tones`);
      await page.keyboard.press('Escape');
      await closePeek(page);

      // Send through Gmail: the link carries the mail, the mail goes to Sent
      await help(page, 'mail.via.gmail').click();
      await page.waitForTimeout(500);
      const opened = await page.evaluate(() => window.__opened?.[0] ?? '');
      const gq = opened ? new URL(opened).searchParams : new URLSearchParams();
      check(opened.includes('mail.google.com') && gq.get('su') === 'Lunch on Friday' && gq.get('to') === 'anna@example.com' && (gq.get('body') ?? '').includes('free for lunch'), `${n}: Gmail opens with the mail filled in`);
      check((await drafts(page)).mails.find(m => m.subject === 'Lunch on Friday')?.folder === 'sent', `${n}: the sent mail is in Sent`);
      await closePeek(page);

      // A real .eml opened, read and answered
      await page.locator(`${P} input[type=file][accept*=".eml"]`).setInputFiles({ name: 'cafe.eml', mimeType: 'message/rfc822', buffer: Buffer.from(EML) });
      const rd = page.locator(`${P} .ml-reader`);
      await rd.waitFor({ timeout: 5000 });
      check((await rd.locator('h1').textContent()) === 'Café on Monday?', `${n}: the opened mail shows its subject with accents`);
      check((await rd.locator('.ml-body').textContent()).includes('café on Monday at 10'), `${n}: the opened mail shows its text`);
      check((await rd.textContent()).includes('Clément Dupont'), `${n}: the sender's name is read`);
      await rd.locator('.ml-actions button').first().click();
      await page.waitForTimeout(400);
      const rc = page.locator(`${P} .ml-compose`);
      check((await rc.locator('.ml-field input').first().inputValue()).includes('clement@example.org'), `${n}: Reply goes to the sender`);
      check((await rc.locator('.ml-field input').last().inputValue()) === 'Re: Café on Monday?', `${n}: Reply has "Re:" in the subject`);
      check(await rc.locator('.ml-text blockquote').count() === 1, `${n}: Reply quotes the mail`);

      // Save the answer as .eml: the file holds it
      await rc.locator('.ml-text').click();
      await page.keyboard.press('ControlOrMeta+Home');
      await page.keyboard.type('Yes, see you there!');
      await page.waitForTimeout(500);
      const dl = page.waitForEvent('download', { timeout: 8000 });
      await help(page, 'mail.via.eml').click();
      const emlText = await readFile(await (await dl).path(), 'utf8');
      check(/^Subject: /m.test(emlText) && emlText.includes('clement@example.org') && emlText.includes('X-Unsent: 1'), `${n}: "Send as .eml" saves a real mail file`);
      await closePeek(page);

      // Mail merge from a pasted list
      await help(page, 'mail.new').click();
      const mc = page.locator(`${P} .ml-compose`);
      await mc.locator('.ml-field input').last().fill('Invoice for {{Name}}');
      await mc.locator('.ml-text').click();
      await page.keyboard.type('Hello {{Name}}, you owe {{Amount}}.');
      await page.waitForTimeout(500);
      await help(page, 'mail.merge').click();
      const dlg = page.locator('dialog[open]');
      await dlg.locator('select').selectOption('paste');
      await dlg.locator('textarea').fill('Name;Email;Amount\nAnna;anna@example.com;120 €\nPaul;paul@example.com;80 €');
      check((await dlg.textContent()).includes('2 mails will be made'), `${n}: the merge says how many mails it makes`);
      await dlg.locator('.dialog-buttons button.primary').click();
      await page.waitForTimeout(500);
      const box = await drafts(page);
      const paul = box.mails.find(m => m.subject === 'Invoice for Paul');
      check(!!paul && paul.to[0] === 'paul@example.com' && paul.html.includes('you owe 80 €'), `${n}: the merge makes one filled mail per person`);

      // Contacts
      await closePeek(page);
      await help(page, 'mail.contacts').click();
      const cd = page.locator('dialog[open] .ml-contacts');
      await cd.locator('input').nth(0).fill('Zoé Martin');
      await cd.locator('input[type=email]').fill('zoe@example.fr');
      await cd.locator('.ml-add-contact button.primary').click();
      check(await cd.locator('li:has-text("Zoé Martin")').count() === 1, `${n}: a contact is added`);
      const db = await page.locator('dialog[open]').boundingBox();
      check(db.x >= -1 && db.x + db.width <= d.viewport.width + 1, `${n}: the contacts window fits the screen`);
      await cd.locator('li button').first().click();
      await page.waitForTimeout(300);
      check((await page.locator(`${P} .ml-compose .ml-field input`).first().inputValue()).includes('zoe@example.fr'), `${n}: "Write to" opens a mail to the contact`);

      // Zoom
      await help(page, 'letter.zoomIn').click();
      const z1 = await page.locator(`${P} .status-zoom .pct`).textContent();
      await help(page, 'ui.fitAll').click();
      const z2 = await page.locator(`${P} .status-zoom .pct`).textContent();
      check(parseInt(z1) > parseInt(z2), `${n}: zoom in and "see it all" (${z1} → ${z2})`);
      const ct = await page.locator(`${P} .ml-content`).boundingBox();
      const sc = await page.locator(`${P} .ml-scroll`).boundingBox();
      check(ct.x >= sc.x - 2 && ct.x + ct.width <= sc.x + sc.width + 2, `${n}: after "see it all" the whole mail is in view`);
      await closePeek(page);

      // Phone: one pane at a time
      if (phone) {
        check(!(await page.locator(`${P} .ml-list`).count()), `${n}: the phone shows the mail alone`);
        await page.locator(`${P} .ml-back`).click();
        check(await page.locator(`${P} .ml-list`).isVisible(), `${n}: the back button shows the list`);
      } else check(await page.locator(`${P} .ml-list`).isVisible() && await page.locator(`${P} .ml-folders`).isVisible(), `${n}: folders, list and mail side by side`);

      // Still there after reopening
      await page.waitForTimeout(800);
      await page.reload();
      await page.waitForTimeout(800);
      if (!(await page.locator(`${P}`).count())) await openMail(page);
      await page.locator(`${P} .ml-folders`).waitFor({ timeout: 10000 });
      const again = await drafts(page);
      check(again.mails.some(m => m.subject === 'Lunch on Friday' && m.folder === 'sent') && again.contacts.some(c => c.email === 'zoe@example.fr'), `${n}: mails and contacts still there after reopening`);
      check(await overflow(page) <= 1, `${n}: still no sideways scrolling`);
      if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/mail-${n.replace(/ /g, '-')}.png` });
    } catch (e) {
      problems.push(`${n}: stopped: ${String(e.message).split('\n')[0]}`);
      if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/mail-fail-${n.replace(/ /g, '-')}.png` });
    }
    await ctx.close();
  }

  // "Write with AI" with an AI key
  {
    const d = DEVICES[0];
    const { ctx, page } = await newPage(d, `localStorage.setItem('oi1:ai:key', 'sk-ant-test')`);
    const asked = [];
    await page.route('https://api.anthropic.com/**', route => { asked.push(route.request().postData()); return route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse(JSON.stringify(AI_MAIL)) }); });
    await openMail(page);
    await help(page, 'mail.aiWrite').click();
    await page.locator('.dr-ai textarea').fill('ask my landlord to repair the heating');
    await page.locator('.dr-ai textarea').press('Enter');
    await page.waitForFunction(() => [...document.querySelectorAll('.module-host:not([hidden]) .mailapp .ml-compose .ml-field input')].some(i => i.value === 'Heating repair'), null, { timeout: 8000 }).catch(() => {});
    check((await page.locator(`${P} .ml-compose .ml-field input`).last().inputValue()) === 'Heating repair', 'AI key: the mail takes the AI subject');
    check((await page.locator(`${P} .ml-compose .ml-text`).textContent()).includes('heating in my flat'), 'AI key: the mail takes the AI message');
    check(asked.length === 1 && asked[0].includes('landlord'), 'AI key: the request carries the ask');
    await ctx.close();
  }

  // Default AI website, phone and PC
  for (const d of [DEVICES[4], DEVICES[0]]) {
    const n = `${d.name} web AI`;
    const { ctx, page } = await newPage({ ...d, lang: 'fr' }, `localStorage.setItem('oi1.ai.providers', JSON.stringify({ main: 'web-claude', byApp: {}, models: {}, azure: { endpoint: '', deployment: '' }, v: 2 }))`);
    await openMail(page);
    await help(page, 'mail.aiWrite', 'IA').click();
    await page.locator('.dr-ai-ideas button').first().click();
    await page.locator('.dr-ai textarea').press('Enter');
    const cardEl = page.locator('.web-answer');
    check(await cardEl.waitFor({ timeout: 6000 }).then(() => true, () => false), `${n}: a card explains how to bring Claude's answer back`);
    const sent = await page.evaluate(() => window.__opened?.[0] ?? '');
    check(sent.includes('claude.ai') && sent.length < 7000, `${n}: Claude's site gets one short message (${sent.length})`);
    const bx = await cardEl.boundingBox();
    check(!!bx && bx.x >= 0 && bx.x + bx.width <= d.viewport.width + 1, `${n}: the Paste card is on screen`);
    await cardEl.locator('textarea').fill('Objet : Retard ce matin\n\nBonjour Paul,\n\nJe serai en retard de 20 minutes ce matin.\n\nMerci,');
    await cardEl.locator('textarea').press('ControlOrMeta+Enter');
    await page.waitForFunction(() => [...document.querySelectorAll('.module-host:not([hidden]) .mailapp .ml-compose .ml-field input')].some(i => i.value === 'Retard ce matin'), null, { timeout: 8000 }).catch(() => {});
    check((await page.locator(`${P} .ml-compose .ml-field input`).last().inputValue()) === 'Retard ce matin', `${n}: the pasted answer gives the subject`);
    check((await page.locator(`${P} .ml-compose .ml-text`).textContent()).includes('en retard de 20 minutes'), `${n}: the pasted answer gives the message`);
    check(await overflow(page) <= 1, `${n}: no sideways scrolling`);
    await ctx.close();
  }
} finally {
  await browser.close();
  try { process.kill(-server.pid); } catch { /* already stopped */ }
}

for (const p of passed) console.log(`✓ ${p}`);
for (const p of problems) console.log(`✗ ${p}`);
console.log(`\n${passed.length} passed, ${problems.length} problems`);
process.exit(problems.length ? 1 : 0);
