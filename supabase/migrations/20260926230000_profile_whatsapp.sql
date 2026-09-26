-- The WhatsApp number the proactive agent writes to.

alter table public.user_profile
  add column whatsapp text;
