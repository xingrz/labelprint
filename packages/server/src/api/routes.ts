import type { FastifyInstance, FastifyReply } from 'fastify';
import {
  collectParams,
  syncParamDefs,
  type PrintRequest,
  type PrintTargetConfig,
  type TemplateDoc,
} from '@labelprint/shared';
import { addHistory, repos } from '../store/repos.js';
import { renderJob, renderPreviewPng, runPrint } from '../pipeline.js';
import { listFontFamilies } from '../fonts.js';

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeTarget(t: PrintTargetConfig): PrintTargetConfig {
  return {
    ...t,
    dpi: t.dpi ?? 203,
    density: t.density ?? 10,
    speed: t.speed ?? 4,
    direction: t.direction ?? 1,
  };
}

interface IdParams {
  id: string;
}

interface TargetTemplateParams {
  targetId: string;
  templateId: string;
  copies?: string;
}

interface CopiesQuery {
  copies?: string | number;
}

function directValues(body: unknown): Record<string, string> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {};
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    if (value == null) values[key] = '';
    else if (typeof value === 'string') values[key] = value;
    else if (typeof value === 'number' || typeof value === 'boolean') values[key] = String(value);
    else values[key] = JSON.stringify(value);
  }
  return values;
}

function parseCopies(value: unknown): number {
  const n = Number(value ?? 1);
  return Number.isFinite(n) ? Math.max(1, Math.min(999, Math.floor(n))) : 1;
}

function printRequestFromPath(
  params: TargetTemplateParams,
  body: unknown,
  query?: CopiesQuery,
): PrintRequest {
  return {
    targetId: params.targetId,
    templateId: params.templateId,
    values: directValues(body),
    copies: parseCopies(params.copies ?? query?.copies),
  };
}

async function addPrintHistory(req: PrintRequest, outcome: Awaited<ReturnType<typeof runPrint>>): Promise<void> {
  const tmpl = await repos.templates.get(req.templateId);
  await addHistory({
    id: `h_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`,
    ts: nowIso(),
    templateId: req.templateId,
    templateName: tmpl?.name ?? req.templateId,
    values: req.values ?? {},
    copies: req.copies ?? 1,
    target: outcome.target,
    targetId: req.targetId,
    format: outcome.format,
    delivery: outcome.delivery,
    ok: outcome.ok,
    detail: outcome.detail,
    widthDots: outcome.job.widthDots,
    heightDots: outcome.job.heightDots,
  });
}

export async function registerApi(app: FastifyInstance): Promise<void> {
  app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (_req, body, done) => {
    const values: Record<string, string> = {};
    for (const [key, value] of new URLSearchParams(String(body))) values[key] = value;
    done(null, values);
  });

  app.get('/api/health', async () => ({ ok: true, service: 'labelprint', version: '0.1.0' }));

  // Font families the print host can render with (for the designer's font picker).
  app.get('/api/fonts', async () => ({ families: listFontFamilies() }));

  // ---- templates ----
  app.get('/api/templates', async () => {
    const all = await repos.templates.all();
    return all.sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));
  });

  app.get<{ Params: IdParams }>('/api/templates/:id', async (req, reply) => {
    const t = await repos.templates.get(req.params.id);
    if (!t) return reply.code(404).send({ error: 'Template not found' });
    return t;
  });

  app.post<{ Body: TemplateDoc }>('/api/templates', async (req) => {
    const body = req.body;
    const doc: TemplateDoc = {
      ...body,
      id: body.id || `t_${Date.now().toString(36)}`,
      version: 1,
      createdAt: body.createdAt || nowIso(),
      updatedAt: nowIso(),
    };
    doc.params = syncParamDefs(doc);
    return repos.templates.put(doc);
  });

  app.put<{ Params: IdParams; Body: TemplateDoc }>('/api/templates/:id', async (req) => {
    const existing = await repos.templates.get(req.params.id);
    const doc: TemplateDoc = {
      ...req.body,
      id: req.params.id,
      version: 1,
      createdAt: existing?.createdAt || req.body.createdAt || nowIso(),
      updatedAt: nowIso(),
    };
    doc.params = syncParamDefs(doc);
    return repos.templates.put(doc);
  });

  app.delete<{ Params: IdParams }>('/api/templates/:id', async (req) => ({
    deleted: await repos.templates.delete(req.params.id),
  }));

  app.get<{ Params: IdParams }>('/api/templates/:id/params', async (req, reply) => {
    const t = await repos.templates.get(req.params.id);
    if (!t) return reply.code(404).send({ error: 'Template not found' });
    return { params: t.params, used: collectParams(t) };
  });

  // ---- print targets ----
  app.get('/api/targets', async () => (await repos.targets.all()).map(normalizeTarget));
  app.post<{ Body: PrintTargetConfig }>('/api/targets', async (req) => {
    const target = normalizeTarget({ ...req.body, id: req.body.id || `target_${Date.now().toString(36)}` });
    return repos.targets.put(target);
  });
  app.put<{ Body: { ids?: unknown } }>('/api/targets/order', async (req, reply) => {
    const ids = req.body.ids;
    if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string')) {
      return reply.code(400).send({ error: 'ids must be a string array' });
    }
    const existing = await repos.targets.all();
    const byId = new Map(existing.map((target) => [target.id, target]));
    const seen = new Set<string>();
    const ordered: PrintTargetConfig[] = [];
    for (const id of ids) {
      const target = byId.get(id);
      if (!target || seen.has(id)) continue;
      ordered.push(target);
      seen.add(id);
    }
    return repos.targets.replaceAll([...ordered, ...existing.filter((target) => !seen.has(target.id))]);
  });
  app.put<{ Params: IdParams; Body: PrintTargetConfig }>('/api/targets/:id', async (req) =>
    repos.targets.put(normalizeTarget({ ...req.body, id: req.params.id })),
  );
  app.delete<{ Params: IdParams }>('/api/targets/:id', async (req) => ({
    deleted: await repos.targets.delete(req.params.id),
  }));

  // ---- preview: high-fidelity server raster (resvg) ----
  app.post<{ Params: { templateId: string }; Body: unknown }>(
    '/api/templates/:templateId/preview',
    async (req, reply) => {
      const doc = await repos.templates.get(req.params.templateId);
      if (!doc) return reply.code(404).send({ error: 'Template not found' });
      const { png } = await renderPreviewPng(doc, directValues(req.body));
      return reply.header('Content-Type', 'image/png').send(png);
    },
  );

  app.post<{ Params: TargetTemplateParams; Body: unknown }>(
    '/api/targets/:targetId/templates/:templateId/preview',
    async (req, reply) => {
      const doc = await repos.templates.get(req.params.templateId);
      if (!doc) return reply.code(404).send({ error: 'Template not found' });
      const target = await repos.targets.get(req.params.targetId);
      if (!target) return reply.code(404).send({ error: 'Target not found' });
      const { png } = await renderPreviewPng(doc, directValues(req.body), target.dpi ?? 203);
      return reply.header('Content-Type', 'image/png').send(png);
    },
  );

  app.post<{ Params: TargetTemplateParams; Querystring: CopiesQuery; Body: unknown }>(
    '/api/targets/:targetId/templates/:templateId/render-job',
    async (req, reply) => sendRenderedJob(printRequestFromPath(req.params, req.body, req.query), reply),
  );
  app.post<{ Params: TargetTemplateParams; Body: unknown }>(
    '/api/targets/:targetId/templates/:templateId/render-job/:copies',
    async (req, reply) => sendRenderedJob(printRequestFromPath(req.params, req.body), reply),
  );

  // ---- print ----
  app.post<{ Params: TargetTemplateParams; Querystring: CopiesQuery; Body: unknown }>(
    '/api/targets/:targetId/templates/:templateId/print',
    async (req, reply) => sendPrint(printRequestFromPath(req.params, req.body, req.query), reply),
  );
  app.post<{ Params: TargetTemplateParams; Body: unknown }>(
    '/api/targets/:targetId/templates/:templateId/print/:copies',
    async (req, reply) => sendPrint(printRequestFromPath(req.params, req.body), reply),
  );

  // ---- print history ----
  app.get('/api/history', async () => {
    const all = await repos.history.all();
    return all.sort((a, b) => (a.ts < b.ts ? 1 : -1)); // newest first
  });
  app.delete<{ Params: IdParams }>('/api/history/:id', async (req) => ({
    deleted: await repos.history.delete(req.params.id),
  }));
  app.delete('/api/history', async () => {
    await repos.history.clear();
    return { ok: true };
  });
}

async function sendRenderedJob(req: PrintRequest, reply: FastifyReply) {
  try {
    const outcome = await renderJob(req, repos);
    return reply
      .header('Content-Type', 'application/octet-stream')
      .header('Content-Disposition', `attachment; filename="${req.templateId}.${outcome.extension}"`)
      .send(outcome.data);
  } catch (e: unknown) {
    return reply.code(400).send({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}

async function sendPrint(req: PrintRequest, reply: FastifyReply) {
  try {
    const outcome = await runPrint(req, repos);
    await addPrintHistory(req, outcome);
    return outcome;
  } catch (e: unknown) {
    return reply.code(400).send({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}
