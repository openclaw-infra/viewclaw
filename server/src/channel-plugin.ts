type ChannelAccount = {
  accountId: string;
  name?: string;
  enabled: boolean;
  token?: string;
  tokenSource?: string;
  config: {
    dmPolicy?: string;
    allowFrom?: string[];
    groupPolicy?: string;
    requireMention?: boolean;
    replyToMode?: "off" | "first" | "all";
  };
};

type GatewayState = {
  running: boolean;
  port: number;
  lastStartAt: number | null;
  lastStopAt: number | null;
  lastError: string | null;
};

type BuildParams = {
  getGatewayState: () => GatewayState;
  getLogger: () => {
    info: (msg: string) => void;
    warn: (msg: string) => void;
  } | null;
  notifyPairingApproved?: (params: { id: string; accountId?: string }) => Promise<void>;
  sendOutbound?: (params: {
    to: string;
    text: string;
    mediaUrl?: string;
    accountId?: string | null;
    replyToId?: string | null;
    threadId?: string | number | null;
  }) => Promise<{ id: string }>;
};

const CHANNEL_ID = "clawflow";
const DEFAULT_ACCOUNT_ID = "mobile";
const LEGACY_ACCOUNT_FIELDS = [
  "name",
  "enabled",
  "dmPolicy",
  "allowFrom",
  "groupPolicy",
  "requireMention",
  "replyToMode",
] as const;

const channelRoot = (cfg: any): Record<string, any> => cfg?.channels?.[CHANNEL_ID] ?? {};

const hasLegacyFields = (root: Record<string, any>): boolean =>
  LEGACY_ACCOUNT_FIELDS.some((key) => key in root);

const normalizeAccountsShape = (cfg: any): Record<string, any> => {
  const root = channelRoot(cfg);
  const accounts =
    root.accounts && typeof root.accounts === "object" ? { ...root.accounts } : {};
  if (!accounts[DEFAULT_ACCOUNT_ID] && hasLegacyFields(root)) {
    const migrated: Record<string, unknown> = {};
    for (const key of LEGACY_ACCOUNT_FIELDS) {
      if (key in root) migrated[key] = root[key];
    }
    accounts[DEFAULT_ACCOUNT_ID] = migrated;
  }
  return accounts;
};

const listAccountIds = (cfg: any): string[] => {
  const keys = Object.keys(normalizeAccountsShape(cfg)).filter((id) => id && id.trim());
  return keys.length > 0 ? keys : [DEFAULT_ACCOUNT_ID];
};

const cloneCfg = (cfg: any): any => ({ ...(cfg ?? {}) });

const updateChannelRoot = (cfg: any, nextRoot: Record<string, unknown>) => {
  const next = cloneCfg(cfg);
  next.channels = { ...(next.channels ?? {}), [CHANNEL_ID]: nextRoot };
  return next;
};

const resolveAccount = (cfg: any, accountId?: string | null): ChannelAccount => {
  const id = accountId?.trim() || DEFAULT_ACCOUNT_ID;
  const root = channelRoot(cfg);
  const accounts = normalizeAccountsShape(cfg);
  const accountConfig = accounts[id] ?? {};

  const enabled =
    typeof accountConfig.enabled === "boolean"
      ? accountConfig.enabled
      : typeof root.enabled === "boolean"
        ? root.enabled
        : true;

  const allowFromRaw = accountConfig.allowFrom ?? root.allowFrom ?? [];
  const allowFrom = Array.isArray(allowFromRaw)
    ? allowFromRaw.map((entry) => String(entry).trim()).filter(Boolean)
    : [];

  const dmPolicyRaw = accountConfig.dmPolicy ?? root.dmPolicy ?? "pairing";
  const dmPolicy = typeof dmPolicyRaw === "string" && dmPolicyRaw.trim() ? dmPolicyRaw : "pairing";

  const groupPolicyRaw = accountConfig.groupPolicy ?? root.groupPolicy ?? "allowlist";
  const groupPolicy =
    typeof groupPolicyRaw === "string" && groupPolicyRaw.trim() ? groupPolicyRaw : "allowlist";

  const requireMentionRaw = accountConfig.requireMention ?? root.requireMention;
  const requireMention = typeof requireMentionRaw === "boolean" ? requireMentionRaw : true;

  const replyToModeRaw = accountConfig.replyToMode ?? root.replyToMode;
  const replyToMode =
    replyToModeRaw === "off" || replyToModeRaw === "all" || replyToModeRaw === "first"
      ? replyToModeRaw
      : "first";

  return {
    accountId: id,
    name: typeof accountConfig.name === "string" ? accountConfig.name : undefined,
    enabled,
    // ClawFlow does not need channel-level bot tokens; mark runtime-bound.
    token: "runtime-managed",
    tokenSource: "runtime",
    config: {
      dmPolicy,
      allowFrom,
      groupPolicy,
      requireMention,
      replyToMode,
    },
  };
};

const listDirectoryPeers = (cfg: any, accountId?: string | null) => {
  const account = resolveAccount(cfg, accountId);
  const root = channelRoot(cfg);
  const fromAllowFrom = (account.config.allowFrom ?? []).map((id) => ({
    kind: "user",
    id,
    name: id,
  }));
  const fromDirectory = Array.isArray(root.directory?.peers)
    ? root.directory.peers
        .filter((entry: any) => entry && typeof entry.id === "string")
        .map((entry: any) => ({
          kind: "user",
          id: String(entry.id),
          name: typeof entry.name === "string" ? entry.name : String(entry.id),
          handle: typeof entry.handle === "string" ? entry.handle : undefined,
        }))
    : [];
  const merged = new Map<string, { kind: "user"; id: string; name?: string; handle?: string }>();
  for (const peer of [...fromAllowFrom, ...fromDirectory]) {
    merged.set(peer.id, peer);
  }
  return [...merged.values()];
};

const listDirectoryGroups = (cfg: any) => {
  const root = channelRoot(cfg);
  if (!Array.isArray(root.directory?.groups)) return [];
  return root.directory.groups
    .filter((entry: any) => entry && typeof entry.id === "string")
    .map((entry: any) => ({
      kind: "group",
      id: String(entry.id),
      name: typeof entry.name === "string" ? entry.name : String(entry.id),
      handle: typeof entry.handle === "string" ? entry.handle : undefined,
    }));
};

export const buildClawflowChannelPlugin = ({
  getGatewayState,
  getLogger,
  notifyPairingApproved,
  sendOutbound,
}: BuildParams) => ({
  id: CHANNEL_ID,
  meta: {
    id: CHANNEL_ID,
    label: "ClawFlow",
    selectionLabel: "ClawFlow",
    docsPath: "/channels/clawflow",
    blurb: "Mobile companion channel backed by ClawFlow gateway bridge.",
    quickstartAllowFrom: true,
  },
  capabilities: {
    chatTypes: ["direct", "group", "thread"],
    media: true,
    threads: true,
    nativeCommands: true,
    blockStreaming: true,
  },
  reload: { configPrefixes: ["channels.clawflow"] },
  pairing: {
    idLabel: "clawflowSenderId",
    normalizeAllowEntry: (entry: string) => entry.trim(),
    notifyApproval: async ({ id, runtime }: { id: string; runtime?: any }) => {
      const logger = getLogger();
      logger?.info(`[clawflow] pairing approved for sender=${id}`);
      await notifyPairingApproved?.({ id });
      await runtime?.channel?.announce?.sendSystemMessage?.({
        channel: CHANNEL_ID,
        target: id,
        text: "Pairing approved. You can continue in ClawFlow.",
      });
    },
  },
  configSchema: {
    schema: {
      type: "object",
      properties: {
        enabled: { type: "boolean" },
        dmPolicy: { type: "string", enum: ["pairing", "open", "allowlist"] },
        allowFrom: { type: "array", items: { type: "string" } },
        groupPolicy: { type: "string", enum: ["allowlist", "open"] },
        requireMention: { type: "boolean" },
        replyToMode: { type: "string", enum: ["off", "first", "all"] },
        accounts: {
          type: "object",
          additionalProperties: {
            type: "object",
            properties: {
              name: { type: "string" },
              enabled: { type: "boolean" },
              dmPolicy: { type: "string", enum: ["pairing", "open", "allowlist"] },
              allowFrom: { type: "array", items: { type: "string" } },
              groupPolicy: { type: "string", enum: ["allowlist", "open"] },
              requireMention: { type: "boolean" },
              replyToMode: { type: "string", enum: ["off", "first", "all"] },
            },
          },
        },
      },
    },
    uiHints: {
      enabled: {
        label: "Enable ClawFlow Channel",
      },
      dmPolicy: {
        label: "DM Policy",
        help: "pairing/open/allowlist",
      },
      allowFrom: {
        label: "Allow From",
        help: "Allowed sender IDs when policy uses allowlist.",
      },
      groupPolicy: {
        label: "Group Policy",
      },
      requireMention: {
        label: "Require Mention",
      },
      replyToMode: {
        label: "Reply To Mode",
      },
    },
  },
  config: {
    listAccountIds: (cfg: any) => listAccountIds(cfg),
    resolveAccount: (cfg: any, accountId?: string | null) => resolveAccount(cfg, accountId),
    defaultAccountId: () => DEFAULT_ACCOUNT_ID,
    setAccountEnabled: ({ cfg, accountId, enabled }: { cfg: any; accountId: string; enabled: boolean }) => {
      const root = channelRoot(cfg);
      if (accountId === DEFAULT_ACCOUNT_ID) {
        const accounts = normalizeAccountsShape(cfg);
        return updateChannelRoot(cfg, {
          ...root,
          accounts: {
            ...accounts,
            [DEFAULT_ACCOUNT_ID]: {
              ...(accounts[DEFAULT_ACCOUNT_ID] ?? {}),
              enabled,
            },
          },
        });
      }
      const accounts = normalizeAccountsShape(cfg);
      accounts[accountId] = { ...(accounts[accountId] ?? {}), enabled };
      return updateChannelRoot(cfg, { ...root, accounts });
    },
    deleteAccount: ({ cfg, accountId }: { cfg: any; accountId: string }) => {
      if (accountId === DEFAULT_ACCOUNT_ID) {
        const root = { ...channelRoot(cfg) };
        delete (root as any).enabled;
        delete (root as any).name;
        return updateChannelRoot(cfg, root);
      }
      const root = { ...channelRoot(cfg) };
      const accounts = { ...(root.accounts ?? {}) };
      if (Object.keys(accounts).length === 0) {
        Object.assign(accounts, normalizeAccountsShape(cfg));
      }
      delete accounts[accountId];
      if (Object.keys(accounts).length > 0) root.accounts = accounts;
      else delete root.accounts;
      return updateChannelRoot(cfg, root);
    },
    isConfigured: () => true,
    describeAccount: (account: ChannelAccount) => ({
      accountId: account.accountId,
      name: account.name,
      enabled: account.enabled,
      configured: true,
      tokenSource: account.tokenSource ?? "runtime",
    }),
    resolveAllowFrom: ({ cfg, accountId }: { cfg: any; accountId?: string | null }) =>
      resolveAccount(cfg, accountId).config.allowFrom,
    formatAllowFrom: ({ allowFrom }: { allowFrom: Array<string | number> }) =>
      allowFrom
        .map((entry) => String(entry).trim())
        .filter(Boolean),
  },
  security: {
    resolveDmPolicy: ({ cfg, accountId, account }: { cfg: any; accountId?: string | null; account: ChannelAccount }) => {
      const id = accountId ?? account.accountId ?? DEFAULT_ACCOUNT_ID;
      const hasAccountPath = Boolean(cfg?.channels?.clawflow?.accounts?.[id]);
      const basePath = hasAccountPath ? `channels.clawflow.accounts.${id}.` : "channels.clawflow.";
      return {
        policy: account.config.dmPolicy ?? "pairing",
        allowFrom: account.config.allowFrom ?? [],
        policyPath: `${basePath}dmPolicy`,
        allowFromPath: `${basePath}allowFrom`,
        approveHint: "Run `openclaw pairing approve clawflow <id>` to approve this sender.",
        normalizeEntry: (raw: string) => raw.trim(),
      };
    },
    collectWarnings: ({ account }: { account: ChannelAccount }) => {
      const warnings: string[] = [];
      if (account.config.dmPolicy === "open") {
        warnings.push(
          `- ClawFlow DM policy is "open"; any sender may trigger replies. Consider dmPolicy="pairing" or allowlist.`,
        );
      }
      if (account.config.dmPolicy === "allowlist" && (account.config.allowFrom?.length ?? 0) === 0) {
        warnings.push(
          `- ClawFlow DM policy is "allowlist" but allowFrom is empty; no sender can trigger until allowFrom entries are configured.`,
        );
      }
      if (account.config.groupPolicy === "open" && account.config.requireMention === false) {
        warnings.push(
          `- ClawFlow groupPolicy is "open" and requireMention=false; group conversations may trigger unexpectedly.`,
        );
      } else if (account.config.groupPolicy === "open") {
        warnings.push(
          `- ClawFlow groupPolicy is "open"; any group member may trigger when mention rules pass.`,
        );
      }
      return warnings;
    },
  },
  groups: {
    resolveRequireMention: ({ cfg, accountId }: { cfg: any; accountId?: string | null }) =>
      resolveAccount(cfg, accountId).config.requireMention ?? true,
    resolveToolPolicy: ({ cfg, accountId }: { cfg: any; accountId?: string | null }) => {
      const policy = resolveAccount(cfg, accountId).config.groupPolicy ?? "allowlist";
      return { mode: policy };
    },
  },
  threading: {
    resolveReplyToMode: ({ cfg, accountId }: { cfg: any; accountId?: string | null }) =>
      resolveAccount(cfg, accountId).config.replyToMode ?? "first",
  },
  messaging: {
    normalizeTarget: (raw: string) => raw.trim(),
    targetResolver: {
      looksLikeId: (raw: string) => raw.trim().length > 0,
      hint: "<sessionId|senderId>",
    },
  },
  directory: {
    self: async ({ accountId }: { accountId?: string | null }) => ({
      kind: "user",
      id: accountId?.trim() || DEFAULT_ACCOUNT_ID,
      name: "ClawFlow Mobile",
    }),
    listPeers: async ({ cfg, accountId }: { cfg: any; accountId?: string | null }) =>
      listDirectoryPeers(cfg, accountId),
    listGroups: async ({ cfg }: { cfg: any }) => listDirectoryGroups(cfg),
  },
  resolver: {
    resolveTargets: async ({
      cfg,
      accountId,
      inputs,
      kind,
    }: {
      cfg: any;
      accountId?: string | null;
      inputs: string[];
      kind: "user" | "group";
    }) => {
      const peerSet = new Set(listDirectoryPeers(cfg, accountId).map((entry: any) => entry.id));
      const groupSet = new Set(listDirectoryGroups(cfg).map((entry: any) => entry.id));
      return inputs.map((input) => {
        const normalized = input.trim();
        if (!normalized) {
          return { input, resolved: false, note: "empty target" };
        }
        if (kind === "group") {
          const resolved = groupSet.has(normalized) || normalized.startsWith("group:");
          return {
            input,
            resolved,
            id: resolved ? normalized : undefined,
            note: resolved ? undefined : "group not found in directory",
          };
        }
        const resolved = peerSet.has(normalized) || normalized.startsWith("user:");
        return {
          input,
          resolved,
          id: resolved ? normalized : undefined,
          note: resolved ? undefined : "peer not found in directory",
        };
      });
    },
  },
  outbound: {
    deliveryMode: "direct",
    chunker: null,
    textChunkLimit: 4000,
    sendText: async ({
      to,
      text,
      accountId,
      replyToId,
      threadId,
    }: {
      to: string;
      text: string;
      accountId?: string | null;
      replyToId?: string | null;
      threadId?: string | number | null;
    }) => {
      const id = randomUUID();
      if (typeof sendOutbound === "function") {
        const sent = await sendOutbound({ to, text, accountId, replyToId, threadId });
        return { ok: true, channel: CHANNEL_ID, id: sent.id, to };
      }
      return { ok: true, channel: CHANNEL_ID, id, to };
    },
    sendMedia: async ({
      to,
      text,
      mediaUrl,
      accountId,
      replyToId,
      threadId,
    }: {
      to: string;
      text: string;
      mediaUrl?: string;
      accountId?: string | null;
      replyToId?: string | null;
      threadId?: string | number | null;
    }) => {
      const id = randomUUID();
      if (typeof sendOutbound === "function") {
        const sent = await sendOutbound({ to, text, mediaUrl, accountId, replyToId, threadId });
        return { ok: true, channel: CHANNEL_ID, id: sent.id, to };
      }
      return { ok: true, channel: CHANNEL_ID, id, to };
    },
  },
  gateway: {
    startAccount: async ({ account }: { account: ChannelAccount }) => {
      const logger = getLogger();
      logger?.info(`[clawflow] [${account.accountId}] channel gateway start delegated to service runtime`);
    },
    stopAccount: async ({ account }: { account: ChannelAccount }) => {
      const logger = getLogger();
      logger?.info(`[clawflow] [${account.accountId}] channel gateway stop delegated to service runtime`);
    },
  },
  status: {
    defaultRuntime: {
      accountId: DEFAULT_ACCOUNT_ID,
      running: false,
      lastStartAt: null,
      lastStopAt: null,
      lastError: null,
    },
    buildChannelSummary: ({ snapshot }: { snapshot: any }) => ({
      configured: true,
      running: Boolean(snapshot.running),
      port: snapshot.port ?? null,
      lastStartAt: snapshot.lastStartAt ?? null,
      lastStopAt: snapshot.lastStopAt ?? null,
      lastError: snapshot.lastError ?? null,
    }),
    probeAccount: async ({ account }: { account: ChannelAccount }) => {
      const gateway = getGatewayState();
      return {
        ok: gateway.running,
        accountId: account.accountId,
        running: gateway.running,
        port: gateway.port,
        lastError: gateway.lastError,
      };
    },
    auditAccount: async ({ account, probe }: { account: ChannelAccount; probe?: any }) => {
      const issues: string[] = [];
      if (!probe?.running) {
        issues.push("gateway_not_running");
      }
      if (account.config.dmPolicy === "allowlist" && (account.config.allowFrom?.length ?? 0) === 0) {
        issues.push("allowlist_empty");
      }
      if (account.config.groupPolicy === "open" && account.config.requireMention === false) {
        issues.push("group_policy_too_open");
      }
      return {
        ok: issues.length === 0,
        issues,
        checkedAt: Date.now(),
      };
    },
    buildAccountSnapshot: ({ account }: { account: ChannelAccount }) => {
      const gateway = getGatewayState();
      return {
        accountId: account.accountId,
        name: account.name,
        enabled: account.enabled,
        configured: true,
        tokenSource: account.tokenSource ?? "runtime",
        running: gateway.running,
        port: gateway.port,
        lastStartAt: gateway.lastStartAt,
        lastStopAt: gateway.lastStopAt,
        lastError: gateway.lastError,
      };
    },
    collectStatusIssues: (accounts: Array<Record<string, any>>) =>
      accounts.flatMap((account) => {
        const issues: Array<{
          channel: string;
          accountId: string;
          kind: "intent" | "permissions" | "config" | "auth" | "runtime";
          message: string;
          fix?: string;
        }> = [];
        if (!account.running) {
          issues.push({
            channel: CHANNEL_ID,
            accountId: account.accountId ?? DEFAULT_ACCOUNT_ID,
            kind: "runtime",
            message: "ClawFlow gateway process is not running.",
            fix: "Start or restart the clawflow-gateway service.",
          });
        }
        if (account.lastError) {
          issues.push({
            channel: CHANNEL_ID,
            accountId: account.accountId ?? DEFAULT_ACCOUNT_ID,
            kind: "runtime",
            message: `Last runtime error: ${account.lastError}`,
          });
        }
        return issues;
      }),
  },
  setup: {
    resolveAccountId: ({ accountId }: { accountId?: string }) => (accountId?.trim() || DEFAULT_ACCOUNT_ID),
    applyAccountName: ({ cfg, accountId, name }: { cfg: any; accountId: string; name?: string }) => {
      if (!name?.trim()) return cfg;
      const root = channelRoot(cfg);
      const accounts = normalizeAccountsShape(cfg);
      accounts[accountId] = { ...(accounts[accountId] ?? {}), name: name.trim() };
      return updateChannelRoot(cfg, { ...root, accounts });
    },
    applyAccountConfig: ({ cfg, accountId, input }: { cfg: any; accountId: string; input: any }) => {
      const root = channelRoot(cfg);
      const accounts = normalizeAccountsShape(cfg);
      const base = {
        enabled: true,
        ...(input?.name ? { name: String(input.name).trim() } : {}),
      };
      accounts[accountId] = { ...(accounts[accountId] ?? {}), ...base };
      return updateChannelRoot(cfg, { ...root, enabled: true, accounts });
    },
    validateInput: () => null,
  },
});
import { randomUUID } from "node:crypto";
