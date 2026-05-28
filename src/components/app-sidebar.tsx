import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, ScanBarcode, Package, Users, Receipt, UserCog, Settings, LogOut, Sun, Moon, TrendingUp, Truck, BookOpenCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useTenant } from "@/lib/tenant-context";
import { BUSINESS_TYPE_MAP } from "@/lib/business-types";
import { useTheme, type ThemeColor } from "@/lib/theme-context";

interface SidebarContentProps {
  slug: string;
  onClose?: () => void;
}

export function SidebarContent({ slug, onClose }: SidebarContentProps) {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const { signOut } = useAuth();
  const { business, role } = useTenant();
  const { mode, color, setMode, setColor } = useTheme();
  const def = business ? BUSINESS_TYPE_MAP[business.business_type as keyof typeof BUSINESS_TYPE_MAP] : null;

  const items = [
    { to: `/t/${slug}`, label: "Dashboard", icon: LayoutDashboard, exact: true },
    { to: `/t/${slug}/pos`, label: "POS", icon: ScanBarcode },
    { to: `/t/${slug}/products`, label: "Products", icon: Package },
    { to: `/t/${slug}/sales`, label: "Sales", icon: Receipt },
    { to: `/t/${slug}/insights`, label: "Insights", icon: TrendingUp },
    { to: `/t/${slug}/suppliers`, label: "Suppliers", icon: Truck },
    { to: `/t/${slug}/credit-ledger`, label: "Credit Ledger", icon: BookOpenCheck },
    { to: `/t/${slug}/customers`, label: "Customers", icon: Users },
    { to: `/t/$slug/employees`, label: "Employees", icon: UserCog },
    { to: `/t/${slug}/receipts`, label: "Receipt Templates", icon: Receipt },
    { to: `/t/${slug}/settings`, label: "Settings", icon: Settings },
  ];

  const filteredItems = role === "cashier"
    ? items.filter(it => it.label === "POS")
    : items;

  // Map employee list path helper
  const resolvedItems = filteredItems.map(item => ({
    ...item,
    to: item.to.replace("$slug", slug)
  }));

  const colors: { id: ThemeColor; hex: string; name: string }[] = [
    { id: "violet", hex: "#7c3aed", name: "Violet" },
    { id: "blue", hex: "#2563eb", name: "Blue" },
    { id: "emerald", hex: "#059669", name: "Emerald" },
    { id: "amber", hex: "#d97706", name: "Amber" },
    { id: "rose", hex: "#e11d48", name: "Rose" },
  ];

  return (
    <div className="flex flex-col h-full bg-sidebar">
      <div className="h-16 flex items-center gap-2 px-5 border-b border-sidebar-border shrink-0">
        {business?.logo_url ? (
          <img src={business.logo_url} alt={business.business_name} className="h-8 w-8 rounded-lg object-cover border border-border shrink-0" />
        ) : (
          <div className="h-8 w-8 rounded-lg gradient-violet glow-violet flex items-center justify-center text-white font-bold text-xs shrink-0">
            {business?.business_name?.substring(0, 2).toUpperCase() || "ZP"}
          </div>
        )}
        <div>
          <div className="font-semibold text-sm leading-tight text-foreground">{business?.business_name || "ZPos"}</div>
          <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap mt-0.5">
            <span>{def?.label || "Loading..."}</span>
            <span className="capitalize px-1.5 py-0.25 rounded bg-primary/15 text-primary font-medium text-[9px]">
              {role || "Owner"}
            </span>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {resolvedItems.map(it => {
          const active = it.exact ? pathname === it.to : pathname.startsWith(it.to);
          return (
            <Link 
              key={it.to} 
              to={it.to} 
              onClick={() => onClose?.()}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${active ? "bg-sidebar-accent text-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"}`}
            >
              <it.icon className="h-4 w-4" /> {it.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-sidebar-border space-y-3 shrink-0">
        {/* Theme Settings Panel */}
        <div className="glass rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">Theme Settings</span>
            <button
              onClick={() => setMode(mode === "light" ? "dark" : "light")}
              className="p-2 rounded-md hover:bg-sidebar-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title={`Switch to ${mode === "light" ? "dark" : "light"} mode`}
            >
              {mode === "light" ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
            </button>
          </div>
          <div className="flex gap-1.5 justify-between">
            {colors.map(c => (
              <button
                key={c.id}
                onClick={() => setColor(c.id)}
                className={`h-4 w-4 rounded-full border transition-all cursor-pointer ${color === c.id ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "border-border hover:scale-105"}`}
                style={{ backgroundColor: c.hex }}
                title={c.name}
              />
            ))}
          </div>
        </div>
        <button 
          onClick={() => {
            onClose?.();
            signOut().then(() => nav({ to: "/" }));
          }}
          className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground cursor-pointer"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );
}

export function AppSidebar({ slug }: { slug: string }) {
  return (
    <aside className="hidden md:flex flex-col w-64 shrink-0 bg-sidebar border-r border-sidebar-border h-screen sticky top-0">
      <SidebarContent slug={slug} />
    </aside>
  );
}
