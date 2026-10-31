// Tables in a letter that are live parts (Synchro): a change in the letter goes to the part, and so to Office
// Class and every other app holding it; a change made there comes back here by itself. Each linked table shows
// whether it matches the part (data-live: synced, pending or different), checked after every change.

import type { Editor } from '@tiptap/react';
import type { Node as PMNode } from '@tiptap/pm/model';
import { useEffect } from 'react';
import type { TableData } from '../../shell/contract';
import { isLiveId, keepDetails, liveStore, tableText, type SyncState } from '../../shell/live';
import { replaceTable, tableData } from './smart';

function linkedTables(ed: Editor): Map<string, { node: PMNode; pos: number }> {
  const out = new Map<string, { node: PMNode; pos: number }>();
  ed.state.doc.descendants((node, pos) => {
    if (node.type.name === 'table') { if (isLiveId(node.attrs.link as string)) out.set(node.attrs.link as string, { node, pos }); return false; }
    return true;
  });
  return out;
}

/** Shows each linked table's state on the page; not saved in the letter. */
function mark(ed: Editor, id: string, state: SyncState) {
  const at = linkedTables(ed).get(id);
  if (!at) return;
  // The editor draws tables itself (a scroll box around the table), without the node's attributes.
  const dom = ed.view.nodeDOM(at.pos) as HTMLElement | null;
  const table = dom?.tagName === 'TABLE' ? dom : dom?.querySelector('table');
  if (!table) return;
  if (table.dataset.link !== id) table.dataset.link = id;
  if (table.dataset.live !== state) table.dataset.live = state;
}

export function useLiveTables(ed: Editor | null, title: string) {
  useEffect(() => {
    if (!ed) return;
    const live = liveStore();
    const watching = new Map<string, () => void>();
    const parts = new Map<string, TableData | undefined>();
    let timer = 0;

    const follow = (id: string) => {
      if (watching.has(id)) return;
      watching.set(id, live.watch(id, c => {
        parts.set(id, c.table);
        const at = linkedTables(ed).get(id);
        if (!at || !c.table) return;
        if (tableText(tableData(at.node)) !== tableText(c.table)) replaceTable(ed, at, c.table);
        mark(ed, id, 'synced');
      }));
      void live.read(id).then(c => {
        parts.set(id, c.table);
        const at = linkedTables(ed).get(id);
        if (!at) return;
        // A part this device has never seen (the letter came from elsewhere) starts from the letter's table.
        if (!c.table) { void live.ensure(id, { kind: 'table', title, table: tableData(at.node) }, 'letter', 'letter'); mark(ed, id, 'synced'); return; }
        live.addPlace(id, 'letter');
        if (tableText(tableData(at.node)) !== tableText(c.table)) replaceTable(ed, at, c.table);
        mark(ed, id, 'synced');
      });
    };

    const push = () => {
      for (const [id, at] of linkedTables(ed)) {
        follow(id);
        const mine = tableData(at.node);
        const part = parts.get(id);
        if (part && tableText(part) === tableText(mine)) { mark(ed, id, 'synced'); continue; }
        if (!part) continue;
        mark(ed, id, 'pending');
        const next = keepDetails(part, mine);
        parts.set(id, next);
        void live.write(id, { kind: 'table', title, table: next }).then(() => live.read(id)).then(c => mark(ed, id, tableText(c.table) === tableText(tableData(linkedTables(ed).get(id)?.node ?? at.node)) ? 'synced' : 'different'));
      }
    };
    const onUpdate = () => { window.clearTimeout(timer); timer = window.setTimeout(push, 250); };
    // Marks are lost when the editor redraws a table: put them back.
    const remark = () => { for (const id of linkedTables(ed).keys()) { const p = parts.get(id), at = linkedTables(ed).get(id); if (p && at) mark(ed, id, tableText(p) === tableText(tableData(at.node)) ? 'synced' : 'pending'); } };
    for (const id of linkedTables(ed).keys()) follow(id);
    ed.on('update', onUpdate);
    ed.on('transaction', remark);
    return () => { ed.off('update', onUpdate); ed.off('transaction', remark); window.clearTimeout(timer); for (const stop of watching.values()) stop(); };
  }, [ed, title]);
}
