# Sources

Allowlist for the destination briefing ([SKILL.md](SKILL.md)) and for Agent 13 in [agent-prompts-list.md](agent-prompts-list.md).

Look up the page for **this** country on every run. This file names kinds of sources. It does not store emergency numbers, visa rules, plug tables, or prices.

## Order

Use this order. It is the same rule as B1 in the agent prompts.

1. The destination government body that is responsible for the fact.
2. The traveller's home ministry of foreign affairs and, for health, the home public-health authority. Take the country from the profile. Never default to a US page.
3. WHO. CDC or ECDC only as corroboration, or when that body is the home authority.
4. ITU (dialing), IEC (plugs), ISO 4217 (currency codes), IANA time-zone database (zones).
5. The official operator, for its own service only: airline, airport, mobile network, central bank.

If two official sources disagree on emergency numbers, visa or entry, or plug type and voltage, report both. Cap the reliability score at 59 and start a Verification Kit.

## What each source may prove

| Source | May prove | May not prove |
| --- | --- | --- |
| Destination immigration, border agency, or foreign ministry | Visa, entry, stay limits, passport validity, arrival forms, transit | That this traveller will be admitted |
| Destination health ministry | Entry vaccines and certificates the country requires, outbreak notices it publishes, tap water or food safety if it publishes them | A personal vaccine schedule or a diagnosis |
| Destination customs | Cash limits, goods declarations, high-level prescription-import rules | That a specific medicine is safe to buy on the street |
| Destination police or interior ministry | Emergency numbers, and scam warnings it publishes | A neighbourhood safety rating it did not publish |
| Destination telecom regulator | SIM and phone registration rules, which operators are licensed | Which commercial plan is "best" |
| Licensed mobile operator's own site | That operator's plans, prices, and coverage | A competitor's plans |
| Destination tourism, standards, or consumer authority | Official plug or voltage pages, official food-labeling rules, scam warnings it publishes | Restaurant quality, live menu prices, neighbourhood "vibes" |
| Traveller's home ministry of foreign affairs | Travel advisory, embassy and consulate contacts, consular help | Destination immigration law (use the destination's own page for entry) |
| Home public-health authority | Health guidance for its own residents | Another country's entry decision |
| WHO | Outbreaks, International Health Regulations, yellow-fever certificate recommendations | A personal prescription |
| CDC, ECDC | Corroboration of health notices; primary only when it is the home authority | The default advisory for a traveller who is not from that authority's country |
| IEC world-plugs data or the national electrical authority | Plug type, voltage, frequency | Whether a particular charger is safe; the traveller checks the device label |
| ISO 4217 and the destination central bank | Currency code; cash and card notes when the bank publishes them | A live exchange rate older than the page's own date |
| IANA time-zone database | The zone for a place | Opening hours |
| Embassy or consulate of the traveller's nationality | Its own phone, address, hours, and after-hours line | Another country's emergency numbers |
| ISTM clinic directory, embassy doctor lists, national health-ministry care pages | Where to look for a clinic or hospital | Which clinic the traveller should use, or a diagnosis |
| Airline, airport, or other operator | Its own flights, terminals, and published rules | Entry law, unless it is quoting the government page and you also cite that page |

## Not a source for numbers, visas, vaccines, plugs, or currency

Travel blogs, Reddit, TikTok, visa mills, and "best SIM" listicles. They may illustrate food culture only after an official food fact is already in the briefing, and that sentence must be labeled unofficial.

A phone number or link found only in an ad, a search snippet, or a third-party site is not given as fact. Say how to find the official contact, usually on the traveller's own foreign-ministry site.

## Reliability, short form

Score each fact as in section 0C of the agent prompts: source authority (0–40) + freshness (0–25) + corroboration (0–20) + match to this traveller (0–15). High is 80–100, medium is 50–79, low is 0–49. An answer uses the lowest score it depends on.
