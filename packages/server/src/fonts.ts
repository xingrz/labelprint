import { type Dirent, readdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import * as fontkit from 'fontkit';

/**
 * Enumerate the font *families* the print host can actually render with, so the UI can
 * offer a dropdown instead of a free-text family. We scan the same sources resvg uses:
 *   macOS  -> the system font dirs (resvg loadSystemFonts)
 *   Linux  -> /usr/share/fonts (resvg fontDirs; see render/raster.ts)
 * Override with LABELPRINT_FONT_DIRS. Result is cached after first scan.
 */

const EXTS = new Set(['.ttf', '.ttc', '.otf', '.otc']);

function enumDirs(): string[] {
  const env = process.env.LABELPRINT_FONT_DIRS;
  if (env) return env.split(':').filter(Boolean);
  if (process.platform === 'darwin') {
    return [
      '/System/Library/Fonts',
      '/System/Library/Fonts/Supplemental',
      '/Library/Fonts',
      path.join(os.homedir(), 'Library/Fonts'),
    ];
  }
  return ['/usr/share/fonts'];
}

function walk(dir: string, out: string[], depth = 0): void {
  if (depth > 6) return;
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out, depth + 1);
    else if (EXTS.has(path.extname(e.name).toLowerCase())) out.push(p);
  }
}

function collectFamilies(file: string, set: Set<string>): void {
  try {
    const opened = (fontkit as unknown as { openSync(p: string): unknown }).openSync(file) as {
      familyName?: string;
      fonts?: { familyName?: string }[];
    };
    const fonts = opened?.fonts ?? [opened];
    for (const f of fonts) {
      const fam = f?.familyName;
      if (typeof fam === 'string' && fam.trim()) set.add(fam.trim());
    }
  } catch {
    /* skip unreadable / unsupported font files */
  }
}

let cache: string[] | null = null;

export function listFontFamilies(): string[] {
  if (cache) return cache;
  const files: string[] = [];
  for (const d of enumDirs()) walk(d, files);
  const set = new Set<string>();
  for (const f of files) collectFamilies(f, set);
  cache = Array.from(set).sort((a, b) => a.localeCompare(b, 'zh'));
  return cache;
}
