import type { PrintTargetConfig } from '@labelprint/shared';
import { t } from './i18n';

type BluetoothUuid = string | number;

interface RequestDeviceOptionsLike {
  acceptAllDevices?: boolean;
  filters?: Array<{ namePrefix?: string; services?: BluetoothUuid[] }>;
  optionalServices?: BluetoothUuid[];
}

interface BluetoothCharacteristicLike {
  writeValue?: (value: BufferSource) => Promise<void>;
  writeValueWithResponse?: (value: BufferSource) => Promise<void>;
  writeValueWithoutResponse?: (value: BufferSource) => Promise<void>;
}

interface BluetoothServiceLike {
  getCharacteristic(uuid: BluetoothUuid): Promise<BluetoothCharacteristicLike>;
}

interface BluetoothServerLike {
  connect(): Promise<BluetoothServerLike>;
  disconnect?: () => void;
  getPrimaryService(uuid: BluetoothUuid): Promise<BluetoothServiceLike>;
}

interface BluetoothDeviceLike {
  name?: string;
  gatt?: BluetoothServerLike;
}

interface BluetoothNavigatorLike extends Navigator {
  bluetooth?: {
    requestDevice(options: RequestDeviceOptionsLike): Promise<BluetoothDeviceLike>;
  };
}

export interface WebBluetoothSendResult {
  deviceName: string;
  bytes: number;
}

export interface WebBluetoothPrinterConnection {
  deviceName: string;
  write(data: Uint8Array): Promise<WebBluetoothSendResult>;
  close(): void;
}

export async function connectTsplWebBluetooth(target: PrintTargetConfig): Promise<WebBluetoothPrinterConnection> {
  const nav = navigator as BluetoothNavigatorLike;
  if (!nav.bluetooth) throw new Error(t('print.bluetoothUnsupported'));

  const serviceUuid = parseBluetoothUuid(target.bleServiceUuid);
  const characteristicUuid = parseBluetoothUuid(target.bleCharacteristicUuid);
  if (!serviceUuid || !characteristicUuid) throw new Error(t('print.bluetoothConfigMissing'));

  const namePrefix = target.bleNamePrefix?.trim();
  const options: RequestDeviceOptionsLike = namePrefix
    ? { filters: [{ namePrefix }], optionalServices: [serviceUuid] }
    : { acceptAllDevices: true, optionalServices: [serviceUuid] };

  const device = await nav.bluetooth.requestDevice(options);
  if (!device.gatt) throw new Error(t('print.bluetoothGattUnavailable'));

  const server = await device.gatt.connect();
  try {
    const service = await server.getPrimaryService(serviceUuid);
    const characteristic = await service.getCharacteristic(characteristicUuid);
    const deviceName = device.name || t('print.bluetoothDevice');
    return {
      deviceName,
      async write(data: Uint8Array): Promise<WebBluetoothSendResult> {
        const chunkSize = clampInt(target.bleChunkSize, 20, 512, 20);
        const mode = target.bleWriteMode ?? 'without-response';
        await writeChunks(characteristic, data, { chunkSize, mode });
        await sleep(120);
        return { deviceName, bytes: data.byteLength };
      },
      close(): void {
        server.disconnect?.();
      },
    };
  } catch (e) {
    server.disconnect?.();
    throw e;
  }
}

function parseBluetoothUuid(raw: string | undefined): BluetoothUuid | null {
  const value = raw?.trim();
  if (!value) return null;
  const hex = value.replace(/^0x/i, '');
  if (/^[0-9a-f]{4,8}$/i.test(hex)) return Number.parseInt(hex, 16);
  return value;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

async function writeChunks(
  characteristic: BluetoothCharacteristicLike,
  data: Uint8Array,
  opts: { chunkSize: number; mode: 'with-response' | 'without-response' },
): Promise<void> {
  for (let offset = 0; offset < data.byteLength; offset += opts.chunkSize) {
    const chunk = data.subarray(offset, offset + opts.chunkSize);
    await writeChunk(characteristic, chunk, opts.mode);
  }
}

async function writeChunk(
  characteristic: BluetoothCharacteristicLike,
  chunk: Uint8Array,
  mode: 'with-response' | 'without-response',
): Promise<void> {
  const payload = arrayBufferFrom(chunk);
  const methods =
    mode === 'with-response'
      ? ['writeValueWithResponse', 'writeValue', 'writeValueWithoutResponse']
      : ['writeValueWithoutResponse', 'writeValue', 'writeValueWithResponse'];
  let lastError: unknown;
  for (const method of methods) {
    const write = characteristic[method as keyof BluetoothCharacteristicLike];
    if (!write) continue;
    try {
      await write.call(characteristic, payload);
      return;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(t('print.bluetoothWriteUnavailable'));
}

function arrayBufferFrom(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
