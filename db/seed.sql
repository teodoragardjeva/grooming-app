-- EXAMPLE seed data only. Every contact detail, price and service below is a placeholder
-- until the owner edits it in the admin panel. business_settings.is_example_data = true.

insert into public.booking_resources (id, name, display_order)
values ('00000000-0000-4000-8000-000000000001', 'Основен грумър', 0)
on conflict (id) do nothing;

insert into public.business_settings (
  id, default_resource_id, studio_name_bg, studio_name_en, phone, email,
  address_bg, address_en, is_example_data)
values (
  true, '00000000-0000-4000-8000-000000000001',
  'Магически Лапички', 'Magic Paws',
  '+359 00 000 0000', 'example@example.com',
  'ПРИМЕР: адресът ще бъде добавен от собственика', 'EXAMPLE: address to be added by the owner', true)
on conflict (id) do nothing;

-- Example weekly hours: Mon-Fri 09:00-19:00, Sat 10:00-16:00, Sunday closed.
insert into public.working_hours (resource_id, weekday, start_time, end_time)
select '00000000-0000-4000-8000-000000000001', d, time '09:00', time '19:00' from generate_series(1, 5) d;
insert into public.working_hours (resource_id, weekday, start_time, end_time)
values ('00000000-0000-4000-8000-000000000001', 6, '10:00', '16:00');

-- Example services (prices in EUR cents).
insert into public.services (id, name_bg, name_en, description_bg, description_en, display_order,
                             duration_mode, fixed_duration_minutes, fixed_price_cents)
values ('00000000-0000-4000-8000-0000000000a1', 'Подрязване на нокти', 'Nail trim',
        'Бързо и нежно подрязване на ноктите.', 'Quick and gentle nail trimming.', 10,
        'fixed', 15, 1500);

insert into public.services (id, name_bg, name_en, description_bg, description_en, display_order, duration_mode)
values ('00000000-0000-4000-8000-0000000000a2', 'Пълна груминг грижа', 'Full grooming',
        'Къпане, изсушаване, подстригване и финален стайлинг.',
        'Bath, drying, trimming and final styling.', 20, 'size_based');

insert into public.service_variants (service_id, size_key, label_bg, label_en, duration_minutes, price_cents, display_order)
values
 ('00000000-0000-4000-8000-0000000000a2', 'small',  'Малко куче',   'Small dog',   60,  5000, 1),
 ('00000000-0000-4000-8000-0000000000a2', 'medium', 'Средно куче',  'Medium dog',  90,  7000, 2),
 ('00000000-0000-4000-8000-0000000000a2', 'large',  'Голямо куче',  'Large dog',  120,  9000, 3);

insert into public.site_content (key, content_bg, content_en) values
 ('home.hero_title',    'Магически грижи за твоето куче', 'Magical care for your dog'),
 ('home.hero_subtitle', 'Бутиково груминг студио с професионална грижа и щипка магия.',
                       'A boutique grooming studio with professional care and a touch of magic.')
on conflict (key) do nothing;
