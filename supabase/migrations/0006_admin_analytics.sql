-- =========================================================
-- Sweetly — Migration 0006: Platform Admin Analytics Access
--
-- Enables PLATFORM_ADMIN users to query orders, revenue,
-- customers, and catalog items across all shops for the Super
-- Admin dashboard and shop performance analytics.
-- =========================================================

-- Orders read for platform admins
drop policy if exists "orders: admin can read all" on public.orders;
create policy "orders: admin can read all" on public.orders
  for select using (is_platform_admin());

-- Order items read for platform admins
drop policy if exists "order_items: admin can read all" on public.order_items;
create policy "order_items: admin can read all" on public.order_items
  for select using (is_platform_admin());

-- Custom orders read for platform admins
drop policy if exists "custom_orders: admin can read all" on public.custom_orders;
create policy "custom_orders: admin can read all" on public.custom_orders
  for select using (is_platform_admin());

-- Customers read for platform admins
drop policy if exists "customers: admin can read all" on public.customers;
create policy "customers: admin can read all" on public.customers
  for select using (is_platform_admin());

-- Products read for platform admins
drop policy if exists "products: admin can read all" on public.products;
create policy "products: admin can read all" on public.products
  for select using (is_platform_admin());
