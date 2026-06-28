<script setup lang="ts">
import { History, LayoutGrid, PenTool, Printer, Tag, Wifi } from 'lucide-vue-next';
import { setActiveView, state, type ViewName } from '../lib/store';

const tabs: { id: ViewName; label: string; icon: typeof PenTool }[] = [
  { id: 'templates', label: '模板', icon: LayoutGrid },
  { id: 'design', label: '设计', icon: PenTool },
  { id: 'print', label: '打印', icon: Printer },
  { id: 'history', label: '记录', icon: History },
];
</script>

<template>
  <aside class="topbar" aria-label="主导航">
    <div class="brand">
      <span class="brand-mark"><Tag :size="17" :stroke-width="2.2" /></span>
      <span class="brand-copy">
        <strong>LabelPrint</strong>
        <small>标签打印工作台</small>
      </span>
    </div>
    <nav class="tabs">
      <button
        v-for="t in tabs"
        :key="t.id"
        class="tab"
        :class="{ active: state.activeView === t.id }"
        @click="setActiveView(t.id)"
      >
        <component :is="t.icon" :size="15" :stroke-width="2" />
        <span>{{ t.label }}</span>
      </button>
    </nav>
    <div class="spacer"></div>
    <div class="status" :title="state.status">
      <Wifi :size="13" :stroke-width="2" />
      <span>{{ state.status || '待连接' }}</span>
    </div>
  </aside>
</template>

<style scoped>
.topbar {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 14px;
  width: 184px;
  padding: 14px 12px;
  background: rgba(255, 255, 255, 0.94);
  border-right: 1px solid var(--border);
  flex: none;
  min-width: 0;
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  flex: none;
  min-width: 0;
}
.brand-mark {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
  background: var(--accent-soft);
  border: 1px solid #c9dcff;
}
.brand-copy {
  display: flex;
  flex-direction: column;
  line-height: 1.05;
}
.brand-copy strong {
  font-size: 14px;
  font-weight: 750;
}
.brand-copy small {
  margin-top: 3px;
  font-size: 11px;
  color: var(--muted);
}
.tabs {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: transparent;
  padding: 0;
  border-radius: 0;
  border: none;
  min-width: 0;
}
.tab {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  gap: 9px;
  padding: 9px 10px;
  border: none;
  background: transparent;
  border-radius: 6px;
  color: var(--muted);
  cursor: pointer;
  min-height: 36px;
  white-space: nowrap;
  width: 100%;
  font-weight: 600;
}
.tab:hover {
  color: var(--text);
  background: var(--panel-subtle);
}
.tab.active {
  background: var(--accent-soft);
  color: var(--accent);
  box-shadow: inset 0 0 0 1px #c9dcff;
}
.spacer {
  flex: 1;
  min-width: 0;
}
.status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--muted);
  max-width: 360px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 8px 9px;
  border: 1px solid var(--border);
  background: var(--panel-subtle);
  border-radius: var(--radius);
  min-width: 0;
}
.status span {
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 760px) {
  .topbar {
    width: auto;
    flex-direction: column;
    gap: 9px;
    padding: 8px;
    border-right: none;
    border-bottom: 1px solid var(--border);
  }
  .brand {
    min-height: 28px;
  }
  .brand-copy small,
  .status {
    display: none;
  }
  .tabs {
    width: 100%;
    flex-direction: row;
    gap: 4px;
    padding: 3px;
    background: var(--panel-muted);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow-x: auto;
  }
  .tab {
    flex: 1;
    min-width: 0;
    justify-content: center;
    padding: 6px 8px;
    min-height: 32px;
    box-shadow: none;
  }
}
</style>
