import { Component, inject } from '@angular/core';
import { ConfirmService } from '../../services/confirm.service';
import { I18nService } from '../../services/i18n.service';

/** Renders the app-styled confirmation dialog driven by ConfirmService. */
@Component({
  selector: 'app-confirm-dialog',
  template: `
    @if (confirm.state(); as s) {
      <div class="confirm-backdrop" (click)="confirm.cancel()">
        <div
          class="confirm-dialog glass"
          role="alertdialog"
          aria-modal="true"
          (click)="$event.stopPropagation()"
        >
          <p class="confirm-message">{{ s.message }}</p>
          <div class="confirm-actions">
            <button class="btn btn-ghost" (click)="confirm.cancel()">
              {{ s.cancelLabel || i18n.t('common.cancel') }}
            </button>
            <button
              class="btn"
              [class.btn-danger]="s.danger"
              [class.btn-primary]="!s.danger"
              (click)="confirm.confirm()"
            >
              {{ s.confirmLabel || i18n.t('common.confirm') }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .confirm-backdrop {
        position: fixed;
        inset: 0;
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.25rem;
        background: rgba(4, 7, 14, 0.68);
        backdrop-filter: blur(4px);
        animation: confirm-fade 0.15s ease;
      }

      .confirm-dialog {
        width: 100%;
        max-width: 380px;
        padding: 1.4rem 1.4rem 1.15rem;
        border-radius: var(--radius);
        background: var(--card);
        border: 1.5px solid var(--border);
        box-shadow: var(--shadow);
        animation: confirm-pop 0.16s ease;
      }

      .confirm-message {
        margin: 0 0 1.2rem;
        font-size: 1rem;
        line-height: 1.5;
        color: var(--text);
      }

      .confirm-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.6rem;
      }

      @keyframes confirm-fade {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes confirm-pop {
        from { opacity: 0; transform: translateY(8px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
    `,
  ],
})
export class ConfirmDialogComponent {
  readonly confirm = inject(ConfirmService);
  readonly i18n = inject(I18nService);
}
