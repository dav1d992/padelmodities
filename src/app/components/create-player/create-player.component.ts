import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PadelService } from '../../services/padel.service';
import { CREATE_PLAYER_CODE } from '../../models/padel.model';
import { CommonModule } from '@angular/common';

type Step = 'code' | 'form';

@Component({
  selector: 'app-create-player',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './create-player.component.html',
  styleUrl: './create-player.component.scss',
})
export class CreatePlayerComponent {
  private service = inject(PadelService);
  private router = inject(Router);

  readonly step = signal<Step>('code');
  readonly codeInput = signal('');
  readonly codeError = signal('');

  readonly name = signal('');
  readonly shortname = signal('');
  readonly startingRating = signal(1000);
  readonly submitting = signal(false);
  readonly submitError = signal('');

  verifyCode(): void {
    if (this.codeInput().trim().toUpperCase() === CREATE_PLAYER_CODE) {
      this.step.set('form');
      this.codeError.set('');
    } else {
      this.codeError.set('Forkert kode. Prøv igen.');
    }
  }

  async createPlayer(): Promise<void> {
    if (!this.name().trim()) {
      this.submitError.set('Navn er påkrævet.');
      return;
    }
    if (this.shortname().trim() && !/^[a-z0-9_-]+$/i.test(this.shortname())) {
      this.submitError.set('Kortnavn må kun indeholde bogstaver, tal, - og _.');
      return;
    }
    if (this.startingRating() < 0 || this.startingRating() > 9999) {
      this.submitError.set('Rating skal være mellem 0 og 9999.');
      return;
    }
    this.submitting.set(true);
    this.submitError.set('');
    try {
      const id = await this.service.createPlayer(
        this.name(),
        this.shortname() || undefined,
        this.startingRating(),
      );
      this.router.navigate(['/player', id]);
    } catch (err) {
      this.submitError.set(
        err instanceof Error ? err.message : 'Noget gik galt.',
      );
      this.submitting.set(false);
    }
  }
}
