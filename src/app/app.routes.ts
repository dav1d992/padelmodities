import type { Routes } from '@angular/router';
import { LeaderboardComponent } from './components/leaderboard/leaderboard.component';
import { PlayerDetailComponent } from './components/player-detail/player-detail.component';
import { CreatePlayerComponent } from './components/create-player/create-player.component';
import { TournamentSetupComponent } from './components/tournament-setup/tournament-setup.component';
import { TournamentViewComponent } from './components/tournament-view/tournament-view.component';
import { SimulationComponent } from './components/simulation/simulation.component';

export const routes: Routes = [
  { path: '', component: LeaderboardComponent, title: 'title.rank' },
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
  {
    path: 'simulate',
    component: SimulationComponent,
    title: 'title.simulate',
  },
  { path: '**', redirectTo: '' },
];
