---
name: destination-briefing
description: >-
  Research a destination and produce a sourced travel/health briefing for Skyhack
  itineraries (emergency numbers, SIM/eSIM, diet-aware eating, currency,
  plugs/chargers, scams, visas, visa-day counts, vaccines, timezones). Use when
  the user plans a trip, names a destination or itinerary city, drops a booking
  confirmation, asks what's next, or asks for travel, safety, SIM, charger, or
  visa intel.
---

# Destination briefing (Skyhack)

Skyhack is an AI-native itinerary app (TripIt-style). When the user names a destination, imports a confirmation, or asks "what's next?", load `#USERINFO`, go online using [sources.md](sources.md), and return a structured briefing. This is **agent research for the trip**, not medical or legal advice, and not an in-app LLM until product AI exists.

Do not answer from memory for numbers, visas, vaccines, plugs, or currency.

## 1. Parse the destination

Prefer cities/countries already on the **itinerary** (chat, booking text, or trip data in the repo) over a random example.

Normalize: city, country/territory, region, and travel dates if given.

- City → still research **national** emergency numbers, visa/entry, plugs, currency, plus **city** SIM, food, and scam notes.
- Multi-city / multi-country → one briefing per country, city notes under each.
- Ambiguous name (Georgia, Malta vs city) → ask once.

## 2. Load `#USERINFO` before searching

Search in this order. Stop at the first complete-enough block:

1. Cursor **User Rules** / conversation user info that contains a `#USERINFO` heading
2. This project's [`USERINFO.md`](USERINFO.md) or repo-root `AGENTS.md` `#USERINFO` section
3. Ask **once** for missing required fields, then research

When a Supabase `profiles` (or equivalent) row exists with home country, passports, diet, or allergies, map those fields the same way. Until that table exists, do not invent a profile.

**Required:** home country/residence, passport(s)/nationality, diet and allergies, languages, travel dates (or `unknown`).

**Optional:** prescriptions, insurance, accessibility, budget, eSIM vs physical SIM.

**Never invent** nationality or diet. Derive home plug/voltage and home currency from home country. Ask only if derivation is ambiguous (dual systems, territories).

If dates are unknown, still brief; mark outbreak/holiday/weather and **visa-day counts** as date-dependent.

## 3. Research

Read [sources.md](sources.md). Search and fetch **in parallel**.

Rank: destination government → traveler's **home MFA** (from `#USERINFO`, not US-default) → WHO/CDC/ECDC/ITU/IEC/ISO → official operators.

Do **not** use travel blogs, Reddit, TikTok, visa mills, or "best SIM" listicles as the **sole** source for numbers, visas, vaccines, plugs, or currency. Blogs may illustrate food culture only after official facts exist.

**Cross-check** emergency numbers, visa/entry, and plug/voltage. If two official sources disagree, report both and the conflict.

**Stamp** retrieval date on every section. Link the page used. Write **unknown** instead of guessing.

## 4. Hard rules

- Do not invent emergency numbers, visa outcomes, or vaccine lists from training data.
- Do not say "you're fine to enter" without an official immigration or home-MFA page.
- Do not recommend buying medicines on the street.
- Cite every numeric claim (phone numbers, volts, currency codes, passport-validity months, Schengen days).
- Restaurant names, neighborhood vibes, and live prices are unofficial; label them as such or omit them.
- Look up plugs/currency/SIM **each run**. Do not paste stale tables from this skill.

## 5. Briefing template

Lead with health/safety, then logistics (SIM, chargers), then food/money, then scams. Each section: facts, **source URL**, as-of date, confidence (`high` / `medium` / `unknown`).

Tie the lead sentence to the itinerary when you can (next city, next flight date if given).

```markdown
# Destination briefing: [City], [Country]
Profile: [nationality / home country] · diet: [from USERINFO] · dates: [dates or unknown]
Retrieved: [ISO date]

## Snapshot
Timezone (itinerary clocks), language(s), safety advisory **from the traveler's home MFA** (not a generic US-only page).

## Health
CDC/WHO/ECDC risks, routine + destination vaccines, malaria if relevant, current outbreak notices, tap water, food-safety basics.
Note: not medical advice; see a clinician for vaccines (typically 4–6 weeks before travel).

## Emergencies
Police / ambulance / fire / tourist police / 112 if applicable; how to dial from a mobile; poison if listed.
Embassy/consulate of **USERINFO nationality** and after-hours number.

## Care
How to find hospitals/pharmacies (embassy lists, ISTM, national health ministry). High-level prescription import rules from official customs/health pages.

## SIM / eSIM
Official MNOs, airport vs city, ID/passport required, EU roaming if home is in the EU. Operator/regulator pages only. Note if UK/other destinations sit outside EU roam-like-at-home.

## Eat for this diet
Map USERINFO diet/allergies to local staples, hidden ingredients, grocery vs restaurant strategy, allergen-card phrases in local language. Official tourism/health first. Named restaurants only if labeled unofficial.

## Money
ISO currency vs home currency (**need a different currency?** yes/no). Cash vs cards, ATMs. Card-skimming notes only if on advisories.

## Power (chargers up front)
Plug type(s), V/Hz vs home. Adapter vs converter. What to pack before leaving.

## Scams and street crime
Only patterns on **government travel advisories** or official city/transport pages (taxi, ATM, fake police, overcharging, unbooked minicabs).

## Entry
Visa/ETA/eVisa/passport validity for **this** nationality; yellow-fever certificate if WHO requires/recommends. Official immigration + home MFA.

## Visa days / time in country
If the itinerary uses this passport in Schengen or another stay-limited area, count planned days vs the official limit (90/180 or destination rule). If dates or passport are missing, mark **unknown**.

## Laws that bite
Drugs, drones, photos, alcohol, medications controlled locally — MFA or destination government.

## What's next
One practical line: next destination fact the traveler should act on (adapter, ETA, SIM, or emergency numbers).

## Gaps
What stayed unknown or conflicting, and what to confirm in-country.
```

## Additional resources

- Allowlisted sources and what each may prove: [sources.md](sources.md)
- Traveler profile template: [USERINFO.md](USERINFO.md)
