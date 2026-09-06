-- =========================================================
-- Sweetly — Row Level Security
-- Every exposed table has RLS enabled. No table is trusted
-- to the client without a policy. Ownership is always
-- re-derived server-side from auth.uid(), never from a
-- client-supplied shop_id/owner_id.
-- =========================================================

-- ---------------------------------------------------------
-- Helper functions (security definer, used inside policies)
-- ---------------------------------------------------------

-- Is the current user a member of this shop (owner or staff)?
create or replace function public.is_shop_member(target_shop_id uuid)
returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.shop_members
    where shop_id = target_shop_id and user_id = auth.uid()
  );
$$;

-- Is the current user the OWNER of this shop?
create or replace function public.is_shop_owner(target_shop_id uuid)
returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.shop_members
    where shop_id = target_shop_id and user_id = auth.uid() and role = 'OWNER'
  );
$$;

-- Does the current user have a specific staff permission on this shop
-- (owners implicitly pass)?
create or replace function public.has_shop_permission(target_shop_id uuid, perm text)
returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.shop_members
    where shop_id = target_shop_id
      and user_id = auth.uid()
      and (role = 'OWNER' or coalesce((permissions ->> perm)::boolean, false))
  );
$$;

-- Is the current user a platform admin?
create or replace function public.is_platform_admin()
returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and platform_role = 'PLATFORM_ADMIN'
  );
$$;

-- ---------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.shops enable row level security;
alter table public.shop_members enable row level security;
alter table public.product_categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.custom_orders enable row level security;
alter table public.custom_order_images enable row level security;
alter table public.shop_settings enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_events enable row level security;
alter table public.audit_logs enable row level security;
alter table public.reserved_slugs enable row level security;

-- ---------------------------------------------------------
-- PROFILES
-- ---------------------------------------------------------
create policy "profiles: self read" on public.profiles
  for select using (id = auth.uid() or is_platform_admin());

create policy "profiles: self update" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
-- No public insert/delete policy: rows are created only by the
-- handle_new_user() trigger (security definer), never by client insert.

-- ---------------------------------------------------------
-- SHOPS
-- Public storefronts must be readable by anyone (published shops
-- only); owners/staff can read+write their own shop regardless of
-- publish state; admins can read everything.
-- ---------------------------------------------------------
create policy "shops: public can read published" on public.shops
  for select using (is_published = true);

create policy "shops: members can read own" on public.shops
  for select using (is_shop_member(id) or is_platform_admin());

create policy "shops: owner can insert own" on public.shops
  for insert with check (owner_id = auth.uid());

create policy "shops: owner can update own" on public.shops
  for update using (is_shop_owner(id)) with check (owner_id = auth.uid());

create policy "shops: owner can delete own" on public.shops
  for delete using (is_shop_owner(id));

-- ---------------------------------------------------------
-- SHOP_MEMBERS
-- Only owners manage membership; members can see their own shop's
-- member list (needed to render staff management UI).
-- ---------------------------------------------------------
create policy "members: shop members can read" on public.shop_members
  for select using (is_shop_member(shop_id) or is_platform_admin());

create policy "members: owner can insert" on public.shop_members
  for insert with check (is_shop_owner(shop_id));

create policy "members: owner can update" on public.shop_members
  for update using (is_shop_owner(shop_id));

create policy "members: owner can delete" on public.shop_members
  for delete using (is_shop_owner(shop_id) and role <> 'OWNER');

-- ---------------------------------------------------------
-- PRODUCT_CATEGORIES
-- ---------------------------------------------------------
create policy "categories: public can read (via published shop)" on public.product_categories
  for select using (
    exists (select 1 from public.shops s where s.id = shop_id and s.is_published)
  );

create policy "categories: members can read own shop" on public.product_categories
  for select using (is_shop_member(shop_id));

create policy "categories: staff with perm can write" on public.product_categories
  for insert with check (has_shop_permission(shop_id, 'products'));
create policy "categories: staff with perm can update" on public.product_categories
  for update using (has_shop_permission(shop_id, 'products'));
create policy "categories: staff with perm can delete" on public.product_categories
  for delete using (has_shop_permission(shop_id, 'products'));

-- ---------------------------------------------------------
-- PRODUCTS
-- ---------------------------------------------------------
create policy "products: public can read available in published shop" on public.products
  for select using (
    available = true
    and exists (select 1 from public.shops s where s.id = shop_id and s.is_published)
  );

create policy "products: members can read own shop (any state)" on public.products
  for select using (is_shop_member(shop_id));

create policy "products: staff with perm can insert" on public.products
  for insert with check (has_shop_permission(shop_id, 'products'));
create policy "products: staff with perm can update" on public.products
  for update using (has_shop_permission(shop_id, 'products'));
create policy "products: staff with perm can delete" on public.products
  for delete using (has_shop_permission(shop_id, 'products'));

-- ---------------------------------------------------------
-- PRODUCT_IMAGES
-- ---------------------------------------------------------
create policy "product_images: public can read for published shop" on public.product_images
  for select using (
    exists (select 1 from public.shops s where s.id = shop_id and s.is_published)
  );

create policy "product_images: members can read own shop" on public.product_images
  for select using (is_shop_member(shop_id));

create policy "product_images: staff with perm can write" on public.product_images
  for insert with check (has_shop_permission(shop_id, 'products'));
create policy "product_images: staff with perm can delete" on public.product_images
  for delete using (has_shop_permission(shop_id, 'products'));

-- ---------------------------------------------------------
-- CUSTOMERS — never public. Shop-scoped only.
-- ---------------------------------------------------------
create policy "customers: members can read own shop" on public.customers
  for select using (is_shop_member(shop_id));
create policy "customers: staff with perm can insert" on public.customers
  for insert with check (has_shop_permission(shop_id, 'orders'));
create policy "customers: staff with perm can update" on public.customers
  for update using (has_shop_permission(shop_id, 'orders'));

-- Note: customer rows created from the public order form are inserted
-- via a server route using the service role (after validation), not
-- directly by anonymous clients — see src/lib/orders.ts.

-- ---------------------------------------------------------
-- ORDERS — never public. Shop-scoped only.
-- ---------------------------------------------------------
create policy "orders: members can read own shop" on public.orders
  for select using (is_shop_member(shop_id));
create policy "orders: staff with perm can update" on public.orders
  for update using (has_shop_permission(shop_id, 'orders'));
create policy "orders: staff with perm can delete" on public.orders
  for delete using (has_shop_permission(shop_id, 'orders'));
-- No public insert policy: orders are written server-side (service role)
-- after validating the public request, so anon INSERT is intentionally
-- absent here.

-- ---------------------------------------------------------
-- ORDER_ITEMS
-- ---------------------------------------------------------
create policy "order_items: members can read own shop" on public.order_items
  for select using (is_shop_member(shop_id));

-- ---------------------------------------------------------
-- CUSTOM_ORDERS — never public. Shop-scoped only.
-- ---------------------------------------------------------
create policy "custom_orders: members can read own shop" on public.custom_orders
  for select using (is_shop_member(shop_id));
create policy "custom_orders: staff with perm can update" on public.custom_orders
  for update using (has_shop_permission(shop_id, 'orders'));

create policy "custom_order_images: members can read own shop" on public.custom_order_images
  for select using (is_shop_member(shop_id));

-- ---------------------------------------------------------
-- SHOP_SETTINGS
-- ---------------------------------------------------------
create policy "shop_settings: members can read own shop" on public.shop_settings
  for select using (is_shop_member(shop_id));
create policy "shop_settings: owner can upsert" on public.shop_settings
  for insert with check (is_shop_owner(shop_id));
create policy "shop_settings: owner can update" on public.shop_settings
  for update using (is_shop_owner(shop_id));

-- ---------------------------------------------------------
-- SUBSCRIPTIONS — owner-only, never public, never staff-writable.
-- ---------------------------------------------------------
create policy "subscriptions: owner can read own" on public.subscriptions
  for select using (is_shop_owner(shop_id) or is_platform_admin());
-- No client update/insert/delete policy at all: subscription state
-- changes only through the server-side webhook handler using the
-- service role key. This prevents a client from ever marking its
-- own subscription "ACTIVE".

create policy "subscription_events: owner can read own" on public.subscription_events
  for select using (is_shop_owner(shop_id) or is_platform_admin());

-- ---------------------------------------------------------
-- AUDIT_LOGS — owner can read their shop's log; writes are
-- server-side only (service role), never client-writable.
-- ---------------------------------------------------------
create policy "audit_logs: owner can read own shop" on public.audit_logs
  for select using (
    (shop_id is not null and is_shop_owner(shop_id)) or is_platform_admin()
  );

-- ---------------------------------------------------------
-- RESERVED_SLUGS — public read-only (used for client-side slug
-- suggestion UX); writes are admin-only via migrations.
-- ---------------------------------------------------------
create policy "reserved_slugs: public read" on public.reserved_slugs
  for select using (true);
