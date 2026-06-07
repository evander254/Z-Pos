import { createFileRoute, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { TenantProvider, useTenant } from "@/lib/tenant-context";
import { useOfflineMode } from "@/lib/offline-mode";
import { getPackageLimits } from "@/lib/package-limits";
import { AppSidebar, SidebarContent } from "@/components/app-sidebar";
import { Menu, X } from "lucide-react";
import workplaceLogo from "../../logo.png?url";

export const Route = createFileRoute("/t/$slug")({ component: TenantLayout });

function TenantLayout() {
  const { slug } = Route.useParams();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth/login" });
  }, [loading, user, nav]);

  return (
    <TenantProvider slug={slug}>
      <Shell slug={slug} />
    </TenantProvider>
  );
}

function Shell({ slug }: { slug: string }) {
  const { business, role, employee, loading } = useTenant();
  const { online } = useOfflineMode();
  const [mobileOpen, setMobileOpen] = useState(false);
  const splashKey = `zpos-workspace-splash-shown:${slug}`;
  const [showSplash, setShowSplash] = useState(
    () => typeof window !== "undefined" && sessionStorage.getItem(splashKey) !== "true",
  );
  const nav = useNavigate();
  const { pathname } = useLocation();
  const packageLimits = getPackageLimits(business);

  useEffect(() => {
    if (!showSplash) return;
    const timer = window.setTimeout(() => setShowSplash(false), 4000);
    return () => window.clearTimeout(timer);
  }, [showSplash]);

  useEffect(() => {
    if (!showSplash) sessionStorage.setItem(splashKey, "true");
  }, [showSplash, splashKey]);

  // Cashiers get a focused workspace: dashboard, POS, and customer loyalty lookup.
  useEffect(() => {
    if (loading || !business) return;
    if (!packageLimits.analytics && pathname === `/t/${slug}/insights`) {
      nav({ to: `/t/${slug}` });
    }
  }, [business, loading, nav, packageLimits.analytics, pathname, slug]);

  useEffect(() => {
    if (loading || !role) return;
    const permissions = Array.isArray(employee?.permissions)
      ? (employee.permissions as string[])
      : [];
    if (role !== "owner" && permissions.length > 0) {
      const allowedPaths = new Set([`/t/${slug}`, `/t/${slug}/pos`]);
      const allowedFeatureKeys = new Set<string>();
      const permissionGroups: Record<string, string[]> = {
        finance: [
          "profit_loss",
          "cash_flow",
          "expense_tracking",
          "petty_cash",
          "bank_reconciliation",
        ],
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
      const addPath = (path: string) => allowedPaths.add(`/t/${slug}/${path}`);

      permissions.forEach((permission) => {
        allowedFeatureKeys.add(permission);
        permissionGroups[permission]?.forEach((key) => allowedFeatureKeys.add(key));
        if (permission === "dashboard") allowedPaths.add(`/t/${slug}`);
        if (permission === "pos") addPath("pos");
        if (permission === "stores") addPath("stores");
        if (permission === "employees") addPath("employees");
        if (permission === "roles_permissions") addPath("roles-permissions");
        if (permission === "offline_mode") addPath("offline-mode");
        if (permission === "finance" || permission === "sales_reports") addPath("insights");
        if (permission === "inventory") {
          addPath("products");
          addPath("purchase-orders");
        }
        if (permission === "purchase_orders") addPath("purchase-orders");
        if (permission === "customers") addPath("customers");
        if (permission === "suppliers") addPath("suppliers");
        if (permission === "settings") addPath("settings");
      });

      const featureKey = pathname.startsWith(`/t/${slug}/features/`)
        ? pathname.replace(`/t/${slug}/features/`, "").split("/")[0]
        : "";
      const allowedFeature = featureKey ? allowedFeatureKeys.has(featureKey) : false;
      if (!allowedPaths.has(pathname) && !allowedFeature) {
        nav({ to: allowedPaths.has(`/t/${slug}/pos`) ? `/t/${slug}/pos` : `/t/${slug}` });
      }
      return;
    }
    if (role === "cashier") {
      const allowedCashierPaths = new Set([
        `/t/${slug}`,
        `/t/${slug}/pos`,
        `/t/${slug}/customers`,
        `/t/${slug}/offline-mode`,
      ]);
      if (!allowedCashierPaths.has(pathname)) {
        nav({ to: `/t/${slug}/pos` });
      }
    }
  }, [role, employee, loading, slug, nav, pathname]);

  useEffect(() => {
    if (!business?.theme_color) return;
    const root = window.document.documentElement;
    root.style.setProperty("--theme-primary", business.theme_color);

    // Calculate primary-foreground based on contrast
    const hex = business.theme_color.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    const foreground = brightness > 180 ? "#09090b" : "#ffffff";

    root.style.setProperty("--theme-primary-foreground", foreground);

    // Apply dynamic --theme-accent using color-mix (srgb)
    const updateAccent = () => {
      const isDark = root.classList.contains("dark");
      const accentMix = isDark
        ? `color-mix(in srgb, ${business.theme_color} 15%, #09090b)`
        : `color-mix(in srgb, ${business.theme_color} 8%, #ffffff)`;
      root.style.setProperty("--theme-accent", accentMix);
    };

    updateAccent();

    // Observe class changes to keep accent color in sync when toggling dark mode
    const observer = new MutationObserver(updateAccent);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });

    return () => {
      root.style.removeProperty("--theme-primary");
      root.style.removeProperty("--theme-primary-foreground");
      root.style.removeProperty("--theme-accent");
      observer.disconnect();
    };
  }, [business?.theme_color, business?.id]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (showSplash)
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="flex flex-col items-center text-center">
          <img
            src={workplaceLogo}
            alt="Z-POS"
            className="h-28 w-28 object-contain sm:h-36 sm:w-36"
          />
          <p className="mt-5 text-sm font-medium uppercase tracking-[0.28em] text-muted-foreground">
            Loading workplace
          </p>
        </div>
      </div>
    );
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading workspace…
      </div>
    );
  if (!business)
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="glass rounded-2xl p-8 max-w-md text-center">
          <h1 className="text-xl font-semibold">Workspace not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You may not have access to <span className="font-mono">{slug}</span>.
          </p>
        </div>
      </div>
    );
  if (!role)
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="glass rounded-2xl p-8 max-w-md text-center">
          <h1 className="text-xl font-semibold">Workspace access unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This account is suspended, deleted, or your user does not have access.
          </p>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Mobile Header */}
      <header className="md:hidden h-16 flex items-center justify-between px-4 bg-sidebar border-b border-sidebar-border shrink-0 sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-2 -ml-2 rounded-lg border border-sidebar-border bg-sidebar-accent/40 text-foreground hover:bg-sidebar-accent transition-colors cursor-pointer"
            title="Open navigation"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
            <span className="text-xs font-semibold">Menu</span>
          </button>
          <div className="flex items-center gap-2">
            {business.logo_url ? (
              <img
                src={business.logo_url}
                alt={business.business_name}
                className="h-7 w-7 rounded-md object-cover border border-border"
              />
            ) : (
              <div className="h-7 w-7 rounded-md gradient-violet glow-violet flex items-center justify-center text-white font-bold text-[10px] shrink-0">
                {business.business_name.substring(0, 2).toUpperCase()}
              </div>
            )}
            <span className="font-semibold text-sm leading-tight text-foreground flex items-center gap-2">
              {business.business_name}
              <span
                className={`relative inline-flex h-2.5 w-2.5 rounded-full ${online ? "bg-emerald-500" : "bg-red-500"}`}
                title={online ? "Online" : "Offline"}
                aria-label={online ? "Online" : "Offline"}
              >
                <span
                  className={`absolute inline-flex h-full w-full rounded-full opacity-70 animate-ping ${online ? "bg-emerald-400" : "bg-red-400"}`}
                />
              </span>
            </span>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <AppSidebar slug={slug} />
      {mobileOpen && (
        <div className="fixed inset-0 z-[100] md:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
            aria-label="Close navigation menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative h-full w-[84vw] max-w-80 bg-sidebar border-r border-sidebar-border shadow-2xl animate-in slide-in-from-left duration-200">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 z-10 rounded-lg border border-sidebar-border bg-sidebar-accent/80 p-2 text-foreground shadow-sm cursor-pointer"
              aria-label="Close navigation menu"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarContent slug={slug} onClose={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
      <main className="w-full flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
