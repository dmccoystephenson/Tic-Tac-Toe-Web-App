// What the 3D board shows, as plain data: the scene, which square a press lands
// on, and the messages that hand it to Strata's grid relay (Strata's
// web/kit/grid-relay/WIRE.md, format 1.0). No DOM, no WebGL, so it is tested
// under Jest like the rest of the game.
//
// - The board is a 3 x 3 grid of tiles in a dark frame, each X a red cross of
//   blocks and each O a ring of blue beads, each on a low disc (the look of the
//   other tic-tac-toe games' 3D boards).
// - The winning squares' tiles are yellow, as the 2D board's winning squares are.
// - The tile under the pointer, or the square with the keyboard focus, has a
//   thin slab laid on it, the 3D form of a focus ring.
// - A press is turned into the square under it by casting a ray from the camera
//   through the pointer onto the tiles (pickSquare).

export const COLUMNS = 3;
export const ROWS = 3;

// Strata's primitive kinds.
export const CUBE = 0;
export const CYLINDER = 2;
export const SPHERE = 3;

// graphik grid3d's lighting and projection.
export const CLEAR_COLOR = [0.10, 0.12, 0.16, 1.0];
export const SUN_DIRECTION = [-0.45, 0.85, 0.35];
export const NEAR_PLANE = 0.3;
export const FAR_PLANE = 200.0;
export const FOV_DEGREES = 42.0;

export const BED_TOP = 0.0;
const TILE_HEIGHT = 0.18;
const TILE_GAP = 0.12;
export const FRAME_WIDTH = 0.3;
const TILE_LIGHT = [0.86, 0.85, 0.80];
const TILE_DARK = [0.78, 0.77, 0.72];
// the 2D board's winning square, #ff8
export const WIN_TILE = [1.0, 1.0, 0.53];
const FRAME_COLOR = [0.10, 0.10, 0.12];
export const X_COLOR = [0.86, 0.22, 0.18];
export const O_COLOR = [0.20, 0.46, 0.88];
// green, so a focused or hovered tile never looks like a winning one
export const HIGHLIGHT_COLOR = [0.35, 0.80, 0.45];
const DISC_SHADE = 0.45;
const MARK_HEIGHT = 0.16;
const MARK_BASE_HEIGHT = 0.04;
const DISC_SIZE = 0.78;

function shape(kind, position, scale, rgb, shadeBy = 1) {
  const color = rgb.map((c) => Math.max(0, Math.min(1, c * shadeBy)));
  return { kind, position, scale, color: [...color, 1] };
}

// World (x, z) of the middle of square i (0 is the top left, as in the 2D board).
export function squareCenter(i) {
  return [(i % COLUMNS) - (COLUMNS - 1) / 2, Math.floor(i / COLUMNS) - (ROWS - 1) / 2];
}

// South of the board, looking down about 55 degrees, far enough back that the
// board and its frame fit; a tall canvas backs it off further.
export function fitCamera(aspect) {
  let size = Math.max(COLUMNS, ROWS) + 1;
  size *= Math.max(1, 1 / Math.max(aspect, 0.5));
  const distance = 0.86 * size + 0.9;
  return { eye: [0, 1.35 * distance, 0.95 * distance], target: [0, -0.3, -0.04 * size], fovDegrees: FOV_DEGREES };
}

// The tiles (checkered, the winning ones yellow), the frame, and the slab on
// the highlighted square (or none).
export function boardShapes(winning, highlight) {
  const shapes = [];
  const edge = 1 - TILE_GAP;
  for (let i = 0; i < 9; i++) {
    const [x, z] = squareCenter(i);
    const color = winning && winning.includes(i) ? WIN_TILE : ((i % 3) + Math.floor(i / 3)) % 2 ? TILE_DARK : TILE_LIGHT;
    shapes.push(shape(CUBE, [x, BED_TOP - TILE_HEIGHT / 2, z], [edge, TILE_HEIGHT, edge], color));
  }
  const half = 1.5;
  const height = TILE_HEIGHT + 0.12;
  const yMid = BED_TOP - TILE_HEIGHT + height / 2;
  const wide = 3 + 2 * FRAME_WIDTH;
  shapes.push(shape(CUBE, [0, yMid, -half - FRAME_WIDTH / 2], [wide, height, FRAME_WIDTH], FRAME_COLOR));
  shapes.push(shape(CUBE, [0, yMid, half + FRAME_WIDTH / 2], [wide, height, FRAME_WIDTH], FRAME_COLOR));
  shapes.push(shape(CUBE, [-half - FRAME_WIDTH / 2, yMid, 0], [FRAME_WIDTH, height, 3], FRAME_COLOR));
  shapes.push(shape(CUBE, [half + FRAME_WIDTH / 2, yMid, 0], [FRAME_WIDTH, height, 3], FRAME_COLOR));
  if (highlight !== null && highlight !== undefined && highlight >= 0 && highlight < 9) {
    const [x, z] = squareCenter(highlight);
    shapes.push(shape(CUBE, [x, BED_TOP + 0.005, z], [edge, 0.01, edge], HIGHLIGHT_COLOR));
  }
  return shapes;
}

// One mark standing at world (x, z): a low disc and an X of blocks along both
// diagonals (Strata's primitives are axis-aligned) or an O ring of beads.
export function markShapes(mark, x, z) {
  if (mark !== 'X' && mark !== 'O') {
    return [];
  }
  const color = mark === 'X' ? X_COLOR : O_COLOR;
  const out = [shape(CYLINDER, [x, BED_TOP + MARK_BASE_HEIGHT / 2, z], [DISC_SIZE, MARK_BASE_HEIGHT, DISC_SIZE], color, DISC_SHADE)];
  const y = BED_TOP + MARK_BASE_HEIGHT + MARK_HEIGHT / 2;
  if (mark === 'X') {
    const steps = 9;
    const reach = 0.27;
    const block = 0.13;
    for (let i = 0; i < steps; i++) {
      const t = -reach + (2 * reach * i) / (steps - 1);
      out.push(shape(CUBE, [x + t, y, z + t], [block, MARK_HEIGHT, block], color));
      if (i !== Math.floor(steps / 2)) {
        out.push(shape(CUBE, [x + t, y, z - t], [block, MARK_HEIGHT, block], color));
      }
    }
  } else {
    const beads = 16;
    const radius = 0.26;
    const bead = 0.15;
    for (let i = 0; i < beads; i++) {
      const angle = (2 * Math.PI * i) / beads;
      out.push(shape(SPHERE, [x + radius * Math.cos(angle), y, z + radius * Math.sin(angle)], [bead, MARK_HEIGHT, bead], color));
    }
  }
  return out;
}

// --- picking: the same right-handed look-at and OpenGL perspective Strata draws with

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => {
  const n = Math.sqrt(dot(a, a));
  return [a[0] / n, a[1] / n, a[2] / n];
};

function basis(camera) {
  const forward = unit(sub(camera.target, camera.eye));
  const right = unit(cross(forward, [0, 1, 0]));
  return [forward, right, cross(right, forward)];
}

// Where world point p lands on a width x height canvas (pixels from the top
// left), or null behind the camera.
export function projectToScreen(camera, p, width, height) {
  const [forward, right, up] = basis(camera);
  const offset = sub(p, camera.eye);
  const depth = dot(offset, forward);
  if (depth <= 0) {
    return null;
  }
  const focal = 1 / Math.tan((camera.fovDegrees * Math.PI) / 360);
  const aspect = width / height;
  return [((focal / aspect) * dot(offset, right) / depth + 1) / 2 * width, (1 - (focal * dot(offset, up)) / depth) / 2 * height];
}

// The square (0-8) under canvas pixel (x, y), or null: the whole square counts,
// the gap between tiles included; the frame and beyond pick nothing.
export function pickSquare(camera, x, y, width, height) {
  if (!(width > 0 && height > 0)) {
    return null;
  }
  const [forward, right, up] = basis(camera);
  const focal = 1 / Math.tan((camera.fovDegrees * Math.PI) / 360);
  const aspect = width / height;
  const nx = (x / width) * 2 - 1;
  const ny = 1 - (y / height) * 2;
  const d = [0, 1, 2].map((i) => forward[i] + (right[i] * nx * aspect) / focal + (up[i] * ny) / focal);
  if (d[1] >= 0) {
    return null;
  }
  const t = (BED_TOP - camera.eye[1]) / d[1];
  if (t <= 0) {
    return null;
  }
  const column = Math.floor(camera.eye[0] + d[0] * t + COLUMNS / 2);
  const row = Math.floor(camera.eye[2] + d[2] * t + ROWS / 2);
  if (column < 0 || column >= COLUMNS || row < 0 || row >= ROWS) {
    return null;
  }
  return row * COLUMNS + column;
}

// --- the grid relay's messages: an 8-byte header ("G3", 1, 0, kind, 0, 0) and a little-endian body

export const KIND_BOARD = 1;
export const KIND_PIECES = 2;
export const KIND_HUD = 3;
export const KIND_VIEW = 4;
const WORLD = 0;
const PIECE = 1;

class Writer {
  constructor(bytes) {
    this.view = new DataView(new ArrayBuffer(bytes));
    this.at = 0;
  }

  u8(v) { this.view.setUint8(this.at, v); this.at += 1; }

  u16(v) { this.view.setUint16(this.at, v, true); this.at += 2; }

  u32(v) { this.view.setUint32(this.at, v, true); this.at += 4; }

  f32(v) { this.view.setFloat32(this.at, v, true); this.at += 4; }

  floats(vs) { for (const v of vs) this.f32(v); }

  header(kind) {
    this.u8(0x47); this.u8(0x33); this.u8(1); this.u8(0); this.u8(kind); this.u8(0); this.u16(0);
  }

  shape(s, attach, anchor, dx = 0, dz = 0) {
    this.u8(s.kind); this.u8(attach); this.u16(anchor); this.u16(0); this.u16(0);
    this.floats([s.position[0] - dx, s.position[1], s.position[2] - dz]);
    this.floats(s.scale);
    this.floats(s.color);
  }

  bytes() { return new Uint8Array(this.view.buffer); }
}

// BOARD: the tiles, the frame and the highlight slab, as world shapes.
export function encodeBoard(winning, highlight) {
  const shapes = boardShapes(winning, highlight);
  const w = new Writer(16 + shapes.length * 48);
  w.header(KIND_BOARD);
  w.u32(shapes.length);
  w.u32(0);
  for (const s of shapes) w.shape(s, WORLD, 0);
  return w.bytes();
}

// PIECES: one anchor per mark, standing on its square (a tick of 0: no slide),
// and the mark's shapes measured from it.
export function encodePieces(squares) {
  const anchors = [];
  const shapes = [];
  squares.forEach((mark, i) => {
    if (!mark) return;
    const [x, z] = squareCenter(i);
    const a = anchors.length;
    anchors.push([x, z]);
    for (const s of markShapes(mark, x, z)) shapes.push([a, s]);
  });
  const w = new Writer(24 + anchors.length * 16 + shapes.length * 48);
  w.header(KIND_PIECES);
  w.f32(0);
  w.u32(anchors.length);
  w.u32(shapes.length);
  w.u32(0);
  for (const [x, z] of anchors) w.floats([x, z, x, z]);
  for (const [a, s] of shapes) w.shape(s, PIECE, a, anchors[a][0], anchors[a][1]);
  return w.bytes();
}

// VIEW: the camera, clear colour and direction to the sun.
export function encodeView(camera) {
  const w = new Writer(8 + 64);
  w.header(KIND_VIEW);
  w.floats(camera.eye);
  w.floats(camera.target);
  w.floats([camera.fovDegrees, NEAR_PLANE, FAR_PLANE]);
  w.floats(CLEAR_COLOR);
  w.floats(SUN_DIRECTION);
  return w.bytes();
}

// HUD: none (the status line and the move list stay on the page, beside the board).
export function encodeHud() {
  const w = new Writer(16);
  w.header(KIND_HUD);
  w.u32(0);
  w.u32(0);
  return w.bytes();
}

// What a message says, read back (for tests): its kind and counts, and the
// shapes of a BOARD or PIECES message.
export function decode(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (v.getUint8(0) !== 0x47 || v.getUint8(1) !== 0x33 || v.getUint8(2) !== 1) {
    throw new Error('not a wire 1.x message');
  }
  const kind = v.getUint8(4);
  const readShape = (at) => ({
    kind: v.getUint8(at),
    attach: v.getUint8(at + 1),
    anchor: v.getUint16(at + 2, true),
    position: [0, 1, 2].map((i) => v.getFloat32(at + 8 + 4 * i, true)),
    scale: [0, 1, 2].map((i) => v.getFloat32(at + 20 + 4 * i, true)),
    color: [0, 1, 2, 3].map((i) => v.getFloat32(at + 32 + 4 * i, true)),
  });
  if (kind === KIND_BOARD) {
    const n = v.getUint32(8, true);
    return { kind, shapes: Array.from({ length: n }, (_, i) => readShape(16 + 48 * i)), lights: v.getUint32(12, true) };
  }
  if (kind === KIND_PIECES) {
    const anchors = v.getUint32(12, true);
    const n = v.getUint32(16, true);
    const start = 24 + anchors * 16;
    return {
      kind,
      tick: v.getFloat32(8, true),
      anchors: Array.from({ length: anchors }, (_, i) => [0, 1, 2, 3].map((k) => v.getFloat32(24 + 16 * i + 4 * k, true))),
      shapes: Array.from({ length: n }, (_, i) => readShape(start + 48 * i)),
    };
  }
  if (kind === KIND_VIEW) {
    const f = (i) => v.getFloat32(8 + 4 * i, true);
    return { kind, eye: [f(0), f(1), f(2)], target: [f(3), f(4), f(5)], fovDegrees: f(6) };
  }
  return { kind, panels: v.getUint32(8, true), labels: v.getUint32(12, true) };
}
