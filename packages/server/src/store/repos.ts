import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { PrinterConfig, PrintRecord, TemplateDoc } from '@labelprint/shared';
import { JsonStore } from './jsonStore.js';
import { JsonlStore } from './jsonlStore.js';
import { DirStore, type Store } from './dirStore.js';
import { config } from '../config.js';
import { seedPrinters, seedTemplates } from './seed.js';

export interface Repos {
  // Templates: one file per template (data/templates/<id>.json) — a bad write or a
  // corrupt file affects only that template, not the whole library.
  templates: Store<TemplateDoc>;
  printers: Store<PrinterConfig>;
  history: JsonlStore<PrintRecord>;
}

export const repos: Repos = {
  templates: new DirStore<TemplateDoc>(path.join(config.dataDir, 'templates')),
  printers: new JsonStore<PrinterConfig>(path.join(config.dataDir, 'printers.json')),
  history: new JsonlStore<PrintRecord>(
    path.join(config.dataDir, 'history.jsonl'),
    path.join(config.dataDir, 'history.json'),
  ),
};

export function addHistory(rec: PrintRecord): Promise<void> {
  return repos.history.add(rec);
}

/** Import templates from the legacy single-file store into the per-file store, once. */
async function migrateTemplates(): Promise<void> {
  if ((await repos.templates.all()).length > 0) return;
  const legacy = path.join(config.dataDir, 'templates.json');
  try {
    const arr = JSON.parse(await fs.readFile(legacy, 'utf8')) as TemplateDoc[];
    if (Array.isArray(arr) && arr.length) {
      for (const t of arr) if (t?.id) await repos.templates.put(t);
      await fs.rename(legacy, `${legacy}.migrated`).catch(() => undefined);
    }
  } catch {
    // no legacy file — nothing to migrate
  }
}

export async function seedAll(): Promise<void> {
  await migrateTemplates();
  await repos.templates.seedIfEmpty(seedTemplates());
  await repos.printers.seedIfEmpty(seedPrinters());
}
