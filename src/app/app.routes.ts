import type { Routes } from '@angular/router';
import { LeaderboardComponent } from './pages/leaderboard/leaderboard.component';
import { PlayerDetailComponent } from './pages/player-detail/player-detail.component';
import { CreatePlayerComponent } from './pages/create-player/create-player.component';
import { TournamentSetupComponent } from './pages/tournament-setup/tournament-setup.component';
import { TournamentViewComponent } from './pages/tournament-view/tournament-view.component';
import { SimulationComponent } from './pages/simulation/simulation.component';
import { MexericanoTestComponent } from './pages/mexericano-test/mexericano-test.component';

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
  // Hidden: in-memory Mexericano sandbox. Not linked anywhere.
  { path: 'test', component: MexericanoTestComponent, title: 'Mexericano Test' },
  { path: '**', redirectTo: '' },
];
