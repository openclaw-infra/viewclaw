# P7 Metadata Alignment (Discord / Telegram Reference)

## Goal

Align ClawFlow inbound/outbound metadata semantics with OpenClaw Discord/Telegram plugins while keeping untrusted metadata invisible to end users.

## Field Mapping Baseline

### Core identity/session fields

| Field | Discord/Telegram usage | ClawFlow current | Priority |
|---|---|---|---|
| `Provider` / `Surface` | channel identity for routing and policies | present (`clawflow` bridge runtime) | P0 |
| `AccountId` | multi-account route binding | present (channel plugin + runtime context) | P0 |
| `SessionKey` | per-thread/per-peer context isolation | present | P0 |
| `ConversationLabel` | human-readable conversation title | partial (not consistently set in runtime adapter) | P1 |
| `SenderName` / `SenderId` / `SenderUsername` | sender identity and mention logic | partial (`mobile` defaults) | P1 |

### Reply/thread fields

| Field | Discord/Telegram usage | ClawFlow current | Priority |
|---|---|---|---|
| `ReplyToId` | reply specific message | missing in client/server payload chain | P0 |
| `ReplyToBody` | quoted source for model context | missing | P1 |
| `ReplyToSender` | sender attribution for quoted source | missing | P1 |
| `MessageThreadId` | topic/thread routing | missing in send path | P0 |
| `ThreadLabel` / `ThreadStarterBody` | first-thread contextual framing | missing | P2 |

### Security metadata fields

| Field | Discord/Telegram usage | ClawFlow current | Priority |
|---|---|---|---|
| `UntrustedContext` | channel metadata/topic as untrusted content | missing in ClawFlow runtime adapter | P0 |
| `GroupSubject` / `GroupChannel` / `GroupSpace` | group semantics + policy scope | mostly missing | P2 |
| `CommandAuthorized` | command safety path | present in runtime adapter defaults | P1 |

## Output Isolation Rule

Untrusted metadata is allowed in model context, but must never be rendered to end users.

1. Keep metadata in `UntrustedContext` (model-visible).
2. Strip known untrusted metadata blocks at UI render boundary.
3. Apply the same cleanup to streamed and final assistant content.

## Execution Order

1. Transport: add `replyToId/threadId` to WS + HTTP + bridge payloads.
2. Runtime: map transport fields into `handleInboundMessage` / dispatcher context.
3. UI safety: strip untrusted metadata display blocks.
4. UI feature: expose reply-to-message id/thread id from message actions.

