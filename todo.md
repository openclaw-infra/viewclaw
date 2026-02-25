# ViewClaw TODO

## P0 — 核心体验

- [ ] **去掉 Console，改为实时卡片**
  将 ExecutionPanel 终端面板移除，Thought/Action/Observation 改为内联在聊天流中的实时卡片，每种类型有独立视觉样式，跟随对话流自然滚动

- [ ] **消息 Markdown 渲染**
  引入 react-native-markdown-display 或类似库，支持代码高亮、表格、链接、列表等富文本渲染，替换当前纯 Text 组件

## P1 — 功能完善

- [ ] **流式文本渲染**
  assistant 回复逐字/逐段流式显示，而非等 JSONL 完整写入后一次性出现，提升实时感

- [ ] **会话管理**
  会话列表页（显示所有 session + agent 信息），新建/切换/删除会话，会话搜索，完善 ChatHeader 的 session 选择器

- [ ] **服务端连接管理**
  支持配置多个 Gateway 地址（本地/远程），连接切换 UI，连接状态持久化（MMKV），断线自动重连策略优化

## P2 — 多模态 & 管理

- [ ] **语音输入**
  集成 expo-av 实现语音录制 → Whisper/本地 STT 转文字，ChatComposer 增加麦克风按钮

- [ ] **图片支持**
  ChatComposer 增加图片选择（expo-image-picker），支持发送图片给 OpenClaw（base64/input_image）；ChatStream 渲染 assistant 返回的图片内容

- [ ] **Agent 管理**
  Agent 列表展示（从 /api/agents 获取），切换不同 Agent，显示 Agent 配置信息（model、workspace 等）

- [ ] **本地数据持久化**
  集成 expo-sqlite + MMKV，聊天记录本地存储与加载，执行日志本地缓存，离线查看历史会话

## P3 — 品牌 & 设置 & 美化

- [ ] **项目名称修改**
  确定正式产品名称（替换当前 ViewClaw），统一更新 App 显示名、Header 标题、package.json name、app.json、启动屏、README 等所有引用处

- [ ] **整体 UI 精修美化**
  统一间距/圆角/字号/字重规范，优化动画过渡（列表进入、卡片展开、发送反馈），气泡阴影与层次感，空状态/加载态/错误态的精致插画，适配不同屏幕尺寸，整体视觉一致性打磨

- [ ] **暗黑模式切换**
  支持 Light/Dark/跟随系统 三种模式，抽离 colors.ts 为完整主题系统（light + dark palette），持久化用户偏好

- [ ] **本地会话数据清理**
  支持按会话/按时间范围清理本地缓存的聊天记录和执行日志，设置自动清理策略（如保留最近 N 天），显示本地存储占用大小

- [ ] **设置页面**
  Gateway 地址配置、主题切换、通知偏好、日志保留策略、关于页面
