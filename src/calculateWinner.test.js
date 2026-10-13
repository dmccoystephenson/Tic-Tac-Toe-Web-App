import { calculateWinner } from './calculateWinner';

const X = 'X', O = 'O', _ = null;

const lines = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

test.each(lines)('three in a row on %i, %i, %i wins', (a, b, c) => {
  const squares = Array(9).fill(null);
  squares[a] = squares[b] = squares[c] = O;
  expect(calculateWinner(squares)).toBe(O);
});

test('an empty board has no winner', () => {
  expect(calculateWinner(Array(9).fill(null))).toBeNull();
});

test('a partial board without three in a row has no winner', () => {
  expect(calculateWinner([X, X, _, O, O, _, _, _, _])).toBeNull();
});

test('a full board without three in a row has no winner', () => {
  expect(calculateWinner([X, O, X, X, O, O, O, X, X])).toBeNull();
});

test('a line of mixed marks is not a win', () => {
  expect(calculateWinner([X, X, O, _, _, _, _, _, _])).toBeNull();
});
