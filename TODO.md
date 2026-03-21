# QGraph TODO

> 跟踪所有已知问题、待完善功能和后续迭代计划

---

## 🔴 已知 Bug（优先修复）

- [x] ~~**Dashboard 删除图功能不生效**~~ ✅ 已修复
  - 根因：`path.unlink()` 在某些环境下静默失败（文件未真正删除但不抛异常）
  - 修复：`storage.delete_graph()` 增加删除后验证 + `os.remove()` 备选 + 明确错误抛出
  - API 层增加 `OSError` 捕获，返回 500 错误信息
  - 前端使用 POST `/graphs/{name}/delete` 路由（避免 DELETE 方法被拦截）

- [x] ~~**运行日志未持久化**~~ ✅ 已修复
  - 根因：中文路径环境导致 PermissionError，迁移到英文路径后正常
  - 验证：`_save_log()` 正常写入 `~/.qgraph/logs/`，API `/api/runs/history` 正常返回

- [x] ~~**Run status 判断不准确**~~ ✅ 已修复
  - 根因：`executor.execute()` 节点失败时不抛异常，`_run()` 总是设为 `"completed"`
  - 修复：检查 executor 返回的 results，有任何节点 FAILED 则 status 设为 `"failed"`

---

## 🟡 待完善功能（MVP 范围内）

- [x] ~~**`qgraph logs <run_id>` 命令**~~ ✅ 已验证可用（依赖日志持久化，已修复）
- [x] ~~**Web UI 实时日志面板**~~ ✅ 已完成
  - 可拖拽调整高度（120px ~ 600px）
  - 自动滚动跟随 + 手动滚动暂停 + "↓ Follow" 按钮恢复
  - RUNNING 状态标签 + 日志行数统计
  - Clear 清空按钮
  - 长文本自动换行（`pre-wrap` + `break-all`）
- [ ] **连线数据传递**：当前连线只表示执行依赖，不传递实际数据。需实现：
  - 上游节点 env_vars / stdout 输出 → 自动注入为下游节点的环境变量
  - 模板替换语法 `{{node_name.output.key}}`
- [ ] **Input 节点参数传递**：Input 节点定义的参数应自动注入到所有下游节点的 env_vars
- [ ] **Graph 存储位置调整**（已讨论确认的设计）：
  - 默认保存到项目目录 `.qgraph/graphs/`（类似 `.git/`），方便 git 管理
  - 如果当前目录没有 `.qgraph/`，使用 `~/.qgraph/graphs/` 全局存储
  - 新增 `qgraph init` 命令在当前目录初始化 `.qgraph/`
  - 日志/运行历史保持在 `~/.qgraph/logs/`
- [x] ~~**前端 Build → pip 打包**~~ ✅ 已完成
  - `npm run build` 输出到 `src/qgraph/web/dist/`
  - `pyproject.toml` 添加 `force-include` 将 dist/ 打入 wheel
  - `qgraph serve` 单端口同时 serve API + 静态文件
  - WebSocket URL 改为 `window.location.host` 动态适配端口

---

## 🟢 后续迭代

### Phase 2+: 流程控制
- [ ] 条件分支节点（if/else）
- [ ] 循环节点（for/while）
- [ ] 单步调试：逐节点执行，观察每步输出

### Phase 2+: 增强功能
- [ ] 日志预览增强：全屏模式、关键字搜索、按节点过滤日志
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
- [x] 日志格式精简：`logs` 数组从 `[{node_id, message, time}]` 改为 `["[node_id] message"]`，体积 -59%，向下兼容旧格式
- [x] `qgraph ps -a` 离线模式：服务器未运行时自动读取本地日志文件展示历史
- [x] `dev.py` 进程管理修复：后端异常退出时自动清理前端 Vite 进程
