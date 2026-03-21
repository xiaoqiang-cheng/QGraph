# QGraph TODO

> 跟踪所有已知问题、待完善功能和后续迭代计划

---

## 🔴 已知 Bug（优先修复）

- [x] ~~**Dashboard 删除图功能不生效**~~ ✅ 已修复
  - 根因：`path.unlink()` 在某些环境下静默失败（文件未真正删除但不抛异常）
  - 修复：`storage.delete_graph()` 增加删除后验证 + `os.remove()` 备选 + 明确错误抛出
  - API 层增加 `OSError` 捕获，返回 500 错误信息
  - 前端使用 POST `/graphs/{name}/delete` 路由（避免 DELETE 方法被拦截）

- [ ] **运行日志未持久化**
  - 症状：`run_manager._save_log()` 写入 `~/.qgraph/logs/` 时报 PermissionError
  - 代码已实现（run_manager.py），但 Windows 下写入失败
  - `_save_log` 中有 try/except + print flush 日志，但之前终端编码问题导致无法看到输出
  - 建议：迁移后重新测试，可能是中文路径环境下的权限问题

---

## 🟡 待完善功能（MVP 范围内）

- [ ] **`qgraph logs <run_id>` 命令**：CLI 代码已实现，依赖日志持久化修复
- [ ] **Web UI 实时日志面板**：WebSocket 推送已实现，编辑器中 LogPanel 组件已存在
- [ ] **连线数据传递**：当前连线只表示执行依赖，不传递实际数据。需实现：
  - 上游节点 env_vars / stdout 输出 → 自动注入为下游节点的环境变量
  - 模板替换语法 `{{node_name.output.key}}`
- [ ] **Input 节点参数传递**：Input 节点定义的参数应自动注入到所有下游节点的 env_vars
- [ ] **Graph 存储位置调整**（已讨论确认的设计）：
  - 默认保存到项目目录 `.qgraph/graphs/`（类似 `.git/`），方便 git 管理
  - 如果当前目录没有 `.qgraph/`，使用 `~/.qgraph/graphs/` 全局存储
  - 新增 `qgraph init` 命令在当前目录初始化 `.qgraph/`
  - 日志/运行历史保持在 `~/.qgraph/logs/`
- [ ] **前端 Build → pip 打包**：`npm run build` 输出到 `src/qgraph/web/dist/`，通过 `qgraph serve` 直接 serve 静态文件

---

## 🟢 后续迭代

### Phase 2+: 流程控制
- [ ] 条件分支节点（if/else）
- [ ] 循环节点（for/while）
- [ ] 单步调试：逐节点执行，观察每步输出

### Phase 2+: 增强功能
- [ ] 详细进度监控（进度条、耗时统计）
- [ ] 结构化 JSON 数据流（节点间传递 JSON 对象）
- [ ] 节点复制 / 粘贴
- [ ] 撤销 / 重做（Ctrl+Z / Ctrl+Shift+Z）
- [ ] 节点分组 / 子图
- [ ] 断点调试：在某个节点暂停执行
- [ ] 运行历史对比：对比两次运行的参数和结果

### Phase 3+: 生态
- [ ] 自定义节点注册（插件机制）
- [ ] 多用户 / 团队协作（用户管理、权限控制）
- [ ] 远程执行（SSH 到远程机器执行节点）
- [ ] GPU 资源管理和调度
- [ ] 与 MLflow / Weights & Biases 集成

---

## ✅ 已完成

- [x] Python 项目结构 + pyproject.toml + pip install -e .
- [x] CLI 框架（click）：serve, list, create, edit, run, ps, delete, export, import, stop, logs
- [x] FastAPI 后端 + REST API（Graph CRUD + Run 管理）
- [x] React + React Flow + Vite 前端画布
- [x] 自定义节点渲染（Shell/Python Script/Python Function/Input/Output）
- [x] 节点配置面板（右侧 ConfigPanel）
- [x] 节点拖拽添加 + 连线（Handle id 已修复为 in_0/out_0）
- [x] Graph 保存/加载（JSON in ~/.qgraph/graphs/）
- [x] DAG 拓扑排序 + 串行/并行执行引擎
- [x] asyncio.subprocess 子进程管理（流式逐行读取 stdout/stderr）
- [x] WebSocket 日志实时推送 + 节点状态推送
- [x] 运行时节点高亮（脉冲动画 + 旋转状态图标）
- [x] CLI 实时日志输出（Rich 彩色）
- [x] Dashboard 图管理面板（列表、创建、运行、删除、实时状态）
- [x] 明暗双主题（默认 light，CSS 变量切换）
- [x] qgraph ps / ps -a（默认只显示运行中，-a 显示所有）
- [x] RunManager 运行状态追踪（内存中）
- [x] 编辑器 Sidebar logo 可点击返回 Dashboard
- [x] Demo 脚本集合（10 个测试脚本）
- [x] Demo 流水线图（ml-training-pipeline，7 个节点，串行+并行）
