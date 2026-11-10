-- 1) One unconfirmed reservation per e-mail address (public bookings).
-- 2) purge_old_appointments(): data retention - removes appointments (and their personal data) whose start is
--    older than one month. Called when an admin signs in.

create unique index if not exists appointments_one_pending_per_email
  on public.appointments (lower(customer_email))
  where status = 'pending_confirmation' and customer_email is not null;

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

-- ------------------------------------------------------------ retention
create or replace function public.purge_old_appointments(
  p_now        timestamptz default now(),
  p_older_than interval    default interval '1 month'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids       uuid[];
  v_customers uuid[];
  v_deleted   integer := 0;
  v_cust      integer := 0;
begin
  select coalesce(array_agg(id), '{}'), coalesce(array_agg(distinct customer_id) filter (where customer_id is not null), '{}')
    into v_ids, v_customers
    from public.appointments
   where start_at < p_now - p_older_than;

  if cardinality(v_ids) = 0 then
    return jsonb_build_object('appointments_deleted', 0, 'customers_deleted', 0);
  end if;

  -- logs that carry the customer's e-mail / data must go too (FKs would only null them out)
  delete from public.notification_logs where appointment_id = any(v_ids);
  delete from public.appointments where id = any(v_ids);          -- allocations and tokens cascade
  get diagnostics v_deleted = row_count;
  delete from public.audit_logs where table_name = 'appointments' and row_id = any(select id::text from unnest(v_ids) id);

  delete from public.customers c
   where c.id = any(v_customers)
     and not exists (select 1 from public.appointments a where a.customer_id = c.id);
  get diagnostics v_cust = row_count;

  return jsonb_build_object('appointments_deleted', v_deleted, 'customers_deleted', v_cust);
end;
$$;

