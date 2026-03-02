# ClawFlow: OpenClaw Mobile Agent Console

ClawFlow is a high-performance mobile monitoring and chat application for **OpenClaw** AI agents. It follows a "Glass-box Execution" philosophy, allowing users to see the agent's internal thoughts, tool calls, and execution logs in real-time.

## Project Architecture

The project is structured as a monorepo using **Bun** workspaces:

- **`/server` (Gateway):** A stateless Bun/Elysia application that bridges the mobile client and the OpenClaw instance.
  - **WebSocket Gateway:** Provides real-time event streaming (`/stream`).
  - **Log Watcher:** Tails structured JSONL logs from the OpenClaw filesystem for live execution monitoring.
  - **API Proxy:** Forwards commands to OpenClaw's internal REST API and handles image/audio processing.
- **`/mobile` (Client):** An Expo/React Native application built with **Tamagui**.
  - **Real-time Stream:** Handles high-frequency log updates using a buffered rendering strategy to ensure UI responsiveness.
  - **Local-First:** Designed to store session history and logs locally (SQLite/MMKV).
  - **Rich UI:** Features Markdown rendering, voice transcription, and interactive execution traces.

## Tech Stack

- **Backend:** [Bun](https://bun.sh/), [ElysiaJS](https://elysiajs.com/), WebSocket.
- **Frontend:** [Expo](https://expo.dev/), [React Native](https://reactnative.dev/), [Tamagui](https://tamagui.dev/) (UI System), [Lucide Icons](https://lucide.dev/).
- **Data Persistence:** SQLite and MMKV on mobile.
- **External Integrations:** Whisper API for voice-to-text.

## Development Guide

### Prerequisites
- **Bun** (required for both server and workspace management).
- **Expo CLI** (for mobile development).
- A running **OpenClaw** instance accessible to the server.

### Key Commands
- `bun run dev`: Starts both the server (watch mode) and mobile (expo start) in parallel.
- `bun run dev:server`: Starts only the Elysia gateway.
- `bun run dev:mobile`: Starts only the Expo development server.

### Environment & Configuration
- **Server:** Configuration is managed in `server/src/config.ts`. It requires `OPENCLAW_HOME` (path to agent logs) and `OPENCLAW_BASE_URL`.
- **Mobile:** Connects to the server via WebSocket. Default development URL is `ws://127.0.0.1:3000`.

## Development Conventions

- **Real-time Performance:** When modifying the mobile chat stream, always use the buffering mechanism in `useGatewaySession` to avoid UI jank from high-frequency log events.
- **Local-First Data:** New features should prioritize local persistence of chat and execution data to ensure privacy and offline access.
- **Shared Schemas:** The server and mobile share event types (defined in `server/src/types.ts` and `mobile/src/types/gateway.ts`). Ensure synchronization when updating the protocol.
- **Design System:** Use Tamagui tokens for all styling to maintain consistency and support themes (light/dark).
