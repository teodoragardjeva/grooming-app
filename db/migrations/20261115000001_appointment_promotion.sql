-- Informational promotion on an appointment. The customer opened the booking from a promotion ("Резервирай по тази
-- оферта"); the studio decides on site whether to apply it. It never changes the price or availability.
-- The title is copied at booking time so the admin still sees what the customer saw if the promotion is edited later.

alter table public.appointments
  add column promotion_id       uuid references public.promotions (id) on delete set null,
  add column promotion_title_bg text,
  add column promotion_title_en text;

-- Attaches a promotion to a just-created public appointment. Returns {ok:false} (and changes nothing) when the
-- promotion is not published, not active now, or does not apply to the appointment's service. Booking never depends on it.
create or replace function public.attach_promotion(
  p_appointment_id uuid,
  p_promotion_id   uuid,
  p_now            timestamptz default now()
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_rows integer;
begin
  update public.appointments a
     set promotion_id = p.id,
         promotion_title_bg = p.title_bg,
         promotion_title_en = p.title_en
    from public.promotions p
   where a.id = p_appointment_id
     and a.source = 'public'
     and a.status = 'pending_confirmation'
     and p.id = p_promotion_id
     and p.is_published
     and (p.starts_at is null or p.starts_at <= p_now)
     and (p.ends_at is null or p.ends_at > p_now)
     and (cardinality(p.service_ids) = 0 or a.service_id = any (p.service_ids));
  get diagnostics v_rows = row_count;
  return jsonb_build_object('ok', v_rows = 1);
end;
$$;
