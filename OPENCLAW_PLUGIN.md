# OpenClaw 插件化与内置能力接入指南

本指南详细说明了如何将 ClawFlow（ViewClaw）从一个外部工具转变为 OpenClaw 的 **原生频道插件 (Channel Plugin)**，并利用 OpenClaw 内置的事件总线替代现有的文件监听方案。

## 1. 插件化架构方案

将 `/server` 改造为 OpenClaw 插件，可以使 OpenClaw 直接管理 Elysia 服务器的生命周期，并允许服务器直接访问 OpenClaw 的内部内存状态。

### 核心改造步骤

1.  **定义插件对象**: 在 `server/src/index.ts` 中导出符合 `ChannelPlugin` 接口的对象。
2.  **管理生命周期**: 使用 `gateway.startAccount` 启动 Elysia，使用 `gateway.stopAccount` 停止。
3.  **接入事件总线**: 使用 `onAgentEvent` 替代 `jsonl-watcher`。

```typescript
// server/src/index.ts 示例
import { onAgentEvent } from "../../infra/agent-events.js"; 

export const plugin = {
  id: "viewclaw", 
  gateway: {
    startAccount: async ({ log }) => {
      app.listen(PORT);
      // 🌟 直接订阅内存事件总线
      onAgentEvent((evt) => {
        broadcastToMobile(evt.sessionKey, evt);
      });
    },
    stopAccount: async () => app.stop(),
  },
};
```

## 2. 内置处理与实时流

OpenClaw 内部的事件分发机制完全可以替代目前基于磁盘日志的方案。

### 方案对比

| 特性 | 现有方案 (JSONL 监听) | 推荐方案 (onAgentEvent) |
| :--- | :--- | :--- |
| **数据源** | 磁盘文件 (`.jsonl`) | **内存事件总线** |
| **延迟** | 高 (受磁盘 I/O 影响) | **极低 (内存级实时推送)** |
| **信息粒度** | 受限于持久化日志 | **完整 (包含所有中间状态和思考过程)** |

## 3. 媒体资源处理与渲染 (Media Handling)

在插件化模式下，移动端可以完美渲染图片、视频和音频，包括 Agent 在宿主机上生成的本地文件。

*   **自动识别**: 移动端 `MarkdownBody` 会自动识别并渲染媒体链接。
*   **本地文件映射**: 通过 `/api/images/*` 接口，将宿主机的绝对路径转换为移动端 URL。
*   **格式支持**: 图片 (jpg, png, gif, svg, heic)、视频 (mp4, mov)、音频 (mp3, m4a, opus)。

## 4. 可替换的服务端能力 (Replaceable Components)

插件化后，你可以废除现有的“模拟代理”代码，直接调用 OpenClaw 内核函数：

### 1) 废除 `jsonl-watcher.ts` (实时监听)
*   **替代品**: `infra/agent-events.ts` 中的 `onAgentEvent`。
*   **优势**: 无需扫描磁盘，不再受文件 Flush 延迟影响，支持获取“思考中”的实时状态。

### 2) 废除 `openclaw-client.ts` (HTTP 请求转发)
*   **替代品**: 直接调用 `commands/agent.ts` 中的 `agentCommand` 函数。
*   **优势**: 消息直接进入执行引擎，无需经过网络层跳转，支持更复杂的上下文注入。

### 3) 废除自定义的 Session 管理
*   **替代品**: 使用 `config/sessions.ts` 中的 `loadSessionEntry` 和 `updateSessionStore`。
*   **优势**: 与 OpenClaw 的 TUI、WebUI 共享同一个会话数据库，状态实时同步。

### 4) 废除配置硬编码
*   **替代品**: 直接调用 `config/config.ts` 中的 `loadConfig()`。
*   **优势**: 自动读取用户在 `~/.openclaw/openclaw.json` 中的所有设置（如 API Key、模型偏好、工作目录等）。

### 5) 废除自定义上传管理
*   **替代品**: 直接将文件写入 `loadConfig().agents.defaults.workspace`。
*   **优势**: Agent 会自动在工作空间中发现这些文件并进行后续处理。

## 5. 安装插件

在 OpenClaw 运行环境中，使用以下命令安装本地开发的插件：

```bash
# 进入 OpenClaw 根目录执行
openclaw plugins install /绝对路径/to/viewclaw/server
```

## 6. 迁移建议

1.  **历史记录**: 继续保留读取 `.jsonl` 的逻辑，仅用于**初次加载历史记录**。
2.  **实时更新**: 彻底废除 `jsonl-watcher.ts`，全量转向 `onAgentEvent`。
3.  **深度集成**: 充分利用 `loadConfig()` 获取全局变量，避免在插件中二次硬编码端口和路径。
