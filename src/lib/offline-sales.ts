import { supabase } from "@/integrations/supabase/client";

const OFFLINE_SALES_KEY = "zpos-offline-sales-queue";

export type OfflineSale = {
  id: string;
  createdAt: string;
  salePayload: Record<string, unknown>;
  items: Record<string, unknown>[];
  stockAdjustments: { productId: string; nextStock: number; quantity: number; storeId?: string | null }[];
  customerUpdate?: { customerId: string; loyaltyPoints: number };
};

type SaleSyncResult = {
  data: { id: string } | null;
  error: { message?: string; code?: string } | null;
};
type SalesSyncTable = {
  insert: (payload: Record<string, unknown>) => {
    select: () => { single: () => Promise<SaleSyncResult> };
  };
};

function readOfflineSales(): OfflineSale[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_SALES_KEY) || "[]") as OfflineSale[];
  } catch (_) {
    return [];
  }
}

function writeOfflineSales(queue: OfflineSale[]) {
  localStorage.setItem(OFFLINE_SALES_KEY, JSON.stringify(queue));
  window.dispatchEvent(new Event("zpos-offline-queue-change"));
}

export function getOfflineSalesCount() {
  return readOfflineSales().length;
}

export function queueOfflineSale(sale: Omit<OfflineSale, "id" | "createdAt">) {
  const queue = readOfflineSales();
  queue.push({ ...sale, id: crypto.randomUUID(), createdAt: new Date().toISOString() });
  writeOfflineSales(queue);
}

export async function syncOfflineSales() {
  const queue = readOfflineSales();
  if (queue.length === 0) return;

  const remaining: OfflineSale[] = [];
  const salesTable = supabase.from("sales") as unknown as SalesSyncTable;
  for (const queuedSale of queue) {
    try {
      let { data: sale, error } = await salesTable.insert(queuedSale.salePayload).select().single();

      if (
        error?.message?.includes("sale_started_at") ||
        error?.message?.includes("checkout_duration_seconds") ||
        error?.code === "42703"
      ) {
        const retryPayload = { ...queuedSale.salePayload };
        delete retryPayload.sale_started_at;
        delete retryPayload.sale_completed_at;
        delete retryPayload.checkout_duration_seconds;
        const retry = await salesTable.insert(retryPayload).select().single();
        sale = retry.data;
        error = retry.error;
      }

      if (error || !sale) throw error || new Error("Failed to sync offline sale");

      await supabase.from("sale_items").insert(
        queuedSale.items.map((item) => ({
          ...item,
          sale_id: sale.id,
        })),
      );

      for (const adjustment of queuedSale.stockAdjustments) {
        if (adjustment.storeId) {
          await (supabase as any).from("store_inventory").upsert(
            {
              business_id: String(queuedSale.salePayload.business_id),
              store_id: adjustment.storeId,
              product_id: adjustment.productId,
              stock_quantity: adjustment.nextStock,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "store_id,product_id" },
          );
        }

        await supabase
          .from("products")
          .update({ stock_quantity: adjustment.nextStock })
          .eq("id", adjustment.productId);
        await supabase.from("inventory_logs").insert({
          business_id: String(queuedSale.salePayload.business_id),
          product_id: adjustment.productId,
          change_type: "sale",
          quantity: -adjustment.quantity,
          notes: `Offline sale synced ${sale.id}`,
        });
      }

      if (queuedSale.customerUpdate) {
        await supabase
          .from("customers")
          .update({ loyalty_points: queuedSale.customerUpdate.loyaltyPoints })
          .eq("id", queuedSale.customerUpdate.customerId);
      }
    } catch (_) {
      remaining.push(queuedSale);
    }
  }

  writeOfflineSales(remaining);
}
