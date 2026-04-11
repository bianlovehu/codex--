import { BOARD_SIZE, DIRECTIONS } from "../constants.js";
import { inBounds } from "../core/rules.js";

const SCORE_TABLE = {
  FIVE: 1000000,
  OPEN_FOUR: 220000,
  CLOSED_FOUR: 38000,
  OPEN_THREE: 9500,
  CLOSED_THREE: 2000,
  OPEN_TWO: 450,
  CLOSED_TWO: 120,
  ONE: 12
};

function scanLine(board, x, y, dx, dy, player) {
  let forward = 0;
  let nx = x + dx;
  let ny = y + dy;
  while (inBounds(nx, ny) && board[ny][nx] === player) {
    forward += 1;
    nx += dx;
    ny += dy;
  }
  const forwardOpen = inBounds(nx, ny) && board[ny][nx] === 0;

  let backward = 0;
  nx = x - dx;
  ny = y - dy;
  while (inBounds(nx, ny) && board[ny][nx] === player) {
    backward += 1;
    nx -= dx;
    ny -= dy;
  }
  const backwardOpen = inBounds(nx, ny) && board[ny][nx] === 0;

  return {
    length: 1 + forward + backward,
    openEnds: Number(forwardOpen) + Number(backwardOpen)
  };
}

function patternScore(length, openEnds) {
  if (length >= 5) return SCORE_TABLE.FIVE;
  if (length === 4 && openEnds === 2) return SCORE_TABLE.OPEN_FOUR;
  if (length === 4 && openEnds === 1) return SCORE_TABLE.CLOSED_FOUR;
  if (length === 3 && openEnds === 2) return SCORE_TABLE.OPEN_THREE;
  if (length === 3 && openEnds === 1) return SCORE_TABLE.CLOSED_THREE;
  if (length === 2 && openEnds === 2) return SCORE_TABLE.OPEN_TWO;
  if (length === 2 && openEnds === 1) return SCORE_TABLE.CLOSED_TWO;
  return SCORE_TABLE.ONE;
}

export function evaluatePoint(board, x, y, player) {
  if (board[y][x] !== 0) return -1;

  board[y][x] = player;
  let total = 0;
  let openThree = 0;
  let openFour = 0;

  for (const [dx, dy] of DIRECTIONS) {
    const info = scanLine(board, x, y, dx, dy, player);
    total += patternScore(info.length, info.openEnds);
    if (info.length === 3 && info.openEnds === 2) openThree += 1;
    if (info.length === 4 && info.openEnds === 2) openFour += 1;
  }

  if (openFour >= 2) total += 180000;
  if (openThree >= 2) total += 26000;

  board[y][x] = 0;

  const centerBias = 24 - (Math.abs(7 - x) + Math.abs(7 - y));
  return total + centerBias;
}

export function evaluateMove(board, x, y, player, opponent) {
  const attack = evaluatePoint(board, x, y, player);
  const defense = evaluatePoint(board, x, y, opponent);
  return attack * 1.0 + defense * 1.18;
}

export function staticBoardScore(board, aiPlayer, opponent) {
  let score = 0;
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      if (board[y][x] !== 0) continue;
      const aiS = evaluatePoint(board, x, y, aiPlayer);
      const oppS = evaluatePoint(board, x, y, opponent);
      score += aiS * 0.013 - oppS * 0.014;
    }
  }
  return score;
}
