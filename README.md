# Danske Padelmodities 

A **mobile-first padel ranking & tournament app** for Danske Padelmodities.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Angular 22 (standalone components, `provideRouter` + `withComponentInputBinding`, zone change detection with event coalescing) |
| Backend | Firebase **Realtime Database** — no custom server |
| Hosting | Firebase Hosting with SPA rewrite to `/index.html` |
| Styling | SCSS, mobile-responsive, dark padel theme |

## Features

### Leaderboard (home)
- All registered players sorted by ELO rating
- 🥇🥈🥉 medals for top 3
- Player avatars, W/L record, and point total at a glance
- Quick links to active and finished tournaments

### Players
- **Create player** (access-code gated — code: `QWER`)
- Name, optional image URL, and custom starting rating
- Full stats page: rating, matches played, wins, losses, point difference
- Rating history sparkline chart
- Delete player

> **Image storage** — We store an *external URL* (e.g. Imgur) rather than base64
> data. Firebase Realtime Database nodes are limited to a few MB; a single
> base64-encoded photo easily exceeds that. Users upload their photo to any
> image host and paste the URL.

### Tournaments

#### Americano
All rounds are **pre-generated at creation** using the Berger/circle rotation
method. For N players (even, min 4) this produces N−1 rounds each with ⌊N/4⌋
courts. Partners rotate every round so each player eventually partners with
every other player exactly once.

#### Mexicano
Pairs are determined **dynamically after each round** based on current
standings: within each group of 4 (sorted by accumulated points), 1st+4th
play against 2nd+3rd.

Both formats:
- Enter scores per match (score1 / score2)
- Complete a round to advance and auto-generate the next
- Live points leaderboard updates after every completed round
- Global ELO ratings (K=32) are updated when a round is completed

### Rating system
- Every player starts at **1000** (configurable at creation)
- After each round, ELO deltas are calculated per match and applied to global
  ratings
- Both members of a doubles team share the same delta based on their team's
  average rating vs the opponents' average rating

## Project structure

```
src/app/
  core/              firebase.ts — shared FIREBASE_DB injection token
  models/            padel.model.ts — TypeScript interfaces & constants
  services/          padel.service.ts — all Realtime DB reads & writes
  components/
    leaderboard/       Home / leaderboard
    player-detail/     Player stats & sparkline
    create-player/     Code-gated player creation form
    tournament-setup/  Create tournament (format + player selection)
    tournament-view/   Live round view with score entry
```

## Getting started

```bash
npm install
```

Copy `src/environments/environment.ts`, fill in your Firebase project values
(see [Firebase console](https://console.firebase.google.com/)), then:

```bash
npm start          # dev server → http://localhost:4200
npm run deploy     # build + firebase deploy
```

## Database rules
`database.rules.json` enforces strict per-node `.validate` rules:
- Required fields are whitelisted; extra keys are rejected via `$other: false`
- String lengths are capped
- Numeric ranges are enforced (rating ≤ 9999, scores ≤ 99)
- Root listing is denied (`.read: false` at root)
