-- The uploaded PDF stays with the trip. Several bookings can come from one file.

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  filename text not null,
  storage_path text not null unique,
  content_type text not null,
  created_at timestamptz not null default now()
);

create index documents_trip_id_idx on public.documents (trip_id, created_at);

alter table public.segments
  add column document_id uuid references public.documents (id) on delete set null;

create index segments_document_id_idx on public.segments (document_id);

alter table public.documents disable row level security;

grant select, insert, update, delete on public.documents to anon, authenticated, service_role;

insert into storage.buckets (id, name, public)
values ('trip-documents', 'trip-documents', false)
on conflict (id) do nothing;

create policy "read trip documents"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'trip-documents');

create policy "upload trip documents"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'trip-documents');

create policy "delete trip documents"
  on storage.objects
  for delete
  to anon, authenticated
  using (bucket_id = 'trip-documents');
