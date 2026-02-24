import { useEffect } from 'react';

export function usePolling(fn, deps, intervalMs) {
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!cancelled) await fn();
    };
    run();
    const timer = setInterval(run, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, deps);
}
