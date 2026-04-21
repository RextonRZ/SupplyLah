-- Enable pgvector for RAG similarity search
create extension if not exists vector;

-- ─────────────────────────────────────────
-- Core tables
-- ─────────────────────────────────────────

create table if not exists merchant (
  merchant_id   uuid primary key default gen_random_uuid(),
  company_name  text not null,
  contact_number text not null,
  created_at    timestamptz default now()
);

create table if not exists customer (
  customer_id       uuid primary key default gen_random_uuid(),
  customer_name     text not null default 'Unknown',
  whatsapp_number   text not null,
  delivery_address  text,
  merchant_id       uuid references merchant(merchant_id) on delete cascade,
  created_at        timestamptz default now(),
  unique(whatsapp_number, merchant_id)
);

create table if not exists product (
  product_id      uuid primary key default gen_random_uuid(),
  product_name    text not null,
  product_sku     text,
  unit_price      numeric(10,2) not null,
  stock_quantity  integer not null default 0,
  slang_aliases   text[] default '{}',
  merchant_id     uuid references merchant(merchant_id) on delete cascade,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create table if not exists "order" (
  order_id              uuid primary key default gen_random_uuid(),
  customer_id           uuid references customer(customer_id) on delete set null,
  merchant_id           uuid references merchant(merchant_id) on delete cascade,
  order_amount          numeric(10,2),
  order_status          text not null default 'Pending'
                          check (order_status in (
                            'Pending', 'Awaiting Confirmation',
                            'Confirmed', 'Dispatched', 'Failed', 'Expired'
                          )),
  order_notes           text,
  confidence_score      float,
  requires_human_review boolean default false,
  confirmed_at          timestamptz,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

create table if not exists order_item (
  order_id      uuid references "order"(order_id) on delete cascade,
  product_id    uuid references product(product_id) on delete set null,
  product_name  text not null,
  quantity      integer not null,
  unit_price    numeric(10,2) not null,
  is_substituted boolean default false,
  primary key (order_id, product_id)
);

create table if not exists logistic (
  delivery_id       uuid primary key default gen_random_uuid(),
  order_id          uuid references "order"(order_id) on delete cascade,
  provider_name     text default 'Lalamove',
  tracking_url      text,
  logistic_status   text default 'Pending',
  estimated_price   numeric(10,2),
  eta_minutes       integer,
  created_at        timestamptz default now()
);

create table if not exists conversation_log (
  message_id    uuid primary key default gen_random_uuid(),
  order_id      uuid references "order"(order_id) on delete set null,
  customer_id   uuid references customer(customer_id) on delete cascade,
  sender_type   text check (sender_type in ('buyer', 'system', 'agent')),
  message_type  text check (message_type in ('text', 'audio', 'image', 'system')),
  content       text,
  media_url     text,
  created_at    timestamptz default now()
);

create table if not exists knowledge_base (
  document_id   uuid primary key default gen_random_uuid(),
  merchant_id   uuid references merchant(merchant_id) on delete cascade,
  content       text not null,
  embedding     vector(1536),
  document_type text,
  created_at    timestamptz default now()
);

-- ─────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────

create index if not exists idx_customer_whatsapp     on customer(whatsapp_number);
create index if not exists idx_order_status          on "order"(order_status);
create index if not exists idx_order_customer        on "order"(customer_id);
create index if not exists idx_order_merchant        on "order"(merchant_id);
create index if not exists idx_conversation_order    on conversation_log(order_id);
create index if not exists idx_conversation_customer on conversation_log(customer_id);
create index if not exists idx_product_merchant      on product(merchant_id);
create index if not exists idx_kb_embedding on knowledge_base
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- ─────────────────────────────────────────
-- Updated_at trigger
-- ─────────────────────────────────────────

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_product_updated_at before update on product
  for each row execute function set_updated_at();
create trigger trg_order_updated_at before update on "order"
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────
-- Seed data — demo merchant + products
-- ─────────────────────────────────────────

insert into merchant (merchant_id, company_name, contact_number)
values ('00000000-0000-0000-0000-000000000001', 'Demo Wholesaler Sdn Bhd', '+60123456789')
on conflict do nothing;

insert into product (product_name, product_sku, unit_price, stock_quantity, slang_aliases, merchant_id) values
  ('Minyak Masak 5L',     'OIL-5L-001',    25.90, 100, ARRAY['minyak','cooking oil','minyak masak','oil'],             '00000000-0000-0000-0000-000000000001'),
  ('Beras Tempatan 10kg', 'RICE-10K-001',  38.00,  50, ARRAY['beras','rice','nasi','beras tempatan'],                  '00000000-0000-0000-0000-000000000001'),
  ('Gula Pasir 1kg',      'SUGAR-1K-001',   3.00, 200, ARRAY['gula','sugar','gula pasir'],                             '00000000-0000-0000-0000-000000000001'),
  ('Tepung Gandum 1kg',   'FLOUR-1K-001',   2.50, 150, ARRAY['tepung','flour','tepung gandum','tepung'],                '00000000-0000-0000-0000-000000000001'),
  ('Sardin 425g',         'SARDINE-001',    5.50,  80, ARRAY['sardin','sardine','ikan sardin','sardin tin'],            '00000000-0000-0000-0000-000000000001'),
  ('Mee Segera 30pcs',    'NOODLE-30-001', 12.00,  60, ARRAY['mee','maggi','instant noodle','mee segera','indomee'],   '00000000-0000-0000-0000-000000000001'),
  ('Susu Cair 1L',        'MILK-1L-001',    4.20,  90, ARRAY['susu','milk','susu cair','fresh milk'],                  '00000000-0000-0000-0000-000000000001'),
  ('Kicap Manis 625ml',   'SOYSAUCE-001',   5.80,  70, ARRAY['kicap','soy sauce','kicap manis'],                       '00000000-0000-0000-0000-000000000001')
on conflict do nothing;

-- Business rules knowledge base entry
insert into knowledge_base (merchant_id, content, document_type)
values (
  '00000000-0000-0000-0000-000000000001',
  'Pricing rules: Orders above RM200 get 5% discount. Loyalty customers (>10 orders) get additional 3% discount. Minimum order value is RM50. Delivery fee: free for orders above RM300, otherwise RM15 flat rate. Payment terms: 30 days net for established customers, upfront for new customers. Substitution policy: if requested item is out of stock, propose nearest equivalent at same price tier.',
  'business_rules'
) on conflict do nothing;
