import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
/** here == <root>/packages/server/{src|dist}; repo root is three levels up. */
export const REPO_ROOT = path.resolve(here, '../../..');

function envPath(name: string, fallback: string): string {
  const v = process.env[name];
  return v ? path.resolve(v) : fallback;
}

export const config = {
  host: process.env.LABELPRINT_HOST ?? '0.0.0.0',
  port: Number(process.env.LABELPRINT_PORT ?? 5179),
  dataDir: envPath('LABELPRINT_DATA_DIR', path.join(REPO_ROOT, 'data')),
  designerDist: envPath('LABELPRINT_DESIGNER_DIST', path.join(REPO_ROOT, 'packages/designer/dist')),
};

export type AppConfig = typeof config;
