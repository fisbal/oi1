// In 1 Plan with an AI: a goal in plain words becomes a real plan (tasks with dates, priorities, checklists and the
// tasks they wait for). The answer is checked task by task before anything is added.

import type { AiApi } from '../../shell/contract';
import { jsonOf } from '../assistant/plan';
import { planChat } from '../../shell/chatText';
import { PRIORITIES, addDays, cleanTask, newId, type Task } from './model';

const LANG: Record<string, string> = { en: 'English', fr: 'French', es: 'Spanish', pt: 'Portuguese', de: 'German' };

const SCHEMA: Record<string, unknown> = {
  type: 'object', additionalProperties: false, required: ['tasks'],
  properties: {
    tasks: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['title', 'day', 'days', 'priority', 'after', 'checklist'],
        properties: {
          title: { type: 'string' }, day: { type: 'integer' }, days: { type: 'integer' },
          priority: { type: 'string', enum: PRIORITIES }, after: { type: 'integer' },
          checklist: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
};

const SYSTEM = `You plan projects for In 1 Plan. Turn the goal into 5 to 25 concrete tasks in a sensible order.
Each task: "title" (short, starts with a verb), "day" (the day it starts, 0 = today), "days" (how long it takes, at least 1),
"priority" (urgent, important, medium or low), "after" (the index in your list of the task it must wait for, or -1),
"checklist" (0 to 5 short steps). Be realistic about durations.`;

/** The AI's tasks made into In 1 Plan tasks, starting from `start`, in `bucket`. */
export function tasksFromAnswer(answer: string, start: string, bucket: string): Task[] {
  let raw: unknown;
  try { raw = jsonOf(answer); } catch { try { raw = jsonOf(answer.replace(/[“”]/g, '"').replace(/,\s*([}\]])/g, '$1')); } catch { raw = null; } }
  let list = (raw as { tasks?: unknown[] } | null)?.tasks;
  // A website answers with plain lines (what planChat asks for): one task per line, in order, "(2 days)" for its
  // length and "!" after an important one. Each task starts when the one before ends.
  if (!Array.isArray(list)) {
    const MARK = /^(?:[-*•]|\d+\s*[.)-]|- \[[ x]\])\s*/i;
    const all = answer.replace(/```[a-z]*/gi, '').split('\n').map(l => l.replace(/\*\*/g, '').trim()).filter(l => l && l.length < 240);
    const marked = all.filter(l => MARK.test(l)); // a sentence before or after the list is left out
    const lines = (marked.length ? marked : all).map(l => l.replace(MARK, '').trim()).filter(Boolean);
    let day = 0;
    list = lines.slice(0, 40).map((line, i) => {
      const important = /!\s*$/.test(line);
      let title = line.replace(/\s*!+\s*$/, '');
      const m = title.match(/\((\d+)\s*(?:jours?|days?|d[ií]as?|tage?|j|d|t)\)/i);
      const days = m ? Math.max(1, Number(m[1])) : 2;
      if (m) title = (title.slice(0, m.index) + title.slice(m.index! + m[0].length)).trim();
      const t = { title, day, days, after: i ? i - 1 : -1, priority: important ? 'important' : 'medium' };
      day += days;
      return t;
    });
  }
  const ids: string[] = [];
  const out: Task[] = [];
  for (const it of (list as unknown[]).slice(0, 60)) {
    const x = (it && typeof it === 'object' ? it : {}) as Record<string, unknown>;
    const title = typeof x.title === 'string' ? x.title.trim() : '';
    const id = newId();
    ids.push(id);
    if (!title) continue;
    const day = Math.max(-30, Math.min(3650, Math.round(Number(x.day) || 0)));
    const days = Math.max(1, Math.min(365, Math.round(Number(x.days) || 1)));
    const s = addDays(start, day);
    const after = Math.round(Number(x.after));
    const t = cleanTask({ id, title, bucket, start: s, due: addDays(s, days - 1), priority: x.priority,
      checklist: (Array.isArray(x.checklist) ? x.checklist : []).filter(c => typeof c === 'string').map(text => ({ text })) }, bucket);
    out.push({ ...t, deps: Number.isInteger(after) && after >= 0 && after < ids.length - 1 ? [ids[after]] : [] });
  }
  const kept = new Set(out.map(t => t.id));
  return out.map(t => ({ ...t, deps: t.deps.filter(d => kept.has(d)) }));
}

export async function planWithAi(ai: AiApi, goal: string, lang: string, start: string, bucket: string, signal?: AbortSignal): Promise<Task[]> {
  const words = LANG[lang] ?? 'English';
  const answer = await ai.ask({
    system: SYSTEM, schema: SCHEMA, effort: 'medium', signal,
    messages: [{ role: 'user', content: `Goal: ${goal}\nWrite the tasks in ${words}.` }],
    chatPrompt: planChat(goal, lang),
  });
  return tasksFromAnswer(answer, start, bucket);
}
