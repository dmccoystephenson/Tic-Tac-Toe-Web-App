// Plays the production build in headless Chromium (WebGL 2 on SwiftShader)
// with Strata's real grid relay and checks the 3D board: it starts in 3D,
// clicks and phone taps on tiles play their squares, Tab and Enter play a
// square with the 2D board out of sight, a win shows on the status line, the
// move list jumps back, the 3D view switches off and on mid-game, ?view=2d
// never downloads the 3D board, and nothing is logged as an error.
//
//   npm run build
//   npm install --no-save playwright && npx playwright install chromium
//   node e2e/board3d.cjs build <screenshot directory>
//
// Exits 1 on any failed check.
'use strict';
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

const site = path.resolve(process.argv[2] || 'build');
const shots = path.resolve(process.argv[3] || 'e2e-shots');
fs.mkdirSync(shots, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.css': 'text/css', '.json': 'application/json' };
function serve() {
  const server = http.createServer((req, res) => {
    const name = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.join(site, name);
    if (!file.startsWith(site) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    const body = fs.readFileSync(file);
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Content-Length': body.length });
    res.end(req.method === 'HEAD' ? undefined : body);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// src/scene3d.js's camera and projection: where square i is on a w x h canvas.
function tile(i, w, h) {
  const aspect = w / h;
  const size = 4 * Math.max(1, 1 / Math.max(aspect, 0.5));
  const d = 0.86 * size + 0.9;
  const eye = [0, 1.35 * d, 0.95 * d], target = [0, -0.3, -0.04 * size];
  const sub = (a, b) => a.map((x, k) => x - b[k]);
  const dot = (a, b) => a.reduce((s, x, k) => s + x * b[k], 0);
  const unit = (a) => { const n = Math.sqrt(dot(a, a)); return a.map((x) => x / n); };
  const f = unit(sub(target, eye));
  const r = unit([-f[2], 0, f[0]]);
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const o = sub([(i % 3) - 1, 0, Math.floor(i / 3) - 1], eye);
  const depth = dot(o, f), focal = 1 / Math.tan((42 * Math.PI) / 360);
  return [((focal / aspect * dot(o, r) / depth) + 1) / 2 * w, (1 - focal * dot(o, u) / depth) / 2 * h];
}

let failures = 0;
function check(ok, what) {
  console.log((ok ? 'ok   ' : 'FAIL ') + what);
  if (!ok) failures++;
}

async function open(browser, url, device) {
  const context = await browser.newContext(device);
  const page = await context.newPage();
  const errors = [], wasm = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('request', (r) => { if (r.url().endsWith('grid-relay-scene.wasm')) wasm.push(r.url()); });
  await page.goto(url);
  return { page, context, errors, wasm };
}

const status = (page) => page.locator('.status').textContent();
const in3D = (page) => page.evaluate(() => !!document.querySelector('.board-view.in-3d'));

async function press(page, how, i) {
  const box = await page.locator('#relay').boundingBox();
  const [x, y] = tile(i, box.width, box.height);
  if (how === 'tap') await page.touchscreen.tap(box.x + x, box.y + y);
  else await page.mouse.click(box.x + x, box.y + y);
  await page.waitForTimeout(250);
}

(async () => {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
  try {
    {
      const t = await open(browser, base, { viewport: { width: 900, height: 700 } });
      const { page } = t;
      await page.waitForFunction(() => !!document.querySelector('.board-view.in-3d'), null, { timeout: 60000 });
      await page.waitForTimeout(800);
      check(true, 'desktop: starts in 3D');
      check(await page.getByRole('button', { name: 'Square (1, 1), empty' }).count() === 1,
        'desktop: the squares are still there for keyboards and screen readers');
      await page.screenshot({ path: path.join(shots, 'tic-tac-toe-web-3d-desktop-start.png') });
      await press(page, 'click', 4);
      check(await status(page) === 'Next player: O', 'desktop: a click on the middle tile plays X there');
      await press(page, 'click', 4);
      check(await status(page) === 'Next player: O', 'desktop: a click on a filled tile plays nothing');
      await page.mouse.click(5, 5);
      // keyboard: Tab to the top left square (the first button) and press Enter
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('aria-label'));
      check(focused === 'Square (0, 0), empty', 'desktop: Tab reaches the first square in 3D (' + focused + ')');
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(shots, 'tic-tac-toe-web-3d-desktop-keyboard-focus.png') });
      await page.keyboard.press('Enter');
      await page.waitForTimeout(250);
      check(await status(page) === 'Next player: X' &&
        await page.getByRole('button', { name: 'Square (0, 0), O' }).count() === 1, 'desktop: Enter plays the focused square');
      for (const i of [1, 8, 7]) await press(page, 'click', i);
      check(await status(page) === 'Winner: X', 'desktop: X wins down the middle column');
      await page.mouse.move(5, 5);
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(shots, 'tic-tac-toe-web-3d-desktop-win.png') });
      await page.getByRole('button', { name: 'Go to move #2 (0, 0)' }).click();
      await page.waitForTimeout(300);
      check(await status(page) === 'Next player: X', 'desktop: the move list jumps the 3D board back');
      await page.screenshot({ path: path.join(shots, 'tic-tac-toe-web-3d-desktop-jumped-back.png') });
      await page.getByRole('button', { name: '3D view' }).click();
      await page.waitForTimeout(300);
      check(!(await in3D(page)) && await page.locator('.board-2d .square').first().isVisible(), 'desktop: 3D off shows the 2D board');
      await page.screenshot({ path: path.join(shots, 'tic-tac-toe-web-3d-desktop-switched-to-2d.png') });
      await page.getByRole('button', { name: '3D view' }).click();
      await page.waitForFunction(() => !!document.querySelector('.board-view.in-3d'), null, { timeout: 30000 });
      check(true, 'desktop: 3D on again');
      check(t.errors.length === 0, 'desktop: no errors logged' + (t.errors.length ? ': ' + t.errors.join(' | ') : ''));
      await t.context.close();
    }
    {
      const t = await open(browser, base, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      const { page } = t;
      await page.waitForFunction(() => !!document.querySelector('.board-view.in-3d'), null, { timeout: 60000 });
      await page.waitForTimeout(800);
      for (const i of [0, 4, 1, 5, 3, 8, 2]) await press(page, 'tap', i);
      check(await status(page) === 'Winner: X', 'phone: taps on tiles play a game to a win');
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(shots, 'tic-tac-toe-web-3d-phone-win.png'), fullPage: true });
      check(t.errors.length === 0, 'phone: no errors logged' + (t.errors.length ? ': ' + t.errors.join(' | ') : ''));
      await t.context.close();
    }
    {
      const t = await open(browser, base + '?view=2d', { viewport: { width: 900, height: 700 } });
      const { page } = t;
      await page.waitForTimeout(1500);
      check(t.wasm.length === 0 && !(await in3D(page)), '?view=2d: the 2D board, and the 3D one not downloaded');
      await page.getByRole('button', { name: 'Square (1, 1), empty' }).click();
      check(await status(page) === 'Next player: O', '?view=2d: the 2D board plays');
      await page.screenshot({ path: path.join(shots, 'tic-tac-toe-web-3d-view-2d.png') });
      check(t.errors.length === 0, '?view=2d: no errors logged' + (t.errors.length ? ': ' + t.errors.join(' | ') : ''));
      await t.context.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failures ? `${failures} check(s) failed` : 'all checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
