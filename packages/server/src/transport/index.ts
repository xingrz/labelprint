import { promises as fs } from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import type { PrinterConfig } from '@labelprint/shared';

export interface TransportResult {
  ok: boolean;
  detail: string;
  artifacts?: string[];
}

export interface Transport {
  readonly kind: string;
  send(job: Buffer, jobName: string, extension?: string): Promise<TransportResult>;
}

/** Writes the raw job to ./out/<jobName>.<extension> — the offline / virtual printer. */
export class FileTransport implements Transport {
  readonly kind = 'file';
  constructor(private readonly outDir: string) {}
  async send(job: Buffer, jobName: string, extension = 'bin'): Promise<TransportResult> {
    await fs.mkdir(this.outDir, { recursive: true });
    const p = path.join(this.outDir, `${jobName}.${extension}`);
    await fs.writeFile(p, job);
    return { ok: true, detail: `wrote ${p} (${job.length} bytes)`, artifacts: [p] };
  }
}

/** Writes raw bytes to a device path: /dev/usb/lp0 (Linux) or /dev/cu.* (macOS). */
export class DeviceTransport implements Transport {
  readonly kind = 'device';
  constructor(private readonly device: string) {}
  async send(job: Buffer): Promise<TransportResult> {
    const fh = await fs.open(this.device, 'w');
    try {
      await fh.write(job);
    } finally {
      await fh.close();
    }
    return { ok: true, detail: `wrote ${job.length} bytes to ${this.device}` };
  }
}

/** Raw socket (JetDirect 9100) — for the printer over WiFi/Ethernet. */
export class NetworkTransport implements Transport {
  readonly kind = 'network';
  constructor(
    private readonly host: string,
    private readonly port = 9100,
  ) {}
  send(job: Buffer): Promise<TransportResult> {
    return new Promise<TransportResult>((resolve, reject) => {
      const sock = net.connect(this.port, this.host);
      const timer = setTimeout(() => {
        sock.destroy();
        reject(new Error(`connection to ${this.host}:${this.port} timed out`));
      }, 8000);
      sock.on('connect', () => sock.end(job));
      sock.on('error', (e) => {
        clearTimeout(timer);
        reject(e);
      });
      sock.on('close', () => {
        clearTimeout(timer);
        resolve({ ok: true, detail: `sent ${job.length} bytes to ${this.host}:${this.port}` });
      });
    });
  }
}

/** Pipes the job into `lp -d <queue> -o raw` — the proven USB→CUPS path on Linux. */
export class CupsTransport implements Transport {
  readonly kind = 'cups';
  constructor(
    private readonly queue: string,
    private readonly server?: string,
  ) {}
  send(job: Buffer, jobName: string): Promise<TransportResult> {
    return new Promise<TransportResult>((resolve, reject) => {
      const env = { ...process.env };
      if (this.server) env.CUPS_SERVER = this.server;
      const lp = spawn('lp', ['-d', this.queue, '-o', 'raw', '-t', jobName], { env });
      let out = '';
      let err = '';
      lp.stdout.on('data', (d) => (out += d.toString()));
      lp.stderr.on('data', (d) => (err += d.toString()));
      lp.on('error', reject);
      lp.on('close', (code) =>
        code === 0
          ? resolve({ ok: true, detail: `lp: ${out.trim() || 'submitted print job'}` })
          : reject(new Error(err.trim() || `lp exited with code ${code}`)),
      );
      lp.stdin.write(job);
      lp.stdin.end();
    });
  }
}

export function createTransport(cfg: PrinterConfig, defaultOutDir: string): Transport {
  switch (cfg.transport) {
    case 'device':
      if (!cfg.device) throw new Error('device transport requires a device path');
      return new DeviceTransport(cfg.device);
    case 'network':
      if (!cfg.host) throw new Error('network transport requires host');
      return new NetworkTransport(cfg.host, cfg.port ?? 9100);
    case 'cups':
      if (!cfg.cupsQueue) throw new Error('cups transport requires cupsQueue');
      return new CupsTransport(cfg.cupsQueue, cfg.cupsServer);
    case 'file':
    default:
      return new FileTransport(cfg.outDir ?? defaultOutDir);
  }
}
