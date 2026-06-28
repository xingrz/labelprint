import { Resvg } from '@resvg/resvg-js';
import { compileToSvg, dotsPerMm, type TemplateDoc } from '@labelprint/shared';
import { buildAssets } from './assets.js';

/**
 * The family used both as resvg's `defaultFontFamily` and as the concrete font that the
 * generic `sans-serif` keyword maps to. This is what makes Chinese render when a
 * template's font-family list falls through to `sans-serif`:
 *   macOS -> PingFang SC (system); Linux/Docker -> Noto Sans CJK SC (fonts-noto-cjk).
 * Override with LABELPRINT_DEFAULT_FONT if your host uses a different CJK family.
 */
const FALLBACK_FAMILY =
  process.env.LABELPRINT_DEFAULT_FONT ??
  (process.platform === 'darwin' ? 'PingFang SC' : 'Noto Sans CJK SC');

/**
 * resvg's `loadSystemFonts` does NOT scan Debian's font dirs (no fontconfig in the
 * slim image), so on Linux we point it at /usr/share/fonts explicitly — otherwise CJK
 * text renders blank. Override via LABELPRINT_FONT_DIRS (colon-separated) if needed.
 */
const FONT_DIRS: string[] = process.env.LABELPRINT_FONT_DIRS
  ? process.env.LABELPRINT_FONT_DIRS.split(':').filter(Boolean)
  : process.platform === 'darwin'
    ? []
    : ['/usr/share/fonts'];

export interface RasterResult {
  /** PNG bytes (for preview + file-transport artifact). */
  png: Buffer;
  /** Raster dimensions in printer dots. */
  width: number;
  height: number;
  /** Raw RGBA pixel buffer (for monochrome packing). */
  pixels: Buffer;
  svg: string;
}

/**
 * Compile the template (with parameter values) to SVG, then rasterise with resvg
 * at the printer's DPI. Width is pinned to the label width in dots so geometry maps
 * 1:1 to the print head; height follows the mm aspect ratio.
 *
 * Fonts: resvg loads system fonts. On macOS that's PingFang/Heiti; in Docker we
 * install fonts-noto-cjk. defaultFontFamily is the fallback when a family is absent.
 */
export async function renderTemplate(
  doc: TemplateDoc,
  values: Record<string, string> | undefined,
  dpi: number,
): Promise<RasterResult> {
  const assets = await buildAssets(doc, values);
  const svg = compileToSvg(doc, { values, assets, placeholders: false });
  const widthDots = Math.max(1, Math.round(doc.media.widthMm * dotsPerMm(dpi)));

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: widthDots },
    background: 'white',
    font: {
      loadSystemFonts: true,
      defaultFontFamily: FALLBACK_FAMILY,
      sansSerifFamily: FALLBACK_FAMILY,
      ...(FONT_DIRS.length ? { fontDirs: FONT_DIRS } : {}),
    },
  });
  const img = resvg.render();
  return {
    png: img.asPng(),
    width: img.width,
    height: img.height,
    pixels: Buffer.from(img.pixels),
    svg,
  };
}
