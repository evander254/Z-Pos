import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Loader2, PackageCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/tenant-context";
import { getWorkspaceFeature, getWorkspaceFeatureGroups } from "@/lib/feature-navigation";

export const Route = createFileRoute("/t/$slug/features/$featureKey")({ component: FeaturePage });

function FeaturePage() {
  const { slug, featureKey } = Route.useParams();
  const { business } = useTenant();
  const feature = getWorkspaceFeature(featureKey, business?.business_type);
  const groups = getWorkspaceFeatureGroups(business?.business_type);
  const related = groups
    .flatMap((group) => group.items.map((item) => ({ ...item, group: group.title })))
    .filter((item) => item.key !== featureKey)
    .slice(0, 6);
  const Icon = feature?.icon || Sparkles;

  return (
    <div className="w-full p-4 md:p-8 space-y-6">
      <Link
        to="/t/$slug"
        params={{ slug }}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to dashboard
      </Link>

      <div className="relative overflow-hidden rounded-[2rem] border border-border/60 bg-card p-6 md:p-8 shadow-sm">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,var(--theme-primary),transparent_38%)] opacity-20" />
        <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Icon className="h-3.5 w-3.5" /> {feature?.group || "Workspace module"}
            </div>
            <h1 className="mt-4 text-3xl md:text-5xl font-bold tracking-tight">
              {feature?.label || "Workspace module"}
            </h1>
            <p className="mt-3 text-sm md:text-base text-muted-foreground max-w-2xl">
              {feature?.description || "This module is configured for your workspace."}
            </p>
          </div>
          {feature?.premium && (
            <div className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary">
              Premium AI-powered module
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {[
          "Capture operational records for this module.",
          "Connect activity to products, customers, staff, sales, and branches.",
          "Use reports and alerts to turn this workflow into decisions.",
        ].map((text, index) => (
          <motion.div
            key={text}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06 }}
            className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm"
          >
            <div className="h-10 w-10 rounded-xl gradient-violet text-white flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="mt-4 font-semibold">Ready for operations</div>
            <p className="mt-2 text-sm text-muted-foreground">{text}</p>
          </motion.div>
        ))}
      </div>

      {(featureKey === "stock_transfers" || featureKey === "branch_stock_transfers") && (
        <StockTransfersSection />
      )}

      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm font-medium">Related workspace pages</div>
            <div className="text-xs text-muted-foreground">
              Other tools available for {business?.business_name || "this business"}.
            </div>
          </div>
        </div>
        <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {related.map((item) => {
            const RelatedIcon = item.icon;
            const to =
              item.path === ""
                ? `/t/${slug}`
                : item.path
                  ? `/t/${slug}/${item.path}`
                  : `/t/${slug}/features/${item.key}`;
            return (
              <Link
                key={item.key}
                to={to}
                className="rounded-xl border border-border/60 bg-background/50 p-4 hover:border-primary/50 hover:bg-primary/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <RelatedIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{item.label}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{item.group}</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type StoreRow = {
  id: string;
  name: string;
  active: boolean | null;
};

type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  active: boolean | null;
};

type InventoryRow = {
  store_id: string;
  product_id: string;
  stock_quantity: number;
};

type TransferRow = {
  id: string;
  from_store_id: string | null;
  to_store_id: string | null;
  product_id: string;
  quantity: number;
  status: string;
  notes: string | null;
  created_at: string | null;
  completed_at: string | null;
};

type StoreInventoryQueryClient = {
  from(table: "store_inventory"): {
    select(columns: string): {
      eq(
        column: string,
        value: string,
      ): Promise<{ data: InventoryRow[] | null; error: Error | null }>;
    };
  };
};

type StockTransferQueryClient = {
  from(table: "stock_transfers"): {
    select(columns: string): {
      eq(
        column: string,
        value: string,
      ): {
        order(
          column: string,
          options: { ascending: boolean },
        ): { limit(count: number): Promise<{ data: TransferRow[] | null; error: Error | null }> };
      };
    };
  };
};

type StockTransferRpcClient = {
  rpc(
    fn: "transfer_store_stock",
    params: {
      p_business_id: string;
      p_from_store_id: string;
      p_to_store_id: string;
      p_product_id: string;
      p_quantity: number;
      p_requested_by: string | null;
      p_notes: string;
    },
  ): Promise<{ data: string | null; error: Error | null }>;
};

function StockTransfersSection() {
  const { business, employee, role } = useTenant();
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [transfers, setTransfers] = useState<TransferRow[]>([]);
  const [fromStoreId, setFromStoreId] = useState("");
  const [toStoreId, setToStoreId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [transferring, setTransferring] = useState(false);
  const canTransfer = role === "owner" || role === "admin" || role === "manager";

  const storeName = useMemo(() => new Map(stores.map((store) => [store.id, store.name])), [stores]);
  const productName = useMemo(
    () => new Map(products.map((product) => [product.id, product.name])),
    [products],
  );
  const sourceStock = inventory.find(
    (item) => item.store_id === fromStoreId && item.product_id === productId,
  );
  const sourceQuantity = sourceStock?.stock_quantity || 0;

  useEffect(() => {
    loadStockTransferData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business?.id]);

  async function loadStockTransferData() {
    if (!business?.id) return;
    setLoading(true);

    const [storesResult, productsResult, inventoryResult, transfersResult] = await Promise.all([
      supabase
        .from("stores")
        .select("id, name, active")
        .eq("business_id", business.id)
        .order("name"),
      supabase
        .from("products")
        .select("id, name, sku, barcode, active")
        .eq("business_id", business.id)
        .order("name"),
      (supabase as unknown as StoreInventoryQueryClient)
        .from("store_inventory")
        .select("store_id, product_id, stock_quantity")
        .eq("business_id", business.id),
      (supabase as unknown as StockTransferQueryClient)
        .from("stock_transfers")
        .select(
          "id, from_store_id, to_store_id, product_id, quantity, status, notes, created_at, completed_at",
        )
        .eq("business_id", business.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (storesResult.error) toast.error(storesResult.error.message);
    if (productsResult.error) toast.error(productsResult.error.message);
    if (inventoryResult.error) toast.error(inventoryResult.error.message);
    if (transfersResult.error) toast.error(transfersResult.error.message);

    const activeStores = ((storesResult.data || []) as StoreRow[]).filter(
      (store) => store.active !== false,
    );
    const activeProducts = ((productsResult.data || []) as ProductRow[]).filter(
      (product) => product.active !== false,
    );

    setStores(activeStores);
    setProducts(activeProducts);
    setInventory((inventoryResult.data || []) as InventoryRow[]);
    setTransfers((transfersResult.data || []) as TransferRow[]);
    setFromStoreId((current) => current || activeStores[0]?.id || "");
    setToStoreId((current) => current || activeStores[1]?.id || activeStores[0]?.id || "");
    setProductId((current) => current || activeProducts[0]?.id || "");
    setLoading(false);
  }

  async function submitTransfer(event: React.FormEvent) {
    event.preventDefault();
    if (!business?.id || !canTransfer) return;
    if (!fromStoreId || !toStoreId || !productId) return toast.error("Select shops and product.");
    if (fromStoreId === toStoreId) return toast.error("Choose two different shops.");
    if (quantity <= 0) return toast.error("Quantity must be greater than zero.");
    if (quantity > sourceQuantity) return toast.error("Not enough stock in the source shop.");

    setTransferring(true);
    const { error } = await (supabase as unknown as StockTransferRpcClient).rpc(
      "transfer_store_stock",
      {
        p_business_id: business.id,
        p_from_store_id: fromStoreId,
        p_to_store_id: toStoreId,
        p_product_id: productId,
        p_quantity: quantity,
        p_requested_by: employee?.id || null,
        p_notes: notes,
      },
    );
    setTransferring(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Stock transferred successfully");
    setNotes("");
    await loadStockTransferData();
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 md:p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <PackageCheck className="h-3.5 w-3.5" /> Stock movement
          </div>
          <h2 className="mt-3 text-2xl font-bold">Transfer stock between shops</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Move inventory from one shop or branch you own to another. Stock is deducted and added
            immediately after confirmation.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={loadStockTransferData} disabled={loading}>
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="mt-8 flex items-center justify-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading stock data...
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
          <form
            onSubmit={submitTransfer}
            className="space-y-4 rounded-2xl border border-border/60 bg-background/50 p-5"
          >
            {!canTransfer && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
                Only owners, admins, and managers can transfer stock.
              </div>
            )}
            {stores.length < 2 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
                Add at least two shops before transferring stock.
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <SelectField
                label="From shop"
                value={fromStoreId}
                onChange={setFromStoreId}
                options={stores.map((store) => [store.id, store.name])}
              />
              <SelectField
                label="To shop"
                value={toStoreId}
                onChange={setToStoreId}
                options={stores.map((store) => [store.id, store.name])}
              />
            </div>

            <SelectField
              label="Product"
              value={productId}
              onChange={setProductId}
              options={products.map((product) => [
                product.id,
                `${product.name}${product.sku ? ` (${product.sku})` : ""}`,
              ])}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Quantity to transfer</Label>
                <Input
                  className="mt-1"
                  type="number"
                  min={1}
                  max={sourceQuantity || undefined}
                  value={quantity}
                  onChange={(event) => setQuantity(Number(event.target.value))}
                />
              </div>
              <div className="rounded-xl border border-border/60 bg-card p-4">
                <div className="text-xs uppercase text-muted-foreground">Available in source</div>
                <div className="mt-1 text-3xl font-bold">{sourceQuantity}</div>
              </div>
            </div>

            <div>
              <Label>Transfer notes</Label>
              <Textarea
                className="mt-1"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Reason, driver, receiving staff, or reference number"
              />
            </div>

            <Button
              disabled={transferring || !canTransfer || stores.length < 2}
              className="gradient-violet text-white border-0"
            >
              {transferring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Transfer stock
            </Button>
          </form>

          <div className="rounded-2xl border border-border/60 bg-background/50 p-5">
            <div className="text-sm font-semibold">Recent transfers</div>
            <div className="mt-4 space-y-3">
              {transfers.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  No transfers yet.
                </div>
              ) : (
                transfers.map((transfer) => (
                  <div key={transfer.id} className="rounded-xl border border-border/60 bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold">
                          {productName.get(transfer.product_id) || "Unknown product"}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {storeName.get(transfer.from_store_id || "") || "Source"} →{" "}
                          {storeName.get(transfer.to_store_id || "") || "Destination"}
                        </div>
                      </div>
                      <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                        {transfer.quantity} units
                      </div>
                    </div>
                    {transfer.notes && (
                      <div className="mt-2 text-xs text-muted-foreground">{transfer.notes}</div>
                    )}
                    <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="capitalize">{transfer.status}</span>
                      <span>
                        {transfer.completed_at || transfer.created_at
                          ? new Date(
                              transfer.completed_at || transfer.created_at || "",
                            ).toLocaleString()
                          : ""}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[][];
}) {
  return (
    <div>
      <Label>{label}</Label>
      <select
        className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Select...</option>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}
