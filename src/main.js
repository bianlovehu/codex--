import {
  AI_TIME_BUDGET,
  BLACK,
  CELL,
  DIFFICULTY_EASY,
  DIFFICULTY_HARD,
  MODE_PVE,
  PADDING,
  WHITE
} from "./constants.js";
import { AIWorkerClient } from "./ai/worker-client.js";
import { chooseEasyMove, chooseNormalMove } from "./ai/strategies.js";
import { requestLLMMove } from "./ai/llm-client.js";
import { getCandidates } from "./ai/candidates.js";
import { AudioManager } from "./audio/audio-manager.js";
import { createInitialState } from "./core/game-state.js";
import { checkWinner, createEmptyBoard, createSnapshot, findWinningLine, inBounds, isBoardFull } from "./core/rules.js";
import { CanvasRenderer } from "./render/canvas-renderer.js";

const modeEl = document.getElementById("mode");
const difficultyEl = document.getElementById("difficulty");
const undoEl = document.getElementById("undo");
const resetEl = document.getElementById("reset");
const statusEl = document.getElementById("status");
const aiMetaEl = document.getElementById("aiMeta");
const boardEl = document.getElementById("board");
const muteToggleEl = document.getElementById("muteToggle");
const sfxVolumeEl = document.getElementById("sfxVolume");
const bgmVolumeEl = document.getElementById("bgmVolume");
const bgmEl = document.getElementById("bgm");

const reduceEffects = window.matchMedia("(max-width: 820px)").matches;
const renderer = new CanvasRenderer(boardEl, { reduceEffects });
const audio = new AudioManager(bgmEl);
const aiWorkerClient = new AIWorkerClient();
const state = createInitialState();

function syncAudioControls() {
  const settings = audio.getSettings();
  sfxVolumeEl.value = String(Math.round(settings.sfxVolume * 100));
  bgmVolumeEl.value = String(Math.round(settings.bgmVolume * 100));
  updateMuteButton(settings.masterMuted);
}

function updateMuteButton(isMuted) {
  muteToggleEl.textContent = isMuted ? "静音：开" : "静音：关";
  muteToggleEl.setAttribute("aria-pressed", String(isMuted));
}

function clearAITimer() {
  if (state.aiTimer) {
    clearTimeout(state.aiTimer);
    state.aiTimer = null;
  }
}

function nextPlayer() {
  return state.currentPlayer === BLACK ? WHITE : BLACK;
}

function setStatusText() {
  if (state.winner) {
    statusEl.textContent = state.winner === BLACK ? "对局结束：黑棋胜" : "对局结束：白棋胜";
    return;
  }
  if (state.isDraw) {
    statusEl.textContent = "对局结束：平局";
    return;
  }
  if (state.mode === MODE_PVE && state.currentPlayer === WHITE) {
    if (state.difficulty === DIFFICULTY_HARD && state.llmThinking) {
      statusEl.textContent = "困难模式：大模型思考中...";
    } else {
      statusEl.textContent = "电脑正在思考...";
    }
    return;
  }
  statusEl.textContent = state.currentPlayer === BLACK ? "当前回合：黑棋" : "当前回合：白棋";
}

function setAIMetaText() {
  if (!state.aiMeta || state.mode !== MODE_PVE) {
    aiMetaEl.textContent = "";
    return;
  }
  const parts = [];
  if (state.aiMeta.source) parts.push(`来源: ${state.aiMeta.source}`);
  if (state.aiMeta.model) parts.push(`模型: ${state.aiMeta.model}`);
  if (typeof state.aiMeta.depthReached === "number") parts.push(`搜索深度 ${state.aiMeta.depthReached}`);
  if (typeof state.aiMeta.nodes === "number") parts.push(`节点 ${state.aiMeta.nodes}`);
  if (typeof state.aiMeta.timeMs === "number") parts.push(`用时 ${state.aiMeta.timeMs}ms`);
  if (typeof state.aiMeta.latencyMs === "number") parts.push(`LLM延迟 ${state.aiMeta.latencyMs}ms`);
  if (state.aiMeta.fallback) parts.push("已回退本地策略");
  aiMetaEl.textContent = parts.join(" · ");
}

function render() {
  setStatusText();
  setAIMetaText();
  renderer.render(state);
}

function resetRuntimeState() {
  state.board = createEmptyBoard();
  state.currentPlayer = BLACK;
  state.winner = 0;
  state.isDraw = false;
  state.locked = false;
  state.history = [];
  state.lastMove = null;
  state.winningLine = null;
  state.aiMeta = null;
  state.llmThinking = false;
}

function newGame({ mode, difficulty }) {
  clearAITimer();
  state.aiRequestId += 1;
  state.mode = mode || state.mode;
  state.difficulty = difficulty || state.difficulty;
  difficultyEl.disabled = state.mode !== MODE_PVE;
  resetRuntimeState();
  render();
}

function applyMove(x, y, player) {
  if (!inBounds(x, y)) return false;
  if (state.board[y][x] !== 0) return false;
  if (state.winner || state.isDraw) return false;

  state.board[y][x] = player;
  const serial = state.history.length + 1;
  state.history.push({ x, y, player, serial });
  state.lastMove = { x, y, player, serial };
  state.aiMeta = null;

  const winner = checkWinner(x, y, state.board);
  if (winner) {
    state.winner = winner;
    state.winningLine = findWinningLine(x, y, state.board);
    state.locked = true;
    return true;
  }

  if (isBoardFull(state.board)) {
    state.isDraw = true;
    state.winningLine = null;
    state.locked = true;
    return true;
  }

  state.currentPlayer = nextPlayer();
  return true;
}

function playOutcomeSound() {
  if (!state.winner) return;
  if (state.mode !== MODE_PVE) {
    audio.playSfx("win");
    return;
  }
  if (state.winner === BLACK) audio.playSfx("win");
  else audio.playSfx("lose");
}

function cellFromPointer(event) {
  const rect = boardEl.getBoundingClientRect();
  const scaleX = boardEl.width / rect.width;
  const scaleY = boardEl.height / rect.height;
  const px = (event.clientX - rect.left) * scaleX;
  const py = (event.clientY - rect.top) * scaleY;
  const x = Math.round((px - PADDING) / CELL);
  const y = Math.round((py - PADDING) / CELL);
  if (!inBounds(x, y)) return null;
  return { x, y };
}

async function requestAIMove(snapshot, options) {
  const difficulty = options.difficulty || state.difficulty;
  const timeBudgetMs = options.timeBudgetMs || AI_TIME_BUDGET[difficulty] || 200;
  const llmEnabled = options.llmEnabled !== false;

  if (difficulty === DIFFICULTY_EASY) {
    return { move: chooseEasyMove(snapshot.board, WHITE), meta: { timeMs: 0, nodes: 0, depthReached: 0, source: "local" } };
  }

  if (difficulty !== DIFFICULTY_HARD) {
    return { move: chooseNormalMove(snapshot.board, WHITE), meta: { timeMs: 0, nodes: 0, depthReached: 0, source: "local" } };
  }

  if (llmEnabled) {
    try {
      state.llmThinking = true;
      render();

      const candidatePool = getCandidates(snapshot.board, 18, 2);
      if (candidatePool.length === 0) {
        throw new Error("无可用候选点");
      }

      const llmResult = await requestLLMMove(snapshot, {
        timeoutMs: 12000,
        model: "deepseek-chat",
        candidatePool: candidatePool.map(c => [c.x, c.y])
      });

      if (llmResult.candidates && llmResult.candidates.length > 0) {
        const topCandidates = llmResult.candidates.slice(0, 3);
        
        try {
          const searchResult = await aiWorkerClient.requestSearch(snapshot, {
            difficulty,
            timeBudgetMs: Math.max(500, timeBudgetMs - llmResult.latencyMs),
            maxDepth: 6,
            aiPlayer: WHITE,
            forcedCandidates: topCandidates
          });

          return {
            move: { x: searchResult.x, y: searchResult.y },
            meta: {
              source: "llm+search",
              model: llmResult.model,
              latencyMs: llmResult.latencyMs,
              nodes: searchResult.nodes,
              timeMs: searchResult.timeMs + llmResult.latencyMs,
              depthReached: searchResult.depthReached,
              tokenUsage: llmResult.tokenUsage
            }
          };
        } catch (searchError) {
          return {
            move: { x: topCandidates[0].x, y: topCandidates[0].y },
            meta: {
              source: "llm",
              model: llmResult.model,
              latencyMs: llmResult.latencyMs,
              nodes: 0,
              timeMs: llmResult.latencyMs,
              depthReached: 0,
              tokenUsage: llmResult.tokenUsage,
              fallback: true
            }
          };
        }
      } else {
        throw new Error("LLM 未返回有效候选");
      }
    } catch (llmError) {
      console.warn("LLM 请求失败，回退到本地困难模式:", llmError.message);
    } finally {
      state.llmThinking = false;
    }
  }

  try {
    const result = await aiWorkerClient.requestSearch(snapshot, {
      difficulty,
      timeBudgetMs,
      maxDepth: 7,
      aiPlayer: WHITE
    });
    return {
      move: { x: result.x, y: result.y },
      meta: {
        source: "local",
        nodes: result.nodes,
        timeMs: result.timeMs,
        depthReached: result.depthReached
      }
    };
  } catch (_error) {
    return {
      move: chooseNormalMove(snapshot.board, WHITE),
      meta: { fallback: true, nodes: 0, timeMs: 0, depthReached: 0, source: "local" }
    };
  }
}

function queueAIMove() {
  if (state.mode !== MODE_PVE || state.currentPlayer !== WHITE || state.winner || state.isDraw) return;
  state.locked = true;
  const reqId = ++state.aiRequestId;
  const snapshot = createSnapshot(state);
  render();

  clearAITimer();
  state.aiTimer = setTimeout(async () => {
    state.aiTimer = null;
    const outcome = await requestAIMove(snapshot, {
      difficulty: state.difficulty,
      timeBudgetMs: AI_TIME_BUDGET[state.difficulty]
    });
    if (reqId !== state.aiRequestId) return;
    if (outcome.move) {
      applyMove(outcome.move.x, outcome.move.y, WHITE);
      audio.playSfx("place");
    }
    state.aiMeta = outcome.meta || null;
    if (!state.winner && !state.isDraw) {
      state.locked = false;
    }
    if (state.winner) {
      playOutcomeSound();
    }
    render();
  }, 120);
}

function handlePlayerMove(x, y) {
  if (state.locked || state.winner || state.isDraw) return;
  if (state.mode === MODE_PVE && state.currentPlayer !== BLACK) return;
  const moved = applyMove(x, y, state.currentPlayer);
  if (!moved) return;

  audio.playSfx("place");
  if (state.winner) playOutcomeSound();
  render();

  if (!state.winner && !state.isDraw && state.mode === MODE_PVE) {
    queueAIMove();
  }
}

function undoMove() {
  if (state.history.length === 0) return;
  clearAITimer();
  state.aiRequestId += 1;

  let popCount = 1;
  if (state.mode === MODE_PVE && state.history.length >= 2) {
    const a = state.history[state.history.length - 1];
    const b = state.history[state.history.length - 2];
    if (a.player === WHITE && b.player === BLACK) popCount = 2;
  }

  for (let i = 0; i < popCount; i += 1) {
    const step = state.history.pop();
    if (!step) break;
    state.board[step.y][step.x] = 0;
  }

  state.winner = 0;
  state.isDraw = false;
  state.locked = false;
  state.winningLine = null;
  state.aiMeta = null;
  state.lastMove = state.history.length ? { ...state.history[state.history.length - 1] } : null;

  if (state.mode === MODE_PVE) {
    state.currentPlayer = BLACK;
  } else {
    state.currentPlayer = state.history.length % 2 === 0 ? BLACK : WHITE;
  }

  audio.playSfx("undo");
  render();
}

function initAudioGesture() {
  audio.initAfterGesture();
}

modeEl.addEventListener("change", () => {
  audio.initAfterGesture();
  audio.playSfx("mode");
  newGame({ mode: modeEl.value, difficulty: difficultyEl.value });
});

difficultyEl.addEventListener("change", () => {
  audio.initAfterGesture();
  audio.playSfx("button");
  newGame({ mode: modeEl.value, difficulty: difficultyEl.value });
});

undoEl.addEventListener("click", () => {
  audio.initAfterGesture();
  undoMove();
});

resetEl.addEventListener("click", () => {
  audio.initAfterGesture();
  audio.playSfx("button");
  newGame({ mode: modeEl.value, difficulty: difficultyEl.value });
});

boardEl.addEventListener("click", (event) => {
  audio.initAfterGesture();
  const cell = cellFromPointer(event);
  if (!cell) return;
  handlePlayerMove(cell.x, cell.y);
});

muteToggleEl.addEventListener("click", () => {
  audio.initAfterGesture();
  const current = audio.getSettings().masterMuted;
  audio.setMasterMute(!current);
  updateMuteButton(!current);
  audio.playSfx("button");
});

sfxVolumeEl.addEventListener("input", () => {
  audio.initAfterGesture();
  audio.setSfxVolume(Number(sfxVolumeEl.value) / 100);
});

bgmVolumeEl.addEventListener("input", () => {
  audio.initAfterGesture();
  audio.setBgmVolume(Number(bgmVolumeEl.value) / 100);
});

window.addEventListener(
  "pointerdown",
  () => {
    initAudioGesture();
  },
  { once: true, capture: true }
);

syncAudioControls();
newGame({ mode: modeEl.value, difficulty: difficultyEl.value });

window.newGame = newGame;
window.handlePlayerMove = handlePlayerMove;
window.undoMove = undoMove;
window.requestAIMove = requestAIMove;
window.render = render;
window.checkWinner = checkWinner;
window.audio = {
  initAfterGesture: () => audio.initAfterGesture(),
  playSfx: (type) => audio.playSfx(type),
  setMasterMute: (flag) => {
    audio.setMasterMute(flag);
    updateMuteButton(Boolean(flag));
  },
  setSfxVolume: (v) => audio.setSfxVolume(v),
  setBgmVolume: (v) => audio.setBgmVolume(v)
};