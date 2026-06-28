<script setup lang="ts">
import {
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle,
} from 'reka-ui';
import { confirmState, resolveConfirm } from '../lib/confirm';

// Plain buttons (not AlertDialogAction/Cancel): those auto-close the dialog, whose
// update:open(false) raced our @click and resolved the promise as `false` (cancel).
// Here resolveConfirm() consumes the resolver first, so the close cascade is a no-op.
function onOpenChange(open: boolean): void {
  if (!open) resolveConfirm(false); // esc / overlay -> cancel (idempotent)
}
</script>

<template>
  <AlertDialogRoot :open="confirmState.open" @update:open="onOpenChange">
    <AlertDialogPortal>
      <AlertDialogOverlay class="lp-overlay" />
      <AlertDialogContent class="lp-confirm">
        <AlertDialogTitle class="lp-confirm-title">{{ confirmState.title }}</AlertDialogTitle>
        <AlertDialogDescription v-if="confirmState.message" class="lp-confirm-msg">
          {{ confirmState.message }}
        </AlertDialogDescription>
        <div class="lp-confirm-btns">
          <button type="button" class="lp-cbtn" @click="resolveConfirm(false)">
            {{ confirmState.cancelText }}
          </button>
          <button type="button" class="lp-cbtn" :class="confirmState.danger ? 'danger' : 'primary'" @click="resolveConfirm(true)">
            {{ confirmState.confirmText }}
          </button>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>

<style>
.lp-confirm {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.34);
  z-index: 101;
  width: 340px;
  max-width: 92vw;
  padding: 20px;
}
.lp-confirm-title {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 700;
}
.lp-confirm-msg {
  margin: 0 0 16px;
  font-size: 13px;
  color: var(--muted);
}
.lp-confirm-btns {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.lp-cbtn {
  font: inherit;
  padding: 6px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-strong);
  background: var(--field);
  cursor: pointer;
}
.lp-cbtn.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}
.lp-cbtn.danger {
  background: var(--danger);
  border-color: var(--danger);
  color: #fff;
}
</style>
