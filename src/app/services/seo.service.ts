import { DOCUMENT } from '@angular/common';
import { effect, inject, Injectable, signal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { I18nService } from './i18n.service';

export const SITE_URL = 'https://danskepadelmodities.com';
const SITE_NAME = 'Danske Padelmodities';

export interface SeoPage {
  /** i18n key or literal text. */
  readonly title: string;
  /** i18n key or literal text. */
  readonly description: string;
  readonly path: string;
  readonly noindex: boolean;
  readonly params?: Record<string, string | number>;
  readonly jsonLd?: Record<string, unknown>;
}

/** Keeps title, meta description, canonical, Open Graph and JSON-LD in sync with the active page and language. */
@Injectable({ providedIn: 'root' })
export class SeoService {
  readonly #title = inject(Title);
  readonly #meta = inject(Meta);
  readonly #document = inject(DOCUMENT);
  readonly #i18n = inject(I18nService);
  readonly #page = signal<SeoPage | null>(null);

  constructor() {
    effect(() => {
      const page = this.#page();
      if (page) this.apply(page);
    });
  }

  setPage(page: SeoPage): void {
    this.#page.set(page);
  }

  patchPage(patch: Partial<SeoPage>): void {
    this.#page.update((page) => (page ? { ...page, ...patch } : page));
  }

  private apply(page: SeoPage): void {
    const title = this.#i18n.t(page.title, page.params) || SITE_NAME;
    const description = this.#i18n.t(page.description, page.params);
    const url = SITE_URL + page.path;

    this.#title.setTitle(title);
    this.#meta.updateTag({ name: 'description', content: description });
    this.#meta.updateTag({
      name: 'robots',
      content: page.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large',
    });
    this.#meta.updateTag({ property: 'og:title', content: title });
    this.#meta.updateTag({ property: 'og:description', content: description });
    this.#meta.updateTag({ property: 'og:url', content: url });
    this.#meta.updateTag({
      property: 'og:locale',
      content: this.#i18n.lang() === 'da' ? 'da_DK' : 'en_GB',
    });
    this.#meta.updateTag({ name: 'twitter:title', content: title });
    this.#meta.updateTag({ name: 'twitter:description', content: description });

    const head = this.#document.head;
    const canonical =
      head.querySelector<HTMLLinkElement>('link[rel="canonical"]') ??
      head.appendChild(this.#document.createElement('link'));
    canonical.rel = 'canonical';
    canonical.href = url;

    const existingLd = head.querySelector('script#page-jsonld');
    if (!page.jsonLd) {
      existingLd?.remove();
      return;
    }
    const ld = existingLd ?? head.appendChild(this.#document.createElement('script'));
    ld.id = 'page-jsonld';
    ld.setAttribute('type', 'application/ld+json');
    ld.textContent = JSON.stringify({ '@context': 'https://schema.org', ...page.jsonLd });
  }
}
