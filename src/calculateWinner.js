// every square of every line held by one mark, or null if there is none
export function winningSquares(squares) {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];
  const won = lines.filter(([a, b, c]) => squares[a] && squares[a] === squares[b] && squares[a] === squares[c]);
  return won.length ? [...new Set(won.flat())] : null;
}

export function calculateWinner(squares) {
  const won = winningSquares(squares);
  return won ? squares[won[0]] : null;
}
