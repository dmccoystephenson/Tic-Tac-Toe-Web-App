import {
  BED_TOP, CUBE, CYLINDER, FRAME_WIDTH, HIGHLIGHT_COLOR, KIND_BOARD, KIND_HUD, KIND_PIECES, KIND_VIEW, SPHERE, WIN_TILE,
  boardShapes, decode, encodeBoard, encodeHud, encodePieces, encodeView, fitCamera, markShapes, pickSquare,
  projectToScreen, squareCenter,
} from './scene3d';

// a desktop canvas, a phone held upright and one turned sideways
const CANVASES = [[360, 360], [390, 844], [844, 390]];

test('a press on any part of a tile, at any canvas shape, picks that square', () => {
  for (const [w, h] of CANVASES) {
    const camera = fitCamera(w / h);
    for (let i = 0; i < 9; i++) {
      const [x, z] = squareCenter(i);
      for (const [dx, dz] of [[0, 0], [-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) {
        const p = projectToScreen(camera, [x + dx, BED_TOP, z + dz], w, h);
        expect(p[0]).toBeGreaterThan(0);
        expect(p[0]).toBeLessThan(w);
        expect(p[1]).toBeGreaterThan(0);
        expect(p[1]).toBeLessThan(h);
        expect(pickSquare(camera, p[0], p[1], w, h)).toBe(i);
      }
    }
  }
});

test('a press on the frame, in a corner or on an empty canvas picks nothing', () => {
  for (const [w, h] of CANVASES) {
    const camera = fitCamera(w / h);
    const frame = projectToScreen(camera, [1.5 + FRAME_WIDTH / 2, BED_TOP, 0], w, h);
    expect(pickSquare(camera, frame[0], frame[1], w, h)).toBeNull();
    expect(pickSquare(camera, 1, 1, w, h)).toBeNull();
    expect(pickSquare(camera, w - 2, h - 2, w, h)).toBeNull();
  }
  expect(pickSquare(fitCamera(1), 5, 5, 0, 0)).toBeNull();
});

test('the board is nine checkered tiles in a frame, the winning ones yellow', () => {
  const plain = boardShapes(null, null);
  expect(plain).toHaveLength(13);
  expect(plain[0].color).not.toEqual(plain[1].color);
  plain.slice(0, 9).forEach((tile, i) => {
    expect(tile.kind).toBe(CUBE);
    expect(tile.position[0]).toBe(squareCenter(i)[0]);
    expect(tile.position[2]).toBe(squareCenter(i)[1]);
    expect(tile.position[1] + tile.scale[1] / 2).toBeCloseTo(BED_TOP);
  });
  const won = boardShapes([2, 4, 6], null);
  [0, 1, 3, 5, 7, 8].forEach((i) => expect(won[i].color.slice(0, 3)).not.toEqual(WIN_TILE));
  [2, 4, 6].forEach((i) => expect(won[i].color.slice(0, 3)).toEqual(WIN_TILE));
});

test('a highlighted square gets a slab on its tile', () => {
  const shapes = boardShapes(null, 7);
  expect(shapes).toHaveLength(14);
  const slab = shapes[13];
  expect(slab.position[0]).toBe(squareCenter(7)[0]);
  expect(slab.position[2]).toBe(squareCenter(7)[1]);
  expect(slab.position[1]).toBeGreaterThan(BED_TOP);
  expect(slab.color.slice(0, 3)).toEqual(HIGHLIGHT_COLOR);
  expect(boardShapes(null, null)).toHaveLength(13);
  expect(boardShapes(null, 9)).toHaveLength(13);
});

test('an X is a disc and 17 red blocks, an O a disc and 16 blue beads, on their square', () => {
  const x = markShapes('X', 1, -1);
  expect(x).toHaveLength(18);
  expect(x[0].kind).toBe(CYLINDER);
  x.slice(1).forEach((s) => {
    expect(s.kind).toBe(CUBE);
    expect(Math.abs(s.position[0] - 1)).toBeLessThan(0.3);
    expect(Math.abs(s.position[2] + 1)).toBeLessThan(0.3);
    expect(s.color[0]).toBeGreaterThan(s.color[2]);
  });
  const o = markShapes('O', 0, 0);
  expect(o).toHaveLength(17);
  o.slice(1).forEach((s) => {
    expect(s.kind).toBe(SPHERE);
    expect(Math.hypot(s.position[0], s.position[2])).toBeCloseTo(0.26);
    expect(s.color[2]).toBeGreaterThan(s.color[0]);
  });
  expect(markShapes(null, 0, 0)).toEqual([]);
});

test('BOARD carries the board shapes as they are', () => {
  const bytes = encodeBoard([0, 1, 2], 4);
  expect(Array.from(bytes.slice(0, 8))).toEqual([0x47, 0x33, 1, 0, KIND_BOARD, 0, 0, 0]);
  expect(bytes.length).toBe(16 + 14 * 48);
  const message = decode(bytes);
  const shapes = boardShapes([0, 1, 2], 4);
  expect(message.lights).toBe(0);
  message.shapes.forEach((s, i) => {
    expect(s.attach).toBe(0);
    expect(s.kind).toBe(shapes[i].kind);
    s.position.forEach((v, k) => expect(v).toBeCloseTo(shapes[i].position[k], 5));
    s.scale.forEach((v, k) => expect(v).toBeCloseTo(shapes[i].scale[k], 5));
    s.color.forEach((v, k) => expect(v).toBeCloseTo(shapes[i].color[k], 5));
  });
});

test('PIECES stands each mark on its square, its shapes measured from it', () => {
  const squares = ['X', null, null, null, 'O', null, null, null, 'X'];
  const message = decode(encodePieces(squares));
  expect(message.kind).toBe(KIND_PIECES);
  expect(message.tick).toBe(0);
  expect(message.anchors).toEqual([[-1, -1, -1, -1], [0, 0, 0, 0], [1, 1, 1, 1]]);
  expect(message.shapes).toHaveLength(18 + 17 + 18);
  const expected = [...markShapes('X', -1, -1), ...markShapes('O', 0, 0), ...markShapes('X', 1, 1)];
  message.shapes.forEach((s, i) => {
    const [x, z] = message.anchors[s.anchor];
    expect(s.attach).toBe(1);
    expect(s.position[0] + x).toBeCloseTo(expected[i].position[0], 5);
    expect(s.position[1]).toBeCloseTo(expected[i].position[1], 5);
    expect(s.position[2] + z).toBeCloseTo(expected[i].position[2], 5);
  });
  expect(decode(encodePieces(Array(9).fill(null))).anchors).toEqual([]);
});

test('VIEW carries the camera fitted to the canvas, and HUD is empty', () => {
  const camera = fitCamera(390 / 844);
  const view = decode(encodeView(camera));
  expect(view.kind).toBe(KIND_VIEW);
  expect(encodeView(camera).length).toBe(8 + 64);
  view.eye.forEach((v, i) => expect(v).toBeCloseTo(camera.eye[i], 5));
  view.target.forEach((v, i) => expect(v).toBeCloseTo(camera.target[i], 5));
  expect(view.fovDegrees).toBeCloseTo(42);
  expect(fitCamera(390 / 844).eye[1]).toBeGreaterThan(fitCamera(1).eye[1]);
  expect(decode(encodeHud())).toEqual({ kind: KIND_HUD, panels: 0, labels: 0 });
});
