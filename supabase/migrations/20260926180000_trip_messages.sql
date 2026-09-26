-- Chat turns for one trip. Each reply is built from the live trip plus these rows.

create table public.trip_messages (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  role text not null,
  content text not null,
  created_at timestamptz not null default now(),
  constraint trip_messages_role_known check (role in ('user', 'assistant')),
  constraint trip_messages_content_present check (char_length(content) > 0)
);

create index trip_messages_trip_created_idx on public.trip_messages (trip_id, created_at);

alter table public.trip_messages disable row level security;

grant select, insert, update, delete on public.trip_messages to anon, authenticated, service_role;
