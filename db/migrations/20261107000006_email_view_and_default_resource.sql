-- Server-only helpers for transactional emails and resource resolution.

create or replace function public.get_default_resource()
returns uuid
language sql stable
set search_path = public
as $$
  select default_resource_id from public.business_settings where id;
$$;

-- Everything an email needs about one appointment + the studio (server only; contains contact data).
create or replace function public.appointment_email_view(p_id uuid)
returns jsonb
language plpgsql stable
set search_path = public
as $$
declare
  a public.appointments;
  s public.business_settings;
begin
  select * into a from public.appointments where id = p_id;
  if a.id is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  select * into s from public.business_settings where id;
  return jsonb_build_object(
    'ok', true,
    'appointment', jsonb_build_object(
      'id', a.id, 'status', a.status, 'locale', a.locale,
      'service_name_bg', a.service_name_bg, 'service_name_en', a.service_name_en,
      'variant_label_bg', a.variant_label_bg, 'variant_label_en', a.variant_label_en,
      'start_at', a.start_at, 'end_at', a.end_at, 'duration_minutes', a.duration_minutes,
      'price_cents', a.price_cents, 'currency', a.currency,
      'customer_name', a.customer_name, 'customer_email', a.customer_email,
      'dog_name', a.dog_name, 'cancellation_reason', a.cancellation_reason),
    'studio', jsonb_build_object(
      'name_bg', s.studio_name_bg, 'name_en', s.studio_name_en, 'phone', s.phone, 'email', s.email,
      'address_bg', s.address_bg, 'address_en', s.address_en, 'is_example_data', s.is_example_data),
    'ttl_minutes', s.confirmation_ttl_minutes);
end;
$$;

