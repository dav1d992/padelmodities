import { inject, Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import {
  RouterStateSnapshot,
  TitleStrategy,
} from '@angular/router';
import { effect } from '@angular/core';
import { I18nService } from './i18n.service';

/**
 * Treats each route's `title` as an i18n key and keeps the document title in
 * sync with the active language.
 */
@Injectable({ providedIn: 'root' })
export class I18nTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly i18n = inject(I18nService);
  private currentKey = '';

  constructor() {
    super();
    // Re-translate the current title whenever the language changes.
    effect(() => {
      this.i18n.lang();
      if (this.currentKey) this.title.setTitle(this.i18n.t(this.currentKey));
    });
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const key = this.buildTitle(snapshot);
    this.currentKey = key ?? '';
    this.title.setTitle(key ? this.i18n.t(key) : 'Danske Padelmodities');
  }
}
