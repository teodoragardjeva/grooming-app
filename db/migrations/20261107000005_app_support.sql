-- App-layer support: DB-backed rate limiting, availability inputs in one call, token-based
-- booking summaries (no contact data), conflict-aware schedule changes, housekeeping.
-- Called only by trusted Next.js server code after validation/authorization.

-- ------------------------------------------------------------------ rate limit
create table public.rate_limits (
  key          text primary key,
  window_start timestamptz not null,
  count        integer not null default 0
);

-- Fixed-window counter. Returns true when the request is allowed.
create or replace function public.check_rate_limit(
  p_key text, p_limit integer, p_window_seconds integer, p_now timestamptz default now()
) returns boolean
language plpgsql
set search_path = public
as $$
declare v_count integer;
begin
  insert into public.rate_limits as r (key, window_start, count)
  values (p_key, p_now, 1)
  on conflict (key) do update
     set window_start = case when r.window_start <= p_now - make_interval(secs => p_window_seconds)
                             then p_now else r.window_start end,
         count        = case when r.window_start <= p_now - make_interval(secs => p_window_seconds)
                             then 1 else r.count + 1 end
  returning r.count into v_count;
  return v_count <= p_limit;
end;
$$;

-- ----------------------------------------------------- availability inputs
-- Everything the pure TypeScript engine needs for [p_from, p_to), in one round trip.
-- Releases expired holds first. Contains no customer data.
create or replace function public.availability_inputs(
  p_resource uuid, p_service uuid, p_variant uuid,
  p_from timestamptz, p_to timestamptz, p_now timestamptz default now()
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  s    public.business_settings;
  svc  public.services;
  var  public.service_variants;
  v_duration integer;
  v_price integer;
begin
  select * into s from public.business_settings where id;
  perform public.release_expired_holds(p_now);

  select * into svc from public.services where id = p_service and is_active and booking_enabled;
  if svc.id is null then
    return jsonb_build_object('ok', false, 'error', 'service_not_found');
  end if;
  if svc.duration_mode = 'fixed' then
    v_duration := svc.fixed_duration_minutes; v_price := svc.fixed_price_cents;
  else
    if p_variant is null then return jsonb_build_object('ok', false, 'error', 'variant_required'); end if;
    select * into var from public.service_variants
     where id = p_variant and service_id = svc.id and is_active;
    if var.id is null then return jsonb_build_object('ok', false, 'error', 'variant_invalid'); end if;
    v_duration := var.duration_minutes; v_price := var.price_cents;
  end if;

  return jsonb_build_object(
    'ok', true,
    'settings', jsonb_build_object(
      'timezone', s.timezone, 'currency', s.currency, 'slot_minutes', s.slot_minutes,
      'min_notice_minutes', s.min_notice_minutes, 'horizon_days', s.horizon_days),
    'timing', jsonb_build_object(
      'duration_minutes', v_duration, 'price_cents', v_price,
      'prep_minutes',    coalesce(svc.prep_buffer_minutes,    s.default_prep_buffer_minutes),
      'cleanup_minutes', coalesce(svc.cleanup_buffer_minutes, s.default_cleanup_buffer_minutes)),
    'weekly', coalesce((select jsonb_agg(jsonb_build_object(
        'weekday', w.weekday, 'start', to_char(w.start_time, 'HH24:MI'), 'end', to_char(w.end_time, 'HH24:MI')))
      from public.working_hours w where w.resource_id = p_resource), '[]'::jsonb),
    'overrides', coalesce((select jsonb_agg(jsonb_build_object(
        'date', o.on_date, 'is_closed', o.is_closed,
        'start', to_char(o.start_time, 'HH24:MI'), 'end', to_char(o.end_time, 'HH24:MI')))
      from public.working_hour_overrides o
      where o.resource_id = p_resource
        and o.on_date between ((p_from at time zone s.timezone)::date - 1)
                          and ((p_to   at time zone s.timezone)::date + 1)), '[]'::jsonb),
    'blocked', coalesce((select jsonb_agg(jsonb_build_object('start', b.start_at, 'end', b.end_at))
      from public.blocked_intervals b
      where b.resource_id = p_resource and tstzrange(b.start_at, b.end_at, '[)') && tstzrange(p_from, p_to, '[)')), '[]'::jsonb),
    'busy', coalesce((select jsonb_agg(jsonb_build_object('start', lower(a.during), 'end', upper(a.during)))
      from public.appointment_allocations a
      where a.resource_id = p_resource and a.during && tstzrange(p_from, p_to, '[)')), '[]'::jsonb)
  );
end;
$$;

-- ------------------------------------------------------ token booking summary
-- Minimal, non-identifying view for the confirm/cancel pages (no phone/email).
create or replace function public.booking_summary_by_token(
  p_kind text, p_token_hash text, p_now timestamptz default now()
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  a public.appointments;
  v_used timestamptz;
  v_exp  timestamptz;
  s public.business_settings;
begin
  select * into s from public.business_settings where id;
  if p_kind = 'confirm' then
    select appointment_id, used_at, expires_at into a.id, v_used, v_exp
      from public.confirmation_tokens where token_hash = p_token_hash;
  elsif p_kind = 'cancel' then
    select appointment_id, used_at, expires_at into a.id, v_used, v_exp
      from public.cancellation_tokens where token_hash = p_token_hash;
  else
    return jsonb_build_object('ok', false, 'error', 'invalid_input');
  end if;
  if a.id is null then return jsonb_build_object('ok', false, 'error', 'invalid_token'); end if;
  select * into a from public.appointments where id = a.id;
  return jsonb_build_object(
    'ok', true, 'status', a.status, 'token_used', v_used is not null,
    'token_expired', v_exp <= p_now,
    'service_name_bg', a.service_name_bg, 'service_name_en', a.service_name_en,
    'variant_label_bg', a.variant_label_bg, 'variant_label_en', a.variant_label_en,
    'start_at', a.start_at, 'end_at', a.end_at, 'duration_minutes', a.duration_minutes,
    'price_cents', a.price_cents, 'currency', a.currency, 'customer_name', a.customer_name,
    'dog_name', a.dog_name, 'locale', a.locale, 'hold_expires_at', a.hold_expires_at,
    'cancel_deadline', ((a.start_at at time zone s.timezone) - make_interval(hours => s.cancel_cutoff_hours)) at time zone s.timezone);
end;
$$;

-- ------------------------------------------------- conflict-aware schedule changes
-- Future appointments (pending/confirmed) whose allocation would no longer fit the open windows.
create or replace function public._appointments_outside_windows(
  p_resource uuid, p_weekly jsonb, p_override_dates date[], p_override_rows jsonb, p_now timestamptz
) returns table (appointment_id uuid, start_at timestamptz, end_at timestamptz, status text, customer_name text)
language sql stable
set search_path = public
as $$
  with s as (select timezone tz from public.business_settings where id),
  appts as (
    select a.id, a.start_at, a.end_at, a.status, a.customer_name, al.during,
           (lower(al.during) at time zone (select tz from s))::date as d
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

create or replace function public.admin_replace_weekly_hours(
  p_resource uuid, p_hours jsonb, p_confirm_conflicts boolean default false,
  p_actor uuid default null, p_now timestamptz default now()
) returns jsonb
language plpgsql
set search_path = public
as $$
declare v_conflicts jsonb;
begin
  if p_actor is not null then perform set_config('app.actor', p_actor::text, true); end if;
  select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) into v_conflicts
    from public._appointments_outside_windows(p_resource, p_hours, '{}'::date[], '[]'::jsonb, p_now) c;
  if jsonb_array_length(v_conflicts) > 0 and not p_confirm_conflicts then
    return jsonb_build_object('ok', false, 'error', 'conflicts', 'conflicts', v_conflicts);
  end if;
  delete from public.working_hours where resource_id = p_resource;
  insert into public.working_hours (resource_id, weekday, start_time, end_time)
  select p_resource, (h->>'weekday')::smallint, (h->>'start')::time, (h->>'end')::time
    from jsonb_array_elements(p_hours) h;
  return jsonb_build_object('ok', true, 'conflicts', v_conflicts);
end;
$$;

-- Closure / vacation / special hours for a local date range. Replaces existing override rows
-- of those dates. p_start/p_end (HH:MM) are required unless p_closed.
create or replace function public.admin_set_override_range(
  p_resource uuid, p_from date, p_to date, p_closed boolean,
  p_start text, p_end text, p_note text,
  p_confirm_conflicts boolean default false, p_actor uuid default null, p_now timestamptz default now()
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_dates date[];
  v_rows jsonb;
  v_conflicts jsonb;
begin
  if p_actor is not null then perform set_config('app.actor', p_actor::text, true); end if;
  if p_to < p_from or p_to - p_from > 366 then
    return jsonb_build_object('ok', false, 'error', 'invalid_input');
  end if;
  if not p_closed and (p_start is null or p_end is null or p_end::time <= p_start::time) then
    return jsonb_build_object('ok', false, 'error', 'invalid_input');
  end if;
  select array_agg(d::date) into v_dates from generate_series(p_from, p_to, interval '1 day') d;
  select jsonb_agg(jsonb_build_object('date', d, 'is_closed', p_closed, 'start', p_start, 'end', p_end))
    into v_rows from unnest(v_dates) d;

  select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) into v_conflicts
    from public._appointments_outside_windows(
           p_resource,
           (select coalesce(jsonb_agg(jsonb_build_object('weekday', weekday,
                    'start', to_char(start_time, 'HH24:MI'), 'end', to_char(end_time, 'HH24:MI'))), '[]'::jsonb)
              from public.working_hours where resource_id = p_resource),
           v_dates, v_rows, p_now) c;
  if jsonb_array_length(v_conflicts) > 0 and not p_confirm_conflicts then
    return jsonb_build_object('ok', false, 'error', 'conflicts', 'conflicts', v_conflicts);
  end if;

  delete from public.working_hour_overrides where resource_id = p_resource and on_date = any (v_dates);
  insert into public.working_hour_overrides (resource_id, on_date, is_closed, start_time, end_time, note)
  select p_resource, d, p_closed, case when p_closed then null else p_start::time end,
         case when p_closed then null else p_end::time end, nullif(btrim(p_note), '')
    from unnest(v_dates) d;
  return jsonb_build_object('ok', true, 'days', cardinality(v_dates), 'conflicts', v_conflicts);
end;
$$;

create or replace function public.admin_add_block(
  p_resource uuid, p_start timestamptz, p_end timestamptz, p_reason text,
  p_confirm_conflicts boolean default false, p_actor uuid default null
) returns jsonb
language plpgsql
set search_path = public
as $$
declare v_conflicts jsonb;
begin
  if p_actor is not null then perform set_config('app.actor', p_actor::text, true); end if;
  if p_end <= p_start then return jsonb_build_object('ok', false, 'error', 'invalid_input'); end if;
  select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) into v_conflicts
    from public.find_conflicting_appointments(p_resource, p_start, p_end) c
   where c.status in ('confirmed', 'pending_confirmation');
  if jsonb_array_length(v_conflicts) > 0 and not p_confirm_conflicts then
    return jsonb_build_object('ok', false, 'error', 'conflicts', 'conflicts', v_conflicts);
  end if;
  insert into public.blocked_intervals (resource_id, start_at, end_at, reason)
  values (p_resource, p_start, p_end, nullif(btrim(p_reason), ''));
  return jsonb_build_object('ok', true, 'conflicts', v_conflicts);
end;
$$;

-- --------------------------------------------------------------- housekeeping
-- Backup for request-time release (never required for correctness).
create or replace function public.housekeeping(p_now timestamptz default now())
returns jsonb
language plpgsql
set search_path = public
as $$
declare v_released integer; v_rl integer; v_ct integer; v_xt integer;
begin
  v_released := public.release_expired_holds(p_now);
  delete from public.rate_limits where window_start < p_now - interval '1 day';
  get diagnostics v_rl = row_count;
  delete from public.admin_sessions where expires_at < p_now;
  delete from public.confirmation_tokens where expires_at < p_now - interval '7 days';
  get diagnostics v_ct = row_count;
  delete from public.cancellation_tokens where expires_at < p_now - interval '30 days';
  get diagnostics v_xt = row_count;
  return jsonb_build_object('released_holds', v_released, 'rate_limits_deleted', v_rl,
                            'confirmation_tokens_deleted', v_ct, 'cancellation_tokens_deleted', v_xt);
end;
$$;
