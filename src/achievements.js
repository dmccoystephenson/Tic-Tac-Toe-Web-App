// Achievements on arcade-social (https://api.play.danielstephenson.dev, Stephenson-Software RFC 0014).
// Tic tac toe here is two people on one device, so there is no score to rank; the signed-in
// player instead unlocks "first-game" for finishing a game (a win or a draw) and "draw" for a
// draw. The client is public/arcade-scores.js, vendored unchanged from arcade-social's
// clients/js and loaded by public/index.html; it sends nothing unless the page is
// tic-tac-toe-web.play.danielstephenson.dev and the player is signed in, and never throws.

// "X" or "O" for a win, "draw" for a full board without one, null while the game goes on
export function outcome(squares, winner) {
  if (winner) {
    return winner;
  }
  return squares.every(Boolean) ? 'draw' : null;
}

// the achievements a finished game earns
export function achievementsFor(result) {
  if (!result) {
    return [];
  }
  return result === 'draw' ? ['first-game', 'draw'] : ['first-game'];
}

// unlocks each achievement at most once per page load; the service keeps unlocks anyway
export function makeReporter(getClient) {
  const sent = new Set();
  return function report(result) {
    for (const id of achievementsFor(result)) {
      if (sent.has(id)) {
        continue;
      }
      sent.add(id);
      try {
        const client = getClient();
        if (client) {
          client.unlock(id);
        }
      } catch (e) {
        // a lost unlock is acceptable; a broken game is not
      }
    }
  };
}

export const reportFinishedGame = makeReporter(() => window.ArcadeScores);
