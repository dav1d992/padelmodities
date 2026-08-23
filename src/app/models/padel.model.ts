/** A registered padel player. */
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
  matchesPlayed: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  /** Per-entry record of rating values, keyed by timestamp (ms). */
  ratingHistory?: Record<string, number>;
  createdAt: number;
}

export type TournamentFormat = 'americano' | 'mexicano';
export type TournamentStatus = 'setup' | 'active' | 'finished';

/**
 * A single padel doubles match within a tournament round.
 * Teams are stored as flat fields because Firebase RTDB serialises JS arrays as
 * objects with numeric keys, which can cause subtle bugs on read-back.
 */
export interface TournamentMatch {
  id: string;
  team1p1: string;
  team1p2: string;
  team2p1: string;
  team2p2: string;
  score1?: number;
  score2?: number;
}

export interface TournamentRound {
  index: number;
  completed: boolean;
  matches?: Record<string, TournamentMatch>;
}

export interface Tournament {
  id: string;
  name: string;
  format: TournamentFormat;
  status: TournamentStatus;
  /** Player IDs keyed by insertion index (RTDB-safe). */
  playerIds?: Record<string, string>;
  currentRound: number;
  /** Accumulated tournament points per player. */
  pointsTable?: Record<string, number>;
  rounds?: Record<string, TournamentRound>;
  createdAt: number;
}

/** Access code required to create a new player. */
export const CREATE_PLAYER_CODE = 'QWER';

/** ELO K-factor used when updating global ratings after a match. */
export const ELO_K = 32;
