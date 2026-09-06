-- =========================================================
-- Sweetly — Core Schema
-- Run in order: 0001_schema.sql -> 0002_rls.sql -> 0003_seed.sql
-- =========================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------
create type shop_member_role as enum ('OWNER', 'STAFF');
create type platform_role as enum ('USER', 'PLATFORM_ADMIN');
create type order_status as enum (
  'NEW', 'CONTACTED', 'PAYMENT_PENDING', 'CONFIRMED',
  'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'
);
create type subscription_status as enum (
  'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED'
);

-- ---------------------------------------------------------
-- PROFILES (mirrors auth.users, holds platform-level role)
-- ---------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  platform_role platform_role not null default 'USER',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create profile row when a new auth user signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Shop Owner'),
    new.raw_user_meta_data->>'phone'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------
-- SHOPS (tenant root)
-- ---------------------------------------------------------
create table public.shops (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 60),
  description text check (char_length(description) <= 2000),
  logo_url text,
  cover_image_url text,
  whatsapp_number text, -- E.164, validated in app layer before write
  phone text,
  address text,
  city text,
  state text,
  pincode text,
  opening_hours jsonb default '{}'::jsonb,
  theme jsonb default '{}'::jsonb,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_shops_owner_id on public.shops(owner_id);
create index idx_shops_slug on public.shops(slug);

-- Reserved slugs that must never be assignable to a shop.
create table public.reserved_slugs (
  slug text primary key
);
insert into public.reserved_slugs (slug) values
  ('login'),('signup'),('dashboard'),('admin'),('api'),('settings'),
  ('pricing'),('about'),('contact'),('support'),('terms'),('privacy'),
  ('shops'),('forgot-password'),('reset-password'),('onboarding'),
  ('_next'),('favicon.ico'),('robots.txt'),('sitemap.xml');

create function public.check_slug_not_reserved()
returns trigger language plpgsql as $$
begin
  if exists (select 1 from public.reserved_slugs where slug = new.slug) then
    raise exception 'Slug "%" is reserved', new.slug;
  end if;
  return new;
end;
$$;

create trigger trg_shops_slug_reserved
  before insert or update of slug on public.shops
  for each row execute procedure public.check_slug_not_reserved();

-- ---------------------------------------------------------
-- SHOP MEMBERS (owner + staff, many-to-many-ready)
-- ---------------------------------------------------------
create table public.shop_members (
  id uuid primary key default uuid_generate_v4(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role shop_member_role not null default 'STAFF',
  permissions jsonb not null default '{"products": false, "orders": false}'::jsonb,
  created_at timestamptz not null default now(),
  unique (shop_id, user_id)
);

create index idx_shop_members_user on public.shop_members(user_id);
create index idx_shop_members_shop on public.shop_members(shop_id);

-- Keep an OWNER row in shop_members whenever a shop is created.
create function public.handle_new_shop()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.shop_members (shop_id, user_id, role, permissions)
  values (new.id, new.owner_id, 'OWNER', '{"products": true, "orders": true}'::jsonb);
  return new;
end;
$$;

create trigger on_shop_created
  after insert on public.shops
  for each row execute procedure public.handle_new_shop();

-- ---------------------------------------------------------
-- PRODUCT CATEGORIES
-- ---------------------------------------------------------
create table public.product_categories (
  id uuid primary key default uuid_generate_v4(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (shop_id, slug)
);

create index idx_categories_shop on public.product_categories(shop_id);

-- ---------------------------------------------------------
-- PRODUCTS
-- ---------------------------------------------------------
create table public.products (
  id uuid primary key default uuid_generate_v4(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  category_id uuid references public.product_categories(id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text check (char_length(description) <= 3000),
  price numeric(10,2) not null check (price >= 0),
  available boolean not null default true,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, slug)
);

create index idx_products_shop on public.products(shop_id);
create index idx_products_shop_available on public.products(shop_id, available);
create index idx_products_category on public.products(category_id);

create table public.product_images (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references public.products(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  storage_path text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_product_images_product on public.product_images(product_id);
create index idx_product_images_shop on public.product_images(shop_id);

-- ---------------------------------------------------------
-- CUSTOMERS (per-shop, not shared across tenants)
-- ---------------------------------------------------------
create table public.customers (
  id uuid primary key default uuid_generate_v4(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  phone text not null,
  created_at timestamptz not null default now(),
  unique (shop_id, phone)
);

create index idx_customers_shop on public.customers(shop_id);

-- ---------------------------------------------------------
-- ORDERS
-- ---------------------------------------------------------
create table public.orders (
  id uuid primary key default uuid_generate_v4(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  status order_status not null default 'NEW',
  total_amount numeric(10,2) check (total_amount >= 0),
  delivery_date date,
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_orders_shop on public.orders(shop_id);
create index idx_orders_shop_status on public.orders(shop_id, status);

create table public.order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid not null references public.orders(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity int not null check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0)
);

create index idx_order_items_order on public.order_items(order_id);
create index idx_order_items_shop on public.order_items(shop_id);

-- ---------------------------------------------------------
-- CUSTOM ORDERS (the WhatsApp-driven custom order form)
-- ---------------------------------------------------------
create table public.custom_orders (
  id uuid primary key default uuid_generate_v4(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  customer_name text not null check (char_length(customer_name) between 1 and 120),
  customer_phone text not null,
  occasion text check (char_length(occasion) <= 120),
  product_type text check (char_length(product_type) <= 120),
  quantity int check (quantity > 0),
  budget_per_unit numeric(10,2) check (budget_per_unit >= 0),
  total_budget numeric(10,2) check (total_budget >= 0),
  desired_date date,
  instructions text check (char_length(instructions) <= 2000),
  status order_status not null default 'NEW',
  created_at timestamptz not null default now()
);

create index idx_custom_orders_shop on public.custom_orders(shop_id);

create table public.custom_order_images (
  id uuid primary key default uuid_generate_v4(),
  custom_order_id uuid not null references public.custom_orders(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index idx_custom_order_images_shop on public.custom_order_images(shop_id);

-- ---------------------------------------------------------
-- SHOP SETTINGS (1:1 extension of shops for less-hot fields)
-- ---------------------------------------------------------
create table public.shop_settings (
  shop_id uuid primary key references public.shops(id) on delete cascade,
  social_links jsonb not null default '{}'::jsonb,
  delivery_notes text,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- SUBSCRIPTIONS
-- ---------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default uuid_generate_v4(),
  shop_id uuid not null unique references public.shops(id) on delete cascade,
  plan text not null default 'starter',
  status subscription_status not null default 'TRIALING',
  trial_ends_at timestamptz not null default (now() + interval '14 days'),
  current_period_end timestamptz,
  provider text,               -- e.g. 'razorpay' (null until integrated)
  provider_customer_id text,
  provider_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_subscriptions_shop on public.subscriptions(shop_id);

create table public.subscription_events (
  id uuid primary key default uuid_generate_v4(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  event_type text not null,     -- e.g. 'trial_started', 'payment_succeeded'
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_subscription_events_shop on public.subscription_events(shop_id);

-- Auto-create a trialing subscription whenever a shop is created.
create function public.handle_new_shop_subscription()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.subscriptions (shop_id) values (new.id);
  return new;
end;
$$;

create trigger on_shop_created_subscription
  after insert on public.shops
  for each row execute procedure public.handle_new_shop_subscription();

-- ---------------------------------------------------------
-- AUDIT LOGS
-- ---------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default uuid_generate_v4(),
  shop_id uuid references public.shops(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,          -- e.g. 'product.delete', 'settings.update'
  target_type text,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_audit_logs_shop on public.audit_logs(shop_id);
create index idx_audit_logs_actor on public.audit_logs(actor_id);

-- ---------------------------------------------------------
-- updated_at maintenance trigger (generic)
-- ---------------------------------------------------------
create function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_shops_updated_at before update on public.shops
  for each row execute procedure public.set_updated_at();
create trigger trg_products_updated_at before update on public.products
  for each row execute procedure public.set_updated_at();
create trigger trg_orders_updated_at before update on public.orders
  for each row execute procedure public.set_updated_at();
create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();
create trigger trg_subscriptions_updated_at before update on public.subscriptions
  for each row execute procedure public.set_updated_at();
