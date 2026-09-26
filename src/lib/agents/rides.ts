import { readModelJson } from "@/lib/azure";
import { citiesOf, httpsLink, text } from "@/lib/agents/fields";
import type { TripContext } from "@/lib/agents/trip-context";

const VERDICTS = ["best", "works", "skip", "unavailable"] as const;

const SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", description: "One sentence on how to get around on this trip." },
    places: {
      type: "array",
      description: "One entry per destination country.",
      items: {
        type: "object",
        properties: {
          country: { type: "string" },
          cities: { type: "array", items: { type: "string" } },
          airport: {
            type: "object",
            properties: {
              best: { type: "string", description: "The ride to take from the arrival airport." },
              how: { type: "string", description: "Where to find it after landing, in one or two sentences." },
              skip: { type: "string", description: "What to walk past at the airport." },
              source: { type: "string" },
              href: { type: "string" },
            },
            required: ["best", "how", "skip", "source", "href"],
          },
          around: {
            type: "object",
            properties: {
              best: { type: "string", description: "The usual pick for getting around the city." },
              options: {
                type: "array",
                description: "Bolt, Uber, a metered taxi, a tuk-tuk, and the local app if one matters.",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    verdict: { type: "string", enum: ["best", "works", "skip", "unavailable"] },
                    note: { type: "string" },
                  },
                  required: ["name", "verdict", "note"],
                },
              },
              pay: { type: "string", description: "Cash, card, or in the app, in one sentence." },
              source: { type: "string" },
              href: { type: "string" },
            },
            required: ["best", "options", "pay", "source", "href"],
          },
        },
        required: ["country", "cities", "airport", "around"],
      },
    },
  },
  required: ["summary", "places"],
};

export type RideVerdict = (typeof VERDICTS)[number];

export type RideOption = {
  name: string;
  verdict: RideVerdict;
  note: string;
};

export type RideAirport = {
  best: string;
  how: string;
  skip: string;
  source: string;
  href: string;
};

export type RideAround = {
  best: string;
  options: RideOption[];
  pay: string;
  source: string;
  href: string;
};

export type RidePlace = {
  country: string;
  cities: string[];
  airport: RideAirport;
  around: RideAround;
};

export type RideBrief = {
  summary: string;
  places: RidePlace[];
};

export function parseRideBrief(value: unknown): RideBrief | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const summary = text(record.summary, 400);
  if (!summary || !Array.isArray(record.places)) return null;

  const places: RidePlace[] = [];
  for (const item of record.places) {
    const place = parsePlace(item);
    if (place) places.push(place);
    if (places.length === 8) break;
  }
  if (places.length === 0) return null;
  return { summary, places };
}

export async function ridesAgent(trip: TripContext, flights: string[]): Promise<RideBrief> {
  const raw = await readModelJson({
    instructions: promptFor(trip, flights),
    schema: SCHEMA,
    schemaName: "ride_brief",
    maxOutputTokens: 4096,
    timeoutMs: 90_000,
    search: true,
  });
  const brief = raw ? parseRideBrief(raw) : null;
  if (!brief) throw new Error("model");
  return brief;
}

function promptFor(trip: TripContext, flights: string[]) {
  const stops = trip.stops
    .map((stop) => {
      const leaves = stop.leaves ? `, leaves ${stop.leaves}` : ", open-ended";
      return `- ${stop.city}, arrives ${stop.arrives}${leaves}`;
    })
    .join("\n");
  const legs = flights.length > 0 ? flights.map((line) => `- ${line}`).join("\n") : "- none listed";

  return `You tell a tourist how to leave the airport and how to get around each country on this trip.

Stops, in order:
${stops}

Flights, including connections that are not stays:
${legs}

Search the web before you answer. Prefer the airport's own ground-transport page, the ride app's city page, or a tourism board. A traveler report is allowed only when source says it is a traveler report. One entry per destination country. If two cities are in the same country, return that country once and list both cities. Use the arrival airport for that country when a flight names it.

airport.best is the ride to take when they land: the official taxi, or Grab, Uber, Bolt, or the local app when that app has an airport pickup. airport.how says where to find it after baggage claim. airport.skip is what to walk past, such as unmarked cars in the arrivals hall.

around.best is the usual pick for ordinary trips in the city. around.options compares the choices a tourist actually asks about: Bolt, Uber, a metered taxi, a tuk-tuk, and the local app when one dominates (Grab, Gojek, Careem, inDrive, Yandex, or similar). verdict is best, works, skip, or unavailable. Use unavailable when that app or vehicle is not used there. Use skip when it exists but tourists get overcharged or it is a poor default. Mark exactly one option as best, and make around.best the same name. around.pay says whether to pay in the app, by card, or in cash.

Do not invent a fare, a phone number, or a link. href is an https page for that airport or that app in that country. If you cannot source a country, still return it, set airport.best to Unverified, and use that country's tourism or airport page as href. Do not come back with an empty list.

summary is one sentence for the whole trip.`;
}

function parsePlace(value: unknown): RidePlace | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const country = text(record.country, 60);
  const cities = citiesOf(record.cities);
  const airport = parseAirport(record.airport);
  const around = parseAround(record.around);
  if (!country || cities.length === 0 || !airport || !around) return null;
  return { country, cities, airport, around };
}

function parseAirport(value: unknown): RideAirport | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const best = text(record.best, 80);
  const how = text(record.how, 400);
  const skip = text(record.skip, 240);
  const source = text(record.source, 160);
  const href = httpsLink(record.href);
  if (!best || !how || !skip || !source || !href) return null;
  return { best, how, skip, source, href };
}

function parseAround(value: unknown): RideAround | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const best = text(record.best, 80);
  const pay = text(record.pay, 160);
  const source = text(record.source, 160);
  const href = httpsLink(record.href);
  if (!best || !pay || !source || !href || !Array.isArray(record.options)) return null;

  const options: RideOption[] = [];
  for (const item of record.options) {
    const option = parseOption(item);
    if (option) options.push(option);
    if (options.length === 6) break;
  }
  if (options.length === 0) return null;
  return { best, options, pay, source, href };
}

function parseOption(value: unknown): RideOption | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const name = text(record.name, 40);
  const verdict = VERDICTS.find((item) => item === record.verdict);
  const note = text(record.note, 240);
  if (!name || !verdict || !note) return null;
  return { name, verdict, note };
}
