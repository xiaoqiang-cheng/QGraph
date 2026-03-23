# QGraph TODO

> 跟踪所有已知问题、待完善功能和后续迭代计划

---

## 🔴 v0.1.8 紧急修复（用户实测反馈）— ✅ 全部完成

- [x] ~~运行中日志不可查看~~ — live_logs 实时写入 + `qgraph logs -f` + 自动 follow
- [x] ~~环境变量 `$XXX` 未替换~~ — executor 做 `$VAR` / `${VAR}` 模板替换
- [x] ~~编辑器节点状态未清除~~ — 成功运行后 3s 重置为 idle；保存时强制写 idle
- [x] ~~CLI 运行 Web 端不同步~~ — `list_runs()` 合并内存 + running 文件；Dashboard 轮询发现 CLI 运行
- [x] ~~`qgraph logs` 运行中不自动跟踪~~ — 检测到 running 自动切换 follow 模式
- [x] ~~编辑器加载时节点残留旧状态~~ — handleLoad 强制 idle + 检测活跃运行展示日志面板
- [x] ~~Dashboard Running 缺少 Logs 按钮~~ — 新增 Logs 按钮 + LogViewer 轮询刷新
- [x] ~~Dashboard 无 Run ID 显示~~ — RunIdBadge 组件 + 双击复制

---

## 🟡 v0.1.x 体验优化（用户实测反馈）

- [ ] **Quick Add 多行 echo 解析问题**
  - 现象：粘贴多行 echo 命令时，每个 echo 变成独立节点，用户期望合并为一个 shell 节点
  - 方案：增加智能合并策略——连续的同类简单命令（echo/export/set）合并为一个 shell 节点

- [ ] **Python Script 参数编辑体验**
  - 现象：参数很多时全部集中在一行，难以编辑和阅读
  - 方案：ConfigPanel 中 Python Script 的 args 改为 textarea 多行编辑，每行一个参数

- [ ] **运行中断机制**
  - 现象：CLI `qgraph run` 没有优雅中断（Ctrl+C 后子进程可能残留）
  - 方案：CLI 注册 SIGINT handler，级联终止所有子进程；Web 端已有 Stop 按钮，需确认子进程清理
  - 延伸：考虑运行历史状态快照（interrupted 状态）

- [ ] **效率定位问题**
  - 现象：纯线性脚本场景下 QGraph 对比 shell script 没有明显优势
  - 方案：README/文档中明确定位——QGraph 的价值在于「可视化 + 并行编排 + 可观测性 + 可复用」，不适合替代简单线性脚本

---

## 🟢 v0.2 战略方向：AI-First 任务编排

- [ ] **成为 AI 工具首选的任务调度器**
  - 方向：AI Agent 自动生成 Pipeline JSON → QGraph 执行 + 可视化
  - MCP Server 集成：让 AI 直接调用 QGraph API 创建/运行/监控流水线
  - 结构化输出协议：节点输出 JSON → 下游节点可引用（`{{node.output.key}}`）
  - 实时状态回传：AI Agent 可订阅执行状态，动态调整后续步骤

---

## 🟢 后续迭代

### v0.2: 体验增强
- [ ] **单步调试**：逐节点执行，观察每步输出
- [ ] **撤销 / 重做**（Ctrl+Z / Ctrl+Shift+Z）
- [ ] 日志预览增强：全屏模式、关键字搜索

### v0.2: 数据流
- [ ] **连线数据传递**（简化版）：上游节点 stdout 最后一行自动注入为下游 `QGRAPH_<NODE_NAME>` 环境变量
- [ ] **连线数据传递**（完整版）：模板语法 `{{node_name.output.key}}`
- [ ] 结构化 JSON 数据流（节点间传递 JSON 对象）

### v0.3+: 高级功能
- [ ] 条件分支节点（if/else）— 需谨慎评估，和"轻量"定位可能冲突
- [ ] 循环节点（for/while）— 同上
- [ ] 断点调试：在某个节点暂停执行
- [ ] 节点分组 / 子图
- [ ] 运行历史对比：对比两次运行的参数和结果

### v1.0+: 生态
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
- [x] `qgraph serve` 默认绑定 `0.0.0.0`，方便远程服务器访问
- [x] 节点自测（Test Node）：ConfigPanel 内 "▶ Test Node" 按钮，单节点执行 + 日志输出 + 超时控制
- [x] 节点失败后下游自动跳过（skipped），级联传播，CLI 显示 `⊘ skipped`
- [x] Test Node 中断：测试运行中可点击 "⏹ Stop Test" 取消，后端 `POST /api/nodes/test/stop`
- [x] 断点续传（Resume）：Pipeline 失败后 Toolbar 出现 "↻ Resume" 按钮，跳过已成功节点从失败处重新执行
- [x] 面板边界可拖拽调整宽度（Sidebar / ConfigPanel / LogPanel）
- [x] Test Node 日志实时推送：通过 WebSocket `test_log` 消息实时显示，不再等请求完成
- [x] Input 节点参数自动传递：BFS 传播到所有下游节点 env_vars，支持覆盖
- [x] 编辑器加载时自动恢复上次失败运行的 Resume 状态
- [x] Input 节点 ConfigPanel 可编辑 parameters（键值对编辑器）
- [x] 自测节点自动注入 Input 参数 + 提示跨平台环境变量引用语法
- [x] 执行历史按时间排序（Dashboard）
- [x] 节点复制（Ctrl+C/V）、删除（Delete/Backspace）快捷键
- [x] 节点耗时显示（执行完成后节点上显示 ⏱ 耗时）
- [x] 日志按节点过滤（LogPanel 下拉筛选器）
- [x] 统一 CLI/serve 执行层：共享 RunManager + running 文件 + 日志系统
- [x] 本地/全局存储分离：`qgraph init` + `project_dir` 自动管理
- [x] `qgraph ps` 基于 PID 文件检测运行中任务（不依赖 serve）
- [x] Quick Add：双击画布粘贴命令创建节点 + 多行脚本自动连线
- [x] Smoke test（30 项自动化检查）
- [x] Web UI 实时日志面板（可拖拽高度、自动滚动、节点过滤、Clear 按钮）
- [x] 前端 Build → pip 打包
- [x] Graph 存储位置调整（本地 `.qgraph/` + 全局 `~/.qgraph/`）
- [x] Dashboard 删除图功能修复
- [x] 运行日志持久化修复
- [x] Run status 判断修复
- [x] 运行中日志实时查看：`live_logs/` 实时写入 + `qgraph logs -f` 跟踪模式
- [x] 环境变量 `$VAR` / `${VAR}` 模板替换（shell command + python script args）
- [x] 编辑器节点状态自动清除（成功运行后 3 秒重置为 idle）
- [x] CLI/Web 运行状态统一（list_runs 合并内存 + running 文件，Dashboard 自动发现 CLI 运行）
- [x] `qgraph logs` 运行中任务自动切换 follow 模式
- [x] 编辑器加载时强制 idle + 检测活跃运行展示日志面板
- [x] Dashboard Running 增加 Logs 按钮 + LogViewer 1s 轮询刷新
- [x] Dashboard Run ID 显示（RunIdBadge 组件 + 双击复制 + 单击不冒泡）
