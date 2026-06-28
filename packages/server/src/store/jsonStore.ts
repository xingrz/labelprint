import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Tiny JSON-file collection store. Zero native deps, Docker-volume friendly,
 * git-inspectable. Writes are serialised and atomic (tmp + rename). Suitable for
 * the small data volumes here, such as templates and print target settings. The
 * repository surface is intentionally swap-compatible with SQLite later.
 */
export class JsonStore<T extends { id: string }> {
  private chain: Promise<unknown> = Promise.resolve();

  constructor(private readonly file: string) {}

  private async readAll(): Promise<T[]> {
    try {
      const raw = await fs.readFile(this.file, 'utf8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') return [];
      throw e;
    }
  }

  private async writeAll(items: T[]): Promise<void> {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(items, null, 2), 'utf8');
    await fs.rename(tmp, this.file);
  }

  /** Serialise mutating operations to avoid read-modify-write races. */
  private run<R>(fn: () => Promise<R>): Promise<R> {
    const next = this.chain.then(fn, fn);
    this.chain = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  all(): Promise<T[]> {
    return this.run(() => this.readAll());
  }

  async get(id: string): Promise<T | undefined> {
    const items = await this.all();
    return items.find((x) => x.id === id);
  }

  put(item: T): Promise<T> {
    return this.run(async () => {
      const items = await this.readAll();
      const idx = items.findIndex((x) => x.id === item.id);
      if (idx >= 0) items[idx] = item;
      else items.push(item);
      await this.writeAll(items);
      return item;
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

  replaceAll(items: T[]): Promise<T[]> {
    return this.run(async () => {
      await this.writeAll(items);
      return items;
    });
  }

  seedIfEmpty(items: T[]): Promise<void> {
    return this.run(async () => {
      const existing = await this.readAll();
      if (existing.length === 0) await this.writeAll(items);
    });
  }

  clear(): Promise<void> {
    return this.run(() => this.writeAll([]));
  }

  /** Insert newest item and keep at most `cap` (drops oldest by insertion order). */
  addCapped(item: T, cap: number): Promise<void> {
    return this.run(async () => {
      const items = await this.readAll();
      items.push(item);
      await this.writeAll(items.length > cap ? items.slice(items.length - cap) : items);
    });
  }
}
