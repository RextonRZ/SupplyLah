-- ─────────────────────────────────────────
-- 007: Link merchant_users to auth.users for role-based access
-- Run this in Supabase SQL Editor
-- ─────────────────────────────────────────

-- Allow invited members to be linked to their auth user once they sign up
alter table merchant_users
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

-- Auto-link when a new user signs up whose email matches an invitation
create or replace function link_invited_user()
returns trigger language plpgsql security definer as $$
begin
  update public.merchant_users
  set auth_user_id = new.id, status = 'active'
  where invited_email = new.email
    and auth_user_id is null;
  return new;
end;
$$;

drop trigger if exists on_invited_user_signup on auth.users;
create trigger on_invited_user_signup
  after insert on auth.users
  for each row execute function link_invited_user();

-- RLS: team members can view their own merchant's data
drop policy if exists "Team members can view their merchant" on merchant_users;
create policy "Team members can view their merchant"
  on merchant_users for select
  using (auth_user_id = auth.uid());
