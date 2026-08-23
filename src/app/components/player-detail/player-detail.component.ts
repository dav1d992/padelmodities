import {
  Component,
  computed,
  inject,
  input,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { PadelService } from '../../services/padel.service';
import { AudioService } from '../../services/audio.service';
import {
  DEFAULT_SKILLSET,
  SKILL_LABELS,
  type Player,
  type SkillName,
} from '../../models/padel.model';
import { CommonModule } from '@angular/common';

export type ImageState = 'idle' | 'entering' | 'shaking' | 'settled';

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
  imports: [CommonModule, RouterLink],
  templateUrl: './player-detail.component.html',
  styleUrl: './player-detail.component.scss',
})
export class PlayerDetailComponent implements OnInit, OnDestroy {
  readonly playerId = input.required<string>();

  private service = inject(PadelService);
  private router = inject(Router);
  readonly audioSvc = inject(AudioService);

  readonly player = signal<Player | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly imageState = signal<ImageState>('idle');
  readonly visibleSkillIndex = signal(-1);
  readonly skillLabels = SKILL_LABELS;
  readonly skillNames = Object.keys(SKILL_LABELS) as SkillName[];

  private sub?: Subscription;
  private animationStarted = false;
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
        this.error.set(err?.message ?? 'Kunne niet hente spiller.');
        this.loading.set(false);
      },
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.timers.forEach(clearTimeout);
  }

  private startAnimation(hasImage: boolean): void {
    if (hasImage) setTimeout(() => this.audioSvc.playOneShot('/assets/sounds-effects/gate-slam.mp3', 0.9), 500);
    const t0 = setTimeout(() => this.imageState.set('entering'), 60);
    const t1 = setTimeout(() => this.imageState.set('shaking'), 710);
    const t2 = setTimeout(() => this.imageState.set('settled'), 1160);
    this.startSkillBarSequence();
    this.timers.push(t0, t1, t2);
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
}
