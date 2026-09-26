-- A trip is the container. A segment is one booking on that trip.
-- Local demo: no login. The anon key can read and write these tables.

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  constraint trips_dates_in_order check (
    start_date is null or end_date is null or end_date >= start_date
  )
);

create table public.segments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  kind text not null,
  title text not null,
  starts_at timestamp,
  ends_at timestamp,
  place text,
  confirmation_code text,
  raw_text text,
  created_at timestamptz not null default now(),
  constraint segments_kind_known check (kind in ('flight', 'stay', 'reservation')),
  constraint segments_times_in_order check (
    starts_at is null or ends_at is null or ends_at >= starts_at
  )
);

create index segments_trip_starts_at_idx on public.segments (trip_id, starts_at);

alter table public.trips disable row level security;
alter table public.segments disable row level security;

grant select, insert, update, delete on public.trips to anon, authenticated, service_role;
grant select, insert, update, delete on public.segments to anon, authenticated, service_role;
