import type { PrintDelivery, PrintJobFormat, PrintRecord, PrintTargetConfig, TemplateDoc } from '@labelprint/shared';

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  // Only set the JSON content-type when there's a body. Sending it on an empty-body
  // request (GET/DELETE) makes Fastify reject it with 400 FST_ERR_CTP_EMPTY_JSON_BODY.
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string>) };
  if (init?.body != null) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body || `${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

export interface PrintResult {
  ok: boolean;
  detail: string;
  target: string;
  format: PrintJobFormat;
  delivery: PrintDelivery;
  artifacts: string[];
  job: { bytes: number; widthDots: number; heightDots: number };
  previewPng: string;
}

export const api = {
  templates: () => j<TemplateDoc[]>('/api/templates'),
  template: (id: string) => j<TemplateDoc>(`/api/templates/${id}`),
  /** Upsert by id (server PUT upserts). */
  saveTemplate: (doc: TemplateDoc) =>
    j<TemplateDoc>(`/api/templates/${doc.id}`, { method: 'PUT', body: JSON.stringify(doc) }),
  deleteTemplate: (id: string) => j<{ deleted: boolean }>(`/api/templates/${id}`, { method: 'DELETE' }),

  targets: () => j<PrintTargetConfig[]>('/api/targets'),
  saveTarget: (target: PrintTargetConfig) =>
    j<PrintTargetConfig>(target.id ? `/api/targets/${target.id}` : '/api/targets', {
      method: target.id ? 'PUT' : 'POST',
      body: JSON.stringify(target),
    }),
  reorderTargets: (ids: string[]) =>
    j<PrintTargetConfig[]>('/api/targets/order', { method: 'PUT', body: JSON.stringify({ ids }) }),
  deleteTarget: (id: string) => j<{ deleted: boolean }>(`/api/targets/${id}`, { method: 'DELETE' }),
  fonts: () => j<{ families: string[] }>('/api/fonts'),

  printTarget: (targetId: string, templateId: string, values: Record<string, string>, copies = 1) =>
    j<PrintResult>(`/api/targets/${targetId}/templates/${templateId}/print?copies=${encodeURIComponent(copies)}`, {
      method: 'POST',
      body: JSON.stringify(values),
    }),
  recordClientPrint: (
    targetId: string,
    templateId: string,
    values: Record<string, string>,
    copies = 1,
    opts: { bytes?: number } = {},
  ) => {
    const qs = new URLSearchParams({ copies: String(copies) });
    if (opts.bytes && Number.isFinite(opts.bytes)) qs.set('bytes', String(Math.floor(opts.bytes)));
    return j<PrintRecord>(`/api/targets/${targetId}/templates/${templateId}/history?${qs.toString()}`, {
      method: 'POST',
      body: JSON.stringify(values),
    });
  },

  history: () => j<PrintRecord[]>('/api/history'),
  deleteHistory: (id: string) => j<{ deleted: boolean }>(`/api/history/${id}`, { method: 'DELETE' }),
  clearHistory: () => j<{ ok: boolean }>('/api/history', { method: 'DELETE' }),
};
