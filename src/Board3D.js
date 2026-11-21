import React from 'react';
import {
  encodeBoard, encodeHud, encodePieces, encodeView, fitCamera, pickSquare,
} from './scene3d';

// The board in 3D, drawn by Strata's grid relay (public/strata/, fetched from
// Strata's release by scripts/fetch-strata.js), with the 2D board as its
// fallback. Everything the 2D board does, the 3D one does through it:
//
// - a click or tap on a tile is a click on that square (the square under the
//   pointer is found by casting a ray onto the tiles);
// - the 2D board's buttons stay in the page, out of sight but focusable, so
//   Tab and Enter (or Space) play a square and a screen reader reads each
//   square's name, as in 2D; the focused square's tile gets a slab, as does
//   the tile under the mouse;
// - the winning squares' tiles are yellow;
// - the status line, the sort toggle and the move list are the page's own, so
//   they are the same in both.
//
// 3D is the default where it can run: the relay is downloaded only when it is
// wanted, and only when it fits its size limit and the browser has WebGL 2.
// While it loads, and when it can't run, the 2D board is shown. The "3D view"
// button switches between them (remembered on this device), and ?view=2d or
// ?view=3d in the address picks one for a visit.

const STORE = 'tic-tac-toe-web:view';
const EVENT_MOUSE_MOTION = 4;
const EVENT_MOUSE_BUTTON_DOWN = 5;
const EVENT_RESIZED = 8;

function relay() {
  return typeof window !== 'undefined' ? window.StrataGridRelay || null : null;
}

// Whether the player wants the 3D board: the address first, then this device's choice.
export function wants3D() {
  try {
    const asked = /[?&]view=(2d|3d)\b/.exec(window.location.search);
    if (asked) {
      return asked[1] === '3d';
    }
    return window.localStorage.getItem(STORE) !== '2d';
  } catch (e) {
    return true;
  }
}

function remember(on) {
  try {
    window.localStorage.setItem(STORE, on ? '3d' : '2d');
  } catch (e) {
    // a private window: not remembered
  }
}

function equal(a, b) {
  if (!a || !b || a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

export class Board3D extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      want: wants3D(),
      relayState: relay() ? relay().state() : 'failed:the 3D board did not load',
      hover: null,
      focus: null,
    };
    this.board2d = React.createRef();
    this.sent = {};
    this.size = { width: 300, height: 300 };
    this.frame = null;
    this.tick = this.tick.bind(this);
  }

  componentDidMount() {
    if (this.state.want) {
      this.start();
    }
  }

  componentWillUnmount() {
    this.stopWatching();
    if (relay() && relay().state() === 'ready') {
      relay().close();
    }
  }

  showing() {
    return this.state.want && this.state.relayState === 'ready';
  }

  start() {
    const r = relay();
    if (!r) {
      return;
    }
    // keys: false leaves every key to the page: the board has no keys of its
    // own, and Tab, Enter and Space keep moving and pressing the page's buttons
    // (the 2D squares under the 3D board among them).
    r.request(JSON.stringify({ canvas: 'relay', base: 'strata/', title: 'the 3D board', maxBytes: 4000000, keys: false }));
    this.watch();
  }

  watch() {
    if (this.frame === null) {
      this.frame = window.requestAnimationFrame(this.tick);
    }
  }

  stopWatching() {
    if (this.frame !== null) {
      window.cancelAnimationFrame(this.frame);
      this.frame = null;
    }
  }

  // Every frame while the relay loads or shows: its state, the player's input
  // and anything the board needs to send.
  tick() {
    this.frame = null;
    const r = relay();
    const relayState = r ? r.state() : 'failed:the 3D board did not load';
    if (relayState !== this.state.relayState) {
      this.setState({ relayState });
    }
    if (relayState === 'ready' && !this.state.want) {
      r.close();
      return;
    }
    if (relayState === 'ready') {
      this.input(JSON.parse(r.poll()));
      this.send();
    }
    if (relayState === 'loading' || relayState === 'ready') {
      this.watch();
    }
  }

  input(events) {
    const camera = fitCamera(this.size.width / this.size.height);
    for (const e of events) {
      if (e.type === EVENT_RESIZED && e.width > 0 && e.height > 0) {
        this.size = { width: e.width, height: e.height };
      } else if (e.type === EVENT_MOUSE_MOTION && e.pointer === 'mouse') {
        const hover = pickSquare(fitCamera(this.size.width / this.size.height), e.x, e.y, this.size.width, this.size.height);
        if (hover !== this.state.hover) {
          this.setState({ hover });
        }
      } else if (e.type === EVENT_MOUSE_BUTTON_DOWN && e.button === 1) {
        const square = pickSquare(camera, e.x, e.y, this.size.width, this.size.height);
        if (square !== null) {
          this.props.onClick(square);
        }
      }
    }
  }

  // The messages whose contents changed since they were last sent.
  send() {
    const highlight = this.state.focus !== null ? this.state.focus : this.state.hover;
    const messages = {
      board: encodeBoard(this.props.winningSquares, highlight),
      view: encodeView(fitCamera(this.size.width / this.size.height)),
      pieces: encodePieces(this.props.squares),
      hud: encodeHud(),
    };
    for (const name of ['board', 'view', 'pieces', 'hud']) {
      if (!equal(this.sent[name], messages[name]) && relay().sendBytes(messages[name]) >= 0) {
        this.sent[name] = messages[name];
      }
    }
  }

  toggle() {
    const want = !this.state.want;
    remember(want);
    this.setState({ want, hover: null });
    if (want) {
      this.start();
    } else {
      if (relay() && relay().state() === 'ready') {
        relay().close();
      }
      this.watch();
    }
  }

  // The 2D square with the keyboard focus, from the focus events of its buttons.
  focusChanged(e, focused) {
    const squares = this.board2d.current ? Array.from(this.board2d.current.querySelectorAll('.square')) : [];
    const i = squares.indexOf(e.target);
    let visible = true;
    try {
      visible = e.target.matches(':focus-visible');
    } catch (err) {
      // an older browser: every focus counts
    }
    this.setState({ focus: focused && i >= 0 && visible ? i : null });
  }

  render() {
    const failed = this.state.relayState.startsWith('failed:');
    const loading = this.state.want && this.state.relayState === 'loading';
    const on = this.showing();
    const reason = failed ? this.state.relayState.slice('failed:'.length) : '';
    return (
      <div className={on ? 'board-view in-3d' : 'board-view'}>
        <div className="board-3d" hidden={!on && !loading}>
          <canvas id="relay" aria-hidden="true" onContextMenu={(e) => e.preventDefault()} />
        </div>
        {/* the 2D board: on show without 3D, and in 3D out of sight but still pressed by keyboard and read aloud */}
        <div className={on ? 'board-2d visually-hidden' : 'board-2d'} ref={this.board2d}
          onFocus={(e) => this.focusChanged(e, true)} onBlur={(e) => this.focusChanged(e, false)}
        >
          {this.props.children}
        </div>
        <button type="button" className="view-toggle" aria-pressed={this.state.want && !failed}
          disabled={failed} title={failed ? reason : undefined} onClick={() => this.toggle()}
        >
          {failed ? '3D unavailable' : '3D view'}
        </button>
        {loading && <div className="view-note">Loading the 3D board…</div>}
      </div>
    );
  }
}
