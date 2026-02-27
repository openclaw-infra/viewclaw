import { useCallback, useEffect, useRef, useState } from "react";
import type { SessionContext } from "../types/gateway";

type Options = {
  sessionId: string;
  httpUrl: string;
  agentId?: string;
};

export const useSessionContext = ({ sessionId, httpUrl, agentId = "main" }: Options) => {
  const [context, setContext] = useState<SessionContext | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchContext = useCallback(async () => {
    if (!sessionId || !httpUrl) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const res = await fetch(
        `${httpUrl}/api/sessions/${sessionId}/context?agentId=${agentId}`,
        { signal: controller.signal },
      );
      const data = await res.json();
      if (data.ok && data.context) {
        setContext(data.context);
      }
    } catch {
      /* network error or aborted */
    } finally {
      setLoading(false);
    }
  }, [sessionId, httpUrl, agentId]);

  useEffect(() => {
    fetchContext();
    return () => abortRef.current?.abort();
  }, [fetchContext]);

  return { context, loading, refresh: fetchContext };
};
