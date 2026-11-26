# Changelog

## 0.2.0 — 2026-11-25 (phase 2: the shared screens)

- **Game summary** (`renderGameSummary`): where the data came from, the score by period, goals with their source (Official, Corrected, Marked, Added, Not on the game sheet), penalties, shots and goalies, points this game and History with Undo. Two versions: **coaches** (everything, plus the app's own side cards) and **family** (leads with your kid; penalties and shots one line each; no "mark differs" notes).
- **Import a game sheet** (`openImportSheet`): pick the PDF (read on this computer), confirm the side and the game, see how it compares with the marks, choose "use the mark" for any goal that differs, save once.
- **Correct a goal** (`openCorrectGoal`): official version and the mark side by side, player chips, an optional note; add a goal the sheet missed, count or remove a marked goal that isn't on the sheet, go back to the sheet's version.
- **Season stats** (`renderSeasonStats`): coaches get the record, skaters and goalies tables; families get their kid's line, their games one by one with watch buttons, and the team table with their row highlighted.
- **Game rows** (`statusChip`, `playerLine`): the Official / Coaches' marks / Score only chip and "2 G · 0 A" for each app's game list.
- Styles in `ui/game-book.css` use each app's own colours, light and dark. A demo page and browser tests.
- Core: `compareSheet` (what an import would do) and `revertGoal` (back to the sheet's version).

## 0.1.0 — 2026-11-25 (phase 1: the shared core)

- **The Game Book file**: one per team per season, with a schema version. Older code reads a newer file but won't write to it.
- **Four layers per game**: schedule, official (the game sheet as imported), tracked (coaches' marks, no video times) and corrections (who, when, why; can be undone).
- **The game sheet wins, corrections go on top.** Marks pair with sheet goals so their video moments stay linked; a mark that differs is flagged; a marked goal not on the sheet isn't counted until confirmed.
- **Stats**: one game's summary (points, PIM, power-play and short-handed goals from penalty times, shots, goalie) and season stats; one player's games for the family view.
- **Merge**: two people can work on the same book; changes merge per goal, penalty and correction.
- **GameSheet PDF reader** moved from Bulldogs Watch Party 2.7.1 unchanged, with its sample sheet.
