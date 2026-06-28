<script setup lang="ts">
import { Copy, Pencil, Plus, Printer, Trash2 } from 'lucide-vue-next';
import { compileToSvg, defaultMediaProfiles, type TemplateDoc } from '@labelprint/shared';
import { confirmDialog } from '../lib/confirm';
import {
  createTemplate,
  duplicateTemplateById,
  openTemplate,
  removeTemplate,
  selectPrintTemplate,
  state,
} from '../lib/store';

function thumb(t: TemplateDoc): string {
  return compileToSvg(t, { values: t.defaults });
}
function mediaLabel(t: TemplateDoc): string {
  const m = t.media;
  const type = m.type === 'continuous' ? '连续纸' : m.type === 'blackmark' ? '黑标定位' : '间隙定位';
  return `${m.widthMm}×${m.heightMm} mm · ${type}`;
}
function onNew(): void {
  createTemplate(state.mediaList[0] ?? defaultMediaProfiles()[0]!);
}
function onPrint(t: TemplateDoc): void {
  selectPrintTemplate(t.id);
  state.activeView = 'print';
}
async function onDelete(t: TemplateDoc): Promise<void> {
  const ok = await confirmDialog({
    title: `删除模板「${t.name}」？`,
    message: '此操作不可撤销。',
    confirmText: '删除',
    danger: true,
  });
  if (ok) removeTemplate(t.id);
}
</script>

<template>
  <div class="templates">
    <div class="head">
      <div>
        <h2>模板</h2>
        <p class="muted">选择一个模板进入设计，或复制现有规格快速改版。</p>
      </div>
      <span class="count">{{ state.templates.length }} 个模板</span>
      <div class="spacer"></div>
      <button class="primary" @click="onNew"><Plus :size="15" /> 新建模板</button>
    </div>

    <div v-if="state.templates.length" class="grid">
      <div v-for="t in state.templates" :key="t.id" class="card">
        <button class="thumb" title="编辑" @click="openTemplate(t.id)">
          <div class="thumb-inner" v-html="thumb(t)"></div>
        </button>
        <div class="meta">
          <div class="name" :title="t.name">{{ t.name }}</div>
          <div class="size muted">{{ mediaLabel(t) }}</div>
        </div>
        <div class="actions">
          <button class="primary action-main" @click="openTemplate(t.id)"><Pencil :size="15" /> 设计</button>
          <button class="action-main" @click="onPrint(t)"><Printer :size="15" /> 打印</button>
          <div class="spacer"></div>
          <button class="link" title="复制" @click="duplicateTemplateById(t.id)"><Copy :size="15" /></button>
          <button class="link danger" title="删除" @click="onDelete(t)"><Trash2 :size="15" /></button>
        </div>
      </div>
    </div>
    <p v-else class="muted empty">还没有模板。点「新建模板」开始。</p>
  </div>
</template>

<style scoped>
.templates {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 22px 24px;
  overflow: auto;
}
.head {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 18px;
}
.head h2 {
  margin: 0;
  font-size: 20px;
  line-height: 1.2;
}
.head p {
  margin: 5px 0 0;
}
.head button.primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: none;
}
.count {
  margin-top: 2px;
  color: var(--text-soft);
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 4px 10px;
  white-space: nowrap;
}
.spacer {
  flex: 1;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 16px;
}
.card {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--panel);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 1px 2px rgba(24, 32, 51, 0.04);
  transition:
    border-color 120ms ease,
    box-shadow 120ms ease,
    transform 120ms ease;
}
.card:hover {
  border-color: #c4d2e4;
  box-shadow: var(--shadow-panel);
  transform: translateY(-1px);
}
.thumb {
  border: none;
  border-radius: 0;
  background:
    linear-gradient(#dbe2ec 1px, transparent 1px),
    linear-gradient(90deg, #dbe2ec 1px, transparent 1px),
    #eef2f7;
  background-size: 18px 18px;
  padding: 18px;
  height: 148px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.thumb:hover {
  background-color: #e6ebf2;
}
.thumb-inner {
  max-width: 100%;
  max-height: 100%;
  display: flex;
}
.thumb-inner :deep(svg) {
  max-width: 100%;
  max-height: 102px;
  width: auto;
  height: auto;
  background: #fff;
  box-shadow: var(--shadow-paper);
}
.meta {
  padding: 12px 13px 5px;
}
.name {
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.size {
  font-size: 11px;
  margin-top: 2px;
}
.actions {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px 12px;
}
.action-main {
  min-height: 30px;
  padding-inline: 10px;
  font-weight: 650;
}
.actions .spacer {
  flex: 1;
}
.actions .link {
  border: none;
  background: transparent;
  padding: 6px;
  min-height: 28px;
  border-radius: 6px;
  color: var(--muted);
  cursor: pointer;
}
.actions .link:hover {
  background: var(--accent-wash);
  color: var(--accent);
}
.actions .link.danger:hover {
  background: var(--danger-soft);
  color: var(--danger);
}
.empty {
  padding: 44px;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius);
  background: rgba(255, 255, 255, 0.58);
  text-align: center;
}

@media (max-width: 720px) {
  .templates {
    padding: 16px;
  }
  .head {
    align-items: stretch;
    flex-wrap: wrap;
  }
  .count {
    order: 3;
  }
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
