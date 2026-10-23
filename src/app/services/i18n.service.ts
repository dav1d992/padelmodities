import { effect, Injectable, signal } from "@angular/core";

export type Lang = "da" | "en";

const STORAGE_KEY = "padel-lang";

type Dict = Record<string, string>;

/** Danish translations. */
const DA: Dict = {
  // App / common
  "app.logout": "Log ud",
  "app.music": "Musik",
  "app.language": "Sprog",
  "app.disclaimer":
    "Danske Padelmodities er et uofficielt padel-fællesskab og er ikke tilknyttet Danske Commodities.",
  "app.xmasOn": "Aktivér juletema",
  "app.xmasOff": "Deaktivér juletema",
  "app.halloweenOn": "Aktivér halloween-tema",
  "app.halloweenOff": "Deaktivér halloween-tema",
  "common.back": "Rangliste",
  "common.cancel": "Annuller",
  "common.confirm": "Bekræft",
  "common.save": "✓ Gem",
  "common.saving": "Gemmer…",
  "common.edit": "✏️",
  "common.delete": "🗑️",
  "common.editLabel": "Rediger",
  "common.deleteLabel": "Slet",
  "common.error": "Der opstod en fejl.",
  "common.saveError": "Fejl ved gem.",
  "common.elo": "Elo",

  // Create player
  "create.title": "Ny spiller",
  "create.subtitle": "Udfyld spillerens oplysninger.",
  "field.name": "Navn *",
  "field.shortname": "Kortnavn *",
  "create.shortnameHint": "(bruges til profilbillede)",
  "create.startRating": "Startrating",
  "create.defaultRating": "Standard: 1000",
  "skills.title": "Egenskaber",
  "skills.range": "0 til 10",
  "skills.range2": "0–10",
  "create.submit": "✓ Opret spiller",
  "create.submitting": "Opretter…",

  // Skills
  "skill.power": "Styrke",
  "skill.agility": "Smidighed",
  "skill.stamina": "Kondition",
  "skill.control": "Kontrol",
  "skill.strategy": "Strategi",

  // Ranglist
  "rank.title": "Rangliste",
  "rank.brand": "Danske Padelmodities",
  "rank.newTournament": "＋Turnering",
  "rank.simulate": "Simulator",
  "rank.addPlayer": "＋Spiller",
  "rank.active": "Aktive turneringer",
  "rank.drafts": "Kommende",
  "rank.players": "Spillere",
  "rank.inactive": "Inaktive spillere",
  "rank.loading": "Henter rangliste…",
  "rank.empty": "Ingen spillere endnu.",
  "rank.addFirst": "Tilføj første spiller",
  "rank.recent": "Seneste turneringer",
  "rank.record": "{w}V · {l}T · {d}U",
  "rank.searchPlaceholder": "Søg efter spiller…",
  "rank.searchEmpty": "Ingen spillere matcher \"{q}\".",
  "badge.draft": "Kommende",
  "badge.finished": "Afsluttet",

  // Player detail
  "detail.editPlayer": "Rediger spiller",
  "detail.shortnamePic": "(profilbillede)",
  "detail.video": "Video",
  "detail.playVideo": "Promo video",
  "field.rating": "Rating",
  "field.matches": "Kampe",
  "field.wins": "Vundne",
  "field.losses": "Tabte",
  "field.pointsFor": "Point for",
  "field.pointsAgainst": "Point imod",
  "detail.winRate": "{n}% vundne",
  "stat.diff": "Diff",
  "detail.ratingHistory": "Rating historik",
  "detail.now": "Nu: {n} Elo",
  "detail.deleteConfirm": "Slet {name}? Dette kan ikke fortrydes.",

  // Achievements
  "achievements.title": "Præstationer",
  "achievement.bagel.name": "Bagel",
  "achievement.bagel.desc": "Vind en kamp uden at modstanderne scorer et point.",
  "achievement.demolition.name": "Nedrivning",
  "achievement.demolition.desc": "Vind en kamp med mindst 80% af pointene.",
  "achievement.wall.name": "Muren",
  "achievement.wall.desc":
    "Hold modstanderne under 25% af pointene i 3 kampe i træk.",
  "achievement.tyrant.name": "Turneringstyran",
  "achievement.tyrant.desc":
    "Tag mindst 65% af alle point i en afsluttet turnering.",
  "achievement.iceCold.name": "Iskold",
  "achievement.iceCold.desc": "Vind 3 kampe i træk med præcis 1 point.",
  "achievement.razorsEdge.name": "Knivskarp",
  "achievement.razorsEdge.desc":
    "Vind 5 kampe med præcis 1 point i én turnering.",
  "achievement.soClose.name": "Så tæt på",
  "achievement.soClose.desc": "Tab 5 kampe med præcis 1 point.",
  "achievement.bageled.name": "Bagel'et",
  "achievement.bageled.desc": "Tab en kamp uden at score et point.",
  "achievement.deadEven.name": "Dødt løb",
  "achievement.deadEven.desc": "Spil 3 kampe, der ender uafgjort.",
  "achievement.biggestWin.name": "Største sejr nogensinde",
  "achievement.biggestWin.desc":
    "Hold rekorden for den største sejrsmargin i en enkelt kamp.",
  "achievement.pointRecord.name": "Pointrekord",
  "achievement.pointRecord.desc":
    "Hold rekorden for flest point scoret i én turnering.",
  "achievement.ironDefense.name": "Jernforsvar",
  "achievement.ironDefense.desc":
    "Hold rekorden for den laveste andel af point afgivet i en turnering.",
  "achievement.onFire.name": "Brandvarm",
  "achievement.onFire.desc": "Vind 5 kampe i træk.",
  "achievement.unstoppable.name": "Ustoppelig",
  "achievement.unstoppable.desc": "Vind 10 kampe i træk.",
  "achievement.legendary.name": "Legendarisk",
  "achievement.legendary.desc": "Vind 15 kampe i træk.",
  "achievement.unbeaten.name": "Ubesejret",
  "achievement.unbeaten.desc":
    "Gennemfør en turnering uden at tabe en kamp.",
  "achievement.backToBack.name": "Back-to-Back",
  "achievement.backToBack.desc": "Vind to turneringer i træk.",
  "achievement.podiumStreak.name": "Podiestime",
  "achievement.podiumStreak.desc": "Slut i top 3 i tre turneringer i træk.",
  "achievement.rising.name": "På vej op",
  "achievement.rising.desc": "Stig i rating i fem turneringer i træk.",
  "achievement.coldStreak.name": "Kold stime",
  "achievement.coldStreak.desc": "Tab 5 kampe i træk.",
  "achievement.iceAge.name": "Istid",
  "achievement.iceAge.desc": "Tab 10 kampe i træk.",
  "achievement.zeroHero.name": "Nul sejre",
  "achievement.zeroHero.desc":
    "Gennemfør en turnering uden at vinde en kamp.",
  "achievement.phoenix.name": "Føniks",
  "achievement.phoenix.desc":
    "Vind 5 i træk lige efter at have tabt 5 i træk.",
  "achievement.streakBreaker.name": "Stimebryder",
  "achievement.streakBreaker.desc":
    "Slå en spiller, der havde vundet 5 eller flere kampe i træk.",
  "achievement.rollercoaster.name": "Rutsjebane",
  "achievement.rollercoaster.desc":
    "Skift mellem sejr og nederlag 6 kampe i træk.",
  "achievement.chemistry.name": "Kemi",
  "achievement.chemistry.desc":
    "Vind mindst 75% af 8 eller flere kampe med samme makker.",
  "achievement.revenge.name": "Hævn",
  "achievement.revenge.desc": "Slå et par, der slog dig sidste gang I mødtes.",
  "achievement.kingslayer.name": "Kongedræber",
  "achievement.kingslayer.desc":
    "Slå turneringens højest ratede spiller eller hold.",
  "achievement.davidVsGoliath.name": "David mod Goliat",
  "achievement.davidVsGoliath.desc":
    "Vind en kamp, hvor jeres rating var mindst 150 under modstandernes.",
  "achievement.zeroToHero.name": "Fra nul til helt",
  "achievement.zeroToHero.desc":
    "Vær sidst efter runde 1 og slut i top 3.",
  "achievement.bridesmaid.name": "Evig toer",
  "achievement.bridesmaid.desc": "Slut på 2.-pladsen i tre turneringer.",
  "achievement.woodenSpoon.name": "Træskeen",
  "achievement.woodenSpoon.desc": "Slut sidst i en turnering.",

  // Skill badges
  "achievement.precisionMachine.name": "Præcisionsmaskinen",
  "achievement.precisionMachine.desc":
    "Høj kontrol. Rammer et frimærke fra baglinjen.",
  "achievement.surgeon.name": "Kirurgen",
  "achievement.surgeon.desc":
    "Høj kontrol og høj strategi. Skærer modstanderne op med kirurgisk præcision og en plan.",
  "achievement.metronome.name": "Metronomen",
  "achievement.metronome.desc":
    "Høj kontrol og høj udholdenhed. Samme perfekte slag, igen og igen og igen.",
  "achievement.vibora.name": "Víboraen",
  "achievement.vibora.desc":
    "Høj kontrol og høj styrke. Hård og præcis — bolden hvæser som en slange.",
  "achievement.ninja.name": "Ninja",
  "achievement.ninja.desc":
    "Høj kontrol og høj smidighed. Lydløs, lynhurtig og altid på rette sted.",
  "achievement.lobMachine.name": "Lobmaskinen",
  "achievement.lobMachine.desc":
    "Høj kontrol og lav styrke. Kan ikke smashe, men lobber dig til vanvid.",
  "achievement.sniper.name": "Snigskytten",
  "achievement.sniper.desc":
    "Høj kontrol og lav smidighed. Bevæger sig knap nok, men rammer plet hver gang.",
  "achievement.sundayPlayer.name": "Søndagsspiller",
  "achievement.sundayPlayer.desc":
    "Høj kontrol og lav udholdenhed. Smukke slag — så længe det varer.",
  "achievement.bulldozer.name": "Bulldozer",
  "achievement.bulldozer.desc":
    "Lav kontrol og høj styrke. Slår hårdt. Hvor bolden lander er en overraskelse for alle.",
  "achievement.pinball.name": "Flipperkugle",
  "achievement.pinball.desc":
    "Lav kontrol og høj smidighed. Overalt på banen, og bolden flyver alle vegne.",
  "achievement.workhorse.name": "Arbejdshesten",
  "achievement.workhorse.desc":
    "Lav kontrol og høj udholdenhed. Henter alt, rammer sjældent, giver aldrig op.",
  "achievement.wildShot.name": "Vildskud",
  "achievement.wildShot.desc":
    "Lav kontrol og høj strategi. Kender den perfekte plan. Udførelsen... ikke så meget.",
  "achievement.looseCannon.name": "Løs kanon",
  "achievement.looseCannon.desc":
    "Lav kontrol og lav strategi. Ingen plan, ingen kontrol — rent kaos.",
  "achievement.pillowFight.name": "Pudekamp",
  "achievement.pillowFight.desc":
    "Lav kontrol og lav styrke. Slår bløde bolde ingen steder hen.",
  "achievement.oldMan.name": "Gammel mand",
  "achievement.oldMan.desc":
    "Lav smidighed og lav udholdenhed. Knæene knager, men erfaringen består.",
  "achievement.glassCannon.name": "Glaskanon",
  "achievement.glassCannon.desc":
    "Høj styrke og lav udholdenhed. Knalder hårdt i tre slag, så er tanken tom.",
  "achievement.professor.name": "Professoren",
  "achievement.professor.desc":
    "Høj strategi og lav styrke. Udtænker dit nederlag — men kan ikke selv afslutte det.",
  "achievement.chessPlayer.name": "Skakspilleren",
  "achievement.chessPlayer.desc":
    "Høj strategi og lav smidighed. Tænker fem træk frem, kommer to skridt for sent.",
  "achievement.headlessChicken.name": "Hovedløs høne",
  "achievement.headlessChicken.desc":
    "Høj smidighed og lav strategi. Lynhurtig i alle de forkerte retninger.",
  "achievement.roadRunner.name": "Road Runner",
  "achievement.roadRunner.desc":
    "Høj smidighed og lav styrke. Beep beep! Henter alt, men pufer bolden tilbage.",
  "achievement.couchPotato.name": "Sofakartoffel",
  "achievement.couchPotato.desc":
    "Lav styrke og lav udholdenhed. Foretrækker en god volley fra sofaen.",
  "achievement.duracell.name": "Duracell",
  "achievement.duracell.desc":
    "Høj udholdenhed og høj smidighed. Bliver ved og ved og ved...",
  "achievement.tank.name": "Tanken",
  "achievement.tank.desc":
    "Høj styrke og høj udholdenhed. Kører dig over — og bliver ved hele dagen.",
  "achievement.rookie.name": "Nybegynder",
  "achievement.rookie.desc":
    "Alle færdigheder helt i bunden. Alle starter et sted. Det her er stedet.",
  "achievement.allRounder.name": "Allrounder",
  "achievement.allRounder.desc":
    "Alle færdigheder højt oppe. God til alt, uden svage punkter.",
  "achievement.average.name": "Den Balancerede",
  "achievement.average.desc":
    "Alle færdigheder i midten. Lige god og dårlig all-around.",
  "achievement.perfectionist.name": "Perfektionist",
  "achievement.perfectionist.desc":
    "En færdighed helt i top. Lærebogsperfekt til noget.",

  // Tournament setup
  "setup.title": "Ny turnering",
  "setup.subtitle": "Vælg format, deltagere og scoring.",
  "setup.name": "Turneringens navn *",
  "setup.description": "Beskrivelse",
  "setup.descriptionHint": "(valgfri — vises for alle)",
  "setup.format": "Format",
  "setup.scoring": "Scoring",
  "setup.totalPoints": "Samlede point",
  "setup.pointsToReach": "Point at nå",
  "setup.gamesPerSet": "Games pr. sæt",
  "setup.setsToWin": "Sæt for sejr",
  "setup.minutesPerRound": "Minutter pr. runde",
  "setup.timedNote": "Den førende fører når tiden er gået.",
  "setup.winByTwo": "Vind med 2",
  "setup.goldenPoint": "Golden point",
  "setup.courts": "Baner ({n})",
  "setup.addCourt": "+ Tilføj bane",
  "setup.numRounds": "Antal runder",
  "setup.roundRobinNote":
    "Team Americano spiller alle mod alle — antal runder beregnes automatisk.",
  "setup.seededKoth": "Seedet startopstilling",
  "setup.seeded": "Seedet start (ellers tilfældig)",
  "setup.bonusTitle": "Bane-bonuspoint",
  "setup.bonusEnable": "Aktivér bonuspoint",
  "setup.bonusFromRound": "Bonus starter fra runde",
  "setup.bonusWinnersOnly": "Kun til vinderne (ellers alle på banen)",
  "setup.pt": "pt",
  "setup.teams": "Hold ({n})",
  "setup.pickTwo": "Vælg 2 spillere for at danne et hold",
  "setup.addTeam": "+ Tilføj hold",
  "setup.choosePlayers": "Vælg spillere",
  "setup.playersSelected": "{n} spillere valgt",
  "setup.noPlayers": "Ingen spillere fundet.",
  "setup.createPlayers": "Opret spillere",
  "setup.first": "først.",
  "setup.participants": "Deltagere",
  "setup.teamsCount": "{n} hold",
  "setup.playersCount": "{n} spillere",
  "setup.matchesPerRound": "Kampe pr. runde",
  "setup.rounds": "Runder",
  "setup.twoPhase": "To faser (seedning + finale)",
  "setup.twoPhaseHint":
    "Spil et seedningsformat først, derefter et finaleformat. Point fra begge faser tæller med i den samlede stilling.",
  "setup.seatingFormat": "Seedningsformat",
  "setup.finalFormat": "Finaleformat",
  "setup.seatingRounds": "Runder i seedningsfasen",
  "setup.finalRounds": "Runder i finalefasen",
  "setup.totalRoundsInfo": "I alt {n} runder",
  "setup.phases": "Faser",
  "setup.saveDraft": "Gem som kommende",
  "setup.start": "Start turnering",
  "setup.starting": "Starter…",

  // Formats (labels are proper nouns — identical in both languages)
  "format.americano": "Americano",
  "format.team-americano": "Team Americano",
  "format.mexicano": "Mexicano",
  "format.team-mexicano": "Team Mexicano",
  "format.super-mexicano": "Super Mexicano",
  "format.mexericano": "Mexericano",
  "format.king-of-the-hill": "King of the Hill",
  "format.beat-the-box": "Beat the Box",
  "format.americano.desc": "Individuelt. Roterende makkere, maks variation.",
  "format.team-americano.desc": "Faste hold. Alle møder alle (round robin).",
  "format.mexicano.desc": "Individuelt. Runder efter aktuel stilling.",
  "format.team-mexicano.desc": "Faste hold. Møder efter stilling.",
  "format.super-mexicano.desc": "Mexicano med bane-bonuspoint.",
  "format.mexericano.desc":
    "Konkurrencepræget matchmaking med roterende makkere og modstandere.",
  "format.mexericano.details":
    "Sådan fungerer Mexericano:\n" +
    "• Runde 1 er tilfældig — alle starter lige.\n" +
    "• Fra runde 2 rangeres spillerne efter point og deles i baner med fire (bane 1 = de fire bedste). En lille ±6-blanding holder dig mod spillere på dit niveau.\n" +
    "• På hver bane vælges holdene, så I undgår gentagne makkere og modstandere, aldrig spiller den samme firer igen, og holdene er jævnbyrdige.\n" +
    "• Bane-bonus: højere baner giver flere point (fx bane 1 = 3, bane 2 = 2, bane 3 = 1) oveni dine kamppoint. Bonus starter først, når feltet har sat sig (de første baner−1 runder giver ingen), og kan gives til alle på banen eller kun vinderne.\n" +
    "• Går tallene ikke op, sidder den, der har siddet mindst over, over næste gang.\n" +
    "• Dine samlede point er de point du vinder i hver kamp plus eventuel bane-bonus. Finalerunden samler de fire bedste for at afgøre vinderen.\n" +
    "• Rating (Elo): når en turnering slutter, tæller den endelige stilling som indbyrdes kampe — du har 'slået' alle under dig og 'tabt' til alle over dig. Hver af dem vurderes med almindelig Elo ud fra jeres ratings, så du vinder mere ved at slå et stærkt felt og mindre, når du var favorit. Højst ca. ±64 Elo pr. turnering (nulsum).",
  "format.king-of-the-hill.desc": "Bane-stige. Vindere op, tabere ned.",
  "format.beat-the-box.desc":
    "ELO-seedede eller tilfældige firspillerbokse. Tre Americano-kampe; de to bedste rykker op, de to nederste ned.",

  // Scoring
  "scoring.fixed-points": "Faste point",
  "scoring.first-to": "Først til",
  "scoring.games-sets": "Games & sæt",
  "scoring.timed": "Tid",

  // Validation
  "val.name": "Angiv et turneringsnavn.",
  "val.court": "Tilføj mindst én bane.",
  "val.teams": "Opret mindst 2 hold.",
  "val.kothCourts": "King of the Hill kræver mindst 2 baner.",
  "val.kothPlayers":
    "King of the Hill kræver præcis 4 spillere pr. bane ({n} spillere).",
  "val.min4": "Vælg mindst 4 spillere.",
  "val.fillCourt": "Ikke nok deltagere til at fylde en bane.",
  "val.minRound": "Angiv mindst én runde.",
  "val.beatBoxRounds":
    "Antal runder skal være deleligt med 3, så alle makkerkombinationer spilles.",
  "val.beatBoxSeatingRounds":
    "Beat the Box som seedningsformat kræver runder deleligt med 3.",
  "val.beatBoxFinalRounds":
    "Beat the Box som finaleformat kræver runder deleligt med 3.",
  "val.twoPhaseNoRoundRobin":
    "Team Americano kan ikke bruges i en to-fase-turnering.",
  "val.twoPhaseTeamMismatch":
    "Begge faser skal være enten individuelle eller hold-formater.",
  "val.twoPhaseSeatingRounds": "Angiv mindst én runde i seedningsfasen.",
  "val.twoPhaseFinalRounds": "Angiv mindst én runde i finalefasen.",
  "val.fairness":
    "{n} {who} sidder over hver runde — oversidning fordeles så retfærdigt som muligt.",
  "who.teams": "hold",
  "who.players": "spillere",

  // Courts
  "court.default": "Bane {n}",
  "court.king": "Bane 1 (King)",

  // Tournament view
  "status.active": "Aktiv",
  "status.draft": "Kommende",
  "status.finished": "Afsluttet",
  "view.round": "Runde",
  "view.roundTitle": "Runde {n}",
  "view.seatingPhase": "Seedning",
  "view.finalPhase": "Finale",
  "view.draftSaved": "Kommende turnering gemt",
  "view.deleteTournament": "Slet turnering",
  "view.deleteConfirm": "Slet turneringen „{name}”? Dette kan ikke fortrydes.",
  "view.draftHint": "Rediger opsætningen eller start turneringen.",
  "view.goToNow": "gå til nu",
  "view.ladder": "Bane-stige",
  "view.kingCourt": "King Court",
  "view.sittingOut": "Sidder over:",
  "view.completeRound": "Fuldfør runde",
  "view.enterAll": "Indtast alle resultater for at fortsætte.",
  "view.boxScored": "{n}/{total} resultater",
  "view.regenerate": "Generér runden igen",
  "view.generating": "Genererer…",
  "view.finish": "Afslut turnering",
  "view.resetResult": "Nulstil resultat",
  "view.tryTest": "Prøvekørsel",
  "view.exitTest": "Afslut prøvekørsel",
  "view.testBanner":
    "Prøvekørsel — intet gemmes, og spillernes statistik påvirkes ikke.",
  "view.showMore": "Vis mere",
  "view.showLess": "Vis mindre",
  "view.kothWin": "King of the Hill!",
  "view.finished": "Turnering afsluttet!",
  "view.winnerWon": "{name} vandt!",
  "view.murder": "MORD!",
  "view.standings": "Stilling",
  "view.kothStats": "King of the Hill statistik",
  "view.editWarn":
    "Redigering af en tidligere runde opdaterer stillingen, men senere runder blev genereret ud fra det gamle resultat.",
  "view.finishConfirm": "Afslut turneringen?",
  "view.finishConfirmTest": "Afslut prøvekørslen? Intet gemmes.",
  "view.runFinal": "Kør finalerunde",
  "view.finalGenerating": "Genererer finale…",
  "view.finalGenerated": "Finalerunde genereret",
  "view.finalRound": "Finalerunde",
  "view.finalHasScores": "Ryd resultaterne i runden for at køre finalen",
  "view.finalBadge": "Finale",
  "view.nextNormal": "Næste: normal runde",
  "view.nextFinal": "Næste: finalerunde",
  "view.finalConfirm": "Kør finalerunden nu?",
  "view.finalConfirmTest": "Kør finalerunden i prøvekørslen? Intet gemmes.",

  // Table headers
  "th.team": "Hold",
  "th.player": "Spiller",
  "th.played": "K",
  "th.wins": "V",
  "th.losses": "T",
  "th.draws": "U",
  "th.match": "Match",
  "th.bonus": "Bonus",
  "th.total": "Point",
  "th.elo": "ELO",
  "th.expected": "Forv.",
  "th.expectedHint": "Forventet placering ud fra rating",
  "th.breakEven": "Nulpunkt",
  "th.breakEvenHint": "Slut her eller bedre for ikke at tabe Elo",
  "th.sitouts": "Over",
  "th.court": "Bane",
  "th.best": "Bedste",
  "th.king": "King",
  "th.kingWins": "King V",

  // Errors (service + engine, keyed for translation)
  "err.nameRequired": "Navn er påkrævet.",
  "err.shortnameRequired": "Kortnavn er påkrævet.",
  "err.shortnameChars": "Kortnavn må kun indeholde bogstaver, tal, - og _.",
  "err.ratingRange": "Rating skal være mellem 0 og 9999.",
  "err.loadPlayers": "Kunne ikke hente spillere.",
  "err.loadPlayer": "Kunne ikke hente spiller.",
  "err.draftName":
    "Angiv et turneringsnavn for at gemme en kommende turnering.",
  "err.minTeams": "Team-formater kræver mindst 2 hold.",
  "err.min4": "En turnering kræver mindst 4 spillere.",
  "err.dynamicOnly": "Kun dynamiske formater kan genereres om.",
  "err.roundDone": "Runden er allerede fuldført.",
  "err.regenScores": "Kan ikke genskabe en runde med indtastede resultater.",
  "err.scoreAlreadySaved": "Resultatet er allerede gemt. Kun en admin kan rette det.",
  "err.roundNotFound": "Aktuel runde ikke fundet.",
  "err.enterBeforeComplete": "Indtast alle resultater før runden fuldføres.",
  "err.invalidScore": "Ugyldigt resultat.",
  "err.tournamentNotFound": "Turnering ikke fundet.",
  "err.americano4": "Americano kræver mindst 4 spillere.",
  "err.mexericano4": "Mexericano kræver mindst 4 spillere.",
  "err.mexericanoOnly": "Kun Mexericano-turneringer har en finalerunde.",
  "err.notActive": "Turneringen er ikke aktiv.",
  "err.finalNeedsRound": "Mindst én runde skal være fuldført før finalen.",
  "err.finalExists": "Finalerunden er allerede genereret.",
  "err.kothWinner": "King of the Hill kræver en vinder.",
  "err.negative": "Point kan ikke være negative.",
  "err.kothTie": "King of the Hill kan ikke ende uafgjort — brug golden point.",
  "err.diff2": "Der kræves mindst 2 points forskel.",
  "err.sumTo": "Pointene skal summe til {target}.",
  "err.winnerReach": "Vinderen skal nå {target} point.",
  "err.kothPlayersGeneric": "King of the Hill kræver 4 spillere pr. bane.",

  // Simulation
  "sim.title": "Kampsimulator",
  "sim.subtitle":
    "Vælg to hold og se et estimeret resultat ud fra spillernes evner.",
  "sim.teamA": "Hold A",
  "sim.teamB": "Hold B",
  "sim.player": "Spiller",
  "sim.selectPlayer": "— Vælg spiller —",
  "sim.estimate": "Estimeret resultat",
  "sim.outOf": "ud af {n} point",
  "sim.strength": "Spillerstyrke",
  "sim.needPlayers": "Du skal bruge mindst 4 spillere for at simulere en kamp.",
  "sim.pickAll": "Vælg to spillere på hvert hold for at se resultatet.",
  "sim.disclaimer": "Kun et estimat — påvirker ikke rating eller statistik.",
  "sim.historyTitle": "Tidligere opgør",
  "sim.historySubtitle": "Gange disse to hold har mødt hinanden før.",

  // Test sandbox
  "test.title": "Turneringssandkasse",
  "test.subtitle": "Testside in-memory — intet gemmes.",
  "test.config": "Opsætning",
  "test.players": "Spillere",
  "test.playersTeam": "Spillere",
  "test.courts": "Baner",
  "test.pointsPerMatch": "Point pr. kamp",
  "test.rounds": "Runder",
  "test.randomResults": "Tilfældige resultater",
  "test.roundCompleted": "Runde fuldført.",
  "test.diagnostics": "Rotationsdiagnostik",
  "test.backToBack": "makkere i træk",
  "test.partnerRepeats": "makkerpar gentaget",
  "test.opponentRepeats": "modstanderpar gentaget",
  "test.foursomeRepeats": "præcise opgør gentaget",
  "test.diagnosticsHint":
    "Lavere er bedre. Gentagelser sker kun når de er uundgåelige.",
  "test.reset": "Nulstil sandkasse",
  "test.playerName": "Spiller {n}",
  "test.teamName": "Hold {n}",

  // Free mode
  "th.wl": "V–T",
  "th.diff": "Diff",
  "view.winner": "Vinder",
  "view.confirmFinish": "Afslut turneringen nu?",
  "free.navLink": "Fri turnering",
  "free.badge": "Fri",
  "free.setup.title": "Ny fri turnering",
  "free.setup.editTitle": "Rediger turnering",
  "free.editSettings": "Rediger indstillinger",
  "free.list.show": "Vis alle turneringer",
  "free.list.hide": "Skjul turneringer",
  "free.list.empty": "Ingen frie turneringer endnu.",
  "free.setup.subtitle":
    "Vært en turnering uden spillerprofiler. Deltagere er blot navne, og intet gemmes på ranglisten.",
  "free.setup.code": "4-cifret kode *",
  "free.setup.codeHint": "(bruges til at låse op for redigering)",
  "free.setup.create": "Opret turnering",
  "free.setup.participantsNote":
    "Du tilføjer deltagere inde i turneringen, når den er oprettet.",
  "free.val.code": "Vælg en 4-cifret kode.",
  "free.backCreate": "Ny fri turnering",
  "free.unlock": "Lås op",
  "free.enterCode": "Indtast koden",
  "free.wrongCode": "Forkert kode. Prøv igen.",
  "free.locked.relock": "Lås",
  "free.locked.hint":
    "Denne turnering er låst. Tryk på Lås op og indtast den 4-cifrede kode for at redigere.",
  "free.participants": "Deltagere ({n})",
  "free.addParticipant": "+ Tilføj",
  "free.participantPlaceholder": "Deltagerens navn",
  "free.noParticipants": "Ingen deltagere endnu. Tilføj navne ovenfor.",
  "free.teamNamePlaceholder": "Holdnavn (valgfrit)",
  "free.confirmRemoveParticipant": "Fjern {name}?",
  "free.confirmDelete": "Slet denne turnering permanent?",
  "free.confirmDeleteNamed": 'Slet "{name}" permanent?',
  "free.startHint": "Tilføj nok deltagere for at starte turneringen.",

  // Route titles (always English, even in Danish UI)
  "title.rank": "Ranking · Danske Padelmodities",
  "title.player": "Player · Danske Padelmodities",
  "title.create": "New player · Danske Padelmodities",
  "title.setup": "New tournament · Danske Padelmodities",
  "title.view": "Tournament · Danske Padelmodities",
  "title.simulate": "Simulator · Danske Padelmodities",
  "title.free": "Free tournament · Danske Padelmodities",
  "title.playerNamed": "{name} · Danske Padelmodities",

  // Search engine descriptions
  "meta.default":
    "Ranking og turneringer for Danske Padelmodities. Følg din padel-rating live og spil Americano eller Mexicano.",
  "meta.rank":
    "Live padel-ranking for Danske Padelmodities — uofficielt padel-fællesskab, ikke tilknyttet Danske Commodities. Se rating og statistik.",
  "meta.player":
    "{name} har en padel-rating på {rating} efter {matches} kampe og {wins} sejre. Se statistik og ratinghistorik hos Danske Padelmodities.",
};

/** English translations. */
const EN: Dict = {
  // App / common
  "app.logout": "Log out",
  "app.music": "Music",
  "app.language": "Language",
  "app.disclaimer":
    "Danske Padelmodities is an unofficial padel community and is not affiliated with Danske Commodities.",
  "app.xmasOn": "Enable Christmas theme",
  "app.xmasOff": "Disable Christmas theme",
  "app.halloweenOn": "Enable Halloween theme",
  "app.halloweenOff": "Disable Halloween theme",
  "common.back": "Ranking",
  "common.cancel": "Cancel",
  "common.confirm": "Confirm",
  "common.save": "✓ Save",
  "common.saving": "Saving…",
  "common.edit": "✏️",
  "common.delete": "🗑️",
  "common.editLabel": "Edit",
  "common.deleteLabel": "Delete",
  "common.error": "Something went wrong.",
  "common.saveError": "Error while saving.",
  "common.elo": "Elo",

  // Create player
  "create.title": "New player",
  "create.subtitle": "Fill in the player's details.",
  "field.name": "Name *",
  "field.shortname": "Short name *",
  "create.shortnameHint": "(used for profile picture)",
  "create.startRating": "Starting rating",
  "create.defaultRating": "Default: 1000",
  "skills.title": "Attributes",
  "skills.range": "0 to 10",
  "skills.range2": "0–10",
  "create.submit": "✓ Create player",
  "create.submitting": "Creating…",

  // Skills
  "skill.power": "Power",
  "skill.agility": "Agility",
  "skill.stamina": "Stamina",
  "skill.control": "Control",
  "skill.strategy": "Strategy",

  // Ranglist
  "rank.title": "Ranking",
  "rank.brand": "Danske Padelmodities",
  "rank.newTournament": "＋Tournament",
  "rank.simulate": "Simulator",
  "rank.addPlayer": "＋Player",
  "rank.active": "Active tournaments",
  "rank.drafts": "Upcoming",
  "rank.players": "Players",
  "rank.inactive": "Inactive players",
  "rank.loading": "Loading ranking…",
  "rank.empty": "No players yet.",
  "rank.addFirst": "Add first player",
  "rank.recent": "Recent tournaments",
  "rank.record": "{w}W · {l}L · {d}D",
  "rank.searchPlaceholder": "Search for a player…",
  "rank.searchEmpty": "No players match \"{q}\".",
  "badge.draft": "Upcoming",
  "badge.finished": "Finished",

  // Player detail
  "detail.editPlayer": "Edit player",
  "detail.shortnamePic": "(profile picture)",
  "detail.video": "Video",
  "detail.playVideo": "Promo video",
  "field.rating": "Rating",
  "field.matches": "Matches",
  "field.wins": "Wins",
  "field.losses": "Losses",
  "field.pointsFor": "Points for",
  "field.pointsAgainst": "Points against",
  "detail.winRate": "{n}% wins",
  "stat.diff": "Diff",
  "detail.ratingHistory": "Rating history",
  "detail.now": "Now: {n} Elo",
  "detail.deleteConfirm": "Delete {name}? This cannot be undone.",

  // Achievements
  "achievements.title": "Achievements",
  "achievement.bagel.name": "Bagel",
  "achievement.bagel.desc":
    "Win a match without the opponents scoring a point.",
  "achievement.demolition.name": "Demolition",
  "achievement.demolition.desc": "Win a match taking at least 80% of the points.",
  "achievement.wall.name": "The Wall",
  "achievement.wall.desc":
    "Hold the opponents under 25% of the points in 3 matches in a row.",
  "achievement.tyrant.name": "Tournament Tyrant",
  "achievement.tyrant.desc":
    "Take at least 65% of all points in a finished tournament.",
  "achievement.iceCold.name": "Ice Cold",
  "achievement.iceCold.desc": "Win 3 matches in a row by exactly 1 point.",
  "achievement.razorsEdge.name": "Razor's Edge",
  "achievement.razorsEdge.desc":
    "Win 5 matches by exactly 1 point in a single tournament.",
  "achievement.soClose.name": "So Close",
  "achievement.soClose.desc": "Lose 5 matches by exactly 1 point.",
  "achievement.bageled.name": "Bageled",
  "achievement.bageled.desc": "Lose a match without scoring a point.",
  "achievement.deadEven.name": "Dead Even",
  "achievement.deadEven.desc": "Play 3 matches that end in a draw.",
  "achievement.biggestWin.name": "Biggest Win Ever",
  "achievement.biggestWin.desc":
    "Hold the record for the largest winning margin in a single match.",
  "achievement.pointRecord.name": "Point Record",
  "achievement.pointRecord.desc":
    "Hold the record for most points scored in a single tournament.",
  "achievement.ironDefense.name": "Iron Defense",
  "achievement.ironDefense.desc":
    "Hold the record for the lowest share of points conceded in a tournament.",
  "achievement.onFire.name": "On Fire",
  "achievement.onFire.desc": "Win 5 matches in a row.",
  "achievement.unstoppable.name": "Unstoppable",
  "achievement.unstoppable.desc": "Win 10 matches in a row.",
  "achievement.legendary.name": "Legendary",
  "achievement.legendary.desc": "Win 15 matches in a row.",
  "achievement.unbeaten.name": "Unbeaten",
  "achievement.unbeaten.desc":
    "Finish a tournament without losing a match.",
  "achievement.backToBack.name": "Back-to-Back",
  "achievement.backToBack.desc": "Win two tournaments in a row.",
  "achievement.podiumStreak.name": "Podium Streak",
  "achievement.podiumStreak.desc": "Finish top 3 in three tournaments in a row.",
  "achievement.rising.name": "Rising",
  "achievement.rising.desc": "Gain rating in five tournaments in a row.",
  "achievement.coldStreak.name": "Cold Streak",
  "achievement.coldStreak.desc": "Lose 5 matches in a row.",
  "achievement.iceAge.name": "Ice Age",
  "achievement.iceAge.desc": "Lose 10 matches in a row.",
  "achievement.zeroHero.name": "Zero Hero",
  "achievement.zeroHero.desc":
    "Finish a tournament without winning a match.",
  "achievement.phoenix.name": "Phoenix",
  "achievement.phoenix.desc":
    "Win 5 in a row straight after losing 5 in a row.",
  "achievement.streakBreaker.name": "Streak Breaker",
  "achievement.streakBreaker.desc":
    "Beat a player who had won 5 or more matches in a row.",
  "achievement.rollercoaster.name": "Rollercoaster",
  "achievement.rollercoaster.desc":
    "Alternate between winning and losing over 6 matches in a row.",
  "achievement.chemistry.name": "Chemistry",
  "achievement.chemistry.desc":
    "Win at least 75% of 8 or more matches with the same partner.",
  "achievement.revenge.name": "Revenge",
  "achievement.revenge.desc": "Beat a pair that beat you the last time you met.",
  "achievement.kingslayer.name": "Kingslayer",
  "achievement.kingslayer.desc":
    "Beat the highest-rated player or team in a tournament.",
  "achievement.davidVsGoliath.name": "David vs Goliath",
  "achievement.davidVsGoliath.desc":
    "Win a match where your side's rating was at least 150 below the opponents'.",
  "achievement.zeroToHero.name": "Zero to Hero",
  "achievement.zeroToHero.desc":
    "Be last after round 1 and finish top 3.",
  "achievement.bridesmaid.name": "Bridesmaid",
  "achievement.bridesmaid.desc": "Finish 2nd in three tournaments.",
  "achievement.woodenSpoon.name": "Wooden Spoon",
  "achievement.woodenSpoon.desc": "Finish last in a tournament.",

  // Skill badges
  "achievement.precisionMachine.name": "Precision Machine",
  "achievement.precisionMachine.desc":
    "High control. Can hit a postage stamp from the baseline.",
  "achievement.surgeon.name": "The Surgeon",
  "achievement.surgeon.desc":
    "High control and high strategy. Carves opponents open with surgical precision and a plan.",
  "achievement.metronome.name": "The Metronome",
  "achievement.metronome.desc":
    "High control and high stamina. The same perfect shot, over and over and over.",
  "achievement.vibora.name": "The Víbora",
  "achievement.vibora.desc":
    "High control and high power. Hard and precise — the ball hisses like a snake.",
  "achievement.ninja.name": "Ninja",
  "achievement.ninja.desc":
    "High control and high agility. Silent, lightning-fast and always in the right spot.",
  "achievement.lobMachine.name": "Lob Machine",
  "achievement.lobMachine.desc":
    "High control and low power. Can't smash, but will lob you into madness.",
  "achievement.sniper.name": "The Sniper",
  "achievement.sniper.desc":
    "High control and low agility. Barely moves, but hits the mark every time.",
  "achievement.sundayPlayer.name": "Sunday Player",
  "achievement.sundayPlayer.desc":
    "High control and low stamina. Beautiful shots — for as long as they last.",
  "achievement.bulldozer.name": "Bulldozer",
  "achievement.bulldozer.desc":
    "Low control and high power. Hits hard. Where it lands surprises everyone.",
  "achievement.pinball.name": "Pinball",
  "achievement.pinball.desc":
    "Low control and high agility. All over the court, ball flying everywhere.",
  "achievement.workhorse.name": "Workhorse",
  "achievement.workhorse.desc":
    "Low control and high stamina. Chases everything, hits little, never gives up.",
  "achievement.wildShot.name": "Wild Shot",
  "achievement.wildShot.desc":
    "Low control and high strategy. Knows the perfect plan. The execution... not so much.",
  "achievement.looseCannon.name": "Loose Cannon",
  "achievement.looseCannon.desc":
    "Low control and low strategy. No plan, no control — pure chaos.",
  "achievement.pillowFight.name": "Pillow Fight",
  "achievement.pillowFight.desc":
    "Low control and low power. Soft shots going nowhere.",
  "achievement.oldMan.name": "Old Man",
  "achievement.oldMan.desc":
    "Low agility and low stamina. The knees creak, but the wisdom remains.",
  "achievement.glassCannon.name": "Glass Cannon",
  "achievement.glassCannon.desc":
    "High power and low stamina. Booms for three shots, then the tank's empty.",
  "achievement.professor.name": "The Professor",
  "achievement.professor.desc":
    "High strategy and low power. Plots your defeat — but can't finish it off.",
  "achievement.chessPlayer.name": "Chess Player",
  "achievement.chessPlayer.desc":
    "High strategy and low agility. Thinks five moves ahead, arrives two steps late.",
  "achievement.headlessChicken.name": "Headless Chicken",
  "achievement.headlessChicken.desc":
    "High agility and low strategy. Lightning-fast in all the wrong directions.",
  "achievement.roadRunner.name": "Road Runner",
  "achievement.roadRunner.desc":
    "High agility and low power. Beep beep! Gets everything, dinks it back.",
  "achievement.couchPotato.name": "Couch Potato",
  "achievement.couchPotato.desc":
    "Low power and low stamina. Prefers a good volley from the couch.",
  "achievement.duracell.name": "Duracell",
  "achievement.duracell.desc":
    "High stamina and high agility. Keeps going and going and going...",
  "achievement.tank.name": "The Tank",
  "achievement.tank.desc":
    "High power and high stamina. Rolls over you — and keeps it up all day.",
  "achievement.rookie.name": "Rookie",
  "achievement.rookie.desc":
    "Every skill at rock bottom. Everyone starts somewhere. This is that somewhere.",
  "achievement.allRounder.name": "All-Rounder",
  "achievement.allRounder.desc":
    "Every skill up high. Good at everything, no weak spots.",
  "achievement.average.name": "Perfectly Balanced",
  "achievement.average.desc":
    "Every skill right in the middle. Equally good and bad all-around.",
  "achievement.perfectionist.name": "Perfectionist",
  "achievement.perfectionist.desc":
    "A skill maxed to the very top. Textbook perfect at something.",

  // Tournament setup
  "setup.title": "New tournament",
  "setup.subtitle": "Choose format, participants and scoring.",
  "setup.name": "Tournament name *",
  "setup.description": "Description",
  "setup.descriptionHint": "(optional — visible to everyone)",
  "setup.format": "Format",
  "setup.scoring": "Scoring",
  "setup.totalPoints": "Total points",
  "setup.pointsToReach": "Points to reach",
  "setup.gamesPerSet": "Games per set",
  "setup.setsToWin": "Sets to win",
  "setup.minutesPerRound": "Minutes per round",
  "setup.timedNote": "The leader wins when time runs out.",
  "setup.winByTwo": "Win by 2",
  "setup.goldenPoint": "Golden point",
  "setup.courts": "Courts ({n})",
  "setup.addCourt": "+ Add court",
  "setup.numRounds": "Number of rounds",
  "setup.roundRobinNote":
    "Team Americano is round robin — the number of rounds is calculated automatically.",
  "setup.seededKoth": "Seeded starting lineup",
  "setup.seeded": "Seeded start (otherwise random)",
  "setup.bonusTitle": "Court bonus points",
  "setup.bonusEnable": "Enable bonus points",
  "setup.bonusFromRound": "Bonus starts from round",
  "setup.bonusWinnersOnly": "Winners only (otherwise everyone on court)",
  "setup.pt": "pt",
  "setup.teams": "Teams ({n})",
  "setup.pickTwo": "Pick 2 players to form a team",
  "setup.addTeam": "+ Add team",
  "setup.choosePlayers": "Choose players",
  "setup.playersSelected": "{n} players selected",
  "setup.noPlayers": "No players found.",
  "setup.createPlayers": "Create players",
  "setup.first": "first.",
  "setup.participants": "Participants",
  "setup.teamsCount": "{n} teams",
  "setup.playersCount": "{n} players",
  "setup.matchesPerRound": "Matches per round",
  "setup.rounds": "Rounds",
  "setup.twoPhase": "Two phases (seating + final)",
  "setup.twoPhaseHint":
    "Play a seating format first, then a final format. Points from both phases count towards the overall standings.",
  "setup.seatingFormat": "Seating format",
  "setup.finalFormat": "Final format",
  "setup.seatingRounds": "Seating-phase rounds",
  "setup.finalRounds": "Final-phase rounds",
  "setup.totalRoundsInfo": "{n} rounds total",
  "setup.phases": "Phases",
  "setup.saveDraft": "Save as upcoming",
  "setup.start": "Start tournament",
  "setup.starting": "Starting…",

  // Formats
  "format.americano": "Americano",
  "format.team-americano": "Team Americano",
  "format.mexicano": "Mexicano",
  "format.team-mexicano": "Team Mexicano",
  "format.super-mexicano": "Super Mexicano",
  "format.mexericano": "Mexericano",
  "format.king-of-the-hill": "King of the Hill",
  "format.beat-the-box": "Beat the Box",
  "format.americano.desc": "Individual. Rotating partners, maximum variety.",
  "format.team-americano.desc":
    "Fixed teams. Everyone plays everyone (round robin).",
  "format.mexicano.desc": "Individual. Rounds based on current standings.",
  "format.team-mexicano.desc": "Fixed teams. Matchups by standings.",
  "format.super-mexicano.desc": "Mexicano with court bonus points.",
  "format.mexericano.desc":
    "Competitive matchmaking with rotating partners and opponents.",
  "format.mexericano.details":
    "How Mexericano works:\n" +
    "• Round 1 is random — everyone starts equal.\n" +
    "• From round 2, players are ranked by points and split into courts of four (court 1 = the top four). A small ±6 shuffle keeps you against players near your level.\n" +
    "• On each court, teams are picked to avoid repeat partners and opponents, never replay the same four, and keep both teams even.\n" +
    "• Court bonus: higher courts award more points (e.g. court 1 = 3, court 2 = 2, court 3 = 1), added on top of your match points. Bonuses only start after the field has settled (the first courts−1 rounds give none), and can be set to reward everyone on the court or the winners only.\n" +
    "• When numbers don't divide evenly, whoever has sat out least sits out next.\n" +
    "• Your total is the points you win in each match plus any court bonus. The final round groups the top four to decide the winner.\n" +
    "• Rating (Elo): when a tournament ends, the final standings count as head-to-head results — you 'beat' everyone below you and 'lost' to everyone above you. Each is scored with normal Elo from your ratings, so beating a strong field earns more and winning as the favourite earns less. At most about ±64 Elo per tournament (zero-sum).",
  "format.king-of-the-hill.desc": "Court ladder. Winners move up, losers down.",
  "format.beat-the-box.desc":
    "ELO-seeded or random boxes of four. Three Americano matches; the top two move up and the bottom two move down.",

  // Scoring
  "scoring.fixed-points": "Fixed points",
  "scoring.first-to": "First to",
  "scoring.games-sets": "Games & sets",
  "scoring.timed": "Timed",

  // Validation
  "val.name": "Enter a tournament name.",
  "val.court": "Add at least one court.",
  "val.teams": "Create at least 2 teams.",
  "val.kothCourts": "King of the Hill requires at least 2 courts.",
  "val.kothPlayers":
    "King of the Hill requires exactly 4 players per court ({n} players).",
  "val.min4": "Select at least 4 players.",
  "val.fillCourt": "Not enough participants to fill a court.",
  "val.minRound": "Enter at least one round.",
  "val.beatBoxRounds":
    "Number of rounds must be divisible by 3 so every partner combination is played.",
  "val.beatBoxSeatingRounds":
    "Beat the Box as the seating format requires rounds divisible by 3.",
  "val.beatBoxFinalRounds":
    "Beat the Box as the final format requires rounds divisible by 3.",
  "val.twoPhaseNoRoundRobin":
    "Team Americano can't be used in a two-phase tournament.",
  "val.twoPhaseTeamMismatch":
    "Both phases must be either individual or team formats.",
  "val.twoPhaseSeatingRounds": "Enter at least one seating-phase round.",
  "val.twoPhaseFinalRounds": "Enter at least one final-phase round.",
  "val.fairness":
    "{n} {who} sit out each round — sit-outs are distributed as fairly as possible.",
  "who.teams": "teams",
  "who.players": "players",

  // Courts
  "court.default": "Court {n}",
  "court.king": "Court 1 (King)",

  // Tournament view
  "status.active": "Active",
  "status.draft": "Upcoming",
  "status.finished": "Finished",
  "view.round": "Round",
  "view.roundTitle": "Round {n}",
  "view.seatingPhase": "Seating",
  "view.finalPhase": "Final",
  "view.draftSaved": "Upcoming tournament saved",
  "view.deleteTournament": "Delete tournament",
  "view.deleteConfirm":
    "Delete the tournament “{name}”? This cannot be undone.",
  "view.draftHint": "Edit the setup or start the tournament.",
  "view.goToNow": "go to now",
  "view.ladder": "Court ladder",
  "view.kingCourt": "King Court",
  "view.sittingOut": "Sitting out:",
  "view.completeRound": "Complete round",
  "view.enterAll": "Enter all results to continue.",
  "view.boxScored": "{n}/{total} results",
  "view.regenerate": "Regenerate round",
  "view.generating": "Generating…",
  "view.finish": "Finish tournament",
  "view.resetResult": "Reset result",
  "view.tryTest": "Test run",
  "view.exitTest": "Exit test run",
  "view.testBanner":
    "Test run — nothing is saved and player stats are not affected.",
  "view.showMore": "Show more",
  "view.showLess": "Show less",
  "view.kothWin": "King of the Hill!",
  "view.finished": "Tournament finished!",
  "view.winnerWon": "{name} won!",
  "view.murder": "MURDER!",
  "view.standings": "Standings",
  "view.kothStats": "King of the Hill stats",
  "view.editWarn":
    "Editing an earlier round updates the standings, but later rounds were generated from the old result.",
  "view.finishConfirm": "Finish the tournament?",
  "view.finishConfirmTest": "End the test run? Nothing is saved.",
  "view.runFinal": "Run final round",
  "view.finalGenerating": "Generating final…",
  "view.finalGenerated": "Final round generated",
  "view.finalRound": "Final round",
  "view.finalHasScores": "Clear the round's results to run the final",
  "view.finalBadge": "Final",
  "view.nextNormal": "Next: normal round",
  "view.nextFinal": "Next: final round",
  "view.finalConfirm": "Run the final round now?",
  "view.finalConfirmTest":
    "Run the final round in the test run? Nothing is saved.",

  // Table headers
  "th.team": "Team",
  "th.player": "Player",
  "th.played": "P",
  "th.wins": "W",
  "th.losses": "L",
  "th.draws": "D",
  "th.match": "Match",
  "th.bonus": "Bonus",
  "th.total": "Points",
  "th.elo": "ELO",
  "th.expected": "Exp.",
  "th.expectedHint": "Expected placement based on rating",
  "th.breakEven": "Break-even",
  "th.breakEvenHint": "Finish here or better to not lose Elo",
  "th.sitouts": "Out",
  "th.court": "Court",
  "th.best": "Best",
  "th.king": "King",
  "th.kingWins": "King W",

  // Errors
  "err.nameRequired": "Name is required.",
  "err.shortnameRequired": "Short name is required.",
  "err.shortnameChars":
    "Short name may only contain letters, numbers, - and _.",
  "err.ratingRange": "Rating must be between 0 and 9999.",
  "err.loadPlayers": "Could not load players.",
  "err.loadPlayer": "Could not load player.",
  "err.draftName": "Enter a tournament name to save an upcoming tournament.",
  "err.minTeams": "Team formats require at least 2 teams.",
  "err.min4": "A tournament requires at least 4 players.",
  "err.dynamicOnly": "Only dynamic formats can be regenerated.",
  "err.roundDone": "The round is already completed.",
  "err.regenScores": "Cannot regenerate a round with entered results.",
  "err.scoreAlreadySaved": "This result is already saved. Only an admin can change it.",
  "err.roundNotFound": "Current round not found.",
  "err.enterBeforeComplete": "Enter all results before completing the round.",
  "err.invalidScore": "Invalid result.",
  "err.tournamentNotFound": "Tournament not found.",
  "err.americano4": "Americano requires at least 4 players.",
  "err.mexericano4": "Mexericano requires at least 4 players.",
  "err.mexericanoOnly": "Only Mexericano tournaments have a final round.",
  "err.notActive": "The tournament is not active.",
  "err.finalNeedsRound":
    "At least one round must be completed before the final.",
  "err.finalExists": "The final round has already been generated.",
  "err.kothWinner": "King of the Hill requires a winner.",
  "err.negative": "Points cannot be negative.",
  "err.kothTie": "King of the Hill cannot end in a draw — use golden point.",
  "err.diff2": "At least a 2-point difference is required.",
  "err.sumTo": "Points must add up to {target}.",
  "err.winnerReach": "The winner must reach {target} points.",
  "err.kothPlayersGeneric": "King of the Hill requires 4 players per court.",

  // Simulation
  "sim.title": "Match simulator",
  "sim.subtitle":
    "Pick two teams and see an estimated result based on player abilities.",
  "sim.teamA": "Team A",
  "sim.teamB": "Team B",
  "sim.player": "Player",
  "sim.selectPlayer": "— Select player —",
  "sim.estimate": "Estimated result",
  "sim.outOf": "out of {n} points",
  "sim.strength": "Player strength",
  "sim.needPlayers": "You need at least 4 players to simulate a match.",
  "sim.pickAll": "Pick two players on each team to see the result.",
  "sim.disclaimer": "Estimate only — does not affect ratings or stats.",
  "sim.historyTitle": "Previous meetings",
  "sim.historySubtitle": "Times these two teams have faced each other before.",

  // Test sandbox
  "test.title": "Tournament Sandbox",
  "test.subtitle": "In-memory test page — nothing is saved.",
  "test.config": "Configuration",
  "test.players": "Players",
  "test.playersTeam": "Players",
  "test.courts": "Courts",
  "test.pointsPerMatch": "Points per match",
  "test.rounds": "Rounds",
  "test.randomResults": "Random results",
  "test.roundCompleted": "Round completed.",
  "test.diagnostics": "Rotation diagnostics",
  "test.backToBack": "back-to-back partners",
  "test.partnerRepeats": "partner pairs repeated",
  "test.opponentRepeats": "opponent pairs repeated",
  "test.foursomeRepeats": "exact matchups repeated",
  "test.diagnosticsHint":
    "Lower is better. Repeats only occur when unavoidable.",
  "test.reset": "Reset sandbox",
  "test.playerName": "Player {n}",
  "test.teamName": "Team {n}",

  // Free mode
  "th.wl": "W–L",
  "th.diff": "Diff",
  "view.winner": "Winner",
  "view.confirmFinish": "Finish the tournament now?",
  "free.navLink": "Free tournament",
  "free.badge": "Free",
  "free.setup.title": "New free tournament",
  "free.setup.editTitle": "Edit tournament",
  "free.editSettings": "Edit settings",
  "free.list.show": "View all tournaments",
  "free.list.hide": "Hide tournaments",
  "free.list.empty": "No free tournaments yet.",
  "free.setup.subtitle":
    "Host a tournament without player profiles. Participants are just names, and nothing is saved to the leaderboard.",
  "free.setup.code": "4-digit code *",
  "free.setup.codeHint": "(used to unlock editing)",
  "free.setup.create": "Create tournament",
  "free.setup.participantsNote":
    "You'll add participants inside the tournament once it's created.",
  "free.val.code": "Choose a 4-digit code.",
  "free.backCreate": "New free tournament",
  "free.unlock": "Unlock",
  "free.enterCode": "Enter the code",
  "free.wrongCode": "Wrong code. Try again.",
  "free.locked.relock": "Lock",
  "free.locked.hint":
    "This tournament is locked. Tap Unlock and enter the 4-digit code to edit.",
  "free.participants": "Participants ({n})",
  "free.addParticipant": "+ Add",
  "free.participantPlaceholder": "Participant name",
  "free.noParticipants": "No participants yet. Add names above.",
  "free.teamNamePlaceholder": "Team name (optional)",
  "free.confirmRemoveParticipant": "Remove {name}?",
  "free.confirmDelete": "Permanently delete this tournament?",
  "free.confirmDeleteNamed": 'Permanently delete "{name}"?',
  "free.startHint": "Add enough participants to start the tournament.",

  // Route titles
  "title.rank": "Ranking · Danske Padelmodities",
  "title.player": "Player · Danske Padelmodities",
  "title.create": "New player · Danske Padelmodities",
  "title.setup": "New tournament · Danske Padelmodities",
  "title.view": "Tournament · Danske Padelmodities",
  "title.simulate": "Simulator · Danske Padelmodities",
  "title.free": "Free tournament · Danske Padelmodities",
  "title.playerNamed": "{name} · Danske Padelmodities",

  // Search engine descriptions
  "meta.default":
    "Rankings and tournaments for Danske Padelmodities. Track your padel rating live and play Americano or Mexicano.",
  "meta.rank":
    "Live padel rankings for Danske Padelmodities — an unofficial padel community, not affiliated with Danske Commodities.",
  "meta.player":
    "{name} has a padel rating of {rating} after {matches} matches and {wins} wins. See stats and rating history at Danske Padelmodities.",
};

const DICTS: Record<Lang, Dict> = { da: DA, en: EN };

@Injectable({ providedIn: "root" })
export class I18nService {
  readonly #lang = signal<Lang>(this.readInitialLang());

  /** Reactive current language. */
  readonly lang = this.#lang.asReadonly();

  constructor() {
    effect(() => {
      const lang = this.#lang();
      try {
        localStorage.setItem(STORAGE_KEY, lang);
      } catch {
        /* storage unavailable — ignore */
      }
      if (typeof document !== "undefined") {
        document.documentElement.lang = lang;
      }
    });
  }

  setLang(lang: Lang): void {
    this.#lang.set(lang);
  }

  toggle(): void {
    this.#lang.set(this.#lang() === "da" ? "en" : "da");
  }

  /**
   * Translate a key for the current language. Supports {param} interpolation.
   * Falls back to English, then to the raw key/text if not found — so passing
   * an already-translated string or unknown error message is safe.
   */
  t(
    key: string | undefined | null,
    params?: Record<string, string | number>,
  ): string {
    if (!key) return "";
    const lang = this.#lang();
    const text = DICTS[lang][key] ?? DICTS.en[key] ?? key;
    if (!params) return text;
    return text.replace(/\{(\w+)\}/g, (_, p) =>
      params[p] !== undefined ? String(params[p]) : `{${p}}`,
    );
  }

  private readInitialLang(): Lang {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "da" || stored === "en") return stored;
    } catch {
      /* ignore */
    }
    return "da";
  }
}
