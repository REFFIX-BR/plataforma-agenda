-- Rumo: lojas, equipe, agenda e financeiro.
-- Plano gravado e ainda não cobrado: R$ 39,90 + R$ 10 por profissional ativo.
-- A criação de login de profissional usa o código de convite (join_store),
-- porque o Auth Admin do Supabase fica fora do SQL.

create extension if not exists btree_gist;
create extension if not exists pgcrypto;

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  vertical text not null check (vertical in ('estetica', 'barbearia', 'salao', 'manicure', 'spa', 'clinica')),
  phone text not null default '',
  address text not null default '',
  timezone text not null default 'America/Sao_Paulo',
  invite_code text not null unique,
  base_price_cents integer not null default 3990 check (base_price_cents >= 0),
  seat_price_cents integer not null default 1000 check (seat_price_cents >= 0),
  brand_color text check (brand_color is null or brand_color ~ '^#[0-9a-f]{6}$'),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  role text not null check (role in ('owner', 'professional')),
  full_name text not null check (char_length(trim(full_name)) between 2 and 80),
  active boolean not null default true,
  attends boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index profiles_one_owner on public.profiles (store_id) where role = 'owner';

create table public.commissions (
  professional_id uuid primary key references public.profiles (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  kind text not null check (kind in ('percent', 'fixed')),
  amount numeric not null check (amount >= 0),
  constraint commissions_percent_cap check (kind <> 'percent' or amount <= 100)
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 80),
  duration_min integer not null check (duration_min between 5 and 480),
  price_cents integer not null check (price_cents between 0 and 10000000),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.professional_services (
  professional_id uuid not null references public.profiles (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  primary key (professional_id, service_id)
);

create table public.business_hours (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  professional_id uuid references public.profiles (id) on delete cascade,
  weekday integer not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  enabled boolean not null default true,
  check (end_time > start_time)
);

create unique index business_hours_store_day
  on public.business_hours (store_id, weekday)
  where professional_id is null;

create unique index business_hours_professional_day
  on public.business_hours (professional_id, weekday)
  where professional_id is not null;

create table public.time_blocks (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  professional_id uuid references public.profiles (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null default '',
  check (ends_at > starts_at)
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  professional_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 80),
  phone text not null,
  phone_digits text generated always as (regexp_replace(phone, '\D', '', 'g')) stored,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index clients_store_phone on public.clients (store_id, professional_id, phone_digits);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  professional_id uuid not null references public.profiles (id) on delete restrict,
  client_id uuid not null references public.clients (id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled' check (
    status in ('scheduled', 'confirmed', 'in_progress', 'completed', 'no_show', 'cancelled')
  ),
  source text not null check (source in ('online', 'manual')),
  notes text not null default '',
  total_cents integer not null check (total_cents >= 0),
  commission_cents integer not null default 0 check (commission_cents >= 0),
  payment_method text check (payment_method in ('cash', 'pix', 'card')),
  duration_min integer check (duration_min is null or duration_min between 5 and 480),
  series_id uuid,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (status <> 'completed' or payment_method is not null)
);

create index appointments_store_start on public.appointments (store_id, starts_at);
create index appointments_professional_start on public.appointments (professional_id, starts_at);
create index appointments_series on public.appointments (series_id) where series_id is not null;

alter table public.appointments
  add constraint appointments_no_overlap
  exclude using gist (
    professional_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (status <> 'cancelled');

create table public.appointment_items (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  service_id uuid references public.services (id) on delete set null,
  name_snapshot text not null,
  price_cents integer not null check (price_cents >= 0),
  duration_min integer not null check (duration_min > 0),
  commission_kind text not null check (commission_kind in ('percent', 'fixed')),
  commission_amount numeric not null check (commission_amount >= 0)
);

create or replace function public.touch_block_conflict()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'cancelled' then
    return new;
  end if;
  if exists (
    select 1
    from public.time_blocks b
    where b.store_id = new.store_id
      and (b.professional_id is null or b.professional_id = new.professional_id)
      and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(new.starts_at, new.ends_at, '[)')
  ) then
    raise exception 'horario bloqueado' using errcode = '23P01';
  end if;
  return new;
end;
$$;

create trigger appointments_block_conflict
before insert or update of starts_at, ends_at, status, professional_id on public.appointments
for each row execute function public.touch_block_conflict();

create or replace function public.my_store_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select store_id from public.profiles where id = auth.uid() and active
$$;

create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create or replace function public.effective_hours(
  p_store uuid,
  p_professional uuid,
  p_weekday integer
)
returns table (enabled boolean, start_time time, end_time time)
language sql
stable
security definer
set search_path = public
as $$
  with own as (
    select h.enabled, h.start_time, h.end_time
    from public.business_hours h
    where h.professional_id = p_professional
      and h.weekday = p_weekday
    limit 1
  ),
  store as (
    select h.enabled, h.start_time, h.end_time
    from public.business_hours h
    where h.store_id = p_store
      and h.professional_id is null
      and h.weekday = p_weekday
    limit 1
  )
  select * from own
  union all
  select * from store
  where not exists (select 1 from own)
  limit 1
$$;

create or replace function public.available_slots(
  p_professional uuid,
  p_day date,
  p_duration_min integer
)
returns table (starts_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_store uuid;
  v_tz text;
  v_enabled boolean;
  v_open time;
  v_close time;
  v_cursor timestamptz;
  v_end timestamptz;
begin
  if p_duration_min < 5 or p_duration_min > 480 then
    return;
  end if;

  select p.store_id into v_store
  from public.profiles p
  where p.id = p_professional and p.active and p.attends;
  if v_store is null then
    return;
  end if;

  select s.timezone into v_tz from public.stores s where s.id = v_store;
  select h.enabled, h.start_time, h.end_time
    into v_enabled, v_open, v_close
  from public.effective_hours(v_store, p_professional, extract(dow from p_day)::integer) h;

  if not coalesce(v_enabled, false) then
    return;
  end if;

  v_cursor := (p_day + v_open) at time zone v_tz;
  v_end := (p_day + v_close) at time zone v_tz;

  while v_cursor + make_interval(mins => p_duration_min) <= v_end loop
    if v_cursor > now()
      and not exists (
        select 1 from public.appointments a
        where a.professional_id = p_professional
          and a.status <> 'cancelled'
          and a.starts_at < v_cursor + make_interval(mins => p_duration_min)
          and a.ends_at > v_cursor
      )
      and not exists (
        select 1 from public.time_blocks b
        where b.store_id = v_store
          and (b.professional_id is null or b.professional_id = p_professional)
          and b.starts_at < v_cursor + make_interval(mins => p_duration_min)
          and b.ends_at > v_cursor
      )
    then
      starts_at := v_cursor;
      return next;
    end if;
    v_cursor := v_cursor + interval '15 minutes';
  end loop;
end;
$$;

create or replace function public.book_appointment(
  p_store uuid,
  p_professional uuid,
  p_client_name text,
  p_client_phone text,
  p_service_ids uuid[],
  p_starts_at timestamptz,
  p_source text,
  p_notes text,
  p_duration_min integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
  v_store_tz text;
  v_day date;
  v_enabled boolean;
  v_open time;
  v_close time;
  v_window_start timestamptz;
  v_window_end timestamptz;
  v_duration integer := 0;
  v_price integer := 0;
  v_ends timestamptz;
  v_client uuid;
  v_digits text;
  v_kind text;
  v_amount numeric;
  v_commission integer := 0;
  v_id uuid;
  v_service record;
begin
  if p_source not in ('online', 'manual') then
    raise exception 'origem invalida';
  end if;
  if p_source = 'manual' and v_actor is null then
    raise exception 'login necessario' using errcode = '28000';
  end if;

  select role into v_role from public.profiles where id = v_actor and store_id = p_store and active;
  if p_source = 'manual' and v_role is null then
    raise exception 'sem acesso' using errcode = '42501';
  end if;
  if p_source = 'manual' and v_role <> 'owner' and v_actor <> p_professional then
    raise exception 'sem acesso' using errcode = '42501';
  end if;
  if p_source = 'online' and v_actor is not null and v_role is null then
    raise exception 'sem acesso' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_professional and store_id = p_store and active and attends
  ) then
    raise exception 'profissional indisponivel';
  end if;

  if p_service_ids is null or cardinality(p_service_ids) = 0 then
    raise exception 'escolha um servico';
  end if;

  for v_service in
    select s.id, s.name, s.duration_min, s.price_cents
    from public.services s
    where s.id = any (p_service_ids)
      and s.store_id = p_store
      and s.active
      and exists (
        select 1 from public.professional_services ps
        where ps.service_id = s.id and ps.professional_id = p_professional
      )
  loop
    v_duration := v_duration + v_service.duration_min;
    v_price := v_price + v_service.price_cents;
  end loop;

  if v_duration = 0 or v_duration <> (
    select coalesce(sum(s.duration_min), 0)
    from public.services s
    where s.id = any (p_service_ids)
  ) then
    raise exception 'servico indisponivel para esse profissional';
  end if;

  if p_duration_min is not null then
    if p_duration_min < 5 or p_duration_min > 480 then
      raise exception 'duracao invalida';
    end if;
    v_duration := p_duration_min;
  end if;

  select timezone into v_store_tz from public.stores where id = p_store;
  v_ends := p_starts_at + make_interval(mins => v_duration);
  v_day := (p_starts_at at time zone v_store_tz)::date;
  if (v_ends at time zone v_store_tz)::date <> v_day then
    raise exception 'o atendimento precisa caber no mesmo dia';
  end if;

  select h.enabled, h.start_time, h.end_time
    into v_enabled, v_open, v_close
  from public.effective_hours(p_store, p_professional, extract(dow from v_day)::integer) h;

  v_window_start := (v_day + v_open) at time zone v_store_tz;
  v_window_end := (v_day + v_close) at time zone v_store_tz;
  if not coalesce(v_enabled, false) or p_starts_at < v_window_start or v_ends > v_window_end then
    raise exception 'fora do horario de funcionamento';
  end if;

  v_digits := regexp_replace(coalesce(p_client_phone, ''), '\D', '', 'g');
  if char_length(trim(p_client_name)) < 2 or char_length(v_digits) < 8 then
    raise exception 'informe nome e telefone do cliente';
  end if;

  select id into v_client
  from public.clients
  where store_id = p_store and professional_id = p_professional and phone_digits = v_digits
  order by created_at
  limit 1;

  if v_client is null then
    insert into public.clients (store_id, professional_id, name, phone)
    values (p_store, p_professional, trim(p_client_name), trim(p_client_phone))
    returning id into v_client;
  end if;

  select c.kind, c.amount into v_kind, v_amount
  from public.commissions c
  where c.professional_id = p_professional;

  if v_role = 'professional' or exists (
    select 1 from public.profiles where id = p_professional and role = 'professional'
  ) then
    if v_kind = 'percent' then
      v_commission := round(v_price * v_amount / 100.0);
    elsif v_kind = 'fixed' then
      v_commission := round(v_amount);
    end if;
  end if;

  insert into public.appointments (
    store_id, professional_id, client_id, starts_at, ends_at, status, source, notes,
    total_cents, commission_cents, duration_min
  ) values (
    p_store, p_professional, v_client, p_starts_at, v_ends, 'scheduled', p_source,
    coalesce(p_notes, ''), v_price, v_commission, v_duration
  )
  returning id into v_id;

  insert into public.appointment_items (
    appointment_id, service_id, name_snapshot, price_cents, duration_min, commission_kind, commission_amount
  )
  select v_id, s.id, s.name, s.price_cents, s.duration_min, coalesce(v_kind, 'percent'), coalesce(v_amount, 0)
  from public.services s
  where s.id = any (p_service_ids);

  return v_id;
end;
$$;

create or replace function public.set_appointment_status(
  p_id uuid,
  p_status text,
  p_payment text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.appointments%rowtype;
  v_role text;
begin
  if p_status not in ('scheduled', 'confirmed', 'in_progress', 'completed', 'no_show', 'cancelled') then
    raise exception 'status invalido';
  end if;
  select * into v_row from public.appointments where id = p_id;
  if v_row.id is null then
    raise exception 'agendamento nao encontrado';
  end if;
  select role into v_role
  from public.profiles
  where id = auth.uid() and store_id = v_row.store_id and active;
  if v_role is null or (v_role <> 'owner' and auth.uid() <> v_row.professional_id) then
    raise exception 'sem acesso' using errcode = '42501';
  end if;
  if p_status = 'completed' and p_payment not in ('cash', 'pix', 'card') then
    raise exception 'informe como o cliente pagou';
  end if;

  update public.appointments
  set status = p_status,
      payment_method = case when p_status = 'completed' then p_payment else payment_method end
  where id = p_id;
end;
$$;

create or replace function public.create_store(
  p_name text,
  p_slug text,
  p_vertical text,
  p_phone text,
  p_address text,
  p_services jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_store uuid;
  v_code text;
  v_service jsonb;
  v_service_id uuid;
  v_weekday integer;
begin
  if v_user is null then
    raise exception 'login necessario' using errcode = '28000';
  end if;
  if exists (select 1 from public.profiles where id = v_user) then
    raise exception 'conta ja vinculada';
  end if;

  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from public.stores where invite_code = v_code);
  end loop;

  insert into public.stores (name, slug, vertical, phone, address, invite_code, base_price_cents, seat_price_cents)
  values (trim(p_name), p_slug, p_vertical, coalesce(p_phone, ''), coalesce(p_address, ''), v_code, 3990, 1000)
  returning id into v_store;

  insert into public.profiles (id, store_id, role, full_name, active, attends)
  values (v_user, v_store, 'owner', trim(p_name), true, true);

  insert into public.commissions (professional_id, store_id, kind, amount)
  values (v_user, v_store, 'percent', 0);

  for v_weekday in 0..6 loop
    insert into public.business_hours (store_id, professional_id, weekday, start_time, end_time, enabled)
    values (
      v_store,
      null,
      v_weekday,
      time '06:00',
      time '23:30',
      v_weekday between 1 and 6
    );
  end loop;

  for v_service in select * from jsonb_array_elements(coalesce(p_services, '[]'::jsonb))
  loop
    insert into public.services (store_id, name, duration_min, price_cents)
    values (
      v_store,
      v_service->>'name',
      (v_service->>'durationMin')::integer,
      (v_service->>'priceCents')::integer
    )
    returning id into v_service_id;
    insert into public.professional_services (professional_id, service_id)
    values (v_user, v_service_id);
  end loop;

  return v_store;
end;
$$;

create or replace function public.join_store(p_code text, p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_store uuid;
begin
  if v_user is null then
    raise exception 'login necessario' using errcode = '28000';
  end if;
  if exists (select 1 from public.profiles where id = v_user) then
    raise exception 'conta ja vinculada';
  end if;
  select id into v_store from public.stores where invite_code = upper(trim(p_code));
  if v_store is null then
    raise exception 'codigo nao encontrado';
  end if;

  insert into public.profiles (id, store_id, role, full_name, active, attends)
  values (v_user, v_store, 'professional', trim(p_name), true, true);
  insert into public.commissions (professional_id, store_id, kind, amount)
  values (v_user, v_store, 'percent', 50);
  insert into public.professional_services (professional_id, service_id)
  select v_user, s.id from public.services s where s.store_id = v_store and s.active;
  return v_store;
end;
$$;

create or replace function public.get_storefront(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_store public.stores%rowtype;
begin
  select * into v_store from public.stores where slug = p_slug;
  if v_store.id is null then
    return null;
  end if;
  return jsonb_build_object(
    'store', jsonb_build_object(
      'id', v_store.id,
      'name', v_store.name,
      'slug', v_store.slug,
      'vertical', v_store.vertical,
      'phone', v_store.phone,
      'address', v_store.address,
      'timezone', v_store.timezone,
      'inviteCode', null,
      'basePriceCents', v_store.base_price_cents,
      'seatPriceCents', v_store.seat_price_cents,
      'brandColor', v_store.brand_color
    ),
    'professionals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'fullName', p.full_name, 'role', p.role
      ) order by p.role, p.full_name)
      from public.profiles p
      where p.store_id = v_store.id and p.active and p.attends
    ), '[]'::jsonb),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'name', s.name,
        'durationMin', s.duration_min,
        'priceCents', s.price_cents,
        'active', s.active,
        'professionalIds', coalesce((
          select jsonb_agg(ps.professional_id)
          from public.professional_services ps
          join public.profiles pr on pr.id = ps.professional_id
          where ps.service_id = s.id and pr.active and pr.attends
        ), '[]'::jsonb)
      ) order by s.name)
      from public.services s
      where s.store_id = v_store.id and s.active
    ), '[]'::jsonb),
    'hours', coalesce((
      select jsonb_agg(jsonb_build_object(
        'weekday', h.weekday,
        'start', to_char(h.start_time, 'HH24:MI'),
        'end', to_char(h.end_time, 'HH24:MI'),
        'enabled', h.enabled,
        'professionalId', h.professional_id
      ) order by h.weekday)
      from public.business_hours h
      where h.store_id = v_store.id
    ), '[]'::jsonb)
  );
end;
$$;

alter table public.stores enable row level security;
alter table public.profiles enable row level security;
alter table public.commissions enable row level security;
alter table public.services enable row level security;
alter table public.professional_services enable row level security;
alter table public.business_hours enable row level security;
alter table public.time_blocks enable row level security;
alter table public.clients enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_items enable row level security;

create policy stores_select on public.stores
for select to authenticated
using (id = public.my_store_id());

create policy stores_update on public.stores
for update to authenticated
using (id = public.my_store_id() and public.my_role() = 'owner')
with check (id = public.my_store_id() and public.my_role() = 'owner');

create policy profiles_select on public.profiles
for select to authenticated
using (id = auth.uid() or (store_id = public.my_store_id() and public.my_role() = 'owner'));

create policy profiles_update on public.profiles
for update to authenticated
using (store_id = public.my_store_id() and (public.my_role() = 'owner' or id = auth.uid()))
with check (store_id = public.my_store_id() and (public.my_role() = 'owner' or id = auth.uid()));

create policy commissions_select on public.commissions
for select to authenticated
using (
  store_id = public.my_store_id()
  and (public.my_role() = 'owner' or professional_id = auth.uid())
);

create policy commissions_write on public.commissions
for all to authenticated
using (store_id = public.my_store_id() and public.my_role() = 'owner')
with check (store_id = public.my_store_id() and public.my_role() = 'owner');

create policy services_select on public.services
for select to authenticated
using (store_id = public.my_store_id());

create policy services_write on public.services
for all to authenticated
using (store_id = public.my_store_id() and public.my_role() = 'owner')
with check (store_id = public.my_store_id() and public.my_role() = 'owner');

create policy links_select on public.professional_services
for select to authenticated
using (
  exists (
    select 1 from public.services s
    where s.id = service_id and s.store_id = public.my_store_id()
  )
);

create policy links_write on public.professional_services
for all to authenticated
using (
  public.my_role() = 'owner'
  and exists (
    select 1 from public.services s
    where s.id = service_id and s.store_id = public.my_store_id()
  )
)
with check (
  public.my_role() = 'owner'
  and exists (
    select 1 from public.services s
    where s.id = service_id and s.store_id = public.my_store_id()
  )
);

create policy hours_select on public.business_hours
for select to authenticated
using (store_id = public.my_store_id());

create policy hours_write on public.business_hours
for all to authenticated
using (store_id = public.my_store_id() and public.my_role() = 'owner')
with check (store_id = public.my_store_id() and public.my_role() = 'owner');

create policy blocks_select on public.time_blocks
for select to authenticated
using (
  store_id = public.my_store_id()
  and (public.my_role() = 'owner' or professional_id is null or professional_id = auth.uid())
);

create policy blocks_write on public.time_blocks
for all to authenticated
using (
  store_id = public.my_store_id()
  and (public.my_role() = 'owner' or professional_id = auth.uid())
)
with check (
  store_id = public.my_store_id()
  and (public.my_role() = 'owner' or professional_id = auth.uid())
);

create policy clients_member on public.clients
for all to authenticated
using (
  store_id = public.my_store_id()
  and (public.my_role() = 'owner' or professional_id = auth.uid())
)
with check (
  store_id = public.my_store_id()
  and (public.my_role() = 'owner' or professional_id = auth.uid())
);

create policy appointments_member on public.appointments
for select to authenticated
using (
  store_id = public.my_store_id()
  and (public.my_role() = 'owner' or professional_id = auth.uid())
);

create policy appointments_write on public.appointments
for update to authenticated
using (
  store_id = public.my_store_id()
  and (public.my_role() = 'owner' or professional_id = auth.uid())
)
with check (
  store_id = public.my_store_id()
  and (public.my_role() = 'owner' or professional_id = auth.uid())
);

create policy items_select on public.appointment_items
for select to authenticated
using (
  exists (
    select 1 from public.appointments a
    where a.id = appointment_id
      and a.store_id = public.my_store_id()
      and (public.my_role() = 'owner' or a.professional_id = auth.uid())
  )
);

revoke all on public.stores from anon;
revoke all on public.profiles from anon;
revoke all on public.commissions from anon;
revoke all on public.services from anon;
revoke all on public.professional_services from anon;
revoke all on public.business_hours from anon;
revoke all on public.time_blocks from anon;
revoke all on public.clients from anon;
revoke all on public.appointments from anon;
revoke all on public.appointment_items from anon;

revoke insert, delete on public.appointments from authenticated;

grant execute on function public.available_slots(uuid, date, integer) to anon, authenticated;
grant execute on function public.book_appointment(uuid, uuid, text, text, uuid[], timestamptz, text, text) to anon, authenticated;
grant execute on function public.get_storefront(text) to anon, authenticated;
grant execute on function public.create_store(text, text, text, text, text, jsonb) to authenticated;
grant execute on function public.join_store(text, text) to authenticated;
grant execute on function public.set_appointment_status(uuid, text, text) to authenticated;
