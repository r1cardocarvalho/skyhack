-- One saved result per agent per trip. The SIM agent writes kind = 'sim'.

create table public.trip_briefs (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  kind text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  constraint trip_briefs_kind_known check (kind in ('sim')),
  constraint trip_briefs_trip_kind_unique unique (trip_id, kind)
);

create index trip_briefs_trip_idx on public.trip_briefs (trip_id);

alter table public.trip_briefs disable row level security;

grant select, insert, update, delete on public.trip_briefs to anon, authenticated, service_role;
