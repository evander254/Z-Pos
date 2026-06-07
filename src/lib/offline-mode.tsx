/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getOfflineSalesCount, syncOfflineSales } from "@/lib/offline-sales";
import {
  queueOfflineRequest,
  readOfflineQueue,
  syncQueuedRequests,
  type QueuedOperation,
} from "@/lib/offline-fetch";

const OFFLINE_ENABLED_KEY = "zpos-offline-mode-enabled";

type OfflineModeContextValue = {
  enabled: boolean;
  online: boolean;
  pendingCount: number;
  setEnabled: (enabled: boolean) => void;
  queueOperation: (operation: Omit<QueuedOperation, "id" | "createdAt">) => void;
  syncNow: () => Promise<void>;
};

const OfflineModeContext = createContext<OfflineModeContextValue>({
  enabled: false,
  online: true,
  pendingCount: 0,
  setEnabled: () => {},
  queueOperation: () => {},
  syncNow: async () => {},
});

async function registerOfflineWorker() {
  if (!("serviceWorker" in navigator)) return;
  const isLocalDev =
    import.meta.env.DEV ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname.startsWith("192.168.");

  if (isLocalDev) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
    return;
  }

  await navigator.serviceWorker.register("/offline-sw.js");
}

export function OfflineModeProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    setEnabledState(localStorage.getItem(OFFLINE_ENABLED_KEY) !== "false");
    setOnline(navigator.onLine);
    setPendingCount(readOfflineQueue().length + getOfflineSalesCount());

    const updateOnline = () => setOnline(navigator.onLine);
    const updateQueue = () => setPendingCount(readOfflineQueue().length + getOfflineSalesCount());
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    window.addEventListener("zpos-offline-queue-change", updateQueue);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
      window.removeEventListener("zpos-offline-queue-change", updateQueue);
    };
  }, []);

  useEffect(() => {
    registerOfflineWorker().catch(console.warn);
  }, []);

  async function syncNow() {
    if (!navigator.onLine) return;
    await syncQueuedRequests();
    await syncOfflineSales();
    setPendingCount(readOfflineQueue().length + getOfflineSalesCount());
  }

  useEffect(() => {
    if (online) syncNow().catch(console.warn);
  }, [online]);

  const value = useMemo<OfflineModeContextValue>(
    () => ({
      enabled,
      online,
      pendingCount,
      setEnabled: (nextEnabled) => {
        localStorage.setItem(OFFLINE_ENABLED_KEY, String(nextEnabled));
        setEnabledState(nextEnabled);
      },
      queueOperation: (operation) => {
        queueOfflineRequest(operation);
      },
      syncNow,
    }),
    [enabled, online, pendingCount],
  );

  return <OfflineModeContext.Provider value={value}>{children}</OfflineModeContext.Provider>;
}

export function useOfflineMode() {
  return useContext(OfflineModeContext);
}
