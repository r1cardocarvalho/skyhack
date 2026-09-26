alter table public.destinations
  add column starts_on date,
  add column ends_on date,
  add constraint destinations_dates_in_order check (
    starts_on is null or ends_on is null or ends_on >= starts_on
  );

-- The same city can be two stops when the days are different.
drop index if exists public.destinations_trip_name_idx;
