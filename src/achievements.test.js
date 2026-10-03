import { achievementsFor, makeReporter, outcome } from './achievements';

const X = 'X', O = 'O', _ = null;

test('a game in progress has no outcome', () => {
  expect(outcome([X, O, _, _, _, _, _, _, _], null)).toBeNull();
});

test('a win is the winner', () => {
  expect(outcome([X, X, X, O, O, _, _, _, _], 'X')).toBe('X');
});

test('a full board without a winner is a draw', () => {
  expect(outcome([X, O, X, X, O, O, O, X, X], null)).toBe('draw');
});

test('a win on the last square is a win, not a draw', () => {
  expect(outcome([X, O, X, O, X, O, O, X, X], 'X')).toBe('X');
});

test('each result earns its achievements', () => {
  expect(achievementsFor(null)).toEqual([]);
  expect(achievementsFor('O')).toEqual(['first-game']);
  expect(achievementsFor('draw')).toEqual(['first-game', 'draw']);
});

test('each achievement is unlocked once per page load', () => {
  const client = { unlock: jest.fn() };
  const report = makeReporter(() => client);
  report(null);
  report('X');
  report('O');
  report('draw');
  report('draw');
  expect(client.unlock.mock.calls).toEqual([['first-game'], ['draw']]);
});

test('no client and a throwing client never reach the game', () => {
  expect(() => makeReporter(() => undefined)('draw')).not.toThrow();
  const client = { unlock: () => { throw new Error('offline'); } };
  expect(() => makeReporter(() => client)('draw')).not.toThrow();
});
