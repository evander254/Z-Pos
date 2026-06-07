do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'activity_logs',
    'business_enabled_features',
    'business_operations',
    'business_system_settings',
    'categories',
    'credit_ledger',
    'customer_operation_profiles',
    'customers',
    'employee_login_sessions',
    'employee_shifts',
    'employees',
    'inventory_logs',
    'notifications',
    'offline_sync_batches',
    'product_operation_details',
    'products',
    'purchase_orders',
    'sales',
    'stock_transfers',
    'store_inventory',
    'store_services',
    'stores',
    'suppliers'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    exception
      when duplicate_object then null;
      when undefined_object then null;
    end;
  end loop;
end $$;
