-- A trip stops in several cities. Bookings point at those stops:
-- a flight has an origin and a destination, a stay only has a destination.

create table public.destinations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  name text not null,
  position integer not null,
  created_at timestamptz not null default now(),
  constraint destinations_position_unique unique (trip_id, position),
  constraint destinations_position_positive check (position > 0)
);

create unique index destinations_trip_name_idx
  on public.destinations (trip_id, lower(name));

alter table public.segments
  add column origin text,
  add column destination text;

update public.segments
set
  origin = nullif(split_part(place, ' → ', 1), ''),
  destination = nullif(split_part(place, ' → ', 2), '')
where place like '%→%';

update public.segments
set destination = place
where place is not null and place not like '%→%';

alter table public.segments drop column place;

alter table public.destinations disable row level security;

grant select, insert, update, delete on public.destinations to anon, authenticated, service_role;
