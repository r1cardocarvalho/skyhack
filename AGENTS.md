# Agent notes (Skyhack)

When the user is planning a trip, naming a destination or itinerary city, dropping a booking confirmation, or asking what's next (SIM, chargers, visas, scams, emergencies):

1. Read [`.cursor/skills/destination-briefing/SKILL.md`](.cursor/skills/destination-briefing/SKILL.md).
2. Load `#USERINFO` from User Rules or [`.cursor/skills/destination-briefing/USERINFO.md`](.cursor/skills/destination-briefing/USERINFO.md).
3. Research with [`.cursor/skills/destination-briefing/sources.md`](.cursor/skills/destination-briefing/sources.md).
4. Return the sourced briefing. Do not invent emergency numbers, visas, vaccines, or plug types.

This skill is Cursor-side research until product AI is wired to Next.js/Supabase.
