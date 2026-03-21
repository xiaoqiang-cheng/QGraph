# QGraph

**轻量级可视化 Pipeline 编排工具**

> 版本：v0.1.0 · 作者：晓强 · License: MIT

将散乱的脚本组织为可视化 DAG 工作流。通过 Web UI 拖拽编排，CLI 一键运行。`pip install` 即开箱即用。

```
[数据准备] → [模型训练] → [评估] → [导出 ONNX] → [完成]
                       → [量化] ↗
```

---

## 目录

- [安装](#安装)
- [快速开始](#快速开始)
- [Web UI 使用指南](#web-ui-使用指南)
  - [Dashboard](#dashboard)
  - [编辑器](#编辑器)
  - [节点类型](#节点类型)
  - [节点配置](#节点配置)
  - [运行 Pipeline](#运行-pipeline)
- [CLI 命令参考](#cli-命令参考)
- [示例：ML 训练流水线](#示例ml-训练流水线)
- [数据存储](#数据存储)
- [技术架构](#技术架构)
- [开发指南](#开发指南)

---

## 安装

**系统要求**：Python ≥ 3.10

```bash
pip install qgraph
```

验证安装：

```bash
qgraph --version
```

---

## 快速开始

### 方式一：Web UI（推荐）

```bash
# 启动服务
qgraph serve

# 浏览器访问 http://localhost:9800
```

在 Dashboard 中创建一个新 Pipeline，进入编辑器，拖拽节点到画布，连线，配置，点击 Run。

### 方式二：CLI

```bash
# 列出所有 Pipeline
qgraph list

# 创建一个新的 Pipeline
qgraph create my-pipeline

# 启动 Web UI 编辑它
qgraph serve
# 浏览器打开 http://localhost:9800/?graph=my-pipeline

# 编辑完成后，CLI 直接运行（不需要启动 Web 服务）
qgraph run my-pipeline
```

---

## Web UI 使用指南

### Dashboard

访问 `http://localhost:9800`，Dashboard 是主控面板：

- **Pipeline 列表**：查看所有已保存的 Pipeline，显示节点数量和更新时间
- **创建 Pipeline**：输入名称，点击 `+ Create` 或按 Enter
- **运行 Pipeline**：点击 `▶ Run` 按钮直接运行
- **删除 Pipeline**：点击 `Delete` 按钮（会弹出确认框）
- **实时运行状态**：正在运行的 Pipeline 会实时显示当前节点和进度
- **运行历史**：最近的运行记录及其状态（completed / error / stopped）
- **主题切换**：右上角 ☀️/🌙 按钮切换明暗主题

点击 Pipeline 名称或 `View` 按钮进入编辑器。

### 编辑器

编辑器由四个区域组成：

```
┌──────────┬──────────────────────────────┬──────────┐
│          │                              │          │
│  Sidebar │        画布 (Canvas)          │  Config  │
│  (节点)   │                              │  Panel   │
│          │   拖拽节点，连线编排           │  (配置)   │
│          │                              │          │
│          ├──────────────────────────────┤          │
│          │      Log Panel (日志)         │          │
└──────────┴──────────────────────────────┴──────────┘
```

**画布操作**：

| 操作 | 方式 |
|------|------|
| 添加节点 | 从左侧 Sidebar 拖拽节点到画布 |
| 移动节点 | 直接拖拽画布上的节点 |
| 连线 | 从节点底部的输出端口拖线到另一个节点顶部的输入端口 |
| 删除节点/连线 | 选中后按 `Delete` 或 `Backspace` |
| 缩放 | 鼠标滚轮 |
| 平移 | 按住鼠标右键拖动，或使用触控板 |

**工具栏按钮**：

| 按钮 | 功能 |
|------|------|
| ← Back | 返回 Dashboard |
| 💾 Save | 保存 Pipeline 到文件 |
| ▶ Run | 运行当前 Pipeline |
| ⏹ Stop | 停止正在运行的 Pipeline（运行中才显示） |

### 节点类型

QGraph 提供 5 种节点类型：

#### Shell Command（橙色 🟠）

执行任意 Shell 命令。

| 配置项 | 说明 | 示例 |
|--------|------|------|
| Command | Shell 命令 | `bash ./scripts/quantize.sh` |
| Working Dir | 工作目录（可选） | `./project` |
| Env Vars | 环境变量（可选） | `MODEL_PATH=./model.pt` |

#### Python Script（蓝色 🔵）

执行 Python 脚本文件。

| 配置项 | 说明 | 示例 |
|--------|------|------|
| Script Path | 脚本路径 | `./scripts/train.py` |
| Args | 命令行参数（可选） | `--epochs 10 --lr 0.001` |
| Python Path | Python 解释器（可选，默认 `python`） | `python3.12` |
| Working Dir | 工作目录（可选） | `./project` |
| Env Vars | 环境变量（可选） | `CUDA_VISIBLE_DEVICES=0` |

#### Python Function（紫色 🟣）

直接调用 Python 模块中的函数。

| 配置项 | 说明 | 示例 |
|--------|------|------|
| Module Path | Python 模块路径 | `my_package.utils` |
| Function Name | 函数名 | `process_data` |
| Kwargs | 关键字参数（可选） | JSON 格式 |

函数支持同步和异步（`async def`）。

#### Input（绿色 🟢）

Pipeline 的入口节点。定义初始参数，后续可注入到下游节点。

#### Output（红色 🔴）

Pipeline 的出口节点。标记 Pipeline 的结束点。

### 节点配置

点击画布上的节点，右侧会打开配置面板：

1. **名称**：修改节点显示名称
2. **类型相关配置**：根据节点类型显示不同的配置表单
3. **环境变量**：为节点执行设置环境变量键值对

编辑完配置后会自动保存到节点，但需要点击工具栏的 `Save` 按钮才会持久化到文件。

### 运行 Pipeline

**通过 Web UI 运行**：

1. 点击工具栏 `▶ Run` 按钮
2. 节点状态实时更新：
   - ⚪ 灰色：等待中（idle）
   - 🟡 黄色脉冲：排队中（queued）
   - 🟡 旋转图标：执行中（running）
   - 🟢 绿色：成功（success）
   - 🔴 红色：失败（failed）
3. 底部 Log Panel 实时显示每个节点的标准输出和错误输出
4. 如果需要停止，点击 `⏹ Stop` 按钮

**执行逻辑**：

- 使用 DAG 拓扑排序（Kahn 算法）确定执行顺序
- 没有依赖关系的节点自动并行执行
- 汇合节点会等待所有上游节点完成后才开始
- 如果任意节点失败，其下游节点仍会按正常流程调度（不会级联取消）

---

## CLI 命令参考

### 服务管理

```bash
qgraph serve                     # 启动 Web UI 服务（默认 http://localhost:9800）
qgraph serve --port 9801         # 指定端口
qgraph serve --host 0.0.0.0     # 允许外部访问
```

### Pipeline 管理

```bash
qgraph list                      # 列出所有 Pipeline
qgraph create <name>             # 创建新 Pipeline
qgraph edit <name>               # 打印编辑器 URL
qgraph delete <name>             # 删除 Pipeline
```

### 运行管理

```bash
qgraph run <name>                # 运行 Pipeline（前台，实时输出日志）
qgraph ps                        # 列出运行中的任务（需要服务器运行）
qgraph ps -a                     # 列出所有任务（含历史，支持离线查看）
qgraph logs <run_id>             # 查看某次运行的详细日志
qgraph stop <run_id>             # 停止运行中的任务
```

### 导入/导出

```bash
qgraph export <name>             # 导出为 JSON（默认 <name>.json）
qgraph export <name> -o out.json # 指定导出路径
qgraph import pipeline.json      # 从 JSON 导入 Pipeline
```

### 注意事项

- `qgraph run` 不需要启动 Web 服务，直接读取本地 JSON 文件执行
- `qgraph ps` 查看运行中任务需要 Web 服务运行；`qgraph ps -a` 可以离线查看历史
- `qgraph logs` 优先从服务器获取，服务器未运行时自动读取本地日志文件

---

## 示例：ML 训练流水线

QGraph 自带一个完整的 ML 训练流水线示例：`ml-training-pipeline`。

### 流水线结构

```
[Input] → [Prepare Data] → [Train Model] → [Evaluate]    → [Export ONNX] → [Output]
                                          → [Quantize]  ↗
```

- **Input**：定义初始参数（epochs、学习率、输出目录等）
- **Prepare Data**：生成训练数据（`demo/02_prepare_data.py`）
- **Train Model**：模拟模型训练（`demo/03_train.py`）
- **Evaluate** + **Quantize**：训练完成后并行执行评估和量化
- **Export ONNX**：等待评估和量化都完成后，导出模型
- **Output**：收集最终结果

### 运行示例

```bash
# CLI 运行
qgraph run ml-training-pipeline

# 查看运行日志
qgraph logs <run_id>
```

输出示例：

```
Running graph: ml-training-pipeline

  ✓ [node_input] → success
  ✓ [node_prepare] → success
    [stdout] === Step 2: Preparing Data ===
    [stdout] Generating 200 samples...
    [stdout] Done!
  ✓ [node_train] → success
    [stdout] === Step 3: Training Model ===
    [stdout]   Epoch 1/5 - loss: 0.5043 - acc: 0.5905
    [stdout]   Epoch 5/5 - loss: 0.1219 - acc: 0.9842
  ⟳ [node_evaluate] → running     # 并行执行
  ⟳ [node_quantize] → running     # 并行执行
  ✓ [node_evaluate] → success
  ✓ [node_quantize] → success
  ✓ [node_export] → success
  ✓ [node_output] → success

Pipeline completed successfully: 7 nodes
```

---

## 数据存储

QGraph 的数据存储在用户主目录下：

```
~/.qgraph/
├── graphs/                          # Pipeline 定义文件
│   ├── default.json
│   ├── ml-training-pipeline.json
│   └── ...
└── logs/                            # 运行日志
    ├── run_ml-training-pipeline_1_1774090129.json
    └── ...
```

- **graphs/**：每个 Pipeline 一个 JSON 文件，包含节点、连线、位置信息和配置
- **logs/**：每次运行一个 JSON 文件，包含运行 ID、状态、节点状态和完整日志

Pipeline JSON 文件可以直接用 `qgraph export` / `qgraph import` 进行备份和共享。

---

## 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                      pip install qgraph                      │
│                                                              │
│  ┌──────────────┐          ┌──────────────────────────┐      │
│  │   CLI (click) │          │   Web UI (React + Vite)  │      │
│  │              │          │                          │      │
│  │  serve       │          │  Dashboard               │      │
│  │  run         │          │  Editor (React Flow)     │      │
│  │  list/ps/... │          │  Config / Log Panel      │      │
│  └──────┬───────┘          └────────────┬─────────────┘      │
│         │                               │                    │
│         ▼                               ▼                    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │              FastAPI 服务层 (:9800)                    │    │
│  │  REST API (/api/graphs/*, /api/runs/*)               │    │
│  │  WebSocket (/ws/graph/*, /ws/dashboard)              │    │
│  └──────────────────────┬───────────────────────────────┘    │
│                         ▼                                    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │              调度引擎层                                │    │
│  │  RunManager (运行状态) → PipelineExecutor (DAG 调度)  │    │
│  │  Kahn 拓扑排序 → asyncio.gather 并行执行              │    │
│  └──────────────────────┬───────────────────────────────┘    │
│                         ▼                                    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │              执行层                                    │    │
│  │  Shell → subprocess  |  Script → subprocess           │    │
│  │  Function → importlib.import_module                   │    │
│  │  stdout/stderr 逐行实时读取 → on_log 回调             │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  存储：~/.qgraph/graphs/*.json + ~/.qgraph/logs/*.json       │
└─────────────────────────────────────────────────────────────┘
```

| 层 | 技术选型 |
|-----|----------|
| 前端 | React 18 + TypeScript + React Flow (@xyflow/react) + Vite 5 |
| 后端 | Python 3.10+ + FastAPI + asyncio + uvicorn |
| CLI | click + rich |
| 存储 | JSON 文件 |
| 打包 | pyproject.toml + hatchling |

---

## 开发指南

### 环境搭建

```bash
# 克隆仓库
git clone <repo-url>
cd QGraph

# 安装 Python 包（editable 模式）
pip install -e .

# 安装前端依赖
cd web && npm install && cd ..
```

### 开发模式

```bash
# 同时启动后端 + 前端 dev server
python dev.py

# 或分别启动：
qgraph serve                    # 后端（端口 9800）
cd web && npm run dev           # 前端（端口 5173，proxy 到 9800）
```

### 代码检查

```bash
# Python lint
ruff check src/

# TypeScript 类型检查
cd web && npx tsc --noEmit
```

### 前端构建

```bash
cd web && npm run build
# 输出到 src/qgraph/web/dist/，通过 qgraph serve 直接 serve
```

### 项目结构

```
QGraph/
├── src/qgraph/                 # Python 后端
│   ├── cli.py                  # CLI 入口（11 个命令）
│   ├── core/                   # 模型 + 存储
│   │   ├── models.py           # Pydantic 数据模型
│   │   └── storage.py          # JSON 文件读写
│   ├── engine/                 # 执行引擎
│   │   ├── executor.py         # DAG 拓扑排序 + 并行调度
│   │   └── run_manager.py      # 运行状态追踪 + 日志持久化
│   └── server/                 # Web 服务
│       ├── app.py              # FastAPI app 工厂
│       ├── api.py              # REST API 路由
│       └── ws.py               # WebSocket 管理
├── web/                        # React 前端
│   └── src/
│       ├── App.tsx             # 路由：Dashboard / EditorView
│       ├── api.ts              # 后端 API 封装
│       ├── types.ts            # TypeScript 类型
│       └── components/         # UI 组件
│           ├── Dashboard.tsx   # Pipeline 管理面板
│           ├── PipelineNode.tsx # 自定义画布节点
│           ├── Sidebar.tsx     # 左侧节点面板
│           ├── Toolbar.tsx     # 顶部工具栏
│           ├── ConfigPanel.tsx # 右侧配置面板
│           └── LogPanel.tsx    # 底部日志面板
├── demo/                       # 测试脚本（10 个）
├── pyproject.toml              # Python 包配置
└── dev.py                      # 开发启动脚本
```

---

## License

MIT
