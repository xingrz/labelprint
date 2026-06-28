<script setup lang="ts">
import { computed } from 'vue';
import { DEFAULT_FONT } from '@labelprint/shared';
import { mediaTypeLabel, t } from '../lib/i18n';
import { selectedElements, setMediaGeometry, state, updateElement } from '../lib/store';
import { bboxOf } from '../lib/geometry';

const CUSTOM_FONT = '__custom__';
const knownFonts = computed(() => new Set([DEFAULT_FONT, ...state.fonts]));
function isCustomFont(e: { fontFamily?: string } | null): boolean {
  return !!e?.fontFamily && !knownFonts.value.has(e.fontFamily);
}
function fontSelectValue(e: { fontFamily?: string }): string {
  return isCustomFont(e) ? CUSTOM_FONT : (e.fontFamily ?? DEFAULT_FONT);
}
function onFontSelect(id: string, ev: Event): void {
  const v = (ev.target as HTMLSelectElement).value;
  if (v === CUSTOM_FONT) {
    const cur = selectedElements.value[0] as { fontFamily?: string } | undefined;
    if (cur && !isCustomFont(cur)) updateElement(id, { fontFamily: '' } as never);
  } else {
    updateElement(id, { fontFamily: v } as never);
  }
}

const single = computed(() => selectedElements.value.length === 1);
// Cast to any: the property panel reads/writes a heterogeneous union; v-if on el.type
// guards which fields are shown. Editing always goes through updateElement.
const el = computed<any>(() => (single.value ? selectedElements.value[0] : null));
const bb = computed(() => (el.value ? bboxOf(el.value) : null));

function num(id: string, key: string, e: Event): void {
  const v = parseFloat((e.target as HTMLInputElement).value);
  if (!Number.isNaN(v)) updateElement(id, { [key]: v } as never);
}
function str(id: string, key: string, e: Event): void {
  updateElement(id, { [key]: (e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value } as never);
}
function bool(id: string, key: string, e: Event): void {
  updateElement(id, { [key]: (e.target as HTMLInputElement).checked } as never);
}
function setLineStyle(id: string, e: Event): void {
  const dashed = (e.target as HTMLSelectElement).value === 'dash';
  updateElement(id, { dash: dashed ? [1, 0.6] : undefined } as never);
}
function setDashLen(id: string, e: Event): void {
  const len = parseFloat((e.target as HTMLInputElement).value) || 1;
  updateElement(id, { dash: [len, Math.max(0.3, len * 0.6)] } as never);
}

// Literal "{{param}}" cannot appear raw in a Vue template (the parser reads it as
// an interpolation), so we surface it through a constant.
const PH = '{{param}}';

const rotations = [0, 90, 180, 270];
const aligns = computed<[string, string][]>(() => [
  ['left', t('props.align.left')],
  ['center', t('props.align.center')],
  ['right', t('props.align.right')],
]);
const valigns = computed<[string, string][]>(() => [
  ['top', t('props.align.top')],
  ['middle', t('props.align.middle')],
  ['bottom', t('props.align.bottom')],
]);
const elementTitle = computed<Record<string, string>>(() => ({
  text: t('props.element.text'),
  line: t('props.element.line'),
  box: t('props.element.box'),
  barcode: t('props.element.barcode'),
  qrcode: t('props.element.qrcode'),
  image: t('props.element.image'),
}));
</script>

<template>
  <div class="props">
    <div v-if="state.doc" class="section">
      <h3>{{ t('props.mediaSize') }}</h3>
      <div class="col">
        <div class="grid2">
          <label>{{ t('props.width') }} (mm)
            <input type="number" step="0.1" :value="state.doc.media.widthMm"
              @input="setMediaGeometry({ widthMm: parseFloat(($event.target as HTMLInputElement).value) || 0 })" />
          </label>
          <label>{{ t('props.height') }} (mm)
            <input type="number" step="0.1" :value="state.doc.media.heightMm"
              @input="setMediaGeometry({ heightMm: parseFloat(($event.target as HTMLInputElement).value) || 0 })" />
          </label>
        </div>
        <div class="grid2">
          <label>{{ t('props.feedMode') }}
            <select :value="state.doc.media.type"
              @change="setMediaGeometry({ type: ($event.target as HTMLSelectElement).value as any })">
              <option value="gap">{{ mediaTypeLabel('gap') }}</option>
              <option value="continuous">{{ mediaTypeLabel('continuous') }}</option>
              <option value="blackmark">{{ mediaTypeLabel('blackmark') }}</option>
            </select>
          </label>
          <label v-if="state.doc.media.type !== 'continuous'">{{ t('props.gap') }} (mm)
            <input type="number" step="0.1" :value="state.doc.media.gapMm ?? 2"
              @input="setMediaGeometry({ gapMm: parseFloat(($event.target as HTMLInputElement).value) || 0 })" />
          </label>
        </div>
      </div>
    </div>

    <div v-if="single && el" class="section">
      <h3>{{ elementTitle[el.type] }}</h3>

      <!-- geometry -->
      <template v-if="el.type === 'line'">
        <div class="grid2">
          <label>X1 <input type="number" step="0.1" :value="el.x" @input="num(el.id, 'x', $event)" /></label>
          <label>Y1 <input type="number" step="0.1" :value="el.y" @input="num(el.id, 'y', $event)" /></label>
          <label>X2 <input type="number" step="0.1" :value="el.x2" @input="num(el.id, 'x2', $event)" /></label>
          <label>Y2 <input type="number" step="0.1" :value="el.y2" @input="num(el.id, 'y2', $event)" /></label>
        </div>
      </template>
      <template v-else>
        <div class="grid2">
          <label>X (mm) <input type="number" step="0.1" :value="el.x" @input="num(el.id, 'x', $event)" /></label>
          <label>Y (mm) <input type="number" step="0.1" :value="el.y" @input="num(el.id, 'y', $event)" /></label>
          <template v-if="el.type === 'qrcode'">
            <label>{{ t('props.side') }} (mm) <input type="number" step="0.1" :value="el.size" @input="num(el.id, 'size', $event)" /></label>
          </template>
          <template v-else>
            <label>{{ t('props.width') }} (mm) <input type="number" step="0.1" :value="el.w" @input="num(el.id, 'w', $event)" /></label>
            <label>{{ t('props.height') }} (mm) <input type="number" step="0.1" :value="el.h" @input="num(el.id, 'h', $event)" /></label>
          </template>
        </div>
        <label class="block">{{ t('props.rotation') }}
          <select :value="el.rotation ?? 0" @change="num(el.id, 'rotation', $event)">
            <option v-for="r in rotations" :key="r" :value="r">{{ r }}°</option>
          </select>
        </label>
      </template>

      <!-- text props -->
      <template v-if="el.type === 'text'">
        <label class="block">{{ t('props.textValue', { placeholder: PH }) }}
          <textarea rows="2" :value="el.text" @input="str(el.id, 'text', $event)"></textarea>
        </label>
        <div class="grid2">
          <label>{{ t('props.fontSize') }} (pt) <input type="number" step="0.5" :value="el.fontSizePt" @input="num(el.id, 'fontSizePt', $event)" /></label>
          <label>{{ t('props.lineHeight') }} <input type="number" step="0.05" :value="el.lineHeight ?? 1.2" @input="num(el.id, 'lineHeight', $event)" /></label>
        </div>
        <label class="block">{{ t('props.font') }}
          <select :value="fontSelectValue(el)" @change="onFontSelect(el.id, $event)">
            <option :value="DEFAULT_FONT">{{ t('props.defaultFont') }}</option>
            <option v-for="f in state.fonts" :key="f" :value="f">{{ f }}</option>
            <option :value="CUSTOM_FONT">{{ t('props.customFont') }}</option>
          </select>
          <input
            v-if="isCustomFont(el)"
            class="mt"
            :value="el.fontFamily"
            :placeholder="t('props.fontPlaceholder')"
            @input="str(el.id, 'fontFamily', $event)"
          />
        </label>
        <div class="row">
          <button class="tgl bold" :class="{ active: el.fontWeight === 'bold' }" :title="t('props.bold')"
            @click="updateElement(el.id, { fontWeight: el.fontWeight === 'bold' ? 'normal' : 'bold' } as never)">B</button>
          <button class="tgl ital" :class="{ active: !!el.italic }" :title="t('props.italic')"
            @click="updateElement(el.id, { italic: !el.italic } as never)">I</button>
          <input type="color" class="color" :value="el.color ?? '#000000'" @input="str(el.id, 'color', $event)" />
        </div>
        <div class="row">
          <div class="seg">
            <button v-for="[v, t] in aligns" :key="v" :class="{ active: (el.align || 'left') === v }"
              @click="updateElement(el.id, { align: v } as never)">{{ t }}</button>
          </div>
          <div class="seg">
            <button v-for="[v, t] in valigns" :key="v" :class="{ active: (el.valign || 'top') === v }"
              @click="updateElement(el.id, { valign: v } as never)">{{ t }}</button>
          </div>
        </div>
      </template>

      <!-- line props -->
      <template v-else-if="el.type === 'line'">
        <div class="grid2">
          <label>{{ t('props.strokeWidth') }} (mm) <input type="number" step="0.05" :value="el.strokeMm" @input="num(el.id, 'strokeMm', $event)" /></label>
          <label>{{ t('props.color') }} <input type="color" class="color" :value="el.color ?? '#000000'" @input="str(el.id, 'color', $event)" /></label>
          <label>{{ t('props.lineStyle') }}
            <select :value="el.dash && el.dash.length ? 'dash' : 'solid'" @change="setLineStyle(el.id, $event)">
              <option value="solid">{{ t('props.lineSolid') }}</option>
              <option value="dash">{{ t('props.lineDash') }}</option>
            </select>
          </label>
          <label v-if="el.dash && el.dash.length">{{ t('props.dashLength') }} (mm)
            <input type="number" step="0.1" min="0.2" :value="el.dash[0]" @input="setDashLen(el.id, $event)" />
          </label>
        </div>
      </template>

      <!-- box props -->
      <template v-else-if="el.type === 'box'">
        <div class="grid2">
          <label>{{ t('props.strokeWidth') }} (mm) <input type="number" step="0.05" :value="el.strokeMm" @input="num(el.id, 'strokeMm', $event)" /></label>
          <label>{{ t('props.radius') }} (mm) <input type="number" step="0.1" :value="el.radiusMm ?? 0" @input="num(el.id, 'radiusMm', $event)" /></label>
        </div>
        <div class="row">
          <label class="inline">{{ t('props.strokeColor') }} <input type="color" class="color" :value="el.color ?? '#000000'" @input="str(el.id, 'color', $event)" /></label>
          <label class="inline">{{ t('props.fill') }}
            <input :value="el.fill ?? 'none'" @input="str(el.id, 'fill', $event)" :placeholder="t('props.fillPlaceholder')" />
          </label>
        </div>
      </template>

      <!-- barcode props -->
      <template v-else-if="el.type === 'barcode'">
        <label class="block">{{ t('props.type') }}
          <select :value="el.symbology" @change="str(el.id, 'symbology', $event)">
            <option value="code128">Code128</option>
            <option value="ean13">EAN-13</option>
            <option value="code39">Code39</option>
            <option value="upca">UPC-A</option>
            <option value="interleaved2of5">Interleaved 2 of 5</option>
          </select>
        </label>
        <label class="block">{{ t('props.content') }} <input :value="el.value" @input="str(el.id, 'value', $event)" /></label>
        <label class="inline"><input type="checkbox" :checked="!!el.showText" @change="bool(el.id, 'showText', $event)" /> {{ t('props.showText') }}</label>
      </template>

      <!-- qrcode props -->
      <template v-else-if="el.type === 'qrcode'">
        <label class="block">{{ t('props.content') }} <input :value="el.value" @input="str(el.id, 'value', $event)" /></label>
        <label class="block">{{ t('props.errorCorrection') }}
          <select :value="el.ecc ?? 'M'" @change="str(el.id, 'ecc', $event)">
            <option value="L">L</option><option value="M">M</option><option value="Q">Q</option><option value="H">H</option>
          </select>
        </label>
      </template>

      <!-- image props -->
      <template v-else-if="el.type === 'image'">
        <label class="block">{{ t('props.imageSource', { placeholder: PH }) }}
          <input :value="el.src" @input="str(el.id, 'src', $event)" />
        </label>
      </template>
    </div>

    <div v-else-if="selectedElements.length > 1" class="section muted">
      {{ t('props.multiSelected', { count: selectedElements.length }) }}
    </div>
    <div v-else class="section muted">{{ t('props.noneSelected') }}</div>
  </div>
</template>

<style scoped>
.props {
  background: var(--panel);
  color: var(--text);
}
.props :deep(.section),
.section {
  padding: 13px 14px;
}
.mt {
  margin-top: 5px;
}
.grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 9px;
}
.grid2 label {
  min-width: 0;
}
label.block,
label.inline {
  display: block;
  margin-top: 8px;
}
label.inline {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text);
  font-weight: 500;
}
.row {
  margin-top: 9px;
  flex-wrap: wrap;
}
.color {
  width: 36px;
  height: 30px;
  padding: 1px;
}
.tgl {
  width: 32px;
  height: 30px;
  padding: 0;
  min-height: 30px;
}
.tgl.bold {
  font-weight: 700;
}
.tgl.ital {
  font-family: Georgia, 'Times New Roman', serif;
  font-style: italic;
}
.seg {
  display: inline-flex;
  border: 1px solid var(--border-strong);
  border-radius: 7px;
  overflow: hidden;
}
.seg button {
  min-height: 30px;
  border-radius: 0;
  border: none;
  border-right: 1px solid var(--border);
  background: var(--field);
  min-width: 34px;
}
.seg button:last-child {
  border-right: none;
}
.seg button:first-child {
  border-radius: 0;
}
.seg button:last-child {
  border-radius: 0;
}
.seg button.active {
  background: var(--accent-soft);
  color: var(--accent);
}
</style>
