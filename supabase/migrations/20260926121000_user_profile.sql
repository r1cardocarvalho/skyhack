-- One profile row per auth account. The trigger creates it on signup.

create table public.user_profile (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.user_profile enable row level security;

create policy "read own profile"
  on public.user_profile
  for select
  to authenticated
  using (id = auth.uid());

create policy "update own profile"
  on public.user_profile
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

grant select, update on public.user_profile to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profile (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
