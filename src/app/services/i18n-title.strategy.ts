import { inject, Injectable } from '@angular/core';
import { TitleStrategy, type RouterStateSnapshot } from '@angular/router';
import { SeoService } from './seo.service';

/**
 * Treats each route's `title` (and `data.description`) as i18n keys and hands
 * them to `SeoService`, which keeps them in sync with the active language.
 * Routes with `data: { noindex: true }` are hidden from search engines.
 */
@Injectable({ providedIn: 'root' })
export class I18nTitleStrategy extends TitleStrategy {
  readonly #seo = inject(SeoService);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    let route = snapshot.root;
    while (route.firstChild) route = route.firstChild;
    const description = route.data['description'];

    this.#seo.setPage({
      title: this.buildTitle(snapshot) ?? '',
      description: typeof description === 'string' ? description : 'meta.default',
      path: snapshot.url.split(/[?#]/)[0] ?? '/',
      noindex: route.data['noindex'] === true,
    });
  }
}
