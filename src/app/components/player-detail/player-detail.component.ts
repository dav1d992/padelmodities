import {
  Component,
  computed,
  ElementRef,
  inject,
  input,
  OnDestroy,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { PadelService } from '../../services/padel.service';
import { AudioService } from '../../services/audio.service';
import { AdminService } from '../../services/admin.service';
import { I18nService } from '../../services/i18n.service';
import {
  DEFAULT_SKILLSET,
  SKILL_LABELS,
  type Player,
  type SkillName,
  type Skillset,
} from '../../models/padel.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

/** Total length of the hero drop→land→shake animation. */
const HERO_DURATION_MS = 1050;
/** Moment (ms into the hero animation) the portrait "lands" and the slam sound fires. */
const IMPACT_MS = 500;

const DUST_PARTICLES = [
  { id: 0,  x: '0%',   top: '18%', driftX: '-28px', fallY: '65px', size: '8px',  delay: '0ms',  color: 'hsl(35,45%,55%)' },
  { id: 1,  x: '1%',   top: '33%', driftX: '-20px', fallY: '50px', size: '5px',  delay: '40ms', color: 'hsl(30,40%,48%)' },
  { id: 2,  x: '0%',   top: '50%', driftX: '-36px', fallY: '72px', size: '7px',  delay: '20ms', color: 'hsl(40,50%,60%)' },
  { id: 3,  x: '1%',   top: '66%', driftX: '-24px', fallY: '58px', size: '9px',  delay: '55ms', color: 'hsl(33,42%,52%)' },
  { id: 4,  x: '0%',   top: '80%', driftX: '-16px', fallY: '42px', size: '4px',  delay: '15ms', color: 'hsl(38,48%,58%)' },
  { id: 5,  x: '98%',  top: '18%', driftX: '28px',  fallY: '65px', size: '8px',  delay: '0ms',  color: 'hsl(35,45%,55%)' },
  { id: 6,  x: '97%',  top: '33%', driftX: '20px',  fallY: '50px', size: '5px',  delay: '40ms', color: 'hsl(30,40%,48%)' },
  { id: 7,  x: '98%',  top: '50%', driftX: '36px',  fallY: '72px', size: '7px',  delay: '20ms', color: 'hsl(40,50%,60%)' },
  { id: 8,  x: '97%',  top: '66%', driftX: '24px',  fallY: '58px', size: '9px',  delay: '55ms', color: 'hsl(33,42%,52%)' },
  { id: 9,  x: '98%',  top: '80%', driftX: '16px',  fallY: '42px', size: '4px',  delay: '15ms', color: 'hsl(38,48%,58%)' },
  { id: 10, x: '25%',  top: '96%', driftX: '-12px', fallY: '30px', size: '6px',  delay: '30ms', color: 'hsl(36,44%,54%)' },
  { id: 11, x: '50%',  top: '97%', driftX: '5px',   fallY: '28px', size: '5px',  delay: '10ms', color: 'hsl(32,41%,50%)' },
  { id: 12, x: '75%',  top: '96%', driftX: '14px',  fallY: '32px', size: '7px',  delay: '45ms', color: 'hsl(39,47%,57%)' },
];

@Component({
  selector: 'app-player-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './player-detail.component.html',
  styleUrl: './player-detail.component.scss',
})
export class PlayerDetailComponent implements OnInit, OnDestroy {
  readonly playerId = input.required<string>();

  private service = inject(PadelService);
  private router = inject(Router);
  readonly audioSvc = inject(AudioService);
  readonly admin = inject(AdminService);
  readonly i18n = inject(I18nService);

  readonly player = signal<Player | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly visibleSkillIndex = signal(-1);
  readonly skillLabels = SKILL_LABELS;
  readonly skillNames = Object.keys(SKILL_LABELS) as SkillName[];

  /** The portrait (or placeholder) element that gets the drop-in animation. */
  @ViewChild('heroEl') private heroEl?: ElementRef<HTMLElement>;

  // ── Admin edit state ──────────────────────────────────────────────────────
  readonly editing = signal(false);
  readonly saving = signal(false);
  readonly editError = signal('');
  readonly editName = signal('');
  readonly editShortname = signal('');
  readonly editRating = signal(1000);
  readonly editSkills = signal<Skillset>({ ...DEFAULT_SKILLSET });
  readonly editMatchesPlayed = signal(0);
  readonly editWins = signal(0);
  readonly editLosses = signal(0);
  readonly editPointsFor = signal(0);
  readonly editPointsAgainst = signal(0);

  private sub?: Subscription;
  private animationStarted = false;
  private imageAnimBegun = false;
  private timers: ReturnType<typeof setTimeout>[] = [];

  ngOnInit(): void {
    this.audioSvc.startBackground();
    this.sub = this.service.watchPlayer(this.playerId()).subscribe({
      next: (p) => {
        this.player.set(p);
        this.loading.set(false);
        if (!p) { this.router.navigate(['/']); return; }
        if (!this.animationStarted) {
          this.animationStarted = true;
          this.startAnimation(!!p.shortname);
        }
      },
      error: (err) => {
        this.error.set(err?.message ? this.i18n.t(err.message) : this.i18n.t('err.loadPlayer'));
        this.loading.set(false);
      },
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.timers.forEach(clearTimeout);
  }

  private startAnimation(hasImage: boolean): void {
    if (!hasImage) {
      // No portrait to wait on — animate the placeholder once it's rendered.
      requestAnimationFrame(() => this.runHeroAnimation(this.heroEl?.nativeElement, false));
      return;
    }
    // The image's (load) event drives the animation so its decode never stalls
    // the drop on slow phones. This fallback covers a missed/cached load event.
    const fallback = setTimeout(
      () => this.runHeroAnimation(this.heroEl?.nativeElement, true),
      700,
    );
    this.timers.push(fallback);
  }

  onImageLoaded(event: Event): void {
    this.runHeroAnimation(event.target as HTMLElement, true);
  }

  /**
   * Runs the whole fall→land→shake as a single Web Animations API animation on
   * the real DOM element. This bypasses Angular change detection, class-toggle
   * timing races and phase-skipping, and runs transforms on the compositor, so
   * it plays reliably on every device.
   */
  private runHeroAnimation(el: HTMLElement | null | undefined, hasImage: boolean): void {
    if (this.imageAnimBegun) return;
    this.imageAnimBegun = true;

    if (!el) {
      this.startSkillBarSequence();
      return;
    }

    if (typeof el.animate !== 'function') {
      // Ancient browser without WAAPI: just reveal the portrait.
      el.style.transform = 'none';
      this.startSkillBarSequence();
      return;
    }

    const phone =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(max-width: 640px)').matches;
    const off = phone ? 'translateY(-115%)' : 'translateX(-110%)';
    const j = (px: number) => (phone ? `translateY(${px}px)` : `translateX(${px}px)`);

    const keyframes: Keyframe[] = [
      { offset: 0, transform: off, easing: 'cubic-bezier(0.5,0,0.85,0.4)' },
      { offset: 0.48, transform: 'translate3d(0,0,0)', easing: 'cubic-bezier(0.3,0,0.2,1)' },
      { offset: 0.58, transform: `${j(-8)} rotate(-1.3deg)` },
      { offset: 0.70, transform: `${j(5)} rotate(1deg)` },
      { offset: 0.80, transform: `${j(-4)} rotate(-0.6deg)` },
      { offset: 0.90, transform: `${j(2)} rotate(0.3deg)` },
      { offset: 1, transform: 'translate3d(0,0,0) rotate(0deg)' },
    ];

    const anim = el.animate(keyframes, { duration: HERO_DURATION_MS, fill: 'forwards' });
    // Persist the resting position even after the animation is discarded.
    anim.onfinish = () => { el.style.transform = 'translate3d(0,0,0)'; };

    if (hasImage) {
      const slam = setTimeout(
        () => this.audioSvc.playOneShot('/assets/sounds-effects/gate-slam.mp3', 0.9),
        IMPACT_MS,
      );
      this.timers.push(slam);
    }
    this.startSkillBarSequence();
  }

  private startSkillBarSequence(): void {
    this.visibleSkillIndex.set(-1);
    const startAfterMs = 1300;
    const barAnimationMs = 500;
    const staggerMs = barAnimationMs;

    this.skillNames.forEach((_, index) => {
      const timer = setTimeout(() => {
        this.visibleSkillIndex.set(index);
        this.audioSvc.playOneShot('/assets/sounds-effects/scifi.mp3', 0.3, barAnimationMs);
      }, startAfterMs + index * staggerMs);
      this.timers.push(timer);
    });
  }

  readonly imagePath = computed(() => {
    const sn = this.player()?.shortname;
    return sn ? `/assets/${sn}-padel.png` : null;
  });

  readonly winRate = computed(() => {
    const p = this.player();
    if (!p || p.matchesPlayed === 0) return null;
    return Math.round((p.wins / p.matchesPlayed) * 100);
  });

  readonly skillBars = computed(() => {
    const skillset = this.player()?.skillset ?? DEFAULT_SKILLSET;
    return this.skillNames.map((skill) => ({
      key: skill,
      label: this.skillLabels[skill],
      value: skillset[skill],
      scale: skillset[skill] / 10,
    }));
  });

  readonly ratingHistory = computed(() => {
    const hist = this.player()?.ratingHistory;
    if (!hist) return [];
    return Object.entries(hist)
      .sort(([a], [b]) => Number(a.split('_')[0]) - Number(b.split('_')[0]))
      .map(([, v]) => v as number);
  });

  readonly sparkPath = computed(() => {
    const hist = this.ratingHistory();
    if (hist.length < 2) return '';
    const W = 200, H = 48;
    const min = Math.min(...hist), max = Math.max(...hist), range = max - min || 1;
    const pts = hist.map((v, i) => `${(i / (hist.length - 1)) * W},${H - ((v - min) / range) * H}`);
    return `M ${pts.join(' L ')}`;
  });

  // ── Admin edit ─────────────────────────────────────────────────────────────

  startEdit(): void {
    const p = this.player();
    if (!p) return;
    this.editName.set(p.name);
    this.editShortname.set(p.shortname ?? '');
    this.editRating.set(p.rating);
    this.editSkills.set({ ...DEFAULT_SKILLSET, ...p.skillset });
    this.editMatchesPlayed.set(p.matchesPlayed);
    this.editWins.set(p.wins);
    this.editLosses.set(p.losses);
    this.editPointsFor.set(p.pointsFor);
    this.editPointsAgainst.set(p.pointsAgainst);
    this.editError.set('');
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.editing.set(false);
    this.editError.set('');
  }

  updateEditSkill(skill: SkillName, rawValue: number): void {
    const nextValue = Math.max(0, Math.min(10, Math.round(rawValue)));
    this.editSkills.set({ ...this.editSkills(), [skill]: nextValue });
  }

  async saveEdit(): Promise<void> {
    const p = this.player();
    if (!p) return;
    if (!this.editName().trim()) {
      this.editError.set(this.i18n.t('err.nameRequired'));
      return;
    }
    if (this.editShortname().trim() && !/^[a-z0-9_-]+$/i.test(this.editShortname())) {
      this.editError.set(this.i18n.t('err.shortnameChars'));
      return;
    }
    this.saving.set(true);
    this.editError.set('');
    try {
      await this.service.updatePlayer(p.id, {
        name: this.editName(),
        shortname: this.editShortname() || undefined,
        rating: this.editRating(),
        skillset: this.editSkills(),
        matchesPlayed: this.editMatchesPlayed(),
        wins: this.editWins(),
        losses: this.editLosses(),
        pointsFor: this.editPointsFor(),
        pointsAgainst: this.editPointsAgainst(),
      });
      this.editing.set(false);
    } catch (err) {
      this.editError.set(err instanceof Error ? this.i18n.t(err.message) : this.i18n.t('common.error'));
    } finally {
      this.saving.set(false);
    }
  }

  async deletePlayer(): Promise<void> {
    const p = this.player();
    if (!p) return;
    if (!confirm(this.i18n.t('detail.deleteConfirm', { name: p.name }))) return;
    this.saving.set(true);
    try {
      await this.service.deletePlayer(p.id);
      this.router.navigate(['/']);
    } catch (err) {
      this.editError.set(err instanceof Error ? this.i18n.t(err.message) : this.i18n.t('common.error'));
      this.saving.set(false);
    }
  }
}
