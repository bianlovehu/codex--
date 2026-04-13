# 五子棋·弈境 - DeepSeek AI 增强版

一个集成了 DeepSeek 大语言模型的五子棋游戏，提供增强的困难模式 AI 对战体验。

## 功能特性

- 🎮 **多种游戏模式**：本地双人、人机对战
- 🎯 **三种 AI 难度**：简单、普通、困难（DeepSeek 增强版）
- 🤖 **智能 AI**：
  - 简单模式：基于启发式评估
  - 普通模式：局部搜索策略
  - 困难模式：DeepSeek LLM + Alpha-Beta 搜索混合策略
- 🔄 **自动回退**：API 失败时自动切换到本地困难 AI
- 📊 **实时反馈**：显示 AI 思考状态、搜索深度、节点数、延迟等
- 🔊 **音效系统**：落子、胜利、失败等音效
- 🎨 **精美界面**：响应式设计，支持移动端

## 困难模式架构

困难模式采用混合策略，结合大语言模型的战略理解和传统搜索算法的战术精确性：

```
┌─────────────────────────────────────────────────────────┐
│                    困难模式 AI 流程                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  1. 候选点生成                                           │
│     └─ 本地生成 12-20 个候选点池                         │
│                                                         │
│  2. LLM 战略分析 (DeepSeek)                             │
│     └─ 对候选点进行排序，返回 Top-3                     │
│                                                         │
│  3. 战术校验 (Alpha-Beta 搜索)                          │
│     └─ 在 Top-3 中进行深度搜索，选择最优落子            │
│                                                         │
│  4. 失败回退                                             │
│     └─ API 失败时使用本地困难搜索                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## 快速开始

### 前置要求

- Python 3.8+
- 现代浏览器（支持 ES6+）
- DeepSeek API Key

### 安装步骤

#### 1. 克隆项目

```bash
git clone <repository-url>
cd "New project 2"
```

#### 2. 设置后端服务

```bash
cd server

# 安装依赖
pip install -r requirements.txt

# 配置环境变量
copy .env.example .env

# 编辑 .env 文件，填入你的 DeepSeek API Key
# DEEPSEEK_API_KEY=your_actual_api_key_here

# 启动服务器
python app.py
```

后端服务将在 `http://localhost:5000` 启动。

#### 3. 启动前端

使用任意静态文件服务器：

```bash
# 返回项目根目录
cd ..

# 使用 Python
python -m http.server 8000

# 或使用 Node.js
npx serve

# 或使用 VS Code Live Server 扩展
```

在浏览器中打开 `http://localhost:8000`（或你使用的其他端口）。

#### 4. 开始游戏

1. 选择"人机对战"模式
2. 选择"困难"难度
3. 点击棋盘开始游戏

## 使用说明

### 游戏控制

- **对战模式**：选择本地双人或人机对战
- **AI 难度**：选择简单、普通或困难
- **悔棋**：撤销上一步（人机模式下撤销两步）
- **重新开始**：重置棋盘开始新游戏

### 音频控制

- **静音开关**：开启/关闭所有音效
- **音效音量**：调整落子、胜利等音效音量
- **背景乐音量**：调整背景音乐音量

### AI 信息显示

在困难模式下，AI 信息栏会显示：

- **来源**：llm+search（混合模式）/ llm（仅 LLM）/ local（本地）
- **模型**：deepseek-chat
- **LLM 延迟**：API 响应时间（毫秒）
- **搜索深度**：Alpha-Beta 搜索深度
- **节点数**：搜索的节点数量
- **用时**：总思考时间（毫秒）

## API 文档

### POST /api/gomoku-move

请求 DeepSeek API 获取候选落子建议。

**请求头：**
```
Content-Type: application/json
```

**请求体：**
```json
{
  "board": [[0, 0, 1, ...], ...],
  "currentPlayer": 2,
  "candidatePool": [[7, 7], [8, 8], ...],
  "history": [
    {"x": 7, "y": 7, "player": 1, "serial": 1},
    {"x": 7, "y": 8, "player": 2, "serial": 2}
  ]
}
```

**响应：**
```json
{
  "candidates": [
    {"x": 8, "y": 8, "reason": "进攻"},
    {"x": 7, "y": 8, "reason": "防守"},
    {"x": 9, "y": 7, "reason": "布局"}
  ],
  "model": "deepseek-chat",
  "latencyMs": 1234,
  "tokenUsage": {
    "promptTokens": 150,
    "completionTokens": 80,
    "totalTokens": 230
  }
}
```

### GET /health

健康检查接口。

**响应：**
```json
{
  "status": "ok",
  "service": "gomoku-llm-proxy"
}
```

## 测试

运行后端测试套件：

```bash
cd server
python test_api.py
```

测试包括：
- 健康检查
- 正常落子请求
- 空棋盘测试
- 错误处理

## 故障排查

### LLM 请求失败

**症状**：显示"已回退本地策略"

**可能原因**：
1. API Key 未设置或无效
2. 网络连接问题
3. Flask 服务器未启动
4. DeepSeek API 服务异常

**解决方案**：
1. 检查 `server/.env` 文件中的 `DEEPSEEK_API_KEY`
2. 确认 Flask 服务器正在运行
3. 检查网络连接和代理设置
4. 查看 Flask 服务器日志

### 超时问题

**症状**：LLM 请求经常超时

**解决方案**：
在 `src/main.js` 中调整超时时间：

```javascript
const llmResult = await requestLLMMove(snapshot, {
  timeoutMs: 15000,  // 增加到 15 秒
  model: "deepseek-chat",
  candidatePool: candidatePool.map(c => [c.x, c.y])
});
```

### 性能优化

如果觉得响应太慢，可以调整以下参数：

1. **减少候选点数量**（`src/main.js`）：
   ```javascript
   const candidatePool = getCandidates(snapshot.board, 12, 2);  // 从 18 减少到 12
   ```

2. **减少 LLM 返回的候选点**（`src/main.js`）：
   ```javascript
   const topCandidates = llmResult.candidates.slice(0, 2);  // 从 3 减少到 2
   ```

3. **调整搜索深度**（`src/main.js`）：
   ```javascript
   maxDepth: 5,  // 从 6 减少到 5
   ```

## 成本估算

DeepSeek API 按使用量计费。估算：

- **每步调用**：~200-400 Token
- **每局游戏**（50 步）：~10,000-20,000 Token
- **费用**：根据 DeepSeek 定价计算

建议：
- 监控 API 使用量
- 设置预算警告
- 考虑使用缓存减少重复调用

## 安全说明

- ✅ `DEEPSEEK_API_KEY` 仅存储在服务器端环境变量
- ✅ 前端代码不包含任何敏感信息
- ✅ 使用 Flask CORS 进行跨域控制
- ⚠️ 生产环境建议使用 HTTPS
- ⚠️ 考虑添加 API 速率限制

## 项目结构

```
New project 2/
├── server/                 # Flask 后端服务
│   ├── app.py             # 主应用
│   ├── requirements.txt   # Python 依赖
│   ├── .env.example       # 环境变量示例
│   ├── test_api.py        # API 测试
│   └── README.md          # 后端文档
├── src/                   # 前端源码
│   ├── ai/               # AI 模块
│   │   ├── llm-client.js # LLM 客户端
│   │   ├── worker.js     # Web Worker
│   │   ├── worker-client.js
│   │   ├── candidates.js
│   │   ├── heuristic.js
│   │   └── strategies.js
│   ├── core/             # 游戏核心
│   │   ├── game-state.js
│   │   └── rules.js
│   ├── render/           # 渲染模块
│   │   └── canvas-renderer.js
│   ├── audio/            # 音频模块
│   │   └── audio-manager.js
│   ├── constants.js      # 常量定义
│   └── main.js           # 主入口
├── assets/               # 资源文件
│   └── audio/           # 音频文件
├── index.html           # HTML 入口
├── style.css            # 样式文件
├── start.bat            # Windows 启动脚本
├── start.sh             # Linux/Mac 启动脚本
└── DEEPSEEK_INTEGRATION.md  # 集成文档
```

## 技术栈

### 前端
- 原生 JavaScript (ES6+)
- Web Workers（后台计算）
- Canvas API（棋盘渲染）
- Fetch API（网络请求）

### 后端
- Python 3.8+
- Flask（Web 框架）
- Flask-CORS（跨域支持）
- Requests（HTTP 客户端）
- python-dotenv（环境变量管理）

### AI
- DeepSeek API（大语言模型）
- Alpha-Beta 搜索（传统算法）
- 启发式评估（棋局分析）

## 开发

### 添加新功能

1. 修改 `src/` 中的相应模块
2. 更新 `server/` 中的 API（如需要）
3. 运行测试确保功能正常

### 调试

- **前端调试**：使用浏览器开发者工具
- **后端调试**：查看 Flask 控制台输出
- **AI 调试**：查看 AI 信息栏和控制台日志

## 许可证

本项目遵循原五子棋项目的许可证。

## 贡献

欢迎提交 Issue 和 Pull Request！

## 联系方式

如有问题或建议，请通过 Issue 联系。

---

**享受与 DeepSeek AI 的五子棋对弈！** 🎮♟️