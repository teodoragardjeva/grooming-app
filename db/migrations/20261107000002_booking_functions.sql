-- Booking, hold lifecycle, cancellation and rescheduling.
-- Functions are called only by trusted Next.js server code; calls them after validation/authorization.
-- Public and admin paths share the SAME overlap invariant: the exclusion constraint on
-- appointment_allocations. All functions take p_now so time can be controlled in tests.

-- ------------------------------------------------------------ availability
-- Open windows (as tstzrange) of a resource for a studio-local calendar date.
create or replace function public.open_windows(p_resource uuid, p_local_date date)
returns setof tstzrange
language sql stable
set search_path = public
as $$
  with s as (select timezone from public.business_settings where id),
       ov as (select * from public.working_hour_overrides
               where resource_id = p_resource and on_date = p_local_date)
  select tstzrange((p_local_date + w.start_time) at time zone s.timezone,
                   (p_local_date + w.end_time)   at time zone s.timezone, '[)')
    from s, public.working_hours w
   where w.resource_id = p_resource
     and w.weekday = extract(isodow from p_local_date)::int
     and not exists (select 1 from ov)
  union all
  select tstzrange((p_local_date + ov.start_time) at time zone s.timezone,
                   (p_local_date + ov.end_time)   at time zone s.timezone, '[)')
    from s, ov
   where not ov.is_closed;
$$;

-- null when the whole allocation fits an open window and avoids blocked intervals.
create or replace function public.check_interval(p_resource uuid, p_range tstzrange)
returns text
language plpgsql stable
set search_path = public
as $$
declare
  v_tz text;
  v_date date;
begin
  select timezone into v_tz from public.business_settings where id;
  v_date := (lower(p_range) at time zone v_tz)::date;
  if not exists (select 1 from public.open_windows(p_resource, v_date) w where w @> p_range) then
    return 'outside_hours';
  end if;
  if exists (select 1 from public.blocked_intervals b
              where b.resource_id = p_resource
                and tstzrange(b.start_at, b.end_at, '[)') && p_range) then
    return 'blocked';
  end if;
  return null;
end;
$$;

-- ------------------------------------------------------------- hold expiry
-- Marks expired pending holds and frees their allocations. Called at request time by
-- every mutation so availability never depends on a cron job.
create or replace function public.release_expired_holds(p_now timestamptz default now())
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_count integer;
begin
  with ex as (
    update public.appointments
       set status = 'expired', updated_at = p_now
     where status = 'pending_confirmation' and hold_expires_at <= p_now
    returning id
  ), del as (
    delete from public.appointment_allocations a using ex where a.appointment_id = ex.id
    returning 1
  )
  select count(*) into v_count from ex;
  return v_count;
end;
$$;

-- Busy allocation ranges for a resource in [p_from, p_to), for availability listing.
-- Returns no customer data. Expired holds are released first.
create or replace function public.busy_ranges(
  p_resource uuid, p_from timestamptz, p_to timestamptz, p_now timestamptz default now())
returns table (during tstzrange)
language plpgsql
set search_path = public
as $$
begin
  perform public.release_expired_holds(p_now);
  return query
    select a.during from public.appointment_allocations a
     where a.resource_id = p_resource and a.during && tstzrange(p_from, p_to, '[)')
    union all
    select tstzrange(b.start_at, b.end_at, '[)') from public.blocked_intervals b
     where b.resource_id = p_resource and tstzrange(b.start_at, b.end_at, '[)') && tstzrange(p_from, p_to, '[)');
end;
$$;

-- ------------------------------------------------------- create appointment
-- Shared by public booking (p_source='public' -> pending hold) and admin
-- (p_source='admin' -> confirmed at once).
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

  v_check := public.check_interval(p_resource_id, v_alloc);
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

-- --------------------------------------------------- confirm (idempotent)
create or replace function public.confirm_booking(
  p_token_hash text,
  p_cancel_token_hash text default null,
  p_now timestamptz default now()
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  t public.confirmation_tokens;
  a public.appointments;
begin
  select * into t from public.confirmation_tokens where token_hash = p_token_hash for update;
  if t.id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;
  select * into a from public.appointments where id = t.appointment_id for update;

  if a.status = 'confirmed' and t.used_at is not null then
    return jsonb_build_object('ok', true, 'already_confirmed', true, 'appointment_id', a.id);
  end if;
  if t.used_at is not null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;
  if a.status <> 'pending_confirmation' then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;
  if t.expires_at <= p_now or a.hold_expires_at <= p_now then
    perform public.release_expired_holds(p_now);
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;

  update public.appointments
     set status = 'confirmed', confirmed_at = p_now, hold_expires_at = null, updated_at = p_now
   where id = a.id;
  update public.confirmation_tokens set used_at = p_now where id = t.id;
  if p_cancel_token_hash is not null then
    insert into public.cancellation_tokens (appointment_id, token_hash, expires_at)
    values (a.id, p_cancel_token_hash, a.start_at);
  end if;
  return jsonb_build_object('ok', true, 'already_confirmed', false, 'appointment_id', a.id);
end;
$$;

-- Retry path when the confirmation email could not be sent: new token, same hold.
create or replace function public.rotate_confirmation_token(
  p_appointment_id uuid, p_new_hash text, p_now timestamptz default now()
) returns jsonb
language plpgsql
set search_path = public
as $$
declare a public.appointments;
begin
  select * into a from public.appointments where id = p_appointment_id for update;
  if a.id is null or a.status <> 'pending_confirmation' or a.hold_expires_at <= p_now then
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;
  update public.confirmation_tokens set used_at = p_now
   where appointment_id = a.id and used_at is null;
  insert into public.confirmation_tokens (appointment_id, token_hash, expires_at)
  values (a.id, p_new_hash, a.hold_expires_at);
  return jsonb_build_object('ok', true, 'appointment_id', a.id, 'hold_expires_at', a.hold_expires_at);
end;
$$;

-- Confirmation email failed and the app chooses to free the hold immediately.
create or replace function public.release_failed_booking(
  p_appointment_id uuid, p_reason text default 'email_failed', p_now timestamptz default now()
) returns jsonb
language plpgsql
set search_path = public
as $$
declare a public.appointments;
begin
  select * into a from public.appointments where id = p_appointment_id for update;
  if a.id is null or a.status <> 'pending_confirmation' then
    return jsonb_build_object('ok', false, 'error', 'not_pending');
  end if;
  update public.appointments
     set status = 'expired', cancellation_reason = p_reason, cancelled_by = 'system', updated_at = p_now
   where id = a.id;
  delete from public.appointment_allocations where appointment_id = a.id;
  update public.confirmation_tokens set used_at = p_now where appointment_id = a.id and used_at is null;
  return jsonb_build_object('ok', true);
end;
$$;

-- ------------------------------------------------- customer cancellation
-- Allowed while p_now <= (local start wall-clock - cutoff hours), DST-aware.
create or replace function public.cancel_by_token(
  p_token_hash text, p_now timestamptz default now()
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  t public.cancellation_tokens;
  a public.appointments;
  s public.business_settings;
  v_deadline timestamptz;
begin
  select * into s from public.business_settings where id;
  select * into t from public.cancellation_tokens where token_hash = p_token_hash for update;
  if t.id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;
  select * into a from public.appointments where id = t.appointment_id for update;

  if a.status = 'cancelled' then
    return jsonb_build_object('ok', true, 'already_cancelled', true, 'appointment_id', a.id);
  end if;
  if a.status <> 'confirmed' then
    return jsonb_build_object('ok', false, 'error', 'not_cancellable');
  end if;

  v_deadline := ((a.start_at at time zone s.timezone) - make_interval(hours => s.cancel_cutoff_hours))
                at time zone s.timezone;
  if p_now > v_deadline then
    return jsonb_build_object('ok', false, 'error', 'too_late', 'deadline', v_deadline);
  end if;

  update public.appointments
     set status = 'cancelled', cancelled_at = p_now, cancelled_by = 'customer', updated_at = p_now
   where id = a.id;
  delete from public.appointment_allocations where appointment_id = a.id;
  update public.cancellation_tokens set used_at = p_now where id = t.id;
  return jsonb_build_object('ok', true, 'already_cancelled', false, 'appointment_id', a.id);
end;
$$;

-- ------------------------------------------------------------ admin actions
create or replace function public.admin_cancel_appointment(
  p_appointment_id uuid, p_reason text, p_actor uuid default null, p_now timestamptz default now()
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  a public.appointments;
  v_freed tstzrange;
begin
  if p_actor is not null then perform set_config('app.actor', p_actor::text, true); end if;
  select * into a from public.appointments where id = p_appointment_id for update;
  if a.id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if a.status not in ('confirmed', 'pending_confirmation') then
    return jsonb_build_object('ok', false, 'error', 'not_cancellable');
  end if;
  select during into v_freed from public.appointment_allocations where appointment_id = a.id;
  update public.appointments
     set status = 'cancelled', cancelled_at = p_now, cancelled_by = 'admin',
         cancellation_reason = nullif(btrim(p_reason), ''), hold_expires_at = null, updated_at = p_now
   where id = a.id;
  delete from public.appointment_allocations where appointment_id = a.id;
  return jsonb_build_object('ok', true, 'appointment_id', a.id,
    'freed_start', lower(v_freed), 'freed_end', upper(v_freed));
end;
$$;

-- Atomic move using the appointment's own snapshot durations/buffers.
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
  v_check := public.check_interval(a.resource_id, v_alloc);
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

create or replace function public.admin_set_appointment_status(
  p_appointment_id uuid, p_status text, p_actor uuid default null, p_now timestamptz default now()
) returns jsonb
language plpgsql
set search_path = public
as $$
declare a public.appointments;
begin
  if p_actor is not null then perform set_config('app.actor', p_actor::text, true); end if;
  if p_status not in ('completed', 'no_show') then
    return jsonb_build_object('ok', false, 'error', 'invalid_input');
  end if;
  select * into a from public.appointments where id = p_appointment_id for update;
  if a.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if a.status <> 'confirmed' then return jsonb_build_object('ok', false, 'error', 'invalid_state'); end if;
  update public.appointments set status = p_status, updated_at = p_now where id = a.id;
  return jsonb_build_object('ok', true);
end;
$$;

-- Appointments that a proposed block / vacation / hours change would collide with.
-- The admin UI must show these and require an explicit decision; nothing is auto-cancelled.
create or replace function public.find_conflicting_appointments(
  p_resource uuid, p_start timestamptz, p_end timestamptz
) returns table (appointment_id uuid, start_at timestamptz, end_at timestamptz, status text, customer_name text)
language sql stable
set search_path = public
as $$
  select a.id, a.start_at, a.end_at, a.status, a.customer_name
    from public.appointments a
    join public.appointment_allocations al on al.appointment_id = a.id
   where al.resource_id = p_resource and al.during && tstzrange(p_start, p_end, '[)')
   order by a.start_at;
$$;
