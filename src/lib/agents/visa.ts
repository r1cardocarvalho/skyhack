import { readModelJson } from "@/lib/azure";
import { citiesOf, httpsLink, text } from "@/lib/agents/fields";
import type { TripContext } from "@/lib/agents/trip-context";

const SCHEMA = {
  type: "object",
  properties: {
    disclaimer: {
      type: "string",
      description: "One sentence: general information, not legal advice, and the border officer decides.",
    },
    passport: { type: "string", description: "The passport country this answer is for." },
    places: {
      type: "array",
      description: "One entry per destination country.",
      items: {
        type: "object",
        properties: {
          country: { type: "string" },
          cities: { type: "array", items: { type: "string" } },
          dates: { type: "string" },
          requirement: {
            type: "string",
            description: "Visa-free, e-visa, visa on arrival, visa required, travel authorisation, or unverified.",
          },
          stay: { type: "string", description: "How the published stay limit compares with these dates." },
          passportRule: { type: "string", description: "Validity or blank-page rule, only if an official page states it." },
          forms: {
            type: "array",
            description: "Official pre-arrival or arrival forms. Empty if none.",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                when: { type: "string" },
                href: { type: "string" },
                note: { type: "string" },
              },
              required: ["name", "when", "href", "note"],
            },
          },
          next: { type: "string", description: "The single next thing to do." },
          source: { type: "string" },
          href: { type: "string" },
        },
        required: [
          "country",
          "cities",
          "dates",
          "requirement",
          "stay",
          "passportRule",
          "forms",
          "next",
          "source",
          "href",
        ],
      },
    },
  },
  required: ["disclaimer", "passport", "places"],
};

export type ArrivalForm = {
  name: string;
  when: string;
  href: string;
  note: string;
};

export type VisaPlace = {
  country: string;
  cities: string[];
  dates: string;
  requirement: string;
  stay: string;
  passportRule: string;
  forms: ArrivalForm[];
  next: string;
  source: string;
  href: string;
};

export type VisaBrief = {
  disclaimer: string;
  passport: string;
  places: VisaPlace[];
};

export function neededOf(requirement: string): boolean | null {
  const value = requirement.trim().toLowerCase();
  if (value === "unverified" || value.includes("unverified")) return null;
  if (value === "visa-free" || value === "visa free" || value === "no visa") return false;
  if (
    value === "e-visa" ||
    value === "visa on arrival" ||
    value === "visa required" ||
    value === "travel authorisation" ||
    value === "travel authorization"
  ) {
    return true;
  }
  if (value.includes("free")) return false;
  if (value.includes("visa") || value.includes("authoris") || value.includes("authoriz")) return true;
  return null;
}

export function parseVisaBrief(value: unknown): VisaBrief | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const disclaimer = text(record.disclaimer, 400);
  const passport = text(record.passport, 60);
  if (!disclaimer || !passport || !Array.isArray(record.places)) return null;

  const places: VisaPlace[] = [];
  for (const item of record.places) {
    const place = parsePlace(item);
    if (place) places.push(place);
    if (places.length === 8) break;
  }
  if (places.length === 0) return null;
  return { disclaimer, passport, places };
}

export async function visaAgent(trip: TripContext, passport: string, flights: string[]): Promise<VisaBrief> {
  const raw = await readModelJson({
    instructions: promptFor(trip, passport, flights),
    schema: SCHEMA,
    schemaName: "visa_brief",
    maxOutputTokens: 4096,
    timeoutMs: 90_000,
    search: true,
  });
  const brief = raw ? parseVisaBrief(raw) : null;
  if (!brief) throw new Error("model");
  return brief;
}

function promptFor(trip: TripContext, passport: string, flights: string[]) {
  const stops = trip.stops
    .map((stop) => {
      const leaves = stop.leaves ? `, leaves ${stop.leaves}` : ", open-ended";
      return `- ${stop.city}, arrives ${stop.arrives}${leaves}`;
    })
    .join("\n");
  const legs = flights.length > 0 ? flights.map((line) => `- ${line}`).join("\n") : "- none listed";

  return `You check entry rules and official pre-arrival forms for one traveller.

Passport country: ${passport}
Purpose: tourism.

Stops, in order:
${stops}

Flights, including connections that are not stays:
${legs}

Search the web before you answer. For each destination country, use that country's official immigration or government page, or this passport's own foreign-ministry page. One entry per country. If two cities are in the same country, return that country once and list both cities. Mention a transit country only when a flight connection needs its own visa or form.

requirement says visa-free, e-visa, visa on arrival, visa required, travel authorisation, or unverified. stay compares the published limit with these dates. passportRule is validity or blank pages only when an official page states it; otherwise say it was not stated. forms lists every official pre-arrival or arrival form that applies (digital arrival card, customs declaration, health declaration, e-visa). when says whether to complete it before the flight or at the border. If there is no form, return an empty forms list. next is the single next thing to do. source names the official page. href is that https page. A form href is the official form page.

Do not use blogs, forums, or companies that charge to fill a free form. Do not invent a rule, a fee, or a link. If you cannot find an official page, still return the country, set requirement to unverified, and use the foreign-ministry travel-advice page as href when you have one. Do not come back with an empty list.

disclaimer is one sentence: this is general information, not legal advice, and the border officer decides. passport is the passport country above.`;
}

function parsePlace(value: unknown): VisaPlace | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const country = text(record.country, 60);
  const cities = citiesOf(record.cities);
  const dates = text(record.dates, 120);
  const requirement = text(record.requirement, 160);
  const stay = text(record.stay, 400);
  const passportRule = text(record.passportRule, 400);
  const next = text(record.next, 400);
  const source = text(record.source, 160);
  const href = httpsLink(record.href);
  if (!country || cities.length === 0 || !dates || !requirement || !stay || !passportRule || !next || !source || !href) {
    return null;
  }

  const forms: ArrivalForm[] = [];
  if (Array.isArray(record.forms)) {
    for (const item of record.forms) {
      const form = parseForm(item);
      if (form) forms.push(form);
      if (forms.length === 6) break;
    }
  }

  return { country, cities, dates, requirement, stay, passportRule, forms, next, source, href };
}

function parseForm(value: unknown): ArrivalForm | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const name = text(record.name, 120);
  const when = text(record.when, 160);
  const href = httpsLink(record.href);
  const note = text(record.note, 400);
  if (!name || !when || !href || !note) return null;
  return { name, when, href, note };
}
