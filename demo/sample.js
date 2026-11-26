// The mockups' sample: two Bulldogs games with made-up player names. Oct 24 @ Cambridge Hawks has the game sheet,
// the coaches' marks and one correction; Oct 18 vs Burlington Raiders has marks only.
import * as GB from '../core/index.js';

export const A = 'alliance:2379430';
export const B = 'alliance:2379411';
export const TEAM_NAMES = ['Bulldogs U10 Blue', 'Burlington Bulldogs Blue'];
const ROSTER = [['2', 'C. Keen', 'C'], ['3', 'A. Ash', 'D'], ['7', 'S. Smith', 'LW'], ['16', 'L. Moreau', 'RW'], ['18', 'J. Park', 'D'], ['23', 'N. Mercer', 'C'], ['31', 'M. Rowe', 'G'], ['93', 'B. Singh', 'LW'], ['97', 'R. Costa', 'D']]
  .map(([number, name, pos]) => ({ number, name, pos }));
const who = { by: 'Cristian', at: '2026-11-25T21:30:00Z' };

export async function sampleBook(fixtureUrl = new URL('../tests/fixtures/u10-sheet-items.json', import.meta.url)) {
  const items = (await (await fetch(fixtureUrl)).json()).items;
  const parsed = GB.parseGameSheet(items);
  const facts = GB.sheetFacts(parsed, GB.sheetSide(parsed, TEAM_NAMES));
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
