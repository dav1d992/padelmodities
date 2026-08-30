import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PadelService } from '../../services/padel.service';
import { AdminService } from '../../services/admin.service';
import { I18nService } from '../../services/i18n.service';
import {
  DEFAULT_SKILLSET,
  SKILL_LABELS,
  SKILL_NAMES,
  type SkillName,
  type Skillset,
} from '../../models/padel.model';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-create-player',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './create-player.component.html',
  styleUrl: './create-player.component.scss',
})
export class CreatePlayerComponent implements OnInit {
  private service = inject(PadelService);
  private admin = inject(AdminService);
  private router = inject(Router);
  readonly i18n = inject(I18nService);

  readonly name = signal('');
  readonly shortname = signal('');
  readonly startingRating = signal(1000);
  readonly skills = signal<Skillset>({ ...DEFAULT_SKILLSET });
  readonly submitting = signal(false);
  readonly submitError = signal('');
  readonly skillNames = SKILL_NAMES;
  readonly skillLabels = SKILL_LABELS;

  ngOnInit(): void {
    if (!this.admin.isAdmin()) {
      this.router.navigate(['/']);
    }
  }

  updateSkill(skill: SkillName, rawValue: number): void {
    const nextValue = Math.max(0, Math.min(10, Math.round(rawValue)));
    this.skills.set({
      ...this.skills(),
      [skill]: nextValue,
    });
  }

  async createPlayer(): Promise<void> {
    if (!this.name().trim()) {
      this.submitError.set(this.i18n.t('err.nameRequired'));
      return;
    }
    if (this.shortname().trim() && !/^[a-z0-9_-]+$/i.test(this.shortname())) {
      this.submitError.set(this.i18n.t('err.shortnameChars'));
      return;
    }
    if (this.startingRating() < 0 || this.startingRating() > 9999) {
      this.submitError.set(this.i18n.t('err.ratingRange'));
      return;
    }
    this.submitting.set(true);
    this.submitError.set('');
    try {
      const id = await this.service.createPlayer(
        this.name(),
        this.shortname() || undefined,
        this.startingRating(),
        this.skills(),
      );
      this.router.navigate(['/player', id]);
    } catch (err) {
      this.submitError.set(
        err instanceof Error ? this.i18n.t(err.message) : this.i18n.t('common.error'),
      );
      this.submitting.set(false);
    }
  }
}
