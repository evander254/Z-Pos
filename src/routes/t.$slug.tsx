import { createFileRoute, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { TenantProvider, useTenant } from "@/lib/tenant-context";
import { AppSidebar, SidebarContent } from "@/components/app-sidebar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";

export const Route = createFileRoute("/t/$slug")({ component: TenantLayout });

function TenantLayout() {
  const { slug } = Route.useParams();
  const { user, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => { if (!loading && !user) nav({ to: "/auth/login" }); }, [loading, user, nav]);

  return (
    <TenantProvider slug={slug}>
      <Shell slug={slug} />
    </TenantProvider>
  );
}

function Shell({ slug }: { slug: string }) {
  const { business, role, loading } = useTenant();
  const [mobileOpen, setMobileOpen] = useState(false);
  const nav = useNavigate();
  const { pathname } = useLocation();

  // Cashier redirection guard: can only access POS
  useEffect(() => {
    if (loading || !role) return;
    if (role === "cashier") {
      const targetPosPath = `/t/${slug}/pos`;
      if (pathname !== targetPosPath) {
        nav({ to: `/t/${slug}/pos` });
      }
    }
  }, [role, loading, slug, nav, pathname]);

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

  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading workspace…</div>;
  if (!business) return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="glass rounded-2xl p-8 max-w-md text-center">
        <h1 className="text-xl font-semibold">Workspace not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">You may not have access to <span className="font-mono">{slug}</span>.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Mobile Header */}
      <header className="md:hidden h-16 flex items-center justify-between px-4 bg-sidebar border-b border-sidebar-border shrink-0 sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button 
                className="p-2 -ml-2 rounded-md text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="Toggle sidebar"
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 border-r-0">
              <SidebarContent slug={slug} onClose={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            {business.logo_url ? (
              <img src={business.logo_url} alt={business.business_name} className="h-7 w-7 rounded-md object-cover border border-border" />
            ) : (
              <div className="h-7 w-7 rounded-md gradient-violet glow-violet flex items-center justify-center text-white font-bold text-[10px] shrink-0">
                {business.business_name.substring(0, 2).toUpperCase()}
              </div>
            )}
            <span className="font-semibold text-sm leading-tight text-foreground">{business.business_name}</span>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <AppSidebar slug={slug} />
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
