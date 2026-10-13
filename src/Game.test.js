import { fireEvent, render, screen } from '@testing-library/react';
import { Game } from './Game';

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
  expect(screen.queryByRole('button', { name: 'Go to move #2' })).toBeNull();
});

test('three in a row wins and the board then ignores clicks', () => {
  render(<Game />);
  play(0, 3, 1, 4, 2);
  expect(status()).toBe('Winner: X');
  play(8);
  expect(marks()[8]).toBe('');
  expect(status()).toBe('Winner: X');
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
  fireEvent.click(screen.getByRole('button', { name: 'Go to move #1' }));
  expect(marks()).toEqual(['X', '', '', '', '', '', '', '', '']);
  expect(status()).toBe('Next player: O');
  fireEvent.click(screen.getByRole('button', { name: 'go to game start' }));
  expect(marks()).toEqual(Array(9).fill(''));
  expect(status()).toBe('Next player: X');
});

test('a move after jumping back discards the later moves', () => {
  render(<Game />);
  play(0, 4, 8);
  fireEvent.click(screen.getByRole('button', { name: 'Go to move #1' }));
  play(2);
  expect(marks()).toEqual(['X', '', 'O', '', '', '', '', '', '']);
  expect(screen.getByRole('button', { name: 'Go to move #2' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Go to move #3' })).toBeNull();
});
