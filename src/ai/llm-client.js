const API_BASE_URL = window.location.origin;

export async function requestLLMMove(snapshot, options = {}) {
  const { timeoutMs = 12000, model = "deepseek-chat", candidatePool = [] } = options;

  if (!candidatePool || candidatePool.length === 0) {
    throw new Error("候选点池为空");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE_URL}/api/gomoku-move`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        board: snapshot.board,
        currentPlayer: snapshot.currentPlayer,
        candidatePool: candidatePool,
        history: snapshot.history || []
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "未知错误" }));
      throw new Error(`API 错误 (${response.status}): ${errorData.error || "请求失败"}`);
    }

    const data = await response.json();

    return {
      candidates: data.candidates || [],
      model: data.model || model,
      latencyMs: data.latencyMs || 0,
      tokenUsage: data.tokenUsage || { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      throw new Error("LLM 请求超时");
    }
    throw error;
  }
}

export async function checkLLMHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(3000)
    });
    return response.ok;
  } catch {
    return false;
  }
}