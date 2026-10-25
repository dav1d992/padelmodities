import {
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  OnInit,
  signal,
  untracked,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { RouterLink } from "@angular/router";
import { PadelService } from "../../services/padel.service";
import { I18nService } from "../../services/i18n.service";
import { ThemeService, type ThemeMode } from "../../services/theme.service";
import { AudioService } from "../../services/audio.service";
import { SKILL_NAMES, type Player } from "../../models/padel.model";
import {
  COURT_LENGTH,
  COURT_WIDTH,
  createGame,
  GAMES_TO_WIN,
  NET_Y,
  POINT_LABELS,
  reachOf,
  requestSwing,
  SERVICE_LINE_FROM_NET,
  SIM_STEP,
  stepGame,
  teamOf,
  type GamePlayer,
  type GameMessage,
  type GameSound,
  type GameState,
  type Point,
  type SwingKind,
} from "./padel-game.engine";

type Slot = "a1" | "a2" | "b1" | "b2";

const SLOTS: ReadonlyArray<Slot> = ["a1", "a2", "b1", "b2"];
const KEY_UP = new Set(["arrowup", "w"]);
const KEY_DOWN = new Set(["arrowdown", "s"]);
const KEY_LEFT = new Set(["arrowleft", "a"]);
const KEY_RIGHT = new Set(["arrowright", "d"]);
const KEY_SHOT = new Set(["k", " ", "j"]);
const KEY_LOB = new Set(["l"]);
const CHARGE_MS = 900;
/** Slower than real time so rallies are easier to follow and play. */
const GAME_SPEED = 0.7;
const FALLBACK_IMAGE = "/assets/anonimous-padel.png";
const MARGIN = 0.8;
const TEAM_COLORS: readonly [string, string] = ["#4fc3f7", "#ffb74d"];
const GLASS_LENGTH = 4;
const SOUNDS: Record<GameSound, { readonly src: string; readonly volume: number }> = {
  hit: { src: "/assets/sounds-effects/hit.mp3", volume: 0.275 },
  strike: { src: "/assets/sounds-effects/strike.mp3", volume: 0.8 },
  bounce: { src: "/assets/sounds-effects/bounce.mp3", volume: 0.4 },
};
const COURT_THEMES: Record<ThemeMode, { readonly surround: string; readonly surface: string; readonly glass: string }> = {
  normal: { surround: "#0b1f33", surface: "#1f5fa6", glass: "rgba(190, 235, 255, 0.8)" },
  christmas: { surround: "#1a0f15", surface: "#1f7a45", glass: "rgba(225, 245, 255, 0.9)" },
  halloween: { surround: "#0f1012", surface: "#b85a1a", glass: "rgba(255, 190, 120, 0.75)" },
};

@Component({
  selector: "app-padel-game",
  imports: [RouterLink],
  templateUrl: "./padel-game.component.html",
  styleUrl: "./padel-game.component.scss",
  host: {
    "(window:keydown)": "onKeyDown($event)",
    "(window:keyup)": "onKeyUp($event)",
    "(window:blur)": "clearKeys()",
  },
})
export class PadelGameComponent implements OnInit {
  readonly #service = inject(PadelService);
  readonly #destroyRef = inject(DestroyRef);
  readonly #theme = inject(ThemeService);
  readonly #audio = inject(AudioService);
  readonly i18n = inject(I18nService);

  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>("court");

  readonly skillNames = SKILL_NAMES;
  readonly gamesToWin = GAMES_TO_WIN;
  readonly teams = [
    { label: "game.teamA", css: "team-a", slots: ["a1", "a2"] },
    { label: "game.teamB", css: "team-b", slots: ["b1", "b2"] },
  ] as const;

  readonly players = signal<Array<Player>>([]);
  readonly loading = signal(true);
  readonly slots = signal<Record<Slot, string>>({ a1: "", a2: "", b1: "", b2: "" });
  readonly running = signal(false);
  readonly paused = signal(false);
  readonly over = signal(false);
  /** Index into the chosen four players, or -1 to just watch. */
  readonly control = signal(-1);
  readonly guideOpen = signal(false);
  readonly inMatch = computed(() => this.running() && !this.over());

  readonly teamNames = signal<readonly [string, string]>(["", ""]);
  readonly gamesA = signal(0);
  readonly gamesB = signal(0);
  readonly pointsA = signal("0");
  readonly pointsB = signal("0");
  readonly servingTeam = signal(0);
  readonly serverName = signal("");
  readonly eventText = signal("");
  readonly prevEventText = signal("");
  readonly bannerText = signal("");

  readonly sortedPlayers = computed(() =>
    [...this.players()].sort((a, b) => a.name.localeCompare(b.name, "da")),
  );

  readonly chosen = computed((): readonly [Player, Player, Player, Player] | null => {
    const s = this.slots();
    const [a1, a2, b1, b2] = SLOTS.map((slot) => this.byId(s[slot]));
    return a1 && a2 && b1 && b2 ? [a1, a2, b1, b2] : null;
  });

  #game: GameState | null = null;
  #frame = 0;
  #last = 0;
  #acc = 0;
  #chargeStart: number | null = null;
  #shownEvent: GameMessage | null = null;
  readonly #keys = new Set<string>();
  readonly #images = new Map<string, HTMLImageElement>();
  readonly #imageSrc = new Map<string, string>();

  constructor() {
    effect(() => {
      this.#theme.mode();
      untracked(() => {
        if (this.#game) this.loadImages(this.#game.players);
      });
    });
  }

  readonly #loop = (now: number): void => {
    const game = this.#game;
    const canvas = this.canvas()?.nativeElement;
    if (game && canvas) {
      game.input.charge = this.chargeAt(now);
      if (!this.paused()) {
        this.applyKeys(game);
        this.#acc += Math.min(0.05, (now - this.#last) / 1000) * GAME_SPEED;
        while (this.#acc >= SIM_STEP) {
          stepGame(game, SIM_STEP);
          this.#acc -= SIM_STEP;
        }
      }
      // Several steps can run per frame; play each kind of sound at most once.
      for (const sound of new Set(game.sounds.splice(0))) {
        this.#audio.playOneShot(SOUNDS[sound].src, SOUNDS[sound].volume);
      }
      this.syncHud(game);
    }
    if (canvas) this.draw(canvas, game);
    this.#last = now;
    this.#frame = requestAnimationFrame(this.#loop);
  };

  ngOnInit(): void {
    this.#destroyRef.onDestroy(() => cancelAnimationFrame(this.#frame));
    this.#last = performance.now();
    this.#frame = requestAnimationFrame(this.#loop);
    this.#service
      .watchPlayers()
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (list) => {
          this.players.set(list);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  private byId(id: string): Player | undefined {
    return this.players().find((p) => p.id === id);
  }

  playerIn(slot: Slot): Player | undefined {
    return this.byId(this.slots()[slot]);
  }

  select(slot: Slot, id: string): void {
    this.slots.update((s) => ({ ...s, [slot]: id }));
  }

  /** True if a player is already chosen in a slot other than `own`. */
  isTaken(id: string, own: Slot): boolean {
    const s = this.slots();
    return SLOTS.some((slot) => slot !== own && s[slot] === id);
  }

  /** Fills one team with random players who aren't on the other team. */
  randomTeam(teamSlots: ReadonlyArray<Slot>): void {
    const s = this.slots();
    const taken = new Set(SLOTS.filter((slot) => !teamSlots.includes(slot)).map((slot) => s[slot]));
    const pool = this.players().filter((p) => !taken.has(p.id));
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const next = { ...s };
    teamSlots.forEach((slot, i) => (next[slot] = pool[i].id));
    this.slots.set(next);
  }

  start(): void {
    const chosen = this.chosen();
    if (!chosen) return;
    const [a1, a2, b1, b2] = chosen;
    this.#game = createGame([a1, a2], [b1, b2]);
    this.#game.controlled = this.control() >= 0 ? this.control() : null;
    this.loadImages(this.#game.players);
    this.teamNames.set([`${a1.name} & ${a2.name}`, `${b1.name} & ${b2.name}`]);
    this.#acc = 0;
    this.#shownEvent = null;
    this.eventText.set("");
    this.prevEventText.set("");
    this.paused.set(false);
    this.over.set(false);
    this.running.set(true);
  }

  togglePause(): void {
    this.paused.update((p) => !p);
  }

  setControl(value: string): void {
    const index = Number(value);
    this.control.set(index);
    if (this.#game) this.#game.controlled = index >= 0 ? index : null;
  }

  swing(kind: SwingKind): void {
    if (this.#game && !this.paused()) requestSwing(this.#game, kind);
  }

  startCharge(): void {
    if (!this.#game || this.#game.controlled === null || this.#chargeStart !== null) return;
    this.#chargeStart = performance.now();
  }

  releaseCharge(): void {
    if (this.#chargeStart === null) return;
    const charge = this.chargeAt(performance.now());
    this.#chargeStart = null;
    if (this.#game && !this.paused()) requestSwing(this.#game, "shot", charge);
  }

  private chargeAt(now: number): number {
    return this.#chargeStart === null ? 0 : Math.min(1, (now - this.#chargeStart) / CHARGE_MS);
  }

  onKeyDown(event: KeyboardEvent): void {
    if (!this.#game || this.#game.controlled === null || this.isFormField(event.target)) return;
    const key = event.key.toLowerCase();
    if (KEY_SHOT.has(key)) {
      event.preventDefault();
      if (!event.repeat) this.startCharge();
    } else if (KEY_LOB.has(key)) {
      event.preventDefault();
      if (!event.repeat) this.swing("lob");
    } else if ([KEY_UP, KEY_DOWN, KEY_LEFT, KEY_RIGHT].some((keys) => keys.has(key))) {
      event.preventDefault();
      this.#keys.add(key);
    }
  }

  onKeyUp(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    this.#keys.delete(key);
    if (KEY_SHOT.has(key)) this.releaseCharge();
  }

  clearKeys(): void {
    this.#keys.clear();
    this.#chargeStart = null;
  }

  private isFormField(target: EventTarget | null): boolean {
    return target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement;
  }

  /** Keys are screen-relative; the court is drawn sideways (world x points up, y points right). */
  private applyKeys(game: GameState): void {
    const held = (keys: Set<string>): number => ([...keys].some((k) => this.#keys.has(k)) ? 1 : 0);
    const sx = held(KEY_RIGHT) - held(KEY_LEFT);
    const sy = held(KEY_DOWN) - held(KEY_UP);
    game.input.moveX = -sy;
    game.input.moveY = sx;
  }

  private syncHud(game: GameState): void {
    this.gamesA.set(game.games[0]);
    this.gamesB.set(game.games[1]);
    this.pointsA.set(POINT_LABELS[game.points[0]]);
    this.pointsB.set(POINT_LABELS[game.points[1]]);
    this.servingTeam.set(teamOf(game.serverIndex));
    this.serverName.set(game.players[game.serverIndex].name);
    if (game.event && game.event !== this.#shownEvent) {
      this.#shownEvent = game.event;
      this.prevEventText.set(this.eventText());
      this.eventText.set(this.i18n.t(game.event.key, game.event.params));
    }
    this.bannerText.set(game.banner ? this.i18n.t(game.banner.key, game.banner.params) : "");
    this.over.set(game.phase === "over");
  }

  private loadImages(players: ReadonlyArray<GamePlayer>): void {
    for (const p of players) {
      const sources = p.shortname
        ? [
            this.#theme.playerImage(p.shortname, true) ?? FALLBACK_IMAGE,
            this.#theme.normalPlayerImage(p.shortname),
            FALLBACK_IMAGE,
          ]
        : [FALLBACK_IMAGE];
      const wanted = sources[0];
      if (this.#imageSrc.get(p.id) === wanted) continue;
      this.#imageSrc.set(p.id, wanted);
      const img = new Image();
      // Keep showing the previous portrait until the new theme's one has loaded.
      img.onload = () => {
        if (this.#imageSrc.get(p.id) === wanted) this.#images.set(p.id, img);
      };
      let attempt = 0;
      img.onerror = () => {
        attempt++;
        if (attempt < sources.length) img.src = sources[attempt];
      };
      img.src = wanted;
    }
  }

  private draw(canvas: HTMLCanvasElement, game: GameState | null): void {
    const ctx = canvas.getContext("2d");
    const cssWidth = canvas.clientWidth;
    if (!ctx || cssWidth === 0) return;

    const worldW = COURT_LENGTH + MARGIN * 2;
    const worldH = COURT_WIDTH + MARGIN * 2;
    const scale = cssWidth / worldW;
    const cssHeight = worldH * scale;
    const dpr = window.devicePixelRatio || 1;
    const pixelW = Math.round(cssWidth * dpr);
    const pixelH = Math.round(cssHeight * dpr);
    if (canvas.width !== pixelW || canvas.height !== pixelH) {
      canvas.width = pixelW;
      canvas.height = pixelH;
      canvas.style.height = `${cssHeight}px`;
    }

    const toScreen = (x: number, y: number): Point => ({
      x: (y + MARGIN) * scale,
      y: (COURT_WIDTH - x + MARGIN) * scale,
    });

    const colors = COURT_THEMES[this.#theme.mode()];
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = colors.surround;
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    const s = scale * dpr;
    ctx.setTransform(0, -s, s, 0, MARGIN * s, (COURT_WIDTH + MARGIN) * s);
    this.drawCourt(ctx, colors);
    if (game) this.drawPointGlow(ctx, game);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!game) return;
    const radius = Math.max(22, 0.84 * scale);
    const ordered = [...game.players].sort(
      (a, b) => toScreen(a.x, a.y).y - toScreen(b.x, b.y).y,
    );
    for (const p of ordered) this.drawPlayer(ctx, p, toScreen(p.x, p.y), radius);
    if (game.controlled !== null) {
      const me = game.players[game.controlled];
      this.drawMarker(ctx, me, toScreen(me.x, me.y), radius, scale, game);
    }
    this.drawBall(ctx, game, toScreen, scale);
  }

  private drawMarker(
    ctx: CanvasRenderingContext2D,
    p: GamePlayer,
    at: Point,
    r: number,
    scale: number,
    game: GameState,
  ): void {
    const reach = reachOf(p, true);
    const b = game.ball;
    const inRange = Math.hypot(b.x - p.x, b.y - p.y) <= reach && b.z > 0.15;
    ctx.fillStyle = inRange ? "rgba(233, 245, 66, 0.22)" : "rgba(255, 255, 255, 0.06)";
    ctx.strokeStyle = inRange ? "rgba(233, 245, 66, 0.9)" : "rgba(255, 255, 255, 0.45)";
    ctx.lineWidth = inRange ? 2.5 : 1.5;
    ctx.setLineDash(inRange ? [] : [4, 4]);
    ctx.beginPath();
    ctx.arc(at.x, at.y, reach * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);

    const charge = game.input.charge;
    if (charge > 0) {
      // Green → red: more power, more risk.
      ctx.strokeStyle = `hsl(${120 - charge * 120}, 90%, 55%)`;
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.arc(at.x, at.y, r + 8, -Math.PI / 2, -Math.PI / 2 + charge * Math.PI * 2);
      ctx.stroke();
      ctx.lineCap = "butt";
    }

    ctx.font = "800 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#e9f542";
    ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
    ctx.shadowBlur = 3;
    ctx.fillText(this.i18n.t("game.you"), at.x, at.y - r - 6);
    ctx.shadowBlur = 0;
  }

  /** Lights up the half of the team that just won the point; fades out before the next serve. */
  private drawPointGlow(ctx: CanvasRenderingContext2D, game: GameState): void {
    const team = game.pointWinner;
    if (team === null) return;
    const fade = game.phase === "pause" ? Math.min(1, game.timer / 0.5) : 1;
    const top = team === 0 ? 0 : NET_Y;
    // Brighten with white and outline in the team colour; a tinted fill mixes to grey on the court colour.
    ctx.globalAlpha = 0.22 * fade;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, top, COURT_WIDTH, NET_Y);
    ctx.globalAlpha = fade;
    ctx.strokeStyle = TEAM_COLORS[team];
    ctx.lineWidth = 0.25;
    ctx.strokeRect(0.125, top + 0.125, COURT_WIDTH - 0.25, NET_Y - 0.25);
    ctx.globalAlpha = 1;
  }

  private drawCourt(ctx: CanvasRenderingContext2D, colors: (typeof COURT_THEMES)[ThemeMode]): void {
    const serviceA = NET_Y - SERVICE_LINE_FROM_NET;
    const serviceB = NET_Y + SERVICE_LINE_FROM_NET;
    ctx.fillStyle = colors.surface;
    ctx.fillRect(0, 0, COURT_WIDTH, COURT_LENGTH);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.lineWidth = 0.06;
    ctx.beginPath();
    ctx.moveTo(0, serviceA);
    ctx.lineTo(COURT_WIDTH, serviceA);
    ctx.moveTo(0, serviceB);
    ctx.lineTo(COURT_WIDTH, serviceB);
    ctx.moveTo(COURT_WIDTH / 2, serviceA);
    ctx.lineTo(COURT_WIDTH / 2, serviceB);
    ctx.stroke();

    // Glass back walls and side panels.
    ctx.strokeStyle = colors.glass;
    ctx.lineWidth = 0.18;
    ctx.beginPath();
    ctx.moveTo(0, GLASS_LENGTH);
    ctx.lineTo(0, 0);
    ctx.lineTo(COURT_WIDTH, 0);
    ctx.lineTo(COURT_WIDTH, GLASS_LENGTH);
    ctx.moveTo(0, COURT_LENGTH - GLASS_LENGTH);
    ctx.lineTo(0, COURT_LENGTH);
    ctx.lineTo(COURT_WIDTH, COURT_LENGTH);
    ctx.lineTo(COURT_WIDTH, COURT_LENGTH - GLASS_LENGTH);
    ctx.stroke();

    // Mesh fence in the middle of the side walls.
    ctx.strokeStyle = "rgba(170, 180, 190, 0.6)";
    ctx.lineWidth = 0.12;
    ctx.setLineDash([0.25, 0.2]);
    ctx.beginPath();
    ctx.moveTo(0, GLASS_LENGTH);
    ctx.lineTo(0, COURT_LENGTH - GLASS_LENGTH);
    ctx.moveTo(COURT_WIDTH, GLASS_LENGTH);
    ctx.lineTo(COURT_WIDTH, COURT_LENGTH - GLASS_LENGTH);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = "#f2f2f2";
    ctx.lineWidth = 0.1;
    ctx.beginPath();
    ctx.moveTo(-0.2, NET_Y);
    ctx.lineTo(COURT_WIDTH + 0.2, NET_Y);
    ctx.stroke();
    ctx.fillStyle = "#cfd8dc";
    ctx.fillRect(-0.35, NET_Y - 0.12, 0.2, 0.24);
    ctx.fillRect(COURT_WIDTH + 0.15, NET_Y - 0.12, 0.2, 0.24);
  }

  private drawPlayer(
    ctx: CanvasRenderingContext2D,
    p: GamePlayer,
    at: Point,
    r: number,
  ): void {
    const color = TEAM_COLORS[p.team];

    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.ellipse(at.x, at.y + r * 0.85, r * 0.85, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();

    if (p.swing > 0) {
      ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(1, p.swing * 4)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(at.x, at.y, r + 4 + (0.25 - p.swing) * 40, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(at.x, at.y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.clip();
    const img = this.#images.get(p.id);
    if (img && img.complete && img.naturalWidth > 0) {
      // Square crop from the top so faces stay in frame.
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const sx = (img.naturalWidth - side) / 2;
      ctx.drawImage(img, sx, 0, side, side, at.x - r, at.y - r, r * 2, r * 2);
    }
    ctx.restore();

    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(at.x, at.y, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.font = "600 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
    ctx.shadowBlur = 3;
    ctx.fillText(p.name.split(" ")[0], at.x, at.y + r + 13);
    ctx.shadowBlur = 0;

    const barW = r * 1.6;
    const energy = 1 - p.fatigue;
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fillRect(at.x - barW / 2, at.y + r + 17, barW, 3);
    ctx.fillStyle = energy > 0.6 ? "#6fdc8c" : energy > 0.35 ? "#ffd166" : "#ef6f6c";
    ctx.fillRect(at.x - barW / 2, at.y + r + 17, barW * energy, 3);
  }

  private drawBall(
    ctx: CanvasRenderingContext2D,
    game: GameState,
    toScreen: (x: number, y: number) => Point,
    scale: number,
  ): void {
    const b = game.ball;
    const at = toScreen(b.x, b.y);
    const lift = b.z * scale * 0.45;

    ctx.fillStyle = `rgba(0, 0, 0, ${0.6 / (1 + b.z * 0.25)})`;
    ctx.beginPath();
    ctx.ellipse(at.x, at.y, Math.max(3.5, 0.13 * scale), Math.max(2, 0.08 * scale), 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#e9f542";
    ctx.strokeStyle = "#7d8a10";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(at.x, at.y - lift, Math.max(3.5, 0.11 * scale * (1 + b.z * 0.1)), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}
