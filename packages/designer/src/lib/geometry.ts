import type { LabelElement } from '@labelprint/shared';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Axis-aligned bounding box of an element, in mm. */
export function bboxOf(el: LabelElement): Box {
  switch (el.type) {
    case 'line': {
      const x = Math.min(el.x, el.x2);
      const y = Math.min(el.y, el.y2);
      return { x, y, w: Math.abs(el.x2 - el.x), h: Math.abs(el.y2 - el.y) };
    }
    case 'qrcode':
      return { x: el.x, y: el.y, w: el.size, h: el.size };
    default:
      return { x: el.x, y: el.y, w: el.w, h: el.h };
  }
}

/** Patch that translates an element by (dx, dy) mm (handles line's two endpoints). */
export function translatePatch(el: LabelElement, dx: number, dy: number): Partial<LabelElement> {
  if (el.type === 'line') {
    return { x: el.x + dx, y: el.y + dy, x2: el.x2 + dx, y2: el.y2 + dy } as Partial<LabelElement>;
  }
  return { x: el.x + dx, y: el.y + dy } as Partial<LabelElement>;
}

export function unionBox(boxes: Box[]): Box {
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const r = Math.max(...boxes.map((b) => b.x + b.w));
  const bottom = Math.max(...boxes.map((b) => b.y + b.h));
  return { x, y, w: r - x, h: bottom - y };
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function snapToStep(n: number, step: number): number {
  return step > 0 ? Math.round(n / step) * step : n;
}

export interface SnapResult {
  dx: number;
  dy: number;
  guidesX: number[];
  guidesY: number[];
}

/**
 * Compute a snap correction for a moving box against candidate guide lines.
 * Snaps the box's left/centre/right to candidate Xs and top/middle/bottom to Ys,
 * within `threshold` mm. Returns the correction and the lines that matched.
 */
export function computeSnap(
  box: Box,
  candidatesX: number[],
  candidatesY: number[],
  threshold: number,
): SnapResult {
  const anchorsX = [box.x, box.x + box.w / 2, box.x + box.w];
  const anchorsY = [box.y, box.y + box.h / 2, box.y + box.h];

  let best = { delta: Infinity, line: NaN };
  for (const a of anchorsX)
    for (const c of candidatesX) {
      const d = c - a;
      if (Math.abs(d) < Math.abs(best.delta)) best = { delta: d, line: c };
    }
  const dx = Math.abs(best.delta) <= threshold ? best.delta : 0;
  const lineX = best.line;

  best = { delta: Infinity, line: NaN };
  for (const a of anchorsY)
    for (const c of candidatesY) {
      const d = c - a;
      if (Math.abs(d) < Math.abs(best.delta)) best = { delta: d, line: c };
    }
  const dy = Math.abs(best.delta) <= threshold ? best.delta : 0;
  const lineY = best.line;

  return {
    dx,
    dy,
    guidesX: dx !== 0 && Number.isFinite(lineX) ? [lineX] : [],
    guidesY: dy !== 0 && Number.isFinite(lineY) ? [lineY] : [],
  };
}
