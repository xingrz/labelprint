<script setup lang="ts">
import { RefreshCw, RotateCcw, Trash2 } from 'lucide-vue-next';
import { clearHistory, deleteHistoryItem, loadHistory, reprintFrom, state } from '../lib/store';
import { confirmDialog } from '../lib/confirm';
import { formatDateTime, t } from '../lib/i18n';

async function onClear(): Promise<void> {
  const ok = await confirmDialog({
    title: t('history.clearTitle'),
    message: t('history.clearMessage'),
    confirmText: t('common.clear'),
    danger: true,
  });
  if (ok) clearHistory();
}

function fmt(ts: string): string {
  return formatDateTime(ts);
}
function summary(v: Record<string, string>): string {
  const e = Object.entries(v);
  return e.length ? e.map(([k, val]) => `${k}=${val}`).join('  ') : '—';
}
</script>

<template>
  <div class="history">
    <div class="hbar">
      <div>
        <h2>{{ t('history.title') }}</h2>
        <p class="muted">{{ t('history.description') }}</p>
      </div>
      <span class="count">{{ t('common.count.records', { count: state.history.length }) }}</span>
      <div class="spacer"></div>
      <button @click="loadHistory"><RefreshCw :size="14" /> {{ t('common.refresh') }}</button>
      <button class="danger" :disabled="!state.history.length" @click="onClear"><Trash2 :size="14" /> {{ t('common.clear') }}</button>
    </div>

    <div class="tablewrap">
      <table v-if="state.history.length">
        <thead>
          <tr>
            <th>{{ t('history.time') }}</th>
            <th>{{ t('history.template') }}</th>
            <th>{{ t('history.params') }}</th>
            <th class="num">{{ t('history.copies') }}</th>
            <th>{{ t('history.printer') }}</th>
            <th>{{ t('history.status') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="h in state.history" :key="h.id">
            <td class="mono nowrap">{{ fmt(h.ts) }}</td>
            <td>{{ h.templateName }}</td>
            <td class="params mono">{{ summary(h.values) }}</td>
            <td class="num">{{ h.copies }}</td>
            <td class="nowrap">{{ h.printer }}</td>
            <td><span class="badge" :class="h.ok ? 'ok' : 'err'">{{ h.ok ? t('common.success') : t('common.failed') }}</span></td>
            <td class="ops nowrap">
              <button class="link" :title="t('history.reprintTitle')" @click="reprintFrom(h)"><RotateCcw :size="15" /></button>
              <button class="link danger" :title="t('common.delete')" @click="deleteHistoryItem(h.id)"><Trash2 :size="15" /></button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="state.history.length" class="cards">
        <article v-for="h in state.history" :key="'card-' + h.id" class="record-card">
          <div class="record-head">
            <span class="mono">{{ fmt(h.ts) }}</span>
            <span class="badge" :class="h.ok ? 'ok' : 'err'">{{ h.ok ? t('common.success') : t('common.failed') }}</span>
          </div>
          <div class="record-title">{{ h.templateName }}</div>
          <div class="record-params mono">{{ summary(h.values) }}</div>
          <div class="record-meta">
            <span>{{ t('history.copySuffix', { count: h.copies }) }}</span>
            <span>{{ h.printer }}</span>
          </div>
          <div class="record-ops">
            <button :title="t('history.reprintTitle')" @click="reprintFrom(h)"><RotateCcw :size="15" /> {{ t('history.reprint') }}</button>
            <button class="danger" :title="t('common.delete')" @click="deleteHistoryItem(h.id)"><Trash2 :size="15" /> {{ t('common.delete') }}</button>
          </div>
        </article>
      </div>
      <p v-else class="muted empty">{{ t('history.empty') }}</p>
    </div>
  </div>
</template>

<style scoped>
.history {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 22px 24px;
  overflow: hidden;
}
.hbar {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 18px;
  flex: none;
}
.hbar h2 {
  margin: 0;
  font-size: 20px;
  line-height: 1.2;
}
.hbar p {
  margin: 5px 0 0;
}
.hbar button {
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
  min-width: 0;
}
.tablewrap {
  flex: 1;
  overflow: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--panel);
  box-shadow: 0 1px 2px rgba(24, 32, 51, 0.04);
}
.cards {
  display: none;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
}
th,
td {
  text-align: left;
  padding: 9px 12px;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}
th {
  position: sticky;
  top: 0;
  background: var(--panel-subtle);
  color: var(--muted);
  font-weight: 600;
  z-index: 1;
}
.num {
  text-align: right;
  width: 56px;
}
.nowrap {
  white-space: nowrap;
}
.params {
  color: var(--muted);
  max-width: 360px;
}
.badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid transparent;
}
.badge.ok {
  background: var(--ok-soft);
  color: var(--ok);
  border-color: var(--ok-border);
}
.badge.err {
  background: var(--danger-soft);
  color: var(--danger);
  border-color: var(--danger-border);
}
.ops {
  text-align: right;
}
.link {
  border: none;
  background: transparent;
  padding: 3px;
  color: var(--muted);
  cursor: pointer;
}
.link:hover {
  background: var(--accent-wash);
  color: var(--accent);
}
.link.danger:hover {
  background: var(--danger-soft);
  color: var(--danger);
}
.empty {
  margin: 18px;
  padding: 34px;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius);
  background: var(--panel-subtle);
  text-align: center;
}
.danger {
  color: var(--danger);
}

@media (max-width: 720px) {
  .history {
    padding: 16px;
    overflow: auto;
  }
  .hbar {
    align-items: stretch;
    flex-wrap: wrap;
  }
  .tablewrap {
    min-height: 0;
    border: none;
    background: transparent;
    box-shadow: none;
    overflow: visible;
  }
  table {
    display: none;
  }
  .cards {
    display: grid;
    gap: 10px;
  }
  .record-card {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 12px;
    box-shadow: 0 1px 2px rgba(24, 32, 51, 0.04);
  }
  .record-head,
  .record-meta,
  .record-ops {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .record-head {
    justify-content: space-between;
    color: var(--text-soft);
    font-size: 12px;
  }
  .record-title {
    margin-top: 8px;
    font-weight: 700;
  }
  .record-params {
    margin-top: 6px;
    color: var(--muted);
    word-break: break-word;
  }
  .record-meta {
    margin-top: 8px;
    color: var(--text-soft);
    font-size: 12px;
    flex-wrap: wrap;
  }
  .record-ops {
    margin-top: 10px;
  }
  .record-ops button {
    flex: 1;
  }
}
</style>
