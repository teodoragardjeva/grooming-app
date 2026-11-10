-- Test-only helpers (schema "t"). Defaults: resource = seeded default, "now" = 2026-11-30 10:00 Sofia.
create schema t;
create function t.variant(p_svc uuid, p_size text) returns uuid language sql as
$$ select id from public.service_variants where service_id = p_svc and size_key = p_size $$;

create function t.book(
  p_start timestamptz,
  p_svc uuid default '00000000-0000-4000-8000-0000000000a1',
  p_size text default null,
  p_source text default 'public',
  p_now timestamptz default '2026-11-30 08:00:00+00',
  p_resource uuid default '00000000-0000-4000-8000-000000000001',
  p_hash text default null,
  p_override boolean default false,
  p_name text default 'Тест Клиент',
  p_email text default ('c' || gen_random_uuid() || '@example.com')
) returns jsonb language sql as $$
  select public.create_appointment(p_resource, p_svc,
    case when p_size is null then null else t.variant(p_svc, p_size) end,
    p_start, p_name, '+359000000000', p_email, 'Рекс', null, p_source, p_hash, p_override, p_now)
$$;
