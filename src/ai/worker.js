import { BOARD_SIZE, BLACK, WHITE, opponentOf } from "../constants.js";
import { getCandidates } from "./candidates.js";
import { evaluateMove, staticBoardScore } from "./heuristic.js";
import { checkWinner, isBoardFull } from "../core/rules.js";

const WIN_SCORE = 10_000_000;

class TimeoutError extends Error {}

function mulberry32(seed) {
  let t = seed >>> 0;
  return function next() {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function buildZobrist(seed) {
  const rand = mulberry32(seed);
  const table = Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => [0, (rand() * 0xffffffff) >>> 0, (rand() * 0xffffffff) >>> 0])
  );
  return table;
}

function computeHash(board, table) {
  let hash = 0;
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      const p = board[y][x];
      if (p) hash ^= table[y][x][p];
    }
  }
  return hash >>> 0;
}

function findAnyEmpty(board) {
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      if (board[y][x] === 0) return { x, y };
    }
  }
  return null;
}

function candidateLimitByDepth(depth) {
  if (depth >= 5) return 10;
  if (depth >= 3) return 14;
  return 18;
}

function sortMoves(board, moves, player, ttMove) {
  const opponent = opponentOf(player);
  const scored = [];
  for (const m of moves) {
    let score = evaluateMove(board, m.x, m.y, player, opponent);
    if (ttMove && ttMove.x === m.x && ttMove.y === m.y) score += 10_000_000;
    scored.push({ x: m.x, y: m.y, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

function searchRoot(ctx, depth) {
  const { board, aiPlayer, table, maxTimeMs, startTime, tt } = ctx;
  const currentPlayer = aiPlayer;
  let alpha = -Infinity;
  const beta = Infinity;

  const moves = getCandidates(board, candidateLimitByDepth(depth) + 4, 2);
  if (!moves.length) return { move: findAnyEmpty(board), score: 0 };

  const hash = computeHash(board, table);
  const ttEntry = tt.get(hash);
  const ordered = sortMoves(board, moves, currentPlayer, ttEntry && ttEntry.move);

  let bestMove = ordered[0];
  let bestScore = -Infinity;

  for (const move of ordered) {
    if (Date.now() - startTime >= maxTimeMs) throw new TimeoutError("超时");
    board[move.y][move.x] = currentPlayer;
    const winner = checkWinner(move.x, move.y, board);
    let score;
    if (winner === aiPlayer) {
      score = WIN_SCORE - 1;
    } else {
      score =
        -negamax(ctx, depth - 1, -beta, -alpha, opponentOf(currentPlayer), { x: move.x, y: move.y }, 1);
    }
    board[move.y][move.x] = 0;

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
    if (score > alpha) alpha = score;
  }

  return { move: { x: bestMove.x, y: bestMove.y }, score: bestScore };
}

function negamax(ctx, depth, alpha, beta, player, lastMove, ply) {
  ctx.nodes += 1;
  if ((ctx.nodes & 255) === 0 && Date.now() - ctx.startTime >= ctx.maxTimeMs) {
    throw new TimeoutError("超时");
  }

  const { board, aiPlayer, table, tt } = ctx;
  const opponent = opponentOf(player);

  if (lastMove) {
    const winner = checkWinner(lastMove.x, lastMove.y, board);
    if (winner === aiPlayer) return WIN_SCORE - ply;
    if (winner && winner !== aiPlayer) return -WIN_SCORE + ply;
  }

  if (depth <= 0) {
    return staticBoardScore(board, aiPlayer, opponentOf(aiPlayer));
  }
  if (isBoardFull(board)) return 0;

  const hash = computeHash(board, table);
  const ttEntry = tt.get(hash);
  if (ttEntry && ttEntry.depth >= depth) {
    if (ttEntry.flag === "exact") return ttEntry.score;
    if (ttEntry.flag === "lower") alpha = Math.max(alpha, ttEntry.score);
    if (ttEntry.flag === "upper") beta = Math.min(beta, ttEntry.score);
    if (alpha >= beta) return ttEntry.score;
  }

  const rawMoves = getCandidates(board, candidateLimitByDepth(depth), 2);
  if (!rawMoves.length) return 0;
  const moves = sortMoves(board, rawMoves, player, ttEntry && ttEntry.move);

  const originalAlpha = alpha;
  let bestScore = -Infinity;
  let bestMove = moves[0];

  for (const move of moves) {
    board[move.y][move.x] = player;
    const score = -negamax(ctx, depth - 1, -beta, -alpha, opponent, { x: move.x, y: move.y }, ply + 1);
    board[move.y][move.x] = 0;

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }

  let flag = "exact";
  if (bestScore <= originalAlpha) flag = "upper";
  else if (bestScore >= beta) flag = "lower";

  tt.set(hash, { depth, score: bestScore, flag, move: { x: bestMove.x, y: bestMove.y } });
  return bestScore;
}

function solve(payload) {
  const startTime = Date.now();
  const aiPlayer = payload.aiPlayer || WHITE;
  const board = payload.board.map((row) => row.slice());
  const table = buildZobrist((payload.zobristKey || 1234567) >>> 0);
  const maxTimeMs = Math.max(120, payload.maxTimeMs || 2000);
  const maxDepth = Math.max(2, payload.maxDepth || 6);
  const tt = new Map();

  let best = findAnyEmpty(board);
  let depthReached = 0;
  let score = 0;
  const ctx = { board, aiPlayer, table, maxTimeMs, startTime, nodes: 0, tt };

  try {
    for (let depth = 1; depth <= maxDepth; depth += 1) {
      const result = searchRoot(ctx, depth);
      if (result && result.move) {
        best = result.move;
        score = result.score;
        depthReached = depth;
      }
      if (Date.now() - startTime >= maxTimeMs) break;
    }
  } catch (error) {
    if (!(error instanceof TimeoutError)) {
      throw error;
    }
  }

  return {
    x: best ? best.x : 7,
    y: best ? best.y : 7,
    score,
    depthReached,
    nodes: ctx.nodes,
    timeMs: Date.now() - startTime
  };
}

self.onmessage = (event) => {
  const msg = event.data;
  if (!msg || msg.type !== "SEARCH") return;

  try {
    const result = solve(msg.payload || {});
    self.postMessage({
      id: msg.id,
      type: "RESULT",
      payload: result
    });
  } catch (error) {
    self.postMessage({
      id: msg.id,
      type: "ERROR",
      payload: {
        message: error && error.message ? error.message : "搜索失败"
      }
    });
  }
};
