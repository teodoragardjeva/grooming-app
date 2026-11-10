-- Issues a fresh self-service cancellation token for a confirmed future appointment
-- (admin-created bookings, or a retry when the confirmation email could not be delivered).
-- Earlier unused tokens for the appointment are invalidated. Server only.
create or replace function public.issue_cancellation_token(
  p_appointment_id uuid, p_hash text, p_now timestamptz default now()
) returns jsonb
language plpgsql
set search_path = public
as $$
declare a public.appointments;
begin
  select * into a from public.appointments where id = p_appointment_id for update;
  if a.id is null or a.status <> 'confirmed' or a.start_at <= p_now then
    return jsonb_build_object('ok', false, 'error', 'not_cancellable');
  end if;
  update public.cancellation_tokens set used_at = p_now where appointment_id = a.id and used_at is null;
  insert into public.cancellation_tokens (appointment_id, token_hash, expires_at)
  values (a.id, p_hash, a.start_at);
  return jsonb_build_object('ok', true);
end;
$$;
