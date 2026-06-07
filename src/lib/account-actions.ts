import { createServerFn } from "@tanstack/react-start";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type SupabaseQueryError = { message: string };
type SupabaseQueryResult<T = unknown> = { data: T | null; error: SupabaseQueryError | null };

type SupabaseQuery<T = unknown> = PromiseLike<SupabaseQueryResult<T>> & {
  delete: () => SupabaseQuery<T>;
  eq: (column: string, value: unknown) => SupabaseQuery<T>;
  in: (column: string, values: string[]) => SupabaseQuery<T>;
  maybeSingle: () => SupabaseQuery<T>;
  select: (columns: string) => SupabaseQuery<T>;
};

type AccountDeleteClient = {
  from: <T = unknown>(table: string) => SupabaseQuery<T>;
};

function isSimulatedMode() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return !key || key.includes("placeholder") || key.includes("mock");
}

async function throwIfDeleteError(
  promise: PromiseLike<{ error: SupabaseQueryError | null }>,
  label: string,
) {
  const { error } = await promise;
  if (error) throw new Error(`Failed to delete ${label}: ${error.message}`);
}

async function deleteByIds(
  client: AccountDeleteClient,
  table: string,
  column: string,
  ids: string[],
  label: string,
) {
  if (!ids.length) return;
  await throwIfDeleteError(client.from(table).delete().in(column, ids), label);
}

async function selectIds(client: AccountDeleteClient, table: string, businessId: string) {
  const { data, error } = await client
    .from<Array<{ id: string }>>(table)
    .select("id")
    .eq("business_id", businessId);
  if (error) throw new Error(`Failed to load ${table}: ${error.message}`);
  return (data || []).map((row: { id: string }) => row.id).filter(Boolean);
}

async function deleteBusinessRecords(
  client: AccountDeleteClient,
  businessId: string,
  ownerId: string,
) {
  const [saleIds, productIds, purchaseOrderIds, employeeIds] = await Promise.all([
    selectIds(client, "sales", businessId),
    selectIds(client, "products", businessId),
    selectIds(client, "purchase_orders", businessId),
    selectIds(client, "employees", businessId),
  ]);

  await deleteByIds(client, "sale_items", "sale_id", saleIds, "sale items");
  await deleteByIds(client, "sale_items", "product_id", productIds, "sale item product links");
  await deleteByIds(
    client,
    "purchase_order_items",
    "po_id",
    purchaseOrderIds,
    "purchase order items",
  );
  await deleteByIds(
    client,
    "purchase_order_items",
    "product_id",
    productIds,
    "purchase order product links",
  );

  await Promise.all([
    throwIfDeleteError(
      client.from("employee_login_sessions").delete().eq("business_id", businessId),
      "employee login sessions",
    ),
    throwIfDeleteError(
      client.from("employee_shifts").delete().eq("business_id", businessId),
      "employee shifts",
    ),
    throwIfDeleteError(
      client.from("stock_transfers").delete().eq("business_id", businessId),
      "stock transfers",
    ),
    throwIfDeleteError(
      client.from("product_operation_details").delete().eq("business_id", businessId),
      "product operation details",
    ),
    throwIfDeleteError(
      client.from("customer_operation_profiles").delete().eq("business_id", businessId),
      "customer operation profiles",
    ),
    throwIfDeleteError(
      client.from("business_operations").delete().eq("business_id", businessId),
      "business operations",
    ),
    throwIfDeleteError(
      client.from("store_inventory").delete().eq("business_id", businessId),
      "store inventory",
    ),
    throwIfDeleteError(
      client.from("store_services").delete().eq("business_id", businessId),
      "store services",
    ),
    throwIfDeleteError(
      client.from("credit_ledger").delete().eq("business_id", businessId),
      "credit ledger",
    ),
  ]);

  await Promise.all([
    throwIfDeleteError(
      client.from("offline_sync_batches").delete().eq("business_id", businessId),
      "offline sync batches",
    ),
    throwIfDeleteError(
      client.from("system_settings_audit_logs").delete().eq("business_id", businessId),
      "system settings audit logs",
    ),
    throwIfDeleteError(
      client.from("business_devices").delete().eq("business_id", businessId),
      "business devices",
    ),
    throwIfDeleteError(
      client.from("business_ip_restrictions").delete().eq("business_id", businessId),
      "business IP restrictions",
    ),
    throwIfDeleteError(
      client.from("business_system_settings").delete().eq("business_id", businessId),
      "business system settings",
    ),
    throwIfDeleteError(
      client.from("business_enabled_features").delete().eq("business_id", businessId),
      "business enabled features",
    ),
    throwIfDeleteError(
      client.from("notifications").delete().eq("business_id", businessId),
      "notifications",
    ),
    throwIfDeleteError(
      client.from("activity_logs").delete().eq("business_id", businessId),
      "activity logs",
    ),
  ]);

  await Promise.all([
    throwIfDeleteError(
      client.from("inventory_logs").delete().eq("business_id", businessId),
      "inventory logs",
    ),
    throwIfDeleteError(client.from("sales").delete().eq("business_id", businessId), "sales"),
    throwIfDeleteError(
      client.from("purchase_orders").delete().eq("business_id", businessId),
      "purchase orders",
    ),
  ]);

  await Promise.all([
    throwIfDeleteError(client.from("products").delete().eq("business_id", businessId), "products"),
    throwIfDeleteError(
      client.from("customers").delete().eq("business_id", businessId),
      "customers",
    ),
    throwIfDeleteError(
      client.from("suppliers").delete().eq("business_id", businessId),
      "suppliers",
    ),
  ]);

  await throwIfDeleteError(
    client.from("categories").delete().eq("business_id", businessId),
    "categories",
  );

  await deleteByIds(
    client,
    "employee_login_sessions",
    "employee_id",
    employeeIds,
    "employee login sessions",
  );
  await deleteByIds(client, "employee_shifts", "employee_id", employeeIds, "employee shifts");
  await throwIfDeleteError(
    client.from("employees").delete().eq("business_id", businessId),
    "employees",
  );
  await throwIfDeleteError(client.from("stores").delete().eq("business_id", businessId), "stores");

  await throwIfDeleteError(
    client.from("businesses").delete().eq("id", businessId).eq("owner_id", ownerId),
    "account records",
  );
}

export const deleteBusinessAccountFn = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((data: unknown) => data as { businessId?: string })
  .handler(async ({ data, context }) => {
    const { businessId } = data;
    const { userId } = context;
    if (!businessId) throw new Error("Business ID is required.");

    const client = (isSimulatedMode() ? context.supabase : supabaseAdmin) as AccountDeleteClient;
    const { data: business, error: businessError } = await client
      .from("businesses")
      .select("id, owner_id")
      .eq("id", businessId)
      .eq("owner_id", userId)
      .maybeSingle();

    if (businessError)
      throw new Error(`Failed to verify account ownership: ${businessError.message}`);
    if (!business) throw new Error("Only the business owner can delete this account.");

    const { data: employees } = await client
      .from<Array<{ user_id: string | null }>>("employees")
      .select("user_id")
      .eq("business_id", businessId);
    const staffUserIds = Array.from(
      new Set((employees || []).map((employee) => employee.user_id).filter(Boolean) as string[]),
    ).filter((staffUserId) => staffUserId !== userId);

    await deleteBusinessRecords(client, businessId, userId);

    if (!isSimulatedMode()) {
      await Promise.allSettled(
        staffUserIds.map((staffUserId) => supabaseAdmin.auth.admin.deleteUser(staffUserId)),
      );
    }

    return { success: true };
  });
