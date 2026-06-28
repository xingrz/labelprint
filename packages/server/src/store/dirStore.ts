import { promises as fs } from 'node:fs';
import path from 'node:path';

/** Common surface shared by JsonStore (single file) and DirStore (file per item). */
export interface Store<T extends { id: string }> {
  all(): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  put(item: T): Promise<T>;
  delete(id: string): Promise<boolean>;
  seedIfEmpty(items: T[]): Promise<void>;
}

/**
 * One JSON file per item, under `dir/<id>.json`. Robustness over a single big file:
 *  - a bad/partial write only ever touches one item (atomic tmp+rename per file);
 *  - all() skips an individual unreadable/corrupt file instead of failing everything;
 *  - each item is independently inspectable / editable / backup-able / git-able.
 * Used for templates (the user's valuable assets).
 */
export class DirStore<T extends { id: string }> implements Store<T> {
  constructor(private readonly dir: string) {}

  /** Sanitise the id for use as a filename (ids are generated + safe; this is defensive). */
  private fileFor(id: string): string {
    const safe = id.replace(/[^A-Za-z0-9_.-]/g, '_');
    return path.join(this.dir, `${safe}.json`);
  }

  async all(): Promise<T[]> {
    let names: string[];
    try {
      names = await fs.readdir(this.dir);
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') return [];
      throw e;
    }
    const out: T[] = [];
    for (const n of names) {
      if (!n.endsWith('.json')) continue;
      try {
        out.push(JSON.parse(await fs.readFile(path.join(this.dir, n), 'utf8')) as T);
      } catch {
        // Skip a single corrupt file rather than losing the whole collection.
      }
    }
    return out;
  }

  async get(id: string): Promise<T | undefined> {
    try {
      return JSON.parse(await fs.readFile(this.fileFor(id), 'utf8')) as T;
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') return undefined;
      throw e;
    }
  }

  async put(item: T): Promise<T> {
    await fs.mkdir(this.dir, { recursive: true });
    const file = this.fileFor(item.id);
    const tmp = `${file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(item, null, 2), 'utf8');
    await fs.rename(tmp, file);
    return item;
  }

  async delete(id: string): Promise<boolean> {
    try {
      await fs.unlink(this.fileFor(id));
      return true;
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') return false;
      throw e;
    }
  }

  async seedIfEmpty(items: T[]): Promise<void> {
    if ((await this.all()).length === 0) {
      for (const it of items) await this.put(it);
    }
  }
}
