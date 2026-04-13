import { DIFFICULTY_HARD } from "../constants.js";

export class AIWorkerClient {
  constructor() {
    this.worker = null;
    this.pending = new Map();
    this.available = false;
    this.idSeq = 0;
    this._createWorker();
  }

  _createWorker() {
    try {
      this.worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
      this.worker.onmessage = (event) => this._onMessage(event.data);
      this.worker.onerror = () => {
        this.available = false;
      };
      this.available = true;
    } catch (_error) {
      this.available = false;
      this.worker = null;
    }
  }

  _onMessage(message) {
    if (!message || typeof message.id !== "number") return;
    const entry = this.pending.get(message.id);
    if (!entry) return;
    this.pending.delete(message.id);
    clearTimeout(entry.timer);

    if (message.type === "RESULT") {
      entry.resolve(message.payload);
    } else {
      entry.reject(new Error((message.payload && message.payload.message) || "Worker 执行失败"));
    }
  }

  requestSearch(snapshot, options) {
    if (!this.available || !this.worker || options.difficulty !== DIFFICULTY_HARD) {
      return Promise.reject(new Error("Worker 不可用"));
    }

    const id = ++this.idSeq;
    const maxTimeMs = options.timeBudgetMs || 2000;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("搜索超时"));
      }, maxTimeMs + 220);

      this.pending.set(id, { resolve, reject, timer });
      this.worker.postMessage({
        id,
        type: "SEARCH",
        payload: {
          board: snapshot.board,
          currentPlayer: snapshot.currentPlayer,
          aiPlayer: options.aiPlayer,
          maxTimeMs,
          maxDepth: options.maxDepth || 6,
          zobristKey: options.zobristKey || Date.now(),
          forcedCandidates: options.forcedCandidates || null
        }
      });
    });
  }
}