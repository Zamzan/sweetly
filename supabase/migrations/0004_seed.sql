-- =========================================================
-- Sweetly — DEMO SEED DATA
-- This file is OPTIONAL and for local/staging demos only.
-- Do NOT run this against a production database.
-- It creates "Rahman Sweets" with sample products/categories.
--
-- Prerequisite: create an auth user for the demo owner first
-- (via Supabase Dashboard -> Authentication, or supabase-js
-- signUp), then replace :demo_owner_id below with that user's
-- UUID before running.
-- =========================================================

-- Example (run manually, replacing the UUID):
-- \set demo_owner_id 'REPLACE-WITH-REAL-AUTH-USER-UUID'

do $$
declare
  v_owner_id uuid := 'REPLACE-WITH-REAL-AUTH-USER-UUID'::uuid;
  v_shop_id uuid;
  v_cat_traditional uuid;
  v_cat_wedding uuid;
  v_cat_giftbox uuid;
  v_cat_cakes uuid;
  v_cat_hampers uuid;
  v_cat_custom uuid;
begin
  insert into public.shops (
    owner_id, name, slug, description, whatsapp_number, phone,
    city, state, is_published
  ) values (
    v_owner_id,
    'Rahman Sweets',
    'rahman-sweets',
    'Traditional sweets for every occasion. Weddings, birthdays, festivals and more.',
    '+919812345678',
    '+919812345678',
    'Kochi', 'Kerala',
    true
  ) returning id into v_shop_id;

  insert into public.product_categories (shop_id, name, slug, sort_order) values
    (v_shop_id, 'Traditional Sweets', 'traditional-sweets', 1) returning id into v_cat_traditional;
  insert into public.product_categories (shop_id, name, slug, sort_order) values
    (v_shop_id, 'Wedding Gifts', 'wedding-gifts', 2) returning id into v_cat_wedding;
  insert into public.product_categories (shop_id, name, slug, sort_order) values
    (v_shop_id, 'Gift Boxes', 'gift-boxes', 3) returning id into v_cat_giftbox;
  insert into public.product_categories (shop_id, name, slug, sort_order) values
    (v_shop_id, 'Cakes', 'cakes', 4) returning id into v_cat_cakes;
  insert into public.product_categories (shop_id, name, slug, sort_order) values
    (v_shop_id, 'Hampers', 'hampers', 5) returning id into v_cat_hampers;
  insert into public.product_categories (shop_id, name, slug, sort_order) values
    (v_shop_id, 'Custom', 'custom', 6) returning id into v_cat_custom;

  insert into public.products (shop_id, category_id, name, slug, description, price, featured) values
    (v_shop_id, v_cat_wedding, 'Royal Wedding Box', 'royal-wedding-box', 'A premium selection of traditional sweets beautifully packed for your special day.', 799, true),
    (v_shop_id, v_cat_traditional, 'Premium Sweet Box', 'premium-sweet-box', 'Assorted traditional favourites in a gift-ready box.', 499, true),
    (v_shop_id, v_cat_traditional, 'Dry Fruit Mix', 'dry-fruit-mix', 'A rich mix of dry fruits and nuts.', 599, false),
    (v_shop_id, v_cat_cakes, 'Chocolate Truffle Cake', 'chocolate-truffle-cake', 'Rich chocolate truffle cake, freshly baked.', 899, true),
    (v_shop_id, v_cat_hampers, 'Custom Wedding Hamper', 'custom-wedding-hamper', 'A curated hamper for wedding celebrations, customizable on request.', 1499, false),
    (v_shop_id, v_cat_giftbox, 'Bride-to-Be Gift Box', 'bride-to-be-gift-box', 'A thoughtful gift box for the bride-to-be.', 699, true);

  insert into public.shop_settings (shop_id) values (v_shop_id);
end $$;
