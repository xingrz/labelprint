<script setup lang="ts">
import { ref } from 'vue';
import { ChevronDown, ChevronRight } from 'lucide-vue-next';
import { t } from '../lib/i18n';
import { setParamDefault, setParamLabel, setParamMultiline, state, usedParams } from '../lib/store';

const open = ref(true);

// Literal "{{ }}" can't appear raw in a Vue template — build the token in script.
const token = (k: string): string => `{{${k}}}`;
const PH = '{{param}}';

function defOf(key: string) {
  return state.doc?.params.find((p) => p.key === key);
}
function currentDefault(key: string): string {
  return defOf(key)?.default ?? state.doc?.defaults?.[key] ?? '';
}
</script>

<template>
  <div class="section paramdefs">
    <button class="hdr" type="button" @click="open = !open">
      <component :is="open ? ChevronDown : ChevronRight" :size="14" />
      <span class="ttl">{{ t('params.title') }}</span>
      <span v-if="usedParams.length" class="cnt">{{ usedParams.length }}</span>
    </button>

    <div v-show="open" class="body">
      <p v-if="!usedParams.length" class="muted">{{ t('params.empty', { placeholder: PH }) }}</p>
      <div v-for="k in usedParams" :key="k" class="pdef">
        <div class="pdef-head">
          <code class="key">{{ token(k) }}</code>
          <label class="ml">
            <input
              type="checkbox"
              :checked="!!defOf(k)?.multiline"
              @change="setParamMultiline(k, ($event.target as HTMLInputElement).checked)"
            />
            {{ t('params.multiline') }}
          </label>
        </div>
        <input
          class="lbl"
          :value="defOf(k)?.label ?? ''"
          :placeholder="t('params.labelPlaceholder')"
          @input="setParamLabel(k, ($event.target as HTMLInputElement).value)"
        />
        <textarea
          v-if="defOf(k)?.multiline"
          rows="2"
          :value="currentDefault(k)"
          :placeholder="t('params.defaultMultilinePlaceholder')"
          @input="setParamDefault(k, ($event.target as HTMLTextAreaElement).value)"
        ></textarea>
        <input
          v-else
          :value="currentDefault(k)"
          :placeholder="t('params.defaultPlaceholder')"
          @input="setParamDefault(k, ($event.target as HTMLInputElement).value)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.hdr {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  border: none;
  background: transparent;
  padding: 0;
  cursor: pointer;
  color: var(--muted);
  min-height: 26px;
  justify-content: flex-start;
}
.ttl {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 700;
}
.cnt {
  font-size: 11px;
  background: var(--accent-soft);
  color: var(--accent);
  border-radius: 9px;
  padding: 0 6px;
}
.body {
  margin-top: 10px;
}
.pdef {
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 9px;
  background: var(--panel-subtle);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}
.pdef-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.key {
  display: inline-block;
  font-size: 11px;
  color: var(--accent);
  background: var(--accent-soft);
  border: 1px solid var(--accent-border);
  border-radius: 5px;
  padding: 2px 6px;
}
.ml {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--muted);
  white-space: nowrap;
  flex: none;
}
textarea {
  resize: vertical;
  min-height: 38px;
}
</style>
