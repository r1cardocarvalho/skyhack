-- One row per country: whether this passport needs a visa, plus facts read from an uploaded visa.

alter table public.documents drop constraint documents_kind_known;

alter table public.documents
  add constraint documents_kind_known check (kind in ('ticket', 'booking', 'prescription', 'visa'));

create table public.visa_entries (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  country text not null,
  cities text[] not null default '{}',
  dates text,
  needed boolean,
  requirement text not null,
  stay text,
  passport_rule text,
  forms jsonb not null default '[]'::jsonb,
  next_step text,
  source text,
  source_href text,
  passport text,
  document_id uuid references public.documents (id) on delete set null,
  visa_type text,
  valid_from date,
  valid_until date,
  stay_days integer,
  entries text,
  document_notes text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  constraint visa_entries_country_present check (char_length(btrim(country)) > 0),
  constraint visa_entries_stay_days_known check (stay_days is null or (stay_days > 0 and stay_days < 4000))
);

create unique index visa_entries_trip_country_idx on public.visa_entries (trip_id, lower(country));
create index visa_entries_trip_position_idx on public.visa_entries (trip_id, position);

alter table public.visa_entries enable row level security;

create policy "users manage own visa entries"
  on public.visa_entries for all to authenticated
  using (public.is_trip_owner(trip_id))
  with check (public.is_trip_owner(trip_id));

grant select, insert, update, delete on public.visa_entries to authenticated, service_role;
