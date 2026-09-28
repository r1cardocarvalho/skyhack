# Traveler profile (Skyhack)

Fill this so destination briefings use **this traveler's** passports, diet, and home country instead of US-default advice.

For the hackathon, this file is the **demo traveler**. Leave fields empty until you have a pitch persona. Do not commit real prescriptions or insurance numbers.

**Where to put it**

- Fill the `#USERINFO` block **in this file**, or
- Paste it into Cursor **User Rules** (User Rules win if both exist)

Copy the block below. Replace placeholders. Delete lines you do not use. Do not invent values for the agent.

When the app has a `profiles` table, map the same fields from there; until then, this file is the source of truth.

```markdown
#USERINFO

## Identity
- name:
- home_country:
- residence_country:
- passports:
- languages:

## Diet and health
- diet:
- allergies:
- prescriptions:
- other_medical:

## Travel defaults
- dates:
- insurance:
- accessibility:
- budget:
- sim_preference:
```

## Field meanings

| Field | Required | What the briefing uses it for |
| --- | --- | --- |
| `home_country` | Yes | Home MFA/embassy, need a different currency?, plugs vs home |
| `residence_country` | If different from home | Roaming, insurance, sometimes entry |
| `passports` | Yes | Visa/entry, which MFA and embassy to use. List all; say which you will travel on if dual |
| `languages` | Yes | Allergen-card language, whether English menus are a fallback |
| `diet` | Yes | Eating section (vegetarian, vegan, halal, kosher, pescatarian, none, etc.) |
| `allergies` | Yes | Hidden ingredients; write `none` if none |
| `dates` | Yes or `unknown` | Outbreaks, holidays, weather, Schengen day counts. Use ISO dates when you have them |
| `prescriptions` | Optional | Import rules and controlled-substance warnings |
| `other_medical` | Optional | Altitude, dialysis, mobility — only if you want it in the brief |
| `insurance` | Optional | Reminder to confirm cover abroad |
| `accessibility` | Optional | Step-free / sensory notes when official pages exist |
| `budget` | Optional | Cash vs card emphasis only; no invented prices |
| `sim_preference` | Optional | `eSIM`, `physical`, or `either` |

## Example (fictional demo traveler)

```markdown
#USERINFO

## Identity
- name: Demo traveler
- home_country: Portugal
- residence_country: Portugal
- passports: Portugal
- languages: Portuguese, English

## Diet and health
- diet: vegetarian
- allergies: none
- prescriptions:
- other_medical:

## Travel defaults
- dates: unknown
- insurance:
- accessibility:
- budget:
- sim_preference: eSIM
```

The agent must **ask once** if required fields are missing, then research. It must not assume Portugal, euro, or Type C/F unless this block (or User Rules) says so.
