import type { Routes } from '@angular/router';
import { RanglistComponent } from './components/ranglist/ranglist.component';
import { PlayerDetailComponent } from './components/player-detail/player-detail.component';
import { CreatePlayerComponent } from './components/create-player/create-player.component';
import { TournamentSetupComponent } from './components/tournament-setup/tournament-setup.component';
import { TournamentViewComponent } from './components/tournament-view/tournament-view.component';

export const routes: Routes = [
  { path: '', component: RanglistComponent, title: 'title.rank' },
  {
    path: 'player/:playerId',
    component: PlayerDetailComponent,
    title: 'title.player',
  },
  {
    path: 'create-player',
    component: CreatePlayerComponent,
    title: 'title.create',
  },
  {
    path: 'tournament/new',
    component: TournamentSetupComponent,
    title: 'title.setup',
  },
  {
    path: 'tournament/:tournamentId',
    component: TournamentViewComponent,
    title: 'title.view',
  },
  { path: '**', redirectTo: '' },
];
