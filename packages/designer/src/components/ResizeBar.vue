<script setup lang="ts">
import { setPanelWidth, state } from '../lib/store';

const props = defineProps<{ side: 'left' | 'right' }>();

let startX = 0;
let startW = 0;

function onMove(e: PointerEvent): void {
  const dx = e.clientX - startX;
  // left panel grows as you drag right; right panel grows as you drag left.
  const w = props.side === 'left' ? startW + dx : startW - dx;
  setPanelWidth(props.side, w);
}
function onUp(): void {
  window.removeEventListener('pointermove', onMove);
  window.removeEventListener('pointerup', onUp);
  document.body.style.cursor = '';
}
function onDown(e: PointerEvent): void {
  e.preventDefault();
  startX = e.clientX;
  startW = state.panels[props.side];
  document.body.style.cursor = 'col-resize';
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}
</script>

<template>
  <div class="resizer" @pointerdown="onDown"></div>
</template>

<style scoped>
.resizer {
  width: 6px;
  flex: none;
  cursor: col-resize;
  background: var(--panel-subtle);
  position: relative;
  z-index: 5;
}
.resizer::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 2px;
  height: 44px;
  transform: translate(-50%, -50%);
  background: var(--border-strong);
  border-radius: 999px;
}
.resizer:hover::after {
  background: var(--accent);
}
</style>
