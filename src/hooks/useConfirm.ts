import { create } from 'zustand';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
}

interface ConfirmStore {
  isOpen: boolean;
  options: ConfirmOptions;
  resolve: ((value: boolean) => void) | null;
  openConfirm: (options: ConfirmOptions) => Promise<boolean>;
  handleConfirm: () => void;
  handleCancel: () => void;
}

export const useConfirmStore = create<ConfirmStore>((set, get) => ({
  isOpen: false,
  options: { title: '', message: '' },
  resolve: null,
  openConfirm: (options) =>
    new Promise<boolean>((resolve) => {
      set({ isOpen: true, options, resolve });
    }),
  handleConfirm: () => {
    get().resolve?.(true);
    set({ isOpen: false, resolve: null });
  },
  handleCancel: () => {
    get().resolve?.(false);
    set({ isOpen: false, resolve: null });
  },
}));

export function useConfirm() {
  return useConfirmStore((s) => s.openConfirm);
}
