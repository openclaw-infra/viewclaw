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

## 5. 本地实时开发 (Live Development)

当你作为 OpenClaw 插件开发时，目标是实现：**修改源码 -> 自动重载 -> 客户端实时感知**。

### 推荐工作流：
1.  **软链接插件**: 
    不要每次都执行 `install`。在 OpenClaw 的 `extensions` 目录中建立指向你 `viewclaw/server` 的软链接：
    ```bash
    ln -s /Users/bigo/viewclaw/server ~/.openclaw/extensions/viewclaw
    ```
2.  **启动 OpenClaw 开发模式**:
    OpenClaw 支持 `--dev` 模式，它会隔离配置并监听插件变动：
    ```bash
    openclaw --dev gateway
    ```
3.  **使用 Bun Watch**:
    在另一个终端保持源码监听：
    ```bash
    # 在 viewclaw/server 目录下
    bun run dev
    ```

## 6. 客户端连接 (Client Connectivity)

### 1) 获取局域网 IP
手机和电脑需在同一 Wi-Fi 下。获取电脑 IP（如 `192.168.1.5`）。

### 2) 修改连接地址
在移动端 App 设置中配置 **Gateway URL**:
*   **WebSocket**: `ws://192.168.1.5:3000/stream`
*   **HTTP**: `http://192.168.1.5:3000`

## 7. 迁移建议

1.  **历史记录**: 继续保留读取 `.jsonl` 的逻辑，仅用于**初次加载历史记录**。
2.  **实时更新**: 彻底废除 `jsonl-watcher.ts`，全量转向 `onAgentEvent`。
3.  **深度集成**: 充分利用 `loadConfig()` 获取全局变量，避免在插件中二次硬编码端口和路径。
