# ViewClaw TODO

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

- [ ] **Gateway 远程鉴权**
  GatewayConfig 增加可选 token 字段，WebSocket 连接和 HTTP 请求时携带 Bearer Token，支持远程部署的 Elysia 服务端鉴权场景

## P2 — 多模态 & 管理

- [x] **语音输入**
  集成 expo-av 实现语音录制 → Whisper/本地 STT 转文字，ChatComposer 增加麦克风按钮

- [x] **图片支持**
  ChatComposer 增加图片选择（expo-image-picker），支持发送图片给 OpenClaw（base64/input_image）；ChatStream 渲染 assistant 返回的图片内容

- [x] **Agent 管理**
  Agent 列表展示（从 /api/agents 获取），切换不同 Agent，显示 Agent 配置信息（model、workspace 等）

- [x] ~~**本地数据持久化**~~
  不再需要：会话数据已通过服务端 JSONL 文件持久化，切换 session 时 watcher 自动重新读取恢复

## P3 — 品牌 & 设置 & 美化

- [ ] **项目名称修改**
  确定正式产品名称ClawFlow（替换当前 ViewClaw），统一更新 App 显示名、Header 标题、package.json name、app.json、启动屏、README 等所有引用处

- [ ] **整体 UI 精修美化**
  统一间距/圆角/字号/字重规范，优化动画过渡（列表进入、卡片展开、发送反馈），气泡阴影与层次感，空状态/加载态/错误态的精致插画，适配不同屏幕尺寸，整体视觉一致性打磨

- [x] **暗黑模式切换**
  支持 Light/Dark/跟随系统 三种模式，抽离 colors.ts 为完整主题系统（light + dark palette），持久化用户偏好，所有组件通过 useTheme() hook 响应主题变化

- [x] **本地会话数据清理**
  设置页面中支持按会话删除（DELETE /api/sessions/:id），支持一键清理全部会话，显示会话总数

- [x] **设置页面**
  主题切换（Light/Dark/System 三选一卡片）、会话管理与清理、关于信息，Header 右上角齿轮按钮入口
