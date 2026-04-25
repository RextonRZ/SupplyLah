-- ─────────────────────────────────────────
-- 008: RPC function to upsert team members bypassing RLS
-- SECURITY DEFINER runs as the function owner (postgres), bypassing RLS
-- ─────────────────────────────────────────

create or replace function upsert_team_member(
  p_merchant_id uuid,
  p_email text,
  p_phone text,
  p_role text
) returns void language plpgsql security definer as $$
begin
  insert into merchant_users (merchant_id, invited_email, contact_number, role, status)
  values (p_merchant_id, p_email, p_phone, p_role, 'invited')
  on conflict (merchant_id, invited_email)
  do update set
    contact_number = excluded.contact_number,
    role           = excluded.role,
    status         = 'invited';
end;
$$;

-- Allow the anon and authenticated roles to call this function
grant execute on function upsert_team_member(uuid, text, text, text) to anon, authenticated, service_role;
