import { describe, expect, it } from 'vitest';
import type { MediaProfile, TemplateDoc } from '@labelprint/shared';
import { buildPrelude, buildTsplJob, packMonochrome } from './protocol/tspl.js';
import { effectiveMedia } from './pipeline.js';

const media: MediaProfile = {
  id: 'm',
  name: 'm',
  widthMm: 40,
  type: 'gap',
  heightMm: 30,
  gapMm: 2,
  dpi: 203,
  density: 10,
  speed: 4,
  direction: 1,
};

describe('packMonochrome', () => {
  it('packs ink as 0, white as 1, MSB = leftmost pixel', () => {
    // 8x1: x0 black, x1..7 white
    const px = Buffer.alloc(8 * 4, 255);
    px[0] = 0;
    px[1] = 0;
    px[2] = 0;
    px[3] = 255; // x0 opaque black
    const mono = packMonochrome(px, 8, 1);
    expect(mono.bytesPerRow).toBe(1);
    expect(mono.data[0]).toBe(0x7f); // top bit cleared (ink), rest white
  });

  it('keeps padding bits white for non-byte-aligned widths', () => {
    const px = Buffer.alloc(4 * 4, 255); // all white, width 4 -> 1 byte row, 4 padding bits
    const mono = packMonochrome(px, 4, 1);
    expect(mono.data[0]).toBe(0xff);
  });
});

describe('buildPrelude', () => {
  it('emits the validated gap-media prelude with CRLF', () => {
    const p = buildPrelude({ media, widthMm: 40, heightMm: 30, copies: 1 });
    expect(p).toContain('SIZE 40 mm,30 mm\r\n');
    expect(p).toContain('GAP 2 mm,0 mm\r\n');
    expect(p).toContain('DIRECTION 1\r\n');
    expect(p).toContain('SPEED 4\r\n');
    expect(p).toContain('DENSITY 10\r\n');
    expect(p.endsWith('CLS\r\n')).toBe(true);
  });

  it('uses GAP 0 for continuous media', () => {
    const p = buildPrelude({ media: { ...media, type: 'continuous' }, widthMm: 40, heightMm: 50, copies: 1 });
    expect(p).toContain('GAP 0 mm,0 mm\r\n');
  });
});

describe('buildTsplJob', () => {
  it('wraps the bitmap in BITMAP + PRINT', () => {
    const mono = packMonochrome(Buffer.alloc(8 * 1 * 4, 255), 8, 1);
    const job = buildTsplJob(mono, { media, widthMm: 1, heightMm: 1, copies: 2 });
    const s = job.toString('latin1');
    expect(s).toContain('BITMAP 0,0,1,1,0,');
    expect(s.endsWith('PRINT 2\r\n')).toBe(true);
  });
});

describe('effectiveMedia', () => {
  it('lets the template geometry win, inherits print params from the profile', () => {
    const doc = {
      media: { widthMm: 60, heightMm: 35, type: 'continuous' },
    } as TemplateDoc;
    const profile: MediaProfile = { ...media, density: 8, speed: 5, direction: 0 };
    const em = effectiveMedia(doc, profile);
    expect(em.widthMm).toBe(60);
    expect(em.heightMm).toBe(35);
    expect(em.type).toBe('continuous');
    expect(em.density).toBe(8);
    expect(em.speed).toBe(5);
    expect(em.direction).toBe(0);
  });
});
