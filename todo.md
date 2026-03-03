# ClawFlow TODO

## P0 — 核心体验

- [x] **去掉 Console，改为实时卡片**
  将 ExecutionPanel 终端面板移除，Thought/Action/Observation 改为内联在聊天流中的实时卡片，每种类型有独立视觉样式，跟随对话流自然滚动

- [x] **消息 Markdown 渲染**
  引入 @ronradtke/react-native-markdown-display，支持代码高亮、表格、链接、列表等富文本渲染，替换当前纯 Text 组件

## P1 — 功能完善

- [ ] **AI 确认交互（选项卡片）**
  当 AI 返回需要用户确认的问题时，渲染可点击的选项按钮供用户快速选择（如 Yes/No、多选方案等），点击后自动作为用户消息发送，减少手动输入

- [x] **"/" 快捷指令**
  输入 "/" 时弹出指令面板，按 OpenClaw / Custom 分类展示，支持实时搜索过滤，immediate 指令点击直接发送，非 immediate 指令填入输入框继续编辑，输入框边框高亮提示指令模式

- [x] **流式文本渲染**
  assistant 回复逐字/逐段流式显示，Server 通过 SSE 流式请求 OpenClaw `/v1/responses`，解析 `response.output_text.delta` 事件并通过 WebSocket 推送 `message_start`/`message_delta`/`message_done` 事件，Mobile 端增量拼接文本并实时渲染，带闪烁光标指示生成中

- [x] **会话管理**
  点击 Header session ID 弹出会话列表 Sheet，显示所有会话（session key + ID + 时间），支持切换/新建/删除/刷新，当前会话蓝色高亮 + ACTIVE 标签，新建通过 Server 端 `POST /api/sessions` 创建

- [x] **服务端连接管理**
  支持配置多个 Gateway 地址（本地/远程），连接切换 UI，连接状态持久化（AsyncStorage），断线自动重连策略优化（指数退避）

- [x] **对话追加（steer 模式）**
  基于 OpenClaw Gateway 的命令队列机制（[文档](https://docs.openclaw.ai/zh-CN/concepts/queue)），采用 `steer` 模式：用户在 AI 回复生成过程中发送新消息时，立即注入当前运行（在下一个工具边界取消待处理的工具调用），引导 AI 回复方向；若当前未在流式传输则回退为 followup。Mobile 端在 AI 流式回复期间保持输入框可用，发送的消息立即显示在对话流中，实现即时打断引导的交互体验

- [ ] **Gateway 远程鉴权**
  GatewayConfig 增加可选 token 字段，WebSocket 连接和 HTTP 请求时携带 Bearer Token，支持远程部署的 Elysia 服务端鉴权场景

## P2 — 多模态 & 管理

- [x] **语音输入**
  集成 expo-av 实现语音录制 → Whisper/本地 STT 转文字，ChatComposer 增加麦克风按钮

- [x] **图片支持**
  ChatComposer 增加图片选择（expo-image-picker），支持发送图片给 OpenClaw（base64/input_image）；ChatStream 渲染 assistant 返回的图片内容

- [ ] **Agent 管理**
  Agent 列表展示（从 /api/agents 获取），切换不同 Agent，显示 Agent 配置信息（model、workspace 等）

- [x] **会话 Agent 展示与指定**
  当前 OpenClaw 每个会话绑定一个 Agent（默认 `main`），需要在 UI 各处体现 Agent 信息：① ChatHeader 展示当前会话的 agentId；② SessionListSheet 每行显示 agentId 标签；③ 新建会话时支持指定 Agent（默认 `main`），`POST /api/sessions` 传入 agentId 参数。将现有硬编码的 `AGENT_ID = "main"` 改为从当前会话的 `SessionInfo.agentId` 动态读取

- [x] ~~**本地数据持久化**~~
  不再需要：会话数据已通过服务端 JSONL 文件持久化，切换 session 时 watcher 自动重新读取恢复

## P2.5 — 交互优化

- [x] **消息分享按钮（扩展上下文菜单）**
  在 MessageContextMenu 复制按钮组中新增「分享」操作，长按消息后可选择将当前选中消息的内容分享到另一个会话。点击后弹出会话选择列表，选中目标会话后将消息内容作为引用/转发发送至该会话

- [x] **消息回复按钮（扩展上下文菜单）**
  在 MessageContextMenu 复制按钮组中新增「回复」操作，长按消息后可选择回复该消息。点击后将选中消息作为引用上下文附加到 ChatComposer 输入框，用户可在此基础上编辑并发送新消息，实现针对特定消息的上下文回复

- [x] **会话标题展示优化**
  服务端已通过 `extractSessionTitle` 从 JSONL 第一条用户消息提取标题（>50 字符截断 + `...`），但 ChatHeader 目前仅显示 8 位 session ID，需要将标题展示到 ChatHeader 中（标题优先，ID 作为次级信息）。需要：① App.tsx 从 `sessions` 中查找当前会话的 `SessionInfo` 传给 ChatHeader；② ChatHeader 优先显示 `title`，无标题时回退为 shortId；③ 确保 SessionListSheet、ForwardSheet 中 `displayTitle` 逻辑一致

- [x] **会话 Context 用量展示**
  在会话界面中展示当前会话的 context token 用量信息（进度条 + 百分比 + 已用/总量），打开会话即显示，消息完成后自动刷新。服务端解析 JSONL 中的 usage 数据，根据模型推断 context window 大小

- [x] **快捷指令面板动画**
  快捷指令弹出面板增加入场/退场动画（200ms 滑入淡入 / 150ms 滑出淡出），支持暗色/亮色模式自适应

- [x] **全局交互动画优化（@tamagui/animations-moti）**
  引入 `@tamagui/animations-moti` 动画驱动，在 `tamagui.config.ts` 中注册语义化动画 Token（quick / bouncy / lazy / breathe），覆盖以下场景：
  - **全局等待：流线呼吸灯** — 用户发送指令后、首个节点返回前，使用品牌蓝紫渐变 opacity 0.4↔1.0 循环呼吸（breathe），替代传统 Spinner
  - **节点流转：时间轴动画** — 过程展示器中节点推进时，竖线高度从 0→100% 使用 bouncy 弹性生长，状态图标完成时 quick 微弹 scale 1.2→1.0 + 颜色平滑过渡
  - **过程降噪：弹性折叠** — Thought/Action/Observation 卡片展开/收起使用 AnimatePresence + bouncy，配合 enterStyle/exitStyle（opacity:0, scale:0.95, y:-10）实现带空间深度的弹性展开，避免高度突变截断感
  - **流式打字机与光斑** — 文字逐字出现不加动画（防掉帧），末尾追加光标 View 赋予 breathe 动画实现频闪指示
  - **按钮与输入框微交互** — 所有可交互组件配置 pressStyle={{ scale: 0.96 }} + animation="quick" 实现物理按压感；输入框聚焦时 focusStyle 泛起品牌色光晕 + animation="lazy"
  - **条件渲染退场保障** — 错误面板、收起的过程卡片等条件渲染 UI 统一包裹 AnimatePresence，赋予 enterStyle/exitStyle 确保退场动画完整执行
  - **性能底线** — 海量执行日志长列表（ScrollView/FlatList）中禁用列表项内部复杂 animation，优先保障滚动帧率
  动画曲线：quick（damping:20, mass:1.2, stiffness:250）/ bouncy（damping:15, mass:0.9, stiffness:150）/ lazy（damping:20, stiffness:60）/ breathe（timing, 2000ms loop）

## P3 — 品牌 & 设置 & 美化

- [x] **项目名称修改**
  确定正式产品名称ClawFlow（替换当前 ViewClaw），统一更新 App 显示名、Header 标题、package.json name、app.json、启动屏、README 等所有引用处

- [x] **整体 UI 精修美化**
  统一间距/圆角/字号/字重规范，优化动画过渡（列表进入、卡片展开、发送反馈），气泡阴影与层次感，空状态/加载态/错误态的精致插画，适配不同屏幕尺寸，整体视觉一致性打磨

- [x] **暗黑模式切换**
  支持 Light/Dark/跟随系统 三种模式，抽离 colors.ts 为完整主题系统（light + dark palette），持久化用户偏好，所有组件通过 useTheme() hook 响应主题变化

- [x] **本地会话数据清理**
  设置页面中支持按会话删除（DELETE /api/sessions/:id），支持一键清理全部会话，显示会话总数

- [x] **设置页面**
  主题切换（Light/Dark/System 三选一卡片）、会话管理与清理、关于信息，Header 右上角齿轮按钮入口

- [x] **多语言国际化（i18n）**
  引入 i18next + react-i18next + expo-localization，抽离全部硬编码英文文案为语言包（约 80+ 条，涉及 12 个文件），支持 English / 简体中文 / 跟随系统 三种模式，设置页面新增 Language 切换区域（与主题切换同风格），语言偏好持久化至 AsyncStorage

## P4 — OpenClaw 插件化集成

- [x] **插件入口改造（ChannelPlugin 接口）**
  将 `server/src/index.ts` 改造为导出符合 `ChannelPlugin` 接口的插件对象，包含 `id: "viewclaw"`、`gateway.startAccount`（启动 Elysia 服务）、`gateway.stopAccount`（停止服务），使 OpenClaw 直接管理服务器生命周期

- [x] **接入内存事件总线（替代 jsonl-watcher）**
  在 `startAccount` 中调用 `onAgentEvent` 订阅内存事件总线，实现内存级实时推送（替代磁盘 JSONL 轮询），获取完整中间状态和思考过程。废除 `jsonl-watcher.ts` 用于实时监听的逻辑，仅保留其读取历史记录的能力

- [x] **废除 openclaw-client.ts（直调执行引擎）**
  移除现有的 HTTP 请求转发层 `openclaw-client.ts`，改为直接调用 `commands/agent.ts` 中的 `agentCommand` 函数，消息直接进入执行引擎，消除网络层跳转开销，支持更复杂的上下文注入

- [x] **废除自定义 Session 管理（接入内核会话）**
  移除自定义的 Session 管理代码，改用 OpenClaw 内核的 `config/sessions.ts`（`loadSessionEntry` / `updateSessionStore`），与 TUI、WebUI 共享同一会话数据库，实现状态实时同步

- [x] **废除配置硬编码（接入 loadConfig）**
  移除服务端中硬编码的端口、路径等配置，改为直接调用 `config/config.ts` 中的 `loadConfig()` 读取 `~/.openclaw/openclaw.json` 用户设置（API Key、模型偏好、工作目录等）

- [x] **废除自定义上传管理（工作空间写入）**
  移除自定义的文件上传管理逻辑，改为将文件直接写入 `loadConfig().agents.defaults.workspace`，Agent 会自动在工作空间中发现并处理这些文件

- [x] **插件安装与集成测试**
  通过 `openclaw plugins install /path/to/viewclaw/server` 安装本地插件，验证完整链路：插件加载 → Elysia 启动 → 事件总线订阅 → 移动端 WebSocket 连接 → 实时消息推送 → 会话管理同步

- [x] **消息发送链路迁移到插件内核（替代 `/v1/responses`）**
  将 `openclaw-client.ts` 的 `sendMessage/createSession` 从 HTTP 转发改为插件内置执行路径（内核调用），统一覆盖 `POST /api/message` 与 WS `send_message`，消除网络层转发依赖

- [x] **会话管理迁移到内核 Session Store（替代 `sessions_list`）**
  将 `listSessions/resolveSessionKey/getActiveSessionId/getSessionJsonlPath` 改为直接读取 OpenClaw 内核会话存储，移除 `POST /tools/invoke` 依赖与文件系统兜底逻辑

- [x] **实时事件全量迁移到插件事件总线（替代 `_internal/event` + JSONL watcher）**
  将实时流统一到插件事件总线回调（如 `onAgentEvent`），下线 `_internal/event` 桥接与 watcher 轮询实时分支，仅保留历史读取能力

- [x] **健康检查改为插件运行态探测（替代 upstream HEAD）**
  `/healthz` 在插件模式下不再探测 `OPENCLAW_BASE_URL`，改为检查插件运行态、网关服务状态与事件总线订阅状态；仅在 standalone 模式保留 upstream 探测

## P5 — npm 发布

- [x] **发布元数据配置**
  `package.json` name 改为 `clawflow`（用户安装命令 `openclaw plugins install clawflow`），elysia 版本锁定为 `^1.4.0`，添加 description/keywords/license/repository/files 等发布元数据，`openclaw.plugin.json` 和 `index.ts` 中 plugin id 同步更新为 `clawflow`

- [x] **发布文件过滤**
  创建 `.npmignore` 排除 `.env`、测试文件、`tsconfig.json`、`bun.lock` 等开发文件，`files` 白名单配合 `!src/*.test.ts` 排除测试文件

- [x] **发布内容验证**
  `npm pack --dry-run` 确认 tarball 仅包含 13 个必要文件（`index.ts`、`openclaw.plugin.json`、`src/` 核心源码），总大小 ~16KB
