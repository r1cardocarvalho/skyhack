-- Every trip belongs to one authenticated user. Child rows inherit access
-- through their trip, and private storage objects use the trip id folder.

alter table public.trips
  add column user_id uuid references auth.users (id) on delete cascade
  default auth.uid();

do $$
declare
  sole_user uuid;
begin
  select id into sole_user
  from auth.users
  order by created_at
  limit 1;

  if sole_user is not null
    and not exists (select 1 from auth.users where id <> sole_user)
  then
    update public.trips set user_id = sole_user where user_id is null;
  end if;
end
$$;

create index trips_user_created_idx on public.trips (user_id, created_at desc);

create or replace function public.is_trip_owner(target_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.trips
    where id = target_trip_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_trip_object_owner(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.trips
    where id::text = split_part(object_name, '/', 1)
      and user_id = auth.uid()
  );
$$;

revoke all on function public.is_trip_owner(uuid) from public, anon;
revoke all on function public.is_trip_object_owner(text) from public, anon;
grant execute on function public.is_trip_owner(uuid) to authenticated, service_role;
grant execute on function public.is_trip_object_owner(text) to authenticated, service_role;

alter table public.trips enable row level security;
alter table public.segments enable row level security;
alter table public.destinations enable row level security;
alter table public.documents enable row level security;
alter table public.medications enable row level security;
alter table public.trip_briefs enable row level security;
alter table public.trip_messages enable row level security;

create policy "users read own trips"
  on public.trips for select to authenticated
  using (user_id = auth.uid());

create policy "users create own trips"
  on public.trips for insert to authenticated
  with check (user_id = auth.uid());

create policy "users update own trips"
  on public.trips for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users delete own trips"
  on public.trips for delete to authenticated
  using (user_id = auth.uid());

create policy "users manage own segments"
  on public.segments for all to authenticated
  using (public.is_trip_owner(trip_id))
  with check (public.is_trip_owner(trip_id));

create policy "users manage own destinations"
  on public.destinations for all to authenticated
  using (public.is_trip_owner(trip_id))
  with check (public.is_trip_owner(trip_id));

create policy "users manage own documents"
  on public.documents for all to authenticated
  using (public.is_trip_owner(trip_id))
  with check (public.is_trip_owner(trip_id));

create policy "users manage own medications"
  on public.medications for all to authenticated
  using (public.is_trip_owner(trip_id))
  with check (public.is_trip_owner(trip_id));

create policy "users manage own trip briefs"
  on public.trip_briefs for all to authenticated
  using (public.is_trip_owner(trip_id))
  with check (public.is_trip_owner(trip_id));

create policy "users manage own trip messages"
  on public.trip_messages for all to authenticated
  using (public.is_trip_owner(trip_id))
  with check (public.is_trip_owner(trip_id));

revoke all on public.trips from anon;
revoke all on public.segments from anon;
revoke all on public.destinations from anon;
revoke all on public.documents from anon;
revoke all on public.medications from anon;
revoke all on public.trip_briefs from anon;
revoke all on public.trip_messages from anon;

drop policy if exists "read trip documents" on storage.objects;
drop policy if exists "upload trip documents" on storage.objects;
drop policy if exists "delete trip documents" on storage.objects;

create policy "users read own trip files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'trip-documents'
    and public.is_trip_object_owner(name)
  );

create policy "users upload own trip files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'trip-documents'
    and public.is_trip_object_owner(name)
  );

create policy "users update own trip files"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'trip-documents'
    and public.is_trip_object_owner(name)
  )
  with check (
    bucket_id = 'trip-documents'
    and public.is_trip_object_owner(name)
  );

create policy "users delete own trip files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'trip-documents'
    and public.is_trip_object_owner(name)
  );
