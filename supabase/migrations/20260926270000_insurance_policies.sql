-- Facts read from an uploaded travel or medical insurance policy.

alter table public.documents drop constraint documents_kind_known;

alter table public.documents
  add constraint documents_kind_known check (kind in ('ticket', 'booking', 'prescription', 'visa', 'insurance'));

create table public.insurance_policies (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  document_id uuid references public.documents (id) on delete set null,
  insurer text not null,
  plan text,
  policy_number text,
  holder text,
  valid_from date,
  valid_until date,
  emergency_phone text,
  coverage text,
  deductible text,
  territory text,
  notes text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  constraint insurance_policies_insurer_present check (char_length(btrim(insurer)) > 0)
);

create index insurance_policies_trip_position_idx on public.insurance_policies (trip_id, position);

create unique index insurance_policies_trip_number_idx
  on public.insurance_policies (trip_id, lower(policy_number))
  where policy_number is not null and char_length(btrim(policy_number)) > 0;

alter table public.insurance_policies enable row level security;

create policy "users manage own insurance policies"
  on public.insurance_policies for all to authenticated
  using (public.is_trip_owner(trip_id))
  with check (public.is_trip_owner(trip_id));

grant select, insert, update, delete on public.insurance_policies to authenticated, service_role;
