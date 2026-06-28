import type { FastifyInstance } from 'fastify';
import {
  collectParams,
  syncParamDefs,
  type MediaProfile,
  type PrinterConfig,
  type PrintRequest,
  type TemplateDoc,
} from '@labelprint/shared';
import { addHistory, repos } from '../store/repos.js';
import { renderPreviewPng, runPrint } from '../pipeline.js';
import { listFontFamilies } from '../fonts.js';

function nowIso(): string {
  return new Date().toISOString();
}

interface IdParams {
  id: string;
}

export async function registerApi(app: FastifyInstance): Promise<void> {
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
    if (!t) return reply.code(404).send({ error: '模板不存在' });
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
    if (!t) return reply.code(404).send({ error: '模板不存在' });
    return { params: t.params, used: collectParams(t) };
  });

  // ---- media profiles ----
  app.get('/api/media', async () => repos.media.all());
  app.post<{ Body: MediaProfile }>('/api/media', async (req) => {
    const m = { ...req.body, id: req.body.id || `m_${Date.now().toString(36)}` };
    return repos.media.put(m);
  });
  app.put<{ Params: IdParams; Body: MediaProfile }>('/api/media/:id', async (req) =>
    repos.media.put({ ...req.body, id: req.params.id }),
  );
  app.delete<{ Params: IdParams }>('/api/media/:id', async (req) => ({
    deleted: await repos.media.delete(req.params.id),
  }));

  // ---- printers ----
  app.get('/api/printers', async () => repos.printers.all());
  app.post<{ Body: PrinterConfig }>('/api/printers', async (req) => {
    const p = { ...req.body, id: req.body.id || `p_${Date.now().toString(36)}` };
    return repos.printers.put(p);
  });
  app.put<{ Params: IdParams; Body: PrinterConfig }>('/api/printers/:id', async (req) =>
    repos.printers.put({ ...req.body, id: req.params.id }),
  );
  app.delete<{ Params: IdParams }>('/api/printers/:id', async (req) => ({
    deleted: await repos.printers.delete(req.params.id),
  }));

  // ---- preview: high-fidelity server raster (resvg) ----
  app.post<{ Body: { doc?: TemplateDoc; templateId?: string; values?: Record<string, string> } }>(
    '/api/preview',
    async (req, reply) => {
      let doc = req.body.doc;
      if (!doc && req.body.templateId) doc = await repos.templates.get(req.body.templateId);
      if (!doc) return reply.code(400).send({ error: '需要 doc 或 templateId' });
      const { png } = await renderPreviewPng(doc, req.body.values);
      return reply.header('Content-Type', 'image/png').send(png);
    },
  );

  // ---- print ----
  app.post<{ Body: PrintRequest }>('/api/print', async (req, reply) => {
    try {
      const outcome = await runPrint(req.body, repos);
      const tmpl = await repos.templates.get(req.body.templateId);
      await addHistory({
        id: `h_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`,
        ts: nowIso(),
        templateId: req.body.templateId,
        templateName: tmpl?.name ?? req.body.templateId,
        values: req.body.values ?? {},
        copies: req.body.copies ?? 1,
        printer: outcome.printer,
        printerId: req.body.printerId,
        transport: outcome.transport,
        ok: outcome.ok,
        detail: outcome.detail,
        widthDots: outcome.job.widthDots,
        heightDots: outcome.job.heightDots,
      });
      return outcome;
    } catch (e: unknown) {
      return reply.code(400).send({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  });

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
