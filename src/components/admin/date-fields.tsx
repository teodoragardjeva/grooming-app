"use client";
// Admin date/time inputs with a fixed format: dd/mm/yyyy (calendar starts on Monday) and 24-hour HH:mm.
// The form still submits the same values as the native inputs did (yyyy-mm-dd, HH:mm, yyyy-mm-ddTHH:mm).
import { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { bg as dpBg } from "react-day-picker/locale";
import "react-day-picker/style.css";
import { dmyToIso, isoToDmy, maskDmy, maskHm, validHm } from "@/lib/admin/date-input";

const fieldCls = "mt-1 w-full rounded-lg border border-burgundy-800/40 bg-white px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500";

const MSG_DATE = "Въведете валидна дата във формат дд/мм/гггг.";
const MSG_TIME = "Въведете час във формат чч:мм (24 часа).";

function parseIso(iso: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : undefined;
}
const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

interface DateInputProps {
  id: string;
  text: string;
  onText: (v: string) => void;
  required?: boolean;
  min?: string; // yyyy-mm-dd
  className?: string;
}

/** Text input (dd/mm/yyyy) + calendar popover. Validity is reported through the browser's form validation. */
function DateInput({ id, text, onText, required, min, className }: DateInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const iso = dmyToIso(text);

  useEffect(() => {
    let msg = "";
    if (!text) msg = required ? MSG_DATE : "";
    else if (!iso) msg = MSG_DATE;
    else if (min && iso < min) msg = `Датата не може да е преди ${isoToDmy(min)}.`;
    ref.current?.setCustomValidity(msg);
  }, [text, iso, required, min]);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); ref.current?.focus(); } };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const selected = iso ? parseIso(iso) : undefined;
  return (
    <div ref={box} className="relative">
      <input
        ref={ref}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="дд/мм/гггг"
        maxLength={10}
        value={text}
        onChange={(e) => onText(maskDmy(e.target.value))}
        className={`${className ?? fieldCls} pr-11`}
      />
      <button
        type="button"
        aria-label="Отвори календар"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="absolute right-1 top-1 inline-flex size-9 items-center justify-center rounded-md text-burgundy-800 hover:bg-burgundy-800/10 focus-visible:outline-2 focus-visible:outline-gold-500"
      >
        <CalendarDays aria-hidden="true" className="size-5" />
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-1 rounded-xl border border-burgundy-800/30 bg-white p-2 shadow-lg">
          <DayPicker
            mode="single"
            weekStartsOn={1}
            locale={dpBg}
            defaultMonth={selected}
            selected={selected}
            disabled={min ? { before: parseIso(min) ?? new Date(0) } : undefined}
            onSelect={(d) => { if (d) { onText(isoToDmy(toIso(d))); setOpen(false); ref.current?.focus(); } }}
          />
        </div>
      )}
    </div>
  );
}

interface FieldProps { id: string; name: string; required?: boolean; className?: string }

/** Date field submitting `name` = yyyy-mm-dd (empty when blank/invalid). */
export function DateField({ id, name, defaultValue, required, min, className }: FieldProps & { defaultValue?: string; min?: string }) {
  const [text, setText] = useState(isoToDmy(defaultValue));
  return (
    <>
      <DateInput id={id} text={text} onText={setText} required={required} min={min} className={className} />
      <input type="hidden" name={name} value={dmyToIso(text) ?? ""} />
    </>
  );
}

/** 24-hour time field submitting `name` = HH:mm. */
export function TimeField({ id, name, defaultValue, required, className }: FieldProps & { defaultValue?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(defaultValue ?? "");
  useEffect(() => {
    ref.current?.setCustomValidity(!text ? (required ? MSG_TIME : "") : validHm(text) ? "" : MSG_TIME);
  }, [text, required]);
  return (
    <input
      ref={ref}
      id={id}
      name={name}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="чч:мм"
      maxLength={5}
      value={text}
      onChange={(e) => setText(maskHm(e.target.value))}
      className={className ?? fieldCls}
    />
  );
}

/** Date + 24-hour time submitting `name` = yyyy-mm-ddTHH:mm (the value a datetime-local input produced). */
export function DateTimeField({ id, name, required, className }: FieldProps) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const iso = dmyToIso(date);
  const hm = validHm(time);
  const tRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    tRef.current?.setCustomValidity(!time ? (required ? MSG_TIME : "") : hm ? "" : MSG_TIME);
  }, [time, hm, required]);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
      <DateInput id={id} text={date} onText={setDate} required={required} className={className} />
      <input
        ref={tRef}
        id={`${id}-time`}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="чч:мм"
        aria-label="Час"
        maxLength={5}
        value={time}
        onChange={(e) => setTime(maskHm(e.target.value))}
        className={className ?? fieldCls}
      />
      <input type="hidden" name={name} value={iso && hm ? `${iso}T${hm}` : ""} />
    </div>
  );
}
