import { inject, Injectable, signal } from '@angular/core';
import { onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth';
import { get, ref, remove, serverTimestamp, update } from 'firebase/database';
import { FIREBASE_AUTH, FIREBASE_DB } from '../core/firebase';

const STORAGE_KEY = 'padel_admin';
// Must match the 3 attempts / 300000 ms in database.rules.json (adminAttempts).
const MAX_ATTEMPTS = 3;
const LOCKOUT_MS = 5 * 60_000;

interface LoginAttempts {
  count: number;
  at: number;
}

export type AdminLoginResult =
  | { status: 'ok' }
  | { status: 'wrong'; attemptsLeft: number }
  | { status: 'locked'; minutes: number }
  | { status: 'error' };

/**
 * Tracks whether the current user is admin. The code is checked by the
 * database rules against `secrets/adminCode`; `isAdmin` only drives the UI.
 */
@Injectable({ providedIn: 'root' })
export class AdminService {
  readonly #auth = inject(FIREBASE_AUTH);
  readonly #db = inject(FIREBASE_DB);
  // Optimistic hint so admin pages don't redirect before the server check resolves.
  readonly isAdmin = signal(this.readStored());
  #checkId = 0;

  constructor() {
    onAuthStateChanged(this.#auth, (user) => void this.verify(user));
  }

  /** Each try is recorded together with the claim, so the rules can cap tries per lockout window. */
  async login(code: string): Promise<AdminLoginResult> {
    try {
      await this.#auth.authStateReady();
      const user =
        this.#auth.currentUser ?? (await signInAnonymously(this.#auth)).user;
      const attemptsRef = ref(this.#db, `adminAttempts/${user.uid}`);
      const prev = (await get(attemptsRef)).val() as LoginAttempts | null;
      const sinceLast = prev ? Date.now() - prev.at : Infinity;
      const count = prev && sinceLast < LOCKOUT_MS ? prev.count + 1 : 1;
      if (count > MAX_ATTEMPTS) {
        return { status: 'locked', minutes: Math.ceil((LOCKOUT_MS - sinceLast) / 60_000) };
      }
      await update(ref(this.#db), {
        [`adminAttempts/${user.uid}`]: { count, at: serverTimestamp() },
        [`adminClaims/${user.uid}`]: code.trim(),
      });
      await this.verify(user);
      if (this.isAdmin()) return { status: 'ok' };
      if (count >= MAX_ATTEMPTS) {
        return { status: 'locked', minutes: LOCKOUT_MS / 60_000 };
      }
      return { status: 'wrong', attemptsLeft: MAX_ATTEMPTS - count };
    } catch {
      return { status: 'error' };
    }
  }

  async logout(): Promise<void> {
    this.#checkId++;
    this.setAdmin(false);
    const user = this.#auth.currentUser;
    if (!user) return;
    try {
      await remove(ref(this.#db, `adminClaims/${user.uid}`));
    } catch {
      /* ignore network errors */
    }
  }

  /** `adminCheck` is only readable when this user's claim matches the secret code. */
  private async verify(user: User | null): Promise<void> {
    const id = ++this.#checkId;
    let ok = false;
    if (user) {
      try {
        await get(ref(this.#db, 'adminCheck'));
        ok = true;
      } catch {
        ok = false;
      }
    }
    if (id === this.#checkId) this.setAdmin(ok);
  }

  private setAdmin(value: boolean): void {
    this.isAdmin.set(value);
    try {
      if (value) localStorage.setItem(STORAGE_KEY, '1');
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore storage errors */
    }
  }

  private readStored(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }
}
