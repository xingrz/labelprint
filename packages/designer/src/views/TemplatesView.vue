<script setup lang="ts">
import { Copy, Pencil, Plus, Printer, Trash2 } from 'lucide-vue-next';
import { compileToSvg, defaultMediaProfiles, type TemplateDoc } from '@labelprint/shared';
import { confirmDialog } from '../lib/confirm';
import { mediaTypeLabel, t } from '../lib/i18n';
import {
  createTemplate,
  duplicateTemplateById,
  openTemplate,
  removeTemplate,
  selectPrintTemplate,
  setActiveView,
  state,
} from '../lib/store';

function thumb(t: TemplateDoc): string {
  return compileToSvg(t, { values: t.defaults });
}
function mediaLabel(t: TemplateDoc): string {
  const m = t.media;
  return `${m.widthMm}×${m.heightMm} mm · ${mediaTypeLabel(m.type)}`;
}
function onNew(): void {
  createTemplate(defaultMediaProfiles()[0]!);
}
function onPrint(t: TemplateDoc): void {
  selectPrintTemplate(t.id);
  setActiveView('print');
}
async function onDelete(tmpl: TemplateDoc): Promise<void> {
  const ok = await confirmDialog({
    title: t('templates.deleteTitle', { name: tmpl.name }),
    message: t('templates.deleteMessage'),
    confirmText: t('common.delete'),
    danger: true,
  });
  if (ok) removeTemplate(tmpl.id);
}
</script>

<template>
  <div class="templates">
    <div class="head">
      <div>
        <h2>{{ t('templates.title') }}</h2>
        <p class="muted">{{ t('templates.description') }}</p>
      </div>
      <span class="count">{{ t('common.count.templates', { count: state.templates.length }) }}</span>
      <div class="spacer"></div>
      <button class="primary" @click="onNew"><Plus :size="15" /> {{ t('templates.new') }}</button>
    </div>

    <div v-if="state.templates.length" class="grid">
      <div v-for="tmpl in state.templates" :key="tmpl.id" class="card">
        <button class="thumb" :title="t('common.edit')" @click="openTemplate(tmpl.id)">
          <div class="thumb-inner" v-html="thumb(tmpl)"></div>
        </button>
        <div class="meta">
          <div class="name" :title="tmpl.name">{{ tmpl.name }}</div>
          <div class="size muted">{{ mediaLabel(tmpl) }}</div>
        </div>
        <div class="actions">
          <button class="primary action-main" @click="openTemplate(tmpl.id)"><Pencil :size="15" /> {{ t('common.design') }}</button>
          <button class="action-main" @click="onPrint(tmpl)"><Printer :size="15" /> {{ t('common.print') }}</button>
          <div class="spacer"></div>
          <button class="link" :title="t('common.copy')" @click="duplicateTemplateById(tmpl.id)"><Copy :size="15" /></button>
          <button class="link danger" :title="t('common.delete')" @click="onDelete(tmpl)"><Trash2 :size="15" /></button>
        </div>
      </div>
    </div>
    <p v-else class="muted empty">{{ t('templates.empty') }}</p>
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
  background: var(--panel);
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
  border-color: var(--border-strong);
  box-shadow: var(--shadow-panel);
  transform: translateY(-1px);
}
.thumb {
  border: none;
  border-radius: 0;
  background:
    linear-gradient(var(--canvas-grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--canvas-grid) 1px, transparent 1px),
    var(--canvas-bg);
  background-size: 18px 18px;
  padding: 18px;
  height: 148px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.thumb:hover {
  background-color: var(--panel-muted);
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
  background: var(--paper);
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
  background: var(--panel-subtle);
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
