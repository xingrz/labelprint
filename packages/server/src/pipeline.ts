import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { MediaProfile, PrintProtocol, PrintRequest, TemplateDoc } from '@labelprint/shared';
import { renderTemplate } from './render/raster.js';
import { adapterForPrinter } from './protocol/index.js';
import { createTransport } from './transport/index.js';
import { config } from './config.js';
import type { Repos } from './store/repos.js';

export interface PrintOutcome {
  ok: boolean;
  detail: string;
  printer: string;
  protocol: PrintProtocol;
  transport: string;
  artifacts: string[];
  job: { bytes: number; widthDots: number; heightDots: number };
  /** base64 PNG of the rendered label (for UI confirmation). */
  previewPng: string;
}

const DEFAULT_PROFILE: MediaProfile = {
  id: '_default',
  name: 'default',
  widthMm: 40,
  type: 'gap',
  heightMm: 30,
  gapMm: 2,
  dpi: 203,
  density: 10,
  speed: 4,
  direction: 1,
};

/**
 * Merge a stored media profile (density/speed/direction/dpi) with the template's own
 * geometry (the design width/height/type wins, since that is what was laid out).
 */
export function effectiveMedia(doc: TemplateDoc, profile?: MediaProfile): MediaProfile {
  const base = profile ?? DEFAULT_PROFILE;
  return {
    ...base,
    widthMm: doc.media.widthMm,
    heightMm: doc.media.heightMm,
    type: doc.media.type,
    gapMm: doc.media.gapMm ?? base.gapMm ?? 2,
  };
}

export async function renderPreviewPng(
  doc: TemplateDoc,
  values: Record<string, string> | undefined,
  dpi = 203,
): Promise<{ png: Buffer; width: number; height: number }> {
  const r = await renderTemplate(doc, values, dpi);
  return { png: r.png, width: r.width, height: r.height };
}

async function resolvePrinter(repos: Repos, printerId?: string) {
  if (printerId) {
    const p = await repos.printers.get(printerId);
    if (p) return p;
  }
  const all = await repos.printers.all();
  return (
    all[0] ?? {
      id: 'p_virtual',
      name: 'Virtual printer',
      transport: 'file' as const,
      protocol: 'tspl-bitmap' as const,
    }
  );
}

export async function runPrint(req: PrintRequest, repos: Repos): Promise<PrintOutcome> {
  const doc = await repos.templates.get(req.templateId);
  if (!doc) throw new Error(`Template not found: ${req.templateId}`);

  const printer = await resolvePrinter(repos, req.printerId);
  const profile = req.mediaId
    ? await repos.media.get(req.mediaId)
    : printer.defaultMediaId
      ? await repos.media.get(printer.defaultMediaId)
      : undefined;
  const em = effectiveMedia(doc, profile);
  const dpi = em.dpi || 203;

  const r = await renderTemplate(doc, req.values, dpi);
  const adapter = adapterForPrinter(printer);
  const job = adapter.build({
    pixels: r.pixels,
    width: r.width,
    height: r.height,
    media: em,
    widthMm: em.widthMm,
    heightMm: em.heightMm ?? doc.media.heightMm,
    copies: req.copies ?? 1,
  });

  const jobName = `${doc.id}-${stamp()}`;
  const transport = createTransport(printer, config.outDir);
  const result = await transport.send(job.data, jobName, job.extension);

  const artifacts = result.artifacts ? [...result.artifacts] : [];
  // For the virtual/file printer, also drop a PNG next to the protocol output.
  if (transport.kind === 'file') {
    await fs.mkdir(config.outDir, { recursive: true });
    const pngPath = path.join(config.outDir, `${jobName}.png`);
    await fs.writeFile(pngPath, r.png);
    artifacts.push(pngPath);
  }

  return {
    ok: result.ok,
    detail: result.detail,
    printer: printer.name,
    protocol: adapter.id,
    transport: transport.kind,
    artifacts,
    job: { bytes: job.data.length, widthDots: r.width, heightDots: r.height },
    previewPng: r.png.toString('base64'),
  };
}

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
}
