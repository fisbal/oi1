// The Master corrector: looks at a whole project (or one file), finds what is wrong, simple or complex, and
// proposes each fix as a before/after the programmer accepts, edits or refuses. Nothing changes without a click.
// Sources: the local checker (instant, offline), the tests, Claude, and, if the programmer wants a second
// opinion, other AIs with their own keys (kept on this device, sent only to that AI).

import type { AiApi } from '../../shell/contract';
import { type Files, isBinary } from './build';
import { applyFixes, lintFile, ruleById, ruleWhy, type Severity } from './lint';
import type { TestRun } from './tests';
import { diffLines } from './versions';

export interface Finding {
  id: string; source: string; path: string; line: number;
  title: string; why: string; severity: Severity;
  /** The whole file before and after the fix. */
  before: string; after: string;
  /** How to redo the fix on a file that changed since: the checker's rule, or the exact text to replace. */
  rule?: string; find?: string; replace?: string;
}

let seq = 0;
const fid = () => `f${Date.now().toString(36)}${(seq++).toString(36)}`;

/** One finding per fixable problem from the local checker. */
export function localFindings(files: Files, paths: string[], off: Set<string>): Finding[] {
  const out: Finding[] = [];
  for (const path of paths) {
    const text = files[path];
    if (text === undefined || isBinary(text)) continue;
    for (const p of lintFile(path, text, off)) {
      if (!p.fix) continue;
      const rule = ruleById(p.rule)!;
      out.push({ id: fid(), source: 'local', path, line: p.line, title: p.message, why: ruleWhy(rule), severity: p.severity, before: text, after: applyFixes(text, [p.fix]), rule: p.rule });
    }
  }
  return out;
}

/**
 * Applies a finding to the file as it is now. Other accepted fixes may have changed the file since the
 * analysis, so the change is re-applied by its lines (with one line of context), not by position.
 * Returns null when those lines are gone: the finding is out of date.
 */
export function applyFinding(current: string, f: Finding, off: Set<string> = new Set()): string | null {
  if (current === f.before) return f.after;
  if (f.rule) {
    // A checker fix is found again on the new text: same rule, nearest line.
    const again = lintFile(f.path, current, off).filter(p => p.rule === f.rule && p.fix && Math.abs(p.line - f.line) <= 3)
      .sort((a, b) => Math.abs(a.line - f.line) - Math.abs(b.line - f.line))[0];
    return again ? applyFixes(current, [again.fix!]) : null;
  }
  if (f.find !== undefined && f.replace !== undefined) {
    const at = current.indexOf(f.find);
    return at >= 0 && current.indexOf(f.find, at + 1) < 0 ? current.slice(0, at) + f.replace + current.slice(at + f.find.length) : null;
  }
  const B = f.before.split('\n');
  let result = current;
  // From the end, so that earlier hunks keep their line numbers.
  for (const h of diffLines(f.before, f.after).reverse()) {
    const top = Math.max(0, h.aStart - 1), bottom = Math.min(B.length, h.aStart + h.aLines.length + 1);
    const find = B.slice(top, bottom).join('\n');
    const replace = [...B.slice(top, h.aStart), ...h.bLines, ...B.slice(h.aStart + h.aLines.length, bottom)].join('\n');
    const at = result.indexOf(find);
    if (at < 0 || result.indexOf(find, at + 1) >= 0) return null;
    result = result.slice(0, at) + replace + result.slice(at + find.length);
  }
  return result;
}

// ---------- AI ----------

export const MAX_CHARS = 120_000;

/** The files sent for review: code first, smallest first, until the budget is used. */
export function pickFiles(files: Files, paths: string[]): Files {
  const out: Files = {};
  let used = 0;
  for (const p of [...paths].filter(p => !isBinary(files[p] ?? '') && !/(^|\/)(node_modules|dist)\/|\.min\.|package-lock|\.lock$/.test(p)).sort((a, b) => files[a].length - files[b].length)) {
    if (used + files[p].length > MAX_CHARS) continue;
    out[p] = files[p]; used += files[p].length;
  }
  return out;
}

export const SYSTEM = `You are the Master corrector inside In 1 Code+, a careful senior engineer reviewing a project.
Find real defects: bugs, crashes, wrong logic, off-by-one errors, unhandled errors and promises, race conditions,
security holes (OWASP Top 10: injection, XSS, secrets, unsafe eval), accessibility failures (WCAG), performance traps,
and failing tests. Ignore pure style. For each defect give the smallest fix that keeps the author's intent.
Each fix is a search and replace in one file: "find" must be copied EXACTLY from the file (with its indentation)
and appear once; "replace" is the new text. Explain "why" in one or two plain sentences a beginner understands,
in the language the user writes in. Never invent files. Return at most 25 fixes, most serious first.`;

export const SCHEMA = {
  type: 'object',
  properties: {
    fixes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          file: { type: 'string' }, line: { type: 'integer' }, title: { type: 'string' }, why: { type: 'string' },
          severity: { type: 'string', enum: ['error', 'warning', 'info'] }, find: { type: 'string' }, replace: { type: 'string' },
        },
        required: ['file', 'title', 'why', 'severity', 'find', 'replace'],
        additionalProperties: false,
      },
    },
  },
  required: ['fixes'],
  additionalProperties: false,
} as const;

export function reviewPrompt(files: Files, tests: TestRun | null, problems: string[], language: string): string {
  const body = Object.entries(files).map(([p, c]) => `=== ${p} ===\n${c}`).join('\n\n');
  const failing = tests?.results.filter(r => !r.ok).map(r => `${r.file ?? ''} ${r.suite} › ${r.name}: ${r.error}`) ?? [];
  return `Answer in ${language}.\n\nProject files:\n\n${body}\n\n` +
    (failing.length ? `Failing tests:\n${failing.join('\n')}\n\n` : '') +
    (tests?.errors.length ? `Test errors:\n${tests.errors.join('\n')}\n\n` : '') +
    (problems.length ? `The quick checker already reports (do not repeat these):\n${problems.slice(0, 60).join('\n')}\n\n` : '') +
    'Return the fixes as JSON.';
}

interface RawFix { file: string; line?: number; title: string; why: string; severity: Severity; find: string; replace: string }

/** Turns an AI's answer into findings, keeping only fixes whose text really is in the file, once. */
export function toFindings(answer: string, files: Files, source: string): Finding[] {
  let raw: RawFix[] = [];
  try {
    const json = answer.slice(answer.indexOf('{'), answer.lastIndexOf('}') + 1);
    raw = (JSON.parse(json) as { fixes?: RawFix[] }).fixes ?? [];
  } catch { return []; }
  const out: Finding[] = [];
  for (const f of raw) {
    const text = files[f.file];
    if (text === undefined || !f.find || f.find === f.replace) continue;
    const at = text.indexOf(f.find);
    if (at < 0 || text.indexOf(f.find, at + 1) >= 0) continue;
    const line = text.slice(0, at).split('\n').length;
    out.push({
      id: fid(), source, path: f.file, line, title: f.title, why: f.why,
      severity: ['error', 'warning', 'info'].includes(f.severity) ? f.severity : 'warning',
      before: text, after: text.slice(0, at) + f.replace + text.slice(at + f.find.length), find: f.find, replace: f.replace,
    });
  }
  return out;
}

export async function askClaude(ai: AiApi, prompt: string, signal?: AbortSignal): Promise<string> {
  return ai.ask({ system: SYSTEM, messages: [{ role: 'user', content: prompt }], schema: SCHEMA as unknown as Record<string, unknown>, effort: 'high', signal });
}

// ---------- second opinions ----------

export interface Helper { id: string; name: string; kind: 'openai' | 'gemini'; base: string; model: string; keyUrl: string; local?: boolean }

/** AIs that answer from the browser with the programmer's own key. OpenAI-style APIs share one format. */
export const HELPERS: Helper[] = [
  { id: 'openai', name: 'OpenAI (GPT)', kind: 'openai', base: 'https://api.openai.com/v1', model: 'gpt-4o-mini', keyUrl: 'https://platform.openai.com/api-keys' },
  { id: 'gemini', name: 'Google Gemini', kind: 'gemini', base: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.0-flash', keyUrl: 'https://aistudio.google.com/apikey' },
  { id: 'mistral', name: 'Mistral (Codestral)', kind: 'openai', base: 'https://api.mistral.ai/v1', model: 'codestral-latest', keyUrl: 'https://console.mistral.ai/api-keys' },
  { id: 'deepseek', name: 'DeepSeek', kind: 'openai', base: 'https://api.deepseek.com/v1', model: 'deepseek-chat', keyUrl: 'https://platform.deepseek.com/api_keys' },
  { id: 'groq', name: 'Groq (Llama)', kind: 'openai', base: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile', keyUrl: 'https://console.groq.com/keys' },
  { id: 'openrouter', name: 'OpenRouter (any model)', kind: 'openai', base: 'https://openrouter.ai/api/v1', model: 'openrouter/auto', keyUrl: 'https://openrouter.ai/keys' },
  { id: 'together', name: 'Together AI', kind: 'openai', base: 'https://api.together.xyz/v1', model: 'Qwen/Qwen2.5-Coder-32B-Instruct', keyUrl: 'https://api.together.xyz/settings/api-keys' },
  { id: 'xai', name: 'xAI (Grok)', kind: 'openai', base: 'https://api.x.ai/v1', model: 'grok-2-latest', keyUrl: 'https://console.x.ai' },
  { id: 'perplexity', name: 'Perplexity', kind: 'openai', base: 'https://api.perplexity.ai', model: 'sonar', keyUrl: 'https://www.perplexity.ai/settings/api' },
  { id: 'fireworks', name: 'Fireworks AI', kind: 'openai', base: 'https://api.fireworks.ai/inference/v1', model: 'accounts/fireworks/models/qwen2p5-coder-32b-instruct', keyUrl: 'https://fireworks.ai/account/api-keys' },
  { id: 'cerebras', name: 'Cerebras', kind: 'openai', base: 'https://api.cerebras.ai/v1', model: 'llama-3.3-70b', keyUrl: 'https://cloud.cerebras.ai' },
  { id: 'huggingface', name: 'Hugging Face', kind: 'openai', base: 'https://router.huggingface.co/v1', model: 'Qwen/Qwen2.5-Coder-32B-Instruct', keyUrl: 'https://huggingface.co/settings/tokens' },
  { id: 'nvidia', name: 'NVIDIA NIM', kind: 'openai', base: 'https://integrate.api.nvidia.com/v1', model: 'meta/llama-3.3-70b-instruct', keyUrl: 'https://build.nvidia.com' },
  { id: 'deepinfra', name: 'DeepInfra', kind: 'openai', base: 'https://api.deepinfra.com/v1/openai', model: 'Qwen/Qwen2.5-Coder-32B-Instruct', keyUrl: 'https://deepinfra.com/dash/api_keys' },
  { id: 'sambanova', name: 'SambaNova', kind: 'openai', base: 'https://api.sambanova.ai/v1', model: 'Meta-Llama-3.3-70B-Instruct', keyUrl: 'https://cloud.sambanova.ai/apis' },
  { id: 'novita', name: 'Novita AI', kind: 'openai', base: 'https://api.novita.ai/v3/openai', model: 'qwen/qwen-2.5-72b-instruct', keyUrl: 'https://novita.ai/settings/key-management' },
  { id: 'hyperbolic', name: 'Hyperbolic', kind: 'openai', base: 'https://api.hyperbolic.xyz/v1', model: 'Qwen/Qwen2.5-Coder-32B-Instruct', keyUrl: 'https://app.hyperbolic.xyz/settings' },
  { id: 'moonshot', name: 'Moonshot (Kimi)', kind: 'openai', base: 'https://api.moonshot.ai/v1', model: 'kimi-latest', keyUrl: 'https://platform.moonshot.ai/console/api-keys' },
  { id: 'dashscope', name: 'Alibaba Qwen', kind: 'openai', base: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', model: 'qwen-coder-plus', keyUrl: 'https://bailian.console.alibabacloud.com' },
  { id: 'zhipu', name: 'Zhipu (GLM)', kind: 'openai', base: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-plus', keyUrl: 'https://open.bigmodel.cn/usercenter/apikeys' },
  { id: 'ollama', name: 'Ollama (on this computer)', kind: 'openai', base: 'http://localhost:11434/v1', model: 'qwen2.5-coder', keyUrl: 'https://ollama.com/download', local: true },
  { id: 'lmstudio', name: 'LM Studio (on this computer)', kind: 'openai', base: 'http://localhost:1234/v1', model: 'local-model', keyUrl: 'https://lmstudio.ai', local: true },
];

const KEYS = 'oi1.code.helperKeys';
export function helperKeys(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(KEYS) ?? '{}') as Record<string, string>; } catch { return {}; }
}
export function setHelperKey(id: string, value: string) {
  const k = helperKeys();
  if (value.trim()) k[id] = value.trim(); else delete k[id];
  try { localStorage.setItem(KEYS, JSON.stringify(k)); } catch { /* private window */ }
}

export async function askHelper(h: Helper, key: string, prompt: string, signal?: AbortSignal): Promise<string> {
  const instruction = `${SYSTEM}\nAnswer ONLY with JSON: {"fixes":[{"file","line","title","why","severity","find","replace"}]}.`;
  if (h.kind === 'gemini') {
    const res = await fetch(`${h.base}/models/${h.model}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: instruction }] }, contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } }),
    });
    if (!res.ok) throw new Error(`${h.name}: ${res.status}`);
    const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    return data.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('') ?? '';
  }
  const res = await fetch(`${h.base}/chat/completions`, {
    method: 'POST', signal, headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify({ model: h.model, messages: [{ role: 'system', content: instruction }, { role: 'user', content: prompt }], response_format: { type: 'json_object' } }),
  });
  if (!res.ok) throw new Error(`${h.name}: ${res.status}`);
  const data = await res.json() as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? '';
}

/** Two AIs proposing the same change in the same place agree: the finding is marked and listed first. */
export function mergeFindings(lists: Finding[][]): (Finding & { agree: string[] })[] {
  const out: (Finding & { agree: string[] })[] = [];
  for (const list of lists) for (const f of list) {
    const twin = out.find(o => o.path === f.path && Math.abs(o.line - f.line) <= 2 && o.source !== f.source && o.source !== 'local');
    if (twin && f.source !== 'local') { twin.agree.push(f.source); continue; }
    out.push({ ...f, agree: [] });
  }
  const rank: Record<Severity, number> = { error: 0, warning: 1, info: 2 };
  return out.sort((a, b) => b.agree.length - a.agree.length || rank[a.severity] - rank[b.severity] || a.path.localeCompare(b.path) || a.line - b.line);
}
