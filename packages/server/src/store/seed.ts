import {
  DEFAULT_FONT,
  type LabelElement,
  type PrinterConfig,
  type TemplateDoc,
  type TextElement,
} from '@labelprint/shared';

function text(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  body: string,
  fontSizePt: number,
  extra: Partial<TextElement> = {},
): TextElement {
  return {
    id,
    type: 'text',
    x,
    y,
    w,
    h,
    text: body,
    fontFamily: DEFAULT_FONT,
    fontSizePt,
    fontWeight: 'normal',
    align: 'left',
    valign: 'top',
    lineHeight: 1.2,
    ...extra,
  };
}

function line(id: string, x: number, y: number, x2: number, y2: number, strokeMm = 0.3): LabelElement {
  return { id, type: 'line', x, y, x2, y2, strokeMm };
}

export function seedBrowserPrinters(): PrinterConfig[] {
  return [
    {
      id: 'p_pdf_download',
      name: 'PDF download',
      transport: 'pdf-download',
      protocol: 'tspl-bitmap',
      dpi: 203,
      density: 10,
      speed: 4,
      direction: 1,
    },
    {
      id: 'p_browser_print',
      name: 'Browser print dialog',
      transport: 'browser-print',
      protocol: 'tspl-bitmap',
      dpi: 203,
      density: 10,
      speed: 4,
      direction: 1,
    },
  ];
}

export function seedPrinters(): PrinterConfig[] {
  return [
    ...seedBrowserPrinters(),
    {
      id: 'p_virtual',
      name: 'Virtual printer (writes to out/)',
      transport: 'file',
      protocol: 'tspl-bitmap',
      dpi: 203,
      density: 10,
      speed: 4,
      direction: 1,
    },
    {
      id: 'p_cups',
      name: 'CUPS raw queue (tspl_raw)',
      transport: 'cups',
      protocol: 'tspl-bitmap',
      cupsQueue: 'tspl_raw',
      dpi: 203,
      density: 10,
      speed: 4,
      direction: 1,
    },
    {
      id: 'p_device',
      name: 'USB raw device (/dev/usb/lp0)',
      transport: 'device',
      protocol: 'tspl-bitmap',
      device: '/dev/usb/lp0',
      dpi: 203,
      density: 10,
      speed: 4,
      direction: 1,
    },
    {
      id: 'p_network',
      name: 'Network socket 9100',
      transport: 'network',
      protocol: 'tspl-bitmap',
      host: '192.168.1.50',
      port: 9100,
      dpi: 203,
      density: 10,
      speed: 4,
      direction: 1,
    },
  ];
}

export function seedTemplates(): TemplateDoc[] {
  const now = '2026-06-27T00:00:00.000Z';

  const supply: TemplateDoc = {
    id: 't_supply_40x30',
    name: 'Inventory label 40×30',
    version: 1,
    media: { widthMm: 40, heightMm: 30, type: 'gap', gapMm: 2 },
    background: '#ffffff',
    elements: [
      text('s_name', 2, 2, 36, 7, '{{name}}', 12, { fontWeight: 'bold' }),
      line('s_div', 2, 10, 38, 10, 0.3),
      text('s_qty', 2, 12, 36, 5, 'Qty: {{qty}}', 9),
      text('s_date', 2, 18, 36, 5, 'Date: {{date}}', 9),
      text('s_loc', 2, 24, 36, 5, 'Location: {{location}}', 8),
    ],
    params: [
      { key: 'name', label: 'Item', default: 'Milk' },
      { key: 'qty', label: 'Quantity', default: '2' },
      { key: 'date', label: 'Date', type: 'date', default: '2026-06-27' },
      { key: 'location', label: 'Location', default: 'A-2' },
    ],
    defaults: { name: 'Milk', qty: '2', date: '2026-06-27', location: 'A-2' },
    createdAt: now,
    updatedAt: now,
  };

  const price: TemplateDoc = {
    id: 't_price_40x30',
    name: 'Price tag 40×30',
    version: 1,
    media: { widthMm: 40, heightMm: 30, type: 'gap', gapMm: 2 },
    background: '#ffffff',
    elements: [
      text('p_name', 2, 2, 36, 6, '{{name}}', 10, { fontWeight: 'bold' }),
      line('p_div', 2, 9, 38, 9, 0.3),
      text('p_price', 2, 10, 36, 13, '¥{{price}}', 22, { fontWeight: 'bold', valign: 'middle' }),
      text('p_unit', 2, 24, 36, 5, '{{unit}}', 8, { align: 'right' }),
    ],
    params: [
      { key: 'name', label: 'Product', default: 'Organic milk 1L' },
      { key: 'price', label: 'Price', type: 'number', default: '12.90' },
      { key: 'unit', label: 'Unit', default: 'per carton' },
    ],
    defaults: { name: 'Organic milk 1L', price: '12.90', unit: 'per carton' },
    createdAt: now,
    updatedAt: now,
  };

  const demo: TemplateDoc = {
    id: 't_demo_80x40',
    name: 'Barcode and QR sample 80×40',
    version: 1,
    media: { widthMm: 80, heightMm: 40, type: 'gap', gapMm: 2 },
    background: '#ffffff',
    elements: [
      text('d_name', 3, 3, 52, 7, '{{name}}', 12, { fontWeight: 'bold' }),
      text('d_sku', 3, 11, 52, 5, 'SKU: {{sku}}', 9),
      { id: 'd_bc', type: 'barcode', x: 3, y: 18, w: 48, h: 14, symbology: 'code128', value: '{{barcode}}', showText: true },
      { id: 'd_qr', type: 'qrcode', x: 58, y: 7, size: 20, value: '{{qr}}', ecc: 'M' },
    ],
    params: [
      { key: 'name', label: 'Item', default: 'Sample product' },
      { key: 'sku', label: 'SKU', default: 'SKU-0001' },
      { key: 'barcode', label: 'Barcode', default: '6901234567890' },
      { key: 'qr', label: 'QR content', default: 'https://example.com/p/0001' },
    ],
    defaults: {
      name: 'Sample product',
      sku: 'SKU-0001',
      barcode: '6901234567890',
      qr: 'https://example.com/p/0001',
    },
    createdAt: now,
    updatedAt: now,
  };

  return [supply, price, demo];
}
