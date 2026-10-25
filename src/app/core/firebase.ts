import { InjectionToken } from '@angular/core';
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getDatabase, type Database } from 'firebase/database';
import { environment } from '../../environments/environment';

/** Single Firebase app + Realtime Database instance for the whole application. */
const firebaseApp: FirebaseApp = initializeApp(environment.firebase);
const database: Database = getDatabase(firebaseApp);
const auth: Auth = getAuth(firebaseApp);

/** Inject the shared Realtime Database instance. */
export const FIREBASE_DB = new InjectionToken<Database>('FIREBASE_DB', {
  providedIn: 'root',
  factory: () => database,
});

/** Inject the shared Firebase Auth instance. */
export const FIREBASE_AUTH = new InjectionToken<Auth>('FIREBASE_AUTH', {
  providedIn: 'root',
  factory: () => auth,
});
