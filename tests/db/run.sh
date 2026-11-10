#!/usr/bin/env bash
# Real-PostgreSQL tests for schema, booking invariants and concurrency (plain PostgreSQL, no extra roles).
# Needs a reachable PostgreSQL 16 server (PGHOST/PGPORT/PGUSER); `npm run test:db` provides one via Docker.
# Usage: bash tests/db/run.sh
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"




PSQL=(psql -h "${PGHOST:-127.0.0.1}" -p "${PGPORT:-5432}" -U "${PGUSER:-postgres}" -X -q -t -A -v ON_ERROR_STOP=1)

export PGOPTIONS="-c client_min_messages=warning"
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  ok   - $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  FAIL - $1 (expected: [$2] got: [$3])"; }
eq()   { if [[ "$2" == "$3" ]]; then ok "$1"; else bad "$1" "$2" "$3"; fi; }
sql()  { "${PSQL[@]}" -d "$DB" -c "$1" 2>&1; }          # returns scalar text
fresh(){ DB="t_$1"; "${PSQL[@]}" -d postgres -c "drop database if exists $DB" >/dev/null; "${PSQL[@]}" -d postgres -c "create database $DB template tpl" >/dev/null; }


# --- template database: migrations + seed + helpers --------------
"${PSQL[@]}" -d postgres -c "drop database if exists tpl" >/dev/null
"${PSQL[@]}" -d postgres -c "create database tpl" >/dev/null
for f in "$ROOT"/db/migrations/*.sql; do
  "${PSQL[@]}" -d tpl -f "$f" >/dev/null || { echo "migration failed: $f"; exit 2; }
done
"${PSQL[@]}" -d tpl -f "$ROOT/db/seed.sql" >/dev/null || { echo "seed failed"; exit 2; }
"${PSQL[@]}" -d tpl -f "$ROOT/tests/db/helpers.sql" >/dev/null || { echo "helpers failed"; exit 2; }
echo "Migrations + seed applied."

R1=00000000-0000-4000-8000-000000000001
NAIL=00000000-0000-4000-8000-0000000000a1
FULL=00000000-0000-4000-8000-0000000000a2
# Wed 2026-12-02 is a normal Sofia working day (UTC+2). "now" defaults to 2026-11-30 10:00 Sofia.
D=2026-12-02

echo "# 1-2 gap fitting"
fresh gap
sql "insert into working_hour_overrides(resource_id,on_date,start_time,end_time) values ('$R1','$D','12:00','13:00')" >/dev/null
eq "15m service fits 12:00 in 12:00-13:00"      "t" "$(sql "select (t.book('$D 12:00+02')->>'ok')::boolean")"
eq "next 15m at 12:15 still fits (adjacent)"     "t" "$(sql "select (t.book('$D 12:15+02')->>'ok')::boolean")"
eq "same start 12:00 is slot_taken"             "slot_taken" "$(sql "select t.book('$D 12:00+02')->>'error'")"
fresh gap2
sql "insert into working_hour_overrides(resource_id,on_date,start_time,end_time) values ('$R1','$D','12:00','13:00')" >/dev/null
eq "60m service fits exactly in 60m gap"         "t" "$(sql "select (t.book('$D 12:00+02','$FULL','small')->>'ok')::boolean")"
fresh gap3
sql "insert into working_hour_overrides(resource_id,on_date,start_time,end_time) values ('$R1','$D','12:00','13:00')" >/dev/null
eq "90m service does not fit 60m window"         "outside_hours" "$(sql "select t.book('$D 12:00+02','$FULL','medium')->>'error'")"
eq "60m at 12:15 does not fit"                   "outside_hours" "$(sql "select t.book('$D 12:15+02','$FULL','small')->>'error'")"

echo "# 3-4 adjacency and overlap"
fresh adj
eq "admin books 90m 12:00-13:30"                 "t" "$(sql "select (t.book('$D 12:00+02','$FULL','medium','admin')->>'ok')::boolean")"
eq "13:15-14:15 conflicts"                       "slot_taken" "$(sql "select t.book('$D 13:15+02','$FULL','small')->>'error'")"
eq "13:30-14:30 is allowed (adjacent)"           "t" "$(sql "select (t.book('$D 13:30+02','$FULL','small')->>'ok')::boolean")"
eq "11:00-12:15 overlapping start of existing"   "slot_taken" "$(sql "select t.book('$D 11:15+02','$FULL','small')->>'error'")"
sql "select t.book('$D 17:00+02','$NAIL',null,'admin')" >/dev/null
sql "update appointments set status='cancelled' where start_at = '$D 17:00+02'; delete from appointment_allocations where appointment_id=(select id from appointments where start_at='$D 17:00+02')" >/dev/null
eq "raw overlapping allocation rejected by constraint (23P01)" "exclusion_violation" "$(sql "do \$\$ begin insert into appointment_allocations(appointment_id,resource_id,during) select id, resource_id, tstzrange('$D 12:30+02','$D 13:00+02') from appointments where start_at='$D 17:00+02'; raise exception 'no error'; exception when exclusion_violation then null; end \$\$; select 'exclusion_violation'" | tail -1)"

echo "# 5 buffers"
fresh buf
sql "update services set cleanup_buffer_minutes=15, prep_buffer_minutes=0 where id='$FULL'" >/dev/null
R=$(sql "select t.book('$D 12:00+02','$FULL','small','admin')")
eq "60m + 15m cleanup: allocation is 75 minutes" "75" "$(sql "select (extract(epoch from (upper(during)-lower(during)))/60)::int from appointment_allocations")"
eq "customer-visible end stays 13:00"            "$D 13:00:00+02" "$(sql "select to_char(end_at at time zone 'Europe/Sofia','YYYY-MM-DD HH24:MI:SS') || '+02' from appointments")"
eq "booking at 13:00 blocked by cleanup"         "slot_taken" "$(sql "select t.book('$D 13:00+02','$FULL','small')->>'error'")"
eq "booking at 13:15 allowed"                    "t" "$(sql "select (t.book('$D 13:15+02','$FULL','small')->>'ok')::boolean")"
fresh prep
sql "update services set prep_buffer_minutes=10, cleanup_buffer_minutes=0 where id='$NAIL'" >/dev/null
sql "select t.book('$D 12:00+02','$NAIL',null,'admin')" >/dev/null
eq "prep buffer shifts allocation start earlier" "$D 11:50:00+02" "$(sql "select to_char(lower(during) at time zone 'Europe/Sofia','YYYY-MM-DD HH24:MI:SS') || '+02' from appointment_allocations")"
eq "another booking ending at 11:50 is allowed"  "t" "$(sql "select (t.book('$D 11:35+02','$NAIL',null,'admin')->>'ok')::boolean")"

echo "# 5b buffers may overhang opening/closing time"
fresh bufedge
sql "insert into working_hour_overrides(resource_id,on_date,start_time,end_time) values ('$R1','$D','12:00','13:00')" >/dev/null
sql "update services set prep_buffer_minutes=10, cleanup_buffer_minutes=15 where id='$NAIL'" >/dev/null
eq "first booking at opening: prep may start before opening"   "t" "$(sql "select (t.book('$D 12:00+02','$NAIL')->>'ok')::boolean")"
eq "its allocation starts before opening (11:50)"              "$D 11:50:00+02" "$(sql "select to_char(lower(during) at time zone 'Europe/Sofia','YYYY-MM-DD HH24:MI:SS') || '+02' from appointment_allocations")"
fresh bufedge2
sql "insert into working_hour_overrides(resource_id,on_date,start_time,end_time) values ('$R1','$D','12:00','13:00')" >/dev/null
sql "update services set prep_buffer_minutes=10, cleanup_buffer_minutes=15 where id='$NAIL'" >/dev/null
eq "last procedure ending at closing: cleanup may run past it"  "t" "$(sql "select (t.book('$D 12:45+02','$NAIL')->>'ok')::boolean")"
eq "procedure ending after closing is still refused"            "outside_hours" "$(sql "select t.book('$D 12:50+02','$NAIL')->>'error'")"
eq "procedure starting before opening is still refused"         "outside_hours" "$(sql "select t.book('$D 11:55+02','$NAIL')->>'error'")"

echo "# 6 concurrency: 12 parallel requests, same resource+interval"
fresh race
for i in $(seq 1 12); do
  cat > /tmp/race_$i.sql <<EOF
begin;
select coalesce(t.book('$D 15:00+02', '$FULL', 'small', 'public', '2026-11-30 08:00:00+00', '$R1', null, false, 'Race $i', 'race$i@example.com')->>'error', 'ok') as e \gset
select pg_sleep(0.4);
commit;
\echo :e
EOF
  ( "${PSQL[@]}" -d "$DB" -f /tmp/race_$i.sql > /tmp/race_out_$i.txt 2>&1 ) &
done
wait
WIN=0; TAKEN=0
for i in $(seq 1 12); do
  v=$(tail -1 /tmp/race_out_$i.txt | tr -d '[:space:]')
  if [[ "$v" == "ok" ]]; then WIN=$((WIN+1)); elif [[ "$v" == "slot_taken" ]]; then TAKEN=$((TAKEN+1)); fi
done
eq "exactly one parallel request wins"           "1" "$WIN"
eq "all other parallel requests get slot_taken"  "11" "$TAKEN"
eq "exactly one allocation row exists"           "1" "$(sql "select count(*) from appointment_allocations")"
rm -f /tmp/race_*.sql /tmp/race_out_*.txt

echo "# 7 holds and expiry without cron"
fresh hold
sql "select t.book('$D 12:00+02','$NAIL',null,'public','2026-11-30 08:00:00+00','$R1','hash-A')" >/dev/null
eq "active hold blocks (5 min later)"            "slot_taken" "$(sql "select t.book('$D 12:00+02','$NAIL',null,'public','2026-11-30 08:05:00+00')->>'error'")"
eq "expired hold frees slot (11 min later, no cron)" "t" "$(sql "select (t.book('$D 12:00+02','$NAIL',null,'public','2026-11-30 08:11:00+00')->>'ok')::boolean")"
eq "old appointment marked expired"              "1" "$(sql "select count(*) from appointments where status='expired'")"
eq "expired allocation was removed"              "1" "$(sql "select count(*) from appointment_allocations")"

echo "# 8 confirmation lifecycle"
fresh conf
sql "select t.book('$D 12:00+02','$NAIL',null,'public','2026-11-30 08:00:00+00','$R1','tok1')" >/dev/null
eq "confirm before expiry succeeds"              "t" "$(sql "select (public.confirm_booking('tok1','can1','2026-11-30 08:05:00+00')->>'ok')::boolean")"
eq "repeat click is safe (already_confirmed)"    "t" "$(sql "select (public.confirm_booking('tok1','can2','2026-11-30 08:06:00+00')->>'already_confirmed')::boolean")"
eq "repeat click does not create 2nd cancel token" "1" "$(sql "select count(*) from cancellation_tokens")"
eq "appointment confirmed, hold cleared"         "confirmed|true" "$(sql "select status || '|' || (hold_expires_at is null) from appointments")"
sql "select t.book('$D 14:00+02','$NAIL',null,'public','2026-11-30 08:00:00+00','$R1','tok2')" >/dev/null
eq "confirm after expiry fails"                  "expired" "$(sql "select public.confirm_booking('tok2','can3','2026-11-30 08:11:00+00')->>'error'")"
eq "expired confirmation freed the slot"         "0" "$(sql "select count(*) from appointment_allocations a join appointments p on p.id=a.appointment_id where p.status='expired'")"
eq "unknown token is invalid"                    "invalid_token" "$(sql "select public.confirm_booking('nope','x','2026-11-30 08:00:00+00')->>'error'")"

echo "# 9 notice and horizon"
fresh notice
eq "public booking <2h ahead rejected"           "too_soon" "$(sql "select t.book('2026-11-30 11:30+00','$NAIL',null,'public','2026-11-30 10:00:00+00')->>'error'")"
eq "public booking beyond 30 days rejected"      "too_far" "$(sql "select t.book('2027-01-20 12:00+02')->>'error'")"
sql "insert into working_hour_overrides(resource_id,on_date,start_time,end_time) values ('$R1','2026-11-30','09:00','19:00')" >/dev/null
eq "admin may override min notice"               "t" "$(sql "select (t.book('2026-11-30 12:30+02','$NAIL',null,'admin','2026-11-30 10:00:00+02','$R1',null,true)->>'ok')::boolean")"
eq "admin without override still gets too_soon"  "too_soon" "$(sql "select t.book('2026-11-30 10:30+02','$NAIL',null,'admin','2026-11-30 10:00:00+02')->>'error'")"

echo "# 10 customer cancellation 24h (DST-aware)"
fresh cancel
sql "select t.book('2026-12-04 15:00+02','$NAIL',null,'public','2026-11-30 08:00:00+00','$R1','c1')" >/dev/null
sql "select public.confirm_booking('c1','x1','2026-11-30 08:01:00+00')" >/dev/null
eq "cancel at exactly 24h before is allowed"     "t" "$(sql "select (public.cancel_by_token('x1','2026-12-03 15:00:00+02')->>'ok')::boolean")"
eq "cancelled -> allocation released"            "0" "$(sql "select count(*) from appointment_allocations")"
eq "cancel link repeat is safe"                  "t" "$(sql "select (public.cancel_by_token('x1','2026-12-03 15:05:00+02')->>'already_cancelled')::boolean")"
fresh cancel2
sql "select t.book('2026-12-04 15:00+02','$NAIL',null,'public','2026-11-30 08:00:00+00','$R1','c2')" >/dev/null
sql "select public.confirm_booking('c2','x2','2026-11-30 08:01:00+00')" >/dev/null
eq "cancel at 23h59 before is refused"           "too_late" "$(sql "select public.cancel_by_token('x2','2026-12-03 15:00:01+02')->>'error'")"
eq "refused cancel keeps appointment confirmed"  "confirmed" "$(sql "select status from appointments")"
fresh cancel3
sql "insert into working_hour_overrides(resource_id,on_date,start_time,end_time) values ('$R1','2026-03-29','10:00','18:00')" >/dev/null
sql "select t.book('2026-03-29 15:00+03','$NAIL',null,'public','2026-03-20 08:00:00+00','$R1','c3')" >/dev/null
sql "select public.confirm_booking('c3','x3','2026-03-20 08:01:00+00')" >/dev/null
eq "DST spring-forward: deadline is Sat 15:00 local (13:00Z)" "2026-03-28 13:00:00+00:00" "$(sql "set timezone='UTC'; select public.cancel_by_token('x3','2026-03-28 13:00:01+00')->>'deadline'" | tail -1 | sed 's/T/ /')"

echo "# 11 22 admin cancel + history"
fresh admcancel
sql "select t.book('2026-12-04 15:00+02','$NAIL',null,'public','2026-11-30 08:00:00+00','$R1','c4')" >/dev/null
sql "select public.confirm_booking('c4','x4','2026-11-30 08:01:00+00')" >/dev/null
APPT=$(sql "select id from appointments")
eq "admin cancels inside 24h window"             "t" "$(sql "select (public.admin_cancel_appointment('$APPT','Болно куче',null,'2026-12-04 10:00:00+02')->>'ok')::boolean")"
eq "allocation freed"                            "0" "$(sql "select count(*) from appointment_allocations")"
eq "record preserved with reason"                "cancelled|admin|Болно куче" "$(sql "select status||'|'||cancelled_by||'|'||cancellation_reason from appointments")"
eq "freed slot can be booked again"              "t" "$(sql "select (t.book('2026-12-04 15:00+02','$NAIL',null,'admin','2026-11-30 08:00:00+00')->>'ok')::boolean")"
eq "audit log recorded appointment changes"      "t" "$(sql "select count(*) >= 3 from audit_logs where table_name='appointments' and row_id='$APPT'")"
eq "cancel of already-cancelled is rejected"     "not_cancellable" "$(sql "select public.admin_cancel_appointment('$APPT','x')->>'error'")"

echo "# 12 13 admin booking and reschedule"
fresh admin
R=$(sql "select t.book('$D 10:00+02','$NAIL',null,'admin')")
eq "admin booking is confirmed immediately"      "confirmed|admin" "$(sql "select status||'|'||source from appointments")"
eq "admin booking creates no confirmation token" "0" "$(sql "select count(*) from confirmation_tokens")"
sql "select t.book('$D 11:00+02','$FULL','medium','admin')" >/dev/null
APPT=$(sql "select id from appointments where service_id='$NAIL'")
eq "reschedule into occupied time is rejected"   "slot_taken" "$(sql "select public.admin_reschedule_appointment('$APPT','$D 11:30+02')->>'error'")"
eq "failed reschedule leaves original untouched" "$D 10:00" "$(sql "select to_char(start_at at time zone 'Europe/Sofia','YYYY-MM-DD HH24:MI') from appointments where id='$APPT'")"
eq "reschedule into free time succeeds"          "t" "$(sql "select (public.admin_reschedule_appointment('$APPT','$D 16:00+02')->>'ok')::boolean")"
eq "allocation moved with appointment"           "$D 16:00" "$(sql "select to_char(lower(during) at time zone 'Europe/Sofia','YYYY-MM-DD HH24:MI') from appointment_allocations where appointment_id='$APPT'")"
eq "old time is bookable again after move"       "t" "$(sql "select (t.book('$D 10:00+02','$NAIL',null,'admin')->>'ok')::boolean")"
eq "reschedule outside hours rejected"           "outside_hours" "$(sql "select public.admin_reschedule_appointment('$APPT','$D 19:00+02')->>'error'")"
sql "update services set cleanup_buffer_minutes=30 where id='$NAIL'" >/dev/null
eq "reschedule keeps booked snapshot buffers (0) not new catalog value" "0" "$(sql "select cleanup_buffer_minutes from appointments where id='$APPT'")"

echo "# 14 fixed vs size-based"
fresh variants
eq "fixed service needs no size"                 "t" "$(sql "select (t.book('$D 10:00+02','$NAIL')->>'ok')::boolean")"
eq "size-based without variant rejected"         "variant_required" "$(sql "select t.book('$D 12:00+02','$FULL')->>'error'")"
sql "insert into services(id,name_bg,duration_mode) values ('00000000-0000-4000-8000-0000000000a3','Друга','size_based'); insert into service_variants(id,service_id,size_key,label_bg,duration_minutes,price_cents) values ('00000000-0000-4000-8000-0000000000b3','00000000-0000-4000-8000-0000000000a3','small','Малко',30,2000)" >/dev/null
eq "variant of another service rejected"        "variant_invalid" "$(sql "select public.create_appointment('$R1','$FULL','00000000-0000-4000-8000-0000000000b3','$D 12:00+02','A','1','a@b.c',null,null,'admin')->>'error'")"
sql "select t.book('$D 12:00+02','$FULL','medium','admin')" >/dev/null
eq "medium variant uses 90 min and 70.00 EUR"    "90|7000|EUR" "$(sql "select duration_minutes||'|'||price_cents||'|'||currency from appointments where size_key='medium'")"

echo "# 15 holidays, lunch, vacations, blocks"
fresh sched
sql "insert into working_hour_overrides(resource_id,on_date,is_closed,note) values ('$R1','$D',true,'Официален празник')" >/dev/null
eq "closed override (holiday) blocks booking"    "outside_hours" "$(sql "select t.book('$D 12:00+02')->>'error'")"
sql "insert into working_hour_overrides(resource_id,on_date,start_time,end_time) values ('$R1','2026-12-03','09:00','13:00'),('$R1','2026-12-03','14:00','19:00')" >/dev/null
eq "lunch break (13:00-14:00) not bookable"      "outside_hours" "$(sql "select t.book('2026-12-03 13:00+02')->>'error'")"
eq "service spanning lunch rejected"             "outside_hours" "$(sql "select t.book('2026-12-03 12:30+02','$FULL','small')->>'error'")"
eq "after lunch bookable"                        "t" "$(sql "select (t.book('2026-12-03 14:00+02')->>'ok')::boolean")"
sql "insert into blocked_intervals(resource_id,start_at,end_at,reason) values ('$R1','2026-12-07 00:00+02','2026-12-12 00:00+02','Отпуск')" >/dev/null
eq "vacation (blocked interval) prevents booking" "blocked" "$(sql "select t.book('2026-12-08 12:00+02')->>'error'")"
eq "Sunday (weekly closed) not bookable"         "outside_hours" "$(sql "select t.book('2026-12-06 12:00+02')->>'error'")"
eq "conflict finder lists affected appointment"  "1" "$(sql "select t.book('2026-12-15 12:00+02','$NAIL',null,'admin'); select count(*) from find_conflicting_appointments('$R1','2026-12-15 00:00+02','2026-12-16 00:00+02')" | tail -1)"

echo "# 16 snapshots survive catalog edits"
fresh snap
sql "select t.book('$D 10:00+02','$FULL','small','admin')" >/dev/null
sql "update service_variants set price_cents=9999, duration_minutes=15 where service_id='$FULL' and size_key='small'; update services set name_bg='Ново име' where id='$FULL'" >/dev/null
eq "appointment keeps old price/duration/name"   "5000|60|Пълна груминг грижа" "$(sql "select price_cents||'|'||duration_minutes||'|'||service_name_bg from appointments")"

echo "# 18 DST (Europe/Sofia)"
fresh dst
sql "insert into working_hour_overrides(resource_id,on_date,start_time,end_time) values ('$R1','2026-03-29','10:00','18:00'),('$R1','2026-10-25','10:00','18:00')" >/dev/null
eq "winter: 09:00 local = 07:00Z"                "2026-12-02 07:00:00+00" "$(sql "set timezone='UTC'; select lower(w)::text from open_windows('$R1','$D') w order by 1 limit 1" | tail -1)"
eq "after spring-forward: 10:00 local = 07:00Z"  "2026-03-29 07:00:00+00" "$(sql "set timezone='UTC'; select lower(w)::text from open_windows('$R1','2026-03-29') w" | tail -1)"
eq "after fall-back: 10:00 local = 08:00Z"       "2026-10-25 08:00:00+00" "$(sql "set timezone='UTC'; select lower(w)::text from open_windows('$R1','2026-10-25') w" | tail -1)"

echo "# 19 20 resource scoping"
fresh res
sql "insert into booking_resources(id,name) values ('00000000-0000-4000-8000-000000000002','Втори грумър')" >/dev/null
R2=00000000-0000-4000-8000-000000000002
sql "insert into working_hours(resource_id,weekday,start_time,end_time) select '$R2', d, '09:00','19:00' from generate_series(1,7) d" >/dev/null
sql "select t.book('$D 12:00+02','$FULL','small','admin')" >/dev/null
eq "default resource attached to booking"        "$R1" "$(sql "select resource_id from appointments")"
eq "same resource same time conflicts"           "slot_taken" "$(sql "select t.book('$D 12:00+02','$FULL','small')->>'error'")"
eq "second resource can book same time"          "t" "$(sql "select (t.book('$D 12:00+02','$FULL','small','admin','2026-11-30 08:00:00+00','$R2')->>'ok')::boolean")"
eq "two allocations coexist on different resources" "2" "$(sql "select count(*) from appointment_allocations where during && tstzrange('$D 12:00+02','$D 13:00+02')")"

echo "# 21 failed confirmation email"
fresh mailfail
sql "select t.book('$D 12:00+02','$NAIL',null,'public','2026-11-30 08:00:00+00','$R1','m1')" >/dev/null
APPT=$(sql "select id from appointments")
eq "retry: rotate token keeps hold, no duplicate allocation" "1" "$(sql "select public.rotate_confirmation_token('$APPT','m2','2026-11-30 08:02:00+00'); select count(*) from appointment_allocations" | tail -1)"
eq "old token no longer confirms"                "invalid_token" "$(sql "select public.confirm_booking('m1','y','2026-11-30 08:03:00+00')->>'error'")"
eq "new token confirms"                          "t" "$(sql "select (public.confirm_booking('m2','y','2026-11-30 08:03:00+00')->>'ok')::boolean")"
fresh mailfail2
sql "select t.book('$D 12:00+02','$NAIL',null,'public','2026-11-30 08:00:00+00','$R1','m3')" >/dev/null
APPT=$(sql "select id from appointments")
sql "select public.release_failed_booking('$APPT')" >/dev/null
eq "release on email failure frees the slot"     "t" "$(sql "select (t.book('$D 12:00+02','$NAIL',null,'public','2026-11-30 08:01:00+00')->>'ok')::boolean")"


echo "# 23 app-support functions (rate limit, availability inputs, summaries, schedule conflicts)"
fresh app
eq "rate limit allows up to the limit"           "true,true,false" "$(sql "select string_agg(public.check_rate_limit('k1',2,60,'2026-11-30 08:00:00+00')::text, ',') from generate_series(1,3)")"
eq "rate limit window resets after it elapses"   "t" "$(sql "select public.check_rate_limit('k1',2,60,'2026-11-30 08:02:00+00')")"
eq "availability_inputs requires variant for size-based" "variant_required" "$(sql "select public.availability_inputs('$R1','$FULL',null,'$D 00:00+02','$D 23:59+02','2026-11-30 08:00:00+00')->>'error'")"
sql "select t.book('$D 12:00+02','$NAIL',null,'public','2026-11-30 08:00:00+00','$R1','sumhash')" >/dev/null
INP="$(sql "select public.availability_inputs('$R1','$NAIL',null,'$D 00:00+02','$D 23:59+02','2026-11-30 08:00:00+00')")"
eq "availability_inputs lists the pending hold as busy" "1" "$(sql "select jsonb_array_length(('$INP'::jsonb)->'busy')")"
eq "availability_inputs leaks no customer data"  "0" "$(echo "$INP" | grep -c -E 'client@example.com|Тест Клиент|359000000000')"
eq "availability_inputs returns weekly hours"    "6" "$(sql "select jsonb_array_length(('$INP'::jsonb)->'weekly')")"
SUM="$(sql "select public.booking_summary_by_token('confirm','sumhash','2026-11-30 08:01:00+00')")"
eq "summary by token works"                      "t" "$(sql "select (('$SUM'::jsonb)->>'ok')::boolean")"
eq "summary by token has no phone/email"         "0" "$(echo "$SUM" | grep -c -E 'client@example.com|359000000000')"
eq "summary by unknown token is invalid"         "invalid_token" "$(sql "select public.booking_summary_by_token('confirm','nope')->>'error'")"
eq "expired holds disappear from availability_inputs" "0" "$(sql "select jsonb_array_length((public.availability_inputs('$R1','$NAIL',null,'$D 00:00+02','$D 23:59+02','2026-11-30 09:00:00+00'))->'busy')")"

echo "# 24 schedule changes warn about conflicts and never cancel bookings"
fresh sched
sql "select t.book('$D 12:00+02','$NAIL',null,'admin')" >/dev/null
NOWEDS='[{"weekday":1,"start":"09:00","end":"19:00"},{"weekday":2,"start":"09:00","end":"19:00"},{"weekday":4,"start":"09:00","end":"19:00"},{"weekday":5,"start":"09:00","end":"19:00"}]'
eq "weekly hours change with conflict is refused" "conflicts" "$(sql "select public.admin_replace_weekly_hours('$R1','$NOWEDS'::jsonb,false,null,'2026-11-30 08:00:00+00')->>'error'")"
eq "hours were not changed by the refused call"  "6" "$(sql "select count(*) from working_hours")"
eq "conflicting appointment is reported"         "1" "$(sql "select jsonb_array_length(public.admin_replace_weekly_hours('$R1','$NOWEDS'::jsonb,false,null,'2026-11-30 08:00:00+00')->'conflicts')")"
eq "explicit confirmation applies the change"    "t" "$(sql "select (public.admin_replace_weekly_hours('$R1','$NOWEDS'::jsonb,true,null,'2026-11-30 08:00:00+00')->>'ok')::boolean")"
eq "appointment is NOT cancelled by schedule change" "confirmed" "$(sql "select status from appointments")"
eq "appointment still holds its allocation"      "1" "$(sql "select count(*) from appointment_allocations")"
fresh sched2
sql "select t.book('$D 12:00+02','$NAIL',null,'admin')" >/dev/null
eq "closing a day with a booking is refused"     "conflicts" "$(sql "select public.admin_set_override_range('$R1','$D','$D',true,null,null,'Почивен ден',false,null,'2026-11-30 08:00:00+00')->>'error'")"
eq "no override row written when refused"        "0" "$(sql "select count(*) from working_hour_overrides")"
eq "vacation range on empty days succeeds"       "5" "$(sql "select public.admin_set_override_range('$R1','2026-12-07','2026-12-11',true,null,null,'Отпуск',false,null,'2026-11-30 08:00:00+00')->>'days'")"
eq "vacation days are closed"                    "5" "$(sql "select count(*) from working_hour_overrides where is_closed")"
eq "special hours override validated"            "invalid_input" "$(sql "select public.admin_set_override_range('$R1','2026-12-14','2026-12-14',false,'15:00','10:00',null,false,null,'2026-11-30 08:00:00+00')->>'error'")"
eq "block over a booking is refused"             "conflicts" "$(sql "select public.admin_add_block('$R1','$D 11:30+02','$D 12:30+02','Лекар',false)->>'error'")"
eq "block over free time is created"             "t" "$(sql "select (public.admin_add_block('$R1','$D 15:00+02','$D 16:00+02','Лекар',false)->>'ok')::boolean")"
eq "slot inside the new block is rejected"       "blocked" "$(sql "select t.book('$D 15:15+02','$NAIL',null,'public')->>'error'")"
eq "housekeeping runs and releases expired holds" "t" "$(sql "select (public.housekeeping('2026-12-30 08:00:00+00')->>'released_holds') is not null")"


echo "# 26 issue_cancellation_token"
fresh issue
sql "select t.book('$D 12:00+02','$NAIL',null,'admin')" >/dev/null
APPT=$(sql "select id from appointments")
eq "token issued for confirmed future appointment" "t" "$(sql "select (public.issue_cancellation_token('$APPT','ct1','2026-11-30 08:00:00+00')->>'ok')::boolean")"
eq "new token supersedes the previous one"       "t" "$(sql "select (public.issue_cancellation_token('$APPT','ct2','2026-11-30 08:00:00+00')->>'ok')::boolean")"
eq "old token no longer cancels (used)"          "t" "$(sql "select (select used_at is not null from cancellation_tokens where token_hash='ct1')")"
eq "new token cancels"                           "t" "$(sql "select (public.cancel_by_token('ct2','2026-11-30 08:01:00+00')->>'ok')::boolean")"
eq "no token for cancelled appointment"          "not_cancellable" "$(sql "select public.issue_cancellation_token('$APPT','ct3','2026-11-30 08:02:00+00')->>'error'")"

echo "# 27 one pending reservation per e-mail"
fresh onepend
eq "first pending booking is accepted"           "t" "$(sql "select (t.book('$D 12:00+02',p_email=>'Anna@Example.com')->>'ok')::boolean")"
eq "second pending for same e-mail is refused"   "pending_exists" "$(sql "select t.book('$D 14:00+02',p_email=>'anna@example.com')->>'error'")"
eq "a different e-mail can still book"           "t" "$(sql "select (t.book('$D 14:00+02',p_email=>'boris@example.com')->>'ok')::boolean")"
eq "refused request left no extra appointment"   "2" "$(sql "select count(*) from appointments")"
eq "admin can book the same e-mail (confirmed)"  "t" "$(sql "select (t.book('$D 16:00+02',p_source=>'admin',p_email=>'anna@example.com')->>'ok')::boolean")"
eq "after the hold expires the e-mail may book again" "t" "$(sql "select (t.book('$D 12:00+02',p_now=>'2026-11-30 09:00:00+00',p_email=>'anna@example.com')->>'ok')::boolean")"
APPT=$(sql "select id from appointments where lower(customer_email)='boris@example.com'")
sql "select public.confirm_booking('x','2026-11-30 08:01:00+00')" >/dev/null
sql "update appointments set status='confirmed', hold_expires_at=null where id='$APPT'" >/dev/null
eq "after confirmation the e-mail may book again" "t" "$(sql "select (t.book('$D 10:00+02',p_email=>'boris@example.com')->>'ok')::boolean")"

echo "# 28 purge_old_appointments"
fresh purge
sql "select t.book('2026-09-01 12:00+02',p_source=>'admin',p_now=>'2026-08-01 08:00:00+00',p_override=>true,p_email=>'old@example.com')" >/dev/null
sql "select t.book('2026-11-20 12:00+02',p_source=>'admin',p_now=>'2026-11-01 08:00:00+00',p_override=>true,p_email=>'recent@example.com')" >/dev/null
sql "select t.book('2026-12-02 12:00+02',p_source=>'admin',p_email=>'future@example.com')" >/dev/null
sql "insert into notification_logs(appointment_id,kind,recipient,status) select id,'confirmed',customer_email,'sent' from appointments" >/dev/null
eq "3 appointments before purge"                 "3" "$(sql "select count(*) from appointments")"
eq "purge deletes only the >1 month old one"     "1" "$(sql "select public.purge_old_appointments('2026-11-30 08:00:00+00')->>'appointments_deleted'")"
eq "recent and future appointments are kept"     "2" "$(sql "select count(*) from appointments")"
eq "old customer record is gone"                 "0" "$(sql "select count(*) from customers where lower(email)='old@example.com'")"
eq "recent customer record is kept"              "1" "$(sql "select count(*) from customers where lower(email)='recent@example.com'")"
eq "old notification log (e-mail) is gone"       "0" "$(sql "select count(*) from notification_logs where recipient='old@example.com'")"
eq "no audit log keeps the old customer data"    "0" "$(sql "select count(*) from audit_logs where old_data->>'customer_email'='old@example.com' or new_data->>'customer_email'='old@example.com'")"
eq "old allocation is gone"                      "2" "$(sql "select count(*) from appointment_allocations")"
eq "purge is repeatable (nothing left to do)"    "0" "$(sql "select public.purge_old_appointments('2026-11-30 08:00:00+00')->>'appointments_deleted'")"

echo "# 29 admin accounts and sessions"
fresh admin2
eq "admin e-mail is unique case-insensitively"   "unique_violation" "$(sql "insert into admin_profiles(email,password_hash) values ('a@example.com','x'); do \$\$ begin insert into admin_profiles(email,password_hash) values ('A@Example.com','y'); raise exception 'no error'; exception when unique_violation then null; end \$\$; select 'unique_violation'" | tail -1)"
sql "insert into admin_sessions(token_hash,user_id,expires_at) select 'old', user_id, '2026-11-01 00:00:00+00' from admin_profiles; insert into admin_sessions(token_hash,user_id,expires_at) select 'live', user_id, '2027-01-01 00:00:00+00' from admin_profiles" >/dev/null
eq "housekeeping removes only expired sessions"  "live" "$(sql "select public.housekeeping('2026-11-30 08:00:00+00') is not null; select token_hash from admin_sessions" | tail -1)"
eq "deleting an admin removes their sessions"    "0" "$(sql "delete from admin_profiles; select count(*) from admin_sessions" | tail -1)"

echo
echo "RESULT: $PASS passed, $FAIL failed"
[[ $FAIL -eq 0 ]]
