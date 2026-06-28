<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Plus, Trash2, X } from 'lucide-vue-next';
import type { PrinterConfig, TransportKind } from '@labelprint/shared';
import { confirmDialog } from '../lib/confirm';
import { t } from '../lib/i18n';
import { removePrinter, savePrinter, state } from '../lib/store';

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const selectedId = ref('');
const draft = ref<PrinterConfig>(blankPrinter());
const busy = ref(false);
const message = ref('');

const selectedPrinter = computed(() => state.printers.find((p) => p.id === selectedId.value) ?? null);
const draftIsClientTarget = computed(() => isClientTransport(draft.value.transport));

function blankPrinter(): PrinterConfig {
  return {
    id: '',
    name: '',
    transport: 'file',
    protocol: 'tspl-bitmap',
    dpi: 203,
    density: 10,
    speed: 4,
    direction: 1,
  };
}

function clonePrinter(p: PrinterConfig): PrinterConfig {
  return JSON.parse(JSON.stringify(p)) as PrinterConfig;
}

function selectPrinter(id: string): void {
  selectedId.value = id;
  const found = state.printers.find((p) => p.id === id);
  draft.value = found ? clonePrinter(found) : blankPrinter();
  message.value = '';
}

function newPrinter(): void {
  selectedId.value = '';
  draft.value = blankPrinter();
  message.value = '';
}

function normalizePrinter(): PrinterConfig {
  const p = draft.value;
  if (isClientTransport(p.transport)) {
    return {
      ...p,
      name: p.name.trim() || t('printers.untitled'),
      protocol: 'tspl-bitmap',
      transport: p.transport,
      dpi: Number(p.dpi) || 203,
    };
  }
  return {
    ...p,
    name: p.name.trim() || t('printers.untitled'),
    protocol: 'tspl-bitmap',
    transport: p.transport,
    dpi: Number(p.dpi) || 203,
    density: clamp(Number(p.density), 0, 15, 10),
    speed: clamp(Number(p.speed), 1, 8, 4),
    direction: p.direction === 0 ? 0 : 1,
    port: p.transport === 'network' ? Number(p.port) || 9100 : p.port,
  };
}

function clamp(v: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.round(v)));
}

function transportLabel(kind: TransportKind): string {
  if (kind === 'pdf-download') return t('transport.pdfDownload');
  if (kind === 'browser-print') return t('transport.browserPrint');
  if (kind === 'device') return t('transport.device');
  if (kind === 'cups') return t('transport.cups');
  if (kind === 'network') return t('transport.network');
  return t('transport.file');
}

function isClientTransport(kind: TransportKind): boolean {
  return kind === 'pdf-download' || kind === 'browser-print';
}

async function onSave(): Promise<void> {
  busy.value = true;
  message.value = '';
  try {
    const saved = await savePrinter(normalizePrinter());
    selectPrinter(saved.id);
    message.value = t('printers.saved');
  } catch (e) {
    message.value = t('printers.saveFailed', { message: (e as Error).message });
  } finally {
    busy.value = false;
  }
}

async function onDelete(): Promise<void> {
  if (!selectedPrinter.value) return;
  const ok = await confirmDialog({
    title: t('printers.deleteTitle', { name: selectedPrinter.value.name }),
    message: t('templates.deleteMessage'),
    confirmText: t('common.delete'),
    danger: true,
  });
  if (!ok) return;
  busy.value = true;
  try {
    await removePrinter(selectedPrinter.value.id);
    newPrinter();
  } finally {
    busy.value = false;
  }
}

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    selectPrinter(state.printPrinterId || state.printers[0]?.id || '');
  },
  { immediate: true },
);
</script>

<template>
  <div v-if="open" class="overlay" @pointerdown.self="emit('close')">
    <section class="dialog" role="dialog" aria-modal="true" :aria-label="t('printers.title')">
      <header class="head">
        <div>
          <h2>{{ t('printers.title') }}</h2>
          <p class="muted">{{ t('printers.description') }}</p>
        </div>
        <button class="ghost icon" type="button" :aria-label="t('confirm.cancel')" @click="emit('close')">
          <X :size="17" />
        </button>
      </header>

      <div class="body">
        <aside class="list">
          <button class="new" type="button" @click="newPrinter"><Plus :size="14" /> {{ t('printers.new') }}</button>
          <button
            v-for="p in state.printers"
            :key="p.id"
            type="button"
            class="printer-row"
            :class="{ active: selectedId === p.id }"
            @click="selectPrinter(p.id)"
          >
            <span>{{ p.name }}</span>
            <small>{{ transportLabel(p.transport) }}</small>
          </button>
        </aside>

        <form class="editor" @submit.prevent="onSave">
          <div class="grid2">
            <label>{{ t('printers.name') }}
              <input v-model="draft.name" :placeholder="t('printers.untitled')" />
            </label>
            <label v-if="!draftIsClientTarget">{{ t('printers.protocol') }}
              <select v-model="draft.protocol" disabled>
                <option value="tspl-bitmap">TSPL bitmap</option>
              </select>
            </label>
            <label>{{ t('printers.transport') }}
              <select v-model="draft.transport">
                <option value="pdf-download">{{ t('transport.pdfDownload') }}</option>
                <option value="browser-print">{{ t('transport.browserPrint') }}</option>
                <option value="file">{{ t('transport.file') }}</option>
                <option value="cups">{{ t('transport.cups') }}</option>
                <option value="device">{{ t('transport.device') }}</option>
                <option value="network">{{ t('transport.network') }}</option>
              </select>
            </label>
            <label v-if="!draftIsClientTarget">{{ t('printers.dpi') }}
              <input type="number" min="72" step="1" v-model.number="draft.dpi" />
            </label>
          </div>

          <p v-if="draftIsClientTarget" class="client-note">{{ t('printers.clientTargetNote') }}</p>

          <div v-if="!draftIsClientTarget" class="grid3">
            <label>{{ t('printers.density') }}
              <input type="number" min="0" max="15" step="1" v-model.number="draft.density" />
            </label>
            <label>{{ t('printers.speed') }}
              <input type="number" min="1" max="8" step="1" v-model.number="draft.speed" />
            </label>
            <label>{{ t('printers.direction') }}
              <select v-model.number="draft.direction">
                <option :value="1">1</option>
                <option :value="0">0</option>
              </select>
            </label>
          </div>

          <div v-if="!draftIsClientTarget" class="transport-fields">
            <label v-if="draft.transport === 'file'">{{ t('printers.outDir') }}
              <input v-model="draft.outDir" placeholder="./out" />
            </label>
            <label v-if="draft.transport === 'device'">{{ t('printers.device') }}
              <input v-model="draft.device" placeholder="/dev/usb/lp0" />
            </label>
            <template v-if="draft.transport === 'cups'">
              <label>{{ t('printers.cupsQueue') }}
                <input v-model="draft.cupsQueue" placeholder="tspl_raw" />
              </label>
              <label>{{ t('printers.cupsServer') }}
                <input v-model="draft.cupsServer" placeholder="host:631" />
              </label>
            </template>
            <template v-if="draft.transport === 'network'">
              <label>{{ t('printers.host') }}
                <input v-model="draft.host" placeholder="192.168.1.50" />
              </label>
              <label>{{ t('printers.port') }}
                <input type="number" min="1" max="65535" v-model.number="draft.port" placeholder="9100" />
              </label>
            </template>
          </div>

          <p v-if="message" class="msg mono">{{ message }}</p>

          <footer class="actions">
            <button type="button" class="danger" :disabled="busy || !selectedPrinter" @click="onDelete">
              <Trash2 :size="14" /> {{ t('common.delete') }}
            </button>
            <div class="spacer"></div>
            <button type="button" @click="emit('close')">{{ t('confirm.cancel') }}</button>
            <button type="submit" class="primary" :disabled="busy">{{ t('printers.save') }}</button>
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
.printer-row {
  justify-content: flex-start;
}
.printer-row {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  min-height: 48px;
  text-align: left;
  background: transparent;
}
.printer-row.active {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent);
}
.printer-row small {
  color: var(--muted);
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
.transport-fields {
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
  .transport-fields {
    grid-template-columns: 1fr;
  }
}
</style>
