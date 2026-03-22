# QGraph：用拖拽代替 Shell 脚本，轻量级可视化 Pipeline 工具

## 背景

做 ML/数据处理的时候，经常有一堆脚本要按顺序跑：数据预处理 → 训练 → 评估 → 导出 → 部署。

之前的做法要么是写一个巨长的 run.sh，要么用 Makefile，要么上 Airflow。但 Airflow 太重了（要数据库、调度器、Web 服务器），Makefile 又没有可视化。

所以做了 QGraph：一个轻量的可视化 Pipeline 编排工具。`pip install` 即用，不需要任何基础设施。

## 安装

```bash
pip install qgraph
qgraph serve
# 浏览器打开 http://localhost:9800
```

## 主要特性

- **拖拽编排** — 从左侧拖节点到画布，连线构建 DAG
- **Quick Add** — 双击画布粘贴命令，自动创建节点。粘贴多行脚本自动生成串行连线
- **并行执行** — 没有依赖的节点自动并行跑
- **断点续传** — Pipeline 跑挂了？修完节点点 Resume，跳过已成功的
- **CLI 独立可用** — `qgraph run my-pipeline` 不需要启动 Web 服务
- **零侵入** — 不需要改你的脚本，不需要加装饰器，直接拖进去就能用

## 和 Airflow 的区别

QGraph 不是 Airflow 的替代品。Airflow 适合企业级数据调度，QGraph 适合**个人开发者把几个脚本串起来跑**。

| | QGraph | Airflow |
|---|---|---|
| 安装 | `pip install` | PostgreSQL + Redis + 调度器 |
| 可视化编辑 | 拖拽画布 | 只能看，不能编辑 |
| 代码侵入 | 零 | 需要学 DAG DSL |
| 定位 | 个人脚本编排 | 企业数据管道 |

## AI 原生支持

`qgraph init` 会在项目根目录自动生成 `QGRAPH.md`。任何 AI 编码工具（Cursor、Trae、Copilot、Claude 等）打开项目时都会读取它，可以直接帮你创建和运行 Pipeline。

## 技术栈

- 后端：Python + FastAPI + asyncio（异步并行调度）
- 前端：React + React Flow（打包在 pip 包里，不需要 Node.js）
- 存储：JSON 文件，可以 git 管理

GitHub: https://github.com/xiaoqiang-cheng/QGraph
PyPI: https://pypi.org/project/qgraph/

欢迎试用和反馈！
