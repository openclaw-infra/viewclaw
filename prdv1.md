OpenClaw 移动端实时监控聊天 APP 架构方案

基于你的技术栈限制：Expo + Tamagui UI (移动端) + Elysia (服务端) + 本地数据持久化。本方案旨在实现一个既能进行常规 IM 聊天，又能以极低延迟实时渲染 OpenClaw 代理“底层思考与执行过程”的移动端应用。

0. 产品定位与核心价值

本应用是一个披着“日常聊天软件 (IM)”外衣的 “AI 代理移动端控制台 (Mobile Agent Console)”。

目标受众: AI 开发者、极客玩家、效率工具狂热者以及 OpenClaw 的私有化部署用户。

核心理念: “打破黑盒，把 AI 的大脑和双手装进你的口袋”。

解决的痛点: 1.  黑盒焦虑: 传统移动端 AI 聊天应用只能展示最终文本，用户不知道 AI 在后台执行了哪些脚本、搜索了什么网页或调用了什么 API。
2.  移动端调试缺失: 当用户出门在外，想随时随地给家里的 OpenClaw 派发复杂任务（如爬取数据、编写代码）并监控其执行进度时，缺乏一个原生、流畅且直观的移动端工具。
3.  隐私泄露风险: 第三方云端托管的监控平台容易泄露私人的 Agent 环境变量、代码逻辑和私人聊天数据。

三大核心卖点:

执行透明化 (Glass-box Execution): 不仅能聊天，还能像看直播一样实时观测 Agent 的 Thought (思考链)、Action (工具/终端调用) 和 Observation (环境反馈)。

绝对数据主权 (Local-First): 网关层绝对无状态，所有会话历史和海量的底层执行日志全量保存在手机本地，真正做到离线可用、隐私安全。

原生级丝滑体验 (Native Performance): 面对大模型高频密集的终端日志流，依然能保持信息流的清晰与页面的不卡顿。

1. 核心架构原理

整个架构的核心思想是 “轻量级无状态网关 + 强本地胖客户端”。

Elysia (服务端代理/网关): 扮演无状态的“实时数据管道”。它不存储任何聊天记录，只负责两件事：接收移动端的指令转发给 OpenClaw，以及实时拦截 OpenClaw 的执行流（标准输出、工具调用、大模型思考）并通过 WebSocket 推送给移动端。

Expo + Tamagui (移动端客户端): 扮演“终端控制台 + 数据库”。负责精美的 UI 渲染，同时接管所有的数据持久化（SQLite/MMKV）。

数据流隔离: 将“面向用户的最终回复 (Message)”和“过程日志 (Execution Log)”在数据结构上严格区分，方便前端分别渲染。

数据流转图

$$发送$$

Expo (存入本地DB) -> WebSocket -> Elysia -> OpenClaw (API/标准输入)

$$执行$$

OpenClaw 开始运行，产生 Thought (思考), Action (工具调用), Observation (终端输出)。

$$推送$$

Elysia 拦截到这些流，封装成标准 JSON Event -> WebSocket -> Expo

$$渲染与保存$$

Expo 接收到 Event，如果是 Log 则渲染到折叠面板，如果是 Message 则渲染到主聊天流，并异步写入本地 DB。

2. 服务端方案：Elysia 桥接层 (Bun)

Elysia 运行在 Bun 上，天生具备极高的并发性能和非常简洁的 WebSocket API，非常适合做这种高频流式数据的透传网关。

核心职责与实现原理

WebSocket 长连接管理: 维持与移动端 Expo App 的实时连接。

OpenClaw Gateway API 与日志监听:

API 代理: OpenClaw 默认会在本地（通常为 18789 端口）运行控制面 Gateway，并暴露 /api/* 和 /_admin/ 等端点。Elysia 服务端可通过提取并携带本地的 Auth Token，直接调用该内部 HTTP API 来下发对话指令。

执行流监听 (JSONL 劫持): OpenClaw 的底层逻辑会将所有的实况过程和会话数据极其规范地实时追加到工作区文件中（如 ~/.openclaw/agents/<agentId>/sessions/<sessionId>.jsonl）。因此，Elysia 不需要强行去拉起命令行截获 stdout，只需利用 Bun 的文件系统能力实时监听（Tail）该 .jsonl 文件即可。一旦有新的 Thought 或 Action 追加，立刻解析为 JSON 并推送给移动端，这保证了极高的数据结构化和稳定性。

数据结构化: 将 OpenClaw .jsonl 中杂乱的内容或不同的 tag 统一解析为适合前端渲染的 Payload。

3. 移动端方案：Expo + Tamagui + 本地存储

移动端是重头戏，因为既要保证 UI 的丝滑（尤其是在高频日志输出时），又要管理本地庞大的日志数据。

3.1 界面设计 (Tamagui UI)

Tamagui 的强项在于高性能和高度可定制的设计系统。

主聊天流 (YStack + ScrollView): 像微信一样，展示用户发送的消息和 OpenClaw 的最终回复（普通 Markdown/文本）。

执行过程监控 (Sheet / 内联控制台): * 方案 A (类似 Happy): 在每一条 AI 回复的气泡下方，附加一个可折叠的 <Accordion>，展开后像终端一样显示带有不同颜色的 Log（如黄色表示思考，绿色表示执行命令，红色表示错误）。

方案 B (抽屉/Sheet): 屏幕底部常驻一个 <Sheet>，在 AI 执行任务时自动微微弹起，显示滚动的代码或终端日志。

3.2 本地数据持久化

既然所有数据都在本地，推荐使用组合方案：

主聊天记录 (expo-sqlite): 适合结构化查询，比如“加载历史会话列表”。

高频日志数据 (react-native-mmkv): 因为 Agent 的执行日志极其频繁且庞大，直接写 SQLite 容易卡顿 UI。可以使用 MMKV 进行极速键值对存储，将一个 messageId 对应的所有日志作为一个 JSON 数组存储。

3.3 状态管理与高频渲染优化 (关键挑战)

大模型的终端输出是毫秒级高频的。如果每次 WebSocket 收到一小段日志就触发 React 整个列表的 Re-render，Expo App 会立刻卡死发烫。

解决策略：节流 (Throttling) 与 局部更新

WebSocket 消息缓冲池: 在接收到 Elysia 的消息后，不要立即 setState。而是放入一个 Buffer 中。

定时刷新 (RAF/setInterval): 每 100ms 或 200ms，将 Buffer 中的日志合并后，再统一触发一次 React State 更新。

分离组件: 将“最终聊天气泡”和“底层执行日志面板”拆分成独立的组件。使用 React.memo 或者 Zustand 的细粒度订阅，确保日志的高频更新只引发控制台组件的重绘，而不会导致整个聊天列表重绘。

4. 方案总结与优势

极致的隐私与离线体验: 服务器（Elysia）拔掉网线后不带走一片云彩。用户的指令历史、AI 的执行机密全部锁在手机本地的 SQLite 中。

极高的并发吞吐能力: Bun + Elysia 处理高频的 WebSocket 数据流比传统的 Node.js (Express/Nest) 拥有肉眼可见的性能优势和更低的内存占用。

现代化的 UI 体验: Tamagui 允许你写一套代码，不仅在 iOS/Android 上表现出原生级别的动画和流畅度（通过预编译），未来如果需要出 Web 网页版（Dashboard）也能直接复用 UI 代码。