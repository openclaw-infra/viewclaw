import AsyncStorage from "@react-native-async-storage/async-storage";
import type { GatewayConfig } from "../types/gateway";

const KEYS = {
  gateways: "@clawflow/gateways",
  activeId: "@clawflow/active-gateway-id",
  legacyGateways: "@viewclaw/gateways",
  legacyActiveId: "@viewclaw/active-gateway-id",
} as const;

const DEFAULT_GATEWAY: GatewayConfig = {
  id: "default-local",
  label: "Local",
  url: "ws://127.0.0.1:3000",
  createdAt: 0,
};

let cachedGateways: GatewayConfig[] | null = null;
let cachedActiveId: string | null = null;

export const gatewayStorage = {
  async load() {
    let [rawGateways, rawActiveId] = await Promise.all([
      AsyncStorage.getItem(KEYS.gateways),
      AsyncStorage.getItem(KEYS.activeId),
    ]);

    if (!rawGateways) {
      const [legacyGw, legacyId] = await Promise.all([
        AsyncStorage.getItem(KEYS.legacyGateways),
        AsyncStorage.getItem(KEYS.legacyActiveId),
      ]);
      if (legacyGw) {
        rawGateways = legacyGw;
        rawActiveId = legacyId;
        await Promise.all([
          AsyncStorage.setItem(KEYS.gateways, legacyGw),
          legacyId ? AsyncStorage.setItem(KEYS.activeId, legacyId) : Promise.resolve(),
          AsyncStorage.removeItem(KEYS.legacyGateways),
          AsyncStorage.removeItem(KEYS.legacyActiveId),
        ]);
      }
    }

    if (rawGateways) {
      try {
        const parsed = JSON.parse(rawGateways) as GatewayConfig[];
        cachedGateways = parsed.length > 0 ? parsed : [DEFAULT_GATEWAY];
      } catch {
        cachedGateways = [DEFAULT_GATEWAY];
      }
    } else {
      cachedGateways = [DEFAULT_GATEWAY];
    }

    cachedActiveId = rawActiveId ?? DEFAULT_GATEWAY.id;
  },

  getAll(): GatewayConfig[] {
    return cachedGateways ?? [DEFAULT_GATEWAY];
  },

  getActiveId(): string {
    return cachedActiveId ?? DEFAULT_GATEWAY.id;
  },

  getActive(): GatewayConfig {
    const all = this.getAll();
    const activeId = this.getActiveId();
    return all.find((g) => g.id === activeId) ?? all[0] ?? DEFAULT_GATEWAY;
  },

  async save(gateways: GatewayConfig[]) {
    cachedGateways = gateways;
    await AsyncStorage.setItem(KEYS.gateways, JSON.stringify(gateways));
  },

  async setActiveId(id: string) {
    cachedActiveId = id;
    await AsyncStorage.setItem(KEYS.activeId, id);
  },

  async add(config: Omit<GatewayConfig, "id" | "createdAt">) {
    const all = this.getAll();
    const entry: GatewayConfig = {
      ...config,
      id: `gw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
    };
    all.push(entry);
    await this.save(all);
    return entry;
  },

  async update(id: string, patch: Partial<Pick<GatewayConfig, "label" | "url">>) {
    const all = this.getAll();
    const idx = all.findIndex((g) => g.id === id);
    if (idx === -1) return;
    all[idx] = { ...all[idx], ...patch };
    await this.save(all);
  },

  async remove(id: string) {
    if (id === DEFAULT_GATEWAY.id) return;
    let all = this.getAll().filter((g) => g.id !== id);
    if (all.length === 0) all = [DEFAULT_GATEWAY];
    await this.save(all);
    if (this.getActiveId() === id) {
      await this.setActiveId(all[0].id);
    }
  },
};
