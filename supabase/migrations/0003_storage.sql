-- =========================================================
-- Sweetly — Storage buckets & policies
-- Path convention (enforced by policies below, not just app code):
--   shops/{shop_id}/logo/...
--   shops/{shop_id}/cover/...
--   shops/{shop_id}/products/{product_id}/...
--   shops/{shop_id}/custom-orders/{custom_order_id}/...
-- The {shop_id} path segment is checked against shop_members on
-- every write, so a client cannot upload into another shop's
-- folder even if it guesses/forges a shop_id in the path.
-- =========================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('shop-assets', 'shop-assets', true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('custom-order-refs', 'custom-order-refs', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- shop-assets: public read (storefront images must be visible to
-- anonymous visitors), write restricted to members of that shop.
create policy "shop-assets: public read"
  on storage.objects for select
  using (bucket_id = 'shop-assets');

create policy "shop-assets: members can upload to own shop folder"
  on storage.objects for insert
  with check (
    bucket_id = 'shop-assets'
    and public.is_shop_member(((storage.foldername(name))[1])::uuid)
  );

create policy "shop-assets: members can update own shop folder"
  on storage.objects for update
  using (
    bucket_id = 'shop-assets'
    and public.is_shop_member(((storage.foldername(name))[1])::uuid)
  );

create policy "shop-assets: members can delete own shop folder"
  on storage.objects for delete
  using (
    bucket_id = 'shop-assets'
    and public.is_shop_member(((storage.foldername(name))[1])::uuid)
  );

-- custom-order-refs: private. Only shop members (staff who handle
-- orders) can read; uploads happen through a server route using the
-- service role after validating the submission, so there is no
-- public/anon insert policy here.
create policy "custom-order-refs: members can read own shop folder"
  on storage.objects for select
  using (
    bucket_id = 'custom-order-refs'
    and public.is_shop_member(((storage.foldername(name))[1])::uuid)
  );
