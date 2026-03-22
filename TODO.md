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
- [x] ~~**`qgraph serve` 默认绑定 `0.0.0.0`**~~ ✅ 已完成
- [x] ~~**节点自测（Test Node）**~~ ✅ 已完成
- [x] ~~**Input 节点参数传递**~~ ✅ 已完成
- [x] ~~**前端 Build → pip 打包**~~ ✅ 已完成

### v0.1.0 发布前（按优先级排序）

- [x] ~~**节点复制 / 粘贴**~~（S 级）✅ Ctrl+C 复制选中节点，Ctrl+V 粘贴（偏移 +40px），Delete 删除节点及相关连线
- [x] ~~**节点耗时显示**~~（A 级）✅ 执行完成后节点上显示 ⏱ 耗时（前端计时，无后端改动）
- [x] ~~**日志按节点过滤**~~（A 级）✅ LogPanel 节点下拉筛选器，可按节点过滤日志
- [x] ~~**前端构建 + 发布 PyPI**~~ ✅ release.py 已优化（预检 lint/tsc + 前端构建验证 + wheel 大小检查）

---

## 🟢 后续迭代

### v0.2: 体验增强
- [ ] **Quick Add — 粘贴命令智能创建节点**（已讨论，待细化设计）：
  - 方案 A：Toolbar/画布输入框，粘贴命令自动解析为节点（纯前端字符串解析）
    - `ENV=val python xxx.py --args` → Python Script 节点（提取 env_vars, script_path, args）
    - `bash xxx.sh` 或其他 → Shell Command 节点
    - `cd /path && cmd` → 提取 working_dir + command
  - 方案 B：右键画布 "Paste as Node"，弹出预览确认后创建
  - 方案 C：从 shell 脚本文件批量导入多个节点 + 自动连线
- [ ] **单步调试**：逐节点执行，观察每步输出
- [ ] **撤销 / 重做**（Ctrl+Z / Ctrl+Shift+Z）
- [ ] 日志预览增强：全屏模式、关键字搜索

### v0.2: 数据流
- [ ] **连线数据传递**（简化版）：上游节点 stdout 最后一行自动注入为下游 `QGRAPH_<NODE_NAME>` 环境变量
- [ ] **连线数据传递**（完整版）：模板语法 `{{node_name.output.key}}`
- [ ] 结构化 JSON 数据流（节点间传递 JSON 对象）

### v0.2: 项目管理
- [ ] **Graph 存储位置调整**：
  - 默认保存到项目目录 `.qgraph/graphs/`（类似 `.git/`），方便 git 管理
  - 如果当前目录没有 `.qgraph/`，使用 `~/.qgraph/graphs/` 全局存储
  - 新增 `qgraph init` 命令在当前目录初始化 `.qgraph/`

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
