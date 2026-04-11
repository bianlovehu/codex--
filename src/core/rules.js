import { BOARD_SIZE, DIRECTIONS } from "../constants.js";

export function createEmptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
}

export function cloneBoard(board) {
  return board.map((row) => row.slice());
}

export function inBounds(x, y) {
  return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;
}

function countInDirection(board, x, y, dx, dy, player) {
  let total = 0;
  let nx = x + dx;
  let ny = y + dy;
  while (inBounds(nx, ny) && board[ny][nx] === player) {
    total += 1;
    nx += dx;
    ny += dy;
  }
  return total;
}

function traceDirection(board, x, y, dx, dy, player) {
  const cells = [];
  let nx = x + dx;
  let ny = y + dy;
  while (inBounds(nx, ny) && board[ny][nx] === player) {
    cells.push({ x: nx, y: ny });
    nx += dx;
    ny += dy;
  }
  return cells;
}

export function checkWinner(x, y, board) {
  const player = board[y][x];
  if (!player) return 0;
  for (const [dx, dy] of DIRECTIONS) {
    const len =
      1 +
      countInDirection(board, x, y, dx, dy, player) +
      countInDirection(board, x, y, -dx, -dy, player);
    if (len >= 5) return player;
  }
  return 0;
}

export function findWinningLine(x, y, board) {
  const player = board[y][x];
  if (!player) return null;

  for (const [dx, dy] of DIRECTIONS) {
    const backward = traceDirection(board, x, y, -dx, -dy, player).reverse();
    const forward = traceDirection(board, x, y, dx, dy, player);
    const line = backward.concat([{ x, y }], forward);
    if (line.length >= 5) {
      return line.slice(0, 5);
    }
  }
  return null;
}

export function isBoardFull(board) {
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      if (board[y][x] === 0) return false;
    }
  }
  return true;
}

export function createSnapshot(state) {
  return {
    board: cloneBoard(state.board),
    currentPlayer: state.currentPlayer,
    lastMove: state.lastMove ? { ...state.lastMove } : null
  };
}
