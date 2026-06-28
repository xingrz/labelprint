<script setup lang="ts">
import { History, Languages, LayoutGrid, Moon, PenTool, Printer, Tag, Wifi } from 'lucide-vue-next';
import { computed } from 'vue';
import { i18nState, setLocaleChoice, t, type LocaleChoice } from '../lib/i18n';
import { setThemeChoice, themeState, type ThemeChoice } from '../lib/theme';
import { setActiveView, state, type ViewName } from '../lib/store';

const tabs = computed<{ id: ViewName; label: string; icon: typeof PenTool }[]>(() => [
  { id: 'templates', label: t('nav.templates'), icon: LayoutGrid },
  { id: 'design', label: t('nav.design'), icon: PenTool },
  { id: 'print', label: t('nav.print'), icon: Printer },
  { id: 'history', label: t('nav.history'), icon: History },
]);

function onLocale(e: Event): void {
  setLocaleChoice((e.target as HTMLSelectElement).value as LocaleChoice);
}

function onTheme(e: Event): void {
  setThemeChoice((e.target as HTMLSelectElement).value as ThemeChoice);
}
</script>

<template>
  <aside class="topbar" :aria-label="t('nav.aria')">
    <div class="brand">
      <span class="brand-mark"><Tag :size="17" :stroke-width="2.2" /></span>
      <span class="brand-copy">
        <strong>LabelPrint</strong>
        <small>{{ t('app.subtitle') }}</small>
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
    <div class="settings">
      <label class="pref" :title="t('prefs.language')">
        <Languages :size="13" :stroke-width="2" />
        <select :value="i18nState.localeChoice" :aria-label="t('prefs.language')" @change="onLocale">
          <option value="auto">{{ t('prefs.language.auto') }}</option>
          <option value="zh-CN">{{ t('prefs.language.zh') }}</option>
          <option value="en">{{ t('prefs.language.en') }}</option>
        </select>
      </label>
      <label class="pref" :title="t('prefs.theme')">
        <Moon :size="13" :stroke-width="2" />
        <select :value="themeState.themeChoice" :aria-label="t('prefs.theme')" @change="onTheme">
          <option value="auto">{{ t('prefs.theme.auto') }}</option>
          <option value="light">{{ t('prefs.theme.light') }}</option>
          <option value="dark">{{ t('prefs.theme.dark') }}</option>
        </select>
      </label>
    </div>
    <div class="status" :title="state.status">
      <Wifi :size="13" :stroke-width="2" />
      <span>{{ state.status || t('nav.disconnected') }}</span>
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
  background: var(--panel);
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
  border: 1px solid var(--accent-border);
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
  box-shadow: inset 0 0 0 1px var(--accent-border);
}
.spacer {
  flex: 1;
  min-width: 0;
}
.settings {
  display: grid;
  gap: 6px;
}
.pref {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  align-items: center;
  gap: 6px;
  color: var(--muted);
}
.pref select {
  height: 30px;
  min-height: 30px;
  padding: 4px 7px;
  font-size: 12px;
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
  .settings {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .pref {
    grid-template-columns: 16px minmax(0, 1fr);
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
