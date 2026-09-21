import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  message: string;
  /** Text for the confirm button (defaults handled by the dialog). */
  confirmLabel?: string;
  /** Text for the cancel button (defaults handled by the dialog). */
  cancelLabel?: string;
  /** Style the confirm button as a destructive action. */
  danger?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

/** App-styled replacement for the native window.confirm dialog. */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly state = signal<ConfirmState | null>(null);

  ask(options: ConfirmOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.state.set({ ...options, resolve });
    });
  }

  confirm(): void {
    const s = this.state();
    if (!s) return;
    this.state.set(null);
    s.resolve(true);
  }

  cancel(): void {
    const s = this.state();
    if (!s) return;
    this.state.set(null);
    s.resolve(false);
  }
}
