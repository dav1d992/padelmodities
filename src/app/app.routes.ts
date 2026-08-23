import type { Routes } from '@angular/router';
import { RanglistComponent } from './components/ranglist/ranglist.component';
import { PlayerDetailComponent } from './components/player-detail/player-detail.component';
import { CreatePlayerComponent } from './components/create-player/create-player.component';
import { TournamentSetupComponent } from './components/tournament-setup/tournament-setup.component';
import { TournamentViewComponent } from './components/tournament-view/tournament-view.component';

export const routes: Routes = [
  { path: '', component: RanglistComponent, title: 'Ranglist · Padel' },
  {
    path: 'player/:playerId',
    component: PlayerDetailComponent,
    title: 'Spiller · Padel',
  },
  {
    path: 'create-player',
    component: CreatePlayerComponent,
    title: 'Ny spiller · Padel',
  },
  {
    path: 'tournament/new',
    component: TournamentSetupComponent,
    title: 'Nyt turnering · Padel',
  },
  {
    path: 'tournament/:tournamentId',
    component: TournamentViewComponent,
    title: 'Turnering · Padel',
  },
  { path: '**', redirectTo: '' },
];
