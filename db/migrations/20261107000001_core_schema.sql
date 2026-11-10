-- Core schema: resource-aware booking model, catalog, schedule, content, logs.
-- Money is stored as integer minor units (cents). Timestamps are timestamptz (UTC).

create extension if not exists btree_gist;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- resources
create table public.booking_resources (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  is_active     boolean not null default true,
  display_order integer not null default 0,
  created_at    timestamptz not null default now()
);

-- Admin accounts (no public registration). Password hashes are scrypt, created by scripts/create-admin.mjs.
create table public.admin_profiles (
  user_id       uuid primary key default gen_random_uuid(),
  email         text not null,
  password_hash text not null,
  role          text not null default 'admin' check (role in ('admin')),
  created_at    timestamptz not null default now()
);
create unique index admin_profiles_email_key on public.admin_profiles (lower(email));

-- Server-side admin sessions; the cookie holds a random token, only its SHA-256 hash is stored.
create table public.admin_sessions (
  token_hash text primary key,
  user_id    uuid not null references public.admin_profiles (user_id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index admin_sessions_user_idx on public.admin_sessions (user_id);

-- ----------------------------------------------------------------- settings
-- Exactly one row (id is always true).
create table public.business_settings (
  id                            boolean primary key default true check (id),
  default_resource_id           uuid references public.booking_resources (id),
  timezone                      text not null default 'Europe/Sofia',
  currency                      text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  slot_minutes                  integer not null default 15  check (slot_minutes between 5 and 120),
  min_notice_minutes            integer not null default 120 check (min_notice_minutes >= 0),
  horizon_days                  integer not null default 30  check (horizon_days between 1 and 365),
  confirmation_ttl_minutes      integer not null default 10  check (confirmation_ttl_minutes between 1 and 120),
  cancel_cutoff_hours           integer not null default 24  check (cancel_cutoff_hours >= 0),
  default_prep_buffer_minutes   integer not null default 0   check (default_prep_buffer_minutes >= 0),
  default_cleanup_buffer_minutes integer not null default 0  check (default_cleanup_buffer_minutes >= 0),
  studio_name_bg                text not null default '',
  studio_name_en                text not null default '',
  phone                         text,
  email                         text,
  address_bg                    text,
  address_en                    text,
  map_url                       text,
  socials                       jsonb not null default '{}'::jsonb,
  logo_path                     text,
  seo_description_bg            text,
  seo_description_en            text,
  -- true while contact details are still the seeded EXAMPLE values
  is_example_data               boolean not null default true,
  updated_at                    timestamptz not null default now()
);

-- ------------------------------------------------------------------ catalog
create table public.services (
  id                     uuid primary key default gen_random_uuid(),
  name_bg                text not null,
  name_en                text,
  description_bg         text,
  description_en         text,
  image_path             text,
  is_active              boolean not null default true,
  booking_enabled        boolean not null default true,
  display_order          integer not null default 0,
  duration_mode          text not null check (duration_mode in ('fixed', 'size_based')),
  fixed_duration_minutes integer,
  fixed_price_cents      integer,
  -- null = use global default from business_settings
  prep_buffer_minutes    integer check (prep_buffer_minutes is null or prep_buffer_minutes >= 0),
  cleanup_buffer_minutes integer check (cleanup_buffer_minutes is null or cleanup_buffer_minutes >= 0),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint services_mode_consistent check (
    (duration_mode = 'fixed'
       and fixed_duration_minutes > 0 and fixed_price_cents >= 0)
    or
    (duration_mode = 'size_based'
       and fixed_duration_minutes is null and fixed_price_cents is null)
  )
);

create table public.service_variants (
  id               uuid primary key default gen_random_uuid(),
  service_id       uuid not null references public.services (id) on delete cascade,
  size_key         text not null check (size_key in ('small', 'medium', 'large', 'xlarge')),
  label_bg         text not null,
  label_en         text,
  duration_minutes integer not null check (duration_minutes > 0),
  price_cents      integer not null check (price_cents >= 0),
  display_order    integer not null default 0,
  is_active        boolean not null default true,
  unique (service_id, size_key)
);

-- ---------------------------------------------------------------- customers
create table public.customers (
  id         uuid primary key default gen_random_uuid(),
  full_name  text not null,
  phone      text,
  email      text,
  created_at timestamptz not null default now()
);
create index customers_email_idx on public.customers (lower(email));

-- ------------------------------------------------------------- appointments
create table public.appointments (
  id                     uuid primary key default gen_random_uuid(),
  resource_id            uuid not null references public.booking_resources (id),
  customer_id            uuid references public.customers (id),
  status                 text not null check (status in
    ('pending_confirmation', 'confirmed', 'expired', 'cancelled', 'completed', 'no_show')),
  source                 text not null check (source in ('public', 'admin')),

  -- catalog references (kept for navigation only; snapshots below are authoritative)
  service_id             uuid references public.services (id) on delete set null,
  variant_id             uuid references public.service_variants (id) on delete set null,

  -- immutable snapshots taken at booking time
  service_name_bg        text not null,
  service_name_en        text,
  variant_label_bg       text,
  variant_label_en       text,
  size_key               text,
  duration_minutes       integer not null check (duration_minutes > 0),
  price_cents            integer not null check (price_cents >= 0),
  currency               text not null,
  prep_buffer_minutes    integer not null default 0 check (prep_buffer_minutes >= 0),
  cleanup_buffer_minutes integer not null default 0 check (cleanup_buffer_minutes >= 0),

  -- customer-visible procedure window [start_at, end_at)
  start_at               timestamptz not null,
  end_at                 timestamptz not null,

  customer_name          text not null,
  customer_phone         text,
  customer_email         text,
  dog_name               text,
  notes                  text,
  admin_notes            text,

  hold_expires_at        timestamptz,
  confirmed_at           timestamptz,
  cancelled_at           timestamptz,
  cancelled_by           text check (cancelled_by in ('customer', 'admin', 'system')),
  cancellation_reason    text,
  locale                 text not null default 'bg' check (locale in ('bg', 'en')),

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check (end_at > start_at)
);
create index appointments_resource_start_idx on public.appointments (resource_id, start_at);
create index appointments_status_idx on public.appointments (status);
create index appointments_hold_idx on public.appointments (hold_expires_at)
  where status = 'pending_confirmation';

-- Occupancy of one resource. A row exists ONLY while the appointment occupies time
-- (pending hold or confirmed/completed/no_show); it is deleted on expiry/cancellation.
-- The exclusion constraint has no time-dependent predicate: expired holds are removed
-- transactionally by release_expired_holds() before any conflicting insert.
create table public.appointment_allocations (
  appointment_id uuid primary key references public.appointments (id) on delete cascade,
  resource_id    uuid not null references public.booking_resources (id),
  during         tstzrange not null,
  constraint allocation_range_valid check (
    not isempty(during) and lower_inc(during) and not upper_inc(during)
    and not lower_inf(during) and not upper_inf(during)
  ),
  constraint allocations_no_overlap_per_resource
    exclude using gist (resource_id with =, during with &&)
);

create table public.confirmation_tokens (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  token_hash     text not null unique,
  expires_at     timestamptz not null,
  used_at        timestamptz,
  created_at     timestamptz not null default now()
);
create index confirmation_tokens_appt_idx on public.confirmation_tokens (appointment_id);

create table public.cancellation_tokens (
  id             uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  token_hash     text not null unique,
  expires_at     timestamptz not null,
  used_at        timestamptz,
  created_at     timestamptz not null default now()
);
create index cancellation_tokens_appt_idx on public.cancellation_tokens (appointment_id);

-- --------------------------------------------------------- schedule & blocks
-- Weekly schedule; several rows per weekday = split shifts / lunch break gaps.
create table public.working_hours (
  id          uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.booking_resources (id) on delete cascade,
  weekday     smallint not null check (weekday between 1 and 7), -- ISO: 1 = Monday
  start_time  time not null,
  end_time    time not null,
  check (end_time > start_time)
);
create index working_hours_resource_idx on public.working_hours (resource_id, weekday);

-- If ANY override row exists for a (resource, local date), the weekly schedule is
-- ignored for that date: closed rows mean closed, other rows are the special hours.
create table public.working_hour_overrides (
  id          uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.booking_resources (id) on delete cascade,
  on_date     date not null,
  is_closed   boolean not null default false,
  start_time  time,
  end_time    time,
  note        text,
  check (is_closed or (start_time is not null and end_time is not null and end_time > start_time))
);
create index working_hour_overrides_idx on public.working_hour_overrides (resource_id, on_date);

create table public.blocked_intervals (
  id          uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.booking_resources (id) on delete cascade,
  start_at    timestamptz not null,
  end_at      timestamptz not null,
  reason      text,
  created_at  timestamptz not null default now(),
  check (end_at > start_at)
);
create index blocked_intervals_idx on public.blocked_intervals (resource_id, start_at, end_at);

-- ------------------------------------------------------------------ content
create table public.gallery_images (
  id            uuid primary key default gen_random_uuid(),
  storage_path  text not null,
  caption_bg    text,
  caption_en    text,
  category      text,
  alt_bg        text,
  alt_en        text,
  display_order integer not null default 0,
  is_published  boolean not null default true,
  created_at    timestamptz not null default now()
);

create table public.promotions (
  id             uuid primary key default gen_random_uuid(),
  title_bg       text not null,
  title_en       text,
  description_bg text,
  description_en text,
  image_path     text,
  starts_at      timestamptz,
  ends_at        timestamptz,
  is_published   boolean not null default false,
  service_ids    uuid[] not null default '{}',
  display_order  integer not null default 0,
  created_at     timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table public.site_content (
  key        text primary key,
  content_bg text,
  content_en text,
  updated_at timestamptz not null default now()
);

-- --------------------------------------------------------------------- logs
create table public.notification_logs (
  id              uuid primary key default gen_random_uuid(),
  appointment_id  uuid references public.appointments (id) on delete set null,
  kind            text not null,
  recipient       text,
  status          text not null check (status in ('sent', 'failed')),
  provider_id     text,
  error           text,
  idempotency_key text unique,
  created_at      timestamptz not null default now()
);

create table public.audit_logs (
  id         bigint generated always as identity primary key,
  table_name text not null,
  row_id     text,
  action     text not null,
  actor      uuid,
  old_data   jsonb,
  new_data   jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_row_idx on public.audit_logs (table_name, row_id);

-- Audit trigger. Actor comes from app.actor (set by admin RPCs).
create or replace function public.audit_row()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_id text;
begin
  begin
    v_actor := nullif(current_setting('app.actor', true), '')::uuid;
  exception when others then
    v_actor := null;
  end;
  v_id := coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id');
  insert into public.audit_logs (table_name, row_id, action, actor, old_data, new_data)
  values (tg_table_name, v_id, tg_op, v_actor,
          case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end;
$$;

create trigger audit_appointments after insert or update or delete on public.appointments
  for each row execute function public.audit_row();
create trigger audit_services after insert or update or delete on public.services
  for each row execute function public.audit_row();
create trigger audit_service_variants after insert or update or delete on public.service_variants
  for each row execute function public.audit_row();
create trigger audit_working_hours after insert or update or delete on public.working_hours
  for each row execute function public.audit_row();
create trigger audit_working_hour_overrides after insert or update or delete on public.working_hour_overrides
  for each row execute function public.audit_row();
create trigger audit_blocked_intervals after insert or update or delete on public.blocked_intervals
  for each row execute function public.audit_row();
