-- =========================================================
-- Sweetly — Migration 0008: Sections, Product Variants, Multi-Category, Themes & Custom Order Enhancements
-- =========================================================

-- 1. Product Sections / Groups (e.g. Best Sellers, Bakery, Fancy Bags & Gifts)
create table if not exists public.product_sections (
  id uuid primary key default uuid_generate_v4(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text check (char_length(description) <= 500),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (shop_id, slug)
);

create index if not exists idx_product_sections_shop on public.product_sections(shop_id);

-- RLS for product sections
alter table public.product_sections enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'product_sections' and policyname = 'sections: public can read for published shop') then
    create policy "sections: public can read for published shop" on public.product_sections
      for select using (
        exists (select 1 from public.shops s where s.id = shop_id and s.is_published)
      );
  end if;
  if not exists (select 1 from pg_policies where tablename = 'product_sections' and policyname = 'sections: members can read own shop') then
    create policy "sections: members can read own shop" on public.product_sections
      for select using (public.is_shop_member(shop_id));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'product_sections' and policyname = 'sections: staff with perm can write') then
    create policy "sections: staff with perm can write" on public.product_sections
      for insert with check (public.has_shop_permission(shop_id, 'products'));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'product_sections' and policyname = 'sections: staff with perm can update') then
    create policy "sections: staff with perm can update" on public.product_sections
      for update using (public.has_shop_permission(shop_id, 'products'));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'product_sections' and policyname = 'sections: staff with perm can delete') then
    create policy "sections: staff with perm can delete" on public.product_sections
      for delete using (public.has_shop_permission(shop_id, 'products'));
  end if;
end $$;

-- 2. Enhance Products Table for Variants, Sizes, Colors, Multi-Category & Multi-Section
alter table public.products
  add column if not exists section_id uuid references public.product_sections(id) on delete set null,
  add column if not exists section_ids uuid[] not null default '{}',
  add column if not exists category_ids uuid[] not null default '{}',
  add column if not exists categories text[] not null default '{}',
  add column if not exists has_variants boolean not null default false,
  add column if not exists variants jsonb not null default '[]'::jsonb,
  add column if not exists sizes text[] not null default '{}',
  add column if not exists colors text[] not null default '{}';

create index if not exists idx_products_section on public.products(section_id);
create index if not exists idx_products_section_ids on public.products using gin(section_ids);
create index if not exists idx_products_category_ids on public.products using gin(category_ids);
create index if not exists idx_products_categories on public.products using gin(categories);
create index if not exists idx_products_sizes on public.products using gin(sizes);
create index if not exists idx_products_colors on public.products using gin(colors);

-- 3. Enhance Custom Orders with Category & Reference Product Link
alter table public.custom_orders
  add column if not exists category_id uuid references public.product_categories(id) on delete set null,
  add column if not exists reference_product_id uuid references public.products(id) on delete set null;

create index if not exists idx_custom_orders_category on public.custom_orders(category_id);
create index if not exists idx_custom_orders_reference_product on public.custom_orders(reference_product_id);

-- 4. Reload PostgREST schema cache immediately
notify pgrst, 'reload schema';
