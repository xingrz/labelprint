import type { MediaProfile, PrintProtocol, PrintTargetConfig } from '@labelprint/shared';
import { buildTsplJob, packMonochrome } from './tspl.js';

export interface RasterInput {
  pixels: Buffer;
  width: number;
  height: number;
  media: MediaProfile;
  widthMm: number;
  heightMm: number;
  copies: number;
}

export interface ProtocolJob {
  data: Buffer;
  extension: string;
}

export interface ProtocolAdapter {
  id: PrintProtocol;
  name: string;
  build(input: RasterInput): ProtocolJob;
}

const tsplBitmap: ProtocolAdapter = {
  id: 'tspl-bitmap',
  name: 'TSPL bitmap',
  build(input) {
    const mono = packMonochrome(
      input.pixels,
      input.width,
      input.height,
      input.media.monoThreshold ?? 128,
      input.media.offsetXDots ?? 0,
      input.media.offsetYDots ?? 0,
    );
    return {
      data: buildTsplJob(mono, {
        media: input.media,
        widthMm: input.widthMm,
        heightMm: input.heightMm,
        copies: input.copies,
      }),
      extension: 'tspl',
    };
  },
};

const adapters: Record<PrintProtocol, ProtocolAdapter> = {
  'tspl-bitmap': tsplBitmap,
};

export function normalizeProtocol(id: unknown): PrintProtocol {
  if (id === 'tspl') return 'tspl-bitmap';
  if (id === 'tspl-bitmap') return id;
  throw new Error(`Unsupported print protocol: ${String(id)}`);
}

export function protocolAdapter(id: PrintProtocol): ProtocolAdapter {
  const adapter = adapters[id];
  if (!adapter) throw new Error(`Unsupported print protocol: ${id}`);
  return adapter;
}

export function adapterForTarget(target: PrintTargetConfig): ProtocolAdapter {
  return protocolAdapter(normalizeProtocol(target.format));
}
