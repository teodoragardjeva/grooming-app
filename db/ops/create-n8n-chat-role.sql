-- One-off operations script (NOT a migration: it needs a password, which must never be committed).
-- Creates a limited PostgreSQL role for n8n's "Postgres Chat Memory", so n8n (and anyone with access to the n8n
-- editor) can touch ONLY its own chat-history table, never the customer / appointment / admin tables.
--
-- Safe to re-run: it creates the role if missing, resets the password, and re-applies the restrictions.
-- Run it as the database owner (POSTGRES_USER), see docs/SETUP.md "Chatbot database role":
--   psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -v pw="<long random password>" -f create-n8n-chat-role.sql

-- 1. The role: can log in, nothing else.
select format('create role n8n_chat login password %L', :'pw')
 where not exists (select 1 from pg_roles where rolname = 'n8n_chat') \gexec
select format('alter role n8n_chat with login password %L nosuperuser nocreatedb nocreaterole noreplication connection limit 5', :'pw') \gexec

-- 2. Its own schema. n8n creates its table (n8n_chat_histories) there on first use; search_path makes the
--    unqualified table name resolve to this schema, so the n8n credential needs no special settings.
create schema if not exists n8n;
alter schema n8n owner to n8n_chat;
alter role n8n_chat set search_path = n8n;

-- 3. Existing deployments: the table was created in "public" by the app's own user. Move it into the new schema.
do $$
begin
  if to_regclass('public.n8n_chat_histories') is not null and to_regclass('n8n.n8n_chat_histories') is null then
    alter table public.n8n_chat_histories set schema n8n;
  end if;
end $$;
alter table if exists n8n.n8n_chat_histories owner to n8n_chat;

-- 4. The role gets no rights on anything in "public" (no table grants exist for it). One function needs an explicit
--    revoke: purge_old_appointments() is SECURITY DEFINER and takes a caller-supplied date, and functions are
--    executable by every role by default, so n8n_chat could otherwise delete all appointments.
revoke all on function public.purge_old_appointments(timestamptz, interval) from public;

-- 5. Fail loudly if the restrictions are not in place.
do $$
begin
  if has_table_privilege('n8n_chat', 'public.customers', 'select')
     or has_table_privilege('n8n_chat', 'public.appointments', 'select')
     or has_table_privilege('n8n_chat', 'public.admin_profiles', 'select') then
    raise exception 'n8n_chat can read application tables';
  end if;
  if has_function_privilege('n8n_chat', 'public.purge_old_appointments(timestamptz, interval)', 'execute') then
    raise exception 'n8n_chat can execute purge_old_appointments';
  end if;
  if has_schema_privilege('n8n_chat', 'public', 'create') then
    raise exception 'n8n_chat can create objects in public';
  end if;
end $$;

\echo 'n8n_chat role is ready. Use it in the n8n Postgres credential (host db, port 5432, user n8n_chat).'
