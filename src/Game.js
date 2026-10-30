import React from 'react';
import { calculateWinner, winningLine } from './calculateWinner';
import { outcome, reportFinishedGame } from './achievements';

function Square(props) {
      return (
        <button className={props.winning ? 'square winning' : 'square'} onClick={props.onClick}
            aria-label={props.label}
        >
          {props.value}
        </button>
      );
}
  
  class Board extends React.Component {
    renderSquare(i) {
      const winning = this.props.winningLine ? this.props.winningLine.includes(i) : false;
      // named by its (col, row), as in the move list, its mark, and whether it is part of the win
      const label = 'Square (' + (i % 3) + ', ' + Math.floor(i / 3) + '), ' + (this.props.squares[i] || 'empty') +
          (winning ? ', winning' : '');
      return (
        <Square
            key={i}
            label={label}
            value={this.props.squares[i]}
            winning={winning}
            onClick={() => this.props.onClick(i)}
        />
        );
    }
  
    render() {
        const rows = [];
        for (let row = 0; row < 3; row++) {
            const squares = [];
            for (let col = 0; col < 3; col++) {
                squares.push(this.renderSquare(row * 3 + col));
            }
            rows.push(
                <div className="board-row" key={row}>
                    {squares}
                </div>
            );
        }
        return (
            <div>{rows}</div>
        );
        }
  }
  
  export class Game extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            history: [{
                squares: Array(9).fill(null),
            }],
            xIsNext: true,
            stepNumber: 0,
            ascending: true,
        }
    }

    handleClick(i) {
        const history = this.state.history.slice(0, this.state.stepNumber + 1);
        const current = history[history.length - 1];
        const squares = current.squares.slice();
        if (calculateWinner(squares) || squares[i]) {
            return;
        }
        squares[i] = this.state.xIsNext ? 'X' : 'O';
        this.setState({
            history: history.concat([{
                squares: squares,
                location: i,
            }]),
            xIsNext: !this.state.xIsNext,
            stepNumber: history.length,
        });
        reportFinishedGame(outcome(squares, calculateWinner(squares)));
    }

    jumpTo(step) {
        this.setState({
            stepNumber: step,
            xIsNext: (step % 2) === 0,
        })
    }

    toggleSort() {
        this.setState({
            ascending: !this.state.ascending,
        });
    }

    render() {
        const history = this.state.history;
        const current = history[this.state.stepNumber];
        const winner = calculateWinner(current.squares)
        const result = outcome(current.squares, winner);

        const moves = history.map((step, move) => {
            // the location is (col, row), counted from 0 at the top left
            const desc = move ?
            'Go to move #' + move + ' (' + (step.location % 3) + ', ' + Math.floor(step.location / 3) + ')' :
            'go to game start';
            // bold for sight, aria-current for a screen reader
            return (
                <li key={move}>
                    <button onClick={() => this.jumpTo(move)}
                        aria-current={move === this.state.stepNumber ? 'step' : undefined}
                    >
                        {move === this.state.stepNumber ? <b>{desc}</b> : desc}
                    </button>
                </li>
            );
        });
        if (!this.state.ascending) {
            moves.reverse();
        }

        let status;
        if (winner) {
            status = "Winner: " + winner;
        }
        else if (result === 'draw') {
            status = "Draw";
        }
        else {
            status = "Next player: " + (this.state.xIsNext ? 'X' : 'O');
        }
        return (
            <div className="game">
            <div className="game-board">
                <Board
                    squares={current.squares}
                    winningLine={winningLine(current.squares)}
                    onClick={(i) => this.handleClick(i)}
                />
            </div>
            <div className="game-info">
                {/* a polite live region, so a screen reader announces each turn and the result */}
                <div className="status" role="status">{status}</div>
                <button onClick={() => this.toggleSort()}>
                    {this.state.ascending ? 'Sort descending' : 'Sort ascending'}
                </button>
                <ol reversed={!this.state.ascending}>{moves}</ol>
            </div>
            </div>
        );
    }
  }
