-- Several conversations per trip. Existing messages stay in one chat.

create table public.trip_chats (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_chats_title_present check (char_length(btrim(title)) > 0)
);

create index trip_chats_trip_updated_idx on public.trip_chats (trip_id, updated_at desc);

insert into public.trip_chats (trip_id, title, created_at, updated_at)
select
  grouped.trip_id,
  coalesce(left(btrim(first_message.content), 48), 'Chat'),
  grouped.started_at,
  grouped.updated_at
from (
  select trip_id, min(created_at) as started_at, max(created_at) as updated_at
  from public.trip_messages
  group by trip_id
) as grouped
left join lateral (
  select content
  from public.trip_messages
  where trip_id = grouped.trip_id
    and role = 'user'
  order by created_at
  limit 1
) as first_message on true;

alter table public.trip_messages
  add column chat_id uuid references public.trip_chats (id) on delete cascade;

update public.trip_messages as message
set chat_id = chat.id
from public.trip_chats as chat
where chat.trip_id = message.trip_id
  and message.chat_id is null;

alter table public.trip_messages
  alter column chat_id set not null;

create index trip_messages_chat_created_idx on public.trip_messages (chat_id, created_at);

alter table public.trip_chats enable row level security;

create policy "users manage own trip chats"
  on public.trip_chats for all to authenticated
  using (public.is_trip_owner(trip_id))
  with check (public.is_trip_owner(trip_id));

grant select, insert, update, delete on public.trip_chats to authenticated, service_role;
