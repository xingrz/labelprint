import { computed, reactive, watch } from 'vue';
import {
  collectParams,
  compileToSvg,
  emptyTemplate,
  makeElement,
  type LabelElement,
  type MediaProfile,
  type MediaType,
  type ParamDef,
  type PrintRecord,
  type PrintTargetConfig,
  type TemplateDoc,
} from '@labelprint/shared';
import { api } from './api';
import { bboxOf, translatePatch, unionBox, type Box } from './geometry';
import { t } from './i18n';

type AlignKind = 'left' | 'hcenter' | 'right' | 'top' | 'vmiddle' | 'bottom';
export type ViewName = 'templates' | 'design' | 'print' | 'history';
const viewNames: readonly ViewName[] = ['templates', 'design', 'print', 'history'];

interface HashRoute {
  view: ViewName;
  templateId?: string;
}

function isViewName(value: string): value is ViewName {
  return viewNames.includes(value as ViewName);
}

function parseHashRoute(hash = typeof window === 'undefined' ? '' : window.location.hash): HashRoute | null {
  const raw = hash.replace(/^#/, '').replace(/^\/+/, '');
  if (!raw) return null;
  const [viewRaw, templateRaw] = raw.split('/');
  if (!viewRaw || !isViewName(viewRaw)) return null;
  let templateId: string | undefined;
  try {
    templateId = templateRaw ? decodeURIComponent(templateRaw) : undefined;
  } catch {
    templateId = undefined;
  }
  return {
    view: viewRaw,
    templateId,
  };
}

function loadPanels(): { left: number; right: number } {
  try {
    const v = JSON.parse(localStorage.getItem('lp.panels') ?? '');
    if (v && typeof v.left === 'number' && typeof v.right === 'number') return v;
  } catch {
    /* ignore */
  }
  return { left: 168, right: 268 };
}

/** Persisted print-view state so a browser refresh doesn't lose the form. */
interface SavedPrint {
  v?: ViewName;
  t?: string;
  vals?: Record<string, string>;
  target?: string;
  c?: number;
}
function loadPrint(): SavedPrint {
  try {
    const x = JSON.parse(localStorage.getItem('lp.print') ?? '');
    return x && typeof x === 'object' ? (x as SavedPrint) : {};
  } catch {
    return {};
  }
}
const savedPrint = loadPrint();
const initialRoute = parseHashRoute();

interface State {
  doc: TemplateDoc | null;
  selectedIds: string[];
  templates: TemplateDoc[];
  targets: PrintTargetConfig[];
  view: { pxPerMm: number; showGrid: boolean; snap: boolean; gridStep: number };
  status: string;
  dirty: boolean;
  fonts: string[];
  activeView: ViewName;
  history: PrintRecord[];
  // print view (independent of the design doc)
  printTemplateId: string;
  printValues: Record<string, string>;
  printTargetId: string;
  printCopies: number;
  panels: { left: number; right: number };
}

export const state = reactive<State>({
  doc: null,
  selectedIds: [],
  templates: [],
  targets: [],
  view: { pxPerMm: 12, showGrid: true, snap: true, gridStep: 1 },
  status: '',
  dirty: false,
  fonts: [],
  activeView: initialRoute?.view ?? savedPrint.v ?? 'templates',
  history: [],
  printTemplateId: savedPrint.t ?? '',
  printValues: savedPrint.vals ?? {},
  printTargetId: savedPrint.target ?? '',
  printCopies: savedPrint.c ?? 1,
  panels: loadPanels(),
});

let hashRoutingReady = false;

function hashForRoute(route: HashRoute): string {
  const id = route.templateId ? `/${encodeURIComponent(route.templateId)}` : '';
  return `#/${route.view}${id}`;
}

function routeFromState(view = state.activeView): HashRoute {
  if (view === 'design' && state.doc?.id) return { view, templateId: state.doc.id };
  if (view === 'print' && state.printTemplateId) return { view, templateId: state.printTemplateId };
  return { view };
}

function writeHashRoute(route: HashRoute, replace = false): void {
  if (typeof window === 'undefined') return;
  const nextHash = hashForRoute(route);
  if (window.location.hash === nextHash) return;
  if (replace) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${nextHash}`);
  } else {
    window.location.hash = nextHash;
  }
}

function applyHashRoute(route: HashRoute): void {
  if (route.view === 'design' && route.templateId && state.templates.some((t) => t.id === route.templateId)) {
    selectTemplate(route.templateId);
  }
  if (
    route.view === 'print' &&
    route.templateId &&
    state.templates.some((t) => t.id === route.templateId) &&
    route.templateId !== state.printTemplateId
  ) {
    selectPrintTemplate(route.templateId, { syncHash: false });
  }
  state.activeView = route.view;
  if (route.view === 'history') void loadHistory();
}

export function initHashRouting(): void {
  if (typeof window === 'undefined' || hashRoutingReady) return;
  hashRoutingReady = true;
  const route = parseHashRoute();
  if (route) applyHashRoute(route);
  else writeHashRoute(routeFromState(), true);
  window.addEventListener('hashchange', () => {
    const next = parseHashRoute();
    if (next) {
      applyHashRoute(next);
      writeHashRoute(routeFromState(next.view), true);
    }
    else writeHashRoute(routeFromState(), true);
  });
}

// Persist the print view (template + filled values + target + copies + active tab).
watch(
  () =>
    JSON.stringify({
      v: state.activeView,
      t: state.printTemplateId,
      vals: state.printValues,
      target: state.printTargetId,
      c: state.printCopies,
    }),
  (s) => {
    try {
      localStorage.setItem('lp.print', s);
    } catch {
      /* ignore */
    }
  },
);

/** Canvas SVG: design mode shows {{placeholders}} + asset boxes, using template defaults. */
export const designSvg = computed(() =>
  state.doc ? compileToSvg(state.doc, { values: state.doc.defaults, designMode: true }) : '',
);

export const selectedElements = computed<LabelElement[]>(() =>
  state.doc ? state.doc.elements.filter((e) => state.selectedIds.includes(e.id)) : [],
);

export const usedParams = computed(() => (state.doc ? collectParams(state.doc) : []));

export const printTemplate = computed(
  () => state.templates.find((t) => t.id === state.printTemplateId) ?? null,
);
export const printParams = computed(() =>
  printTemplate.value ? collectParams(printTemplate.value) : [],
);

function ensurePrintTarget(): void {
  if (!state.targets.length) {
    state.printTargetId = '';
    return;
  }
  if (!state.printTargetId || !state.targets.some((p) => p.id === state.printTargetId)) {
    state.printTargetId = state.targets[0]!.id;
  }
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
}

/**
 * Deep clone via JSON. Our docs/elements are pure data, and (crucially) the source
 * is usually a Vue `reactive` Proxy — which structuredClone cannot clone.
 */
function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

function markDirty(): void {
  state.dirty = true;
}

function setStatus(s: string): void {
  state.status = s;
}

export async function loadAll(): Promise<void> {
  try {
    const [templates, targets] = await Promise.all([
      api.templates(),
      api.targets(),
    ]);
    state.templates = templates;
    state.targets = targets;
    ensurePrintTarget();
    const route = parseHashRoute();
    if (route?.view === 'design' && route.templateId) selectTemplate(route.templateId);
    if (!state.doc && templates.length) selectTemplate(templates[0]!.id);
    // Keep the restored print template + values if it still exists; else pick the first.
    if (route?.view === 'print' && route.templateId && templates.some((t) => t.id === route.templateId)) {
      if (state.printTemplateId !== route.templateId) selectPrintTemplate(route.templateId, { syncHash: false });
    }
    if (templates.length && (!state.printTemplateId || !templates.some((t) => t.id === state.printTemplateId)))
      selectPrintTemplate(templates[0]!.id, { syncHash: false });
    if (route) {
      applyHashRoute(route);
      writeHashRoute(routeFromState(route.view), true);
    }
    else writeHashRoute(routeFromState(), true);
    await loadHistory();
    // Fonts can be a slow first scan on the print host — load without blocking.
    api.fonts().then((r) => (state.fonts = r.families)).catch(() => undefined);
    setStatus(t('status.connected'));
  } catch (e) {
    setStatus(t('status.connectFailed', { message: (e as Error).message }));
  }
}

export function selectTemplate(id: string): void {
  const found = state.templates.find((t) => t.id === id);
  if (!found) return;
  state.doc = clone(found);
  state.selectedIds = [];
  state.dirty = false;
}

export function newTemplate(media: MediaProfile): void {
  const id = genId('t');
  const doc = emptyTemplate(id, t('template.newName', { number: state.templates.length + 1 }), media);
  state.templates.push(doc);
  state.doc = clone(doc);
  state.selectedIds = [];
  markDirty();
}

export function addElement(type: LabelElement['type']): void {
  if (!state.doc) return;
  const el = makeElement(type);
  el.id = genId(type);
  if (el.type === 'text') el.text = t('props.element.text');
  // place near top-left, nudged so successive adds don't stack exactly
  const n = state.doc.elements.length;
  el.x = 2 + (n % 5) * 1;
  el.y = 2 + (n % 5) * 1;
  state.doc.elements.push(el);
  state.selectedIds = [el.id];
  markDirty();
}

export function setSelection(ids: string[]): void {
  state.selectedIds = ids;
}

export function toggleSelection(id: string, additive: boolean): void {
  if (!additive) {
    state.selectedIds = [id];
    return;
  }
  state.selectedIds = state.selectedIds.includes(id)
    ? state.selectedIds.filter((x) => x !== id)
    : [...state.selectedIds, id];
}

export function clearSelection(): void {
  state.selectedIds = [];
}

export function updateElement(id: string, patch: Partial<LabelElement>): void {
  if (!state.doc) return;
  const el = state.doc.elements.find((e) => e.id === id);
  if (!el) return;
  Object.assign(el, patch);
  markDirty();
}

export function translateElement(id: string, dx: number, dy: number): void {
  if (!state.doc) return;
  const el = state.doc.elements.find((e) => e.id === id);
  if (!el) return;
  Object.assign(el, translatePatch(el, dx, dy));
  markDirty();
}

export function nudgeSelection(dx: number, dy: number): void {
  for (const el of selectedElements.value) translateElement(el.id, dx, dy);
}

export function deleteSelected(): void {
  if (!state.doc) return;
  state.doc.elements = state.doc.elements.filter((e) => !state.selectedIds.includes(e.id));
  state.selectedIds = [];
  markDirty();
}

export function duplicateSelected(): void {
  if (!state.doc) return;
  const clones: LabelElement[] = [];
  for (const el of selectedElements.value) {
    const copy = clone(el);
    copy.id = genId(el.type);
    Object.assign(copy, translatePatch(copy, 2, 2));
    clones.push(copy);
  }
  state.doc.elements.push(...clones);
  state.selectedIds = clones.map((c) => c.id);
  markDirty();
}

function setBoxPos(el: LabelElement, nx: number, ny: number): void {
  const b = bboxOf(el);
  Object.assign(el, translatePatch(el, nx - b.x, ny - b.y));
}

export function align(kind: AlignKind): void {
  if (!state.doc) return;
  const els = selectedElements.value;
  if (!els.length) return;
  const ref: Box =
    els.length === 1
      ? { x: 0, y: 0, w: state.doc.media.widthMm, h: state.doc.media.heightMm }
      : unionBox(els.map(bboxOf));
  for (const el of els) {
    const b = bboxOf(el);
    if (kind === 'left') setBoxPos(el, ref.x, b.y);
    else if (kind === 'hcenter') setBoxPos(el, ref.x + ref.w / 2 - b.w / 2, b.y);
    else if (kind === 'right') setBoxPos(el, ref.x + ref.w - b.w, b.y);
    else if (kind === 'top') setBoxPos(el, b.x, ref.y);
    else if (kind === 'vmiddle') setBoxPos(el, b.x, ref.y + ref.h / 2 - b.h / 2);
    else if (kind === 'bottom') setBoxPos(el, b.x, ref.y + ref.h - b.h);
  }
  markDirty();
}

export function distribute(axis: 'h' | 'v'): void {
  const els = selectedElements.value;
  if (els.length < 3) return;
  const withBox = els.map((el) => ({ el, b: bboxOf(el) }));
  if (axis === 'h') {
    withBox.sort((a, b) => a.b.x + a.b.w / 2 - (b.b.x + b.b.w / 2));
    const first = withBox[0]!;
    const last = withBox[withBox.length - 1]!;
    const c0 = first.b.x + first.b.w / 2;
    const c1 = last.b.x + last.b.w / 2;
    const step = (c1 - c0) / (withBox.length - 1);
    withBox.forEach((item, i) => {
      const targetCenter = c0 + step * i;
      setBoxPos(item.el, targetCenter - item.b.w / 2, item.b.y);
    });
  } else {
    withBox.sort((a, b) => a.b.y + a.b.h / 2 - (b.b.y + b.b.h / 2));
    const first = withBox[0]!;
    const last = withBox[withBox.length - 1]!;
    const c0 = first.b.y + first.b.h / 2;
    const c1 = last.b.y + last.b.h / 2;
    const step = (c1 - c0) / (withBox.length - 1);
    withBox.forEach((item, i) => {
      const targetCenter = c0 + step * i;
      setBoxPos(item.el, item.b.x, targetCenter - item.b.h / 2);
    });
  }
  markDirty();
}

function reorder(id: string, dir: 'front' | 'back' | 'forward' | 'backward'): void {
  if (!state.doc) return;
  const els = state.doc.elements;
  const i = els.findIndex((e) => e.id === id);
  if (i < 0) return;
  const [el] = els.splice(i, 1);
  if (!el) return;
  if (dir === 'front') els.push(el);
  else if (dir === 'back') els.unshift(el);
  else if (dir === 'forward') els.splice(Math.min(els.length, i + 1), 0, el);
  else els.splice(Math.max(0, i - 1), 0, el);
  markDirty();
}

export function zorder(dir: 'front' | 'back' | 'forward' | 'backward'): void {
  for (const el of selectedElements.value) reorder(el.id, dir);
}

export function setMediaGeometry(patch: Partial<{ widthMm: number; heightMm: number; type: MediaType; gapMm: number }>): void {
  if (!state.doc) return;
  Object.assign(state.doc.media, patch);
  markDirty();
}

export function applyMediaProfile(m: MediaProfile): void {
  if (!state.doc) return;
  state.doc.media.widthMm = m.widthMm;
  state.doc.media.heightMm = m.heightMm ?? state.doc.media.heightMm;
  state.doc.media.type = m.type;
  if (m.gapMm !== undefined) state.doc.media.gapMm = m.gapMm;
  markDirty();
}

export async function save(): Promise<void> {
  if (!state.doc) return;
  try {
    const saved = await api.saveTemplate(state.doc);
    const idx = state.templates.findIndex((t) => t.id === saved.id);
    if (idx >= 0) state.templates[idx] = saved;
    else state.templates.push(saved);
    state.doc = clone(saved);
    if (state.printTemplateId === saved.id) selectPrintTemplate(saved.id);
    state.dirty = false;
    setStatus(t('status.saved', { name: saved.name }));
  } catch (e) {
    setStatus(t('status.saveFailed', { message: (e as Error).message }));
  }
}

export async function removeTemplate(id: string): Promise<void> {
  try {
    await api.deleteTemplate(id);
    state.templates = state.templates.filter((t) => t.id !== id);
    if (state.doc?.id === id) {
      state.doc = null;
      if (state.templates.length) selectTemplate(state.templates[0]!.id);
    }
    setStatus(t('status.deletedTemplate'));
  } catch (e) {
    setStatus(t('status.deleteFailed', { message: (e as Error).message }));
  }
}

/** Duplicate a template; stays in the templates list. */
export async function duplicateTemplateById(id: string): Promise<void> {
  const src = state.templates.find((t) => t.id === id);
  if (!src) return;
  const copy = clone(src);
  copy.id = genId('t');
  copy.name = t('template.copySuffix', { name: src.name });
  try {
    const saved = await api.saveTemplate(copy);
    state.templates.push(saved);
    setStatus(t('status.copied', { name: saved.name }));
  } catch (e) {
    setStatus(t('status.copyFailed', { message: (e as Error).message }));
  }
}

/** Open a template in the designer. */
export function openTemplate(id: string): void {
  selectTemplate(id);
  setActiveView('design');
}

/** Create a new template and open it in the designer. */
export function createTemplate(media: MediaProfile): void {
  newTemplate(media);
  setActiveView('design');
}

export async function saveTarget(target: PrintTargetConfig): Promise<PrintTargetConfig> {
  const saved = await api.saveTarget(target);
  const idx = state.targets.findIndex((p) => p.id === saved.id);
  if (idx >= 0) state.targets[idx] = saved;
  else state.targets.push(saved);
  ensurePrintTarget();
  return saved;
}

export async function removeTarget(id: string): Promise<void> {
  await api.deleteTarget(id);
  state.targets = state.targets.filter((p) => p.id !== id);
  ensurePrintTarget();
}

export async function saveTargetOrder(ids: string[]): Promise<void> {
  state.targets = await api.reorderTargets(ids);
  ensurePrintTarget();
}

// ---- param definitions (edited in the design view) ----

function ensureParamDef(key: string): ParamDef {
  if (!state.doc) throw new Error('no doc');
  let def = state.doc.params.find((p) => p.key === key);
  if (!def) {
    def = { key };
    state.doc.params.push(def);
  }
  return def;
}

export function setParamLabel(key: string, label: string): void {
  ensureParamDef(key).label = label;
  markDirty();
}

export function setParamDefault(key: string, value: string): void {
  if (!state.doc) return;
  ensureParamDef(key).default = value;
  if (!state.doc.defaults) state.doc.defaults = {};
  state.doc.defaults[key] = value;
  markDirty();
}

export function setParamMultiline(key: string, value: boolean): void {
  ensureParamDef(key).multiline = value;
  markDirty();
}

// ---- views / panels ----

export function setActiveView(v: ViewName, opts: { replace?: boolean; syncHash?: boolean } = {}): void {
  state.activeView = v;
  if (v === 'history') void loadHistory();
  if (opts.syncHash !== false) writeHashRoute(routeFromState(v), opts.replace);
}

export function setPanelWidth(side: 'left' | 'right', px: number): void {
  state.panels[side] = Math.max(120, Math.min(560, Math.round(px)));
  try {
    localStorage.setItem('lp.panels', JSON.stringify(state.panels));
  } catch {
    /* ignore */
  }
}

// ---- print view ----

export function selectPrintTemplate(id: string, opts: { syncHash?: boolean } = {}): void {
  state.printTemplateId = id;
  const t = state.templates.find((x) => x.id === id);
  const v: Record<string, string> = {};
  if (t) for (const key of collectParams(t)) v[key] = t.defaults?.[key] ?? '';
  state.printValues = v;
  if (opts.syncHash !== false && state.activeView === 'print') writeHashRoute(routeFromState('print'), true);
}

export async function printNow(): Promise<void> {
  if (!state.printTemplateId) throw new Error(t('error.noTemplateSelected'));
  if (!state.printTargetId) throw new Error(t('error.noTargetSelected'));
  const res = await api.printTarget(state.printTargetId, state.printTemplateId, state.printValues, state.printCopies);
  setStatus(t('status.printed', { target: res.target, detail: res.detail }));
  await loadHistory();
}

// ---- history ----

export async function loadHistory(): Promise<void> {
  try {
    state.history = await api.history();
  } catch {
    /* ignore */
  }
}

export async function deleteHistoryItem(id: string): Promise<void> {
  await api.deleteHistory(id);
  state.history = state.history.filter((h) => h.id !== id);
}

export async function clearHistory(): Promise<void> {
  await api.clearHistory();
  state.history = [];
}

/** Load a history record into the print view for a quick reprint. */
export function reprintFrom(rec: PrintRecord): void {
  state.printTemplateId = rec.templateId;
  state.printValues = { ...rec.values };
  state.printCopies = rec.copies;
  if (rec.targetId) state.printTargetId = rec.targetId;
  setActiveView('print');
}
