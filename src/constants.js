export const BOARD_SIZE = 15;
export const CELL = 40;
export const PADDING = 20;

export const BLACK = 1;
export const WHITE = 2;

export const MODE_PVP = "pvp";
export const MODE_PVE = "pve";

export const DIFFICULTY_EASY = "easy";
export const DIFFICULTY_NORMAL = "normal";
export const DIFFICULTY_HARD = "hard";

export const AI_TIME_BUDGET = {
  [DIFFICULTY_EASY]: 40,
  [DIFFICULTY_NORMAL]: 120,
  [DIFFICULTY_HARD]: 2000
};

export const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1]
];

export function opponentOf(player) {
  return player === BLACK ? WHITE : BLACK;
}
