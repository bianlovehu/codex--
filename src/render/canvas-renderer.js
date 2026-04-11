import { BLACK, BOARD_SIZE, CELL, PADDING } from "../constants.js";

export class CanvasRenderer {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.reduceEffects = Boolean(options.reduceEffects);
    this.lastAnimatedMoveSerial = -1;
    this.lastMoveAnimation = null;
    this.particles = [];
    this.animationFrame = 0;
    this.latestState = null;
  }

  render(state) {
    this.latestState = state;
    this.drawFrame(state, performance.now());
    this.kickAnimationLoop();
  }

  kickAnimationLoop() {
    if (this.animationFrame) return;
    const tick = (time) => {
      this.animationFrame = 0;
      if (!this.latestState) return;
      const active = this.hasActiveAnimation(time);
      if (!active) return;
      this.drawFrame(this.latestState, time);
      this.animationFrame = requestAnimationFrame(tick);
    };
    if (this.hasActiveAnimation(performance.now())) {
      this.animationFrame = requestAnimationFrame(tick);
    }
  }

  hasActiveAnimation(now) {
    if (this.lastMoveAnimation && now - this.lastMoveAnimation.start < 320) return true;
    for (const p of this.particles) {
      if (p.life < p.maxLife) return true;
    }
    return false;
  }

  drawFrame(state, now) {
    this.detectNewMove(state, now);
    this.paintBoard();
    this.paintWinningLine(state, now);
    this.paintPieces(state, now);
    this.paintParticles(now);
  }

  detectNewMove(state, now) {
    if (!state.lastMove) return;
    if (state.lastMove.serial === this.lastAnimatedMoveSerial) return;
    this.lastAnimatedMoveSerial = state.lastMove.serial;
    this.lastMoveAnimation = {
      x: state.lastMove.x,
      y: state.lastMove.y,
      start: now
    };
    this.spawnParticles(state.lastMove.x, state.lastMove.y, state.lastMove.player);
  }

  boardToPixel(x, y) {
    return {
      x: PADDING + x * CELL,
      y: PADDING + y * CELL
    };
  }

  paintBoard() {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "#5a4631";
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

    const stars = [
      [3, 3],
      [11, 3],
      [7, 7],
      [3, 11],
      [11, 11]
    ];
    ctx.fillStyle = "#3b2816";
    for (const [x, y] of stars) {
      const point = this.boardToPixel(x, y);
      ctx.beginPath();
      ctx.arc(point.x, point.y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  paintWinningLine(state, now) {
    if (!state.winningLine || state.winningLine.length < 2) return;
    const { ctx } = this;
    const pulse = 0.5 + Math.sin(now / 110) * 0.25;
    ctx.strokeStyle = `rgba(217, 80, 33, ${pulse.toFixed(3)})`;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    const start = this.boardToPixel(state.winningLine[0].x, state.winningLine[0].y);
    const end = this.boardToPixel(
      state.winningLine[state.winningLine.length - 1].x,
      state.winningLine[state.winningLine.length - 1].y
    );
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }

  paintPieces(state, now) {
    for (let y = 0; y < BOARD_SIZE; y += 1) {
      for (let x = 0; x < BOARD_SIZE; x += 1) {
        const player = state.board[y][x];
        if (!player) continue;
        let scale = 1;
        let glow = 0;
        if (
          this.lastMoveAnimation &&
          this.lastMoveAnimation.x === x &&
          this.lastMoveAnimation.y === y &&
          now - this.lastMoveAnimation.start < 320
        ) {
          const t = Math.min(1, (now - this.lastMoveAnimation.start) / 320);
          const eased = 1 - Math.pow(1 - t, 3);
          scale = 0.65 + 0.35 * eased;
          glow = 0.25 * (1 - t);
        }
        this.paintStone(x, y, player, scale, glow);
      }
    }
    this.paintLastMoveMarker(state, now);
  }

  paintStone(x, y, player, scale = 1, glow = 0) {
    const { ctx } = this;
    const point = this.boardToPixel(x, y);
    const radius = 15 * scale;
    ctx.save();
    if (!this.reduceEffects) {
      ctx.shadowBlur = 12 + glow * 25;
      ctx.shadowColor = player === BLACK ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.6)";
    }
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    const grd = ctx.createRadialGradient(point.x - 5, point.y - 5, 2, point.x, point.y, radius + 2);
    if (player === BLACK) {
      grd.addColorStop(0, "#8b8b8b");
      grd.addColorStop(1, "#121212");
    } else {
      grd.addColorStop(0, "#ffffff");
      grd.addColorStop(1, "#d5d5d5");
    }
    ctx.fillStyle = grd;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  paintLastMoveMarker(state, now) {
    if (!state.lastMove) return;
    const { x, y } = state.lastMove;
    const { ctx } = this;
    const p = this.boardToPixel(x, y);
    const phase = 0.5 + 0.5 * Math.sin(now / 170);
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5 + phase * 2.2, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(214, 92, 28, 0.9)";
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();
  }

  spawnParticles(x, y, player) {
    if (this.reduceEffects) return;
    const center = this.boardToPixel(x, y);
    const count = 14;
    const color = player === BLACK ? "255,255,255" : "61,45,33";
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.24;
      const speed = 0.35 + Math.random() * 1.45;
      this.particles.push({
        x: center.x,
        y: center.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 28 + Math.random() * 16,
        color
      });
    }
  }

  paintParticles() {
    const { ctx } = this;
    const next = [];
    for (const p of this.particles) {
      p.life += 1;
      if (p.life >= p.maxLife) continue;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.02;
      const alpha = 1 - p.life / p.maxLife;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.color},${alpha.toFixed(3)})`;
      ctx.fill();
      next.push(p);
    }
    this.particles = next;
  }
}
