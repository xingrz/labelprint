<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { GripVertical, Plus, Trash2, X } from 'lucide-vue-next';
import type { PrintDelivery, PrintJobFormat, PrintTargetConfig } from '@labelprint/shared';
import { confirmDialog } from '../lib/confirm';
import { t } from '../lib/i18n';
import { removeTarget, saveTarget, saveTargetOrder, state } from '../lib/store';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const selectedId = ref('');
const draft = ref<PrintTargetConfig>(blankTarget());
const busy = ref(false);
const message = ref('');
const draggingId = ref('');
const dragOverId = ref('');
const dragSnapshot = ref<PrintTargetConfig[]>([]);

type TargetPreset =
  | 'pdf-download'
  | 'browser-print'
  | 'tspl-download'
  | 'web-bluetooth'
  | 'web-usb'
  | 'cups'
  | 'usb'
  | 'network';

const selectedTarget = computed(() => state.targets.find((p) => p.id === selectedId.value) ?? null);
const usesTsplSettings = computed(() => draft.value.format === 'tspl-bitmap');
const targetPreset = computed<TargetPreset>({
  get: () => presetFor(draft.value),
  set: applyPreset,
});

function blankTarget(): PrintTargetConfig {
  return {
    id: '',
    name: '',
    format: 'pdf',
    delivery: 'download',
  };
}

function cloneTarget(p: PrintTargetConfig): PrintTargetConfig {
  return JSON.parse(JSON.stringify(p)) as PrintTargetConfig;
}
function cloneTargets(targets: PrintTargetConfig[]): PrintTargetConfig[] {
  return JSON.parse(JSON.stringify(targets)) as PrintTargetConfig[];
}

function selectTarget(id: string): void {
  selectedId.value = id;
  const found = state.targets.find((p) => p.id === id);
  draft.value = found ? cloneTarget(found) : blankTarget();
  message.value = '';
}

function newTarget(): void {
  selectedId.value = '';
  draft.value = blankTarget();
  message.value = '';
}

function normalizeTarget(): PrintTargetConfig {
  const p = draft.value;
  const target: PrintTargetConfig = {
    id: p.id,
    name: p.name.trim() || t('targets.untitled'),
    format: p.format,
    delivery: p.delivery,
  };
  if (p.format !== 'tspl-bitmap') return target;
  target.dpi = Number(p.dpi) || 203;
  target.density = clamp(Number(p.density), 0, 15, 10);
  target.speed = clamp(Number(p.speed), 1, 8, p.delivery === 'web-usb' ? 1 : 4);
  target.direction = p.direction === 0 ? 0 : 1;
  target.offsetXDots = clamp(Number(p.offsetXDots), -64, 64, 0);
  target.offsetYDots = clamp(Number(p.offsetYDots), -64, 64, 0);
  target.monoThreshold = clamp(Number(p.monoThreshold), 1, 254, 128);
  if (p.delivery === 'usb') target.device = p.device;
  if (p.delivery === 'cups') {
    target.cupsQueue = p.cupsQueue;
    target.cupsServer = p.cupsServer;
  }
  if (p.delivery === 'network') {
    target.host = p.host;
    target.port = Number(p.port) || 9100;
  }
  if (p.delivery === 'web-bluetooth') {
    target.bleNamePrefix = p.bleNamePrefix?.trim();
    target.bleServiceUuid = p.bleServiceUuid?.trim();
    target.bleCharacteristicUuid = p.bleCharacteristicUuid?.trim();
    target.bleChunkSize = clamp(Number(p.bleChunkSize), 20, 512, 20);
    target.bleChunkDelayMs = clamp(Number(p.bleChunkDelayMs), 0, 1000, 2);
    target.bleWriteMode = p.bleWriteMode === 'with-response' ? 'with-response' : 'without-response';
  }
  if (p.delivery === 'web-usb') {
    target.webUsbVendorId = optionalInt(p.webUsbVendorId, 0, 0xffff);
    target.webUsbProductId = optionalInt(p.webUsbProductId, 0, 0xffff);
    target.webUsbSerialNumber = p.webUsbSerialNumber?.trim() || undefined;
    target.webUsbClassCode = optionalInt(p.webUsbClassCode, 0, 0xff) ?? 0x07;
    target.webUsbInterfaceNumber = optionalInt(p.webUsbInterfaceNumber, 0, 255);
    target.webUsbAlternateSetting = optionalInt(p.webUsbAlternateSetting, 0, 255);
    target.webUsbEndpointNumber = optionalInt(p.webUsbEndpointNumber, 1, 15);
    target.webUsbChunkSize = clamp(Number(p.webUsbChunkSize), 64, 65536, 16384);
  }
  return target;
}

function clamp(v: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.round(v)));
}

function optionalInt(v: unknown, min: number, max: number): number | undefined {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function presetFor(target: Pick<PrintTargetConfig, 'format' | 'delivery'>): TargetPreset {
  if (target.format === 'pdf' && target.delivery === 'download') return 'pdf-download';
  if (target.format === 'browser-print-page') return 'browser-print';
  if (target.format === 'tspl-bitmap' && target.delivery === 'download') return 'tspl-download';
  if (target.format === 'tspl-bitmap' && target.delivery === 'web-bluetooth') return 'web-bluetooth';
  if (target.format === 'tspl-bitmap' && target.delivery === 'web-usb') return 'web-usb';
  if (target.delivery === 'usb') return 'usb';
  if (target.delivery === 'cups') return 'cups';
  return 'network';
}

function applyPreset(preset: TargetPreset): void {
  const current = draft.value;
  const next = { ...current, ...presetFormatDelivery(preset) };
  if (next.format === 'tspl-bitmap') {
    next.dpi ??= 203;
    next.density ??= 10;
    next.speed ??= preset === 'web-usb' ? 1 : 4;
    next.direction ??= preset === 'web-usb' ? 0 : 1;
    next.offsetXDots ??= 0;
    next.offsetYDots ??= 0;
    next.monoThreshold ??= 128;
  }
  if (next.delivery === 'network') next.port ??= 9100;
  if (next.delivery === 'web-bluetooth') {
    next.bleServiceUuid ??= '0xff00';
    next.bleCharacteristicUuid ??= '0xff02';
    next.bleChunkSize ??= 20;
    next.bleChunkDelayMs ??= 2;
    next.bleWriteMode ??= 'without-response';
  }
  if (next.delivery === 'web-usb') {
    next.webUsbClassCode ??= 0x07;
    next.webUsbChunkSize ??= 16384;
  }
  draft.value = next;
}

function presetFormatDelivery(preset: TargetPreset): { format: PrintJobFormat; delivery: PrintDelivery } {
  if (preset === 'pdf-download') return { format: 'pdf', delivery: 'download' };
  if (preset === 'browser-print') return { format: 'browser-print-page', delivery: 'browser-dialog' };
  if (preset === 'tspl-download') return { format: 'tspl-bitmap', delivery: 'download' };
  if (preset === 'web-bluetooth') return { format: 'tspl-bitmap', delivery: 'web-bluetooth' };
  if (preset === 'web-usb') return { format: 'tspl-bitmap', delivery: 'web-usb' };
  if (preset === 'usb') return { format: 'tspl-bitmap', delivery: 'usb' };
  if (preset === 'cups') return { format: 'tspl-bitmap', delivery: 'cups' };
  return { format: 'tspl-bitmap', delivery: 'network' };
}

function targetTypeLabel(target: PrintTargetConfig): string {
  return targetTypeText(presetFor(target));
}

function targetTypeText(preset: TargetPreset): string {
  if (preset === 'pdf-download') return t('targetTypes.pdfDownload');
  if (preset === 'browser-print') return t('targetTypes.browserPrint');
  if (preset === 'tspl-download') return t('targetTypes.tsplDownload');
  if (preset === 'web-bluetooth') return t('targetTypes.webBluetooth');
  if (preset === 'web-usb') return t('targetTypes.webUsb');
  if (preset === 'usb') return t('targetTypes.usb');
  if (preset === 'cups') return t('targetTypes.cups');
  return t('targetTypes.network');
}

async function onSave(): Promise<void> {
  busy.value = true;
  message.value = '';
  try {
    const saved = await saveTarget(normalizeTarget());
    selectTarget(saved.id);
    message.value = t('targets.saved');
  } catch (e) {
    message.value = t('targets.saveFailed', { message: (e as Error).message });
  } finally {
    busy.value = false;
  }
}

async function onDelete(): Promise<void> {
  if (!selectedTarget.value) return;
  const ok = await confirmDialog({
    title: t('targets.deleteTitle', { name: selectedTarget.value.name }),
    message: t('templates.deleteMessage'),
    confirmText: t('common.delete'),
    danger: true,
  });
  if (!ok) return;
  busy.value = true;
  try {
    await removeTarget(selectedTarget.value.id);
    newTarget();
  } finally {
    busy.value = false;
  }
}

function sameOrder(a: PrintTargetConfig[], b: PrintTargetConfig[]): boolean {
  return a.length === b.length && a.every((target, idx) => target.id === b[idx]?.id);
}

function reorderDraggedTarget(overId: string): void {
  const from = state.targets.findIndex((target) => target.id === draggingId.value);
  const to = state.targets.findIndex((target) => target.id === overId);
  if (from < 0 || to < 0 || from === to) return;
  const next = [...state.targets];
  const [target] = next.splice(from, 1);
  if (!target) return;
  next.splice(to, 0, target);
  state.targets = next;
}

function onDragStart(e: DragEvent, id: string): void {
  if (busy.value) return;
  draggingId.value = id;
  dragOverId.value = '';
  dragSnapshot.value = cloneTargets(state.targets);
  e.dataTransfer?.setData('text/plain', id);
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  selectTarget(id);
}

function onDragOver(e: DragEvent, id: string): void {
  if (!draggingId.value || draggingId.value === id) return;
  e.preventDefault();
  dragOverId.value = id;
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
  reorderDraggedTarget(id);
}

async function commitDragOrder(): Promise<void> {
  const snapshot = dragSnapshot.value;
  const selected = draggingId.value;
  draggingId.value = '';
  dragOverId.value = '';
  dragSnapshot.value = [];
  if (!snapshot.length || sameOrder(snapshot, state.targets)) return;
  busy.value = true;
  message.value = '';
  try {
    await saveTargetOrder(state.targets.map((target) => target.id));
    selectedId.value = selected;
    message.value = t('targets.orderSaved');
  } catch (e) {
    state.targets = snapshot;
    message.value = t('targets.orderFailed', { message: (e as Error).message });
  } finally {
    busy.value = false;
  }
}

function onDrop(e: DragEvent): void {
  e.preventDefault();
  void commitDragOrder();
}

function onDragEnd(): void {
  if (!draggingId.value) return;
  state.targets = dragSnapshot.value;
  draggingId.value = '';
  dragOverId.value = '';
  dragSnapshot.value = [];
}

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    selectTarget(state.printTargetId || state.targets[0]?.id || '');
  },
  { immediate: true },
);
</script>

<template>
  <div v-if="open" class="overlay" @pointerdown.self="emit('close')">
    <section class="dialog" role="dialog" aria-modal="true" :aria-label="t('targets.title')">
      <header class="head">
        <div>
          <h2>{{ t('targets.title') }}</h2>
          <p class="muted">{{ t('targets.description') }}</p>
        </div>
        <button class="ghost icon" type="button" :aria-label="t('confirm.cancel')" @click="emit('close')">
          <X :size="17" />
        </button>
      </header>

      <div class="body">
        <aside class="list">
          <button class="new" type="button" @click="newTarget"><Plus :size="14" /> {{ t('targets.new') }}</button>
          <div
            v-for="(p, idx) in state.targets"
            :key="p.id"
            class="target-entry"
            :class="{ dragging: draggingId === p.id, over: dragOverId === p.id }"
            draggable="true"
            @dragstart="onDragStart($event, p.id)"
            @dragover="onDragOver($event, p.id)"
            @drop="onDrop"
            @dragend="onDragEnd"
          >
            <span class="drag-handle" :title="t('targets.dragReorder')" :aria-label="t('targets.dragReorder')">
              <GripVertical :size="15" />
            </span>
            <button
              type="button"
              class="target-row"
              :class="{ active: selectedId === p.id }"
              @click="selectTarget(p.id)"
            >
              <span class="target-name">
                <span class="target-label">{{ p.name }}</span>
                <strong v-if="idx === 0">{{ t('targets.default') }}</strong>
              </span>
              <small>{{ targetTypeLabel(p) }}</small>
            </button>
          </div>
        </aside>

        <form class="editor" @submit.prevent="onSave">
          <div class="grid2">
            <label>{{ t('targets.name') }}
              <input v-model="draft.name" :placeholder="t('targets.untitled')" />
            </label>
            <label>{{ t('targets.type') }}
              <select v-model="targetPreset">
                <option value="pdf-download">{{ t('targetTypes.pdfDownload') }}</option>
                <option value="browser-print">{{ t('targetTypes.browserPrint') }}</option>
                <option value="tspl-download">{{ t('targetTypes.tsplDownload') }}</option>
                <option value="web-bluetooth">{{ t('targetTypes.webBluetooth') }}</option>
                <option value="web-usb">{{ t('targetTypes.webUsb') }}</option>
                <option value="cups">{{ t('targetTypes.cups') }}</option>
                <option value="usb">{{ t('targetTypes.usb') }}</option>
                <option value="network">{{ t('targetTypes.network') }}</option>
              </select>
            </label>
            <label v-if="usesTsplSettings">{{ t('targets.dpi') }}
              <input type="number" min="72" step="1" v-model.number="draft.dpi" />
            </label>
          </div>

          <p v-if="!usesTsplSettings" class="client-note">{{ t('targets.browserTargetNote') }}</p>
          <p v-else-if="draft.delivery === 'download'" class="client-note">{{ t('targets.tsplDownloadNote') }}</p>
          <p v-else-if="draft.delivery === 'web-bluetooth'" class="client-note">{{ t('targets.webBluetoothNote') }}</p>
          <p v-else-if="draft.delivery === 'web-usb'" class="client-note">{{ t('targets.webUsbNote') }}</p>

          <div v-if="usesTsplSettings" class="grid3">
            <label>{{ t('targets.density') }}
              <input type="number" min="0" max="15" step="1" v-model.number="draft.density" />
            </label>
            <label>{{ t('targets.speed') }}
              <input type="number" min="1" max="8" step="1" v-model.number="draft.speed" />
            </label>
            <label>{{ t('targets.direction') }}
              <select v-model.number="draft.direction">
                <option :value="1">1</option>
                <option :value="0">0</option>
              </select>
            </label>
          </div>

          <div v-if="usesTsplSettings" class="grid3">
            <label>{{ t('targets.offsetX') }}
              <input type="number" min="-64" max="64" step="1" v-model.number="draft.offsetXDots" />
            </label>
            <label>{{ t('targets.offsetY') }}
              <input type="number" min="-64" max="64" step="1" v-model.number="draft.offsetYDots" />
            </label>
            <label>{{ t('targets.monoThreshold') }}
              <input type="number" min="1" max="254" step="1" v-model.number="draft.monoThreshold" />
            </label>
          </div>

          <div v-if="usesTsplSettings && draft.delivery !== 'download'" class="target-fields">
            <label v-if="draft.delivery === 'usb'">{{ t('targets.device') }}
              <input v-model="draft.device" placeholder="/dev/usb/lp0" />
            </label>
            <template v-if="draft.delivery === 'cups'">
              <label>{{ t('targets.cupsQueue') }}
                <input v-model="draft.cupsQueue" placeholder="tspl_raw" />
              </label>
              <label>{{ t('targets.cupsServer') }}
                <input v-model="draft.cupsServer" placeholder="host:631" />
              </label>
            </template>
            <template v-if="draft.delivery === 'network'">
              <label>{{ t('targets.host') }}
                <input v-model="draft.host" placeholder="192.168.1.50" />
              </label>
              <label>{{ t('targets.port') }}
                <input type="number" min="1" max="65535" v-model.number="draft.port" placeholder="9100" />
              </label>
            </template>
            <template v-if="draft.delivery === 'web-bluetooth'">
              <label>{{ t('targets.bleNamePrefix') }}
                <input v-model="draft.bleNamePrefix" placeholder="Printer" />
              </label>
              <label>{{ t('targets.bleServiceUuid') }}
                <input v-model="draft.bleServiceUuid" placeholder="0xffe0" />
              </label>
              <label>{{ t('targets.bleCharacteristicUuid') }}
                <input v-model="draft.bleCharacteristicUuid" placeholder="0xffe1" />
              </label>
              <label>{{ t('targets.bleChunkSize') }}
                <input type="number" min="20" max="512" step="1" v-model.number="draft.bleChunkSize" />
              </label>
              <label>{{ t('targets.bleChunkDelayMs') }}
                <input type="number" min="0" max="1000" step="1" v-model.number="draft.bleChunkDelayMs" />
              </label>
              <label>{{ t('targets.bleWriteMode') }}
                <select v-model="draft.bleWriteMode">
                  <option value="without-response">{{ t('targets.bleWithoutResponse') }}</option>
                  <option value="with-response">{{ t('targets.bleWithResponse') }}</option>
                </select>
              </label>
            </template>
            <template v-if="draft.delivery === 'web-usb'">
              <label>{{ t('targets.webUsbClassCode') }}
                <input type="number" min="0" max="255" step="1" v-model.number="draft.webUsbClassCode" placeholder="7" />
              </label>
              <label>{{ t('targets.webUsbVendorId') }}
                <input type="number" min="0" max="65535" step="1" v-model.number="draft.webUsbVendorId" />
              </label>
              <label>{{ t('targets.webUsbProductId') }}
                <input type="number" min="0" max="65535" step="1" v-model.number="draft.webUsbProductId" />
              </label>
              <label>{{ t('targets.webUsbSerialNumber') }}
                <input v-model="draft.webUsbSerialNumber" />
              </label>
              <label>{{ t('targets.webUsbInterfaceNumber') }}
                <input type="number" min="0" max="255" step="1" v-model.number="draft.webUsbInterfaceNumber" />
              </label>
              <label>{{ t('targets.webUsbAlternateSetting') }}
                <input type="number" min="0" max="255" step="1" v-model.number="draft.webUsbAlternateSetting" />
              </label>
              <label>{{ t('targets.webUsbEndpointNumber') }}
                <input type="number" min="1" max="15" step="1" v-model.number="draft.webUsbEndpointNumber" />
              </label>
              <label>{{ t('targets.webUsbChunkSize') }}
                <input type="number" min="64" max="65536" step="64" v-model.number="draft.webUsbChunkSize" />
              </label>
            </template>
          </div>

          <p v-if="message" class="msg mono">{{ message }}</p>

          <footer class="actions">
            <button type="button" class="danger" :disabled="busy || !selectedTarget" @click="onDelete">
              <Trash2 :size="14" /> {{ t('common.delete') }}
            </button>
            <div class="spacer"></div>
            <button type="button" @click="emit('close')">{{ t('confirm.cancel') }}</button>
            <button type="submit" class="primary" :disabled="busy">{{ t('targets.save') }}</button>
          </footer>
        </form>
      </div>
    </section>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: rgba(15, 23, 42, 0.46);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
}
.dialog {
  width: min(900px, 96vw);
  max-height: min(760px, 94vh);
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.34);
  overflow: hidden;
}
.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--border);
}
.head h2 {
  margin: 0;
  font-size: 18px;
}
.head p {
  margin: 4px 0 0;
}
.icon {
  width: 32px;
  height: 32px;
  padding: 0;
  flex: none;
}
.body {
  display: grid;
  grid-template-columns: 230px minmax(0, 1fr);
  min-height: 0;
  overflow: hidden;
}
.list {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 12px;
  border-right: 1px solid var(--border);
  background: var(--panel-subtle);
  overflow: auto;
}
.new,
.target-row {
  justify-content: flex-start;
}
.target-entry {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  gap: 6px;
  align-items: stretch;
}
.target-entry.dragging {
  opacity: 0.54;
}
.target-entry.over .target-row {
  border-color: var(--accent);
}
.drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--muted);
  cursor: grab;
  border-radius: 6px;
}
.drag-handle:active {
  cursor: grabbing;
}
.target-row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  min-height: 48px;
  min-width: 0;
  text-align: left;
  background: transparent;
}
.target-row.active {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent);
}
.target-row small {
  color: var(--muted);
}
.target-label,
.target-row small {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.target-name {
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  min-width: 0;
}
.target-label {
  min-width: 0;
}
.target-name strong {
  flex: none;
  padding: 1px 5px;
  border: 1px solid var(--accent-border);
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 10px;
  font-weight: 650;
}
.editor {
  display: flex;
  flex-direction: column;
  gap: 13px;
  padding: 16px;
  overflow: auto;
}
.grid2,
.grid3 {
  display: grid;
  gap: 10px;
}
.grid2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.grid3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.target-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding-top: 4px;
}
.client-note {
  margin: 0;
  padding: 10px 12px;
  color: var(--muted);
  background: var(--panel-subtle);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-size: 12px;
}
.msg {
  margin: 0;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--panel-subtle);
  font-size: 11px;
}
.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 4px;
}
.spacer {
  flex: 1;
}

@media (max-width: 720px) {
  .overlay {
    align-items: stretch;
    padding: 10px;
  }
  .body {
    grid-template-columns: 1fr;
    overflow: auto;
  }
  .list {
    max-height: 170px;
    border-right: none;
    border-bottom: 1px solid var(--border);
  }
  .grid2,
  .grid3,
  .target-fields {
    grid-template-columns: 1fr;
  }
}
</style>
