import { Directive, ElementRef, HostListener, inject } from '@angular/core';

/** Swaps a broken player photo for the shared anonymous portrait. */
@Directive({
  selector: 'img[appImgFallback]',
  standalone: true,
})
export class ImgFallbackDirective {
  private static readonly FALLBACK = '/assets/anonimous-padel.png';

  private readonly element = inject<ElementRef<HTMLImageElement>>(ElementRef);

  @HostListener('error')
  onError(): void {
    const image = this.element.nativeElement;
    if (image.src.endsWith('anonimous-padel.png')) return;
    image.src = ImgFallbackDirective.FALLBACK;
  }
}
