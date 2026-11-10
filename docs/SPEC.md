# DOG GROOMING STUDIO — COMPLETE MASTER IMPLEMENTATION PROMPT
# Version 1.0 | Production-oriented MVP | Bulgarian-language application

ROLE AND GOAL
You are a senior full-stack engineer, software architect, database engineer, product designer and QA engineer. Build a production-ready website and appointment management system for a boutique dog grooming studio in Bulgaria. Deliver working source code, schema migrations, configuration, tests and deployment documentation, not just a visual prototype.

The entire customer-facing website, admin dashboard, form validation messages and transactional emails must be in Bulgarian. Technical code, identifiers and developer documentation may be in English.

Follow the requirements below as the authoritative specification. If a choice is not specified, choose a sensible, simple default, document the assumption and proceed. Avoid unnecessary complexity. Work incrementally, verify each phase, and never claim that mock or untested functionality is complete.

============================================================
01. TECHNOLOGY, ARCHITECTURE AND DEPLOYMENT
============================================================
Required stack:
- Next.js (App Router) + TypeScript strict mode
- Tailwind CSS + shadcn/ui + Lucide icons
- PostgreSQL 16 in Docker (persistent operational data)
- Own administrator sign-in (scrypt password hashes, server-side sessions)
- Docker volume for gallery/service images
- Resend (transactional emails)
- React Hook Form + Zod
- React DayPicker or an accessible equivalent for date selection
- date-fns or a reliable time-zone-aware date library
- Vitest for unit/integration tests, Playwright for E2E
- GitHub as source-code repository

Guidelines:
- GitHub stores code, migrations and documentation, NOT operational customer data or secrets.
- PostgreSQL stores services, appointments, customer details, settings, content and images.
- Use Server Components when useful and secure Server Actions/Route Handlers for mutations.
- Never expose database credentials or the Resend API key to browsers.
- Provide .env.example, SQL migrations, a useful README and production setup steps.
- Do not introduce online payment providers in MVP.

============================================================
02. FIXED MVP BUSINESS DECISIONS
============================================================
- ONE active groomer / ONE bookable resource / ONE shared booking calendar in MVP.
- No groomer selection in public UI for MVP.
- Architecture MUST support multiple independent groomers/resources in the future, without rewriting scheduling rules.
- Customers can book without creating user accounts.
- Service prices are visible; payment takes place at the studio ("Плащане на място в студиото").
- Each service individually selects either fixed duration or size-dependent variants (duration and optional price differences).
- Default slot granularity: 15 minutes (admin-configurable).
- Minimum customer advance notice: 2 hours before appointment start (admin-configurable).
- Booking horizon: 30 days (admin-configurable).
- Email confirmation time limit: 10 minutes (admin-configurable).
- Customer self-service cancellation: allowed only until 24 hours before start (admin-configurable).
- Default preparation and cleanup buffer: 0 minutes, with global defaults and per-service overrides.
- Studio time zone: Europe/Sofia. Store timestamps as timezone-aware UTC instants and present local Bulgarian time accurately, including daylight-saving transitions.
- Admin may create, cancel and reschedule appointments directly.
- Admin may override the customer cancellation and minimum-notice rules only through authorized admin functions; overlap/capacity validation always remains mandatory.

============================================================
03. DESIGN AND USER EXPERIENCE
============================================================
A premium, warm, friendly boutique pet-care brand, not a generic SaaS template:
- Soft neutrals, restrained accent colors, elegant Cyrillic-compatible fonts, modern cards, rounded corners and generous whitespace.
- High-quality dog photography, optimized images and subtle animations.
- Mobile-first responsive experience and accessible color contrast, labels, keyboard navigation and clear focus states.
- Consistent loading, empty, success and failure states.
- Prominent “Запази час” calls to action throughout the site.
- Administrator experience should prioritize fast management: day/week/month calendar, click open slot to create, click booking to view/edit/cancel, explicit confirmations for destructive operations.
- Do not invent testimonials, business addresses or contact details: use editable placeholders/seed examples clearly marked as examples until owner supplies real details.

============================================================
04. PUBLIC WEBSITE PAGES
============================================================
/                  Homepage: hero, about intro, featured services with prices, benefits, gallery preview, active promotions, optional admin-managed reviews, CTA, contacts.
/services          Active services with name, description, image, fixed/variant duration, visible price or starting price, booking availability.
/about             Editable studio description and team introduction.
/gallery           Responsive optimized gallery, lightbox, optional categories/captions, admin-defined ordering.
/promotions        Published, currently valid promotions (title, description, optional image, dates, optional related services).
/contacts          Editable address, telephone with click-to-call, email, hours, map link/embed and socials.
/booking           Full real-data booking experience, detailed below.
/legal/privacy     Owner-reviewed privacy information.
/legal/terms       Booking/cancellation terms.
/legal/cookies     Cookie policy when applicable.

Required SEO and quality:
- Bulgarian language metadata, titles/descriptions, Open Graph tags, sitemap, robots, responsive optimized images, semantic HTML and LocalBusiness schema where appropriate.
- Do not index admin pages or expose private appointment/customer details to crawlers.
- Content and business details are editable by admins rather than hardcoded.

============================================================
05. SERVICE CATALOG AND SIZE VARIANTS
============================================================
Admin CRUD for each service:
- name, description, optional image, active/booking-enabled flags, display order
- duration_mode = fixed | size_based
- fixed duration and price OR configured size variants with duration and price
- global preparation/cleanup buffer defaults and per-service overrides
- optional publication/availability rules (avoid unnecessary scope beyond essentials)

Examples only (fully editable, not hardcoded business values):
A. Nail trim: fixed 15 minutes, 15 BGN, no dog size needed.
B. Full grooming:
   small dog: 60 minutes, 50 BGN
   medium dog: 90 minutes, 70 BGN
   large dog: 120 minutes, 90 BGN.

For fixed-duration services, do not ask dog size. For size-based services, require a valid selection and use the selected variant's actual duration and price. Show customer the exact price/duration before submission. For historical accuracy, copy service name, variant, price, duration and buffers into each appointment; editing the catalog must not silently mutate past bookings. Store monetary values in safe decimal or minor-unit representation. Support configurable currency display rather than assuming BGN will always remain the currency.

============================================================
06. PUBLIC BOOKING CUSTOMER JOURNEY
============================================================
1. Choose service.
2. If needed, choose dog-size variant.
3. Show actual price, duration and “Плащане на място в студиото”.
4. Select date in accessible calendar.
5. Server returns valid start times based on full interval and constraints; show selectable free slots and disabled unavailable slots.
6. Enter required full name, phone and email; optional dog name and notes.
7. Show final summary (service, size, price, start, end, duration, studio payment).
8. Server validates again and creates a temporary hold plus pending appointment atomically.
9. Email a single-use confirmation link. Explain 10-minute expiration.
10. Customer confirms via link and receives final confirmation email.
11. Confirmed booking becomes permanent in administrator calendar.

A pending booking is NOT a confirmed appointment, but its active hold temporarily blocks other customers. After expiration, it must no longer block availability, even if background cleanup has not run. Never display customer contact information in public availability views.

============================================================
07. WORKING HOURS AND AVAILABILITY ENGINE
============================================================
All availability is derived and checked SERVER-SIDE from:
- active groomer/resource assignment
- weekly working schedule (multiple open intervals/day permitted)
- date-specific overrides, holidays, vacations, closures
- lunch breaks and manually blocked intervals
- confirmed appointment allocations and still-active pending holds
- selected service/variant duration
- preparation and cleanup buffers
- slot increment (default 15 minutes)
- minimum advance notice (default 2 hours)
- booking horizon (default 30 days)

Use half-open intervals [start, end) to allow adjacent appointments where buffers permit. The entire reserved interval, including preparation before and cleanup after, must fit in an open window and not overlap blocked or allocated time. Display customer-facing procedure start/end separately from internal allocation start/end.

ILLUSTRATIVE AVAILABILITY EXAMPLES:
Free working interval 12:00–13:00, no buffers:
- 15-minute service: 12:00, 12:15, 12:30, 12:45 allowed.
- 30-minute service: 12:00, 12:15, 12:30 allowed; 12:45 disabled.
- 60-minute service: only 12:00 allowed.
- 90-minute service: none allowed.

Existing allocation 12:00–13:30:
- New 13:30–14:30 is allowed if work hours allow and no buffers.
- New 13:15–14:15 must be rejected.

BUFFER EXAMPLE:
- Service starts 12:00, duration 60 min, cleanup 15 min.
- Customer sees procedure 12:00–13:00.
- Resource allocation is 12:00–13:15.
- Next booking earliest 13:15, subject to its own preparation buffer and working hours.

The customer slot list MUST recompute when service/size changes. Admin calendar must visibly distinguish procedure duration vs blocked cleanup/preparation when helpful.

============================================================
08. ZERO-OVERLAP, CONCURRENCY AND HOLD LIFECYCLE
============================================================
A double booking must be impossible even with two simultaneous requests. A disabled frontend slot is not concurrency protection.

Recommended database design:
- appointments record statuses and booking/customer/service snapshots.
- appointment_allocations represent occupancy for one bookable resource.
- reservation holds and confirmed occupancy both block conflicting allocations.
- PostgreSQL tstzrange with a resource-scoped GiST exclusion constraint (with btree_gist if required), using database transactions/RPC.
- Correctly release expired hold allocations transactionally before accepting a conflicting allocation.
- Do not use a volatile or time-dependent predicate such as expires_at > now() in a partial exclusion index.
- Handle constraint violations and transaction races with well-defined, safe retry/failure outcomes.
- All public and admin creates/reschedules use the SAME database conflict invariant.
- Keep a stable resource_id on allocations and resource-specific availability data.

Booking statuses: pending_confirmation, confirmed, expired, cancelled, completed, no_show.

On booking submission:
- validate fields, service/variant, time zone, available schedule, notice and horizon on server.
- compute price/duration/buffers server-side.
- atomically reserve allocated interval and create pending appointment.
- create cryptographically secure single-use token; store hash, not raw token; 10-minute expiry by default.
- send confirmation email via Resend.
- on email failure, safely release hold/mark failure and expose a retry path without duplicate allocations.

On confirmation:
- securely validate token, expiry and pending state.
- atomically mark confirmed, retain allocation, invalidate token.
- idempotently handle duplicate clicks.
- send final confirmation email; if this later email fails, booking stays confirmed and sending may be retried safely.

On hold expiration:
- expired unconfirmed holds must be released automatically through request-time cleanup/reconciliation and optionally scheduled cleanup.
- never depend ONLY on a cron task to make expired slots bookable.
- do not include expired holds in occupancy after correct transactional release.

============================================================
09. CUSTOMER CANCELLATION — 24 HOURS
============================================================
- Include secure cancellation link in the confirmed-booking email.
- Allow customer self-service cancellation only when current instant <= appointment start minus 24 hours.
- Example: Friday 15:00 appointment can be self-cancelled no later than Thursday 15:00 (studio local time, respecting DST).
- If less than 24h remains, display a clear message instructing the customer to contact studio; do not cancel through public link.
- When allowed: atomically mark cancelled, release allocation, retain record/history and notify by email.
- Do not leak booking details through predictable identifiers.
- Admin cancellation overrides the 24-hour restriction, but not security/authentication requirements.

============================================================
10. ADMIN AUTHENTICATION AND AUTHORIZATION
============================================================
- /admin/login with own password sign-in; no public admin registration.
- Provision admin accounts explicitly and document the setup.
- Server-side admin authorization on ALL pages/actions/endpoints, not only client UI.
- The database is reachable only from the app; server-side authorization guards customer data.
- Secure session/logout; avoid exposing database credentials.
- Audit critical changes, especially appointment, hours and service mutations.

============================================================
11. ADMIN DASHBOARD — FULL OPERATIONS
============================================================
Overview: today's/upcoming confirmed bookings, pending holds, cancellations and quick actions.

Calendar: day, week, month views showing start/end, customer, selected service/size, status and useful buffer visualization. Click available time to create booking; click booking to inspect/manage. Optionally filter by status. Only one groomer/calendar appears in MVP.

ADMIN MUST BE ABLE TO:
A. Manually create appointment:
- choose a calendar slot, service, variant if needed, customer name/phone/email (email may be optional only if documented as a distinct admin-only offline-contact scenario), dog name/notes.
- show exact price, service duration, cleanup/prep intervals.
- confirm directly without customer email confirmation; mark source=admin.
- enforce resource overlap, working closures and service buffers; admin may explicitly override minimum advance notice only.
- optional appointment information email when email available.

B. Cancel any appointment:
- select booking, confirm action, optional cancellation reason.
- atomically mark cancelled and release allocation, show freed interval.
- retain cancellation history/audit log.
- send cancellation email if customer email exists; log failures without undoing successful cancellation.

C. Reschedule:
- choose valid new date/time, check complete allocated interval, perform atomic move without overlap/double booking; retain history and optionally send notification.
- do not require customer reconfirmation by default for admin rescheduling.

D. Other actions:
- mark completed, mark no-show, view full details and history, edit admin-only notes.
- block/unblock specific intervals or full days; create vacations and special working hours.
- manage weekly working schedule with split shifts and lunch breaks.

On schedule changes that conflict with existing confirmed appointments, warn admin and require an explicit decision; NEVER silently cancel/overwrite existing bookings.

Other admin CRUD areas:
- services, size variants, prices, durations and buffers
- gallery image upload/preview/delete/reorder/categorize with file-type/size checks
- promotions with publishing and validity windows
- studio settings: name, logo, copy, contact details, map, socials, SEO and booking parameters
- site content and legal content (owner should review final legal text)

============================================================
12. FUTURE MULTI-GROOMER ARCHITECTURE — DESIGN NOW, UI LATER
============================================================
The MVP has exactly one groomer but must be resource-aware in the database and business logic:
- groomers/booking_resources table with one seeded default active resource.
- appointments and allocations reference resource_id.
- working hours, date overrides and blocks can be scoped per resource.
- exclusion constraints prevent overlaps for SAME resource, not across different resources.
- service-to-resource eligibility may be added in future without reworking appointment core.
- backend should accept/derive a resource identifier internally; public MVP fixes it to the default.

Future capabilities (NOT part of initial public/admin UI): multiple groomers, individual calendars and hours, individual leave/blocks, separate appointment allocations, optional customer groomer selection and service eligibility. Two different resources can be booked simultaneously; one resource cannot overlap itself. Avoid hardcoded global-single-calendar assumptions in database or business logic.

============================================================
13. EMAILS AND OPTIONAL MARKETING
============================================================
Use Resend for Bulgarian transactional templates:
- request to confirm booking (10-minute link)
- confirmed appointment details + cancellation link
- cancellation notice
- admin reschedule notice
- optional 24-hour reminder (only if reliable scheduling is configured)

Include studio contact, service, variant if applicable, date/time in Europe/Sofia, duration, price and "Плащане на място в студиото". Verify sender domain. Log sends, failures and idempotency keys where helpful. No false claims of delivery when provider fails.

Marketing email campaigns are OPTIONAL/FUTURE, not a blocker for MVP. If implemented, require distinct unchecked opt-in, consent records and unsubscribing; do not automatically subscribe booking customers; use a provider suitable for promotional campaigns. Verify free-plan limits and applicable requirements before relying on them.

============================================================
14. DATABASE, PRIVACY AND SECURITY
============================================================
Suggested entities (refine as needed):
- admin_profiles / roles
- booking_resources (or groomers)
- services, service_variants
- customers
- appointments, appointment_allocations
- confirmation_tokens, cancellation_tokens
- working_hours, working_hour_overrides, blocked_intervals
- gallery_images, promotions
- business_settings, site_content
- notification_logs, audit_logs
- optional marketing_consents

Requirements:
- normalized PostgreSQL schema with foreign keys, unique/check constraints, indexes, timestamps and robust migrations.
- Server code restricts private customers/appointments to authorized admins; public reads select only published business content.
- public booking mutations via secure controlled server endpoints/RPC, never broad customer-table insert/select rights.
- input validation with Zod, rate limiting for public booking/resend endpoints, bot protection where appropriate, safe errors, safe upload checks and no secrets in source code.
- data minimization; relevant privacy/terms and appropriate retention/deletion strategy; do not claim legal compliance as guaranteed without review.
- ensure cancellation and email tokens are unguessable, hashed at rest, single-use where appropriate and time-bounded.
- log critical actions without leaking secrets/tokens.

============================================================
15. REQUIRED AUTOMATED TESTS AND ACCEPTANCE CRITERIA
============================================================
At least verify:
1. 15m service fits in 15m gap; 60m fits exactly in 60m gap.
2. 90m does not fit in 60m gap; valid 15/30/60m start slots match given example.
3. Adjacent appointments are allowed when buffers allow.
4. 13:15–14:15 conflicts with 12:00–13:30; 13:30–14:30 does not (if no buffer).
5. Preparation and cleanup buffers block overlapping use; 60m + 15m cleanup occupies 75m.
6. Two concurrent booking attempts for same resource/interval: exactly one succeeds.
7. Active pending holds block; expired holds release even with delayed cron.
8. Email confirmation succeeds before expiry and fails after; repeated link clicks are safe.
9. Public booking rejected if less than 2 hours ahead.
10. Public cancellation works at >=24h and is disallowed at <24h.
11. Admin cancellation overrides public deadline, frees slot and preserves record.
12. Admin manual booking immediately confirms with no customer email-confirmation step.
13. Admin manual booking/reschedule obeys overlap and buffers.
14. Fixed service does not require dog size; size-based service does and uses correct duration/price.
15. Holidays, lunch breaks, vacations, closures and date overrides affect availability.
16. Editing duration/price/buffer does not rewrite existing appointment snapshots.
17. Unauthorized users cannot access private admin/customer data.
18. DST transitions use correct Europe/Sofia behavior.
19. Default resource attached to bookings; exclusion is scoped by resource.
20. A second test resource may have simultaneous appointment with first resource without false conflict.
21. Booking confirmation email failure safely frees hold or provides resilient retry.
22. Cancelled appointments remain in history; email failures do not roll back a completed cancellation.

Use real PostgreSQL-backed integration tests for race-condition and exclusion-constraint behavior; pure mocks are insufficient. Include Playwright E2E for principal customer booking + admin flows.

============================================================
16. IMPLEMENTATION ORDER AND DEFINITION OF DONE
============================================================
Phase 1: project setup, design system, Bulgarian UI shell.
Phase 2: database schema, migrations, seeded default resource, admin auth.
Phase 3: public content pages linked to real database data.
Phase 4: services/variants, hours, availability calculator, buffers.
Phase 5: transactional booking holds and DB-level concurrency protection.
Phase 6: Resend email confirmation, expiration and confirmation lifecycle.
Phase 7: admin calendar, manual create, cancellation, reschedule, blocks and hours.
Phase 8: gallery, promotions, branding/business settings, content management.
Phase 9: customer cancellation, reminder options, security, accessibility, tests.
Phase 10: GitHub/Docker/DigitalOcean/Resend production configuration and documentation.

Before each phase: state its dependencies, implementation choices and acceptance criteria. After each phase: run available lint, typecheck, tests and build; fix failures; report what truly works and what still requires configuration/credentials. Never claim unexecuted tests have passed.

Definition of done:
- Functional Bulgarian public site with editable services/prices, gallery, contacts and promotions.
- Customer picks a genuinely available start slot for selected service/size.
- Full service duration and buffer fit and cannot overlap other occupancy.
- 2-hour minimum notice and 30-day horizon enforced on server.
- Real pending hold and secure 10-minute email confirmation; expired holds released.
- Confirmed appointments appear in admin calendar.
- Admin can create, cancel and reschedule bookings reliably and securely.
- Public cancellation enforced at 24-hour cutoff; admin can override.
- Server authorization, safe secrets, input validation and basic abuse controls work.
- Core concurrency, duration, buffer and cancellation tests pass.
- One groomer in MVP; design verified for adding multiple resource-scoped calendars later.
- Project builds and includes accurate GitHub, Docker/DigitalOcean and Resend setup steps.

============================================================
17. FIRST RESPONSE AND WORKING INSTRUCTIONS FOR THE CODING AGENT
============================================================
First, briefly present:
1. Architecture and key components.
2. Database schema and resource-scoped overlap prevention.
3. Booking/confirmation/cancellation lifecycle and expiration strategy.
4. Availability and buffer calculations, with examples.
5. Security plan.
6. Repository directory structure.
7. Phased implementation plan and MVP acceptance criteria.

Then BEGIN ACTUAL IMPLEMENTATION with Phase 1; do not stop after presenting the plan unless tool/workspace access prevents implementation. Build working code incrementally. Clearly identify any external setup steps (DigitalOcean droplet, verified Resend sending domain, secrets, hosting) that require owner action. Use sensible placeholders but never imply they are real contact or company details. If a requirement cannot be completed, name the precise blocker and leave honest documentation rather than a deceptive mock implementation.

Key principle: production-quality booking invariants and email confirmation are more important than decorative effects. The calendar MUST be truthful, durable and concurrency-safe.
