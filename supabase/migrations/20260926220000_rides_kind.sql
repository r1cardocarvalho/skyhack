-- Rides agent writes kind = 'rides'.

alter table public.trip_briefs drop constraint trip_briefs_kind_known;

alter table public.trip_briefs
  add constraint trip_briefs_kind_known check (kind in ('sim', 'briefing', 'visa', 'scams', 'terminals', 'rides'));
