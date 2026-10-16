import type { Routes } from '@angular/router';
import { LeaderboardComponent } from './pages/leaderboard/leaderboard.component';
import { PlayerDetailComponent } from './pages/player-detail/player-detail.component';
import { CreatePlayerComponent } from './pages/create-player/create-player.component';
import { TournamentSetupComponent } from './pages/tournament-setup/tournament-setup.component';
import { TournamentViewComponent } from './pages/tournament-view/tournament-view.component';
import { SimulationComponent } from './pages/simulation/simulation.component';
import { MexericanoTestComponent } from './pages/mexericano-test/mexericano-test.component';
import { FreeSetupComponent } from './pages/free-setup/free-setup.component';
import { FreeViewComponent } from './pages/free-view/free-view.component';

export const routes: Routes = [
  {
    path: '',
    component: LeaderboardComponent,
    title: 'title.rank',
    data: { description: 'meta.rank' },
  },
  {
    path: 'player/:playerId',
    component: PlayerDetailComponent,
    title: 'title.player',
  },
  {
    path: 'create-player',
    component: CreatePlayerComponent,
    title: 'title.create',
    data: { noindex: true },
  },
  {
    path: 'tournament/new',
    component: TournamentSetupComponent,
    title: 'title.setup',
    data: { noindex: true },
  },
  {
    path: 'tournament/:tournamentId',
    component: TournamentViewComponent,
    title: 'title.view',
    data: { noindex: true },
  },
  {
    path: 'simulate',
    component: SimulationComponent,
    title: 'title.simulate',
    data: { noindex: true },
  },
  {
    path: 'free',
    component: FreeSetupComponent,
    title: 'title.free',
    data: { noindex: true },
  },
  {
    path: 'free/:tournamentId',
    component: FreeViewComponent,
    title: 'title.free',
    data: { noindex: true },
  },
  // Hidden: in-memory Mexericano sandbox. Not linked anywhere.
  {
    path: 'test',
    component: MexericanoTestComponent,
    title: 'Mexericano Test',
    data: { noindex: true },
  },
  { path: '**', redirectTo: '' },
];
