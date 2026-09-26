-- Telegram handle or phone, alongside the WhatsApp number the agent writes to.

alter table public.user_profile
  add column telegram text;
