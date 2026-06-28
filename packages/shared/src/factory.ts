/** Factory helpers for default elements, media and templates (used by designer + seeds). */
import type {
  BarcodeElement,
  BoxElement,
  LabelElement,
  LineElement,
  MediaProfile,
  QrcodeElement,
  TemplateDoc,
  TextElement,
} from './types.js';

let counter = 0;
/** Deterministic-ish id; the designer/server may override. Avoids Math.random for testability. */
export function newId(prefix = 'el'): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}`;
}

// Cross-platform CJK stack: macOS resolves PingFang; Linux (fonts-noto-cjk) resolves
// "Noto Sans CJK SC"; the trailing sans-serif is mapped to a CJK family by the server.
export const DEFAULT_FONT = 'Noto Sans SC, Noto Sans CJK SC, PingFang SC, Microsoft YaHei, sans-serif';

export function defaultText(x = 2, y = 2): TextElement {
  return {
    id: newId('text'),
    type: 'text',
    x,
    y,
    w: 30,
    h: 6,
    text: 'Text',
    fontFamily: DEFAULT_FONT,
    fontSizePt: 9,
    fontWeight: 'normal',
    align: 'left',
    valign: 'top',
    lineHeight: 1.2,
  };
}

export function defaultLine(x = 2, y = 10): LineElement {
  return { id: newId('line'), type: 'line', x, y, x2: x + 30, y2: y, strokeMm: 0.3 };
}

export function defaultBox(x = 2, y = 2): BoxElement {
  return { id: newId('box'), type: 'box', x, y, w: 30, h: 12, strokeMm: 0.3, fill: 'none' };
}

export function defaultBarcode(x = 2, y = 2): BarcodeElement {
  return { id: newId('bc'), type: 'barcode', x, y, w: 40, h: 12, symbology: 'code128', value: '{{barcode}}', showText: true };
}

export function defaultQrcode(x = 2, y = 2): QrcodeElement {
  return { id: newId('qr'), type: 'qrcode', x, y, size: 14, value: '{{qr}}', ecc: 'M' };
}

export function makeElement(type: LabelElement['type']): LabelElement {
  switch (type) {
    case 'text':
      return defaultText();
    case 'line':
      return defaultLine();
    case 'box':
      return defaultBox();
    case 'barcode':
      return defaultBarcode();
    case 'qrcode':
      return defaultQrcode();
    case 'image':
      return { id: newId('img'), type: 'image', x: 2, y: 2, w: 14, h: 14, src: '{{image}}', fit: 'contain' };
  }
}

export function defaultMediaProfiles(): MediaProfile[] {
  return [
    {
      id: 'm_40x30_gap',
      name: '40×30 mm gap label',
      widthMm: 40,
      heightMm: 30,
      type: 'gap',
      gapMm: 2,
      dpi: 203,
      density: 10,
      speed: 4,
      direction: 1,
    },
    {
      id: 'm_80x40_gap',
      name: '80×40 mm gap label',
      widthMm: 80,
      heightMm: 40,
      type: 'gap',
      gapMm: 2,
      dpi: 203,
      density: 10,
      speed: 4,
      direction: 1,
    },
    {
      id: 'm_80_cont',
      name: '80 mm continuous paper',
      widthMm: 80,
      heightMm: 40,
      type: 'continuous',
      dpi: 203,
      density: 10,
      speed: 4,
      direction: 1,
    },
  ];
}

export function emptyTemplate(id: string, name: string, media: MediaProfile): TemplateDoc {
  return {
    id,
    name,
    version: 1,
    media: {
      widthMm: media.widthMm,
      heightMm: media.heightMm ?? 40,
      type: media.type,
      gapMm: media.gapMm,
    },
    background: '#ffffff',
    elements: [],
    params: [],
    defaults: {},
  };
}
