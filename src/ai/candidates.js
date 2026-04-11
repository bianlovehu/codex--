import { BOARD_SIZE } from "../constants.js";
import { inBounds } from "../core/rules.js";

export function getCandidates(board, limit = 64, radius = 2) {
  const occupied = [];
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      if (board[y][x] !== 0) occupied.push({ x, y });
    }
  }

  if (occupied.length === 0) return [{ x: 7, y: 7 }];

  const set = new Set();
  for (const { x, y } of occupied) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(nx, ny) || board[ny][nx] !== 0) continue;
        set.add(nx + "," + ny);
      }
    }
  }

  const points = [];
  for (const key of set) {
    const [sx, sy] = key.split(",");
    const x = Number(sx);
    const y = Number(sy);
    const centerBias = 28 - (Math.abs(7 - x) + Math.abs(7 - y));
    points.push({ x, y, centerBias });
  }

  points.sort((a, b) => b.centerBias - a.centerBias);
  return points.slice(0, limit);
}
