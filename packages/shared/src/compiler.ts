/**
 * JSON template document -> SVG string.
 *
 * This module is the single source of truth for layout. It is imported by BOTH
 * the browser designer (live preview) and the Node server (print rasterisation),
 * so what you see in the designer is exactly what gets rasterised for the printer.
 *
 * Output is authored in mm user-units (viewBox "0 0 widthMm heightMm"). The browser
 * scales it with CSS; the server hands it to resvg with fitTo=width(dots) to rasterise
 * at the printer's DPI. Geometry is therefore identical across both — true WYSIWYG.
 *
 * Pure & isomorphic: no Node or DOM APIs. Barcode/QR/image pixels are injected via
 * `assets` (caller pre-renders them, since that needs platform-specific libraries).
 */
import type {
  BoxElement,
  LabelElement,
  LineElement,
  TemplateDoc,
  TextElement,
} from './types.js';
import { applyParams, resolveValue, splitPlaceholders } from './params.js';
import { ptToMm } from './units.js';

/** Colour for parameter-driven text in the designer canvas (matches the param panel). */
const DESIGN_PARAM_COLOR = '#2563eb';

export interface CompileOptions {
  values?: Record<string, string>;
  /** elementId -> data URL (PNG/SVG) for barcode/qrcode/image elements. */
  assets?: Record<string, string>;
  /** Draw a faint outline + label for asset elements that have no rendered asset (designer aid). */
  placeholders?: boolean;
  /**
   * Designer mode: unfilled {{placeholders}} stay visible as their literal token, and
   * asset elements always show their placeholder box. Off = real print output.
   */
  designMode?: boolean;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function num(n: number): string {
  // Trim to 4 decimals to keep SVG compact and deterministic.
  return (Math.round(n * 10000) / 10000).toString();
}

/** Wrap an element body in a rotation transform around its anchor point, if rotated. */
function withRotation(el: LabelElement, body: string): string {
  if (!el.rotation) return body;
  return `<g transform="rotate(${num(el.rotation)} ${num(el.x)} ${num(el.y)})">${body}</g>`;
}

/** Design-mode line: literal text in the element colour, param segments in blue. */
function designLineContent(line: string, opts: CompileOptions, doc: TemplateDoc): string {
  return splitPlaceholders(line)
    .map((seg) => {
      if (seg.kind === 'text') return esc(seg.text);
      const v = resolveValue(seg.key ?? '', opts.values, doc);
      const shown = v !== '' ? v : seg.text; // the value, or the {{key}} token if unfilled
      return `<tspan fill="${DESIGN_PARAM_COLOR}">${esc(shown)}</tspan>`;
    })
    .join('');
}

function renderText(el: TextElement, doc: TemplateDoc, opts: CompileOptions): string {
  const fontMm = ptToMm(el.fontSizePt);
  const lh = fontMm * (el.lineHeight ?? 1.2);
  const ascent = fontMm * 0.8; // approximation; resvg & browser agree closely for first baseline

  // Design mode keeps the raw template (placeholders coloured per-segment); output mode
  // substitutes values first, then splits on newlines.
  const lines = opts.designMode ? el.text.split('\n') : applyParams(el.text, opts.values, doc).split('\n');

  const anchorX = el.align === 'center' ? el.x + el.w / 2 : el.align === 'right' ? el.x + el.w : el.x;
  const textAnchor = el.align === 'center' ? 'middle' : el.align === 'right' ? 'end' : 'start';

  // Visual block height: N-1 inter-baseline gaps plus one glyph height. Using N*lh
  // would add an extra line-height of leading at the bottom, so middle/bottom would
  // sit too high when lineHeight > 1.
  const blockH = (lines.length - 1) * lh + fontMm;
  let firstBaseline: number;
  if (el.valign === 'middle') firstBaseline = el.y + (el.h - blockH) / 2 + ascent;
  else if (el.valign === 'bottom') firstBaseline = el.y + (el.h - blockH) + ascent;
  else firstBaseline = el.y + ascent;

  const attrs = [
    `font-family="${esc(el.fontFamily)}"`,
    `font-size="${num(fontMm)}"`,
    `font-weight="${el.fontWeight}"`,
    el.italic ? `font-style="italic"` : '',
    `fill="${esc(el.color ?? '#000000')}"`,
    `text-anchor="${textAnchor}"`,
    el.letterSpacing ? `letter-spacing="${num(el.letterSpacing)}"` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const tspans = lines
    .map((line, i) => {
      const content = opts.designMode ? designLineContent(line, opts, doc) : esc(line);
      return `<tspan x="${num(anchorX)}" y="${num(firstBaseline + i * lh)}">${content}</tspan>`;
    })
    .join('');

  return `<text ${attrs}>${tspans}</text>`;
}

function renderLine(el: LineElement): string {
  const dash = el.dash && el.dash.length ? ` stroke-dasharray="${el.dash.map(num).join(',')}"` : '';
  return (
    `<line x1="${num(el.x)}" y1="${num(el.y)}" x2="${num(el.x2)}" y2="${num(el.y2)}" ` +
    `stroke="${esc(el.color ?? '#000000')}" stroke-width="${num(el.strokeMm)}" stroke-linecap="butt"${dash}/>`
  );
}

function renderBox(el: BoxElement): string {
  const rx = el.radiusMm ? ` rx="${num(el.radiusMm)}"` : '';
  const fill = el.fill && el.fill !== 'none' ? esc(el.fill) : 'none';
  return (
    `<rect x="${num(el.x)}" y="${num(el.y)}" width="${num(el.w)}" height="${num(el.h)}"${rx} ` +
    `fill="${fill}" stroke="${esc(el.color ?? '#000000')}" stroke-width="${num(el.strokeMm)}"/>`
  );
}

function renderAsset(
  el: Extract<LabelElement, { type: 'barcode' | 'qrcode' | 'image' }>,
  opts: CompileOptions,
): string {
  const w = el.type === 'qrcode' ? el.size : el.w;
  const h = el.type === 'qrcode' ? el.size : el.h;
  const href = opts.assets?.[el.id];
  if (href) {
    return `<image x="${num(el.x)}" y="${num(el.y)}" width="${num(w)}" height="${num(h)}" ` +
      `href="${esc(href)}" preserveAspectRatio="${el.type === 'image' && (el as { fit?: string }).fit === 'cover' ? 'xMidYMid slice' : 'none'}"/>`;
  }
  if (opts.placeholders || opts.designMode) {
    const label = el.type === 'qrcode' ? 'QR' : el.type === 'barcode' ? 'BARCODE' : 'IMG';
    return (
      `<rect x="${num(el.x)}" y="${num(el.y)}" width="${num(w)}" height="${num(h)}" fill="#f0f0f0" stroke="#bbbbbb" stroke-width="0.2" stroke-dasharray="0.6,0.4"/>` +
      `<text x="${num(el.x + w / 2)}" y="${num(el.y + h / 2)}" font-size="${num(Math.min(w, h) * 0.18)}" fill="#999999" text-anchor="middle" dominant-baseline="central">${label}</text>`
    );
  }
  return '';
}

function renderElement(el: LabelElement, opts: CompileOptions, doc: TemplateDoc): string {
  let body: string;
  switch (el.type) {
    case 'text':
      body = renderText(el, doc, opts);
      break;
    case 'line':
      body = renderLine(el);
      break;
    case 'box':
      body = renderBox(el);
      break;
    case 'barcode':
    case 'qrcode':
    case 'image':
      body = renderAsset(el, opts);
      break;
  }
  return withRotation(el, body);
}

/** Compile a template + values into an mm-based SVG string. */
export function compileToSvg(doc: TemplateDoc, opts: CompileOptions = {}): string {
  const wMm = doc.media.widthMm;
  const hMm = doc.media.heightMm;
  const bg = doc.background ?? '#ffffff';
  const body = doc.elements.map((el) => renderElement(el, opts, doc)).join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${num(wMm)}" height="${num(hMm)}" ` +
    `viewBox="0 0 ${num(wMm)} ${num(hMm)}">` +
    `<rect x="0" y="0" width="${num(wMm)}" height="${num(hMm)}" fill="${esc(bg)}"/>` +
    body +
    `</svg>`
  );
}
