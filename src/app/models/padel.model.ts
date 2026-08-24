/** A registered padel player. */
import { LOCAL_ADMIN_CODE } from '../../environments/admin-code';

export type SkillName =
  | 'power'
  | 'agility'
  | 'stamina'
  | 'reflexes'
  | 'strategy';

export interface Skillset {
  power: number;
  agility: number;
  stamina: number;
  reflexes: number;
  strategy: number;
}

export const SKILL_LABELS: Record<SkillName, string> = {
  power: 'Power',
  agility: 'Agility',
  stamina: 'Stamina',
  reflexes: 'Reflexes',
  strategy: 'Strategy',
};

export const DEFAULT_SKILLSET: Skillset = {
  power: 5,
  agility: 5,
  stamina: 5,
  reflexes: 5,
  strategy: 5,
};

export interface Player {
  id: string;
  name: string;
  /**
   * Short identifier used to locate the player's portrait asset.
   * Image must live at src/app/assets/{shortname}-padel.png and is served
   * at runtime as assets/{shortname}-padel.png.
   */
  shortname?: string;
  /** ELO-style rating, default 1000. */
  rating: number;
  skillset: Skillset;
  matchesPlayed: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  /** Per-entry record of rating values, keyed by timestamp (ms). */
  ratingHistory?: Record<string, number>;
  createdAt: number;
}

export type TournamentFormat =
  | 'americano'
  | 'team-americano'
  | 'mexicano'
  | 'team-mexicano'
  | 'super-mexicano'
  | 'king-of-the-hill';

export type TournamentStatus = 'draft' | 'active' | 'finished';

/** Formats where participants are fixed teams of two rather than individuals. */
export const TEAM_FORMATS: readonly TournamentFormat[] = [
  'team-americano',
  'team-mexicano',
];

/** Formats whose rounds are generated from live standings (regeneration allowed). */
export const DYNAMIC_FORMATS: readonly TournamentFormat[] = [
  'mexicano',
  'team-mexicano',
  'super-mexicano',
  'king-of-the-hill',
];

/** Human-readable labels for each format. */
export const FORMAT_LABELS: Record<TournamentFormat, string> = {
  'americano': 'Americano',
  'team-americano': 'Team Americano',
  'mexicano': 'Mexicano',
  'team-mexicano': 'Team Mexicano',
  'super-mexicano': 'Super Mexicano',
  'king-of-the-hill': 'King of the Hill',
};

export function isTeamFormat(format: TournamentFormat): boolean {
  return TEAM_FORMATS.includes(format);
}

export function isDynamicFormat(format: TournamentFormat): boolean {
  return DYNAMIC_FORMATS.includes(format);
}

// ── Scoring ────────────────────────────────────────────────────────────────

export type ScoringMethod =
  | 'fixed-points' // race to a fixed total (e.g. 16/24/32); sides split the total
  | 'first-to' // first side to reach the target wins
  | 'games-sets' // games and sets
  | 'timed'; // timed round, leader wins

export const SCORING_LABELS: Record<ScoringMethod, string> = {
  'fixed-points': 'Faste point',
  'first-to': 'Først til',
  'games-sets': 'Games & sæt',
  'timed': 'Tid',
};

export interface ScoringConfig {
  method: ScoringMethod;
  /** Point target for fixed-points / first-to. */
  pointTarget: number;
  /** Require a two-point margin to win. */
  winByTwo: boolean;
  /** Sudden-death golden point (overrides win-by-two once reached). */
  goldenPoint: boolean;
  /** Games required to win a set (games-sets). */
  gamesPerSet: number;
  /** Sets required to win a match (games-sets). */
  setsToWin: number;
  /** Minutes per round (timed). */
  minutesPerRound: number;
}

export const DEFAULT_SCORING: ScoringConfig = {
  method: 'fixed-points',
  pointTarget: 24,
  winByTwo: false,
  goldenPoint: false,
  gamesPerSet: 6,
  setsToWin: 1,
  minutesPerRound: 15,
};

/** Court-bonus configuration used by the Super Mexicano format. */
export interface CourtBonusConfig {
  enabled: boolean;
  /** 1-based round from which bonuses start applying. */
  startRound: number;
  /** Award bonus only to the winning side (else everyone on the court). */
  winnersOnly: boolean;
  /** Bonus points keyed by 0-based court index (as string, RTDB-safe). */
  points: Record<string, number>;
}

export const DEFAULT_BONUS: CourtBonusConfig = {
  enabled: true,
  startRound: 1,
  winnersOnly: false,
  points: { '0': 3, '1': 2, '2': 1 },
};

/** A fixed team of two players (team formats). */
export interface TournamentTeam {
  id: string;
  name: string;
  p1: string;
  p2: string;
}

/** A single set result within a games-sets match. */
export interface SetScore {
  a: number;
  b: number;
}

/**
 * A single padel doubles match within a tournament round.
 * Player/team members are stored as flat fields because Firebase RTDB
 * serialises JS arrays as objects with numeric keys.
 */
export interface TournamentMatch {
  id: string;
  /** 0-based court index within the round. */
  courtIndex: number;
  a1: string;
  a2: string;
  b1: string;
  b2: string;
  /** Team ids for team formats (side A / side B). */
  teamAId?: string;
  teamBId?: string;
  /** Primary points for side A / side B. */
  score1?: number;
  score2?: number;
  /** Per-set detail for the games-sets method, keyed by set index. */
  setScores?: Record<string, SetScore>;
}

export interface TournamentRound {
  index: number;
  completed: boolean;
  matches?: Record<string, TournamentMatch>;
  /** Participant ids (players or teams) sitting out this round. */
  sitOutIds?: Record<string, string>;
}

/** Per-player King of the Hill statistics (recomputed from rounds). */
export interface KothStats {
  currentCourt: number;
  lastMovement: 'up' | 'down' | 'stay-top' | 'stay-bottom' | 'none';
  /** Best (lowest) court index reached. 0 = King Court. */
  highestCourt: number;
  wins: number;
  losses: number;
  kingAppearances: number;
  kingWins: number;
  pointsFor: number;
  pointsAgainst: number;
}

export interface Tournament {
  id: string;
  name: string;
  format: TournamentFormat;
  status: TournamentStatus;
  /** Player IDs keyed by insertion index (RTDB-safe) — individual formats. */
  playerIds?: Record<string, string>;
  /** Fixed teams keyed by insertion index — team formats. */
  teams?: Record<string, TournamentTeam>;
  /** Court display names keyed by 0-based index. */
  courtNames?: Record<string, string>;
  courtCount: number;
  /** Planned number of rounds (advisory for round-robin formats). */
  totalRounds: number;
  currentRound: number;
  scoring: ScoringConfig;
  /** Court-bonus config (Super Mexicano only). */
  bonus?: CourtBonusConfig;
  /** Seeded starting order instead of random. */
  seeded: boolean;
  /** Convenience cache of participant → match points (recomputed on write). */
  pointsTable?: Record<string, number>;
  rounds?: Record<string, TournamentRound>;
  createdAt: number;
  updatedAt?: number;
}

/** A computed standings row (players or teams). */
export interface StandingRow {
  participantId: string;
  name: string;
  played: number;
  wins: number;
  losses: number;
  draws: number;
  pointsFor: number;
  pointsAgainst: number;
  diff: number;
  bonus: number;
  matchPoints: number;
  total: number;
  sitOuts: number;
}

/** Admin access code. Injected from the ADMIN_CODE secret in CI; falls back to the local dev code. */
const INJECTED_ADMIN_CODE = '__ADMIN_CODE__';
export const ADMIN_CODE = INJECTED_ADMIN_CODE.startsWith('__') ? LOCAL_ADMIN_CODE : INJECTED_ADMIN_CODE;

/** ELO K-factor used when updating global ratings after a match. */
export const ELO_K = 32;

// ── Match simulation (deterministic, does not affect ratings) ────────────────

/** Total points a simulated match is played to (split across both sides). */
export const SIM_TOTAL_POINTS = 32;

/**
 * Deterministic per-player match strength (0–10) derived from skills.
 *
 * Strategy is weighted the most. A high agility partly compensates for a lack
 * of strategy: the lower the strategy, the more agility lifts it. There is no
 * random factor — the same skillset always yields the same strength.
 */
export function playerMatchStrength(skills: Skillset): number {
  const s = skills.strategy;
  const a = skills.agility;
  // Agility fills part of the gap between current strategy and a perfect 10.
  const effectiveStrategy = Math.min(10, s + (10 - s) * (a / 10) * 0.45);
  return (
    0.22 * effectiveStrategy +
    0.22 * skills.reflexes +
    0.21 * skills.power +
    0.2 * skills.stamina +
    0.15 * a
  );
}

export interface EstimatedScore {
  score1: number;
  score2: number;
  strength1: number;
  strength2: number;
}

/**
 * Estimate a match result out of {@link SIM_TOTAL_POINTS} from two teams' skills.
 * Points are split in proportion to each team's combined strength, with a mild
 * exponent so clear skill gaps produce more decisive scorelines. Fully
 * deterministic — no randomness — and never touches player ratings.
 */
export function estimateMatchScore(
  team1: Skillset[],
  team2: Skillset[],
  totalPoints = SIM_TOTAL_POINTS,
): EstimatedScore {
  const strength1 = team1.reduce((sum, s) => sum + playerMatchStrength(s), 0);
  const strength2 = team2.reduce((sum, s) => sum + playerMatchStrength(s), 0);

  const exponent = 2;
  const p1 = Math.pow(strength1, exponent);
  const p2 = Math.pow(strength2, exponent);
  const ratio = p1 + p2 > 0 ? p1 / (p1 + p2) : 0.5;

  const score1 = Math.max(0, Math.min(totalPoints, Math.round(totalPoints * ratio)));
  return {
    score1,
    score2: totalPoints - score1,
    strength1,
    strength2,
  };
}
