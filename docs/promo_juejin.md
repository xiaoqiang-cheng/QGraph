# 告别 run.sh：我做了一个可视化 Pipeline 编排工具 QGraph

## 痛点

如果你是做 ML 训练、数据处理、或者任何需要"按顺序跑一堆脚本"的工作，你一定写过这样的代码：

```bash
#!/bin/bash
echo "Step 1: Prepare data"
python prepare_data.py --input raw/ --output processed/

echo "Step 2: Train model"  
CUDA_VISIBLE_DEVICES=0 python train.py --epochs 50 --lr 0.001

echo "Step 3: Evaluate"
python evaluate.py --model output/model.pt

echo "Step 4: Export"
python export_onnx.py --model output/model.pt --output output/model.onnx

echo "Done!"
```

这个 `run.sh` 有几个问题：

1. **不可视** — 看不出哪些步骤可以并行
2. **不能断点续传** — 第 3 步挂了，得从头跑
3. **不好维护** — 步骤多了以后，依赖关系全靠注释
4. **参数散落各处** — 改个学习率要翻遍整个脚本

上 Airflow？算了吧，我只是想跑几个脚本，不想装 PostgreSQL + Redis + 调度器。

## QGraph 的解决方案

```bash
pip install qgraph
qgraph serve
```

打开浏览器，你会看到一个可视化编辑器。把上面那个 `run.sh` 变成这样：

```
[数据准备] → [模型训练] → [评估]    → [导出 ONNX]
                        → [量化]  ↗
```

评估和量化**自动并行**，导出等它们**都完成**后才开始。

## 核心功能

### 1. 拖拽编排

从左侧面板拖节点到画布，连线构建 DAG。支持 5 种节点：Shell 命令、Python 脚本、Python 函数、Input（全局参数）、Output。

### 2. Quick Add：粘贴命令创建节点

双击画布空白区域，弹出输入框。直接粘贴你的 `run.sh` 内容：

```
cd /data/project
python prepare.py --input raw/
python train.py --epochs 50
python evaluate.py
bash deploy.sh
```

QGraph 自动识别每行命令，创建 4 个节点并串行连线。`cd` 命令被提取为 working_dir，`python` 命令自动识别为 Python Script 节点。

### 3. Input 参数传递

在 Input 节点配置全局参数（比如 `EPOCHS=50`、`LR=0.001`），这些参数会**自动注入为所有下游节点的环境变量**。

Python 脚本里用 `os.getenv("EPOCHS")` 就能拿到。改参数只需要改 Input 节点，不用改脚本。

### 4. 断点续传

Pipeline 跑到第 3 步挂了？不用从头来。修复问题后，点击 **Resume** 按钮，QGraph 会跳过已成功的节点，只重新执行失败和被跳过的部分。

### 5. CLI + Web UI 完全一致

```bash
# Web UI
qgraph serve

# CLI（不需要启动 Web 服务）
qgraph run my-pipeline
qgraph ps           # 查看运行中的任务
qgraph ps -a        # 查看所有历史
qgraph logs <id>    # 查看日志
```

CLI 和 Web UI 共享同一套运行状态和日志系统。用 CLI 跑的任务，Web UI 能看到；反过来也一样。

### 6. 项目级存储

```bash
cd /my/project
qgraph init          # 初始化
qgraph create train  # 创建 Pipeline
```

Pipeline 定义存在 `.qgraph/graphs/` 下，可以随项目 git 管理。日志也在 `.qgraph/logs/` 下。

## 和现有工具对比

| | QGraph | Airflow | Prefect | Makefile |
|---|---|---|---|---|
| 安装 | `pip install` | DB + 调度器 + Web | pip + Cloud | 自带 |
| 可视化编辑 | 拖拽画布 | 只能查看 | 只能查看 | 无 |
| 代码侵入 | 零 | DAG DSL | 装饰器 | Makefile 语法 |
| 并行执行 | 自动 | 自动 | 自动 | 手动 |
| 断点续传 | 支持 | 支持 | 支持 | 不支持 |
| 适合场景 | 个人脚本编排 | 企业数据调度 | 团队编排 | 构建任务 |

**定位**：QGraph 不是要取代 Airflow，而是填补 Makefile（太简陋）和 Airflow（太重）之间的空白。

## 技术实现

- **后端**：Python + FastAPI + asyncio。DAG 调度用 Kahn 算法，并行执行用 `asyncio.gather`
- **前端**：React + TypeScript + React Flow。前端打包在 pip 包里，`qgraph serve` 直接 serve 静态文件
- **存储**：纯 JSON 文件，无数据库依赖
- **代码量**：后端 ~1200 行，前端 ~2500 行，143 KB wheel

## 安装使用

```bash
# 安装
pip install qgraph

# 方式一：Web UI
qgraph serve
# 浏览器打开 http://localhost:9800

# 方式二：CLI
qgraph create my-pipeline
qgraph serve  # 编辑
qgraph run my-pipeline  # 运行
```

**GitHub**: https://github.com/xiaoqiang-cheng/QGraph  
**PyPI**: https://pypi.org/project/qgraph/

---

项目还在早期，欢迎试用和提 Issue。如果觉得有用，给个 Star 支持一下！
