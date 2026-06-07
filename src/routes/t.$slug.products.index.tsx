import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/tenant-context";
import { Button } from "@/components/ui/button";
import { Store, Plus, Package, Briefcase, MapPin, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useBusinessRealtime } from "@/lib/use-business-realtime";

export const Route = createFileRoute("/t/$slug/products/")({ component: ProductsIndex });

type StoreOption = {
  id: string;
  name: string;
  active: boolean | null;
  location: string | null;
  inventory_mode?: string | null;
};

function ProductsIndex() {
  const { business } = useTenant();
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [loading, setLoading] = useState(true);

  const loadStores = useCallback(async () => {
    if (!business) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("stores")
        .select("id,name,active,location,inventory_mode")
        .eq("business_id", business.id)
        .order("name");

      if (error) throw error;
      setStores(data || []);
    } catch (e: any) {
      toast.error("Failed to load stores: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [business]);

  useEffect(() => {
    loadStores();
  }, [loadStores]);

  useBusinessRealtime(business?.id, ["stores"], loadStores);

  if (loading) {
    return (
      <div className="w-full p-6 md:p-8 flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="w-full p-6 md:p-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Inventory & Services</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Select a store or branch to manage its specific inventory and services.
          </p>
        </div>
        <Link to="/t/$slug/stores" params={{ slug: business?.slug || "" }}>
          <Button className="gradient-violet text-white border-0 cursor-pointer">
            <Plus className="h-4 w-4 mr-1" /> New Store
          </Button>
        </Link>
      </div>

      {stores.length === 0 ? (
        <div className="mt-10 glass rounded-2xl p-12 text-center border border-border/50">
          <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Store className="h-8 w-8 text-primary" />
          </div>
          <div className="text-xl font-bold">No Stores Found</div>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            You need to create at least one store before you can add inventory or services.
            Each shop or branch requires its own setup.
          </p>
          <Link to="/t/$slug/stores" params={{ slug: business?.slug || "" }}>
            <Button className="mt-6 gradient-violet text-white border-0 cursor-pointer shadow-lg hover:shadow-primary/25">
              <Plus className="h-4 w-4 mr-1" /> Create your first Store
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          {stores.map((store) => {
            const isService = store.inventory_mode === "services";
            const isBoth = store.inventory_mode === "both";
            const Icon = isService ? Briefcase : Package;

            return (
              <Link
                key={store.id}
                to="/t/$slug/products/$storeId"
                params={{ slug: business?.slug || "", storeId: store.id }}
                className="group relative rounded-2xl border border-border bg-card p-6 shadow-sm hover:shadow-md transition-all hover:border-primary/50 overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-primary/50 group-hover:bg-primary transition-colors"></div>

                <div className="flex justify-between items-start">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Icon className="h-6 w-6" />
                  </div>
                  {!store.active && (
                    <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                      Inactive
                    </span>
                  )}
                </div>

                <div className="mt-4">
                  <h3 className="text-xl font-semibold tracking-tight">{store.name}</h3>
                  {store.location && (
                    <div className="flex items-center text-sm text-muted-foreground mt-1.5">
                      <MapPin className="h-3.5 w-3.5 mr-1 shrink-0" />
                      <span className="truncate">{store.location}</span>
                    </div>
                  )}
                </div>

                <div className="mt-5 pt-4 border-t border-border/50 flex items-center justify-between text-sm">
                  <span className="font-medium text-muted-foreground flex items-center gap-1.5">
                    {isService ? "Services Only" : isBoth ? "Products & Services" : "Products Inventory"}
                  </span>
                  <div className="text-primary flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    Manage <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
