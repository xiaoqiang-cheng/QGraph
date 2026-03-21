# QGraph 架构文档

## 目录结构

```
QGraph/
├── pyproject.toml                  # Python 包配置，入口 qgraph=qgraph.cli:main
├── dev.py                          # 开发用：同时启动后端+前端
├── README.md                       # 产品说明书
├── TODO.md                         # Bug + 待办 + 计划
├── ARCHITECTURE.md                 # 本文件
│
├── src/qgraph/                     # Python 后端（pip 包的主体）
│   ├── __init__.py                 # __version__ = "0.1.0"
│   ├── cli.py                      # CLI 入口（click），所有命令定义
│   │
│   ├── core/                       # 核心模型和存储
│   │   ├── models.py               # Pydantic 数据模型（Node, Edge, Graph, NodeType, NodeStatus...）
│   │   └── storage.py              # GraphStorage：JSON 文件读写，路径 ~/.qgraph/graphs/
│   │
│   ├── engine/                     # 执行引擎
│   │   ├── executor.py             # PipelineExecutor：DAG 拓扑排序 + 并行调度 + 子进程管理
│   │   └── run_manager.py          # RunManager：运行状态追踪（内存）+ 日志持久化（待修复）
│   │
│   ├── server/                     # Web 服务
│   │   ├── app.py                  # FastAPI app 工厂，mount api + ws + static
│   │   ├── api.py                  # REST API 路由（Graph CRUD + Run 管理）
│   │   └── ws.py                   # WebSocket 管理（日志推送 + 状态推送 + Dashboard 通知）
│   │
│   └── web/                        # 前端构建产物目标目录
│       └── dist/                   # npm run build 的输出位置（会被 StaticFiles serve）
│
├── web/                            # 前端源码（开发时独立运行）
│   ├── package.json                # 依赖：react, react-dom, @xyflow/react（仅 3 个运行时依赖）
│   ├── vite.config.ts              # dev server 端口 5173，proxy /api→9800，build→../src/qgraph/web/dist
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx                # React 入口
│       ├── App.tsx                 # 路由：Dashboard（无 ?graph）/ EditorView（有 ?graph=name）
│       ├── api.ts                  # 后端 API 封装（fetch + error handling）
│       ├── types.ts                # TypeScript 类型定义
│       ├── index.css               # CSS 变量：明暗双主题
│       ├── hooks/
│       │   └── useTheme.ts         # 主题切换 hook（localStorage 持久化，默认 light）
│       └── components/
│           ├── Dashboard.tsx        # 图管理面板：列表、创建、运行、删除、实时状态
│           ├── PipelineNode.tsx     # 自定义 React Flow 节点：带状态指示、类型颜色
│           ├── Sidebar.tsx          # 左侧面板：节点类型列表（拖拽添加）
│           ├── Toolbar.tsx          # 顶部工具栏：Save、Run/Stop、Back
│           ├── ConfigPanel.tsx      # 右侧配置面板：按节点类型渲染不同表单
│           └── LogPanel.tsx         # 底部日志面板：实时显示 WebSocket 推送的日志
│
└── demo/                           # 测试用脚本
    ├── 01_hello.sh                 # Shell 基础测试
    ├── 02_prepare_data.py          # 数据准备（有进度输出）
    ├── 03_train.py                 # 模拟训练（逐 epoch 输出）
    ├── 04_evaluate.py              # 模拟评估
    ├── 05_quantize.sh              # Shell 量化
    ├── 06_export.py                # 模型导出
    ├── 07_functions.py             # Python Function 节点可调用的函数集
    ├── 08_fail_test.py             # 故意失败（测试错误处理）
    ├── 09_long_running.py          # 长任务（测试停止功能）
    └── 10_env_test.py              # 打印环境变量（测试数据传递）
```

## 后端架构

### 数据流

```
CLI (qgraph run)  →  PipelineExecutor  →  asyncio.subprocess
                          ↑                      ↓
Web UI (Run 按钮)  →  API /run  →  RunManager  →  on_log/on_status 回调
                                                      ↓
                                                WebSocket 推送
                                                      ↓
                                                浏览器 / Dashboard
```

### PipelineExecutor (executor.py)

核心执行引擎，使用 Kahn 算法做拓扑排序：

1. 计算所有节点的入度
2. 将入度为 0 的节点放入队列
3. 并行执行队列中所有节点（asyncio.gather）
4. 节点完成后，将其下游节点的入度减 1
5. 入度变为 0 的下游节点进入下一批队列
6. 重复直到所有节点完成

关键特性：
- `on_log` 回调：每行 stdout/stderr 实时回调
- `on_status` 回调：节点状态变更通知（idle→queued→running→success/failed）
- 支持 cancel()

### RunManager (run_manager.py)

全局单例 `run_manager`，管理运行状态：
- `start_run()` → 创建 asyncio.Task 执行 pipeline
- `stop_run()` → cancel executor + task
- `list_runs()` → 返回所有/运行中的 run
- `_save_log()` → 运行结束后持久化日志到 ~/.qgraph/logs/（待修复）
- 回调注入：在 api.py 中通过 `set_callbacks(on_log=emit_log, on_status=emit_status)` 连接到 WebSocket

### WebSocket (ws.py)

ConnectionManager 管理所有 WebSocket 连接：
- `ws://host/ws/graph/{name}` — 编辑器连接，接收特定图的日志和状态
- `ws://host/ws/dashboard` — Dashboard 连接，接收所有图的运行更新
- `emit_log()` 和 `emit_status()` 是全局函数，被 RunManager 调用

### REST API (api.py)

```
GET    /api/graphs                     → 列出所有图
POST   /api/graphs/{name}              → 创建新图
GET    /api/graphs/{name}              → 获取图数据
PUT    /api/graphs/{name}              → 保存图数据
DELETE /api/graphs/{name}              → 删除图（CLI 用）
POST   /api/graphs/{name}/delete       → 删除图（前端用，避免 DELETE 方法被拦截）
POST   /api/graphs/{name}/run          → 运行图（返回 run_id）
GET    /api/runs?all=true              → 列出运行（默认只返回 running，all=true 返回全部）
GET    /api/runs/history               → 列出已保存的运行历史
GET    /api/runs/{run_id}/logs         → 获取运行日志
POST   /api/runs/{run_id}/stop         → 停止运行
```

## 前端架构

### 路由（App.tsx 中用 URL 参数实现）

- `http://localhost:5173/` → Dashboard（图管理面板）
- `http://localhost:5173/?graph=name` → EditorView（画布编辑器）
- 通过 `window.history.pushState` + `popstate` 事件实现

### 组件关系

```
App
├── Dashboard                    # 无 ?graph 参数时显示
│   ├── 运行中任务列表（WebSocket 实时更新）
│   ├── 图列表（创建/运行/删除）
│   └── 最近运行历史
│
└── EditorView                   # 有 ?graph=name 时显示
    ├── Sidebar                  # 左侧：节点类型列表，logo 可点击返回
    ├── Toolbar                  # 顶部：Back/Save/Run|Stop
    ├── ReactFlow 画布           # 中央：节点拖拽、连线
    │   ├── PipelineNode         # 自定义节点组件
    │   ├── Background
    │   ├── Controls
    │   └── MiniMap
    ├── ConfigPanel              # 右侧：选中节点时显示配置
    └── LogPanel                 # 底部：运行时显示日志流
```

### 状态管理

- 使用 React Flow 的 `useNodesState` 和 `useEdgesState` 管理画布状态
- `nodeDataMap` (useRef<Map>) 存储每个节点的完整 NodeData（包括 config）
- WebSocket 接收 `node_status` 消息时直接更新对应节点的 data.status
- LogPanel 的日志通过 state 数组累积，WebSocket `log` 消息追加

### 主题系统

- CSS 变量定义在 `index.css`（`:root` 暗色 / `[data-theme="light"]` 亮色）
- `useTheme` hook 管理切换，存储在 localStorage
- React Flow 的 `colorMode` 属性跟随主题

## 存储设计

### 当前实现
```
~/.qgraph/
├── graphs/                      # JSON 文件，每个图一个文件
│   ├── default.json
│   └── ml-training-pipeline.json
└── logs/                        # 运行日志（待修复）
    └── run_xxx.json
```

### 计划调整
- graphs/ → 项目目录 `.qgraph/graphs/` 优先，~/.qgraph/graphs/ 兜底
- logs/ → 保持在 ~/.qgraph/logs/

## CLI 命令清单

| 命令 | 说明 | 实现状态 |
|------|------|---------|
| `qgraph serve [--port] [--host]` | 启动 Web UI | ✅ |
| `qgraph list` | 列出所有图 | ✅ |
| `qgraph create <name>` | 创建新图 | ✅ |
| `qgraph edit <name>` | 打开编辑器 | ✅ (仅打印 URL) |
| `qgraph run <name> [-d]` | 运行图 | ✅ (前台模式) |
| `qgraph ps [-a]` | 列出运行中/所有执行 | ✅ |
| `qgraph logs <run_id>` | 查看运行日志 | ✅ (依赖日志持久化) |
| `qgraph stop <run_id>` | 停止运行 | ✅ |
| `qgraph delete <name>` | 删除图 | ✅ |
| `qgraph export <name> [-o]` | 导出 JSON | ✅ |
| `qgraph import <file>` | 导入 JSON | ✅ |

## Demo 流水线

`ml-training-pipeline` — 7 个节点的 ML 流水线：

```
[Input] → [Prepare Data] → [Train Model] → [Evaluate]    → [Export ONNX] → [Output]
                                          → [Quantize]  ↗
```

- Train 完成后，Evaluate 和 Quantize 并行执行
- 两者都完成后 Export 才开始
- 所有 Python 脚本通过环境变量接收配置（OUTPUT_DIR, EPOCHS 等）
