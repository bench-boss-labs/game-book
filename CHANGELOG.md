# Changelog

## 0.1.0 — 2026-11-25 (phase 1: the shared core)

- **The Game Book file**: one per team per season, with a schema version. Older code reads a newer file but won't write to it.
- **Four layers per game**: schedule, official (the game sheet as imported), tracked (coaches' marks, no video times) and corrections (who, when, why; can be undone).
- **The game sheet wins, corrections go on top.** Marks pair with sheet goals so their video moments stay linked; a mark that differs is flagged; a marked goal not on the sheet isn't counted until confirmed.
- **Stats**: one game's summary (points, PIM, power-play and short-handed goals from penalty times, shots, goalie) and season stats; one player's games for the family view.
- **Merge**: two people can work on the same book; changes merge per goal, penalty and correction.
- **GameSheet PDF reader** moved from Bulldogs Watch Party 2.7.1 unchanged, with its sample sheet.
