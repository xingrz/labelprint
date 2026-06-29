import type { MediaProfile } from '@labelprint/shared';

/**
 * TSPL job builder. We render the whole label to a 1-bpp bitmap and emit it via the
 * TSPL BITMAP command. This gives true WYSIWYG output and sidesteps firmware-specific
 * text rendering or character encoding issues.
 *
 * Bit polarity: TSPL BITMAP convention is 1 = white (no dot), 0 = black (printed).
 * We pack accordingly. `invert` flips it in case a given firmware expects the opposite
 * — confirm on target hardware during bring-up.
 */

export interface Monochrome {
  width: number;
  height: number;
  bytesPerRow: number;
  data: Buffer;
}

/** Pack an RGBA buffer into a 1-bpp TSPL bitmap (1 = white, 0 = ink). */
export function packMonochrome(
  pixels: Buffer,
  width: number,
  height: number,
  threshold = 128,
  offsetXDots = 0,
  offsetYDots = 0,
): Monochrome {
  const bytesPerRow = Math.ceil(width / 8);
  const data = Buffer.alloc(bytesPerRow * height, 0xff); // default white; padding bits stay white
  for (let y = 0; y < height; y++) {
    const rowBase = y * bytesPerRow;
    const srcY = y - offsetYDots;
    if (srcY < 0 || srcY >= height) continue;
    for (let x = 0; x < width; x++) {
      const srcX = x - offsetXDots;
      if (srcX < 0 || srcX >= width) continue;
      const i = (srcY * width + srcX) * 4;
      const a = pixels[i + 3] ?? 0;
      const r = pixels[i] ?? 0;
      const g = pixels[i + 1] ?? 0;
      const b = pixels[i + 2] ?? 0;
      const lum = r * 0.299 + g * 0.587 + b * 0.114;
      if (a > 128 && lum < threshold) {
        // ink => clear the bit (0)
        const idx = rowBase + (x >> 3);
        data[idx] = data[idx]! & (~(0x80 >> (x & 7)) & 0xff);
      }
    }
  }
  return { width, height, bytesPerRow, data };
}

export interface TsplJobOptions {
  media: MediaProfile;
  /** Actual label size in mm (from the template). */
  widthMm: number;
  heightMm: number;
  copies: number;
  invert?: boolean;
}

const CRLF = '\r\n';

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : (Math.round(n * 100) / 100).toString();
}

/** Build the TSPL prelude lines (ASCII, CRLF-terminated) from a media profile. */
export function buildPrelude(opts: TsplJobOptions): string {
  const { media } = opts;
  const lines: string[] = [];
  lines.push(`SIZE ${fmt(opts.widthMm)} mm,${fmt(opts.heightMm)} mm`);
  if (media.type === 'continuous') lines.push('GAP 0 mm,0 mm');
  else if (media.type === 'blackmark') lines.push(`BLINE ${fmt(media.gapMm ?? 2)} mm,0 mm`);
  else lines.push(`GAP ${fmt(media.gapMm ?? 2)} mm,0 mm`);
  lines.push(`DIRECTION ${media.direction}`);
  lines.push('REFERENCE 0,0');
  lines.push(`SPEED ${media.speed}`);
  lines.push(`DENSITY ${media.density}`);
  lines.push('CLS');
  return lines.join(CRLF) + CRLF;
}

/** Build a complete TSPL print job (prelude + BITMAP + PRINT) as raw bytes. */
export function buildTsplJob(mono: Monochrome, opts: TsplJobOptions): Buffer {
  const header = Buffer.from(buildPrelude(opts), 'ascii');

  let data = mono.data;
  if (opts.invert) {
    data = Buffer.from(mono.data);
    for (let i = 0; i < data.length; i++) data[i] = data[i]! ^ 0xff;
  }

  const bitmapCmd = Buffer.from(`BITMAP 0,0,${mono.bytesPerRow},${mono.height},0,`, 'ascii');
  const tail = Buffer.from(`${CRLF}PRINT ${Math.max(1, opts.copies)}${CRLF}`, 'ascii');
  return Buffer.concat([header, bitmapCmd, data, tail]);
}
