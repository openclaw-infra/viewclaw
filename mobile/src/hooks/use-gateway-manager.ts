import { useCallback, useEffect, useMemo, useState } from "react";
import type { GatewayConfig } from "../types/gateway";
import { gatewayStorage } from "../data/gateway-storage";

export const useGatewayManager = () => {
  const [gateways, setGateways] = useState<GatewayConfig[]>(() => gatewayStorage.getAll());
  const [activeId, setActiveId] = useState<string>(() => gatewayStorage.getActiveId());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    gatewayStorage.load().then(() => {
      setGateways(gatewayStorage.getAll());
      setActiveId(gatewayStorage.getActiveId());
      setLoaded(true);
    });
  }, []);

  const activeGateway = useMemo(
    () => gateways.find((g) => g.id === activeId) ?? gateways[0],
    [gateways, activeId],
  );

  const wsUrl = activeGateway?.url ?? "ws://127.0.0.1:3000";
  const httpUrl = wsUrl.replace(/^ws(s?)/, "http$1");

  const switchGateway = useCallback((id: string) => {
    setActiveId(id);
    gatewayStorage.setActiveId(id);
  }, []);

  const addGateway = useCallback(async (config: { label: string; url: string }) => {
    const entry = await gatewayStorage.add(config);
    setGateways(gatewayStorage.getAll());
    return entry;
  }, []);

  const updateGateway = useCallback(
    async (id: string, patch: Partial<Pick<GatewayConfig, "label" | "url">>) => {
      await gatewayStorage.update(id, patch);
      setGateways(gatewayStorage.getAll());
    },
    [],
  );

  const removeGateway = useCallback(async (id: string) => {
    await gatewayStorage.remove(id);
    setGateways(gatewayStorage.getAll());
    setActiveId(gatewayStorage.getActiveId());
  }, []);

  return useMemo(
    () => ({
      gateways,
      activeId,
      activeGateway,
      wsUrl,
      httpUrl,
      loaded,
      switchGateway,
      addGateway,
      updateGateway,
      removeGateway,
    }),
    [gateways, activeId, activeGateway, wsUrl, httpUrl, loaded, switchGateway, addGateway, updateGateway, removeGateway],
  );
};
