alter table public.segments
  drop column if exists confirmation_code,
  drop column if exists raw_text;
