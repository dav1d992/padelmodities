import { inject, Injectable, signal } from '@angular/core';
import { onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth';
import { get, ref, remove, set } from 'firebase/database';
import { FIREBASE_AUTH, FIREBASE_DB } from '../core/firebase';

const STORAGE_KEY = 'padel_admin';

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

  /** Returns true if the database accepted the code. */
  async login(code: string): Promise<boolean> {
    const trimmed = code.trim();
    if (!trimmed) return false;
    try {
      await this.#auth.authStateReady();
      const user =
        this.#auth.currentUser ?? (await signInAnonymously(this.#auth)).user;
      await set(ref(this.#db, `adminClaims/${user.uid}`), trimmed);
      await this.verify(user);
    } catch {
      return false;
    }
    return this.isAdmin();
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
