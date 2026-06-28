import type { MediaProfile, PrintDelivery, PrintJobFormat, PrintRequest, PrintTargetConfig, TemplateDoc } from '@labelprint/shared';
import { renderTemplate } from './render/raster.js';
import { adapterForTarget } from './protocol/index.js';
import { createTransport } from './transport/index.js';
import type { Repos } from './store/repos.js';

export interface PrintOutcome {
  ok: boolean;
  detail: string;
  target: string;
  format: PrintJobFormat;
  delivery: PrintDelivery;
  artifacts: string[];
  job: { bytes: number; widthDots: number; heightDots: number };
  /** base64 PNG of the rendered label (for UI confirmation). */
  previewPng: string;
}

export interface RenderedJobOutcome {
  target: string;
  format: PrintJobFormat;
  delivery: PrintDelivery;
  data: Buffer;
  extension: string;
  job: { bytes: number; widthDots: number; heightDots: number };
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

export function effectiveTargetMedia(doc: TemplateDoc, target?: PrintTargetConfig): MediaProfile {
  return {
    ...DEFAULT_PROFILE,
    id: '_target',
    name: target?.name ?? DEFAULT_PROFILE.name,
    widthMm: doc.media.widthMm,
    heightMm: doc.media.heightMm,
    type: doc.media.type,
    gapMm: doc.media.gapMm ?? DEFAULT_PROFILE.gapMm,
    dpi: target?.dpi ?? DEFAULT_PROFILE.dpi,
    density: target?.density ?? DEFAULT_PROFILE.density,
    speed: target?.speed ?? DEFAULT_PROFILE.speed,
    direction: target?.direction ?? DEFAULT_PROFILE.direction,
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

async function resolveTarget(repos: Repos, targetId?: string) {
  if (targetId) {
    const t = await repos.targets.get(targetId);
    if (t) return t;
  }
  const all = await repos.targets.all();
  return (
    all[0] ?? {
      id: 'target_network',
      name: 'Network socket 9100',
      format: 'tspl-bitmap' as const,
      delivery: 'network' as const,
      host: '127.0.0.1',
      port: 9100,
    }
  );
}

export async function runPrint(req: PrintRequest, repos: Repos): Promise<PrintOutcome> {
  const rendered = await renderJob(req, repos);
  if (rendered.delivery === 'download' || rendered.delivery === 'browser-dialog') {
    throw new Error('This print target is handled by the web browser. Use the web UI to print with it.');
  }
  const target = await resolveTarget(repos, req.targetId);
  const transport = createTransport(target);
  const jobName = `${req.templateId}-${stamp()}`;
  const result = await transport.send(rendered.data, jobName, rendered.extension);
  return {
    ok: result.ok,
    detail: result.detail,
    target: rendered.target,
    format: rendered.format,
    delivery: rendered.delivery,
    artifacts: result.artifacts ? [...result.artifacts] : [],
    job: rendered.job,
    previewPng: rendered.previewPng,
  };
}

export async function renderJob(req: PrintRequest, repos: Repos): Promise<RenderedJobOutcome> {
  const doc = await repos.templates.get(req.templateId);
  if (!doc) throw new Error(`Template not found: ${req.templateId}`);

  const target = await resolveTarget(repos, req.targetId);
  if (target.format !== 'tspl-bitmap') {
    throw new Error(`Raw job rendering requires tspl-bitmap format, got ${target.format}`);
  }
  const em = effectiveTargetMedia(doc, target);
  const dpi = em.dpi || 203;

  const r = await renderTemplate(doc, req.values, dpi);
  const adapter = adapterForTarget(target);
  const job = adapter.build({
    pixels: r.pixels,
    width: r.width,
    height: r.height,
    media: em,
    widthMm: em.widthMm,
    heightMm: em.heightMm ?? doc.media.heightMm,
    copies: req.copies ?? 1,
  });

  return {
    target: target.name,
    format: adapter.id,
    delivery: target.delivery,
    data: job.data,
    extension: job.extension,
    job: { bytes: job.data.length, widthDots: r.width, heightDots: r.height },
    previewPng: r.png.toString('base64'),
  };
}

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
}
