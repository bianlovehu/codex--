import { DIFFICULTY_EASY, DIFFICULTY_HARD, WHITE, opponentOf } from "../constants.js";
import { checkWinner } from "../core/rules.js";
import { getCandidates } from "./candidates.js";
import { evaluateMove } from "./heuristic.js";

function immediateWinningMove(board, player, candidates) {
  for (const p of candidates) {
    board[p.y][p.x] = player;
    const won = checkWinner(p.x, p.y, board) === player;
    board[p.y][p.x] = 0;
    if (won) return { x: p.x, y: p.y };
  }
  return null;
}

export function chooseEasyMove(board, aiPlayer = WHITE) {
  const candidates = getCandidates(board, 180, 2);
  const weighted = [];
  for (const p of candidates) {
    const d = Math.abs(7 - p.x) + Math.abs(7 - p.y);
    const w = Math.max(1, 12 - d);
    for (let i = 0; i < w; i += 1) weighted.push(p);
  }
  if (weighted.length === 0) return null;
  return weighted[Math.floor(Math.random() * weighted.length)];
}

export function chooseNormalMove(board, aiPlayer = WHITE) {
  const opponent = opponentOf(aiPlayer);
  const candidates = getCandidates(board, 110, 2);

  const win = immediateWinningMove(board, aiPlayer, candidates);
  if (win) return win;

  const mustBlock = immediateWinningMove(board, opponent, candidates);
  if (mustBlock) return mustBlock;

  let best = null;
  for (const p of candidates) {
    const score = evaluateMove(board, p.x, p.y, aiPlayer, opponent);
    if (!best || score > best.score) {
      best = { x: p.x, y: p.y, score };
    }
  }
  return best;
}

export function fallbackMoveByDifficulty(board, difficulty, aiPlayer = WHITE) {
  if (difficulty === DIFFICULTY_EASY) return chooseEasyMove(board, aiPlayer);
  if (difficulty === DIFFICULTY_HARD) return chooseNormalMove(board, aiPlayer);
  return chooseNormalMove(board, aiPlayer);
}

export function defaultAIPlayerForMode(mode) {
  return mode === "pve" ? WHITE : BLACK;
}
