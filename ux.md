ClawFlow 移动端 UI 设计与组件规范 (Design System Specs)

1. 设计原则 (Design Principles)

过程透明 (Process Transparency)：UI 必须能够优雅地降噪展示复杂的 AI 执行链路（如 API 调用、数据抓取、逻辑推理）。

流式呼吸 (Fluid & Breathing)：呼应 Logo 的蓝紫交织线条，在等待和执行状态中加入呼吸感动画，缓解用户等待焦虑。

克制与聚焦 (Restrained & Focused)：主背景保持极简，将视觉焦点让位给“执行数据流”和最终的对话结果。

统一图标语言 (Iconography over Emojis)：全局使用矢量图标（如 Lucide, Phosphor Icons 或 Feather），严格禁止使用 Emoji 表情，以保证跨平台（iOS/Android）视觉的绝对一致性和专业、极客的科技感。

2. 色彩系统 (Color Tokens)

建议在主题配置（如 Tamagui Theme 或 Tailwind Config）中注册以下 Token：

2.1 品牌色 (Brand Colors)

提取自 ClawFlow 官方 Logo，主打科技、流畅。

color-brand-blue: #2CB5E8 (主蓝：用于主按钮、强调文本、激活状态)

color-brand-purple: #8E2DE2 (主紫：用于次要高亮、渐变搭配)

gradient-brand: linear-gradient(135deg, #2CB5E8 0%, #8E2DE2 100%) (用于 Loading 环、VIP标识或特殊卡片边框)

2.2 语义状态色 (Semantic States)

核心！用于标记 OpenClaw 执行过程的各个节点状态。

color-state-running: #3B82F6 (执行中，通常配合透明度变化做呼吸灯效)

color-state-success: #10B981 (翠绿：节点执行成功、完成校验)

color-state-warning: #F59E0B (橙黄：遇到阻塞、重试中、需要用户授权)

color-state-error: #EF4444 (警示红：执行中断、接口报错)

2.3 背景与表面色 (Background & Surface)

支持暗黑/明亮双色模式。

bg-base: Light: #F9FAFB | Dark: #0F1115 (应用底层背景)

bg-surface-1: Light: #FFFFFF | Dark: #1C1F26 (卡片底色、AI 回复底色)

bg-surface-2: Light: #F3F4F6 | Dark: #272A30 (用户输入气泡底色、折叠面板底色)

bg-code-block: Light: #E5E7EB | Dark: #000000 (代码和 JSON 块底色)

3. 字体与排版规范 (Typography)

由于涉及大量日志和代码展示，必须严格区分自然语言与机器语言。

3.1 字体族 (Font Families)

Base (自然语言): 系统默认无衬线字体 (iOS: San Francisco, Android: Roboto)。

Mono (机器语言): 必须引入等宽字体 (推荐 JetBrains Mono, Fira Code 或 Menlo)。用于：JSON 输出、终端命令、原始数据抓取结果。

3.2 字号层级 (Font Sizes)

text-xl (20px, Bold): 页面大标题 (Header)

text-base (16px, Regular/Medium): 用户输入文本、AI 最终回复的正文 (对话主体)

text-sm (14px, Regular): 辅助说明文字、按钮文本

text-xs (12px, Mono): 执行过程的日志详情、折叠面板内的代码块

4. 空间与圆角 (Spacing & Radii)

呼应 Logo 的圆润流线，组件边缘避免过于锋利。

圆角 (Radii):

radius-sm (6px): 内部小元素，如状态标签 (Badge)、代码块。

radius-md (12px): 按钮 (Button)、输入框 (Input)。

radius-lg (18px - 24px): 聊天气泡、外层执行过程大卡片 (Card)。

间距 (Spacing):

采用 4px 的倍数递进体系 (4, 8, 12, 16, 24, 32)。

聊天气泡之间的间距：16px。

卡片内部元素的间距：8px 到 12px。

5. 核心组件交互与展示逻辑 (Core Components)

5.1 组合式对话卡片 (Composite Chat Bubble)

放弃传统 IM 的单一文本气泡，ClawFlow 的 AI 回复应当是一个 Stack 卡片组合：

Header (状态区): 显示当前总体状态 (搭配对应状态的 Icon，如：[Loading Icon] 正在思考... / [Check Icon] 任务完成)。

Body-Process (过程折叠面板): 见 5.2 详情。默认在执行时展开最后一步，完成后自动折叠。

Body-Result (结果区): OpenClaw 提炼后的自然语言最终回复，字号最大 (text-base)。

Footer (操作区): 搭配功能 Icon 的按钮组，如：复制、重新生成、查看 Raw JSON。

5.2 执行过程展示器 (Process Visualizer) - 核心组件

在移动端有限屏幕内展示复杂链路，必须使用 垂直时间轴 (Vertical Stepper) + 折叠面板 (Accordion)。

节点状态映射 (Node States):

Pending (等待): 灰色小圆点或 [Clock Icon]，文本置灰。

Running (执行中): 蓝紫渐变 (gradient-brand) 边框，内部有一个循环转圈的 [Spinner Icon]，下方跟随打字机效果的流式输出日志 (Mono 字体)。

Success (成功): 绿色 (color-state-success) 实心圆点配合 [Check Icon]。可点击展开查看该节点的输入/输出 JSON。

Failed (失败): 红色 (color-state-error) 实心圆点配合 [Cross Icon]。自动展开报错日志。

交互逻辑:

整个 Timeline 外部包裹一个 Accordion。

用户可以一键“收起过程”，只看最终结果卡片。

5.3 底部输入台 (Bottom Input Console)

不仅是一个文本框，更像是一个“指令发射台”。

右侧发送按钮：未输入文字时显示 [Mic Icon] 语音或 [Plus Icon] 附加模块入口，输入后变为蓝紫渐变的 [Send/Arrow-Up Icon]。

输入框上方：支持横向滑动的快捷指令芯片 (Quick Command Chips) 或历史 Agent 角色切换。

6. 动画与反馈 (Animations)

流式打字 (Streaming Typewriter): AI 回复结果时，文字平滑出现。

状态渐变 (State Transition): 过程节点从 Running 变为 Success 时，颜色和 Icon 需有 300ms 的平滑过渡 (Ease-in-out)。

呼吸灯 (Breathing Effect): 在全局等待 AI 响应期间，可利用 Logo 的流线做微弱的放大缩小透明度呼吸动画（周期 2s），代替死板的转圈 Loading。