import { applyParams, type TemplateDoc } from '@labelprint/shared';

/**
 * Pre-render barcode/QR/image elements to data URLs that the SVG compiler embeds
 * as <image>. Done here (not in the shared compiler) because barcode generation
 * needs a platform library (bwip-js). Failures are swallowed: a bad/empty barcode
 * value should never block printing of the rest of the label.
 */

type BwipModule = {
  toBuffer: (opts: Record<string, unknown>) => Promise<Buffer> | Buffer;
};

let bwipPromise: Promise<BwipModule | null> | null = null;
async function getBwip(): Promise<BwipModule | null> {
  if (!bwipPromise) {
    bwipPromise = import('bwip-js')
      .then((m) => ((m as { default?: BwipModule }).default ?? (m as unknown as BwipModule)))
      .catch(() => null);
  }
  return bwipPromise;
}

function toBufferAsync(bwip: BwipModule, opts: Record<string, unknown>): Promise<Buffer> {
  const res = bwip.toBuffer(opts);
  return res instanceof Promise ? res : Promise.resolve(res);
}

async function renderBwip(opts: Record<string, unknown>): Promise<string | null> {
  const bwip = await getBwip();
  if (!bwip) return null;
  try {
    const png = await toBufferAsync(bwip, { ...opts, backgroundcolor: 'FFFFFF' });
    return `data:image/png;base64,${png.toString('base64')}`;
  } catch {
    return null;
  }
}

export async function buildAssets(
  doc: TemplateDoc,
  values: Record<string, string> | undefined,
): Promise<Record<string, string>> {
  const assets: Record<string, string> = {};
  for (const el of doc.elements) {
    if (el.type === 'barcode') {
      const v = applyParams(el.value, values, doc).trim();
      if (!v) continue;
      const url = await renderBwip({
        bcid: el.symbology,
        text: v,
        scale: 3,
        height: 12,
        includetext: !!el.showText,
        textxalign: 'center',
      });
      if (url) assets[el.id] = url;
    } else if (el.type === 'qrcode') {
      const v = applyParams(el.value, values, doc).trim();
      if (!v) continue;
      const url = await renderBwip({ bcid: 'qrcode', text: v, scale: 4, eclevel: el.ecc ?? 'M' });
      if (url) assets[el.id] = url;
    } else if (el.type === 'image') {
      const v = applyParams(el.src, values, doc).trim();
      if (v.startsWith('data:')) assets[el.id] = v;
    }
  }
  return assets;
}
