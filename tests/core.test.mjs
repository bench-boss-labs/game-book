import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as GB from '../core/index.js';

const items = JSON.parse(readFileSync(new URL('./fixtures/u10-sheet-items.json', import.meta.url))).items;
const parsed = GB.parseGameSheet(items);
const facts = GB.sheetFacts(parsed, GB.sheetSide(parsed, ['Bulldogs U10 Blue', 'Burlington Bulldogs Blue']));
const ROSTER = [['2', 'C. Keen', 'C'], ['3', 'A. Ash', 'D'], ['7', 'S. Smith', 'LW'], ['16', 'L. Moreau', 'RW'], ['18', 'J. Park', 'D'], ['23', 'N. Mercer', 'C'], ['31', 'M. Rowe', 'G'], ['93', 'B. Singh', 'LW'], ['97', 'R. Costa', 'D']]
  .map(([number, name, pos]) => ({ number, name, pos }));
const A = 'alliance:2379430';
const B = 'alliance:2379411';
const who = { by: 'Cristian', at: '2026-11-25T21:30:00Z' };

// The mockups' two games: Oct 24 @ Cambridge Hawks (sheet + marks + a correction) and Oct 18 vs Raiders (marks only)
function sampleBook() {
  let b = GB.newBook({ team: 'Bulldogs U10 Blue', season: '2026-27', roster: ROSTER });
  b = GB.upsertGame(b, A, { date: '2026-10-24', time: '13:30', opponent: 'Cambridge Hawks', homeAway: 'away', type: 'league', score: { for: 11, against: 2 } });
  b = GB.upsertGame(b, B, { date: '2026-10-18', time: '15:15', opponent: 'Burlington Raiders', homeAway: 'home', type: 'league', score: { for: 4, against: 2 } });
  b = GB.importSheet(b, A, facts, who);
  b = GB.setTracked(b, A, {
    goals: [{ id: 'g1', side: 'against', per: 1, oppScorer: '', onIce: ['3', '18', '7'] }, { id: 'g2', side: 'for', per: 1, scorer: '23', assists: ['2'] },
      { id: 'g3', side: 'for', per: 1, scorer: '2' }, { id: 'g4', side: 'for', per: 1, scorer: '23', assists: ['18'] }, { id: 'g5', side: 'for', per: 2 }],
    penalties: [{ id: 'p1', team: 'us', per: 1, player: '97', minutes: 2, type: 'hooking' }],
    shots: [{ id: 's1', side: 'for', per: 1, result: 'on', shooter: '16' }, { id: 's2', side: 'against', per: 1, result: 'on' }, { id: 's3', side: 'for', per: 1, result: 'missed', shooter: '7' },
      { id: 's4', side: 'for', per: 1, result: 'on', shooter: '93' }, { id: 's5', side: 'against', per: 2, result: 'on' }, { id: 's6', side: 'for', per: 2, result: 'blocked', shooter: '18' }, { id: 's7', side: 'for', per: 2, result: 'on', shooter: '2' }]
  }, who);
  b = GB.setTracked(b, B, { goals: [{ id: 'o1', side: 'for', per: 1, scorer: '7', assists: ['16', '2'] }, { id: 'o2', side: 'against', per: 1 }, { id: 'o3', side: 'for', per: 2, scorer: '23', assists: ['7'] },
    { id: 'o4', side: 'against', per: 3 }, { id: 'o5', side: 'for', per: 3, scorer: '16', assists: [] }, { id: 'o6', side: 'for', per: 3, scorer: '7', assists: ['93'] }] }, who);
  const sg = GB.effectiveGame(b, A).goals.find((g) => g.per === 2 && g.clock === '07:12');
  b = GB.addCorrection(b, A, { kind: 'edit-goal', target: sg.id, set: { assists: ['7'] }, note: 'Ref missed it' }, { by: 'Cristian', at: '2026-11-25T21:41:00Z', id: 'c1' }).book;
  return b;
}

test('the GameSheet reader moved over unchanged', () => {
  assert.equal(parsed.number, 'U10BE38');
  assert.equal(parsed.date, '2026-10-24');
  assert.deepEqual(parsed.periods, { 1: 10, 2: 10, 3: 15 });
  assert.equal(parsed.visitor.name, 'Burlington Bulldogs Blue');
  assert.equal(facts.side, 'visitor');
  assert.deepEqual(facts.score, { for: 11, against: 2 });
  assert.equal(facts.goals.length, 13);
  assert.equal(facts.penalties.length, 9);
  assert.equal(GB.sheetSide(parsed, ['Somebody Else']), null);
  assert.throws(() => GB.parseGameSheet([{ s: 'hello', x: 1, y: 1, w: 10 }]), /GameSheet/);
  assert.equal(JSON.stringify(facts).includes('KEVIN'), false, 'no player names kept');
});

test('game keys', () => {
  assert.equal(GB.gameKey('alliance', 2379430), 'alliance:2379430');
  assert.equal(GB.gameKey('club', '2066', 'bghc'), 'club:bghc:2066');
  assert.deepEqual(GB.parseGameKey('club:bghc:2066'), { source: 'club', club: 'bghc', id: '2066' });
  assert.deepEqual(GB.parseGameKey('teamsnap:abc-123'), { source: 'teamsnap', id: 'abc-123' });
  assert.equal(GB.parseGameKey('nope'), null);
  assert.throws(() => GB.upsertGame(GB.newBook({}), 'nope', {}), /game key/);
});

test('the sheet wins; marks keep their link; a differing mark is flagged, not counted', () => {
  const eff = GB.effectiveGame(sampleBook(), A);
  assert.equal(eff.status, 'official');
  assert.deepEqual(eff.score, { for: 11, against: 2 });
  assert.equal(eff.goals.length, 13);
  const g = eff.goals.find((x) => x.per === 1 && x.clock === '02:49');
  assert.equal(g.scorer, '23');
  assert.deepEqual(g.assists, ['2'], 'the sheet’s assist, not the mark’s');
  assert.deepEqual(g.mark, { scorer: '23', assists: ['18'] }, 'the mark that differs is kept beside it');
  assert.equal(g.trackedId, 'g4');
  assert.equal(eff.differs, 1);
  const ga = eff.goals.find((x) => x.side === 'against' && x.clock === '06:17');
  assert.equal(ga.trackedId, 'g1');
  assert.deepEqual(ga.onIce, ['3', '18', '7'], 'our players on the ice come from the marks');
  assert.equal(ga.mark, null, 'a mark without details doesn’t differ');
  assert.deepEqual(eff.goals.at(-1).scoreAfter, { for: 11, against: 2 });
});

test('corrections go on top, are logged, and can be undone', () => {
  let b = sampleBook();
  let eff = GB.effectiveGame(b, A);
  const g = eff.goals.find((x) => x.per === 2 && x.clock === '07:12');
  assert.deepEqual(g.assists, ['7']);
  assert.equal(g.source, 'corrected');
  assert.equal(g.corrections[0].note, 'Ref missed it');
  assert.equal(b.games[A].official.goals.find((x) => x.id === g.id).assists.length, 0, 'the sheet itself is never changed');
  assert.match(eff.history[0].what, /Corrected a goal: assists #7 \("Ref missed it"\)/);
  // use my mark: a correction that matches the mark clears the flag
  const differ = eff.goals.find((x) => x.mark);
  b = GB.addCorrection(b, A, { kind: 'edit-goal', target: differ.id, set: { assists: ['18'] } }, { by: 'Cristian', id: 'c2' }).book;
  eff = GB.effectiveGame(b, A);
  assert.equal(eff.differs, 0);
  b = GB.undoCorrection(b, A, 'c2', { by: 'Cristian' });
  eff = GB.effectiveGame(b, A);
  assert.equal(eff.differs, 1);
  assert.deepEqual(eff.goals.find((x) => x.id === differ.id).assists, ['2']);
  assert.match(eff.history[0].what, /^Undid/);
});

test('a marked goal that isn’t on the sheet is shown but not counted until confirmed; added and removed goals', () => {
  let b = sampleBook();
  b = GB.setTracked(b, A, Object.assign({}, b.games[A].tracked, { goals: b.games[A].tracked.goals.concat([{ id: 'g8', side: 'for', per: 2, scorer: '2' }, { id: 'g9', side: 'for', per: 2, scorer: '97' }]) }), who);
  // the sheet has 2 of our goals in the 2nd; the coaches marked 3, so the third isn't on the sheet
  let eff = GB.effectiveGame(b, A);
  const extra = eff.goals.find((x) => x.id === 'g9');
  assert.equal(extra.notOnSheet, true);
  assert.equal(extra.counted, false);
  assert.deepEqual(eff.score, { for: 11, against: 2 });
  b = GB.addCorrection(b, A, { kind: 'confirm-goal', target: 'g9' }, { by: 'Cristian', id: 'c3' }).book;
  eff = GB.effectiveGame(b, A);
  assert.deepEqual(eff.score, { for: 12, against: 2 });
  b = GB.addCorrection(b, A, { kind: 'remove-goal', target: 'g9' }, { by: 'Cristian', id: 'c4' }).book;
  b = GB.addCorrection(b, A, { kind: 'add-goal', set: { side: 'against', per: 3, clock: '01:00', scorer: '9' } }, { by: 'Cristian', id: 'c5' }).book;
  eff = GB.effectiveGame(b, A);
  assert.deepEqual(eff.score, { for: 11, against: 3 });
  assert.equal(eff.goals.find((x) => x.id === 'cg-c5').source, 'added');
});

test('without a sheet the marks count; without either the league score stands', () => {
  const b = sampleBook();
  const eff = GB.effectiveGame(b, B);
  assert.equal(eff.status, 'tracked');
  assert.deepEqual(eff.score, { for: 4, against: 2 });
  const c = GB.upsertGame(b, 'alliance:1', { date: '2026-11-15', opponent: 'Waterloo Wolves', score: { for: 4, against: 3 } });
  const e2 = GB.effectiveGame(c, 'alliance:1');
  assert.equal(e2.status, 'score');
  assert.deepEqual(e2.score, { for: 4, against: 3 });
  assert.equal(GB.effectiveGame(c, 'alliance:2').status, 'none');
});

test('replacing the sheet keeps corrections attached to the same goals', () => {
  let b = sampleBook();
  b = GB.importSheet(b, A, facts, { by: 'Another Coach', at: '2026-11-26T10:00:00Z' });
  const eff = GB.effectiveGame(b, A);
  assert.deepEqual(eff.goals.find((x) => x.per === 2 && x.clock === '07:12').assists, ['7']);
  assert.match(eff.history[0].what, /^Replaced game sheet U10BE38/);
  assert.equal(eff.history[0].by, 'Another Coach');
});

test('one game’s summary: points, PIM, shots, goalie', () => {
  const eff = GB.effectiveGame(sampleBook(), A);
  const s = GB.gameSummary(eff, ROSTER);
  assert.deepEqual([s.players.get('2').g, s.players.get('2').a], [5, 2]);
  assert.deepEqual([s.players.get('16').g, s.players.get('16').pim], [2, 2]);
  assert.equal(s.players.get('7').a, 1, 'the corrected assist');
  assert.deepEqual(s.pim, { us: 6, them: 12 });
  assert.deepEqual(s.byPeriod.for, { 1: 4, 2: 2, 3: 5 });
  assert.deepEqual(s.shots, { for: 3 + 11, against: 2 + 2 }, 'shots on goal include goals');
  assert.equal(s.goalies[0].number, '31');
  assert.equal(s.goalies[0].ga, 2);
  assert.equal(s.goalies[0].decision, 'W');
});

test('power-play and short-handed goals come from penalty times', () => {
  let b = GB.newBook({ team: 'T', roster: ROSTER });
  b = GB.importSheet(b, A, { number: 'X', periods: { 1: 15, 2: 15, 3: 15 }, side: 'home', score: { for: 3, against: 0 },
    goals: [{ side: 'for', per: 1, time: '12:00', scorer: '2', assists: [] }, { side: 'for', per: 1, time: '11:30', scorer: '7', assists: [] }, { side: 'for', per: 2, time: '05:00', scorer: '23', assists: [] }],
    penalties: [{ team: 'them', per: 1, time: '13:00', player: '9', minutes: 2, type: 'tripping' }, { team: 'us', per: 2, time: '06:00', player: '3', minutes: 2, type: 'hooking' }] }, who);
  const s = GB.gameSummary(GB.effectiveGame(b, A), ROSTER);
  assert.equal(s.players.get('2').ppg, 1, 'scored a minute into their minor');
  assert.equal(s.players.get('7').ppg, 0, 'their player was already back: the power-play goal ended the minor');
  assert.equal(s.players.get('23').shg, 1, 'scored while we were short');
});

test('season stats: sheet with corrections where there is one, marks otherwise', () => {
  const st = GB.seasonStats(sampleBook(), 'league');
  assert.deepEqual(st.record, { w: 2, l: 0, t: 0 });
  assert.deepEqual([st.gf, st.ga], [15, 4]);
  assert.deepEqual(st.sources, { official: 1, tracked: 1, scoreOnly: 0 });
  const line = (n) => { const p = st.players.find((x) => x.number === n); return [p.gp, p.g, p.a, p.pts]; };
  assert.deepEqual(line('2'), [2, 5, 3, 8]);
  assert.deepEqual(line('16'), [2, 3, 1, 4]);
  assert.deepEqual(line('7'), [2, 2, 2, 4]);
  assert.deepEqual(line('23'), [2, 3, 0, 3]);
  assert.deepEqual(line('18'), [2, 1, 0, 1], 'the sheet’s assist wins over the mark’s');
  assert.equal(st.players[0].number, '2');
  assert.equal(st.players.find((x) => x.number === '31'), undefined, 'goalies are listed separately');
  assert.deepEqual(st.goalies.map((g) => [g.number, g.gp, g.w, g.ga, g.gaa]), [['31', 2, 2, 4, 2]]);
  assert.equal(GB.seasonStats(sampleBook(), 'tournament').players.length, 0);
});

test('one player game by game (the family view)', () => {
  const rows = GB.playerGames(sampleBook(), '16');
  assert.deepEqual(rows.map((r) => [r.date, r.g, r.a, r.pim, r.status]), [['2026-10-24', 2, 0, 2, 'official'], ['2026-10-18', 1, 1, 0, 'tracked']]);
  assert.equal(rows[0].goalIds.length, 2);
});

test('a lineup sets who gets a game played', () => {
  let b = sampleBook();
  b = GB.setLineup(b, A, ['2', '7', '16', '23', '93'], who);
  const st = GB.seasonStats(b);
  assert.equal(st.players.find((x) => x.number === '2').gp, 2);
  assert.equal(st.players.find((x) => x.number === '3').gp, 1);
});

test('merge: two people working on the same book', () => {
  const base = sampleBook();
  // a coach on another PC corrects one goal; I import a sheet for another game and correct another goal
  const sg = GB.effectiveGame(base, A).goals.find((x) => x.clock === '04:42');
  const theirs = GB.addCorrection(base, A, { kind: 'edit-goal', target: sg.id, set: { assists: ['23'] } }, { by: 'Coach B', id: 'cB', at: '2026-11-26T09:00:00Z' }).book;
  let mine = GB.upsertGame(base, 'alliance:3', { date: '2026-11-01', opponent: 'Hamilton', score: { for: 2, against: 2 } });
  mine = GB.addCorrection(mine, B, { kind: 'edit-goal', target: 'o3', set: { assists: [] } }, { by: 'Cristian', id: 'cM', at: '2026-11-26T09:05:00Z' }).book;
  const r = GB.syncStep({ base, mine, theirs, dirty: true });
  assert.deepEqual(r.conflicts, []);
  assert.equal(r.push, true);
  assert.ok(r.book.games['alliance:3']);
  assert.deepEqual(r.book.games[A].corrections.map((c) => c.id), ['c1', 'cB']);
  assert.deepEqual(r.book.games[B].corrections.map((c) => c.id), ['cM']);
  // an undo on either side wins
  const undone = GB.undoCorrection(base, A, 'c1', { by: 'Coach B' });
  const r2 = GB.syncStep({ base, mine: base, theirs: undone, dirty: false });
  assert.equal(r2.push, false);
  assert.ok(GB.mergeBooks(base, base, undone).merged.games[A].corrections[0].undone);
  // a real clash: both replaced the lineup differently -> Drive's version kept, reported
  const m2 = GB.setLineup(base, A, ['2'], who), t2 = GB.setLineup(base, A, ['7'], who);
  const r3 = GB.syncStep({ base, mine: m2, theirs: t2, dirty: true });
  assert.deepEqual(r3.book.games[A].lineup, ['7']);
  assert.deepEqual(r3.conflicts, [`lineup of ${A}`]);
  // marks from two devices merge per goal
  const m3 = GB.setTracked(base, B, Object.assign({}, base.games[B].tracked, { goals: base.games[B].tracked.goals.concat([{ id: 'x1', side: 'for', per: 3, scorer: '3' }]) }), { by: 'Cristian', at: '2026-11-26T10:00:00Z' });
  const t3 = GB.setTracked(base, B, Object.assign({}, base.games[B].tracked, { shots: [{ id: 'y1', side: 'for', per: 1, result: 'on', shooter: '2' }] }), { by: 'Coach B', at: '2026-11-26T09:00:00Z' });
  const r4 = GB.syncStep({ base, mine: m3, theirs: t3, dirty: true });
  assert.equal(r4.book.games[B].tracked.goals.length, 7);
  assert.equal(r4.book.games[B].tracked.shots.length, 1);
  assert.deepEqual(r4.conflicts, []);
});

test('the Drive file: name, round trip, newer files are read-only', () => {
  const b = sampleBook();
  assert.equal(GB.bookFileName(b), 'Game Book – Bulldogs U10 Blue 2026-27.json');
  const text = GB.bookFileText(b, { by: 'Cristian', at: '2026-11-26T00:00:00Z' });
  const p = GB.parseBookFile(text);
  assert.equal(p.readOnly, false);
  assert.equal(p.book.updatedBy, 'Cristian');
  assert.deepEqual(GB.effectiveGame(p.book, A).score, { for: 11, against: 2 });
  const newer = JSON.stringify(Object.assign(JSON.parse(text), { schema: GB.SCHEMA + 1 }));
  assert.equal(GB.parseBookFile(newer).readOnly, true);
  assert.equal(GB.canWrite(GB.parseBookFile(newer)), false);
  assert.throws(() => GB.parseBookFile('{"app":"other"}'), /isn’t a Game Book/);
  assert.throws(() => GB.parseBookFile('not json'), /damaged/);
});

test('comparing a sheet before importing it, and going back to the sheet’s version', () => {
  let b = sampleBook();
  b = GB.removeSheet(b, A, who);
  const c = GB.compareSheet(b, A, facts);
  assert.equal(c.matches, 4, 'paired goals that agree, or whose marks have no details to disagree with');
  assert.equal(c.differs.length, 1);
  assert.equal(c.differs[0].sheet.time, '02:49');
  assert.deepEqual(c.sheetOnly, { goals: 8, penalties: 8 });
  assert.equal(c.trackedOnly.length, 0);
  assert.equal(c.replacing, false);
  b = GB.importSheet(b, A, facts, who);
  const gid = GB.effectiveGame(b, A).goals.find((x) => x.clock === '07:12').id;
  assert.deepEqual(GB.effectiveGame(b, A).goals.find((x) => x.id === gid).assists, ['7'], 'the correction survived removing and re-importing the sheet');
  b = GB.revertGoal(b, A, gid, { by: 'Cristian' });
  assert.deepEqual(GB.effectiveGame(b, A).goals.find((x) => x.id === gid).assists, []);
});
