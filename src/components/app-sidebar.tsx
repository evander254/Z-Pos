import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useId, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bell, ChevronDown, LogOut, Moon, Settings, Sun, WifiOff } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth } from "@/lib/auth-context";
import { useTenant } from "@/lib/tenant-context";
import { useOfflineMode } from "@/lib/offline-mode";
import { BUSINESS_TYPE_MAP } from "@/lib/business-types";
import { featurePath, getWorkspaceFeatureGroups } from "@/lib/feature-navigation";
import { getPackageLimits } from "@/lib/package-limits";
import { useTheme } from "@/lib/theme-context";

interface SidebarContentProps {
  slug: string;
  onClose?: () => void;
  showSignOut?: boolean;
}

function NotificationBell({
  businessId,
  slug,
  onClose,
}: {
  businessId: string;
  slug: string;
  onClose?: () => void;
}) {
  const [unreadCount, setUnreadCount] = useState(0);
  const nav = useNavigate();
  const channelId = useId();

  useEffect(() => {
    if (!businessId) return;
    let mounted = true;

    const fetchCount = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("business_id", businessId)
        .eq("is_read", false);
      if (mounted) setUnreadCount(count || 0);
    };
    fetchCount();

    const channel = supabase
      .channel(`notifications_changes:${businessId}:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `business_id=eq.${businessId}`,
        },
        () => {
          fetchCount();
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [businessId, channelId]);

  return (
    <button
      onClick={() => {
        onClose?.();
        nav({ to: `/t/${slug}/notifications` });
      }}
      className="relative p-2 rounded-md hover:bg-sidebar-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer ml-auto"
    >
      <Bell className="h-4 w-4" />
      {unreadCount > 0 && (
        <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
        </span>
      )}
    </button>
  );
}

export function SidebarContent({ slug, onClose, showSignOut = true }: SidebarContentProps) {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const { signOut, user } = useAuth();
  const { business, role, employee } = useTenant();
  const { online } = useOfflineMode();
  const { mode, setMode } = useTheme();
  const [openGroups, setOpenGroups] = useState<string[]>(["Core"]);
  const def = business
    ? BUSINESS_TYPE_MAP[business.business_type as keyof typeof BUSINESS_TYPE_MAP]
    : null;
  const packageLimits = getPackageLimits(business);

  const featureGroups = getWorkspaceFeatureGroups(business?.business_type);
  const items = featureGroups.map((group) => ({
    ...group,
    items: group.items.map((item) => ({
      ...item,
      to:
        item.path === ""
          ? `/t/${slug}`
          : item.path
            ? `/t/${slug}/${item.path}`
            : featurePath(slug, item.key),
      exact: item.key === "dashboard",
    })),
  }));

  const permissions = Array.isArray(employee?.permissions)
    ? (employee.permissions as string[])
    : [];
  const permissionGroups: Record<string, string[]> = {
    finance: ["profit_loss", "cash_flow", "expense_tracking", "petty_cash", "bank_reconciliation"],
    inventory: [
      "products",
      "stock_transfers",
      "purchase_orders",
      "supplier_management",
      "stock_takes",
      "damaged_stock",
      "returns_management",
    ],
    customers: [
      "customers",
      "loyalty_points",
      "customer_wallets",
      "membership_plans",
      "credit_accounts",
      "sms_whatsapp",
    ],
    employees: [
      "employees",
      "shift_management",
      "attendance",
      "commissions",
      "performance_reports",
      "cash_drawer",
    ],
  };
  const hasItemPermission = (key: string) => {
    if (key === "pos") return true;
    if (role === "owner" || permissions.length === 0) return true;
    return (
      permissions.includes(key) ||
      Object.entries(permissionGroups).some(
        ([groupKey, keys]) => permissions.includes(groupKey) && keys.includes(key),
      )
    );
  };

  const cashierItems = new Set(["Dashboard", "POS", "Customers"]);
  const filteredGroups =
    role !== "owner" && permissions.length > 0
      ? items
          .map((group) => ({
            ...group,
            items: group.items.filter((it) => hasItemPermission(it.key)),
          }))
          .filter((group) => group.items.length > 0)
      : role === "cashier"
        ? [
            ...items
              .map((group) => ({
                ...group,
                items: group.items.filter((it) => cashierItems.has(it.label)),
              }))
              .filter((group) => group.items.length > 0),
            {
              title: "Device",
              description: "Cashier device controls.",
              items: [
                {
                  key: "cashier-offline-mode",
                  label: "Offline Mode",
                  icon: WifiOff,
                  to: `/t/${slug}/offline-mode`,
                  exact: false,
                  premium: false,
                },
              ],
            },
          ]
        : items
            .map((group) => ({
              ...group,
              items: group.items.filter(
                (item) =>
                  packageLimits.analytics || !["insights", "sales_reports"].includes(item.key),
              ),
            }))
            .filter((group) => group.items.length > 0);

  const businessInitials = business?.business_name?.substring(0, 2).toUpperCase() || "ZP";
  const userInitials =
    user?.email?.substring(0, 2).toUpperCase() || role?.substring(0, 2).toUpperCase() || "OU";

  return (
    <div className="workspace-sidebar flex h-full flex-col overflow-hidden text-white">
      <div className="flex h-[5.5rem] shrink-0 items-center gap-3 border-b border-white/10 px-5">
        {business?.logo_url ? (
          <img
            src={business.logo_url}
            alt={business.business_name}
            className="workspace-sidebar-glow h-10 w-10 shrink-0 rounded-xl border border-white/35 object-cover"
          />
        ) : (
          <div className="workspace-sidebar-glow flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/35 bg-primary text-sm font-black text-primary-foreground">
            {businessInitials}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-bold leading-tight text-white">
            <span className="truncate">{business?.business_name || "ZPos"}</span>
            <span
              className={`relative inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${online ? "bg-emerald-400" : "bg-red-400"}`}
              title={online ? "Online" : "Offline"}
              aria-label={online ? "Online" : "Offline"}
            >
              <span
                className={`absolute inline-flex h-full w-full rounded-full opacity-70 animate-ping ${online ? "bg-emerald-300" : "bg-red-300"}`}
              />
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-white/75">
            <span className="truncate">{def?.label || "Loading..."}</span>
            <span className="rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-bold uppercase text-white ring-1 ring-white/20">
              {role || "Owner"}
            </span>
          </div>
        </div>
        {business && role !== "cashier" && (
          <NotificationBell businessId={business.id} slug={slug} onClose={onClose} />
        )}
      </div>
      <div className="px-4 pb-3 pt-4">
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-xs text-white/60 shadow-inner">
          <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
          <span className="truncate">Search menu...</span>
          <span className="ml-auto rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] text-white/45">
            ⌘K
          </span>
        </div>
      </div>
      <nav className="flex-1 space-y-3 overflow-y-auto px-3 pb-3">
        {filteredGroups.map((group) => {
          const groupActive = group.items.some((it) =>
            it.exact ? pathname === it.to : pathname.startsWith(it.to),
          );
          const open = openGroups.includes(group.title) || groupActive;

          return (
            <Collapsible
              key={group.title}
              open={open}
              onOpenChange={(nextOpen) => {
                setOpenGroups((current) =>
                  nextOpen
                    ? [...new Set([...current, group.title])]
                    : current.filter((title) => title !== group.title),
                );
              }}
            >
              <CollapsibleTrigger
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-black uppercase tracking-[0.12em] transition-colors cursor-pointer ${groupActive ? "text-white" : "text-white/70 hover:bg-white/5 hover:text-white"}`}
              >
                <span className="truncate">{group.title}</span>
                <ChevronDown
                  className={`ml-auto h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-1 space-y-1">
                {group.items.map((it) => {
                  const active = it.exact ? pathname === it.to : pathname.startsWith(it.to);
                  return (
                    <Link
                      key={`${group.title}-${it.key}`}
                      to={it.to}
                      onClick={() => onClose?.()}
                      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${active ? "bg-white/[0.14] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08),0_14px_30px_rgba(0,0,0,0.18)]" : "text-white/80 hover:bg-white/[0.08] hover:text-white"}`}
                    >
                      <it.icon
                        className={`h-4 w-4 shrink-0 ${active ? "text-white" : "text-white/70 group-hover:text-white"}`}
                      />
                      <span className="truncate">{it.label}</span>
                      {it.premium && (
                        <span className="ml-auto rounded-full bg-white/15 px-1.5 py-0.5 text-[9px] font-black text-white ring-1 ring-white/20">
                          AI
                        </span>
                      )}
                    </Link>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          );
        })}
        {(role !== "cashier" || permissions.includes("settings")) && (
          <Link
            to="/t/$slug/settings"
            params={{ slug }}
            onClick={() => onClose?.()}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${pathname.startsWith(`/t/${slug}/settings`) ? "bg-white/[0.14] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08),0_14px_30px_rgba(0,0,0,0.18)]" : "text-white/80 hover:bg-white/[0.08] hover:text-white"}`}
          >
            <Settings className="h-4 w-4 text-white/70" /> Settings
          </Link>
        )}
      </nav>
      <div className="shrink-0 space-y-3 border-t border-white/10 bg-black/10 p-3">
        {role === "owner" && (
          <Link
            to="/t/$slug/package"
            params={{ slug }}
            onClick={() => onClose?.()}
            className="relative block overflow-hidden rounded-2xl border border-white/20 bg-white/[0.08] p-3 text-xs text-white shadow-[0_12px_36px_rgba(0,0,0,0.24)] hover:bg-white/[0.12]"
          >
            <img
              src={def?.imageUrl}
              alt={def?.label || "Business"}
              className="absolute inset-0 h-full w-full object-cover opacity-15"
            />
            <div className="relative flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10">
                {def && <def.icon className="h-5 w-5 text-white" />}
              </div>
              <div className="min-w-0">
                <div className="font-bold text-white">Business</div>
                <div className="truncate text-white/70">{packageLimits.name}</div>
              </div>
              <ChevronDown className="ml-auto h-4 w-4 text-white/60" />
            </div>
          </Link>
        )}
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/[0.18] p-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-black text-primary-foreground ring-1 ring-white/25">
            {userInitials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-white">
              {role === "cashier" ? "Cashier User" : "Owner User"}
            </div>
            <div className="truncate text-[11px] text-white/60">
              {user?.email || "Workspace user"}
            </div>
          </div>
          <button
            onClick={() => setMode(mode === "light" ? "dark" : "light")}
            className="rounded-lg p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
            title={`Switch to ${mode === "light" ? "dark" : "light"} mode`}
          >
            {mode === "light" ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
          </button>
        </div>
        {showSignOut && (
          <button
            onClick={() => {
              if (!window.confirm("Sign out of this workspace?")) return;
              onClose?.();
              signOut().then(() => nav({ to: "/" }));
            }}
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white cursor-pointer"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        )}
      </div>
    </div>
  );
}

export function AppSidebar({ slug }: { slug: string }) {
  return (
    <aside className="workspace-sidebar workspace-sidebar-border hidden md:flex flex-col w-[17.5rem] shrink-0 border-r h-screen sticky top-0">
      <SidebarContent slug={slug} />
    </aside>
  );
}
