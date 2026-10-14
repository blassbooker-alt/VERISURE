-- Demo-only FortalShop orders for Mercado Pago sandbox.
-- Prices in this catalog are suggested references from the user-provided PDF;
-- they are not live offers, inventory, or fulfillment commitments.

create table if not exists public.shop_products (
  id text primary key check (id ~ '^[a-z0-9_-]{3,80}$'),
  name text not null check (char_length(name) between 2 and 160),
  category text not null check (char_length(category) between 2 and 80),
  price numeric(10,2) not null check (price > 0),
  currency char(3) not null default 'BRL' check (currency = 'BRL'),
  asset_category text not null default 'produtos',
  asset_filename text not null,
  active boolean not null default true,
  is_demo boolean not null default true check (is_demo),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete restrict,
  idempotency_key uuid not null,
  status text not null default 'awaiting_payment'
    check (status in ('awaiting_payment', 'approved', 'cancelled', 'refunded')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'approved', 'rejected', 'cancelled', 'refunded')),
  test_mode boolean not null default true check (test_mode),
  currency char(3) not null default 'BRL' check (currency = 'BRL'),
  total numeric(10,2) not null default 0 check (total >= 0),
  preference_id text unique,
  payment_id text,
  checkout_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  unique (customer_id, idempotency_key)
);
create index if not exists shop_orders_customer_created_idx
  on public.shop_orders(customer_id, created_at desc);

create table if not exists public.shop_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.shop_orders(id) on delete cascade,
  product_id text references public.shop_products(id) on delete set null,
  product_name_snapshot text not null,
  quantity integer not null check (quantity between 1 and 20),
  unit_price numeric(10,2) not null check (unit_price > 0),
  image_category_snapshot text not null,
  image_filename_snapshot text not null,
  created_at timestamptz not null default now()
);
create index if not exists shop_order_items_order_idx on public.shop_order_items(order_id);

create table if not exists public.shop_payment_events (
  id uuid primary key default gen_random_uuid(),
  provider_payment_id text not null,
  provider_status text not null,
  order_id uuid not null references public.shop_orders(id) on delete cascade,
  amount numeric(10,2) not null check (amount >= 0),
  currency char(3) not null check (currency = 'BRL'),
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  unique (provider_payment_id, provider_status)
);

insert into public.shop_products (id, name, category, price, asset_filename) values
  ('performance-tee', 'Camiseta Performance Preta', 'Roupas', 89.90, 'camiseta-performance-preta.jpg'),
  ('performance-tee-white', 'Camiseta Performance Branca', 'Roupas', 89.90, 'camiseta-performance-branca.jpg'),
  ('performance-tee-green', 'Camiseta Performance Verde', 'Roupas', 89.90, 'camiseta-performance-verde.jpg'),
  ('cropped-lime', 'Camiseta Cropped Lima', 'Roupas', 79.90, 'camiseta-cropped-lima.jpg'),
  ('training-tank', 'Regata de Treino Grafite', 'Roupas', 79.90, 'regata-treino-grafite.jpg'),
  ('thermal-bottle', 'Garrafa Térmica 750 ml', 'Acessórios', 69.90, 'garrafa-termica-750ml-verde.jpg'),
  ('thermal-bottle-500', 'Garrafa Térmica 500 ml', 'Acessórios', 59.90, 'garrafa-termica-500ml-lima.jpg'),
  ('thermal-cup-black', 'Copo Térmico Preto', 'Acessórios', 69.90, 'copo-termico-preto.jpg'),
  ('protein-shaker', 'Shaker para Proteína', 'Acessórios', 39.90, 'shaker-proteina-verde.jpg'),
  ('reusable-cup', 'Copo Reutilizável Branco', 'Acessórios', 39.90, 'copo-reutilizavel-branco.jpg'),
  ('training-mat', 'Tapete de Yoga Verde', 'Treino em casa', 89.90, 'tapete-yoga-verde.jpg'),
  ('resistance-band', 'Faixa de Resistência Lima', 'Treino em casa', 29.90, 'faixa-resistencia-lima.jpg'),
  ('mini-bands', 'Kit Mini Bands', 'Treino em casa', 49.90, 'mini-bands-kit.jpg'),
  ('jump-rope', 'Corda de Pular Preta', 'Treino em casa', 29.90, 'corda-pular-preta.jpg'),
  ('training-gloves', 'Luvas de Treino Grafite', 'Acessórios', 49.90, 'luvas-treino-grafite.jpg'),
  ('foam-roller', 'Rolo Miofascial Verde', 'Recovery', 89.90, 'rolo-miofascial-verde.jpg'),
  ('massage-ball', 'Bola de Massagem Lima', 'Recovery', 29.90, 'bola-massagem-lima.jpg'),
  ('yoga-block', 'Bloco de Yoga Areia', 'Recovery', 29.90, 'bloco-yoga-areia.jpg'),
  ('performance-towel', 'Toalha Performance Branca', 'Acessórios', 29.90, 'toalha-performance-branca.jpg'),
  ('wellness-pouch', 'Necessaire Wellness Verde', 'Wellness', 59.90, 'necessaire-wellness-verde.jpg'),
  ('starter-kit', 'Kit Começo Forte', 'Kits Fortalfy', 149.90, 'kit-comeco-forte.jpg'),
  ('home-training-kit', 'Kit Treino em Casa', 'Kits Fortalfy', 179.90, 'kit-treino-casa.jpg'),
  ('recovery-kit', 'Kit Recovery Total', 'Kits Fortalfy', 249.90, 'kit-recovery-total.jpg'),
  ('hydration-kit', 'Kit Hidratação', 'Kits Fortalfy', 129.90, 'kit-hidratacao.jpg'),
  ('wellness-gift-kit', 'Kit Presente Wellness', 'Kits Fortalfy', 199.90, 'kit-presente-wellness.jpg')
on conflict (id) do nothing;

alter table public.shop_products enable row level security;
alter table public.shop_orders enable row level security;
alter table public.shop_order_items enable row level security;
alter table public.shop_payment_events enable row level security;

drop policy if exists "read active demo shop products" on public.shop_products;
create policy "read active demo shop products" on public.shop_products
  for select to anon, authenticated using (active and is_demo);
drop policy if exists "customers read own sandbox shop orders" on public.shop_orders;
create policy "customers read own sandbox shop orders" on public.shop_orders
  for select to authenticated using (auth.uid() = customer_id);
drop policy if exists "customers read own sandbox order items" on public.shop_order_items;
create policy "customers read own sandbox order items" on public.shop_order_items
  for select to authenticated using (
    exists (
      select 1 from public.shop_orders o
      where o.id = order_id and o.customer_id = auth.uid()
    )
  );
grant select on public.shop_products to anon, authenticated;
grant select on public.shop_orders, public.shop_order_items to authenticated;

create or replace function public.create_mp_sandbox_shop_order(
  p_customer_id uuid,
  p_idempotency_key uuid,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_id uuid;
  line record;
  product_row public.shop_products%rowtype;
  order_total numeric(10,2) := 0;
  item_count integer;
begin
  if p_customer_id is null or p_idempotency_key is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1
     or jsonb_array_length(p_items) > 20 then
    raise exception 'Invalid sandbox order';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as requested(product_id text, quantity integer)
    group by requested.product_id
    having count(*) > 1
  ) then
    raise exception 'Duplicate product lines are not allowed';
  end if;

  insert into public.shop_orders (customer_id, idempotency_key)
  values (p_customer_id, p_idempotency_key)
  on conflict (customer_id, idempotency_key) do nothing
  returning id into order_id;

  if order_id is null then
    select existing.id into order_id
    from public.shop_orders existing
    where existing.customer_id = p_customer_id
      and existing.idempotency_key = p_idempotency_key;
    if (
      select count(*) from jsonb_to_recordset(p_items) as requested(product_id text, quantity integer)
    ) <> (
      select count(*) from public.shop_order_items where shop_order_items.order_id = order_id
    ) or exists (
      select 1
      from jsonb_to_recordset(p_items) as requested(product_id text, quantity integer)
      full join public.shop_order_items existing_item
        on existing_item.order_id = order_id
        and existing_item.product_id = requested.product_id
        and existing_item.quantity = requested.quantity
      where requested.product_id is null or existing_item.id is null
    ) then
      raise exception 'Idempotency key was already used for a different sandbox cart';
    end if;
    return jsonb_build_object(
      'order_id', order_id,
      'total', (select total from public.shop_orders where id = order_id),
      'currency', 'BRL',
      'items', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', product_id,
          'title', product_name_snapshot,
          'quantity', quantity,
          'unit_price', unit_price,
          'currency_id', 'BRL'
        ))
        from public.shop_order_items where shop_order_items.order_id = order_id
      ), '[]'::jsonb)
    );
  end if;

  for line in
    select requested.product_id, requested.quantity
    from jsonb_to_recordset(p_items) as requested(product_id text, quantity integer)
  loop
    if line.quantity is null or line.quantity < 1 or line.quantity > 20 then
      raise exception 'Invalid product quantity';
    end if;

    select * into product_row
    from public.shop_products
    where id = line.product_id and active and is_demo
    for share;

    if not found then
      raise exception 'Product is not available in the sandbox catalog';
    end if;

    insert into public.shop_order_items (
      order_id, product_id, product_name_snapshot, quantity, unit_price,
      image_category_snapshot, image_filename_snapshot
    )
    values (
      order_id, product_row.id, product_row.name, line.quantity, product_row.price,
      product_row.asset_category, product_row.asset_filename
    );
    order_total := order_total + product_row.price * line.quantity;
  end loop;

  update public.shop_orders set total = order_total, updated_at = now()
  where id = order_id and customer_id = p_customer_id;

  return jsonb_build_object(
    'order_id', order_id,
    'total', order_total,
    'currency', 'BRL',
    'items', (
      select jsonb_agg(jsonb_build_object(
        'id', product_id,
        'title', product_name_snapshot,
        'quantity', quantity,
        'unit_price', unit_price,
        'currency_id', 'BRL'
      ))
      from public.shop_order_items where shop_order_items.order_id = order_id
    )
  );
end;
$$;

create or replace function public.set_mp_sandbox_shop_preference(
  p_order_id uuid,
  p_customer_id uuid,
  p_preference_id text,
  p_checkout_url text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_preference_id is null or p_checkout_url is null
     or p_checkout_url !~ '^https://([a-z0-9-]+[.])*mercadopago[.]com([.]br)?([./:]|$)' then
    raise exception 'Invalid sandbox checkout destination';
  end if;
  update public.shop_orders
  set preference_id = p_preference_id, checkout_url = p_checkout_url, updated_at = now()
  where id = p_order_id and customer_id = p_customer_id and test_mode
    and status = 'awaiting_payment'
    and (preference_id is null or preference_id = p_preference_id);
  if not found then
    raise exception 'Sandbox order was not found or is no longer payable';
  end if;
end;
$$;

create or replace function public.record_mp_sandbox_shop_payment(
  p_order_id uuid,
  p_payment_id text,
  p_status text,
  p_amount numeric,
  p_currency text,
  p_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_row public.shop_orders%rowtype;
begin
  if p_status not in ('pending', 'approved', 'rejected', 'cancelled', 'refunded')
     or p_payment_id is null or p_payment_id = ''
     or p_currency <> 'BRL' then
    raise exception 'Invalid sandbox payment event';
  end if;

  select * into order_row
  from public.shop_orders
  where id = p_order_id and test_mode
  for update;
  if not found then
    raise exception 'Sandbox order not found';
  end if;
  if p_amount is null or p_amount <= 0 or abs(order_row.total - p_amount) > 0.01 then
    raise exception 'Sandbox payment amount does not match the order';
  end if;
  if order_row.status in ('cancelled', 'refunded') and p_status = 'approved' then
    raise exception 'Cancelled sandbox order cannot be approved';
  end if;
  if p_status = 'refunded' and order_row.status not in ('approved', 'refunded') then
    raise exception 'Only an approved sandbox order can be refunded';
  end if;
  if order_row.status = 'approved' and p_status = 'approved'
     and order_row.payment_id is distinct from p_payment_id then
    raise exception 'Sandbox order already has a different approved payment';
  end if;

  insert into public.shop_payment_events (
    provider_payment_id, provider_status, order_id, amount, currency, payload
  )
  values (
    p_payment_id, p_status, p_order_id, p_amount, p_currency,
    coalesce(p_payload, '{}'::jsonb)
  )
  on conflict (provider_payment_id, provider_status) do nothing;

  update public.shop_orders
  set payment_id = p_payment_id,
      payment_status = case
        when p_status = 'refunded' and status = 'approved' then 'refunded'
        when status = 'approved' then 'approved'
        when p_status = 'approved' then 'approved'
        when p_status = 'cancelled' then 'cancelled'
        when p_status = 'refunded' then 'refunded'
        when p_status = 'rejected' then 'rejected'
        else 'pending'
      end,
      status = case
        when status = 'approved' and p_status <> 'refunded' then 'approved'
        when p_status = 'approved' then 'approved'
        when p_status = 'cancelled' then 'cancelled'
        when p_status = 'refunded' and status = 'approved' then 'refunded'
        else status
      end,
      paid_at = case when p_status = 'approved' then coalesce(paid_at, now()) else paid_at end,
      updated_at = now()
  where id = p_order_id;
end;
$$;

revoke all on function public.create_mp_sandbox_shop_order(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.set_mp_sandbox_shop_preference(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.record_mp_sandbox_shop_payment(uuid, text, text, numeric, text, jsonb) from public, anon, authenticated;
grant execute on function public.create_mp_sandbox_shop_order(uuid, uuid, jsonb) to service_role;
grant execute on function public.set_mp_sandbox_shop_preference(uuid, uuid, text, text) to service_role;
grant execute on function public.record_mp_sandbox_shop_payment(uuid, text, text, numeric, text, jsonb) to service_role;
