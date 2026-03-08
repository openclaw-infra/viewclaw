ClawFlow 平台动画设计规范 (Animation Design System - Tamagui Edition)

1. 动画设计理念 (Animation Philosophy)

ClawFlow 的动画设计灵感来源于品牌 Logo 中的**“交织流线”与“科技节点”**。动画的核心使命是解释 OpenClaw 的后台运作状态，降低用户的等待焦虑。

如水流转 (Fluid Flow)：拒绝生硬的瞬间切换。数据加载、面板展开应当如同信息流顺着 Logo 的弧线般顺滑流淌。

节点呼吸 (Node Breathing)：在长时间的 AI 任务执行中，使用温和的呼吸律动代替急躁的高频转圈，传递“系统正在稳步计算”的安全感。

弹性与克制 (Spring & Restraint)：结合 Tamagui 的核心优势，大量应用物理弹性（Spring）而非线性时间（Timing）动画，增加真实感；但通过高阻尼（Damping）控制，避免过度弹跳，保持极客工具的专业与克制。

2. Tamagui 动画配置规范 (Tamagui Animation Config)

在 tamagui.config.ts 中，强烈建议使用 @tamagui/animations-react-native 或 @tamagui/animations-moti，并注册以下具有语义化的动画 Token：

2.1 核心动画曲线配置 (Easing & Spring Tokens)

quick (快速/微交互):

配置: { type: 'spring', damping: 20, mass: 1.2, stiffness: 250 }

用途: 按钮按下缩放 (pressStyle)、Icon 颜色切换、Hover 状态。响应极其迅速，毫不拖泥带水。

bouncy (强调入场/折叠):

配置: { type: 'spring', damping: 15, mass: 0.9, stiffness: 150 }

用途: 折叠面板 (Accordion) 的展开/收起、气泡卡片的首次出现。带有轻微的回弹感，吸引注意力。

lazy (平滑过渡/退场):

配置: { type: 'spring', damping: 20, stiffness: 60 }

用途: 弹窗关闭、颜色渐变、尺寸的无缝切换。柔和且不抢戏。

breathe (持续循环):

配置: { type: 'timing', duration: 2000 } (需配合 loop 循环)

用途: 全局等待时的蓝紫流线呼吸灯。

3. 核心业务动画 (Core Business Animations)

针对 ClawFlow 核心的“执行过程展示”，定义以下专属动画的 Tamagui 实现思路：

3.1 全局等待：流线呼吸灯 (Global Breathing Flow)

触发场景: 用户发送指令后，OpenClaw 尚未返回第一个节点前的整体等待期。

动效描述:

提取 Logo 中的蓝紫渐变 ($color.brandBlue 到 $color.brandPurple)。

Tamagui 实现: 使用持续循环的定时器或 Reanimated 的 withRepeat 配合 withTiming，控制容器的 opacity 在 0.4 到 1.0 之间往复。

禁忌: 避免使用传统的、急躁的“菊花转圈” Spinner。

3.2 节点流转：时间轴动画 (Timeline Step Transition)

触发场景: 过程展示器中，任务从节点 A 推进到节点 B。

动效描述:

线条生长: 竖线高度从 0 到 100%，组件使用 animation="bouncy"。

状态图标演变: 节点完成时，图标容器绑定 animation="quick"，状态变更时触发 scale: 1.2 -> 1.0 的微弹，同时颜色通过 Tamagui 的主题变量平滑过渡。

3.3 过程降噪：弹性折叠 (Spring Accordion)

触发场景: 用户点击“展开/收起执行详情”。

动效描述:

Tamagui 实现: 强依赖 Tamagui 的 AnimatePresence 和 Accordion 组件。

展开的内容区域 (YStack) 必须配置 animation="bouncy"。

配合 enterStyle={{ opacity: 0, scale: 0.95, y: -10 }} 和 exitStyle={{ opacity: 0, scale: 0.95, y: -10 }}，实现带有空间深度的弹性展开效果，彻底避免高度突变带来的生硬截断感。

3.4 数据输出：流式打字机与光斑 (Streaming Typewriter)

触发场景: AI 回复正文，或后台抓取的 JSON 数据实时打印。

动效描述:

文字逐字出现不要加动画（防止在 Tamagui 中频繁重渲染导致掉帧）。

在文字末尾追加一个定制的 <View /> 作为光标，赋予 animation="breathe" 实现频闪。

4. 交互微动效 (Micro-interactions)

4.1 按钮与输入框 (Buttons & Inputs)

按下反馈 (Press):

Tamagui 默认支持，需在所有可交互组件上配置 pressStyle={{ scale: 0.96 }}，并配合 animation="quick"，实现干脆利落的物理按压感。

输入框聚焦 (Focus):

底部输入台配置 focusStyle={{ borderColor: '$color.brandBlue', shadowColor: '$color.brandBlue', shadowRadius: 8 }}，animation="lazy"，聚焦时泛起品牌色的光晕。

5. 开发者实现指引 (Tamagui Implementation Notes)

统一驱动: 请在 tamagui.config.ts 中使用 @tamagui/animations-react-native 创建 animations 对象，严格映射规范中的 quick, bouncy, lazy 等 Token。

利用 AnimatePresence: 对于条件渲染的 UI（如执行失败弹出的错误面板、收起的过程卡片），务必包裹在 AnimatePresence 中，并赋予 enterStyle 和 exitStyle，这样才能保证退场动画被完整执行。

性能底线:

尽管 Tamagui 性能极佳，但在展示海量执行日志（如巨型 JSON）的长列表 (ScrollView / FlatList) 中，应暂时禁用列表项内部的复杂 animation 属性，优先保障滚动帧率。