<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import type { LabelElement } from '@labelprint/shared';
import {
  clearSelection,
  designSvg,
  selectedElements,
  setSelection,
  state,
  toggleSelection,
  updateElement,
} from '../lib/store';
import { bboxOf, computeSnap, round1, snapToStep, translatePatch, type Box } from '../lib/geometry';
import { t } from '../lib/i18n';

const stageEl = ref<HTMLDivElement | null>(null);

const W = computed(() => state.doc?.media.widthMm ?? 0);
const H = computed(() => state.doc?.media.heightMm ?? 0);
const pxPerMm = computed(() => state.view.pxPerMm);
const pxW = computed(() => W.value * pxPerMm.value);
const pxH = computed(() => H.value * pxPerMm.value);
const elements = computed<LabelElement[]>(() => state.doc?.elements ?? []);
const selectedIds = computed(() => state.selectedIds);
const single = computed(() => selectedElements.value.length === 1);
const selectedEl = computed<LabelElement | null>(() => selectedElements.value[0] ?? null);

const guidesX = ref<number[]>([]);
const guidesY = ref<number[]>([]);

const gridStyle = computed(() => {
  const step = state.view.gridStep * pxPerMm.value;
  return {
    backgroundSize: `${step}px ${step}px`,
    backgroundImage:
      'linear-gradient(to right, rgba(31, 111, 235, 0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(31, 111, 235, 0.12) 1px, transparent 1px)',
  };
});

function isSelected(id: string): boolean {
  return selectedIds.value.includes(id);
}

/** A clickable rect for an element, padded so thin lines/text remain easy to grab. */
function hitBox(el: LabelElement): Box {
  const b = bboxOf(el);
  const minW = 1.5;
  const minH = 1.5;
  const w = Math.max(b.w, minW);
  const h = Math.max(b.h, minH);
  return { x: b.x - (w - b.w) / 2, y: b.y - (h - b.h) / 2, w, h };
}

const handleMm = computed(() => 8 / pxPerMm.value);

interface Handle {
  k: string;
  x: number;
  y: number;
}
const handles = computed<Handle[]>(() => {
  const el = selectedEl.value;
  if (!el || !single.value) return [];
  if (el.type === 'line') {
    return [
      { k: 'p1', x: el.x, y: el.y },
      { k: 'p2', x: el.x2, y: el.y2 },
    ];
  }
  const b = bboxOf(el);
  const defs: [string, number, number][] = [
    ['nw', b.x, b.y],
    ['n', b.x + b.w / 2, b.y],
    ['ne', b.x + b.w, b.y],
    ['e', b.x + b.w, b.y + b.h / 2],
    ['se', b.x + b.w, b.y + b.h],
    ['s', b.x + b.w / 2, b.y + b.h],
    ['sw', b.x, b.y + b.h],
    ['w', b.x, b.y + b.h / 2],
  ];
  return defs.map(([k, x, y]) => ({ k, x, y }));
});

// ---- pointer interaction ----
interface DragState {
  mode: 'idle' | 'move' | 'resize';
  startX: number;
  startY: number;
  origin: { id: string; b: Box }[];
  primaryId: string;
  primaryB: Box;
  handle: string;
  origBox: Box;
}
const drag = ref<DragState>({
  mode: 'idle',
  startX: 0,
  startY: 0,
  origin: [],
  primaryId: '',
  primaryB: { x: 0, y: 0, w: 0, h: 0 },
  handle: '',
  origBox: { x: 0, y: 0, w: 0, h: 0 },
});

function toMm(e: PointerEvent): { x: number; y: number } {
  const r = stageEl.value!.getBoundingClientRect();
  return { x: (e.clientX - r.left) / pxPerMm.value, y: (e.clientY - r.top) / pxPerMm.value };
}

function setBoxPos(el: LabelElement, nx: number, ny: number): void {
  const b = bboxOf(el);
  updateElement(el.id, translatePatch(el, nx - b.x, ny - b.y));
}

function candidates(): { candX: number[]; candY: number[] } {
  const candX = [0, W.value / 2, W.value];
  const candY = [0, H.value / 2, H.value];
  for (const el of elements.value) {
    if (selectedIds.value.includes(el.id)) continue;
    const b = bboxOf(el);
    candX.push(b.x, b.x + b.w / 2, b.x + b.w);
    candY.push(b.y, b.y + b.h / 2, b.y + b.h);
  }
  return { candX, candY };
}

function onElementDown(e: PointerEvent, el: LabelElement): void {
  e.preventDefault();
  if (e.shiftKey) toggleSelection(el.id, true);
  else if (!isSelected(el.id)) setSelection([el.id]);
  const start = toMm(e);
  drag.value = {
    mode: 'move',
    startX: start.x,
    startY: start.y,
    origin: selectedElements.value.map((s) => ({ id: s.id, b: bboxOf(s) })),
    primaryId: el.id,
    primaryB: bboxOf(el),
    handle: '',
    origBox: { x: 0, y: 0, w: 0, h: 0 },
  };
  addListeners();
}

function onHandleDown(e: PointerEvent, h: Handle): void {
  e.preventDefault();
  const el = selectedEl.value;
  if (!el) return;
  drag.value = { ...drag.value, mode: 'resize', handle: h.k, origBox: bboxOf(el) };
  addListeners();
}

function onPointerMove(e: PointerEvent): void {
  if (drag.value.mode === 'move') onMoveDrag(e);
  else if (drag.value.mode === 'resize') onResizeDrag(e);
}

function onMoveDrag(e: PointerEvent): void {
  const p = toMm(e);
  let dx = p.x - drag.value.startX;
  let dy = p.y - drag.value.startY;
  if (state.view.snap) {
    if (state.view.gridStep > 0) {
      dx = snapToStep(drag.value.primaryB.x + dx, state.view.gridStep) - drag.value.primaryB.x;
      dy = snapToStep(drag.value.primaryB.y + dy, state.view.gridStep) - drag.value.primaryB.y;
    }
    const prop: Box = { ...drag.value.primaryB, x: drag.value.primaryB.x + dx, y: drag.value.primaryB.y + dy };
    const { candX, candY } = candidates();
    const snap = computeSnap(prop, candX, candY, 6 / pxPerMm.value);
    dx += snap.dx;
    dy += snap.dy;
    guidesX.value = snap.guidesX;
    guidesY.value = snap.guidesY;
  } else {
    dx = round1(dx);
    dy = round1(dy);
    guidesX.value = [];
    guidesY.value = [];
  }
  for (const o of drag.value.origin) {
    const el = elements.value.find((x) => x.id === o.id);
    if (el) setBoxPos(el, o.b.x + dx, o.b.y + dy);
  }
}

function onResizeDrag(e: PointerEvent): void {
  const el = selectedEl.value;
  if (!el) return;
  const p = toMm(e);
  const g = state.view.snap ? state.view.gridStep : 0;
  const px = g ? snapToStep(p.x, g) : Math.round(p.x * 10) / 10;
  const py = g ? snapToStep(p.y, g) : Math.round(p.y * 10) / 10;

  if (el.type === 'line') {
    if (drag.value.handle === 'p1') updateElement(el.id, { x: px, y: py });
    else updateElement(el.id, { x2: px, y2: py });
    return;
  }

  const o = drag.value.origBox;
  let left = o.x;
  let top = o.y;
  let right = o.x + o.w;
  let bottom = o.y + o.h;
  const MIN = 1;
  const k = drag.value.handle;
  if (k.includes('w')) left = Math.min(px, right - MIN);
  if (k.includes('e')) right = Math.max(px, left + MIN);
  if (k.includes('n')) top = Math.min(py, bottom - MIN);
  if (k.includes('s')) bottom = Math.max(py, top + MIN);
  const box: Box = { x: left, y: top, w: right - left, h: bottom - top };

  if (el.type === 'qrcode') updateElement(el.id, { x: box.x, y: box.y, size: Math.max(box.w, box.h) });
  else updateElement(el.id, { x: box.x, y: box.y, w: box.w, h: box.h });
}

function onPointerUp(): void {
  drag.value.mode = 'idle';
  guidesX.value = [];
  guidesY.value = [];
  removeListeners();
}

function addListeners(): void {
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
}
function removeListeners(): void {
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
}

function onBackgroundDown(): void {
  clearSelection();
}

// ---- keyboard ----
function onKey(e: KeyboardEvent): void {
  const tag = (e.target as HTMLElement)?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  if (!state.doc || !selectedElements.value.length) return;
  const step = (e.shiftKey ? 5 : 1) * (state.view.gridStep || 0.5);
  if (e.key === 'ArrowLeft') {
    nudge(-step, 0);
    e.preventDefault();
  } else if (e.key === 'ArrowRight') {
    nudge(step, 0);
    e.preventDefault();
  } else if (e.key === 'ArrowUp') {
    nudge(0, -step);
    e.preventDefault();
  } else if (e.key === 'ArrowDown') {
    nudge(0, step);
    e.preventDefault();
  } else if (e.key === 'Escape') {
    clearSelection();
  }
}
function nudge(dx: number, dy: number): void {
  // setBoxPos -> updateElement already marks the doc dirty.
  for (const el of selectedElements.value) {
    const b = bboxOf(el);
    setBoxPos(el, b.x + dx, b.y + dy);
  }
}

onMounted(() => window.addEventListener('keydown', onKey));
onUnmounted(() => {
  window.removeEventListener('keydown', onKey);
  removeListeners();
});
</script>

<template>
  <div class="canvas-wrap">
    <div class="canvas-scroll" @pointerdown="onBackgroundDown">
      <div
        v-if="state.doc"
        ref="stageEl"
        class="stage"
        :style="{ width: pxW + 'px', height: pxH + 'px' }"
        @pointerdown="onBackgroundDown"
      >
        <div v-if="state.view.showGrid" class="grid" :style="gridStyle"></div>
        <!-- WYSIWYG content from the SHARED compiler (same code the server rasterises) -->
        <div class="label" v-html="designSvg"></div>

        <!-- interaction overlay (mm coordinate space) -->
        <svg class="overlay" :viewBox="`0 0 ${W} ${H}`" :width="pxW" :height="pxH">
          <rect
            v-for="el in elements"
            :key="'hit-' + el.id"
            class="hit"
            :class="{ sel: isSelected(el.id) }"
            :x="hitBox(el).x"
            :y="hitBox(el).y"
            :width="hitBox(el).w"
            :height="hitBox(el).h"
            @pointerdown.stop="onElementDown($event, el)"
          />

          <rect
            v-for="el in selectedElements"
            :key="'out-' + el.id"
            class="sel-outline"
            :x="bboxOf(el).x"
            :y="bboxOf(el).y"
            :width="bboxOf(el).w"
            :height="bboxOf(el).h"
            vector-effect="non-scaling-stroke"
          />

          <rect
            v-for="h in handles"
            :key="'h-' + h.k"
            class="handle"
            :x="h.x - handleMm / 2"
            :y="h.y - handleMm / 2"
            :width="handleMm"
            :height="handleMm"
            vector-effect="non-scaling-stroke"
            @pointerdown.stop="onHandleDown($event, h)"
          />

          <line
            v-for="(gx, i) in guidesX"
            :key="'gx' + i"
            class="guide"
            :x1="gx"
            :y1="0"
            :x2="gx"
            :y2="H"
            vector-effect="non-scaling-stroke"
          />
          <line
            v-for="(gy, i) in guidesY"
            :key="'gy' + i"
            class="guide"
            :x1="0"
            :y1="gy"
            :x2="W"
            :y2="gy"
            vector-effect="non-scaling-stroke"
          />
        </svg>
      </div>
      <div v-else class="empty">{{ t('canvas.empty') }}</div>
    </div>
  </div>
</template>

<style scoped>
.canvas-wrap {
  flex: 1;
  min-width: 0;
  display: flex;
  background:
    linear-gradient(var(--canvas-grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--canvas-grid) 1px, transparent 1px),
    var(--canvas-bg);
  background-size: 24px 24px, 24px 24px, auto;
  overflow: hidden;
}
.canvas-scroll {
  flex: 1;
  overflow: auto;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  padding: 48px;
}
.stage {
  position: relative;
  background: var(--paper);
  box-shadow: var(--shadow-paper);
  flex: none;
  margin: auto;
  outline: 1px solid rgba(24, 32, 51, 0.08);
}
.stage::before {
  content: '';
  position: absolute;
  inset: -10px;
  border: 1px solid rgba(24, 32, 51, 0.08);
  pointer-events: none;
}
.grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.label {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.label :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}
.overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.overlay .hit {
  fill: transparent;
  pointer-events: all;
  cursor: move;
}
.overlay .sel-outline {
  fill: none;
  stroke: var(--accent);
  stroke-width: 1.2px;
  stroke-dasharray: 4 2;
}
.overlay .handle {
  fill: var(--paper);
  stroke: var(--accent);
  stroke-width: 1.2px;
  pointer-events: all;
  cursor: nwse-resize;
}
.overlay .guide {
  stroke: #e04f2f;
  stroke-width: 1px;
}
.empty {
  color: var(--muted);
  margin: auto;
  padding: 18px 22px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: 0 1px 2px rgba(24, 32, 51, 0.06);
}

@media (max-width: 860px) {
  .canvas-scroll {
    padding: 24px;
  }
}

@media (max-width: 520px) {
  .canvas-scroll {
    padding: 18px;
  }
}
</style>
