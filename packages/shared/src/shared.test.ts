import { describe, expect, it } from 'vitest';
import { dotsPerMm, mmToDot, ptToMm, widthInDots } from './units.js';
import { applyParams, collectParams, extractKeys } from './params.js';
import { compileToSvg } from './compiler.js';
import type { TemplateDoc } from './types.js';

describe('units', () => {
  it('203dpi => exactly 8 dots/mm (integer-dpmm thermal convention)', () => {
    expect(dotsPerMm(203)).toBe(8);
    expect(dotsPerMm(300)).toBe(12);
  });
  it('80mm @203dpi => 640 dots', () => {
    expect(widthInDots(80, 203)).toBe(640);
  });
  it('mmToDot scales linearly', () => {
    expect(mmToDot(10, 203)).toBe(80);
  });
  it('pt -> mm', () => {
    expect(ptToMm(72)).toBeCloseTo(25.4, 5);
  });
});

const doc: TemplateDoc = {
  id: 't1',
  name: 'demo',
  version: 1,
  media: { widthMm: 40, heightMm: 30, type: 'gap', gapMm: 2 },
  background: '#ffffff',
  params: [{ key: 'name', default: '默认名' }],
  defaults: { qty: '1' },
  elements: [
    {
      id: 'tx1',
      type: 'text',
      x: 2,
      y: 2,
      w: 36,
      h: 8,
      text: '品名：{{name}}',
      fontFamily: 'Noto Sans SC',
      fontSizePt: 9,
      fontWeight: 'normal',
      align: 'left',
      valign: 'top',
    },
    {
      id: 'tx2',
      type: 'text',
      x: 2,
      y: 12,
      w: 36,
      h: 8,
      text: '数量：{{qty}}  批次：{{batch}}',
      fontFamily: 'Noto Sans SC',
      fontSizePt: 8,
      fontWeight: 'normal',
      align: 'left',
      valign: 'top',
    },
    { id: 'ln1', type: 'line', x: 2, y: 10, x2: 38, y2: 10, strokeMm: 0.3 },
  ],
};

describe('params', () => {
  it('extractKeys finds unique keys', () => {
    expect(extractKeys('a{{x}}b{{y}}c{{x}}')).toEqual(['x', 'y']);
  });
  it('supports Chinese placeholder keys', () => {
    expect(extractKeys('品名：{{品名}} 批次{{批次号}}')).toEqual(['品名', '批次号']);
    expect(applyParams('品名：{{品名}}', { 品名: '牛奶' }, doc)).toBe('品名：牛奶');
  });
  it('onEmpty:token keeps unfilled placeholders visible (design mode)', () => {
    expect(applyParams('批次：{{batch}}', undefined, doc, { onEmpty: 'token' })).toBe('批次：{{batch}}');
    // a resolved value still substitutes
    expect(applyParams('数量：{{qty}}', undefined, doc, { onEmpty: 'token' })).toBe('数量：1');
  });
  it('collectParams gathers all placeholders across elements', () => {
    expect(collectParams(doc).sort()).toEqual(['batch', 'name', 'qty']);
  });
  it('applyParams resolves explicit > template default > param default', () => {
    expect(applyParams('品名：{{name}}', { name: '牛奶' }, doc)).toBe('品名：牛奶');
    expect(applyParams('品名：{{name}}', undefined, doc)).toBe('品名：默认名'); // param default
    expect(applyParams('数量：{{qty}}', undefined, doc)).toBe('数量：1'); // template default
    expect(applyParams('批次：{{batch}}', undefined, doc)).toBe('批次：'); // unknown -> empty
  });
});

describe('compiler', () => {
  it('emits mm-based svg with correct viewBox', () => {
    const svg = compileToSvg(doc);
    expect(svg).toContain('viewBox="0 0 40 30"');
    expect(svg).toContain('width="40"');
    expect(svg).toContain('<svg');
  });
  it('substitutes parameter values into text', () => {
    const svg = compileToSvg(doc, { values: { name: '牛奶', batch: 'B7' } });
    expect(svg).toContain('品名：牛奶');
    expect(svg).toContain('批次：B7');
  });
  it('renders a line element', () => {
    const svg = compileToSvg(doc);
    expect(svg).toContain('<line');
    expect(svg).toContain('x2="38"');
  });
  it('renders dashed lines with stroke-dasharray', () => {
    const dashed: TemplateDoc = {
      ...doc,
      elements: [{ id: 'l', type: 'line', x: 0, y: 0, x2: 10, y2: 0, strokeMm: 0.3, dash: [1, 0.6] }],
    };
    expect(compileToSvg(dashed)).toContain('stroke-dasharray="1,0.6"');
  });
  it('design mode keeps unfilled placeholders visible and coloured', () => {
    const svg = compileToSvg(doc, { designMode: true });
    expect(svg).toContain('{{batch}}'); // unfilled token still shown
    expect(svg).toContain('fill="#2563eb"'); // param segments coloured blue
  });
  it('output mode substitutes values and has no design colour', () => {
    const svg = compileToSvg(doc, { values: { name: '牛奶' } });
    expect(svg).toContain('品名：牛奶'); // contiguous substitution
    expect(svg).not.toContain('#2563eb');
  });
  it('middle valign is independent of lineHeight for a single line', () => {
    const mk = (lineHeight: number): TemplateDoc => ({
      ...doc,
      elements: [
        {
          id: 't',
          type: 'text',
          x: 0,
          y: 0,
          w: 20,
          h: 10,
          text: 'A',
          fontFamily: 'x',
          fontSizePt: 10,
          fontWeight: 'normal',
          align: 'left',
          valign: 'middle',
          lineHeight,
        },
      ],
    });
    const yOf = (svg: string) => svg.match(/<tspan x="[^"]*" y="([^"]*)"/)?.[1];
    expect(yOf(compileToSvg(mk(1)))).toBe(yOf(compileToSvg(mk(3))));
  });
  it('escapes XML special chars in values', () => {
    const svg = compileToSvg(doc, { values: { name: 'A&B<C>' } });
    expect(svg).toContain('A&amp;B&lt;C&gt;');
    expect(svg).not.toContain('A&B<C>');
  });
});
