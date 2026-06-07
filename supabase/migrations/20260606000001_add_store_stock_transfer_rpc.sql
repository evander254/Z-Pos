create or replace function public.transfer_store_stock(
  p_business_id uuid,
  p_from_store_id uuid,
  p_to_store_id uuid,
  p_product_id uuid,
  p_quantity integer,
  p_requested_by uuid default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from_stock integer;
  v_transfer_id uuid;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Transfer quantity must be greater than zero';
  end if;

  if p_from_store_id = p_to_store_id then
    raise exception 'Choose two different shops for a transfer';
  end if;

  if not public.user_has_business_role(p_business_id, array['owner','admin','manager']) then
    raise exception 'You do not have permission to transfer stock';
  end if;

  if not exists (select 1 from public.stores where id = p_from_store_id and business_id = p_business_id) then
    raise exception 'Source shop was not found for this business';
  end if;

  if not exists (select 1 from public.stores where id = p_to_store_id and business_id = p_business_id) then
    raise exception 'Destination shop was not found for this business';
  end if;

  if not exists (select 1 from public.products where id = p_product_id and business_id = p_business_id) then
    raise exception 'Product was not found for this business';
  end if;

  select stock_quantity
  into v_from_stock
  from public.store_inventory
  where business_id = p_business_id
    and store_id = p_from_store_id
    and product_id = p_product_id
  for update;

  if coalesce(v_from_stock, 0) < p_quantity then
    raise exception 'Insufficient stock in source shop';
  end if;

  update public.store_inventory
  set stock_quantity = stock_quantity - p_quantity,
      updated_at = now()
  where business_id = p_business_id
    and store_id = p_from_store_id
    and product_id = p_product_id;

  insert into public.store_inventory (business_id, store_id, product_id, stock_quantity, updated_at)
  values (p_business_id, p_to_store_id, p_product_id, p_quantity, now())
  on conflict (store_id, product_id)
  do update set
    stock_quantity = public.store_inventory.stock_quantity + excluded.stock_quantity,
    updated_at = now();

  insert into public.stock_transfers (
    business_id,
    from_store_id,
    to_store_id,
    product_id,
    quantity,
    status,
    requested_by,
    approved_by,
    notes,
    completed_at
  ) values (
    p_business_id,
    p_from_store_id,
    p_to_store_id,
    p_product_id,
    p_quantity,
    'completed',
    p_requested_by,
    p_requested_by,
    nullif(trim(p_notes), ''),
    now()
  ) returning id into v_transfer_id;

  return v_transfer_id;
end;
$$;

grant execute on function public.transfer_store_stock(uuid, uuid, uuid, uuid, integer, uuid, text) to authenticated;
