import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { achievementsFor, makeReporter, outcome, reportFinishedGame } from './achievements';

const X = 'X', O = 'O', _ = null;

const publicFile = (name) => fs.readFileSync(path.join(__dirname, '..', 'public', name), 'utf8');

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

test('the game reports through the client on the page', () => {
  window.ArcadeScores = { unlock: jest.fn() };
  reportFinishedGame('draw');
  reportFinishedGame('X');
  expect(window.ArcadeScores.unlock.mock.calls).toEqual([['first-game'], ['draw']]);
  delete window.ArcadeScores;
});

test('the page loads the vendored client', () => {
  expect(publicFile('index.html')).toContain('<script src="%PUBLIC_URL%/arcade-scores.js"></script>');
});

// the vendored client, run on a stand-in page so that its address and session can be chosen;
// a signedIn of null makes the session lookup itself fail
function clientAt(href, signedIn) {
  const { hostname, protocol } = new URL(href);
  const fetch = jest.fn((url) => {
    const failed = url.endsWith('/v1/session') && signedIn === null;
    return Promise.resolve({
      ok: !failed,
      status: failed ? 503 : 200,
      json: () => Promise.resolve(url.endsWith('/v1/session') ? { signedIn } : {}),
    });
  });
  const page = { location: { hostname, protocol } };
  vm.runInNewContext(publicFile('arcade-scores.js'), { window: page, fetch });
  return { client: page.ArcadeScores, requests: () => fetch.mock.calls.map(([url]) => url), fetch };
}

const LIVE = 'https://tic-tac-toe-web.play.danielstephenson.dev/';
const API = 'https://api.play.danielstephenson.dev';

test.each(achievementsFor('draw'))('a signed-in player on the live site unlocks %s', async (id) => {
  const { client, requests, fetch } = clientAt(LIVE, true);
  await client.unlock(id);
  expect(requests()).toEqual([API + '/v1/session', API + '/v1/achievements/' + id]);
  expect(fetch.mock.calls[1][1].method).toBe('POST');
});

test('a signed-out player on the live site unlocks nothing', async () => {
  const { client, requests } = clientAt(LIVE, false);
  await client.unlock('first-game');
  expect(requests()).toEqual([API + '/v1/session']);
});

// the client only holds back for a known signed-out session; whether to accept the unlock is
// then up to arcade-social
test('a failed session lookup on the live site still sends the unlock', async () => {
  const { client, requests, fetch } = clientAt(LIVE, null);
  await client.unlock('first-game');
  expect(requests()).toEqual([API + '/v1/session', API + '/v1/achievements/first-game']);
  expect(fetch.mock.calls[1][1].method).toBe('POST');
});

test.each([
  ['npm start', 'http://localhost:3000/'],
  ['another address', 'https://example.com/'],
  ['the live host without https', 'http://tic-tac-toe-web.play.danielstephenson.dev/'],
  ['the API host', API + '/'],
])('nothing at all is sent from %s', async (_name, href) => {
  const { client, requests } = clientAt(href, true);
  await client.unlock('first-game');
  expect(requests()).toEqual([]);
});
