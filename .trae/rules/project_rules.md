# QGraph 项目规则

## 项目简介
QGraph 是一个轻量级可视化 Pipeline 编排工具，以 Python 包分发（pip install qgraph），提供 Web UI + CLI 双模式。作者：晓强。

## 关键文件
- `README.md` — 完整产品说明书
- `TODO.md` — Bug 追踪 + 待办事项 + 迭代计划
- `ARCHITECTURE.md` — 代码架构和设计决策

## 技术栈
- 后端：Python 3.12 + FastAPI + asyncio + click + pydantic + rich
- 前端：React 18 + TypeScript + React Flow (@xyflow/react) + Vite 5
- 存储：JSON 文件（~/.qgraph/graphs/）
- 打包：hatchling (pyproject.toml)

## 开发命令
- 安装：`pip install -e .`
- 启动后端：`qgraph serve`（端口 9800）
- 启动前端 dev：`cd web && npm run dev`（端口 5173，proxy 到 9800）
- 同时启动两者：`python dev.py`
- 前端构建：`cd web && npm run build`（输出到 src/qgraph/web/dist/）
- TypeScript 检查：`cd web && npx tsc --noEmit`
- Python lint：`ruff check src/`

## 代码规范
- Python：不加注释，除非用户要求。使用 ruff，line-length=100。
- TypeScript：不加注释。inline style（不用 CSS modules）。
- 前端依赖极简：运行时只有 react, react-dom, @xyflow/react。

## 重要设计决策
- 前端打包为静态资源嵌入 Python 包，用户 `pip install qgraph` 后无需 Node.js
- 节点间连线当前只表示执行依赖，不传递数据（后续迭代）
- 汇合节点会等待所有上游完成（拓扑排序保证）
- CLI `qgraph run` 不需要启动 Web 服务，直接加载 JSON 执行
- Graph 删除 API 用 POST `/api/graphs/{name}/delete` 而非 DELETE 方法（因为某些环境下 DELETE 被拦截）
