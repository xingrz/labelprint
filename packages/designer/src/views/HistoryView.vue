<script setup lang="ts">
import { RefreshCw, RotateCcw, Trash2 } from 'lucide-vue-next';
import { clearHistory, deleteHistoryItem, loadHistory, reprintFrom, state } from '../lib/store';
import { confirmDialog } from '../lib/confirm';

async function onClear(): Promise<void> {
  const ok = await confirmDialog({
    title: '清空全部打印记录？',
    message: '将删除所有历史记录，不可撤销。',
    confirmText: '清空',
    danger: true,
  });
  if (ok) clearHistory();
}

function fmt(ts: string): string {
  try {
    return new Date(ts).toLocaleString('zh-CN', { hour12: false });
  } catch {
    return ts;
  }
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
        <h2>打印记录</h2>
        <p class="muted">查看近期任务状态，载入历史参数后可快速重打。</p>
      </div>
      <span class="count">{{ state.history.length }} 条</span>
      <div class="spacer"></div>
      <button @click="loadHistory"><RefreshCw :size="14" /> 刷新</button>
      <button class="danger" :disabled="!state.history.length" @click="onClear"><Trash2 :size="14" /> 清空</button>
    </div>

    <div class="tablewrap">
      <table v-if="state.history.length">
        <thead>
          <tr>
            <th>时间</th>
            <th>模板</th>
            <th>参数</th>
            <th class="num">份数</th>
            <th>打印机</th>
            <th>状态</th>
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
            <td><span class="badge" :class="h.ok ? 'ok' : 'err'">{{ h.ok ? '成功' : '失败' }}</span></td>
            <td class="ops nowrap">
              <button class="link" title="载入到打印页重打" @click="reprintFrom(h)"><RotateCcw :size="15" /></button>
              <button class="link danger" title="删除" @click="deleteHistoryItem(h.id)"><Trash2 :size="15" /></button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="state.history.length" class="cards">
        <article v-for="h in state.history" :key="'card-' + h.id" class="record-card">
          <div class="record-head">
            <span class="mono">{{ fmt(h.ts) }}</span>
            <span class="badge" :class="h.ok ? 'ok' : 'err'">{{ h.ok ? '成功' : '失败' }}</span>
          </div>
          <div class="record-title">{{ h.templateName }}</div>
          <div class="record-params mono">{{ summary(h.values) }}</div>
          <div class="record-meta">
            <span>{{ h.copies }} 份</span>
            <span>{{ h.printer }}</span>
          </div>
          <div class="record-ops">
            <button title="载入到打印页重打" @click="reprintFrom(h)"><RotateCcw :size="15" /> 重打</button>
            <button class="danger" title="删除" @click="deleteHistoryItem(h.id)"><Trash2 :size="15" /> 删除</button>
          </div>
        </article>
      </div>
      <p v-else class="muted empty">暂无打印记录。去「打印」页打一张试试。</p>
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
  background: #fff;
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
  border-color: #b6ebcb;
}
.badge.err {
  background: var(--danger-soft);
  color: var(--danger);
  border-color: #efb4b4;
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
    background: #fff;
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
