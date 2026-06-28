<script setup lang="ts">
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  Barcode,
  BringToFront,
  ChevronDown,
  ChevronUp,
  Copy,
  Image as ImageIcon,
  Minus,
  QrCode,
  SendToBack,
  Square,
  Trash2,
  Type,
} from 'lucide-vue-next';
import type { LabelElement } from '@labelprint/shared';
import IconButton from './IconButton.vue';
import { addElement, align, deleteSelected, distribute, duplicateSelected, selectedElements, zorder } from '../lib/store';

const adds: { type: LabelElement['type']; icon: typeof Type; label: string }[] = [
  { type: 'text', icon: Type, label: '文本' },
  { type: 'line', icon: Minus, label: '线条' },
  { type: 'box', icon: Square, label: '矩形' },
  { type: 'barcode', icon: Barcode, label: '条形码' },
  { type: 'qrcode', icon: QrCode, label: '二维码' },
  { type: 'image', icon: ImageIcon, label: '图片' },
];

const aligns = [
  { kind: 'left', icon: AlignStartVertical, label: '左对齐' },
  { kind: 'hcenter', icon: AlignCenterVertical, label: '水平居中' },
  { kind: 'right', icon: AlignEndVertical, label: '右对齐' },
  { kind: 'top', icon: AlignStartHorizontal, label: '顶对齐' },
  { kind: 'vmiddle', icon: AlignCenterHorizontal, label: '垂直居中' },
  { kind: 'bottom', icon: AlignEndHorizontal, label: '底对齐' },
] as const;
</script>

<template>
  <aside class="toolbar">
    <div class="section">
      <h3>添加</h3>
      <div class="grid">
        <IconButton v-for="a in adds" :key="a.type" :icon="a.icon" :label="a.label" @click="addElement(a.type)" />
      </div>
    </div>

    <div class="section">
      <h3>对齐 <span class="muted">选1个=画布 / 多个=相互</span></h3>
      <div class="grid">
        <IconButton v-for="a in aligns" :key="a.kind" :icon="a.icon" :label="a.label" @click="align(a.kind)" />
      </div>
      <div class="grid grid-follow">
        <IconButton :icon="AlignHorizontalDistributeCenter" label="水平分布(≥3)" :disabled="selectedElements.length < 3" @click="distribute('h')" />
        <IconButton :icon="AlignVerticalDistributeCenter" label="垂直分布(≥3)" :disabled="selectedElements.length < 3" @click="distribute('v')" />
      </div>
    </div>

    <div class="section">
      <h3>排列 / 编辑</h3>
      <div class="grid">
        <IconButton :icon="BringToFront" label="置顶" :disabled="!selectedElements.length" @click="zorder('front')" />
        <IconButton :icon="SendToBack" label="置底" :disabled="!selectedElements.length" @click="zorder('back')" />
        <IconButton :icon="ChevronUp" label="上移一层" :disabled="!selectedElements.length" @click="zorder('forward')" />
        <IconButton :icon="ChevronDown" label="下移一层" :disabled="!selectedElements.length" @click="zorder('backward')" />
        <IconButton :icon="Copy" label="复制" :disabled="!selectedElements.length" @click="duplicateSelected()" />
        <IconButton :icon="Trash2" label="删除" danger :disabled="!selectedElements.length" @click="deleteSelected()" />
      </div>
    </div>
  </aside>
</template>

<style scoped>
.toolbar {
  width: 100%;
  height: 100%;
  flex: none;
  background: #fff;
  border-right: 1px solid var(--border);
  overflow: auto;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(32px, 1fr));
  gap: 6px;
}
.grid-follow {
  margin-top: 6px;
}
.section:first-child {
  border-top: none;
}
h3 .muted {
  text-transform: none;
  letter-spacing: 0;
  font-weight: 400;
  margin-left: 4px;
}

@media (max-width: 860px) {
  .toolbar {
    border-right: 1px solid var(--border);
  }
  .toolbar :deep(.section),
  .section {
    padding: 10px 8px;
  }
  .section h3 {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  h3 .muted {
    display: none;
  }
  .grid {
    grid-template-columns: 1fr;
    justify-items: center;
  }
}
</style>
