# Official sources

Use this allowlist when researching a destination. Prefer the traveler's home MFA from `#USERINFO` over a US-only default.

Rank: destination government, then home MFA, then UN/WHO/CDC/ECDC/ITU/IEC/ISO, then official operators. A source may only prove the topics listed for it.

Fetch the live page. Do not treat this file as a fact table.

## Topic map

| Topic | Primary | Backup |
| --- | --- | --- |
| Health, vaccines, water, outbreaks | WHO travel advice, CDC destination pages and notices, ECDC | National health ministry of the destination |
| Safety, scams, embassy | Home MFA travel advice and embassy locator for USERINFO nationality | Destination police / tourism police / official transport (e.g. TfL) |
| Emergency numbers | Destination government, national telecom regulator, ITU | Embassy "if you need help" page (cross-check) |
| Currency | ISO 4217, destination central bank | ECB if the destination is in the euro area |
| Plugs / voltage | IEC plug/voltage references, national standards body | Home MFA practical information |
| SIM / eSIM | National telecom regulator and official MNO sites in that country | GSMA; EU roaming pages if home is EU |
| Visa / entry | Destination immigration / official visa portal | Home MFA entry page for that country |
| Visa days / Schengen | Official immigration or EU Schengen short-stay rules | Home MFA "how long you can stay" page |
| Clinics / pharmacies | Embassy doctor lists, ISTM clinic directory | CDC Yellow Book "sick abroad"; national health ministry |
| Food culture / allergens | Destination tourism board, national food-safety agency | Allergen phrasing from official health/tourism pages only |

## Health

- WHO travel advice: https://www.who.int/travel-advice/
- WHO yellow fever and vaccination requirements (country list via WHO travel pages)
- CDC Travelers' Health (search destination): https://wwwnc.cdc.gov/travel
- CDC before you travel: https://wwwnc.cdc.gov/travel/page/before-travel
- CDC travel health notices: https://wwwnc.cdc.gov/travel/notices
- CDC Yellow Book, sick abroad: https://www.cdc.gov/yellow-book/hcp/health-care-abroad/what-to-do-when-sick-abroad.html
- ECDC: https://www.ecdc.europa.eu/
- Destination ministry of health (search `[country] ministry of health` and use the `.gov` / official domain)

May prove: vaccines, malaria, outbreaks, tap water/food-safety when the page states it, blood/medicine quality warnings.

Must not prove: visa eligibility, plug types, SIM prices.

## Safety, scams, embassy (pick by nationality)

Use the MFA that matches `#USERINFO` passports. If dual national, use the passport they will travel on; if unknown, brief both and say so.

Portugal / Portuguese communities:

- Portal das Comunidades (MNE): https://www.portaldascomunidades.mne.pt/
- Portuguese diplomats locator via MNE / Portal das Comunidades

EU (supplement if home is an EU member):

- EEAS: https://www.eeas.europa.eu/

Other common MFAs (use when USERINFO matches):

- UK FCDO foreign travel advice: https://www.gov.uk/foreign-travel-advice
- US State Department travel: https://travel.state.gov/
- Canada travel advice: https://travel.gc.ca/
- Australia Smartraveller: https://www.smartraveller.gov.au/
- France Conseils aux voyageurs: https://www.diplomatie.gouv.fr/fr/conseils-aux-voyageurs/
- Germany Auswaertiges Amt: https://www.auswaertiges-amt.de/de/reiseundsicherheit
- Spain MAE: https://www.exteriores.gob.es/es/ServiciosAlCiudadano/Paginas/Recomendaciones-de-viaje.aspx
- Italy Viaggiare Sicuri: https://www.viaggiaresicuri.it/
- Netherlands Nederland Wereldwijd: https://www.nederlandwereldwijd.nl/

Search `[home country] travel advice [destination]` and prefer the official MFA domain.

May prove: advisory level, crime/scam patterns, embassy/consulate contacts, local laws flagged for travelers, hospital lists published by the mission.

Must not prove: plug types or SIM products unless the MFA page states them.

## Emergency numbers

1. Destination government or interior/police site (112, 911, 190, tourist police, and similar)
2. National telecom / numbering regulator
3. ITU operational bulletins / numbering resources: https://www.itu.int/ (search country emergency / numbering plan)
4. Cross-check the home-embassy emergencies page. If it conflicts, report both.

May prove: police, ambulance, fire, tourist police, poison, how to dial from a mobile.

Never fill this section from memory.

## Currency

- ISO 4217 currency codes: https://www.iso.org/iso-4217-currency-codes.html
- Destination central bank (search `[country] central bank`)
- Euro area: ECB https://www.ecb.europa.eu/
- Home MFA practical information (cards/cash warnings)

May prove: ISO code, whether the traveler needs a different currency vs home, cash vs card notes when the central bank or MFA states them.

Do not quote live FX rates as official unless fetched from the central bank/ECB the same run; if quoted, stamp the time.

## Plugs and voltage

- IEC world plugs / IEC 60083 family (search current IEC public overview)
- WorldStandards / ITA-style summaries only as a pointer; confirm on IEC, national standards body, or MFA practical info
- National standards body of the destination
- Home MFA electricity / practical information

May prove: plug type letter(s), volts, hertz, adapter vs converter vs home.

Look up each run. Compare to home country derived from `#USERINFO`.

## SIM / eSIM

- National telecom regulator (ANACOM, Ofcom, FCC, ARCEP, Anatel, and similar)
- Official MNO sites in the destination country (the local brand, not a global homepage)
- Airport operator pages only if they describe SIM desks on an official domain
- GSMA: https://www.gsma.com/
- EU roaming (if home is EU): https://europa.eu/ (search roaming)

May prove: whether prepaid/eSIM is offered, ID/passport required, roaming rights for EU residents.

Must not prove: best tourist SIM rankings from affiliates.

## Visa and entry

- Destination immigration / border / eVisa / ETA portal (official domain only)
- IATA-style rules only when published by a government or IATA official channel, not a visa agency reseller
- Home MFA page for that destination (entry for this nationality)
- WHO yellow fever country requirements (when vaccination certificates are an entry rule)

May prove: visa-free / visa / ETA, passport validity months, onward-ticket or proof-of-funds if the official page says so.

Never use visahq, iVisa, or similar as the sole source.

## Visa days / Schengen

- EU short-stay (Schengen): official Europa pages on 90 days in any 180-day period
- Destination immigration "how long you can stay" for that nationality
- Home MFA page for the same destination

May prove: stay limits and whether this itinerary's dated nights fit. Do not invent a day count without dates and passport.

## Care (hospitals, pharmacies, prescriptions)

- Embassy/consulate medical assistance / physician lists
- ISTM clinic directory: https://www.istm.org/
- CDC Yellow Book sick-abroad page (link above)
- Destination health ministry; national pharmacy regulator
- Customs / health ministry pages on importing personal medicines

May prove: how to find care, that a list exists, high-level import rules.

Do not recommend buying medicines from street vendors.

## Food (diet from `#USERINFO`)

- Official tourism board of the destination
- National food-safety / allergen labeling agency
- Ministry of health food-hygiene pages
- Named restaurants: unofficial unless the tourism board lists them; always label unofficial

May prove: staple dishes, typical allergens in cuisine, labeling rules.

Must not prove: best restaurant in X as fact.

## Search patterns

Run in parallel, substituting country/city and home nationality:

- `[country] ministry of health travel` / yellow fever / malaria
- `[home MFA] travel advice [country]`
- `[country] emergency number police ambulance` on an official domain
- `[country] immigration visa [nationality]`
- `[country] Schengen 90 180` or `[country] length of stay [nationality]`
- `[country] central bank currency`
- `[country] plug type voltage`
- `[country] telecom regulator prepaid SIM eSIM passport`
- `[city] tourist police`
- `[country] embassy of [home country]`

Prefer gov, gob, gouv, go.jp, gc.ca, WHO, CDC, ECDC, ITU, ISO, IEC, europa.eu, and the destination's official tourism hostname.

## Reject as primary

Affiliate best-SIM / best-adapter lists, Reddit/TikTok, unsourced blogs, visa mills, scraped emergency-number wikis used alone, stale plug infographics with no date.
