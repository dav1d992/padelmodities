import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'padel_free_unlocked';

/**
 * Tracks which free tournaments the current browser session has unlocked with
 * their 4-digit code. Unlock is per-tournament and only grants edit rights to
 * that specific free tournament — it has nothing to do with the global admin.
 */
@Injectable({ providedIn: 'root' })
export class FreeAccessService {
  readonly #unlocked = signal<ReadonlySet<string>>(this.readStored());

  /** Reactive check: is this tournament unlocked in the current session? */
  isUnlocked(tournamentId: string): boolean {
    return this.#unlocked().has(tournamentId);
  }

  /** Unlock a tournament if the entered code matches. Returns success. */
  unlock(tournamentId: string, code: string, actualCode: string): boolean {
    if (code.trim() !== actualCode) return false;
    const next = new Set(this.#unlocked());
    next.add(tournamentId);
    this.#unlocked.set(next);
    this.persist(next);
    return true;
  }

  /** Re-lock a tournament (drop edit rights) in the current session. */
  lock(tournamentId: string): void {
    const next = new Set(this.#unlocked());
    next.delete(tournamentId);
    this.#unlocked.set(next);
    this.persist(next);
  }

  private readStored(): ReadonlySet<string> {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set();
    }
  }

  private persist(ids: ReadonlySet<string>): void {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
    } catch {
      /* ignore storage errors */
    }
  }
}
