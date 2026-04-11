(function () {
  "use strict";

  const BOARD_SIZE = 15;
  const CELL = 40;
  const PADDING = 20;
  const BLACK = 1;
  const WHITE = 2;
  const DIRECTIONS = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1]
  ];

  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const modeEl = document.getElementById("mode");
  const difficultyEl = document.getElementById("difficulty");
  const undoEl = document.getElementById("undo");
  const resetEl = document.getElementById("reset");
  const statusEl = document.getElementById("status");

  const state = {
    board: [],
    currentPlayer: BLACK,
    mode: "pvp",
    difficulty: "normal",
    winner: 0,
    isDraw: false,
    locked: false,
    history: [],
    aiTimer: null
  };

  function emptyBoard() {
    return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
  }

  function clearAITimer() {
    if (state.aiTimer !== null) {
      clearTimeout(state.aiTimer);
      state.aiTimer = null;
    }
  }

  function newGame(options) {
    clearAITimer();
    state.mode = options.mode || state.mode;
    state.difficulty = options.difficulty || state.difficulty;
    state.board = emptyBoard();
    state.currentPlayer = BLACK;
    state.winner = 0;
    state.isDraw = false;
    state.locked = false;
    state.history = [];
    difficultyEl.disabled = state.mode !== "pve";
    render();
  }

  function inBounds(x, y) {
    return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;
  }

  function cellFromPointer(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const px = (event.clientX - rect.left) * scaleX;
    const py = (event.clientY - rect.top) * scaleY;
    const x = Math.round((px - PADDING) / CELL);
    const y = Math.round((py - PADDING) / CELL);
    if (!inBounds(x, y)) return null;
    return { x, y };
  }

  function lineCount(x, y, dx, dy, player, board) {
    let c = 0;
    let nx = x + dx;
    let ny = y + dy;
    while (inBounds(nx, ny) && board[ny][nx] === player) {
      c += 1;
      nx += dx;
      ny += dy;
    }
    return c;
  }

  function checkWinner(x, y, board) {
    const player = board[y][x];
    if (!player) return 0;
    for (const [dx, dy] of DIRECTIONS) {
      const total =
        1 +
        lineCount(x, y, dx, dy, player, board) +
        lineCount(x, y, -dx, -dy, player, board);
      if (total >= 5) return player;
    }
    return 0;
  }

  function isBoardFull(board) {
    for (let y = 0; y < BOARD_SIZE; y += 1) {
      for (let x = 0; x < BOARD_SIZE; x += 1) {
        if (board[y][x] === 0) return false;
      }
    }
    return true;
  }

  function applyMove(x, y, player) {
    if (!inBounds(x, y)) return false;
    if (state.board[y][x] !== 0) return false;
    state.board[y][x] = player;
    state.history.push({ x, y, player });

    const winner = checkWinner(x, y, state.board);
    if (winner) {
      state.winner = winner;
      state.locked = true;
      return true;
    }
    if (isBoardFull(state.board)) {
      state.isDraw = true;
      state.locked = true;
      return true;
    }
    state.currentPlayer = player === BLACK ? WHITE : BLACK;
    return true;
  }

  function getLinePattern(board, x, y, player, dx, dy) {
    let forward = 0;
    let fx = x + dx;
    let fy = y + dy;
    while (inBounds(fx, fy) && board[fy][fx] === player) {
      forward += 1;
      fx += dx;
      fy += dy;
    }
    const forwardOpen = inBounds(fx, fy) && board[fy][fx] === 0;

    let backward = 0;
    let bx = x - dx;
    let by = y - dy;
    while (inBounds(bx, by) && board[by][bx] === player) {
      backward += 1;
      bx -= dx;
      by -= dy;
    }
    const backwardOpen = inBounds(bx, by) && board[by][bx] === 0;

    return {
      len: 1 + forward + backward,
      openEnds: (forwardOpen ? 1 : 0) + (backwardOpen ? 1 : 0)
    };
  }

  function patternScore(len, openEnds) {
    if (len >= 5) return 1000000;
    if (len === 4 && openEnds === 2) return 200000;
    if (len === 4 && openEnds === 1) return 35000;
    if (len === 3 && openEnds === 2) return 12000;
    if (len === 3 && openEnds === 1) return 2500;
    if (len === 2 && openEnds === 2) return 800;
    if (len === 2 && openEnds === 1) return 180;
    if (len === 1 && openEnds === 2) return 30;
    return 3;
  }

  function evaluatePointAdvanced(board, x, y, player) {
    if (board[y][x] !== 0) return -1;

    board[y][x] = player;
    let total = 0;
    let openThreeCount = 0;
    let openFourCount = 0;

    for (const [dx, dy] of DIRECTIONS) {
      const info = getLinePattern(board, x, y, player, dx, dy);
      total += patternScore(info.len, info.openEnds);
      if (info.len === 3 && info.openEnds === 2) openThreeCount += 1;
      if (info.len === 4 && info.openEnds === 2) openFourCount += 1;
    }

    if (openFourCount >= 2) total += 140000;
    if (openThreeCount >= 2) total += 30000;

    board[y][x] = 0;

    const centerBias = 20 - (Math.abs(7 - x) + Math.abs(7 - y));
    return total + centerBias;
  }

  function getCandidates(board, limit) {
    const occupied = [];
    for (let y = 0; y < BOARD_SIZE; y += 1) {
      for (let x = 0; x < BOARD_SIZE; x += 1) {
        if (board[y][x] !== 0) occupied.push({ x, y });
      }
    }

    if (occupied.length === 0) return [{ x: 7, y: 7 }];

    const set = new Set();
    for (const { x, y } of occupied) {
      for (let dy = -2; dy <= 2; dy += 1) {
        for (let dx = -2; dx <= 2; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (!inBounds(nx, ny) || board[ny][nx] !== 0) continue;
          set.add(nx + "," + ny);
        }
      }
    }

    const points = [];
    for (const key of set) {
      const pair = key.split(",");
      points.push({ x: Number(pair[0]), y: Number(pair[1]) });
    }

    points.sort((a, b) => {
      const da = Math.abs(7 - a.x) + Math.abs(7 - a.y);
      const db = Math.abs(7 - b.x) + Math.abs(7 - b.y);
      return da - db;
    });

    return points.slice(0, limit);
  }

  function evaluateMove(board, x, y, player) {
    const opponent = player === BLACK ? WHITE : BLACK;
    const attack = evaluatePointAdvanced(board, x, y, player);
    const defense = evaluatePointAdvanced(board, x, y, opponent);
    return attack * 1.0 + defense * 1.15;
  }

  function chooseAIMoveEasy() {
    const candidates = getCandidates(state.board, 180);
    const weighted = [];
    for (const p of candidates) {
      const distance = Math.abs(7 - p.x) + Math.abs(7 - p.y);
      const weight = Math.max(1, 10 - distance);
      for (let i = 0; i < weight; i += 1) {
        weighted.push(p);
      }
    }
    return weighted[Math.floor(Math.random() * weighted.length)];
  }

  function chooseAIMoveNormal() {
    const ai = WHITE;
    const candidates = getCandidates(state.board, 120);
    let best = null;

    for (const p of candidates) {
      state.board[p.y][p.x] = ai;
      const win = checkWinner(p.x, p.y, state.board);
      state.board[p.y][p.x] = 0;
      if (win === ai) return { x: p.x, y: p.y };
    }

    for (const p of candidates) {
      const score = evaluateMove(state.board, p.x, p.y, ai);
      if (!best || score > best.score) {
        best = { x: p.x, y: p.y, score };
      }
    }
    return best;
  }

  function chooseAIMoveHard() {
    const ai = WHITE;
    const opp = BLACK;
    const candidates = getCandidates(state.board, 64);

    for (const p of candidates) {
      state.board[p.y][p.x] = ai;
      const win = checkWinner(p.x, p.y, state.board);
      state.board[p.y][p.x] = 0;
      if (win === ai) return { x: p.x, y: p.y };
    }

    for (const p of candidates) {
      state.board[p.y][p.x] = opp;
      const win = checkWinner(p.x, p.y, state.board);
      state.board[p.y][p.x] = 0;
      if (win === opp) return { x: p.x, y: p.y };
    }

    let best = null;

    for (const p of candidates) {
      state.board[p.y][p.x] = ai;
      const immediate = evaluateMove(state.board, p.x, p.y, ai);

      const oppResponses = getCandidates(state.board, 24);
      let oppBest = -Infinity;
      for (const r of oppResponses) {
        state.board[r.y][r.x] = opp;
        const oppWin = checkWinner(r.x, r.y, state.board);
        if (oppWin === opp) {
          state.board[r.y][r.x] = 0;
          oppBest = 900000;
          break;
        }

        const replyCandidates = getCandidates(state.board, 14);
        let aiReplyBest = -Infinity;
        for (const a of replyCandidates) {
          const aiReplyScore = evaluateMove(state.board, a.x, a.y, ai);
          if (aiReplyScore > aiReplyBest) aiReplyBest = aiReplyScore;
        }

        const responseScore = evaluateMove(state.board, r.x, r.y, opp) - aiReplyBest * 0.55;
        if (responseScore > oppBest) oppBest = responseScore;

        state.board[r.y][r.x] = 0;
      }

      state.board[p.y][p.x] = 0;

      const total = immediate - oppBest * 0.9;
      if (!best || total > best.score) {
        best = { x: p.x, y: p.y, score: total };
      }
    }

    return best || chooseAIMoveNormal();
  }

  function aiMove() {
    if (state.mode !== "pve" || state.locked || state.currentPlayer !== WHITE) return;

    clearAITimer();
    state.locked = true;
    render();

    state.aiTimer = setTimeout(() => {
      state.aiTimer = null;
      let choice;

      if (state.difficulty === "easy") {
        choice = chooseAIMoveEasy();
      } else if (state.difficulty === "hard") {
        choice = chooseAIMoveHard();
      } else {
        choice = chooseAIMoveNormal();
      }

      if (choice) {
        applyMove(choice.x, choice.y, WHITE);
      }

      if (!state.winner && !state.isDraw) {
        state.locked = false;
      }
      render();
    }, 220);
  }

  function undoMove() {
    if (state.history.length === 0) return;

    clearAITimer();

    let popCount = 1;
    if (state.mode === "pve" && state.history.length >= 2) {
      const last = state.history[state.history.length - 1];
      const prev = state.history[state.history.length - 2];
      if (last.player === WHITE && prev.player === BLACK) {
        popCount = 2;
      }
    }

    for (let i = 0; i < popCount; i += 1) {
      const step = state.history.pop();
      if (!step) break;
      state.board[step.y][step.x] = 0;
    }

    state.winner = 0;
    state.isDraw = false;
    state.locked = false;
    state.currentPlayer = state.history.length % 2 === 0 ? BLACK : WHITE;

    if (state.mode === "pve") {
      state.currentPlayer = BLACK;
    }

    render();
  }

  function handlePlayerMove(x, y) {
    if (state.locked || state.winner || state.isDraw) return;
    if (state.mode === "pve" && state.currentPlayer !== BLACK) return;

    const moved = applyMove(x, y, state.currentPlayer);
    if (!moved) return;

    render();

    if (!state.winner && !state.isDraw && state.mode === "pve") {
      aiMove();
    }
  }

  function drawBoardGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#4f4635";
    ctx.lineWidth = 1;

    for (let i = 0; i < BOARD_SIZE; i += 1) {
      const pos = PADDING + i * CELL;

      ctx.beginPath();
      ctx.moveTo(PADDING, pos);
      ctx.lineTo(PADDING + CELL * (BOARD_SIZE - 1), pos);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(pos, PADDING);
      ctx.lineTo(pos, PADDING + CELL * (BOARD_SIZE - 1));
      ctx.stroke();
    }
  }

  function drawStarPoints() {
    const stars = [
      [3, 3],
      [11, 3],
      [7, 7],
      [3, 11],
      [11, 11]
    ];

    ctx.fillStyle = "#2f2a20";
    for (const [x, y] of stars) {
      const cx = PADDING + x * CELL;
      const cy = PADDING + y * CELL;
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawStone(x, y, player) {
    const cx = PADDING + x * CELL;
    const cy = PADDING + y * CELL;
    const r = 15;

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);

    const grd = ctx.createRadialGradient(cx - 6, cy - 6, 3, cx, cy, r);
    if (player === BLACK) {
      grd.addColorStop(0, "#696969");
      grd.addColorStop(1, "#111");
    } else {
      grd.addColorStop(0, "#ffffff");
      grd.addColorStop(1, "#d9d9d9");
    }

    ctx.fillStyle = grd;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.stroke();
  }

  function renderStatus() {
    if (state.winner) {
      statusEl.textContent = state.winner === BLACK ? "Black wins" : "White wins";
      return;
    }

    if (state.isDraw) {
      statusEl.textContent = "Draw";
      return;
    }

    if (state.mode === "pve" && state.currentPlayer === WHITE) {
      statusEl.textContent = "AI is thinking...";
      return;
    }

    statusEl.textContent = state.currentPlayer === BLACK ? "Turn: Black" : "Turn: White";
  }

  function render() {
    drawBoardGrid();
    drawStarPoints();

    for (let y = 0; y < BOARD_SIZE; y += 1) {
      for (let x = 0; x < BOARD_SIZE; x += 1) {
        const cell = state.board[y][x];
        if (cell) drawStone(x, y, cell);
      }
    }

    renderStatus();
  }

  modeEl.addEventListener("change", function () {
    newGame({ mode: modeEl.value, difficulty: difficultyEl.value });
  });

  difficultyEl.addEventListener("change", function () {
    if (state.mode === "pve") {
      newGame({ mode: "pve", difficulty: difficultyEl.value });
    }
  });

  undoEl.addEventListener("click", function () {
    undoMove();
  });

  resetEl.addEventListener("click", function () {
    newGame({ mode: modeEl.value, difficulty: difficultyEl.value });
  });

  canvas.addEventListener("click", function (event) {
    const cell = cellFromPointer(event);
    if (!cell) return;
    handlePlayerMove(cell.x, cell.y);
  });

  newGame({ mode: modeEl.value, difficulty: difficultyEl.value });

  window.newGame = newGame;
  window.handlePlayerMove = handlePlayerMove;
  window.aiMove = aiMove;
  window.checkWinner = checkWinner;
  window.render = render;
  window.undoMove = undoMove;
})();