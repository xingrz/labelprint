import type { MediaProfile, PrinterConfig, PrintRecord, PrintRequest, TemplateDoc } from '@labelprint/shared';

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
  printer: string;
  transport: string;
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

  media: () => j<MediaProfile[]>('/api/media'),
  printers: () => j<PrinterConfig[]>('/api/printers'),
  fonts: () => j<{ families: string[] }>('/api/fonts'),

  print: (req: PrintRequest) => j<PrintResult>('/api/print', { method: 'POST', body: JSON.stringify(req) }),

  history: () => j<PrintRecord[]>('/api/history'),
  deleteHistory: (id: string) => j<{ deleted: boolean }>(`/api/history/${id}`, { method: 'DELETE' }),
  clearHistory: () => j<{ ok: boolean }>('/api/history', { method: 'DELETE' }),
};
