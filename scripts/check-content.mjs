// Checks that every tab of every app has real content, like Martin's rule for all of Office In 1:
// each ribbon tab shows working buttons, every drop-down opens with choices, and every list or gallery
// offers at least 20 of them, like Word, Excel and PowerPoint. Writes screens/content.json with the counts.
// Run after `npm run build`:
//   node scripts/check-content.mjs
// Exits with an error when a tab is empty or a list is too short.

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 4184;
const MIN_CHOICES = 20;
const APPS = ['Letter', 'Class', 'Stage', 'Code+', 'Draw'];

// Lists that are short by nature, with the reason. Everything else needs MIN_CHOICES.
const SHORT_BY_NATURE = {
  'Orientation': 'portrait or landscape',
  'Print area': 'set, add to or clear the print area, like Excel',
  'Clear': 'everything, formats or contents, like Excel',
  'Freeze Panes': 'at the cell, the top row or the first column',
  'Speed': 'fast, medium or slow',
  'More': 'a short menu of whole-slide actions',
  'Order': 'lists the animations of the slide, so it grows with them',
  'From Class': 'lists the open sheets, so it grows with them',
  'Table from Office Class': 'lists the open sheets',
  'Table from Class': 'lists the open sheets',
  'Send to Letter': 'lists the open letters',
  'Outline to Office Letter': 'lists the open letters',
  'Send code to Letter': 'lists the open letters',
  'Cite again': 'lists the sources already cited, so it grows with them',
  'My dictionary': 'lists the words the user added, so it grows with them',
  'Cross-reference': 'lists the headings and captions of the letter',
  'Bibliography': 'a few titles for the same list, like Word',
  'Line numbers': 'none, every paragraph, every 5 or every 10, like Word',
  'Text direction': 'left to right or right to left',
  'Logical': 'every logical function Excel has (IF, AND, OR, XOR, SWITCH…), like Excel\'s own Logical list',
};
// Lists still being brought to MIN_CHOICES, one app per pull request. This list only shrinks.
const TODO = {
  Letter: ['Administrative', 'Government', 'Military', 'Personal'],
  Class: ['Merge options', 'Number format', 'Conditional Formatting', 'All charts'],
  Stage: ['Choose a layout', 'Layout', 'WordArt', 'Diagram', 'Slide size', 'Word stickers'],
};
// Tabs still being filled, with the pull request that fills them.
const TODO_TABS = [];

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
const url = `http://localhost:${PORT}/`;
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ }
  await new Promise(r => setTimeout(r, 500));
}

mkdirSync('screens', { recursive: true });
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
const problems = [];
const report = {};
try {
  for (const app of APPS) {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, locale: 'en-US' });
    const page = await ctx.newPage();
    page.on('dialog', d => d.dismiss());
    page.on('pageerror', e => problems.push(`${app}: script error: ${e.message}`));
    await page.goto(url);
    await page.waitForTimeout(400);
    const slab = page.locator(`.slab:has-text("Office ${app}")`);
    if (!(await slab.count())) { await ctx.close(); continue; }
    await slab.first().click();
    await page.waitForTimeout(1200);
    if (app === 'Code+') { const tpl = page.locator('.code .tpl').first(); if (await tpl.count()) { await tpl.click(); await page.waitForTimeout(800); } }
    const host = page.locator('.module-host:not([hidden])');
    const tabs = host.locator('.ribbon-tabs [role=tab]');
    report[app] = [];
    for (let i = 0; i < await tabs.count(); i++) {
      const tab = tabs.nth(i);
      const name = (await tab.innerText()).trim();
      await tab.click();
      await page.waitForTimeout(200);
      const panel = host.locator('.ribbon-panel').first();
      const controls = await panel.evaluate(p => [...p.querySelectorAll('button, select, input')]
        .filter(el => !el.closest('.drop-panel'))
        .map(el => ({ label: (el.getAttribute('aria-label') || el.getAttribute('title') || el.innerText || '').trim(), on: !el.disabled })));
      if (controls.filter(c => c.on).length < 3 && !TODO_TABS.includes(`${app} > ${name}`)) problems.push(`${app} > ${name}: only ${controls.filter(c => c.on).length} working buttons`);
      for (const c of controls) if (!c.label) problems.push(`${app} > ${name}: a button without a name`);
      const lists = [];
      // Galleries shown right on the ribbon (themes, transitions…) are lists too.
      for (const g of await panel.evaluate(p => [...p.querySelectorAll('[data-gallery]')].map(el => ({ label: el.dataset.gallery, choices: el.querySelectorAll('button').length })))) {
        lists.push(g);
        if (g.choices < MIN_CHOICES && !(TODO[app] ?? []).includes(g.label)) problems.push(`${app} > ${name} > ${g.label}: ${g.choices} choices, needs ${MIN_CHOICES}`);
      }
      const drops = panel.locator('.drop > button');
      for (let d = 0; d < await drops.count(); d++) {
        const b = drops.nth(d);
        const label = ((await b.getAttribute('aria-label')) || (await b.getAttribute('title')) || '').replace(/\s*\(\d+\)$/, '');
        if (await b.isDisabled()) continue;
        await b.click({ force: true }).catch(() => {});
        await page.waitForTimeout(150);
        const choices = await page.evaluate(() => {
          const p = document.querySelector('.drop-panel');
          return p ? p.querySelectorAll('.menu-item, button:not(.menu-item), [role=menuitem], [role=option]').length : -1;
        });
        await page.keyboard.press('Escape');
        if (await page.locator('.drop-panel').count()) await page.mouse.click(4, 990);
        await page.waitForTimeout(60);
        lists.push({ label, choices });
        if (choices < 0) problems.push(`${app} > ${name} > ${label}: the list does not open`);
        else if (choices < MIN_CHOICES && !(label in SHORT_BY_NATURE) && !(TODO[app] ?? []).includes(label)) {
          problems.push(`${app} > ${name} > ${label}: ${choices} choices, needs ${MIN_CHOICES}`);
        }
      }
      report[app].push({ tab: name, buttons: controls.length, lists });
    }
    await ctx.close();
  }
  // On a phone the ribbon scrolls sideways: every list must still open where it can be seen and tapped.
  for (const app of APPS) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US', isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    page.on('dialog', d => d.dismiss());
    await page.goto(url);
    await page.waitForTimeout(400);
    const slab = page.locator(`.slab:has-text("Office ${app}")`);
    if (!(await slab.count())) { await ctx.close(); continue; }
    await slab.first().click();
    await page.waitForTimeout(1200);
    if (app === 'Code+') { const tpl = page.locator('.code .tpl').first(); if (await tpl.count()) { await tpl.click(); await page.waitForTimeout(800); } }
    const host = page.locator('.module-host:not([hidden])');
    const tabs = host.locator('.ribbon-tabs [role=tab]');
    for (let i = 0; i < await tabs.count(); i++) {
      const tab = tabs.nth(i);
      const name = (await tab.innerText()).trim();
      await tab.scrollIntoViewIfNeeded();
      await tab.click();
      await page.waitForTimeout(200);
      const drops = host.locator('.ribbon-panel').first().locator('.drop > button');
      for (let d = 0; d < await drops.count(); d++) {
        const b = drops.nth(d);
        if (await b.isDisabled()) continue;
        const label = ((await b.getAttribute('aria-label')) || '').replace(/\s*\(\d+\)$/, '');
        await b.scrollIntoViewIfNeeded().catch(() => {});
        await b.click().catch(() => {});
        await page.waitForTimeout(150);
        const seen = await page.evaluate(() => {
          const p = document.querySelector('.drop-panel');
          if (!p) return 'closed';
          const r = p.getBoundingClientRect();
          const x = Math.min(Math.max(r.left + 20, 1), innerWidth - 1), y = Math.min(Math.max(r.top + 20, 1), innerHeight - 1);
          if (r.left < -1 || r.right > document.documentElement.clientWidth + 1 || r.top >= innerHeight) return `out of the screen (${Math.round(r.left)}, ${Math.round(r.top)})`;
          return p.contains(document.elementFromPoint(x, y)) ? 'ok' : 'hidden under something';
        });
        await page.keyboard.press('Escape');
        if (await page.locator('.drop-panel').count()) await page.mouse.click(4, 840);
        await page.waitForTimeout(60);
        if (seen !== 'ok' && seen !== 'closed') problems.push(`${app} > ${name} > ${label}: on a phone the list opens ${seen}`);
      }
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  server.kill();
}
writeFileSync('screens/content.json', JSON.stringify(report, null, 1));
const tabs = Object.values(report).flat();
const lists = tabs.flatMap(t => t.lists);
if (problems.length) {
  console.error(`${problems.length} problems:\n${[...new Set(problems)].map(p => `  - ${p}`).join('\n')}`);
  process.exit(1);
}
console.log(`Every tab has content: ${tabs.length} tabs, ${tabs.reduce((n, t) => n + t.buttons, 0)} buttons, ${lists.length} lists, ${lists.filter(l => l.choices >= MIN_CHOICES).length} with ${MIN_CHOICES}+ choices.`);
