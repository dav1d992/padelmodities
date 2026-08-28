import { effect, Injectable, signal } from '@angular/core';

export type Lang = 'da' | 'en';

const STORAGE_KEY = 'padel-lang';

type Dict = Record<string, string>;

/** Danish translations. */
const DA: Dict = {
  // App / common
  'app.logout': 'Log ud',
  'app.music': 'Musik',
  'app.sfx': 'Lydeffekter',
  'app.language': 'Sprog',
  'common.back': 'Rangliste',
  'common.cancel': 'Annuller',
  'common.save': '✓ Gem',
  'common.saving': 'Gemmer…',
  'common.edit': '✏️',
  'common.delete': '🗑️',
  'common.editLabel': 'Rediger',
  'common.deleteLabel': 'Slet',
  'common.error': 'Der opstod en fejl.',
  'common.saveError': 'Fejl ved gem.',
  'common.pts': 'pts',

  // Create player
  'create.title': 'Ny spiller',
  'create.subtitle': 'Udfyld spillerens oplysninger.',
  'field.name': 'Navn *',
  'field.shortname': 'Kortnavn *',
  'create.shortnameHint': '(bruges til profilbillede)',
  'create.startRating': 'Startrating',
  'create.defaultRating': 'Standard: 1000',
  'skills.title': 'Egenskaber',
  'skills.range': '0 til 10',
  'skills.range2': '0–10',
  'create.submit': '✓ Opret spiller',
  'create.submitting': 'Opretter…',

  // Skills
  'skill.power': 'Styrke',
  'skill.agility': 'Smidighed',
  'skill.stamina': 'Kondition',
  'skill.control': 'Kontrol',
  'skill.strategy': 'Strategi',

  // Ranglist
  'rank.title': 'Rangliste',
  'rank.brand': 'Danske Padelmodities',
  'rank.newTournament': '＋Turnering',
  'rank.simulate': 'Simulator',
  'rank.addPlayer': '＋Spiller',
  'rank.active': 'Aktive turneringer',
  'rank.drafts': 'Udkast',
  'rank.players': 'Spillere',
  'rank.inactive': 'Inaktive spillere',
  'rank.loading': 'Henter rangliste…',
  'rank.empty': 'Ingen spillere endnu.',
  'rank.addFirst': 'Tilføj første spiller',
  'rank.recent': 'Seneste turneringer',
  'rank.record': '{w}V · {l}T · {m} kampe',
  'badge.draft': 'Udkast',
  'badge.finished': 'Afsluttet',

  // Player detail
  'detail.editPlayer': 'Rediger spiller',
  'detail.shortnamePic': '(profilbillede)',
  'field.rating': 'Rating',
  'field.matches': 'Kampe',
  'field.wins': 'Vundne',
  'field.losses': 'Tabte',
  'field.pointsFor': 'Point for',
  'field.pointsAgainst': 'Point imod',
  'detail.winRate': '{n}% vundne',
  'stat.diff': 'Diff',
  'detail.ratingHistory': 'Rating historik',
  'detail.now': 'Nu: {n} pts',
  'detail.deleteConfirm': 'Slet {name}? Dette kan ikke fortrydes.',

  // Tournament setup
  'setup.title': 'Ny turnering',
  'setup.subtitle': 'Vælg format, deltagere og scoring.',
  'setup.name': 'Turneringens navn *',
  'setup.format': 'Format',
  'setup.scoring': 'Scoring',
  'setup.totalPoints': 'Samlede point',
  'setup.pointsToReach': 'Point at nå',
  'setup.gamesPerSet': 'Games pr. sæt',
  'setup.setsToWin': 'Sæt for sejr',
  'setup.minutesPerRound': 'Minutter pr. runde',
  'setup.timedNote': 'Den førende fører når tiden er gået.',
  'setup.winByTwo': 'Vind med 2',
  'setup.goldenPoint': 'Golden point',
  'setup.courts': 'Baner ({n})',
  'setup.addCourt': '+ Tilføj bane',
  'setup.numRounds': 'Antal runder',
  'setup.roundRobinNote':
    'Team Americano spiller alle mod alle — antal runder beregnes automatisk.',
  'setup.seededKoth': 'Seedet startopstilling',
  'setup.seeded': 'Seedet start (ellers tilfældig)',
  'setup.bonusTitle': 'Bane-bonuspoint',
  'setup.bonusEnable': 'Aktivér bonuspoint',
  'setup.bonusFromRound': 'Bonus starter fra runde',
  'setup.bonusWinnersOnly': 'Kun til vinderne (ellers alle på banen)',
  'setup.pt': 'pt',
  'setup.teams': 'Hold ({n})',
  'setup.pickTwo': 'Vælg 2 spillere for at danne et hold',
  'setup.addTeam': '+ Tilføj hold',
  'setup.choosePlayers': 'Vælg spillere',
  'setup.playersSelected': '{n} spillere valgt',
  'setup.noPlayers': 'Ingen spillere fundet.',
  'setup.createPlayers': 'Opret spillere',
  'setup.first': 'først.',
  'setup.participants': 'Deltagere',
  'setup.teamsCount': '{n} hold',
  'setup.playersCount': '{n} spillere',
  'setup.matchesPerRound': 'Kampe pr. runde',
  'setup.rounds': 'Runder',
  'setup.saveDraft': '💾 Gem udkast',
  'setup.start': '🏆 Start turnering',
  'setup.starting': 'Starter…',

  // Formats (labels are proper nouns — identical in both languages)
  'format.americano': 'Americano',
  'format.team-americano': 'Team Americano',
  'format.mexicano': 'Mexicano',
  'format.team-mexicano': 'Team Mexicano',
  'format.super-mexicano': 'Super Mexicano',
  'format.king-of-the-hill': 'King of the Hill',
  'format.americano.desc': 'Individuelt. Roterende makkere, maks variation.',
  'format.team-americano.desc': 'Faste hold. Alle møder alle (round robin).',
  'format.mexicano.desc': 'Individuelt. Runder efter aktuel stilling.',
  'format.team-mexicano.desc': 'Faste hold. Møder efter stilling.',
  'format.super-mexicano.desc': 'Mexicano med bane-bonuspoint.',
  'format.king-of-the-hill.desc': 'Bane-stige. Vindere op, tabere ned.',

  // Scoring
  'scoring.fixed-points': 'Faste point',
  'scoring.first-to': 'Først til',
  'scoring.games-sets': 'Games & sæt',
  'scoring.timed': 'Tid',

  // Validation
  'val.name': 'Angiv et turneringsnavn.',
  'val.court': 'Tilføj mindst én bane.',
  'val.teams': 'Opret mindst 2 hold.',
  'val.kothCourts': 'King of the Hill kræver mindst 2 baner.',
  'val.kothPlayers':
    'King of the Hill kræver præcis 4 spillere pr. bane ({n} spillere).',
  'val.min4': 'Vælg mindst 4 spillere.',
  'val.fillCourt': 'Ikke nok deltagere til at fylde en bane.',
  'val.minRound': 'Angiv mindst én runde.',
  'val.fairness':
    '{n} {who} sidder over hver runde — oversidning fordeles så retfærdigt som muligt.',
  'who.teams': 'hold',
  'who.players': 'spillere',

  // Courts
  'court.default': 'Bane {n}',
  'court.king': 'Bane 1 (King)',

  // Tournament view
  'status.active': 'Aktiv',
  'status.draft': 'Udkast',
  'status.finished': 'Afsluttet',
  'view.round': 'Runde',
  'view.roundTitle': 'Runde {n}',
  'view.draftSaved': 'Udkast gemt',
  'view.draftHint': 'Rediger opsætningen eller start turneringen.',
  'view.goToNow': 'gå til nu',
  'view.ladder': '👑 Bane-stige',
  'view.kingCourt': 'King Court',
  'view.sittingOut': 'Sidder over:',
  'view.completeRound': '✓ Fuldfør runde',
  'view.enterAll': 'Indtast alle resultater for at fortsætte.',
  'view.regenerate': '🔀 Generér runden igen',
  'view.generating': 'Genererer…',
  'view.finish': '🏁 Afslut turnering',
  'view.resetResult': 'Nulstil resultat',
  'view.kothWin': 'King of the Hill!',
  'view.finished': 'Turnering afsluttet!',
  'view.standings': 'Stilling',
  'view.kothStats': '👑 King of the Hill statistik',
  'view.editWarn':
    'Redigering af en tidligere runde opdaterer stillingen, men senere runder blev genereret ud fra det gamle resultat.',
  'view.finishConfirm': 'Afslut turneringen? Aktuelle resultater bevares.',

  // Table headers
  'th.team': 'Hold',
  'th.player': 'Spiller',
  'th.played': 'K',
  'th.wins': 'V',
  'th.losses': 'T',
  'th.draws': 'U',
  'th.match': 'Match',
  'th.bonus': 'Bonus',
  'th.total': 'Total',
  'th.sitouts': 'Over',
  'th.court': 'Bane',
  'th.best': 'Bedste',
  'th.king': 'King',
  'th.kingWins': 'King V',

  // Errors (service + engine, keyed for translation)
  'err.nameRequired': 'Navn er påkrævet.',
  'err.shortnameRequired': 'Kortnavn er påkrævet.',
  'err.shortnameChars': 'Kortnavn må kun indeholde bogstaver, tal, - og _.',
  'err.ratingRange': 'Rating skal være mellem 0 og 9999.',
  'err.loadPlayers': 'Kunne ikke hente spillere.',
  'err.loadPlayer': 'Kunne ikke hente spiller.',
  'err.draftName': 'Angiv et turneringsnavn for at gemme et udkast.',
  'err.minTeams': 'Team-formater kræver mindst 2 hold.',
  'err.min4': 'En turnering kræver mindst 4 spillere.',
  'err.dynamicOnly': 'Kun dynamiske formater kan genereres om.',
  'err.roundDone': 'Runden er allerede fuldført.',
  'err.regenScores': 'Kan ikke genskabe en runde med indtastede resultater.',
  'err.roundNotFound': 'Aktuel runde ikke fundet.',
  'err.enterBeforeComplete': 'Indtast alle resultater før runden fuldføres.',
  'err.invalidScore': 'Ugyldigt resultat.',
  'err.tournamentNotFound': 'Turnering ikke fundet.',
  'err.americano4': 'Americano kræver mindst 4 spillere.',
  'err.kothWinner': 'King of the Hill kræver en vinder.',
  'err.negative': 'Point kan ikke være negative.',
  'err.kothTie': 'King of the Hill kan ikke ende uafgjort — brug golden point.',
  'err.diff2': 'Der kræves mindst 2 points forskel.',
  'err.sumTo': 'Pointene skal summe til {target}.',
  'err.winnerReach': 'Vinderen skal nå {target} point.',
  'err.kothPlayersGeneric': 'King of the Hill kræver 4 spillere pr. bane.',

  // Simulation
  'sim.title': 'Kampsimulator',
  'sim.subtitle': 'Vælg to hold og se et estimeret resultat ud fra spillernes evner.',
  'sim.teamA': 'Hold A',
  'sim.teamB': 'Hold B',
  'sim.player': 'Spiller',
  'sim.selectPlayer': '— Vælg spiller —',
  'sim.estimate': 'Estimeret resultat',
  'sim.outOf': 'ud af {n} point',
  'sim.strength': 'Spillerstyrke',
  'sim.needPlayers': 'Du skal bruge mindst 4 spillere for at simulere en kamp.',
  'sim.pickAll': 'Vælg to spillere på hvert hold for at se resultatet.',
  'sim.disclaimer': 'Kun et estimat — påvirker ikke rating eller statistik.',

  // Route titles (always English, even in Danish UI)
  'title.rank': 'Ranking · Danske Padelmodities',
  'title.player': 'Player · Danske Padelmodities',
  'title.create': 'New player · Danske Padelmodities',
  'title.setup': 'New tournament · Danske Padelmodities',
  'title.view': 'Tournament · Danske Padelmodities',
  'title.simulate': 'Simulator · Danske Padelmodities',
};

/** English translations. */
const EN: Dict = {
  // App / common
  'app.logout': 'Log out',
  'app.music': 'Music',
  'app.sfx': 'Sound effects',
  'app.language': 'Language',
  'common.back': 'Ranking',
  'common.cancel': 'Cancel',
  'common.save': '✓ Save',
  'common.saving': 'Saving…',
  'common.edit': '✏️',
  'common.delete': '🗑️',
  'common.editLabel': 'Edit',
  'common.deleteLabel': 'Delete',
  'common.error': 'Something went wrong.',
  'common.saveError': 'Error while saving.',
  'common.pts': 'pts',

  // Create player
  'create.title': 'New player',
  'create.subtitle': "Fill in the player's details.",
  'field.name': 'Name *',
  'field.shortname': 'Short name *',
  'create.shortnameHint': '(used for profile picture)',
  'create.startRating': 'Starting rating',
  'create.defaultRating': 'Default: 1000',
  'skills.title': 'Attributes',
  'skills.range': '0 to 10',
  'skills.range2': '0–10',
  'create.submit': '✓ Create player',
  'create.submitting': 'Creating…',

  // Skills
  'skill.power': 'Power',
  'skill.agility': 'Agility',
  'skill.stamina': 'Stamina',
  'skill.control': 'Control',
  'skill.strategy': 'Strategy',

  // Ranglist
  'rank.title': 'Ranking',
  'rank.brand': 'Danske Padelmodities',
  'rank.newTournament': '＋Tournament',
  'rank.simulate': 'Simulator',
  'rank.addPlayer': '＋Player',
  'rank.active': 'Active tournaments',
  'rank.drafts': 'Drafts',
  'rank.players': 'Players',
  'rank.inactive': 'Inactive players',
  'rank.loading': 'Loading ranking…',
  'rank.empty': 'No players yet.',
  'rank.addFirst': 'Add first player',
  'rank.recent': 'Recent tournaments',
  'rank.record': '{w}W · {l}L · {m} matches',
  'badge.draft': 'Draft',
  'badge.finished': 'Finished',

  // Player detail
  'detail.editPlayer': 'Edit player',
  'detail.shortnamePic': '(profile picture)',
  'field.rating': 'Rating',
  'field.matches': 'Matches',
  'field.wins': 'Wins',
  'field.losses': 'Losses',
  'field.pointsFor': 'Points for',
  'field.pointsAgainst': 'Points against',
  'detail.winRate': '{n}% wins',
  'stat.diff': 'Diff',
  'detail.ratingHistory': 'Rating history',
  'detail.now': 'Now: {n} pts',
  'detail.deleteConfirm': 'Delete {name}? This cannot be undone.',

  // Tournament setup
  'setup.title': 'New tournament',
  'setup.subtitle': 'Choose format, participants and scoring.',
  'setup.name': 'Tournament name *',
  'setup.format': 'Format',
  'setup.scoring': 'Scoring',
  'setup.totalPoints': 'Total points',
  'setup.pointsToReach': 'Points to reach',
  'setup.gamesPerSet': 'Games per set',
  'setup.setsToWin': 'Sets to win',
  'setup.minutesPerRound': 'Minutes per round',
  'setup.timedNote': 'The leader wins when time runs out.',
  'setup.winByTwo': 'Win by 2',
  'setup.goldenPoint': 'Golden point',
  'setup.courts': 'Courts ({n})',
  'setup.addCourt': '+ Add court',
  'setup.numRounds': 'Number of rounds',
  'setup.roundRobinNote':
    'Team Americano is round robin — the number of rounds is calculated automatically.',
  'setup.seededKoth': 'Seeded starting lineup',
  'setup.seeded': 'Seeded start (otherwise random)',
  'setup.bonusTitle': 'Court bonus points',
  'setup.bonusEnable': 'Enable bonus points',
  'setup.bonusFromRound': 'Bonus starts from round',
  'setup.bonusWinnersOnly': 'Winners only (otherwise everyone on court)',
  'setup.pt': 'pt',
  'setup.teams': 'Teams ({n})',
  'setup.pickTwo': 'Pick 2 players to form a team',
  'setup.addTeam': '+ Add team',
  'setup.choosePlayers': 'Choose players',
  'setup.playersSelected': '{n} players selected',
  'setup.noPlayers': 'No players found.',
  'setup.createPlayers': 'Create players',
  'setup.first': 'first.',
  'setup.participants': 'Participants',
  'setup.teamsCount': '{n} teams',
  'setup.playersCount': '{n} players',
  'setup.matchesPerRound': 'Matches per round',
  'setup.rounds': 'Rounds',
  'setup.saveDraft': '💾 Save draft',
  'setup.start': '🏆 Start tournament',
  'setup.starting': 'Starting…',

  // Formats
  'format.americano': 'Americano',
  'format.team-americano': 'Team Americano',
  'format.mexicano': 'Mexicano',
  'format.team-mexicano': 'Team Mexicano',
  'format.super-mexicano': 'Super Mexicano',
  'format.king-of-the-hill': 'King of the Hill',
  'format.americano.desc': 'Individual. Rotating partners, maximum variety.',
  'format.team-americano.desc':
    'Fixed teams. Everyone plays everyone (round robin).',
  'format.mexicano.desc': 'Individual. Rounds based on current standings.',
  'format.team-mexicano.desc': 'Fixed teams. Matchups by standings.',
  'format.super-mexicano.desc': 'Mexicano with court bonus points.',
  'format.king-of-the-hill.desc': 'Court ladder. Winners move up, losers down.',

  // Scoring
  'scoring.fixed-points': 'Fixed points',
  'scoring.first-to': 'First to',
  'scoring.games-sets': 'Games & sets',
  'scoring.timed': 'Timed',

  // Validation
  'val.name': 'Enter a tournament name.',
  'val.court': 'Add at least one court.',
  'val.teams': 'Create at least 2 teams.',
  'val.kothCourts': 'King of the Hill requires at least 2 courts.',
  'val.kothPlayers':
    'King of the Hill requires exactly 4 players per court ({n} players).',
  'val.min4': 'Select at least 4 players.',
  'val.fillCourt': 'Not enough participants to fill a court.',
  'val.minRound': 'Enter at least one round.',
  'val.fairness':
    '{n} {who} sit out each round — sit-outs are distributed as fairly as possible.',
  'who.teams': 'teams',
  'who.players': 'players',

  // Courts
  'court.default': 'Court {n}',
  'court.king': 'Court 1 (King)',

  // Tournament view
  'status.active': 'Active',
  'status.draft': 'Draft',
  'status.finished': 'Finished',
  'view.round': 'Round',
  'view.roundTitle': 'Round {n}',
  'view.draftSaved': 'Draft saved',
  'view.draftHint': 'Edit the setup or start the tournament.',
  'view.goToNow': 'go to now',
  'view.ladder': '👑 Court ladder',
  'view.kingCourt': 'King Court',
  'view.sittingOut': 'Sitting out:',
  'view.completeRound': '✓ Complete round',
  'view.enterAll': 'Enter all results to continue.',
  'view.regenerate': '🔀 Regenerate round',
  'view.generating': 'Generating…',
  'view.finish': '🏁 Finish tournament',
  'view.resetResult': 'Reset result',
  'view.kothWin': 'King of the Hill!',
  'view.finished': 'Tournament finished!',
  'view.standings': 'Standings',
  'view.kothStats': '👑 King of the Hill stats',
  'view.editWarn':
    'Editing an earlier round updates the standings, but later rounds were generated from the old result.',
  'view.finishConfirm': 'Finish the tournament? Current results are kept.',

  // Table headers
  'th.team': 'Team',
  'th.player': 'Player',
  'th.played': 'P',
  'th.wins': 'W',
  'th.losses': 'L',
  'th.draws': 'D',
  'th.match': 'Match',
  'th.bonus': 'Bonus',
  'th.total': 'Total',
  'th.sitouts': 'Out',
  'th.court': 'Court',
  'th.best': 'Best',
  'th.king': 'King',
  'th.kingWins': 'King W',

  // Errors
  'err.nameRequired': 'Name is required.',
  'err.shortnameRequired': 'Short name is required.',
  'err.shortnameChars':
    'Short name may only contain letters, numbers, - and _.',
  'err.ratingRange': 'Rating must be between 0 and 9999.',
  'err.loadPlayers': 'Could not load players.',
  'err.loadPlayer': 'Could not load player.',
  'err.draftName': 'Enter a tournament name to save a draft.',
  'err.minTeams': 'Team formats require at least 2 teams.',
  'err.min4': 'A tournament requires at least 4 players.',
  'err.dynamicOnly': 'Only dynamic formats can be regenerated.',
  'err.roundDone': 'The round is already completed.',
  'err.regenScores': 'Cannot regenerate a round with entered results.',
  'err.roundNotFound': 'Current round not found.',
  'err.enterBeforeComplete': 'Enter all results before completing the round.',
  'err.invalidScore': 'Invalid result.',
  'err.tournamentNotFound': 'Tournament not found.',
  'err.americano4': 'Americano requires at least 4 players.',
  'err.kothWinner': 'King of the Hill requires a winner.',
  'err.negative': 'Points cannot be negative.',
  'err.kothTie': 'King of the Hill cannot end in a draw — use golden point.',
  'err.diff2': 'At least a 2-point difference is required.',
  'err.sumTo': 'Points must add up to {target}.',
  'err.winnerReach': 'The winner must reach {target} points.',
  'err.kothPlayersGeneric': 'King of the Hill requires 4 players per court.',

  // Simulation
  'sim.title': 'Match simulator',
  'sim.subtitle': 'Pick two teams and see an estimated result based on player abilities.',
  'sim.teamA': 'Team A',
  'sim.teamB': 'Team B',
  'sim.player': 'Player',
  'sim.selectPlayer': '— Select player —',
  'sim.estimate': 'Estimated result',
  'sim.outOf': 'out of {n} points',
  'sim.strength': 'Player strength',
  'sim.needPlayers': 'You need at least 4 players to simulate a match.',
  'sim.pickAll': 'Pick two players on each team to see the result.',
  'sim.disclaimer': 'Estimate only — does not affect ratings or stats.',

  // Route titles
  'title.rank': 'Ranking · Danske Padelmodities',
  'title.player': 'Player · Danske Padelmodities',
  'title.create': 'New player · Danske Padelmodities',
  'title.setup': 'New tournament · Danske Padelmodities',
  'title.view': 'Tournament · Danske Padelmodities',
  'title.simulate': 'Simulator · Danske Padelmodities',
};

const DICTS: Record<Lang, Dict> = { da: DA, en: EN };

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly _lang = signal<Lang>(this.readInitialLang());

  /** Reactive current language. */
  readonly lang = this._lang.asReadonly();

  constructor() {
    effect(() => {
      const lang = this._lang();
      try {
        localStorage.setItem(STORAGE_KEY, lang);
      } catch {
        /* storage unavailable — ignore */
      }
      if (typeof document !== 'undefined') {
        document.documentElement.lang = lang;
      }
    });
  }

  setLang(lang: Lang): void {
    this._lang.set(lang);
  }

  toggle(): void {
    this._lang.set(this._lang() === 'da' ? 'en' : 'da');
  }

  /**
   * Translate a key for the current language. Supports {param} interpolation.
   * Falls back to English, then to the raw key/text if not found — so passing
   * an already-translated string or unknown error message is safe.
   */
  t(key: string | undefined | null, params?: Record<string, string | number>): string {
    if (!key) return '';
    const lang = this._lang();
    const text = DICTS[lang][key] ?? DICTS.en[key] ?? key;
    if (!params) return text;
    return text.replace(/\{(\w+)\}/g, (_, p) =>
      params[p] !== undefined ? String(params[p]) : `{${p}}`,
    );
  }

  private readInitialLang(): Lang {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'da' || stored === 'en') return stored;
    } catch {
      /* ignore */
    }
    return 'da';
  }
}
