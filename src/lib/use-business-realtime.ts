import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

type RealtimeTable = string;

export function useBusinessRealtime(
  businessId: string | undefined,
  tables: RealtimeTable[],
  onChange: () => void,
  debounceMs = 250,
) {
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!businessId || !tables.length) return;

    let reloadTimer: number | undefined;
    const channel = supabase.channel(`business-realtime:${businessId}:${tables.join("-")}`);

    const scheduleReload = () => {
      if (reloadTimer) window.clearTimeout(reloadTimer);
      reloadTimer = window.setTimeout(() => onChangeRef.current(), debounceMs);
    };

    tables.forEach((table) => {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `business_id=eq.${businessId}`,
        },
        scheduleReload,
      );
    });

    channel.subscribe();

    return () => {
      if (reloadTimer) window.clearTimeout(reloadTimer);
      supabase.removeChannel(channel);
    };
  }, [businessId, debounceMs, tables.join("|")]);
}
