<script setup lang="ts">
import { computed } from 'vue';
import { DEFAULT_FONT } from '@labelprint/shared';
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

// Literal "{{参数}}" cannot appear raw in a Vue template (the parser reads it as
// an interpolation), so we surface it through a constant.
const PH = '{{参数}}';

const rotations = [0, 90, 180, 270];
const aligns: [string, string][] = [
  ['left', '左'],
  ['center', '中'],
  ['right', '右'],
];
const valigns: [string, string][] = [
  ['top', '上'],
  ['middle', '中'],
  ['bottom', '下'],
];
</script>

<template>
  <div class="props">
    <div v-if="state.doc" class="section">
      <h3>标签尺寸</h3>
      <div class="col">
        <div class="grid2">
          <label>宽 (mm)
            <input type="number" step="0.1" :value="state.doc.media.widthMm"
              @input="setMediaGeometry({ widthMm: parseFloat(($event.target as HTMLInputElement).value) || 0 })" />
          </label>
          <label>高 (mm)
            <input type="number" step="0.1" :value="state.doc.media.heightMm"
              @input="setMediaGeometry({ heightMm: parseFloat(($event.target as HTMLInputElement).value) || 0 })" />
          </label>
        </div>
        <div class="grid2">
          <label>走纸定位
            <select :value="state.doc.media.type"
              @change="setMediaGeometry({ type: ($event.target as HTMLSelectElement).value as any })">
              <option value="gap">间隙定位</option>
              <option value="continuous">连续纸</option>
              <option value="blackmark">黑标定位</option>
            </select>
          </label>
          <label v-if="state.doc.media.type !== 'continuous'">间隙 (mm)
            <input type="number" step="0.1" :value="state.doc.media.gapMm ?? 2"
              @input="setMediaGeometry({ gapMm: parseFloat(($event.target as HTMLInputElement).value) || 0 })" />
          </label>
        </div>
      </div>
    </div>

    <div v-if="single && el" class="section">
      <h3>{{ ({ text: '文本', line: '线条', box: '矩形', barcode: '条码', qrcode: '二维码', image: '图片' } as any)[el.type] }}</h3>

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
            <label>边长 (mm) <input type="number" step="0.1" :value="el.size" @input="num(el.id, 'size', $event)" /></label>
          </template>
          <template v-else>
            <label>宽 (mm) <input type="number" step="0.1" :value="el.w" @input="num(el.id, 'w', $event)" /></label>
            <label>高 (mm) <input type="number" step="0.1" :value="el.h" @input="num(el.id, 'h', $event)" /></label>
          </template>
        </div>
        <label class="block">旋转
          <select :value="el.rotation ?? 0" @change="num(el.id, 'rotation', $event)">
            <option v-for="r in rotations" :key="r" :value="r">{{ r }}°</option>
          </select>
        </label>
      </template>

      <!-- text props -->
      <template v-if="el.type === 'text'">
        <label class="block">文本（可用 {{ PH }} 占位）
          <textarea rows="2" :value="el.text" @input="str(el.id, 'text', $event)"></textarea>
        </label>
        <div class="grid2">
          <label>字号 (pt) <input type="number" step="0.5" :value="el.fontSizePt" @input="num(el.id, 'fontSizePt', $event)" /></label>
          <label>行高 <input type="number" step="0.05" :value="el.lineHeight ?? 1.2" @input="num(el.id, 'lineHeight', $event)" /></label>
        </div>
        <label class="block">字体
          <select :value="fontSelectValue(el)" @change="onFontSelect(el.id, $event)">
            <option :value="DEFAULT_FONT">默认（中文优先）</option>
            <option v-for="f in state.fonts" :key="f" :value="f">{{ f }}</option>
            <option :value="CUSTOM_FONT">自定义…</option>
          </select>
          <input
            v-if="isCustomFont(el)"
            class="mt"
            :value="el.fontFamily"
            placeholder="输入 font-family"
            @input="str(el.id, 'fontFamily', $event)"
          />
        </label>
        <div class="row">
          <button class="tgl bold" :class="{ active: el.fontWeight === 'bold' }" title="粗体"
            @click="updateElement(el.id, { fontWeight: el.fontWeight === 'bold' ? 'normal' : 'bold' } as never)">B</button>
          <button class="tgl ital" :class="{ active: !!el.italic }" title="斜体"
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
          <label>线宽 (mm) <input type="number" step="0.05" :value="el.strokeMm" @input="num(el.id, 'strokeMm', $event)" /></label>
          <label>颜色 <input type="color" class="color" :value="el.color ?? '#000000'" @input="str(el.id, 'color', $event)" /></label>
          <label>线型
            <select :value="el.dash && el.dash.length ? 'dash' : 'solid'" @change="setLineStyle(el.id, $event)">
              <option value="solid">实线</option>
              <option value="dash">虚线</option>
            </select>
          </label>
          <label v-if="el.dash && el.dash.length">段长 (mm)
            <input type="number" step="0.1" min="0.2" :value="el.dash[0]" @input="setDashLen(el.id, $event)" />
          </label>
        </div>
      </template>

      <!-- box props -->
      <template v-else-if="el.type === 'box'">
        <div class="grid2">
          <label>线宽 (mm) <input type="number" step="0.05" :value="el.strokeMm" @input="num(el.id, 'strokeMm', $event)" /></label>
          <label>圆角 (mm) <input type="number" step="0.1" :value="el.radiusMm ?? 0" @input="num(el.id, 'radiusMm', $event)" /></label>
        </div>
        <div class="row">
          <label class="inline">描边 <input type="color" class="color" :value="el.color ?? '#000000'" @input="str(el.id, 'color', $event)" /></label>
          <label class="inline">填充
            <input :value="el.fill ?? 'none'" @input="str(el.id, 'fill', $event)" placeholder="none 或 #000" />
          </label>
        </div>
      </template>

      <!-- barcode props -->
      <template v-else-if="el.type === 'barcode'">
        <label class="block">类型
          <select :value="el.symbology" @change="str(el.id, 'symbology', $event)">
            <option value="code128">Code128</option>
            <option value="ean13">EAN-13</option>
            <option value="code39">Code39</option>
            <option value="upca">UPC-A</option>
            <option value="interleaved2of5">交叉25</option>
          </select>
        </label>
        <label class="block">内容 <input :value="el.value" @input="str(el.id, 'value', $event)" /></label>
        <label class="inline"><input type="checkbox" :checked="!!el.showText" @change="bool(el.id, 'showText', $event)" /> 显示文本</label>
      </template>

      <!-- qrcode props -->
      <template v-else-if="el.type === 'qrcode'">
        <label class="block">内容 <input :value="el.value" @input="str(el.id, 'value', $event)" /></label>
        <label class="block">纠错
          <select :value="el.ecc ?? 'M'" @change="str(el.id, 'ecc', $event)">
            <option value="L">L</option><option value="M">M</option><option value="Q">Q</option><option value="H">H</option>
          </select>
        </label>
      </template>

      <!-- image props -->
      <template v-else-if="el.type === 'image'">
        <label class="block">来源 (data URL 或 {{ PH }})
          <input :value="el.src" @input="str(el.id, 'src', $event)" />
        </label>
      </template>
    </div>

    <div v-else-if="selectedElements.length > 1" class="section muted">
      已选 {{ selectedElements.length }} 个元素 · 使用左侧「对齐 / 分布」
    </div>
    <div v-else class="section muted">未选中元素</div>
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
  background: #fff;
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
