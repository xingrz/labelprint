<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { Eye, Printer as PrinterIcon } from 'lucide-vue-next';
import { t } from '../lib/i18n';
import { printNow, printParams, printTemplate, selectPrintTemplate, state } from '../lib/store';

// Display scale for the preview (px per mm) — large enough to judge layout accurately.
const previewWidthPx = computed(() => (printTemplate.value?.media.widthMm ?? 40) * 12);

const previewUrl = ref('');
const busy = ref(false);
const msg = ref('');
let debounce: ReturnType<typeof setTimeout> | undefined;

function paramLabel(k: string): string {
  const d = printTemplate.value?.params.find((p) => p.key === k);
  return d?.label ? `${d.label} (${k})` : k;
}
function isMultiline(k: string): boolean {
  return !!printTemplate.value?.params.find((p) => p.key === k)?.multiline;
}
function onSelect(e: Event): void {
  selectPrintTemplate((e.target as HTMLSelectElement).value);
}

async function refreshPreview(): Promise<void> {
  if (!state.printTemplateId) return;
  busy.value = true;
  msg.value = '';
  try {
    const res = await fetch('/api/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId: state.printTemplateId, values: state.printValues }),
    });
    if (!res.ok) throw new Error(await res.text());
    const blob = await res.blob();
    if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = URL.createObjectURL(blob);
  } catch (e) {
    msg.value = t('print.previewFailed', { message: (e as Error).message });
  } finally {
    busy.value = false;
  }
}

async function doPrint(): Promise<void> {
  busy.value = true;
  msg.value = '';
  try {
    await printNow();
    msg.value = state.status;
  } catch (e) {
    msg.value = t('print.failed', { message: (e as Error).message });
  } finally {
    busy.value = false;
  }
}

// Auto-preview on template change and (debounced) on value edits.
watch(
  () => state.printTemplateId + '|' + JSON.stringify(state.printValues),
  () => {
    if (!state.printTemplateId) return;
    clearTimeout(debounce);
    debounce = setTimeout(refreshPreview, 350);
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
});
</script>

<template>
  <div class="print">
    <aside class="form">
      <div class="form-head">
        <h2>{{ t('print.title') }}</h2>
        <span class="muted">{{ t('print.subtitle') }}</span>
      </div>

      <label class="block">{{ t('print.template') }}
        <select :value="state.printTemplateId" @change="onSelect">
          <option v-if="!state.templates.length" value="">{{ t('print.noTemplates') }}</option>
          <option v-for="t in state.templates" :key="t.id" :value="t.id">{{ t.name }}</option>
        </select>
      </label>

      <div class="section">
        <h3>{{ t('print.params') }}</h3>
        <p v-if="!printParams.length" class="muted">{{ t('print.noParams') }}</p>
        <label v-for="k in printParams" :key="k" class="block">
          {{ paramLabel(k) }}
          <textarea v-if="isMultiline(k)" class="multi" rows="3" v-model="state.printValues[k]"></textarea>
          <input v-else v-model="state.printValues[k]" />
        </label>
      </div>

      <div class="grid2">
        <label>{{ t('print.printer') }}
          <select v-model="state.printPrinterId">
            <option value="">{{ t('print.defaultPrinter') }}</option>
            <option v-for="p in state.printers" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </label>
        <label>{{ t('print.copies') }} <input type="number" min="1" v-model.number="state.printCopies" /></label>
      </div>

      <div class="actions">
        <button :disabled="busy" @click="refreshPreview"><Eye :size="15" /> {{ t('print.refreshPreview') }}</button>
        <button class="primary" :disabled="busy || !state.printTemplateId" @click="doPrint">
          <PrinterIcon :size="15" /> {{ t('common.print') }}
        </button>
      </div>
      <p v-if="msg" class="msg mono">{{ msg }}</p>
    </aside>

    <section class="previewpane">
      <div class="preview-head">
        <div>
          <h2>{{ t('print.previewTitle') }}</h2>
          <p class="muted">{{ t('print.previewDescription') }}</p>
        </div>
        <span v-if="busy" class="busy">{{ t('print.generating') }}</span>
      </div>
      <div class="frame">
        <img v-if="previewUrl" :src="previewUrl" class="preview" :style="{ width: previewWidthPx + 'px' }" />
        <span v-else class="muted ph">{{ t('print.previewPlaceholder') }}</span>
      </div>
    </section>
  </div>
</template>

<style scoped>
.print {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(320px, 380px) minmax(0, 1fr);
  min-height: 0;
  overflow: auto;
  gap: 20px;
  padding: 22px 24px;
  align-items: stretch;
}
.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  box-shadow: 0 1px 2px rgba(24, 32, 51, 0.04);
}
.form-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding-bottom: 4px;
}
.form-head h2,
.preview-head h2 {
  margin: 0;
  font-size: 18px;
  line-height: 1.2;
}
.form-head span {
  font-size: 11px;
  text-align: right;
  max-width: 130px;
}
.section {
  border-top: 1px solid var(--border);
  padding: 12px 0 0;
}
.section h3 {
  margin: 0 0 8px;
  font-size: 11px;
  text-transform: uppercase;
  color: var(--muted);
}
.grid2 {
  display: grid;
  grid-template-columns: 1fr 90px;
  gap: 10px;
}
.block {
  display: block;
  margin-top: 8px;
}
.block:first-child {
  margin-top: 0;
}
.multi {
  resize: vertical;
  min-height: 54px;
}
.actions {
  display: flex;
  gap: 10px;
  padding-top: 2px;
}
.actions button {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
}
.msg {
  font-size: 11px;
  background: var(--panel-subtle);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px;
  word-break: break-all;
}
.previewpane {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  min-height: 0;
}
.preview-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  min-width: 0;
}
.preview-head p {
  margin: 5px 0 0;
}
.busy {
  color: var(--accent);
  background: var(--accent-soft);
  border: 1px solid var(--accent-border);
  border-radius: 999px;
  padding: 3px 9px;
  font-size: 12px;
  white-space: nowrap;
}
/* Frame is intentionally a different colour from the label so the white paper edge
   is unambiguous — no white padding that could be mistaken for label margin. */
.frame {
  flex: 1;
  min-height: 360px;
  overflow: auto;
  align-self: stretch;
  max-width: 100%;
  background:
    linear-gradient(var(--canvas-grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--canvas-grid) 1px, transparent 1px),
    var(--canvas-bg);
  background-size: 24px 24px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 18px;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
}
.preview {
  display: block;
  max-width: 100%;
  height: auto;
  image-rendering: pixelated;
  background: var(--paper);
  box-shadow: var(--shadow-paper);
  margin: auto;
}
.ph {
  margin: auto;
  padding: 28px 34px;
  background: var(--panel);
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius);
}

@media (max-width: 860px) {
  .print {
    display: flex;
    flex-direction: column;
    padding: 16px;
  }
  .previewpane {
    order: -1;
    min-height: auto;
  }
  .frame {
    flex: none;
    min-height: 0;
    max-height: none;
    overflow: visible;
  }
}

@media (max-width: 520px) {
  .print {
    padding: 12px;
  }
  .form {
    padding: 13px;
  }
  .grid2 {
    grid-template-columns: 1fr;
  }
}
</style>
