# Game Book

One shared source of truth for a team's games, scores and stats. Bulldogs Watch Party and Family Watch Party both
read and write the same Game Book file in Google Drive, so a game sheet is imported once and a correction is made once.
Video stays in the video apps: the Game Book knows nothing about video files or video times.

By Bench Boss Labs. Design: the "Game Book: shared game data and stats design" doc and the "Game Book screen mockups".

## Status

Version 0.2.0: phase 2, the shared screens. No app uses it yet.

| Phase | What | Status |
| --- | --- | --- |
| 1 | Core: file format, the four layers, "the sheet wins", corrections, stats, merge | Done |
| 2 | Shared screens (game summary, import, correct, season stats), with a demo page | Done |
| 3 | Family Watch Party reads and writes it; its Google sign-in moves to the Bench Boss Labs project | Next |
| 4 | Bulldogs Watch Party switches its marks, Summary and Season stats over | |

## The data

One file per team per season in Drive: `Game Book – <team> <season>.json`. Bulldogs: in the team's Drive folder, shared
with the coaches. Family-only teams: in the family's Drive. Never in a public repo: player names and stats of minors stay private.

Each game keeps four layers, and what every screen shows is worked out from them (`effectiveGame`):

1. **Schedule**: what Alliance Tracker, the club site or TeamSnap says.
2. **Official**: the GameSheet facts exactly as imported. Never edited.
3. **Tracked**: what coaches marked while watching: goals, penalties, shots, goalies. No video times.
4. **Corrections**: changes on top, each with who, when and an optional note. Can be undone.

The rule (decided Nov 25, 2026): **the game sheet wins, corrections go on top**. Marked goals are paired with the sheet's
(same side, same period, in order) so their video moments stay linked; a mark that differs is flagged, not counted; a
marked goal that isn't on the sheet is shown but not counted until someone confirms it. Without a sheet, the marks count.
Without either, the league score stands.

Games are keyed by where they came from: `alliance:2379430`, `club:bghc:2066`, `teamsnap:<event id>`, `own:<id>`.

## Using it in an app

Copy a fixed version of `core/` (and `ui/` for the screens) into the app at `vendor/game-book-core/<version>/` (the same rule as the Bench Boss Labs
kit), then:

```js
import * as GB from './vendor/game-book-core/0.1.0/index.js';

const { book, readOnly } = GB.parseBookFile(textFromDrive);   // readOnly: written by newer Game Book code
const eff = GB.effectiveGame(book, 'alliance:2379430');        // what the game summary shows
const stats = GB.seasonStats(book, 'league');                  // the season table
let next = GB.importSheet(book, key, GB.sheetFacts(parsed, side), { by: 'Cristian' });
next = GB.addCorrection(next, key, { kind: 'edit-goal', target: goalId, set: { assists: ['7'] }, note: 'Ref missed it' }, { by: 'Cristian' }).book;
const { book: merged, push, conflicts } = GB.syncStep({ base, mine: next, theirs: latestFromDrive, dirty: true });
if (push) await saveToDrive(GB.bookFileText(merged, { by: 'Cristian' }));
```

Every function returns a new book and leaves the one passed in unchanged.

| Module | What |
| --- | --- |
| `core/sheet.js` | GameSheet PDF reader, moved from Bulldogs Watch Party 2.7.1 unchanged (`parseGameSheet`, `sheetSide`, `sheetFacts`) |
| `core/book.js` | The book, game keys, the four layers, corrections, `effectiveGame`, `gameSummary`, `seasonStats`, `playerGames` |
| `core/merge.js` | Three-way merge and `syncStep`: changes are per goal, penalty and correction; on a clash Drive's version is kept and reported |
| `core/file.js` | The Drive file: name, text, parsing, schema check |

## The screens

The same screens in both apps. Copy `ui/` next to `core/`, load `ui/game-book.css`, and give each screen what only the
app knows: who is signed in, how to save, and how to play a goal in its own video.

```js
import * as GBUI from './vendor/game-book-core/0.2.0/ui/index.js';

const screen = GBUI.renderGameSummary(el, {
  book, key, variant: 'full',            // 'family' in Family Watch Party, with kid: { number: '7', name: 'Sam' }
  by: 'Cristian', otherApp: 'Family Watch Party',
  onChange: async (next, what) => { /* merge and save to Drive */ },
  watch: (goal) => (goal.trackedId ? { label: '▶ Watch', onClick: () => playMark(goal.trackedId) } : null),
  readPdf: (file) => GBUI.pdfItems(file, window.pdfjsLib), teamNames: ['Bulldogs U10 Blue', 'Burlington Bulldogs Blue'],
  aside: [coachNotesCard]                // coaches version only: the app's own cards
});
screen.update(newBook);                  // after a sync brings in someone else's change
```

| Module | What |
| --- | --- |
| `ui/summary.js` | `renderGameSummary`: one game, coaches or family version |
| `ui/stats.js` | `renderSeasonStats`: the season, coaches or family version |
| `ui/import.js` | `openImportSheet`: the import panel; resolves with `{ book, key }` or null |
| `ui/correct.js` | `openCorrectGoal`: correct, add, count or remove a goal; resolves with the new book or null |
| `ui/rows.js` | `gameBookStatus`, `statusChip`, `playerLine` for the apps' game lists |
| `ui/pdf.js` | `pdfItems`: a game sheet PDF's text, read with the app's own pdf.js |

The screens never use innerHTML (names and notes are people's text), and every class starts with `gbk-`. Colours come
from the app's own tokens (`--ink`, `--muted`, `--line`, `--surface`, `--accent`, `--good`, `--work`, `--bad`).

**Demo**: serve the repo folder (for example `python3 -m http.server`) and open `demo/index.html`. It uses the sample
games with made-up names; it takes the sample sheet's text (`tests/fixtures/u10-sheet-items.json`) in place of a PDF.

## Tests

```
npm test          # the core
npm run test:ui   # the screens, in Chromium (needs Playwright)
```

The tests use a real GameSheet game sheet's text (jersey numbers only, no names) and the same sample games as the mockups.
