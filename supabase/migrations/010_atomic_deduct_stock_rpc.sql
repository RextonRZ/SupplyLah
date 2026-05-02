-- Atomic stock deduction via a single UPDATE with a WHERE guard.
-- Returns the new stock_quantity on success, or -1 if stock was insufficient.
-- This eliminates the read-then-write race condition in the Python layer.

create or replace function deduct_stock_atomic(
  p_product_id uuid,
  p_qty        integer
)
returns integer
language plpgsql
security definer
as $$
declare
  v_new_qty integer;
begin
  update product
     set stock_quantity = stock_quantity - p_qty
   where product_id = p_product_id
     and stock_quantity >= p_qty
  returning stock_quantity into v_new_qty;

  if not found then
    return -1;
  end if;

  return v_new_qty;
end;
$$;
