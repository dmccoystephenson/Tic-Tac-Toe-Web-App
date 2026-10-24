# Tic Tac Toe Web App

[![Play in your browser](https://img.shields.io/badge/Play-in%20your%20browser-2ea44f)](https://danielstephenson.dev/play/tic-tac-toe-web-app)

This web application allows two individuals to play tic tac toe with each other. This was created using a tutorial (https://reactjs.org/tutorial/tutorial.html) to gain familiarity with ReactJS.

## Play in your browser
Two players take turns on one device at https://tic-tac-toe-web.play.danielstephenson.dev, listed with the rest at [danielstephenson.dev/play](https://danielstephenson.dev/play). Pushes to `Main` build it and deploy it to [arcade](https://github.com/Stephenson-Software/arcade) (`.github/workflows/browser.yml`).

## Achievements
The game is two people on one device, so it keeps no high score. Instead, a player signed in to [arcade-social](https://github.com/Stephenson-Software/arcade-social) (`https://api.play.danielstephenson.dev`) at https://tic-tac-toe-web.play.danielstephenson.dev unlocks two achievements: `first-game` for finishing a game (a win or a draw) and `draw` for a draw, each sent at most once per page load. Sign-in happens on arcade-social's own page; the game never sees a password, and nothing is sent while signed out or from any other address (such as `npm start` on localhost). Achievements are reported by the player's browser and can be forged.

The client is `public/arcade-scores.js`, vendored unchanged from arcade-social's `clients/js` and loaded by `public/index.html`; `src/achievements.js` decides what a finished game earns, and its tests (`src/achievements.test.js`) run with the rest of the suite (see [Tests](#tests)).

## Tests
The game lives in `src/Game.js` (with `calculateWinner` and `winningLine` in `src/calculateWinner.js`); `src/index.js` only mounts it. Each of those modules, and `src/achievements.js`, has a Jest test beside it:
- `src/calculateWinner.test.js` — every winning line (its winner and its three squares), no winner on empty, partial, full, and mixed-mark boards
- `src/Game.test.js` — turns, each square's (col, row) and mark as its accessible name, ignored clicks on filled squares and won boards, win and draw status, the status line as a live region, the winning-square highlight, jumping through the move history, the (col, row) move labels, the sort toggle, and the outcome each move reports for achievements
- `src/achievements.test.js` — game outcomes, the achievements each earns, once-per-page-load unlocking, and that a missing or throwing client never breaks the game

Run them once with `CI=true npm test` (`npm test` alone starts the interactive watch mode). The `Browser build` workflow runs the same suite on every pull request and push to `Main`, before the build.

## To Do
The following tasks were given at the end of the tutorial.
- [x] Display the location for each move in the format (col, row) in the move history list.
- [x] Bold the currently selected item in the move list.
- [x] Rewrite Board to use two loops to make the squares instead of hardcoding them.
- [x] Add a toggle button that lets you sort the moves in either ascending or descending order.
- [x] When someone wins, highlight the three squares that caused the win.
- [x] When no one wins, display a message about the result being a draw.

## Development
The project was bootstrapped with [Create React App](https://create-react-app.dev/) and is built with `react-scripts`. After `npm ci`, the scripts in `package.json` are:
- `npm start` — runs the game at http://localhost:3000, reloading on every change and showing lint errors in the console. Achievements are never sent from localhost (see [Achievements](#achievements)).
- `npm test` — runs the Jest suite in interactive watch mode; `CI=true npm test` runs it once (see [Tests](#tests)).
- `npm run build` — builds the production site into `build/`. Two things the deploy depends on:
  - `"homepage": "."` in `package.json` makes every asset path relative, so the site works from any directory; the workflow checks that `build/index.html` loads `./static/js/`.
  - GitHub Actions sets `CI=true`, under which Create React App fails the build on any ESLint warning, so build with `CI=true npm run build` locally to catch them before a pull request does.
- `npm run eject` — Create React App's one-way switch from `react-scripts` to copied-in configuration. The project has not ejected, and the workflow relies on `react-scripts`.

Deployment is not done by hand: the `Browser build` workflow deploys `build/` on a push to `Main` (see [Play in your browser](#play-in-your-browser)).
