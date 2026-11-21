import { act, fireEvent, render, screen } from '@testing-library/react';
import { Game } from './Game';
import { reportFinishedGame } from './achievements';
import { decode, fitCamera, projectToScreen, squareCenter, WIN_TILE, HIGHLIGHT_COLOR } from './scene3d';

jest.mock('./achievements', () => ({
  ...jest.requireActual('./achievements'),
  reportFinishedGame: jest.fn(),
}));

// A stand-in for Strata's grid relay (window.StrataGridRelay): it takes the
// game's messages and hands it the events a test queues.
function fakeRelay(start = 'ready') {
  const relay = {
    current: 'idle',
    sent: [],
    events: [],
    request: jest.fn(() => { relay.current = start; return relay.current; }),
    state: () => relay.current,
    sendBytes: jest.fn((bytes) => { relay.sent.push(bytes); return 0; }),
    poll: () => JSON.stringify(relay.events.splice(0)),
    close: jest.fn(() => { relay.current = 'idle'; }),
    // the last message of a kind, read back
    last(kind) {
      const found = relay.sent.filter((m) => m[4] === kind);
      return found.length ? decode(found[found.length - 1]) : null;
    },
  };
  return relay;
}

const SIZE = 360;

// a press on square i of the 3D board, as the relay reports it
function tap(relay, i, type = 5) {
  const [x, z] = squareCenter(i);
  const [px, py] = projectToScreen(fitCamera(1), [x, 0, z], SIZE, SIZE);
  relay.events.push({ type, button: 1, x: px, y: py, pointer: type === 4 ? 'mouse' : 'touch', id: 1 });
}

function frames(n = 3) {
  for (let i = 0; i < n; i++) {
    act(() => { jest.advanceTimersByTime(20); });
  }
}

function status() {
  return screen.getByRole('status').textContent;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => setTimeout(cb, 16));
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => clearTimeout(id));
  window.localStorage.clear();
  window.history.replaceState({}, '', '/');
  reportFinishedGame.mockClear();
});

afterEach(() => {
  delete window.StrataGridRelay;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

function start(relay) {
  window.StrataGridRelay = relay;
  render(<Game />);
  relay.events.push({ type: 8, width: SIZE, height: SIZE });
  frames();
}

test('without the relay the 2D board is shown and the 3D view button says why not', () => {
  render(<Game />);
  const toggle = screen.getByRole('button', { name: '3D unavailable' });
  expect(toggle.disabled).toBe(true);
  expect(toggle.title).toBe('the 3D board did not load');
  expect(document.querySelector('.board-2d').className).toBe('board-2d');
  expect(document.querySelector('.board-3d').hidden).toBe(true);
});

test('where the relay runs the game starts in 3D, with the 2D squares kept for keyboards and screen readers', () => {
  const relay = fakeRelay();
  start(relay);
  expect(relay.request).toHaveBeenCalledTimes(1);
  expect(JSON.parse(relay.request.mock.calls[0][0])).toMatchObject({ canvas: 'relay', base: 'strata/' });
  expect(document.querySelector('.board-3d').hidden).toBe(false);
  expect(document.querySelector('.board-2d').className).toContain('visually-hidden');
  expect(screen.getByRole('button', { name: 'Square (1, 1), empty' })).toBeTruthy();
  expect(screen.getByRole('button', { name: '3D view' }).getAttribute('aria-pressed')).toBe('true');
  expect(relay.last(1).shapes).toHaveLength(13);
  expect(relay.last(2).anchors).toEqual([]);
  expect(relay.last(4).eye[1]).toBeCloseTo(fitCamera(1).eye[1], 5);
});

test('a tap on a tile plays that square, and the marks are sent to the relay', () => {
  const relay = fakeRelay();
  start(relay);
  tap(relay, 4);
  frames();
  expect(status()).toBe('Next player: O');
  expect(screen.getByRole('button', { name: 'Square (1, 1), X' })).toBeTruthy();
  expect(relay.last(2).anchors).toEqual([[0, 0, 0, 0]]);
  expect(relay.last(2).shapes).toHaveLength(18);
  tap(relay, 0);
  frames();
  expect(screen.getByRole('button', { name: 'Square (0, 0), O' })).toBeTruthy();
  expect(relay.last(2).shapes).toHaveLength(18 + 17);
});

test('a press off the board, or on a filled square, plays nothing', () => {
  const relay = fakeRelay();
  start(relay);
  relay.events.push({ type: 5, button: 1, x: 2, y: 2, pointer: 'mouse', id: 1 });
  frames();
  expect(status()).toBe('Next player: X');
  tap(relay, 4);
  tap(relay, 4);
  frames();
  expect(status()).toBe('Next player: O');
});

test('a win lights its tiles yellow and stops play, as in 2D', () => {
  const relay = fakeRelay();
  start(relay);
  for (const i of [0, 3, 1, 4, 2]) {
    tap(relay, i);
    frames();
  }
  expect(status()).toBe('Winner: X');
  const tiles = relay.last(1).shapes.slice(0, 9);
  [0, 1, 2].forEach((i) => tiles[i].color.slice(0, 3).forEach((c, k) => expect(c).toBeCloseTo(WIN_TILE[k], 5)));
  [3, 4, 5, 6, 7, 8].forEach((i) => expect(tiles[i].color[2]).toBeGreaterThan(0.7));
  tap(relay, 8);
  frames();
  expect(screen.getByRole('button', { name: 'Square (2, 2), empty' })).toBeTruthy();
  expect(reportFinishedGame).toHaveBeenLastCalledWith('X');
});

test('the tile under the mouse, and the square with the keyboard focus, get a slab', () => {
  const relay = fakeRelay();
  start(relay);
  tap(relay, 8, 4);  // mouse motion
  frames();
  let slab = relay.last(1).shapes[13];
  expect(slab.position[0]).toBeCloseTo(squareCenter(8)[0]);
  slab.color.slice(0, 3).forEach((c, k) => expect(c).toBeCloseTo(HIGHLIGHT_COLOR[k], 5));
  fireEvent.focus(screen.getByRole('button', { name: 'Square (2, 0), empty' }));
  frames();
  slab = relay.last(1).shapes[13];
  expect(slab.position[0]).toBeCloseTo(squareCenter(2)[0]);
  expect(slab.position[2]).toBeCloseTo(squareCenter(2)[1]);
  // pressing the focused square (Enter or Space on a button is a click) plays it
  fireEvent.click(screen.getByRole('button', { name: 'Square (2, 0), empty' }));
  frames();
  expect(relay.last(2).anchors).toEqual([[1, -1, 1, -1]]);
  fireEvent.blur(screen.getByRole('button', { name: 'Square (2, 0), X' }));
  frames();
  expect(relay.last(1).shapes[13].position[0]).toBeCloseTo(squareCenter(8)[0]);
});

test('the move list jumps the 3D board back too', () => {
  const relay = fakeRelay();
  start(relay);
  for (const i of [4, 0, 8]) {
    tap(relay, i);
    frames();
  }
  expect(relay.last(2).anchors).toHaveLength(3);
  fireEvent.click(screen.getByRole('button', { name: 'Go to move #1 (1, 1)' }));
  frames();
  expect(relay.last(2).anchors).toEqual([[0, 0, 0, 0]]);
});

test('the relay is asked to leave every key to the page, so Tab, Enter and Space keep working there', () => {
  const relay = fakeRelay();
  start(relay);
  expect(relay.request).toHaveBeenCalled();
  for (const [request] of relay.request.mock.calls) {
    expect(JSON.parse(request).keys).toBe(false);
  }
  const pageKeys = jest.fn();
  window.addEventListener('keydown', pageKeys);
  fireEvent.keyDown(screen.getByRole('button', { name: 'Sort descending' }), { key: 'Tab', code: 'Tab' });
  expect(pageKeys).toHaveBeenCalled();
  window.removeEventListener('keydown', pageKeys);
});

test('the 3D view switches off and on mid-game, keeping the board, and the choice is remembered', () => {
  const relay = fakeRelay();
  start(relay);
  tap(relay, 4);
  frames();
  fireEvent.click(screen.getByRole('button', { name: '3D view' }));
  frames();
  expect(relay.close).toHaveBeenCalled();
  expect(document.querySelector('.board-2d').className).toBe('board-2d');
  expect(document.querySelector('.board-3d').hidden).toBe(true);
  expect(screen.getByRole('button', { name: '3D view' }).getAttribute('aria-pressed')).toBe('false');
  expect(window.localStorage.getItem('tic-tac-toe-web:view')).toBe('2d');
  fireEvent.click(screen.getByRole('button', { name: 'Square (0, 0), empty' }));
  expect(status()).toBe('Next player: X');
  fireEvent.click(screen.getByRole('button', { name: '3D view' }));
  frames();
  expect(document.querySelector('.board-3d').hidden).toBe(false);
  expect(relay.last(2).anchors).toHaveLength(2);
  expect(window.localStorage.getItem('tic-tac-toe-web:view')).toBe('3d');
});

test('a player who chose 2D, or ?view=2d, gets the 2D board and no download', () => {
  const relay = fakeRelay();
  window.localStorage.setItem('tic-tac-toe-web:view', '2d');
  start(relay);
  expect(relay.request).not.toHaveBeenCalled();
  expect(document.querySelector('.board-3d').hidden).toBe(true);

  window.localStorage.clear();
  window.history.replaceState({}, '', '/?view=2d');
  const other = fakeRelay();
  window.StrataGridRelay = other;
  render(<Game />);
  frames();
  expect(other.request).not.toHaveBeenCalled();
});

test('when the relay cannot run here, the 2D board stays and the reason is given', () => {
  const relay = fakeRelay('failed:no WebGL 2');
  start(relay);
  expect(document.querySelector('.board-3d').hidden).toBe(true);
  expect(document.querySelector('.board-2d').className).toBe('board-2d');
  const toggle = screen.getByRole('button', { name: '3D unavailable' });
  expect(toggle.title).toBe('no WebGL 2');
  fireEvent.click(screen.getAllByRole('button')[4]);
  expect(status()).toBe('Next player: O');
});
