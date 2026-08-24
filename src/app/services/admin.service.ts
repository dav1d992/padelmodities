import { Injectable, signal } from '@angular/core';
import { CREATE_PLAYER_CODE } from '../models/padel.model';

const STORAGE_KEY = 'padel_admin';

/** Tracks whether the current session is authorised as admin. */
@Injectable({ providedIn: 'root' })
export class AdminService {
  readonly isAdmin = signal(this.readStored());

  /** Returns true if the code is correct and admin mode is enabled. */
  login(code: string): boolean {
    if (code.trim().toUpperCase() === CREATE_PLAYER_CODE) {
      this.isAdmin.set(true);
      try {
        sessionStorage.setItem(STORAGE_KEY, '1');
      } catch {
        /* ignore storage errors */
      }
      return true;
    }
    return false;
  }

  logout(): void {
    this.isAdmin.set(false);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore storage errors */
    }
  }

  private readStored(): boolean {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  }
}
