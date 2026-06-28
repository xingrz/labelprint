import {
  DEFAULT_FONT,
  defaultMediaProfiles,
  type LabelElement,
  type MediaProfile,
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

export function seedMedia(): MediaProfile[] {
  return defaultMediaProfiles();
}

export function seedPrinters(): PrinterConfig[] {
  return [
    {
      id: 'p_virtual',
      name: '虚拟打印机（输出到 out/）',
      transport: 'file',
      protocol: 'tspl',
      defaultMediaId: 'm_40x30_gap',
    },
    {
      id: 'p_cups',
      name: 'CUPS Raw 队列 (tspl_raw)',
      transport: 'cups',
      protocol: 'tspl',
      cupsQueue: 'tspl_raw',
      defaultMediaId: 'm_40x30_gap',
    },
    {
      id: 'p_device',
      name: 'USB 直写 (/dev/usb/lp0)',
      transport: 'device',
      protocol: 'tspl',
      device: '/dev/usb/lp0',
      defaultMediaId: 'm_40x30_gap',
    },
    {
      id: 'p_network',
      name: '网络 9100（待测）',
      transport: 'network',
      protocol: 'tspl',
      host: '192.168.1.50',
      port: 9100,
      defaultMediaId: 'm_40x30_gap',
    },
  ];
}

export function seedTemplates(): TemplateDoc[] {
  const now = '2026-06-27T00:00:00.000Z';

  const supply: TemplateDoc = {
    id: 't_supply_40x30',
    name: '物资标签 40×30',
    version: 1,
    media: { widthMm: 40, heightMm: 30, type: 'gap', gapMm: 2 },
    background: '#ffffff',
    elements: [
      text('s_name', 2, 2, 36, 7, '{{name}}', 12, { fontWeight: 'bold' }),
      line('s_div', 2, 10, 38, 10, 0.3),
      text('s_qty', 2, 12, 36, 5, '数量：{{qty}}', 9),
      text('s_date', 2, 18, 36, 5, '日期：{{date}}', 9),
      text('s_loc', 2, 24, 36, 5, '位置：{{location}}', 8),
    ],
    params: [
      { key: 'name', label: '品名', default: '牛奶' },
      { key: 'qty', label: '数量', default: '2' },
      { key: 'date', label: '日期', type: 'date', default: '2026-06-27' },
      { key: 'location', label: '位置', default: 'A区-2层' },
    ],
    defaults: { name: '牛奶', qty: '2', date: '2026-06-27', location: 'A区-2层' },
    createdAt: now,
    updatedAt: now,
  };

  const price: TemplateDoc = {
    id: 't_price_40x30',
    name: '价签 40×30',
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
      { key: 'name', label: '商品名', default: '有机牛奶 1L' },
      { key: 'price', label: '价格', type: 'number', default: '12.90' },
      { key: 'unit', label: '单位', default: '元/盒' },
    ],
    defaults: { name: '有机牛奶 1L', price: '12.90', unit: '元/盒' },
    createdAt: now,
    updatedAt: now,
  };

  const demo: TemplateDoc = {
    id: 't_demo_80x40',
    name: '条码二维码示例 80×40',
    version: 1,
    media: { widthMm: 80, heightMm: 40, type: 'gap', gapMm: 2 },
    background: '#ffffff',
    elements: [
      text('d_name', 3, 3, 50, 7, '{{name}}', 12, { fontWeight: 'bold' }),
      text('d_sku', 3, 11, 50, 5, 'SKU：{{sku}}', 9),
      { id: 'd_bc', type: 'barcode', x: 3, y: 18, w: 50, h: 14, symbology: 'code128', value: '{{barcode}}', showText: true },
      { id: 'd_qr', type: 'qrcode', x: 60, y: 6, size: 26, value: '{{qr}}', ecc: 'M' },
    ],
    params: [
      { key: 'name', label: '品名', default: '示例商品' },
      { key: 'sku', label: 'SKU', default: 'SKU-0001' },
      { key: 'barcode', label: '条码', default: '6901234567890' },
      { key: 'qr', label: '二维码内容', default: 'https://example.com/p/0001' },
    ],
    defaults: {
      name: '示例商品',
      sku: 'SKU-0001',
      barcode: '6901234567890',
      qr: 'https://example.com/p/0001',
    },
    createdAt: now,
    updatedAt: now,
  };

  return [supply, price, demo];
}
