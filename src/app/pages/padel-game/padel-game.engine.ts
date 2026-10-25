import { DEFAULT_SKILLSET, type Player, type Skillset } from "../../models/padel.model";

export const COURT_WIDTH = 10;
export const COURT_LENGTH = 20;
export const NET_Y = COURT_LENGTH / 2;
export const SERVICE_LINE_FROM_NET = 6.95;
export const GAMES_TO_WIN = 4;
export const SIM_STEP = 1 / 120;
export const POINT_LABELS: ReadonlyArray<string> = ["0", "15", "30", "40"];

const NET_HEIGHT = 0.88;
const GRAVITY = 9.81;
const AIR_DRAG = 0.12;
const FLOOR_BOUNCE = 0.68;
const FLOOR_FRICTION = 0.85;
const WALL_BOUNCE = 0.7;
const SERVE_DELAY = 1.1;
const POINT_PAUSE = 1.8;
const FAULT_PAUSE = 0.9;
const PLAN_INTERVAL = 0.1;
const PREDICT_STEP = 1 / 60;
const PREDICT_HORIZON = 3;
const MAX_TIME_SINCE_HIT = 6;
const MAX_FATIGUE = 0.85;
const PLAYER_MARGIN = 0.3;
const SWING_WINDOW = 0.35;
/** Humans lack the AI's perfect positioning, so give them a larger hit zone. */
const HUMAN_REACH_BONUS = 1.7;
const HUMAN_HEIGHT_BONUS = 0.6;
/** Serve rotates A1, B1, A2, B2 game by game. */
const SERVE_ORDER: ReadonlyArray<number> = [0, 2, 1, 3];

export type Team = 0 | 1;
export type ShotType = "serve" | "drive" | "volley" | "lob" | "smash";
export type SwingKind = "shot" | "lob";
export type GamePhase = "serve" | "rally" | "pause" | "over";
/** `strike` = hard hit, `hit` = lob or normal shot, `bounce` = floor or glass. */
export type GameSound = "hit" | "strike" | "bounce";

export interface Point {
  x: number;
  y: number;
}

export interface Ball {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

export interface GamePlayer {
  readonly id: string;
  readonly name: string;
  readonly shortname?: string;
  readonly team: Team;
  readonly skill: Skillset;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  /** 0 = fresh, MAX_FATIGUE = exhausted. Slows the player and hurts every shot. */
  fatigue: number;
  /** Seconds before the player starts moving after an opponent's shot. */
  reaction: number;
  /** Seconds left of the swing animation. */
  swing: number;
  cooldown: number;
}

export interface GameMessage {
  readonly key: string;
  readonly params: Record<string, string>;
}

export interface GameInput {
  /** World-space run direction from the keyboard; 0/0 = none. */
  moveX: number;
  moveY: number;
  swing: SwingKind | null;
  swingWindow: number;
  /** 0–1 while the hit button is held; drives the power meter. */
  charge: number;
  /** Charge locked in when the buffered swing was released. */
  power: number;
}

export interface GameState {
  /** Order: Team A player 1, Team A player 2, Team B player 1, Team B player 2. */
  readonly players: ReadonlyArray<GamePlayer>;
  readonly ball: Ball;
  readonly rng: () => number;
  readonly input: GameInput;
  /** Index of the human-controlled player, if any. */
  controlled: number | null;
  phase: GamePhase;
  timer: number;
  points: [number, number];
  games: [number, number];
  attacking: [boolean, boolean];
  winner: Team | null;
  /** Team that won the last point, until the next serve. */
  pointWinner: Team | null;
  serverIndex: number;
  gamesPlayed: number;
  serveBoxLeft: boolean;
  faults: number;
  shot: ShotType;
  hitter: number;
  bounces: number;
  /** Glass contacts since the last shot; each extra one makes the return harder. */
  glassHits: number;
  sinceHit: number;
  planTimer: number;
  event: GameMessage | null;
  eventTimer: number;
  banner: GameMessage | null;
  /** Sounds since the UI last drained the queue. */
  sounds: Array<GameSound>;
}

interface Contact {
  netZ: number | null;
  wall: Team | null;
  floor: boolean;
}

interface Sample extends Point {
  t: number;
}

export function teamOf(index: number): Team {
  return index < 2 ? 0 : 1;
}

function other(team: Team): Team {
  return team === 0 ? 1 : 0;
}

function sideOf(y: number): Team {
  return y < NET_Y ? 0 : 1;
}

/** +1 when the team hits towards increasing y. */
function towardNet(team: Team): number {
  return team === 0 ? 1 : -1;
}

function teamIndexes(team: Team): [number, number] {
  return [team * 2, team * 2 + 1];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function gauss(rng: () => number): number {
  const u = 1 - rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

function eff(p: GamePlayer, skill: keyof Skillset): number {
  return p.skill[skill] * (1 - p.fatigue * 0.35);
}

export function reachOf(p: GamePlayer, human = false): number {
  // Close to the net a volleyer cuts off far more angles than from the back.
  const atNet = Math.max(0, 1 - Math.abs(p.y - NET_Y) / 5) * 0.9;
  // Same reach as before at control 5, but a much wider spread between low and high control.
  return (0.275 + p.skill.agility * 0.03 + p.skill.control * 0.09 + atNet) * (human ? HUMAN_REACH_BONUS : 1);
}

function reachHeight(p: GamePlayer, human = false): number {
  return 2.2 + p.skill.agility * 0.04 + (human ? HUMAN_HEIGHT_BONUS : 0);
}

function speedOf(p: GamePlayer): number {
  return (3.2 + p.skill.agility * 0.38) * (1 - p.fatigue * 0.45);
}

function toGamePlayer(p: Player, team: Team): GamePlayer {
  const y = team === 0 ? 5 : 15;
  return {
    id: p.id,
    name: p.name.split(" ")[0],
    shortname: p.shortname,
    team,
    skill: { ...DEFAULT_SKILLSET, ...p.skillset },
    x: 5,
    y,
    targetX: 5,
    targetY: y,
    fatigue: 0,
    reaction: 0,
    swing: 0,
    cooldown: 0,
  };
}

export function createGame(
  teamA: readonly [Player, Player],
  teamB: readonly [Player, Player],
  rng: () => number = Math.random,
): GameState {
  const state: GameState = {
    players: [
      ...teamA.map((p) => toGamePlayer(p, 0)),
      ...teamB.map((p) => toGamePlayer(p, 1)),
    ],
    ball: { x: 5, y: 5, z: 0.9, vx: 0, vy: 0, vz: 0 },
    rng,
    input: { moveX: 0, moveY: 0, swing: null, swingWindow: 0, charge: 0, power: 0 },
    controlled: null,
    phase: "serve",
    timer: 0,
    points: [0, 0],
    games: [0, 0],
    attacking: [false, false],
    winner: null,
    pointWinner: null,
    serverIndex: SERVE_ORDER[0],
    gamesPlayed: 0,
    serveBoxLeft: true,
    faults: 0,
    shot: "serve",
    hitter: 0,
    bounces: 0,
    glassHits: 0,
    sinceHit: 0,
    planTimer: 0,
    event: null,
    eventTimer: 0,
    banner: null,
    sounds: [],
  };
  startPoint(state);
  return state;
}

/** Buffers a swing for the controlled player so a slightly early press still connects. */
export function requestSwing(state: GameState, kind: SwingKind, power = 0): void {
  if (state.controlled === null) return;
  const p = state.players[state.controlled];
  state.input.swing = kind;
  state.input.power = clamp(power, 0, 1);
  state.input.swingWindow = SWING_WINDOW;
  if (p.cooldown <= 0 && p.swing <= 0) p.swing = SWING_WINDOW;
}

export function stepGame(state: GameState, dt: number): void {
  if (state.eventTimer > 0) {
    state.eventTimer -= dt;
    if (state.eventTimer <= 0) state.event = null;
  }
  if (state.input.swingWindow > 0) {
    state.input.swingWindow -= dt;
    if (state.input.swingWindow <= 0) state.input.swing = null;
  }
  for (const p of state.players) {
    p.swing = Math.max(0, p.swing - dt);
    p.cooldown = Math.max(0, p.cooldown - dt);
  }

  switch (state.phase) {
    case "serve":
      state.timer -= dt;
      if (state.timer <= 0 && serveReady(state)) {
        const boost = state.controlled === state.serverIndex ? state.input.power : 0;
        state.input.swing = null;
        performShot(state, state.serverIndex, "serve", boost);
        state.phase = "rally";
      }
      return;
    case "rally":
      state.planTimer -= dt;
      if (state.planTimer <= 0) {
        planMovement(state);
        state.planTimer = PLAN_INTERVAL;
      }
      movePlayers(state, dt);
      stepRally(state, dt);
      if (state.phase === "rally") tryHit(state);
      return;
    case "pause":
      movePlayers(state, dt);
      stepFree(state, dt);
      state.timer -= dt;
      if (state.timer <= 0) {
        if (state.winner === null) startPoint(state);
        else state.phase = "over";
      }
      return;
    case "over":
      stepFree(state, dt);
      return;
  }
}

/** A human server waits as long as they like and serves on their own swing. */
function serveReady(state: GameState): boolean {
  if (state.controlled !== state.serverIndex) return true;
  return state.input.swing !== null;
}

/** Where everyone stands for the next serve, by player index. */
function serveLayout(state: GameState): Array<Point> {
  const serveTeam = teamOf(state.serverIndex);
  const deuce = (state.points[0] + state.points[1]) % 2 === 0;
  const serverX = (serveTeam === 0) === deuce ? 7.5 : 2.5;
  const boxX = COURT_WIDTH - serverX;
  const receiver = teamIndexes(other(serveTeam))[deuce ? 0 : 1];
  return state.players.map((p, i) => {
    const dir = towardNet(p.team);
    if (i === state.serverIndex) {
      return { x: serverX, y: NET_Y - dir * (SERVICE_LINE_FROM_NET + 0.6) };
    }
    if (p.team === serveTeam) return { x: boxX, y: NET_Y - dir * 2.8 };
    if (i === receiver) return { x: boxX, y: NET_Y - dir * 8.6 };
    return { x: serverX, y: NET_Y - dir * 7.4 };
  });
}

function startPoint(state: GameState): void {
  const layout = serveLayout(state);
  state.players.forEach((p, i) => {
    const spot = layout[i];
    p.x = p.targetX = spot.x;
    p.y = p.targetY = spot.y;
    p.reaction = 0;
    p.cooldown = 0;
  });
  const server = state.players[state.serverIndex];
  const serveTeam = server.team;
  Object.assign(state.ball, {
    x: server.x - 0.35,
    y: server.y + towardNet(serveTeam) * 0.3,
    z: 0.9,
    vx: 0,
    vy: 0,
    vz: 0,
  });
  state.serveBoxLeft = server.x > COURT_WIDTH / 2;
  state.phase = "serve";
  state.timer = SERVE_DELAY;
  state.hitter = state.serverIndex;
  state.shot = "serve";
  state.bounces = 0;
  state.glassHits = 0;
  state.pointWinner = null;
  state.sinceHit = 0;
  state.banner = null;
  state.attacking = [serveTeam === 0, serveTeam === 1];
}

/** Moves the ball one step and reports what it touched. */
function integrate(b: Ball, dt: number): Contact {
  const prevY = b.y;
  const prevZ = b.z;
  const drag = 1 - AIR_DRAG * dt;
  b.vx *= drag;
  b.vy *= drag;
  b.vz -= GRAVITY * dt;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.z += b.vz * dt;

  let netZ: number | null = null;
  if ((prevY - NET_Y) * (b.y - NET_Y) < 0) {
    netZ = prevZ + ((b.z - prevZ) * (NET_Y - prevY)) / (b.y - prevY);
  }

  let wall: Team | null = null;
  if (b.x < 0) {
    b.x = -b.x;
    b.vx = -b.vx * WALL_BOUNCE;
    wall = sideOf(b.y);
  } else if (b.x > COURT_WIDTH) {
    b.x = 2 * COURT_WIDTH - b.x;
    b.vx = -b.vx * WALL_BOUNCE;
    wall = sideOf(b.y);
  }
  if (b.y < 0) {
    b.y = -b.y;
    b.vy = -b.vy * WALL_BOUNCE;
    wall = 0;
  } else if (b.y > COURT_LENGTH) {
    b.y = 2 * COURT_LENGTH - b.y;
    b.vy = -b.vy * WALL_BOUNCE;
    wall = 1;
  }

  let floor = false;
  if (b.z < 0) {
    floor = true;
    b.z = -b.z * FLOOR_BOUNCE;
    b.vz = Math.abs(b.vz) * FLOOR_BOUNCE;
    b.vx *= FLOOR_FRICTION;
    b.vy *= FLOOR_FRICTION;
    if (b.vz < 0.4) {
      b.vz = 0;
      b.z = 0;
    }
  }
  return { netZ, wall, floor };
}

function dropAtNet(b: Ball, fromSide: Team): void {
  b.y = NET_Y - towardNet(fromSide) * 0.05;
  b.vy = -b.vy * 0.15;
  b.vx *= 0.3;
}

/** `integrate` plus bounce sounds; prediction calls `integrate` directly so it stays silent. */
function moveBall(state: GameState, dt: number): Contact {
  const contact = integrate(state.ball, dt);
  if ((contact.floor && state.ball.vz > 0) || contact.wall !== null) state.sounds.push("bounce");
  return contact;
}

/** Physics without rules, used between points. */
function stepFree(state: GameState, dt: number): void {
  const b = state.ball;
  const fromSide = sideOf(b.y);
  const contact = moveBall(state, dt);
  if (contact.netZ !== null && contact.netZ < NET_HEIGHT) dropAtNet(b, fromSide);
}

function stepRally(state: GameState, dt: number): void {
  const b = state.ball;
  const fromSide = sideOf(b.y);
  const contact = moveBall(state, dt);
  const hitTeam = teamOf(state.hitter);
  const serving = state.shot === "serve";
  state.sinceHit += dt;

  if (contact.netZ !== null) {
    if (contact.netZ < NET_HEIGHT) {
      dropAtNet(b, fromSide);
      if (fromSide !== hitTeam) endPoint(state, hitTeam, "game.ev.winner");
      else if (serving) serveFault(state);
      else endPoint(state, other(hitTeam), "game.ev.net");
      return;
    }
    // Bounced on the opponent's side and came back over the net: unreturnable.
    if (sideOf(b.y) === hitTeam && state.bounces > 0) {
      endPoint(state, hitTeam, "game.ev.winner");
      return;
    }
  }

  if (contact.wall !== null && contact.wall !== hitTeam && state.bounces === 0) {
    if (serving) serveFault(state);
    else endPoint(state, other(hitTeam), "game.ev.wall");
    return;
  }
  if (contact.wall !== null) state.glassHits++;

  if (contact.floor) {
    if (sideOf(b.y) === hitTeam) {
      if (serving) serveFault(state);
      else endPoint(state, other(hitTeam), "game.ev.net");
      return;
    }
    state.bounces++;
    if (serving && state.bounces === 1 && !inServiceBox(state)) {
      serveFault(state);
      return;
    }
    if (state.bounces >= 2) {
      endPoint(state, hitTeam, "game.ev.winner");
      return;
    }
  }

  if (state.sinceHit > MAX_TIME_SINCE_HIT) endPoint(state, hitTeam, "game.ev.winner");
}

function inServiceBox(state: GameState): boolean {
  const b = state.ball;
  const receivingSide = other(teamOf(state.serverIndex));
  const inX = state.serveBoxLeft ? b.x <= COURT_WIDTH / 2 : b.x >= COURT_WIDTH / 2;
  return (
    sideOf(b.y) === receivingSide &&
    Math.abs(b.y - NET_Y) <= SERVICE_LINE_FROM_NET &&
    inX
  );
}

function serveFault(state: GameState): void {
  state.faults++;
  state.hitter = state.serverIndex;
  if (state.faults >= 2) {
    endPoint(state, other(teamOf(state.serverIndex)), "game.ev.doubleFault");
    return;
  }
  const name = state.players[state.serverIndex].name;
  state.event = { key: "game.ev.fault", params: { name } };
  state.eventTimer = FAULT_PAUSE + SERVE_DELAY;
  state.phase = "pause";
  state.timer = FAULT_PAUSE;
  targetLayout(state);
}

function endPoint(state: GameState, winner: Team, key: string): void {
  state.event = { key, params: { name: state.players[state.hitter].name } };
  state.eventTimer = POINT_PAUSE + SERVE_DELAY;
  state.pointWinner = winner;
  awardPoint(state, winner);
  for (const p of state.players) {
    p.fatigue = Math.max(0, p.fatigue - (0.015 + p.skill.stamina * 0.003));
    p.reaction = 0;
  }
  state.phase = "pause";
  state.timer = POINT_PAUSE;
  if (state.winner === null) targetLayout(state);
}

function targetLayout(state: GameState): void {
  const layout = serveLayout(state);
  state.players.forEach((p, i) => setTarget(p, layout[i]));
}

function awardPoint(state: GameState, team: Team): void {
  state.faults = 0;
  // Golden point: at 40 the next point always wins the game.
  if (state.points[team] < 3) {
    state.points[team]++;
    return;
  }
  state.points = [0, 0];
  state.games[team]++;
  const label = team === 0 ? "A" : "B";
  if (state.games[team] >= GAMES_TO_WIN) {
    state.winner = team;
    state.banner = { key: "game.ev.match", params: { team: label } };
    return;
  }
  state.banner = { key: "game.ev.game", params: { team: label } };
  state.gamesPlayed++;
  state.serverIndex = SERVE_ORDER[state.gamesPlayed % SERVE_ORDER.length];
}

function setTarget(p: GamePlayer, spot: Point): void {
  p.targetX = clamp(spot.x, PLAYER_MARGIN, COURT_WIDTH - PLAYER_MARGIN);
  p.targetY =
    p.team === 0
      ? clamp(spot.y, PLAYER_MARGIN, NET_Y - PLAYER_MARGIN)
      : clamp(spot.y, NET_Y + PLAYER_MARGIN, COURT_LENGTH - PLAYER_MARGIN);
}

function movePlayers(state: GameState, dt: number): void {
  state.players.forEach((p, i) => {
    if (i === state.controlled && state.phase === "rally") steerHuman(state, p);
    else if (p.reaction > 0) {
      p.reaction -= dt;
      return;
    }
    const dx = p.targetX - p.x;
    const dy = p.targetY - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.01) return;
    const step = Math.min(dist, speedOf(p) * dt);
    p.x += (dx / dist) * step;
    p.y += (dy / dist) * step;
    if (state.phase === "rally") {
      p.fatigue = Math.min(
        MAX_FATIGUE,
        p.fatigue + step * 0.0022 * (1.6 - p.skill.stamina * 0.1),
      );
    }
  });
}

function steerHuman(state: GameState, p: GamePlayer): void {
  const { moveX, moveY } = state.input;
  const len = Math.hypot(moveX, moveY);
  if (len > 0) setTarget(p, { x: p.x + (moveX / len) * 2, y: p.y + (moveY / len) * 2 });
  else setTarget(p, p);
}

/**
 * Strategy decides how far a player follows the team to the net (≤2 stays back, ≥8 hugs the net)
 * and how much they shift sideways to cover the ball's side.
 */
function formationSpot(state: GameState, index: number): Point {
  const p = state.players[index];
  const partner = state.players[index ^ 1];
  const left = p.x < partner.x || (p.x === partner.x && index % 2 === 0);
  const strategy = p.skill.strategy;
  const netness = state.attacking[p.team] ? clamp((strategy - 2) / 6, 0, 1) : 0;
  const fromNet = 7.6 - netness * 5.2;
  const shift = (state.ball.x - COURT_WIDTH / 2) * 0.3 * (strategy / 10);
  return { x: (left ? 2.8 : 7.2) + shift, y: NET_Y - towardNet(p.team) * fromNet };
}

function predictReachable(state: GameState, team: Team): Array<Sample> {
  const b: Ball = { ...state.ball };
  let bounces = state.bounces;
  const samples: Array<Sample> = [];
  for (let t = PREDICT_STEP; t <= PREDICT_HORIZON; t += PREDICT_STEP) {
    const contact = integrate(b, PREDICT_STEP);
    if (contact.netZ !== null && contact.netZ < NET_HEIGHT) break;
    if (contact.floor) {
      if (sideOf(b.y) !== team) break;
      bounces++;
      if (bounces >= 2) break;
    }
    if (sideOf(b.y) !== team) continue;
    if (state.shot === "serve" && bounces === 0) continue;
    if (b.z < 0.25 || b.z > 2.3) continue;
    samples.push({ t, x: b.x, y: b.y });
  }
  return samples;
}

function planMovement(state: GameState): void {
  const hitTeam = teamOf(state.hitter);
  const recvTeam = other(hitTeam);
  for (const i of teamIndexes(hitTeam)) {
    if (i !== state.controlled) setTarget(state.players[i], formationSpot(state, i));
  }

  const receivers = teamIndexes(recvTeam);
  const samples = predictReachable(state, recvTeam);
  let chaser = -1;
  let spot: Sample | null = null;
  for (const s of samples) {
    let bestNeed = Infinity;
    for (const i of receivers) {
      const p = state.players[i];
      const run = Math.max(0, Math.hypot(s.x - p.x, s.y - p.y) - reachOf(p) * 0.7);
      const need = run / speedOf(p) + Math.max(0, p.reaction);
      if (need <= s.t && need < bestNeed) {
        bestNeed = need;
        chaser = i;
      }
    }
    if (chaser >= 0) {
      spot = s;
      break;
    }
  }
  // Nothing reachable: sprint towards the last chance anyway.
  if (!spot && samples.length > 0) {
    spot = samples[samples.length - 1];
    const s = spot;
    const [a, b] = receivers.map((i) => {
      const p = state.players[i];
      return Math.hypot(s.x - p.x, s.y - p.y);
    });
    chaser = a <= b ? receivers[0] : receivers[1];
  }

  for (const i of receivers) {
    const p = state.players[i];
    if (i === state.controlled) continue;
    if (i === chaser && spot) {
      setTarget(p, { x: spot.x, y: spot.y - towardNet(recvTeam) * 0.25 });
    } else {
      setTarget(p, formationSpot(state, i));
    }
  }
}

function tryHit(state: GameState): void {
  const b = state.ball;
  const recvTeam = other(teamOf(state.hitter));
  if (sideOf(b.y) !== recvTeam || b.z < 0.15) return;
  if (state.shot === "serve" && state.bounces === 0) return;

  let best = -1;
  let bestDist = Infinity;
  for (const i of teamIndexes(recvTeam)) {
    const p = state.players[i];
    const human = i === state.controlled;
    if (human && state.input.swing === null) continue;
    if (p.cooldown > 0 || b.z > reachHeight(p, human)) continue;
    const d = Math.hypot(p.x - b.x, p.y - b.y);
    if (d <= reachOf(p, human) && d < bestDist) {
      best = i;
      bestDist = d;
    }
  }
  if (best < 0) return;

  const p = state.players[best];
  const human = best === state.controlled;
  const swing = state.input.swing;
  if (human) state.input.swing = null;
  const speed = Math.hypot(b.vx, b.vy, b.vz);
  const control = eff(p, "control");
  // Low control whiffs even easy balls; fast balls and fatigue make it worse.
  // A volley is a short punch, so pace hurts it less than a full swing.
  const paceFactor = state.bounces === 0 ? 0.4 : 1;
  // Defending from the back against a team at the net is under pressure.
  const pressure =
    Math.abs(p.y - NET_Y) > 6
      ? teamIndexes(other(p.team)).filter((i) => Math.abs(state.players[i].y - NET_Y) < 4).length * 0.12
      : 0;
  const baseMiss = clamp(
    (10 - control) * 0.02 +
      Math.max(0, (speed - 10) / 45) * (1.2 - control / 10) * paceFactor +
      pressure +
      p.fatigue * 0.08,
    0,
    0.55,
  );
  // Off two or more panes of glass the ball comes back at awkward angles.
  const missChance = Math.min(0.85, baseMiss + Math.max(0, state.glassHits - 1) * 0.15);
  if (state.rng() < missChance) {
    p.cooldown = 0.6;
    p.swing = 0.25;
    state.event = { key: "game.ev.miss", params: { name: p.name } };
    state.eventTimer = 1.2;
    return;
  }
  const type = human ? humanShot(state, swing) : chooseShot(state, best);
  performShot(state, best, type, human ? state.input.power : 0);
}

function humanShot(state: GameState, swing: SwingKind | null): ShotType {
  if (swing === "lob") return "lob";
  if (state.ball.z >= 1.9) return "smash";
  return state.bounces === 0 ? "volley" : "drive";
}

function chooseShot(state: GameState, index: number): ShotType {
  const p = state.players[index];
  const rng = state.rng;
  if (state.ball.z >= 1.9 && rng() < 0.3 + eff(p, "power") * 0.06) return "smash";
  if (state.bounces === 0) return "volley";
  const oppsAtNet = teamIndexes(other(p.team)).filter(
    (i) => Math.abs(state.players[i].y - NET_Y) < 4,
  ).length;
  if (rng() < oppsAtNet * (0.08 + eff(p, "strategy") * 0.025)) return "lob";
  return "drive";
}

/** Aims into the biggest gap with probability strategy/10, otherwise at a random lane. */
function pickTarget(state: GameState, p: GamePlayer, type: ShotType): Point {
  const rng = state.rng;
  const depth =
    type === "lob"
      ? 7.8 + rng() * 1.2
      : type === "smash"
        ? 4.5 + rng() * 3
        : type === "volley"
          ? 3.5 + rng() * 4
          : 4.5 + rng() * 3.5;
  const y = NET_Y + towardNet(p.team) * depth;
  const lanes: ReadonlyArray<number> = [1.6, 3.3, 5, 6.7, 8.4];
  // A human aims by holding a sideways direction while swinging.
  if (state.controlled !== null && state.players[state.controlled] === p && state.input.moveX !== 0) {
    return { x: state.input.moveX < 0 ? lanes[0] : lanes[lanes.length - 1], y };
  }
  if (rng() >= eff(p, "strategy") / 10) {
    return { x: lanes[Math.floor(rng() * lanes.length)], y };
  }
  const opponents = teamIndexes(other(p.team)).map((i) => state.players[i]);
  // From the net, a short drop volley punishes opponents who stay back.
  const depths =
    type === "volley" && Math.abs(p.y - NET_Y) < 4.5 ? [y, NET_Y + towardNet(p.team) * 2.8] : [y];
  let best: Point = { x: lanes[0], y };
  let bestGap = -1;
  for (const ty of depths) {
    for (const x of lanes) {
      const gap = Math.min(...opponents.map((o) => Math.hypot(o.x - x, o.y - ty)));
      if (gap > bestGap) {
        bestGap = gap;
        best = { x, y: ty };
      }
    }
  }
  return best;
}

function serveTarget(state: GameState): Point {
  const rng = state.rng;
  const [x0, x1] = state.serveBoxLeft ? [0.8, 4.2] : [5.8, 9.2];
  const dir = towardNet(teamOf(state.serverIndex));
  return { x: x0 + rng() * (x1 - x0), y: NET_Y + dir * (3.8 + rng() * 2.4) };
}

const SHOT_SPEED: Record<Exclude<ShotType, "lob">, (power: number) => number> = {
  serve: (power) => 10 + power * 0.5,
  drive: (power) => 12 + power * 1.2,
  volley: (power) => 10 + power * 0.9,
  smash: (power) => 17 + power * 1.4,
};

/** Vertical speed that brings the ball from height z0 to the floor in time t. */
function landingVz(z0: number, t: number): number {
  return (GRAVITY * t) / 2 - z0 / t;
}

function clearsNet(b: Ball, dy: number, t: number, vz: number): boolean {
  if (dy === 0) return true;
  const tn = ((NET_Y - b.y) / dy) * t;
  if (tn <= 0 || tn >= t) return true;
  return b.z + vz * tn - (GRAVITY * tn * tn) / 2 > NET_HEIGHT + 0.25;
}

/**
 * `charge` (0–1, human only) trades safety for pace: the ball flies faster and deeper,
 * but the aim error grows – much more for low-control players – so it hits the glass or net more often.
 */
function performShot(state: GameState, index: number, type: ShotType, charge = 0): void {
  const p = state.players[index];
  const b = state.ball;
  const rng = state.rng;
  const control = eff(p, "control");
  const boost = type === "lob" ? 0 : charge;
  const target = type === "serve" ? serveTarget(state) : pickTarget(state, p, type);
  const deeper = towardNet(p.team) * boost * (type === "serve" ? 0.6 : 1.6);
  const spread =
    (type === "serve" ? 0.8 : 1.5) * (1.15 - control / 10) * (1 + boost * (1.6 - control * 0.12));
  const dx = target.x + gauss(rng) * spread - b.x;
  const dy = target.y + deeper + gauss(rng) * spread * 0.8 - b.y;

  let t: number;
  let vz: number;
  if (type === "lob") {
    const apex = Math.max(b.z + 1, 5.5 + rng() * 1.5);
    vz = Math.sqrt(2 * GRAVITY * (apex - b.z));
    t = vz / GRAVITY + Math.sqrt((2 * apex) / GRAVITY);
  } else {
    const power = eff(p, "power");
    const pace = SHOT_SPEED[type](power) * (1 + boost * (0.3 + power * 0.04));
    t = Math.max(0.2, Math.hypot(dx, dy) / pace);
    vz = landingVz(b.z, t);
    for (let i = 0; i < 12 && !clearsNet(b, dy, t, vz); i++) {
      t *= 1.12;
      vz = landingVz(b.z, t);
    }
  }
  // Air drag shortens the flight; push a little harder so it still reaches the target.
  const dragComp = 1 / Math.max(0.5, 1 - (AIR_DRAG * t) / 2);
  b.vx = (dx / t) * dragComp;
  b.vy = (dy / t) * dragComp;
  b.vz = vz * (1 + gauss(rng) * 0.1 * (1.1 - control / 10) * (1 + boost * 1.5));

  state.hitter = index;
  state.shot = type;
  state.sounds.push(type === "smash" || boost >= 0.5 ? "strike" : "hit");
  state.bounces = 0;
  state.glassHits = 0;
  state.sinceHit = 0;
  state.planTimer = 0;
  p.swing = 0.25;
  p.cooldown = 0.35;
  p.fatigue = Math.min(
    MAX_FATIGUE,
    p.fatigue + (type === "smash" ? 0.012 : 0.004) * (1.6 - p.skill.stamina * 0.1) * (1 + boost),
  );

  state.attacking[p.team] =
    type !== "drive" ||
    Math.abs(p.y - NET_Y) < 5 ||
    rng() < eff(p, "strategy") / 25;
  if (type === "lob") state.attacking[other(p.team)] = false;
  for (const i of teamIndexes(other(p.team))) {
    const o = state.players[i];
    o.reaction = i === state.controlled ? 0 : 0.28 - eff(o, "agility") * 0.018;
  }

  if (type === "smash" || type === "lob") {
    state.event = { key: `game.ev.${type}`, params: { name: p.name } };
    state.eventTimer = 1.2;
  } else if (boost >= 0.7) {
    state.event = { key: "game.ev.power", params: { name: p.name } };
    state.eventTimer = 1.2;
  }
}
