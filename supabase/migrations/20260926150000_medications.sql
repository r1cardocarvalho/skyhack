-- Whether this trip already has a consulta do viajante, and the medicines
-- read from the prescription uploaded for it.

alter table public.trips
  add column traveler_consult text,
  add constraint trips_traveler_consult_known check (
    traveler_consult is null or traveler_consult in ('yes', 'no')
  );

alter table public.documents
  add column kind text not null default 'ticket',
  add constraint documents_kind_known check (kind in ('ticket', 'booking', 'prescription'));

update public.documents as document
set kind = 'booking'
where exists (
  select 1
  from public.segments as segment
  where segment.document_id = document.id
    and segment.kind in ('stay', 'reservation')
);

create table public.medications (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  document_id uuid references public.documents (id) on delete cascade,
  name text not null,
  dose text,
  form text,
  schedule text,
  timing text not null,
  quantity text,
  purpose text,
  notes text,
  position integer not null,
  created_at timestamptz not null default now(),
  constraint medications_timing_known check (timing in ('before', 'during', 'as-needed'))
);

create index medications_trip_position_idx on public.medications (trip_id, position);

alter table public.medications disable row level security;

grant select, insert, update, delete on public.medications to anon, authenticated, service_role;
