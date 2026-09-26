-- A booking can keep the web address printed on the confirmation.

alter table public.segments
  add column url text;

alter table public.segments
  add constraint segments_url_http check (
    url is null or url ~* '^https?://'
  );
