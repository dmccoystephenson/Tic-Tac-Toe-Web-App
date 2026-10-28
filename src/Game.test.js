import { fireEvent, render, screen } from '@testing-library/react';
import { Game } from './Game';
import { reportFinishedGame } from './achievements';

// the reporter remembers what it sent for the whole page load, so Game gets a fresh mock per test
jest.mock('./achievements', () => ({
  ...jest.requireActual('./achievements'),
  reportFinishedGame: jest.fn(),
}));

beforeEach(() => {
  reportFinishedGame.mockClear();
});

// the board renders before the move list, so the first nine buttons are the squares
function squares() {
  return screen.getAllByRole('button').slice(0, 9);
}

function play(...indexes) {
  for (const i of indexes) {
    fireEvent.click(squares()[i]);
  }
}

function marks() {
  return squares().map((square) => square.textContent);
}

function status() {
  return screen.getByText(/^(Next player: [XO]|Winner: [XO]|Draw)$/).textContent;
}

test('a new game has an empty board and X to move', () => {
  render(<Game />);
  expect(marks()).toEqual(Array(9).fill(''));
  expect(status()).toBe('Next player: X');
});

test('clicks place X then O', () => {
  render(<Game />);
  play(0);
  expect(marks()[0]).toBe('X');
  expect(status()).toBe('Next player: O');
  play(4);
  expect(marks()[4]).toBe('O');
  expect(status()).toBe('Next player: X');
});

test('a filled square ignores clicks', () => {
  render(<Game />);
  play(0, 0);
  expect(marks()[0]).toBe('X');
  expect(status()).toBe('Next player: O');
  expect(screen.queryByRole('button', { name: /^Go to move #2/ })).toBeNull();
});

test('three in a row wins and the board then ignores clicks', () => {
  render(<Game />);
  play(0, 3, 1, 4, 2);
  expect(status()).toBe('Winner: X');
  play(8);
  expect(marks()[8]).toBe('');
  expect(status()).toBe('Winner: X');
});

test('the status line is a live region that follows the game', () => {
  render(<Game />);
  expect(screen.getByRole('status').textContent).toBe('Next player: X');
  play(0);
  expect(screen.getByRole('status').textContent).toBe('Next player: O');
  play(3, 1, 4, 2);
  expect(screen.getByRole('status').textContent).toBe('Winner: X');
});

test('each square is named by its (col, row) and its mark', () => {
  render(<Game />);
  expect(squares().map((square) => square.getAttribute('aria-label'))).toEqual([
    'Square (0, 0), empty', 'Square (1, 0), empty', 'Square (2, 0), empty',
    'Square (0, 1), empty', 'Square (1, 1), empty', 'Square (2, 1), empty',
    'Square (0, 2), empty', 'Square (1, 2), empty', 'Square (2, 2), empty',
  ]);
  fireEvent.click(screen.getByRole('button', { name: 'Square (2, 1), empty' }));
  fireEvent.click(screen.getByRole('button', { name: 'Square (0, 2), empty' }));
  expect(screen.getByRole('button', { name: 'Square (2, 1), X' })).toBe(squares()[5]);
  expect(screen.getByRole('button', { name: 'Square (0, 2), O' })).toBe(squares()[6]);
});

function highlighted() {
  return squares().flatMap((square, i) => (square.classList.contains('winning') ? [i] : []));
}

test('a win highlights the three squares that caused it and no others', () => {
  render(<Game />);
  play(2, 0, 4, 1, 6);
  expect(status()).toBe('Winner: X');
  expect(highlighted()).toEqual([2, 4, 6]);
});

test('no square is highlighted before a win or after jumping back from one', () => {
  render(<Game />);
  play(0, 3, 1, 4);
  expect(highlighted()).toEqual([]);
  play(2);
  expect(highlighted()).toEqual([0, 1, 2]);
  fireEvent.click(screen.getByRole('button', { name: 'Go to move #4 (1, 1)' }));
  expect(highlighted()).toEqual([]);
});

test('a draw highlights no squares', () => {
  render(<Game />);
  play(0, 1, 2, 4, 3, 5, 7, 6, 8);
  expect(highlighted()).toEqual([]);
});

test('a full board without a winner is a draw', () => {
  render(<Game />);
  play(0, 1, 2, 4, 3, 5, 7, 6, 8);
  expect(marks()).toEqual(['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X']);
  expect(status()).toBe('Draw');
});

test('jumping to a move restores its board and next player', () => {
  render(<Game />);
  play(0, 4, 8);
  fireEvent.click(screen.getByRole('button', { name: 'Go to move #1 (0, 0)' }));
  expect(marks()).toEqual(['X', '', '', '', '', '', '', '', '']);
  expect(status()).toBe('Next player: O');
  fireEvent.click(screen.getByRole('button', { name: 'go to game start' }));
  expect(marks()).toEqual(Array(9).fill(''));
  expect(status()).toBe('Next player: X');
});

test('a move after jumping back discards the later moves', () => {
  render(<Game />);
  play(0, 4, 8);
  fireEvent.click(screen.getByRole('button', { name: 'Go to move #1 (0, 0)' }));
  play(2);
  expect(marks()).toEqual(['X', '', 'O', '', '', '', '', '', '']);
  expect(screen.getByRole('button', { name: 'Go to move #2 (2, 0)' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: /^Go to move #3/ })).toBeNull();
});

function moveList() {
  return screen.getAllByRole('listitem').map((item) => item.textContent);
}

test('each move shows the (col, row) it was played at', () => {
  render(<Game />);
  play(5, 7, 0);
  expect(moveList()).toEqual([
    'go to game start',
    'Go to move #1 (2, 1)',
    'Go to move #2 (1, 2)',
    'Go to move #3 (0, 0)',
  ]);
});

test('the sort toggle reverses the move list and back', () => {
  render(<Game />);
  play(0, 4);
  fireEvent.click(screen.getByRole('button', { name: 'Sort descending' }));
  expect(moveList()).toEqual([
    'Go to move #2 (1, 1)',
    'Go to move #1 (0, 0)',
    'go to game start',
  ]);
  fireEvent.click(screen.getByRole('button', { name: 'Sort ascending' }));
  expect(moveList()).toEqual([
    'go to game start',
    'Go to move #1 (0, 0)',
    'Go to move #2 (1, 1)',
  ]);
});

function bolded() {
  return screen.queryAllByText(/^(go to game start|Go to move #\d+)/, { selector: 'b' })
    .map((item) => item.textContent);
}

test('only the current move is bold in the move list', () => {
  render(<Game />);
  expect(bolded()).toEqual(['go to game start']);
  play(0, 4);
  expect(bolded()).toEqual(['Go to move #2 (1, 1)']);
  fireEvent.click(screen.getByRole('button', { name: 'Go to move #1 (0, 0)' }));
  expect(bolded()).toEqual(['Go to move #1 (0, 0)']);
  fireEvent.click(screen.getByRole('button', { name: 'go to game start' }));
  expect(bolded()).toEqual(['go to game start']);
});

test('the move list numbers count down while sorted descending', () => {
  render(<Game />);
  expect(screen.getByRole('list').hasAttribute('reversed')).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Sort descending' }));
  expect(screen.getByRole('list').hasAttribute('reversed')).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Sort ascending' }));
  expect(screen.getByRole('list').hasAttribute('reversed')).toBe(false);
});

test('a move played while sorted descending appears at the top', () => {
  render(<Game />);
  play(0);
  fireEvent.click(screen.getByRole('button', { name: 'Sort descending' }));
  play(8);
  expect(marks()[8]).toBe('O');
  expect(moveList()[0]).toBe('Go to move #2 (2, 2)');
});

function reported() {
  return reportFinishedGame.mock.calls.map(([result]) => result);
}

test('each move reports the outcome so far, and a win reports the winner', () => {
  render(<Game />);
  play(0, 3, 1, 4);
  expect(reported()).toEqual([null, null, null, null]);
  play(2);
  expect(reported()).toEqual([null, null, null, null, 'X']);
});

test('a full board without a winner reports a draw', () => {
  render(<Game />);
  play(0, 1, 2, 4, 3, 5, 7, 6, 8);
  expect(reported()).toEqual([null, null, null, null, null, null, null, null, 'draw']);
});

test('ignored clicks report nothing', () => {
  render(<Game />);
  play(0, 0);
  expect(reported()).toEqual([null]);
  play(3, 1, 4, 2);
  play(8);
  expect(reported()).toEqual([null, null, null, null, 'X']);
});
