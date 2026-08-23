import { Component, HostListener, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AudioService } from './services/audio.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  readonly audio = inject(AudioService);

  ngOnInit(): void {
    this.audio.startBackground();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent): void {
    // Retry background music on every click — browser may have blocked autoplay initially
    this.audio.startBackground();
    const el = (e.target as Element).closest('button, a, input, select, textarea, [role="button"]');
    if (el && !el.hasAttribute('disabled')) {
      this.audio.playClick();
    }
  }
}
