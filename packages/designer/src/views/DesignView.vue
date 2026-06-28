<script setup lang="ts">
import { Grid3x3, Magnet, Plus, Save, ZoomIn, ZoomOut } from 'lucide-vue-next';
import { defaultMediaProfiles } from '@labelprint/shared';
import IconButton from '../components/IconButton.vue';
import Toolbar from '../components/Toolbar.vue';
import LabelCanvas from '../components/Canvas.vue';
import PropertyPanel from '../components/PropertyPanel.vue';
import ParamDefsPanel from '../components/ParamDefsPanel.vue';
import ResizeBar from '../components/ResizeBar.vue';
import { t } from '../lib/i18n';
import { newTemplate, save, state } from '../lib/store';

function onNew(): void {
  const m = state.mediaList[0] ?? defaultMediaProfiles()[0]!;
  newTemplate(m);
}
function onName(e: Event): void {
  if (state.doc) {
    state.doc.name = (e.target as HTMLInputElement).value;
    state.dirty = true;
  }
}
function zoom(d: number): void {
  state.view.pxPerMm = Math.max(3, Math.min(40, state.view.pxPerMm + d));
}
</script>

<template>
  <div class="design">
    <div class="subbar">
      <div class="template-name">
        <span class="label">{{ t('design.currentTemplate') }}</span>
        <input v-if="state.doc" class="name" :value="state.doc.name" @input="onName" :placeholder="t('design.templateName')" />
      </div>
      <div class="command-group">
        <IconButton :icon="Save" :label="t('design.save')" :disabled="!state.dirty" @click="save" />
        <span v-if="state.dirty" class="dirty" :title="t('design.unsaved')"><i></i> {{ t('design.unsaved') }}</span>
        <IconButton :icon="Plus" :label="t('design.new')" @click="onNew" />
      </div>
      <div class="spacer"></div>
      <div class="command-group">
        <IconButton :icon="ZoomOut" :label="t('design.zoomOut')" @click="zoom(-2)" />
        <span class="zoom mono">{{ state.view.pxPerMm }}px/mm</span>
        <IconButton :icon="ZoomIn" :label="t('design.zoomIn')" @click="zoom(2)" />
      </div>
      <div class="command-group">
        <IconButton :icon="Grid3x3" :label="t('design.showGrid')" :active="state.view.showGrid" @click="state.view.showGrid = !state.view.showGrid" />
        <IconButton :icon="Magnet" :label="t('design.snap')" :active="state.view.snap" @click="state.view.snap = !state.view.snap" />
        <label class="step"><span>{{ t('design.step') }}</span><input type="number" step="0.5" min="0" v-model.number="state.view.gridStep" /></label>
      </div>
    </div>

    <div class="workarea">
      <div class="panel left" :style="{ width: state.panels.left + 'px' }"><Toolbar /></div>
      <ResizeBar class="resize-left" side="left" />
      <LabelCanvas />
      <ResizeBar class="resize-right" side="right" />
      <div class="panel right" :style="{ width: state.panels.right + 'px' }">
        <PropertyPanel />
        <ParamDefsPanel />
      </div>
    </div>
  </div>
</template>

<style scoped>
.design {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
}
.subbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
  background: var(--panel-subtle);
  flex: none;
  min-width: 0;
}
.template-name {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 190px;
  max-width: 360px;
  flex: 0 1 320px;
}
.label {
  color: var(--muted);
  font-size: 12px;
  white-space: nowrap;
}
.name {
  min-width: 0;
  height: 30px;
  font-weight: 650;
}
.spacer {
  flex: 1;
  min-width: 0;
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
.dirty {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding-inline: 5px;
  color: var(--warn);
  font-size: 12px;
  white-space: nowrap;
}
.dirty i {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--warn);
  box-shadow: 0 0 0 3px var(--warn-soft);
}
.zoom {
  font-size: 11px;
  color: var(--muted);
  min-width: 56px;
  text-align: center;
}
.step {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--muted);
  padding-left: 4px;
}
.step input {
  width: 52px;
  height: 28px;
}
.workarea {
  flex: 1;
  display: grid;
  grid-template-columns: auto 6px minmax(0, 1fr) 6px auto;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}
.panel {
  flex: none;
  overflow-y: auto;
  min-height: 0;
  background: var(--panel);
  border-left: 1px solid var(--border);
  min-width: 0;
}
.panel.left {
  border-left: none;
  border-right: 1px solid var(--border);
}
/* right panel is a single scroll container; PropertyPanel + ParamDefsPanel flow inside */

@media (max-width: 860px) {
  .subbar {
    align-items: stretch;
    flex-wrap: wrap;
    gap: 8px;
  }
  .template-name {
    flex: 1 1 100%;
    max-width: none;
  }
  .command-group {
    flex: 0 0 auto;
  }
  .workarea {
    grid-template-columns: 70px minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) minmax(240px, 42vh);
  }
  .resize-left,
  .resize-right {
    display: none;
  }
  .panel.left {
    grid-column: 1;
    grid-row: 1;
    width: auto !important;
  }
  .panel.right {
    grid-column: 1 / -1;
    grid-row: 2;
    width: auto !important;
    border-left: none;
    border-top: 1px solid var(--border);
  }
  .canvas-wrap {
    grid-column: 2;
    grid-row: 1;
  }
}

@media (max-width: 520px) {
  .subbar {
    padding: 7px;
  }
  .label,
  .dirty {
    display: none;
  }
  .command-group {
    max-width: 100%;
  }
  .workarea {
    grid-template-columns: 64px minmax(0, 1fr);
  }
}
</style>
