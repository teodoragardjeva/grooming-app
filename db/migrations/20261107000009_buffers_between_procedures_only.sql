-- Preparation / cleanup buffers only count BETWEEN procedures.
-- The working-hours check now applies to the procedure window [start, end) itself, so a buffer may extend
-- before opening or after closing time. Buffers still may not overlap another appointment (exclusion
-- constraint on appointment_allocations) and still may not run into a block / holiday / vacation.

create or replace function public.check_booking(p_resource uuid, p_procedure tstzrange, p_alloc tstzrange)
returns text
language plpgsql stable
set search_path = public
as $$
declare
  v_tz text;
  v_date date;
begin
  select timezone into v_tz from public.business_settings where id;
  v_date := (lower(p_procedure) at time zone v_tz)::date;
  if not exists (select 1 from public.open_windows(p_resource, v_date) w where w @> p_procedure) then
    return 'outside_hours';
  end if;
  if exists (select 1 from public.blocked_intervals b
              where b.resource_id = p_resource
                and tstzrange(b.start_at, b.end_at, '[)') && p_alloc) then
    return 'blocked';
  end if;
  return null;
end;
$$;

create or replace function public.create_appointment(
  p_resource_id        uuid,
  p_service_id         uuid,
  p_variant_id         uuid,
  p_start_at           timestamptz,
  p_customer_name      text,
  p_customer_phone     text,
  p_customer_email     text,
  p_dog_name           text,
  p_notes              text,
  p_source             text,
  p_confirmation_token_hash text default null,
  p_override_min_notice boolean default false,
  p_now                timestamptz default now(),
  p_actor              uuid default null,
  p_locale             text default 'bg',
  p_admin_notes        text default null
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  s            public.business_settings;
  r            public.booking_resources;
  svc          public.services;
  var          public.service_variants;
  v_duration   integer;
  v_price      integer;
  v_prep       integer;
  v_cleanup    integer;
  v_end        timestamptz;
  v_alloc      tstzrange;
  v_check      text;
  v_customer   uuid;
  v_appt       uuid := gen_random_uuid();
  v_status     text;
  v_hold       timestamptz;
begin
  if p_actor is not null then
    perform set_config('app.actor', p_actor::text, true);
  end if;
  if p_source not in ('public', 'admin') then
    return jsonb_build_object('ok', false, 'error', 'invalid_input');
  end if;
  if coalesce(btrim(p_customer_name), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'invalid_input');
  end if;
  if p_source = 'public' and (coalesce(btrim(p_customer_phone), '') = ''
                              or coalesce(btrim(p_customer_email), '') = '') then
    return jsonb_build_object('ok', false, 'error', 'invalid_input');
  end if;

  select * into s from public.business_settings where id;
  select * into r from public.booking_resources where id = p_resource_id and is_active;
  if r.id is null then
    return jsonb_build_object('ok', false, 'error', 'resource_not_found');
  end if;

  perform public.release_expired_holds(p_now);

  -- One unconfirmed (pending) reservation per e-mail address. The advisory lock serialises concurrent
  -- requests for the same address; the partial unique index below is the final guarantee.
  if p_source = 'public' then
    perform pg_advisory_xact_lock(hashtextextended(lower(btrim(p_customer_email)), 0));
    if exists (select 1 from public.appointments
                where status = 'pending_confirmation'
                  and lower(customer_email) = lower(btrim(p_customer_email))) then
      return jsonb_build_object('ok', false, 'error', 'pending_exists');
    end if;
  end if;

  select * into svc from public.services where id = p_service_id and is_active;
  if svc.id is null or (p_source = 'public' and not svc.booking_enabled) then
    return jsonb_build_object('ok', false, 'error', 'service_not_found');
  end if;

  if svc.duration_mode = 'fixed' then
    v_duration := svc.fixed_duration_minutes;
    v_price    := svc.fixed_price_cents;
  else
    if p_variant_id is null then
      return jsonb_build_object('ok', false, 'error', 'variant_required');
    end if;
    select * into var from public.service_variants
     where id = p_variant_id and service_id = svc.id and is_active;
    if var.id is null then
      return jsonb_build_object('ok', false, 'error', 'variant_invalid');
    end if;
    v_duration := var.duration_minutes;
    v_price    := var.price_cents;
  end if;

  v_prep    := coalesce(svc.prep_buffer_minutes,    s.default_prep_buffer_minutes);
  v_cleanup := coalesce(svc.cleanup_buffer_minutes, s.default_cleanup_buffer_minutes);
  v_end     := p_start_at + make_interval(mins => v_duration);
  v_alloc   := tstzrange(p_start_at - make_interval(mins => v_prep),
                         v_end + make_interval(mins => v_cleanup), '[)');

  -- Minimum notice: public always; admin may explicitly override.
  if not (p_source = 'admin' and p_override_min_notice)
     and p_start_at < p_now + make_interval(mins => s.min_notice_minutes) then
    return jsonb_build_object('ok', false, 'error', 'too_soon');
  end if;
  if p_source = 'public' and p_start_at > p_now + make_interval(hours => s.horizon_days * 24) then
    return jsonb_build_object('ok', false, 'error', 'too_far');
  end if;

  v_check := public.check_booking(p_resource_id, tstzrange(p_start_at, v_end, '[)'), v_alloc);
  if v_check is not null then
    return jsonb_build_object('ok', false, 'error', v_check);
  end if;

  -- reuse an existing customer record when email+phone match
  select id into v_customer from public.customers c
   where lower(c.email) is not distinct from lower(nullif(btrim(p_customer_email), ''))
     and c.phone is not distinct from nullif(btrim(p_customer_phone), '')
     and c.full_name = btrim(p_customer_name)
   limit 1;
  if v_customer is null then
    insert into public.customers (full_name, phone, email)
    values (btrim(p_customer_name), nullif(btrim(p_customer_phone), ''), nullif(btrim(p_customer_email), ''))
    returning id into v_customer;
  end if;

  if p_source = 'public' then
    v_status := 'pending_confirmation';
    v_hold   := p_now + make_interval(mins => s.confirmation_ttl_minutes);
  else
    v_status := 'confirmed';
    v_hold   := null;
  end if;

  begin
    insert into public.appointments (
      id, resource_id, customer_id, status, source, service_id, variant_id,
      service_name_bg, service_name_en, variant_label_bg, variant_label_en, size_key,
      duration_minutes, price_cents, currency, prep_buffer_minutes, cleanup_buffer_minutes,
      start_at, end_at, customer_name, customer_phone, customer_email, dog_name, notes,
      admin_notes, hold_expires_at, confirmed_at, locale, created_at, updated_at)
    values (
      v_appt, p_resource_id, v_customer, v_status, p_source, svc.id, var.id,
      svc.name_bg, svc.name_en, var.label_bg, var.label_en, var.size_key,
      v_duration, v_price, s.currency, v_prep, v_cleanup,
      p_start_at, v_end, btrim(p_customer_name), nullif(btrim(p_customer_phone), ''),
      nullif(btrim(p_customer_email), ''), nullif(btrim(p_dog_name), ''), nullif(btrim(p_notes), ''),
      p_admin_notes, v_hold, case when v_status = 'confirmed' then p_now end,
      case when p_locale = 'en' then 'en' else 'bg' end, p_now, p_now);

    insert into public.appointment_allocations (appointment_id, resource_id, during)
    values (v_appt, p_resource_id, v_alloc);
  exception when exclusion_violation then
    return jsonb_build_object('ok', false, 'error', 'slot_taken');
  when unique_violation then
    return jsonb_build_object('ok', false, 'error', 'pending_exists');
  end;

  if v_status = 'pending_confirmation' and p_confirmation_token_hash is not null then
    insert into public.confirmation_tokens (appointment_id, token_hash, expires_at)
    values (v_appt, p_confirmation_token_hash, v_hold);
  end if;

  return jsonb_build_object(
    'ok', true, 'appointment_id', v_appt, 'status', v_status,
    'start_at', p_start_at, 'end_at', v_end,
    'alloc_start', lower(v_alloc), 'alloc_end', upper(v_alloc),
    'duration_minutes', v_duration, 'price_cents', v_price, 'currency', s.currency,
    'hold_expires_at', v_hold);
end;
$$;

create or replace function public.admin_reschedule_appointment(
  p_appointment_id uuid, p_new_start timestamptz,
  p_override_min_notice boolean default false,
  p_actor uuid default null, p_now timestamptz default now()
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  a public.appointments;
  s public.business_settings;
  v_end timestamptz;
  v_alloc tstzrange;
  v_check text;
begin
  if p_actor is not null then perform set_config('app.actor', p_actor::text, true); end if;
  select * into s from public.business_settings where id;
  perform public.release_expired_holds(p_now);
  select * into a from public.appointments where id = p_appointment_id for update;
  if a.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if a.status not in ('confirmed', 'pending_confirmation') then
    return jsonb_build_object('ok', false, 'error', 'not_reschedulable');
  end if;
  if not p_override_min_notice and p_new_start < p_now + make_interval(mins => s.min_notice_minutes) then
    return jsonb_build_object('ok', false, 'error', 'too_soon');
  end if;

  v_end   := p_new_start + make_interval(mins => a.duration_minutes);
  v_alloc := tstzrange(p_new_start - make_interval(mins => a.prep_buffer_minutes),
                       v_end + make_interval(mins => a.cleanup_buffer_minutes), '[)');
  v_check := public.check_booking(a.resource_id, tstzrange(p_new_start, v_end, '[)'), v_alloc);
  if v_check is not null then
    return jsonb_build_object('ok', false, 'error', v_check);
  end if;

  begin
    update public.appointment_allocations set during = v_alloc where appointment_id = a.id;
    update public.appointments set start_at = p_new_start, end_at = v_end, updated_at = p_now
     where id = a.id;
  exception when exclusion_violation then
    return jsonb_build_object('ok', false, 'error', 'slot_taken');
  end;
  return jsonb_build_object('ok', true, 'appointment_id', a.id, 'start_at', p_new_start, 'end_at', v_end);
end;
$$;

create or replace function public._appointments_outside_windows(
  p_resource uuid, p_weekly jsonb, p_override_dates date[], p_override_rows jsonb, p_now timestamptz
) returns table (appointment_id uuid, start_at timestamptz, end_at timestamptz, status text, customer_name text)
language sql stable
set search_path = public
as $$
  with s as (select timezone tz from public.business_settings where id),
  appts as (
    select a.id, a.start_at, a.end_at, a.status, a.customer_name, tstzrange(a.start_at, a.end_at, '[)') as during,
           (a.start_at at time zone (select tz from s))::date as d
      from public.appointments a
      join public.appointment_allocations al on al.appointment_id = a.id
     where al.resource_id = p_resource and upper(al.during) > p_now
       and a.status in ('confirmed', 'pending_confirmation')
  )
  select a.id, a.start_at, a.end_at, a.status, a.customer_name
    from appts a
   where not exists (
     select 1 from (
       -- weekly windows (when the date is not overridden)
       select tstzrange((a.d + (h->>'start')::time) at time zone (select tz from s),
                        (a.d + (h->>'end')::time)   at time zone (select tz from s), '[)') as w
         from jsonb_array_elements(p_weekly) h
        where (h->>'weekday')::int = extract(isodow from a.d)::int
          and not (a.d = any (p_override_dates))
          and not exists (select 1 from public.working_hour_overrides o
                           where o.resource_id = p_resource and o.on_date = a.d
                             and not (a.d = any (p_override_dates)))
       union all
       -- existing overrides not being replaced
       select tstzrange((a.d + o.start_time) at time zone (select tz from s),
                        (a.d + o.end_time)   at time zone (select tz from s), '[)')
         from public.working_hour_overrides o
        where o.resource_id = p_resource and o.on_date = a.d and not o.is_closed
          and not (a.d = any (p_override_dates))
       union all
       -- new override rows
       select tstzrange((a.d + (r->>'start')::time) at time zone (select tz from s),
                        (a.d + (r->>'end')::time)   at time zone (select tz from s), '[)')
         from jsonb_array_elements(p_override_rows) r
        where (r->>'date')::date = a.d and not coalesce((r->>'is_closed')::boolean, false)
     ) ws where ws.w @> a.during);
$$;
