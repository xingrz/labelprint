import type { LabelElement, ParamDef, TemplateDoc } from './types.js';

// Unicode-aware: keys may be Chinese, e.g. {{品名}}. \p{L}=letters, \p{N}=numbers.
const PLACEHOLDER = /\{\{\s*([\p{L}\p{N}_.\-]+)\s*\}\}/gu;

export interface Segment {
  kind: 'text' | 'param';
  /** Literal text, or the raw `{{key}}` token for params. */
  text: string;
  /** Present for params. */
  key?: string;
}

/** Split a string into literal vs `{{placeholder}}` segments (for per-segment styling). */
export function splitPlaceholders(s: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of s.matchAll(PLACEHOLDER)) {
    const idx = m.index ?? 0;
    if (idx > last) out.push({ kind: 'text', text: s.slice(last, idx) });
    out.push({ kind: 'param', text: m[0], key: m[1] });
    last = idx + m[0].length;
  }
  if (last < s.length) out.push({ kind: 'text', text: s.slice(last) });
  return out;
}

/** Return the unique placeholder keys found in a string, in order of appearance. */
export function extractKeys(s: string | undefined): string[] {
  if (!s) return [];
  const out: string[] = [];
  for (const m of s.matchAll(PLACEHOLDER)) {
    const key = m[1];
    if (key && !out.includes(key)) out.push(key);
  }
  return out;
}

/** Strings on an element that can carry placeholders. */
function templatedStrings(el: LabelElement): string[] {
  switch (el.type) {
    case 'text':
      return [el.text];
    case 'barcode':
    case 'qrcode':
      return [el.value];
    case 'image':
      return [el.src];
    default:
      return [];
  }
}

/** Collect every placeholder key used anywhere in the template. */
export function collectParams(doc: TemplateDoc): string[] {
  const keys: string[] = [];
  for (const el of doc.elements) {
    for (const s of templatedStrings(el)) {
      for (const k of extractKeys(s)) if (!keys.includes(k)) keys.push(k);
    }
  }
  return keys;
}

/**
 * Resolve the effective value for a key from (in priority order):
 * explicit values -> template defaults -> param default -> empty string.
 */
export function resolveValue(
  key: string,
  values: Record<string, string> | undefined,
  doc: TemplateDoc,
): string {
  if (values && key in values && values[key] !== undefined) return values[key]!;
  if (doc.defaults && key in doc.defaults) return doc.defaults[key]!;
  const def = doc.params.find((p) => p.key === key);
  if (def?.default !== undefined) return def.default;
  return '';
}

export interface ApplyParamsOptions {
  /**
   * What to render when a placeholder resolves to empty:
   * - 'blank' (default): empty string — the real print output.
   * - 'token': keep the literal {{key}} so the field stays visible while designing.
   */
  onEmpty?: 'blank' | 'token';
}

/** Substitute {{key}} placeholders in a string using the resolver. */
export function applyParams(
  s: string,
  values: Record<string, string> | undefined,
  doc: TemplateDoc,
  opts?: ApplyParamsOptions,
): string {
  return s.replace(PLACEHOLDER, (full, key: string) => {
    const v = resolveValue(key, values, doc);
    if (v === '' && opts?.onEmpty === 'token') return full;
    return v;
  });
}

/** Merge auto-detected placeholder keys into the declared params, preserving existing defs. */
export function syncParamDefs(doc: TemplateDoc): ParamDef[] {
  const used = collectParams(doc);
  const existing = new Map(doc.params.map((p) => [p.key, p]));
  return used.map((key) => existing.get(key) ?? { key });
}
