import { createFileRoute } from "@tanstack/react-router";
import { WifiOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOfflineMode } from "@/lib/offline-mode";
import { useTenant } from "@/lib/tenant-context";

export const Route = createFileRoute("/t/$slug/offline-mode")({ component: OfflineModePage });

function OfflineModePage() {
  const { business } = useTenant();
  const offlineMode = useOfflineMode();

  return (
    <div className="w-full p-4 md:p-8 space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-6 md:p-8 shadow-sm">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-primary/20 via-emerald-500/10 to-transparent" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <WifiOff className="h-3.5 w-3.5" /> Offline continuity
          </div>
          <h1 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight">Offline Mode</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
            Keep this device ready for internet outages. Visited pages and recent workspace data are
            saved locally, changes are queued while offline, and everything syncs when the
            connection returns.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold">This device</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {business?.business_name || "Workspace"} · Browser is{" "}
              {offlineMode.online ? "online" : "offline"}
            </div>
          </div>
          <button
            type="button"
            onClick={() => offlineMode.setEnabled(!offlineMode.enabled)}
            className={`relative h-8 w-14 rounded-full transition-colors ${offlineMode.enabled ? "bg-primary" : "bg-muted"}`}
            aria-label="Toggle offline mode"
          >
            <span
              className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${offlineMode.enabled ? "translate-x-7" : "translate-x-1"}`}
            />
          </button>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <StatusCard
            label="Offline readiness"
            value={offlineMode.enabled ? "Enabled" : "Disabled"}
          />
          <StatusCard label="Connection" value={offlineMode.online ? "Online" : "Offline"} />
          <StatusCard label="Waiting to sync" value={String(offlineMode.pendingCount)} />
        </div>

        <Button
          type="button"
          onClick={() => offlineMode.syncNow()}
          disabled={!offlineMode.online || offlineMode.pendingCount === 0}
          className="gap-2 gradient-violet text-white border-0"
        >
          <RefreshCw className="h-4 w-4" /> Sync queued items now
        </Button>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="text-sm font-semibold">How it works</div>
        <div className="mt-4 space-y-3 text-sm text-muted-foreground">
          {[
            "Open important pages while online once so their app shell and assets are cached on this device.",
            "Recent workspace reads are reused offline so pages can still show the latest cached data.",
            "Offline sales and common workspace changes are saved on this browser and sync automatically when online.",
          ].map((item) => (
            <div key={item} className="flex gap-3">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/50 p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-2 text-lg font-semibold">{value}</div>
    </div>
  );
}
