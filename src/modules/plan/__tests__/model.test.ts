// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { BUCKET_COLORS, LABELS, addDays, cleanPlan, criticalPath, fromCsv, makesLoop, newPlan, newTask, shift, stats, toCsv, toIcs } from '../model';
import { PLAN_TEMPLATES } from '../templates';
import { tasksFromAnswer } from '../ai';

const plan3 = () => {
  const p = newPlan('P', ['To do', 'Doing', 'Done']);
  const b = p.buckets[0].id;
  const a = newTask(b, 'A', '2026-11-02', 3), c = newTask(b, 'B', '2026-11-05', 2), d = newTask(b, 'C', '2026-11-02', 1);
  c.deps = [a.id];
  return { ...p, tasks: [a, c, d] };
};

describe('In 1 Plan model', () => {
  it('has 20+ choices in every list', () => {
    for (const list of [LABELS, BUCKET_COLORS, PLAN_TEMPLATES]) expect(list.length).toBeGreaterThanOrEqual(20);
  });
  it('cleans what it reads: bad dates, progress, unknown buckets and deps', () => {
    const p = cleanPlan({ name: 'X', buckets: [{ id: 'b1', name: 'One', color: 'red' }], tasks: [
      { id: 't1', title: 'T', bucket: 'nope', start: '2026-11-10', due: '2026-11-01', progress: 250, priority: 'boss', labels: ['red', 'evil'], deps: ['t1', 'ghost'] },
    ] }, 'x', ['a']);
    const t = p.tasks[0];
    expect(t.bucket).toBe('b1');
    expect(t.due).toBe('2026-11-10');
    expect(t.progress).toBe(100);
    expect(t.priority).toBe('medium');
    expect(t.labels).toEqual(['red']);
    expect(t.deps).toEqual([]);
    expect(p.buckets[0].color).toMatch(/^#/);
    expect(cleanPlan('junk', 'Name', ['a', 'b']).buckets.length).toBe(2);
  });
  it('moving a task moves the tasks that wait for it', () => {
    const p = plan3();
    const moved = shift(p, p.tasks[0].id, 4);
    expect(moved.tasks[0].start).toBe('2026-11-06');
    expect(moved.tasks[1].start > moved.tasks[0].due).toBe(true);
    expect(moved.tasks[2].start).toBe('2026-11-02');
  });
  it('refuses loops and finds the critical path', () => {
    const p = plan3();
    expect(makesLoop(p, p.tasks[0].id, p.tasks[1].id)).toBe(true);
    expect(makesLoop(p, p.tasks[2].id, p.tasks[0].id)).toBe(false);
    expect([...criticalPath(p)]).toEqual([p.tasks[0].id, p.tasks[1].id]);
  });
  it('counts and exports', () => {
    const p = plan3();
    p.tasks[2].progress = 100;
    const s = stats(p, '2026-11-20');
    expect(s).toMatchObject({ n: 3, done: 1, late: 2, start: '2026-11-02', end: '2026-11-06' });
    const csv = toCsv(p, ['Task', 'Col', 'Start', 'Due', '%', 'Prio', 'Who', 'Labels', 'Notes'], () => 'To do', x => x);
    expect(csv.split('\r\n').length).toBe(4);
    const back = fromCsv(csv, 'b');
    expect(back.map(t => [t.title, t.start, t.due])).toEqual([['A', '2026-11-02', '2026-11-04'], ['B', '2026-11-05', '2026-11-06'], ['C', '2026-11-02', '2026-11-02']]);
    expect(toIcs(p)).toContain('DTEND;VALUE=DATE:20261105');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('reads an AI plan, and plain lines from a website', () => {
    const json = tasksFromAnswer('Here:\n```json\n{"tasks":[{"title":"Book","day":0,"days":2,"priority":"urgent","after":-1,"checklist":["a"]},{"title":"Go","day":2,"days":1,"priority":"low","after":0,"checklist":[]}]}\n```', '2026-11-01', 'b');
    expect(json.length).toBe(2);
    expect(json[1].deps).toEqual([json[0].id]);
    expect(json[0].due).toBe('2026-11-02');
    expect(json[0].checklist[0].text).toBe('a');
    expect(tasksFromAnswer('1. Buy paint\n2. Paint the wall', '2026-11-01', 'b').map(t => t.title)).toEqual(['Buy paint', 'Paint the wall']);
  });
  it('every template is ordered sensibly', () => {
    for (const tpl of PLAN_TEMPLATES) for (const [i, x] of tpl.tasks.entries()) { expect(x.days).toBeGreaterThan(0); if (x.after !== undefined) expect(x.after).toBeLessThan(i); }
  });
});
