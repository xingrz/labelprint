<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Copy, Eye, Maximize2, Printer as PrinterIcon, Settings, TerminalSquare, X, ZoomIn, ZoomOut } from 'lucide-vue-next';
import type { PrintTargetConfig } from '@labelprint/shared';
import { t } from '../lib/i18n';
import { printNow, printParams, printTemplate, selectPrintTemplate, state } from '../lib/store';
import { makeImagePdfBlob, pdfFileName } from '../lib/pdf';
import TargetSettingsDialog from '../components/TargetSettingsDialog.vue';
import IconButton from '../components/IconButton.vue';

const frameEl = ref<HTMLDivElement | null>(null);
const previewUrl = ref('');
const previewBlob = ref<Blob | null>(null);
const previewKey = ref('');
const previewNatural = ref({ w: 0, h: 0 });
const frameSize = ref({ w: 0, h: 0 });
const previewZoom = ref<'fit' | number>('fit');
const busy = ref(false);
const msg = ref('');
const targetsOpen = ref(false);
const curlOpen = ref(false);
const curlCopied = ref(false);
const selectedCurlOrigin = ref('');
const customCurlOrigin = ref('');
let debounce: ReturnType<typeof setTimeout> | undefined;
let ro: ResizeObserver | undefined;

const MIN_PREVIEW_ZOOM = 2;
const MAX_PREVIEW_ZOOM = 160;
const PREVIEW_ZOOM_STEP = 4;
const fitPreviewPxPerMm = computed(() => {
  const tmpl = printTemplate.value;
  if (!tmpl) return 8;
  const availableW = Math.max(1, frameSize.value.w);
  const availableH = Math.max(1, frameSize.value.h);
  const naturalW = previewNatural.value.w || tmpl.media.widthMm * 8;
  const naturalH = previewNatural.value.h || tmpl.media.heightMm * 8;
  const scale = Math.max(0.1, Math.min(availableW / naturalW, availableH / naturalH));
  return Math.max(MIN_PREVIEW_ZOOM, Math.min(MAX_PREVIEW_ZOOM, (naturalW * scale) / tmpl.media.widthMm));
});
const previewStyle = computed(() => {
  const tmpl = printTemplate.value;
  if (!tmpl) return {};
  if (previewZoom.value !== 'fit') {
    return { width: `${tmpl.media.widthMm * previewZoom.value}px` };
  }
  const availableW = Math.max(1, frameSize.value.w);
  const availableH = Math.max(1, frameSize.value.h);
  const naturalW = previewNatural.value.w || tmpl.media.widthMm * 8;
  const naturalH = previewNatural.value.h || tmpl.media.heightMm * 8;
  const scale = Math.max(0.1, Math.min(availableW / naturalW, availableH / naturalH));
  return { width: `${Math.floor(naturalW * scale)}px` };
});
const zoomLabel = computed(() => (previewZoom.value === 'fit' ? t('print.zoomFit') : `${previewZoom.value}px/mm`));
const selectedTarget = computed<PrintTargetConfig | null>(
  () => state.targets.find((p) => p.id === state.printTargetId) ?? state.targets[0] ?? null,
);
const selectedTargetIsClient = computed(() => isClientTarget(selectedTarget.value));
const curlHostOptions = computed(() => {
  const current = currentOrigin();
  const opts = [{ value: current, label: t('print.cliHostCurrent', { host: current }) }];
  try {
    const u = new URL(current);
    const suffix = u.port ? `:${u.port}` : '';
    const loopback = `${u.protocol}//127.0.0.1${suffix}`;
    if (loopback !== current) opts.push({ value: loopback, label: t('print.cliHostLoopback', { host: loopback }) });
  } catch {
    // Keep the current-origin option only.
  }
  return opts;
});
const curlOrigin = computed(() => {
  if (selectedCurlOrigin.value === '__custom') return normalizeOrigin(customCurlOrigin.value || currentOrigin());
  return selectedCurlOrigin.value || currentOrigin();
});
const curlCommand = computed(() => {
  const body = {
    templateId: state.printTemplateId,
    values: state.printValues,
    targetId: state.printTargetId || undefined,
    copies: state.printCopies,
  };
  const json = JSON.stringify(body, null, 2);
  return [
    'curl -X POST',
    shellQuote(`${curlOrigin.value}/api/print`),
    "-H 'Content-Type: application/json'",
    `--data ${shellQuote(json)}`,
  ].join(' \\\n  ');
});

function paramLabel(k: string): string {
  const d = printTemplate.value?.params.find((p) => p.key === k);
  return d?.label ? `${d.label} (${k})` : k;
}
function isMultiline(k: string): boolean {
  return !!printTemplate.value?.params.find((p) => p.key === k)?.multiline;
}
function isClientTarget(target: PrintTargetConfig | null | undefined): boolean {
  return target?.delivery === 'download' || target?.delivery === 'browser-dialog';
}
function onSelect(e: Event): void {
  selectPrintTemplate((e.target as HTMLSelectElement).value);
}
function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}
function currentOrigin(): string {
  return typeof window === 'undefined' ? 'http://localhost:5179' : window.location.origin;
}
function normalizeOrigin(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, '');
  if (!trimmed) return currentOrigin();
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) return trimmed;
  const protocol = typeof window === 'undefined' ? 'http:' : window.location.protocol;
  return `${protocol}//${trimmed}`;
}
function currentPreviewKey(): string {
  return `${state.printTemplateId}|${JSON.stringify(state.printValues)}`;
}
function setPreviewBlob(blob: Blob): void {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewBlob.value = blob;
  previewKey.value = currentPreviewKey();
  previewUrl.value = URL.createObjectURL(blob);
  previewNatural.value = { w: 0, h: 0 };
}
function onPreviewLoad(e: Event): void {
  const img = e.target as HTMLImageElement;
  previewNatural.value = { w: img.naturalWidth, h: img.naturalHeight };
}
function zoom(delta: number): void {
  const current = previewZoom.value === 'fit' ? fitPreviewPxPerMm.value : previewZoom.value;
  const next = Math.round((current + delta * PREVIEW_ZOOM_STEP) / 2) * 2;
  previewZoom.value = Math.max(MIN_PREVIEW_ZOOM, Math.min(MAX_PREVIEW_ZOOM, next));
}
async function copyCurl(): Promise<void> {
  await navigator.clipboard.writeText(curlCommand.value);
  curlCopied.value = true;
  setTimeout(() => (curlCopied.value = false), 1200);
}

async function requestPreviewBlob(): Promise<Blob> {
  if (!state.printTemplateId) throw new Error(t('error.noTemplateSelected'));
  const res = await fetch('/api/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ templateId: state.printTemplateId, values: state.printValues }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.blob();
}

async function ensurePreviewBlob(): Promise<Blob> {
  if (previewBlob.value && previewKey.value === currentPreviewKey()) return previewBlob.value;
  const blob = await requestPreviewBlob();
  setPreviewBlob(blob);
  return blob;
}

async function refreshPreview(): Promise<void> {
  if (!state.printTemplateId) return;
  busy.value = true;
  msg.value = '';
  try {
    setPreviewBlob(await requestPreviewBlob());
  } catch (e) {
    msg.value = t('print.previewFailed', { message: (e as Error).message });
  } finally {
    busy.value = false;
  }
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(t('print.imageLoadFailed')));
    };
    img.src = url;
  });
}

async function previewAsJpeg(blob: Blob): Promise<{ jpeg: Uint8Array; width: number; height: number }> {
  const img = await loadImage(blob);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error(t('print.canvasUnavailable'));
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0);
  const jpegBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(t('print.pdfEncodeFailed')))), 'image/jpeg', 0.98);
  });
  return {
    jpeg: new Uint8Array(await jpegBlob.arrayBuffer()),
    width: canvas.width,
    height: canvas.height,
  };
}

function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function downloadPdf(target: PrintTargetConfig): Promise<void> {
  const tmpl = printTemplate.value;
  if (!tmpl) throw new Error(t('error.noTemplateSelected'));
  const raster = await previewAsJpeg(await ensurePreviewBlob());
  const pdf = makeImagePdfBlob({
    jpeg: raster.jpeg,
    imageWidth: raster.width,
    imageHeight: raster.height,
    pageWidthMm: tmpl.media.widthMm,
    pageHeightMm: tmpl.media.heightMm,
    copies: state.printCopies,
  });
  downloadBlob(pdf, pdfFileName(tmpl.name));
  state.status = t('status.pdfDownloaded', { target: target.name });
}

async function downloadTspl(target: PrintTargetConfig): Promise<void> {
  const tmpl = printTemplate.value;
  if (!tmpl) throw new Error(t('error.noTemplateSelected'));
  const res = await fetch('/api/render-job', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      templateId: state.printTemplateId,
      values: state.printValues,
      targetId: target.id,
      copies: state.printCopies,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  downloadBlob(await res.blob(), `${pdfFileName(tmpl.name).replace(/\.pdf$/i, '')}.tspl`);
  state.status = t('status.tsplDownloaded', { target: target.name });
}

function htmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function waitForPrintImages(doc: Document): Promise<void> {
  const images = Array.from(doc.images);
  return Promise.all(
    images.map(
      (img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve, reject) => {
              img.onload = () => resolve();
              img.onerror = () => reject(new Error(t('print.imageLoadFailed')));
            }),
    ),
  ).then(() => undefined);
}

async function openBrowserPrint(target: PrintTargetConfig): Promise<void> {
  const tmpl = printTemplate.value;
  if (!tmpl) throw new Error(t('error.noTemplateSelected'));
  const blobUrl = URL.createObjectURL(await ensurePreviewBlob());
  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.left = '-10000px';
  frame.style.top = '0';
  frame.style.width = '1px';
  frame.style.height = '1px';
  frame.style.border = '0';
  frame.setAttribute('aria-hidden', 'true');
  document.body.appendChild(frame);

  const copies = Math.max(1, Math.min(999, Math.floor(state.printCopies || 1)));
  const page = `<section class="page"><img alt="" src="${htmlEscape(blobUrl)}"></section>`;
  const doc = frame.contentDocument;
  if (!doc) throw new Error(t('print.browserPrintFailed'));
  doc.open();
  doc.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${htmlEscape(tmpl.name)}</title>
<style>
@page { size: ${tmpl.media.widthMm}mm ${tmpl.media.heightMm}mm; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; }
.page { width: ${tmpl.media.widthMm}mm; height: ${tmpl.media.heightMm}mm; overflow: hidden; page-break-after: always; break-after: page; }
.page:last-child { page-break-after: auto; break-after: auto; }
img { display: block; width: 100%; height: 100%; object-fit: fill; }
</style>
</head>
<body>${Array.from({ length: copies }, () => page).join('')}</body>
</html>`);
  doc.close();

  await waitForPrintImages(doc);
  const cleanup = () => {
    URL.revokeObjectURL(blobUrl);
    frame.remove();
  };
  frame.contentWindow?.addEventListener('afterprint', () => setTimeout(cleanup, 500), { once: true });
  setTimeout(cleanup, 60_000);
  frame.contentWindow?.focus();
  frame.contentWindow?.print();
  state.status = t('status.browserPrintOpened', { target: target.name });
}

async function doPrint(): Promise<void> {
  busy.value = true;
  msg.value = '';
  try {
    const target = selectedTarget.value;
    if (!target) throw new Error(t('error.noTargetSelected'));
    if (target.format === 'pdf' && target.delivery === 'download') await downloadPdf(target);
    else if (target.format === 'browser-print-page') await openBrowserPrint(target);
    else if (target.format === 'tspl-bitmap' && target.delivery === 'download') await downloadTspl(target);
    else await printNow();
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
  ro?.disconnect();
});
onMounted(() => {
  selectedCurlOrigin.value = currentOrigin();
  ro = new ResizeObserver((entries) => {
    const box = entries[0]?.contentRect;
    if (box) frameSize.value = { w: box.width, h: box.height };
  });
  if (frameEl.value) ro.observe(frameEl.value);
});
</script>

<template>
  <div class="print">
    <aside class="form">
      <div class="form-head">
        <h2>{{ t('print.title') }}</h2>
        <span class="muted">{{ t('print.subtitle') }}</span>
      </div>

      <label class="template-picker block">{{ t('print.template') }}
        <select :value="state.printTemplateId" @change="onSelect">
          <option v-if="!state.templates.length" value="">{{ t('print.noTemplates') }}</option>
          <option v-for="t in state.templates" :key="t.id" :value="t.id">{{ t.name }}</option>
        </select>
      </label>

      <div class="params-region">
        <h3>{{ t('print.params') }}</h3>
        <div class="param-scroll">
          <p v-if="!printParams.length" class="muted">{{ t('print.noParams') }}</p>
          <label v-for="k in printParams" :key="k" class="block">
            {{ paramLabel(k) }}
            <textarea v-if="isMultiline(k)" class="multi" rows="3" v-model="state.printValues[k]"></textarea>
            <input v-else v-model="state.printValues[k]" />
          </label>
        </div>
      </div>

      <div class="print-controls">
        <div class="grid2">
          <label>{{ t('print.target') }}
            <select v-model="state.printTargetId">
              <option v-if="!state.targets.length" value="">{{ t('print.noTargets') }}</option>
              <option v-for="p in state.targets" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </label>
          <label>{{ t('print.copies') }} <input type="number" min="1" v-model.number="state.printCopies" /></label>
        </div>
        <div class="secondary-actions">
          <button type="button" class="ghost subtle" @click="targetsOpen = true">
            <Settings :size="14" /> {{ t('print.manageTargets') }}
          </button>
          <button
            type="button"
            class="ghost subtle"
            :disabled="!state.printTemplateId || selectedTargetIsClient"
            :title="selectedTargetIsClient ? t('print.cliClientUnavailable') : ''"
            @click="curlOpen = true"
          >
            <TerminalSquare :size="14" /> {{ t('print.showCurl') }}
          </button>
        </div>

        <div class="actions">
          <button :disabled="busy" @click="refreshPreview"><Eye :size="15" /> {{ t('print.refreshPreview') }}</button>
          <button class="primary" :disabled="busy || !state.printTemplateId || !selectedTarget" @click="doPrint">
            <PrinterIcon :size="15" /> {{ t('common.print') }}
          </button>
        </div>
        <p v-if="msg" class="msg mono">{{ msg }}</p>
      </div>
    </aside>

    <section class="previewpane">
      <div class="preview-head">
        <div>
          <h2>{{ t('print.previewTitle') }}</h2>
          <p class="muted">{{ t('print.previewDescription') }}</p>
        </div>
        <div class="preview-tools">
          <span v-if="busy" class="busy">{{ t('print.generating') }}</span>
          <div class="command-group">
            <IconButton :icon="ZoomOut" :label="t('print.zoomOut')" @click="zoom(-1)" />
            <span class="zoom mono">{{ zoomLabel }}</span>
            <IconButton :icon="ZoomIn" :label="t('print.zoomIn')" @click="zoom(1)" />
            <IconButton :icon="Maximize2" :label="t('print.zoomFit')" :active="previewZoom === 'fit'" @click="previewZoom = 'fit'" />
          </div>
        </div>
      </div>
      <div ref="frameEl" class="frame" :class="{ fit: previewZoom === 'fit', zoomed: previewZoom !== 'fit' }">
        <img v-if="previewUrl" :src="previewUrl" class="preview" :style="previewStyle" @load="onPreviewLoad" />
        <span v-else class="muted ph">{{ t('print.previewPlaceholder') }}</span>
      </div>
    </section>

    <TargetSettingsDialog :open="targetsOpen" @close="targetsOpen = false" />

    <div v-if="curlOpen" class="curl-overlay" @pointerdown.self="curlOpen = false">
      <section class="curl-dialog" role="dialog" aria-modal="true" :aria-label="t('print.curlTitle')">
        <header class="curl-head">
          <div class="curl-title">
            <TerminalSquare :size="18" :stroke-width="2" />
            <div>
            <h2>{{ t('print.curlTitle') }}</h2>
            <p class="muted">{{ t('print.curlDescription') }}</p>
            </div>
          </div>
          <button type="button" class="ghost curl-close" :aria-label="t('common.close')" @click="curlOpen = false">
            <X :size="17" />
          </button>
        </header>
        <div class="curl-options">
          <label class="host-select">{{ t('print.cliHost') }}
            <select v-model="selectedCurlOrigin">
              <option v-for="opt in curlHostOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              <option value="__custom">{{ t('print.cliHostCustom') }}</option>
            </select>
          </label>
          <label v-if="selectedCurlOrigin === '__custom'" class="host-custom">{{ t('print.cliHostCustom') }}
            <input v-model="customCurlOrigin" :placeholder="t('print.cliHostPlaceholder')" />
          </label>
        </div>
        <section class="curl-code">
          <header>
            <span class="mono">curl</span>
            <button type="button" class="ghost copy-code" @click="copyCurl">
              <Copy :size="14" /> {{ curlCopied ? t('print.copiedCurl') : t('print.copyCurl') }}
            </button>
          </header>
          <pre class="curl mono">{{ curlCommand }}</pre>
        </section>
      </section>
    </div>
  </div>
</template>

<style scoped>
.print {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(320px, 380px) minmax(0, 1fr);
  min-height: 0;
  overflow: hidden;
  gap: 20px;
  padding: 22px 24px;
  align-items: stretch;
}
.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(24, 32, 51, 0.04);
}
.form-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding: 16px 16px 4px;
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
.template-picker {
  flex: none;
  padding: 0 16px;
}
.params-region {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--border);
  padding: 12px 0 0;
}
.params-region h3 {
  flex: none;
  margin: 0;
  padding: 0 16px 8px;
  font-size: 11px;
  text-transform: uppercase;
  color: var(--muted);
}
.param-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0 16px 0;
}
.print-controls {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 16px 16px;
  border-top: 1px solid var(--border);
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
.secondary-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.subtle {
  min-height: 28px;
  padding: 4px 8px;
  color: var(--muted);
  font-size: 12px;
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
.preview-tools {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  flex-wrap: wrap;
}
.command-group {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: none;
  padding: 3px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 8px;
}
.zoom {
  min-width: 68px;
  text-align: center;
  color: var(--muted);
  font-size: 11px;
}
/* Frame is intentionally a different colour from the label so the white paper edge
   is unambiguous — no white padding that could be mistaken for label margin. */
.frame {
  flex: 1;
  min-height: 0;
  overflow: hidden;
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
  align-items: center;
  justify-content: center;
}
.frame.zoomed {
  overflow: auto;
  align-items: flex-start;
  justify-content: flex-start;
}
.preview {
  flex: none;
  display: block;
  height: auto;
  max-width: none;
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
.curl-overlay {
  position: fixed;
  inset: 0;
  z-index: 82;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  background: rgba(15, 23, 42, 0.46);
}
.curl-dialog {
  width: min(760px, 94vw);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.34);
  overflow: hidden;
}
.curl-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px 13px;
  border-bottom: 1px solid var(--border);
}
.curl-title {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
}
.curl-title > svg {
  margin-top: 2px;
  color: var(--accent);
  flex: none;
}
.curl-close {
  width: 30px;
  height: 30px;
  padding: 0;
  flex: none;
}
.curl-head h2 {
  margin: 0;
  font-size: 16px;
}
.curl-head p {
  margin: 4px 0 0;
}
.curl-options {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(220px, 1fr);
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--panel-subtle);
}
.host-select,
.host-custom {
  min-width: 0;
}
.curl-code {
  display: flex;
  min-height: 0;
  flex-direction: column;
  background: var(--field);
}
.curl-code header {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 42px;
  padding: 8px 12px 8px 16px;
  border-bottom: 1px solid var(--border);
  color: var(--muted);
}
.copy-code {
  margin-left: auto;
  min-height: 28px;
  padding: 4px 8px;
  color: var(--text-soft);
}
.curl {
  margin: 0;
  padding: 16px;
  flex: 1;
  min-height: 180px;
  max-height: 48vh;
  overflow: auto;
  white-space: pre-wrap;
  background: transparent;
  font-size: 12px;
}

@media (max-width: 860px) {
  .print {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(220px, 28vh) minmax(0, 1fr);
    padding: 16px;
  }
  .previewpane {
    grid-row: 1;
    min-height: 0;
  }
  .form {
    grid-row: 2;
    min-height: 0;
  }
  .preview-head {
    flex-direction: column;
    gap: 10px;
  }
  .preview-tools {
    justify-content: flex-start;
  }
  .frame {
    flex: 1;
    min-height: 0;
    max-height: none;
  }
  .form {
    gap: 8px;
  }
  .form-head {
    padding: 12px 13px 2px;
  }
  .template-picker {
    padding: 0 13px;
  }
  .params-region {
    padding-top: 10px;
  }
  .params-region h3 {
    padding: 0 13px 6px;
  }
  .param-scroll {
    padding: 0 13px;
  }
  .print-controls {
    gap: 8px;
    padding: 10px 13px 13px;
  }
}

@media (max-width: 520px) {
  .print {
    padding: 12px;
  }
  .grid2 {
    grid-template-columns: 1fr;
  }
  .curl-overlay {
    padding: 10px;
  }
  .curl-options {
    grid-template-columns: 1fr;
  }
  .curl {
    max-height: 52vh;
  }
}
</style>
