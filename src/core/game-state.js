import { BLACK, DIFFICULTY_NORMAL, MODE_PVP } from "../constants.js";
import { createEmptyBoard } from "./rules.js";

export function createInitialState() {
  return {
    board: createEmptyBoard(),
    currentPlayer: BLACK,
    mode: MODE_PVP,
    difficulty: DIFFICULTY_NORMAL,
    winner: 0,
    isDraw: false,
    locked: false,
    history: [],
    lastMove: null,
    winningLine: null,
    aiMeta: null,
    aiTimer: null,
    aiRequestId: 0
  };
}
