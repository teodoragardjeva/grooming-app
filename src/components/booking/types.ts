export interface BookingVariant { id: string; label: string; durationMinutes: number; priceCents: number }
export interface BookingService {
  id: string;
  name: string;
  description: string;
  durationMinutes: number | null; // fixed services
  priceCents: number | null; // fixed services
  variants: BookingVariant[];
}
export interface SlotDto { start: string; end: string; available: boolean; reason?: string }
