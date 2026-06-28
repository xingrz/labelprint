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
import { computed } from 'vue';
import type { LabelElement } from '@labelprint/shared';
import IconButton from './IconButton.vue';
import { t } from '../lib/i18n';
import { addElement, align, deleteSelected, distribute, duplicateSelected, selectedElements, zorder } from '../lib/store';

const adds = computed<{ type: LabelElement['type']; icon: typeof Type; label: string }[]>(() => [
  { type: 'text', icon: Type, label: t('toolbar.addText') },
  { type: 'line', icon: Minus, label: t('toolbar.addLine') },
  { type: 'box', icon: Square, label: t('toolbar.addBox') },
  { type: 'barcode', icon: Barcode, label: t('toolbar.addBarcode') },
  { type: 'qrcode', icon: QrCode, label: t('toolbar.addQrcode') },
  { type: 'image', icon: ImageIcon, label: t('toolbar.addImage') },
]);

const aligns = computed(
  () =>
    [
      { kind: 'left', icon: AlignStartVertical, label: t('toolbar.alignLeft') },
      { kind: 'hcenter', icon: AlignCenterVertical, label: t('toolbar.alignCenterH') },
      { kind: 'right', icon: AlignEndVertical, label: t('toolbar.alignRight') },
      { kind: 'top', icon: AlignStartHorizontal, label: t('toolbar.alignTop') },
      { kind: 'vmiddle', icon: AlignCenterHorizontal, label: t('toolbar.alignMiddleV') },
      { kind: 'bottom', icon: AlignEndHorizontal, label: t('toolbar.alignBottom') },
    ] as const,
);
</script>

<template>
  <aside class="toolbar">
    <div class="section">
      <h3>{{ t('toolbar.add') }}</h3>
      <div class="grid">
        <IconButton v-for="a in adds" :key="a.type" :icon="a.icon" :label="a.label" @click="addElement(a.type)" />
      </div>
    </div>

    <div class="section">
      <h3>{{ t('toolbar.align') }} <span class="muted">{{ t('toolbar.alignHint') }}</span></h3>
      <div class="grid">
        <IconButton v-for="a in aligns" :key="a.kind" :icon="a.icon" :label="a.label" @click="align(a.kind)" />
      </div>
      <div class="grid grid-follow">
        <IconButton :icon="AlignHorizontalDistributeCenter" :label="t('toolbar.distributeH')" :disabled="selectedElements.length < 3" @click="distribute('h')" />
        <IconButton :icon="AlignVerticalDistributeCenter" :label="t('toolbar.distributeV')" :disabled="selectedElements.length < 3" @click="distribute('v')" />
      </div>
    </div>

    <div class="section">
      <h3>{{ t('toolbar.orderEdit') }}</h3>
      <div class="grid">
        <IconButton :icon="BringToFront" :label="t('toolbar.front')" :disabled="!selectedElements.length" @click="zorder('front')" />
        <IconButton :icon="SendToBack" :label="t('toolbar.back')" :disabled="!selectedElements.length" @click="zorder('back')" />
        <IconButton :icon="ChevronUp" :label="t('toolbar.forward')" :disabled="!selectedElements.length" @click="zorder('forward')" />
        <IconButton :icon="ChevronDown" :label="t('toolbar.backward')" :disabled="!selectedElements.length" @click="zorder('backward')" />
        <IconButton :icon="Copy" :label="t('common.copy')" :disabled="!selectedElements.length" @click="duplicateSelected()" />
        <IconButton :icon="Trash2" :label="t('common.delete')" danger :disabled="!selectedElements.length" @click="deleteSelected()" />
      </div>
    </div>
  </aside>
</template>

<style scoped>
.toolbar {
  width: 100%;
  height: 100%;
  flex: none;
  background: var(--panel);
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
