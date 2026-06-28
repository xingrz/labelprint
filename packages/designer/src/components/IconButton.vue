<script setup lang="ts">
import type { Component } from 'vue';
import { TooltipArrow, TooltipContent, TooltipPortal, TooltipRoot, TooltipTrigger } from 'reka-ui';

defineProps<{
  icon: Component;
  label: string;
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
  size?: number;
}>();
defineEmits<{ (e: 'click'): void }>();
</script>

<template>
  <TooltipRoot :delay-duration="250">
    <TooltipTrigger as-child>
      <button
        type="button"
        class="ib"
        :class="{ active, danger }"
        :disabled="disabled"
        :aria-label="label"
        @click="$emit('click')"
      >
        <component :is="icon" :size="size ?? 17" :stroke-width="2" />
      </button>
    </TooltipTrigger>
    <TooltipPortal>
      <TooltipContent class="lp-tip" :side-offset="6">
        {{ label }}
        <TooltipArrow class="lp-tip-arrow" :width="8" :height="4" />
      </TooltipContent>
    </TooltipPortal>
  </TooltipRoot>
</template>

<style scoped>
.ib {
  width: 32px;
  height: 32px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text);
  background: #fff;
  border: 1px solid var(--border);
  border-radius: 6px;
  min-height: 32px;
}
.ib:hover:not(:disabled) {
  border-color: var(--accent);
  background: var(--accent-wash);
  color: var(--accent);
}
.ib.active {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent);
}
.ib.danger:hover:not(:disabled) {
  border-color: var(--danger);
  color: var(--danger);
}
.ib:disabled {
  opacity: 0.42;
  cursor: not-allowed;
  background: var(--panel-subtle);
}
</style>

<style>
.lp-tip {
  background: #1f2430;
  color: #fff;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 6px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
  z-index: 100;
  user-select: none;
}
.lp-tip-arrow {
  fill: #1f2430;
}
</style>
