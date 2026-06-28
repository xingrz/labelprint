import { reactive } from 'vue';
import { t } from './i18n';

/**
 * Imperative confirm dialog: `if (await confirmDialog({...})) { ... }`.
 * A single <ConfirmHost> (mounted in App) renders the reka-ui AlertDialog bound to
 * this state. resolveConfirm is idempotent (first call wins) so button click and the
 * dialog's own close event can't double-resolve.
 */
interface ConfirmState {
  open: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  danger: boolean;
  resolver: ((v: boolean) => void) | null;
}

export const confirmState = reactive<ConfirmState>({
  open: false,
  title: '',
  message: '',
  confirmText: t('confirm.ok'),
  cancelText: t('confirm.cancel'),
  danger: false,
  resolver: null,
});

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  confirmState.title = opts.title;
  confirmState.message = opts.message ?? '';
  confirmState.confirmText = opts.confirmText ?? t('confirm.ok');
  confirmState.cancelText = opts.cancelText ?? t('confirm.cancel');
  confirmState.danger = opts.danger ?? false;
  confirmState.open = true;
  return new Promise<boolean>((resolve) => {
    confirmState.resolver = resolve;
  });
}

export function resolveConfirm(value: boolean): void {
  if (!confirmState.resolver) return;
  const r = confirmState.resolver;
  confirmState.resolver = null;
  confirmState.open = false;
  r(value);
}
