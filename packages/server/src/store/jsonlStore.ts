import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Append-oriented JSONL collection store for growing event logs such as print
 * history. Appends are cheap and do not rewrite the whole file for every record.
 */
export class JsonlStore<T extends { id: string }> {
  private chain: Promise<unknown> = Promise.resolve();
  private migrated = false;

  constructor(
    private readonly file: string,
    private readonly legacyJsonFile?: string,
  ) {}

  private async migrateLegacy(): Promise<void> {
    if (this.migrated) return;
    this.migrated = true;
    if (!this.legacyJsonFile) return;
    try {
      await fs.access(this.file);
      return;
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException)?.code !== 'ENOENT') throw e;
    }
    try {
      const raw = await fs.readFile(this.legacyJsonFile, 'utf8');
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      const lines = parsed.map((item) => JSON.stringify(item)).join('\n');
      await fs.writeFile(this.file, lines ? `${lines}\n` : '', 'utf8');
      await fs.rename(this.legacyJsonFile, `${this.legacyJsonFile}.migrated`).catch(() => undefined);
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') return;
      throw e;
    }
  }

  private run<R>(fn: () => Promise<R>): Promise<R> {
    const next = this.chain.then(fn, fn);
    this.chain = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  private async readAll(): Promise<T[]> {
    await this.migrateLegacy();
    try {
      const raw = await fs.readFile(this.file, 'utf8');
      const out: T[] = [];
      for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          out.push(JSON.parse(trimmed) as T);
        } catch {
          // Skip a corrupt line rather than losing the whole log.
        }
      }
      return out;
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') return [];
      throw e;
    }
  }

  private async writeAll(items: T[]): Promise<void> {
    await this.migrateLegacy();
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    const lines = items.map((item) => JSON.stringify(item)).join('\n');
    await fs.writeFile(tmp, lines ? `${lines}\n` : '', 'utf8');
    await fs.rename(tmp, this.file);
  }

  all(): Promise<T[]> {
    return this.run(() => this.readAll());
  }

  async get(id: string): Promise<T | undefined> {
    const items = await this.all();
    return items.find((x) => x.id === id);
  }

  add(item: T): Promise<void> {
    return this.run(async () => {
      await this.migrateLegacy();
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      await fs.appendFile(this.file, `${JSON.stringify(item)}\n`, 'utf8');
    });
  }

  delete(id: string): Promise<boolean> {
    return this.run(async () => {
      const items = await this.readAll();
      const next = items.filter((x) => x.id !== id);
      const changed = next.length !== items.length;
      if (changed) await this.writeAll(next);
      return changed;
    });
  }

  clear(): Promise<void> {
    return this.run(() => this.writeAll([]));
  }
}
