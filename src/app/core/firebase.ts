import { InjectionToken } from '@angular/core';
import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getDatabase, type Database } from 'firebase/database';
import { environment } from '../../environments/environment';

/** Single Firebase app + Realtime Database instance for the whole application. */
const firebaseApp: FirebaseApp = initializeApp(environment.firebase);
const database: Database = getDatabase(firebaseApp);

/** Inject the shared Realtime Database instance. */
export const FIREBASE_DB = new InjectionToken<Database>('FIREBASE_DB', {
  providedIn: 'root',
  factory: () => database,
});
