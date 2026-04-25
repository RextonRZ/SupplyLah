-- ─────────────────────────────────────────
-- 009: RPC to fetch team members for an owner (bypasses RLS)
-- Only returns team for merchants owned by the calling user
-- ─────────────────────────────────────────

create or replace function get_merchant_team(p_merchant_id uuid)
returns table (
  id              uuid,
  merchant_id     uuid,
  invited_email   text,
  contact_number  text,
  role            text,
  status          text,
  auth_user_id    uuid,
  created_at      timestamptz
) language plpgsql security definer as $$
begin
  -- Only allow if the caller owns this merchant
  if not exists (
    select 1 from merchant
    where merchant_id = p_merchant_id
      and user_id = auth.uid()
  ) then
    raise exception 'Not authorized';
  end if;

  return query
    select mu.id, mu.merchant_id, mu.invited_email, mu.contact_number,
           mu.role, mu.status, mu.auth_user_id, mu.created_at
    from merchant_users mu
    where mu.merchant_id = p_merchant_id
    order by mu.created_at;
end;
$$;

grant execute on function get_merchant_team(uuid) to authenticated;
