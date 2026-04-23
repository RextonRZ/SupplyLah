-- ─────────────────────────────────────────
-- 002: Link auth users → merchants + team access
-- Run this in Supabase SQL Editor
-- ─────────────────────────────────────────

-- 1. Link merchant to auth user
alter table merchant
  add column if not exists user_id uuid references auth.users(id) on delete set null;

alter table merchant
  alter column contact_number drop not null;

create index if not exists idx_merchant_user_id on merchant(user_id);

-- 2. Team access table
create table if not exists merchant_users (
  id            uuid primary key default gen_random_uuid(),
  merchant_id   uuid not null references merchant(merchant_id) on delete cascade,
  invited_email text not null,
  role          text not null check (role in ('Wholesale Supplier', 'Warehouse Manager')),
  status        text default 'invited' check (status in ('active', 'invited', 'revoked')),
  created_at    timestamptz default now(),
  unique(merchant_id, invited_email)
);

-- 3. Auto-create a merchant row whenever a new user signs up
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.merchant (user_id, company_name, contact_number)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'business_name', 'My Business'),
    coalesce(new.raw_user_meta_data->>'phone', '')
  )
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- 4. RLS policies (optional but recommended)
alter table merchant_users enable row level security;

create policy "Users can view their merchant team"
  on merchant_users for select
  using (
    merchant_id in (
      select merchant_id from merchant where user_id = auth.uid()
    )
  );

create policy "Owners can manage team"
  on merchant_users for all
  using (
    merchant_id in (
      select merchant_id from merchant where user_id = auth.uid()
    )
  );
