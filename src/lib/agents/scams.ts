import { readModelJson } from "@/lib/azure";
import { citiesOf, httpsLink, text } from "@/lib/agents/fields";
import type { TripContext } from "@/lib/agents/trip-context";

const SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", description: "One calm sentence for the whole trip." },
    places: {
      type: "array",
      description: "One entry per destination country, with up to five usual scams.",
      items: {
        type: "object",
        properties: {
          country: { type: "string" },
          cities: { type: "array", items: { type: "string" } },
          scams: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                how: { type: "string", description: "How the scam works, in one or two sentences." },
                where: { type: "string", description: "Where it usually happens, such as the airport taxi rank." },
                redFlag: { type: "string" },
                instead: { type: "string", description: "What to do instead." },
                source: { type: "string" },
                href: { type: "string" },
              },
              required: ["name", "how", "where", "redFlag", "instead", "source", "href"],
            },
          },
        },
        required: ["country", "cities", "scams"],
      },
    },
  },
  required: ["summary", "places"],
};

export type ScamItem = {
  name: string;
  how: string;
  where: string;
  redFlag: string;
  instead: string;
  source: string;
  href: string;
};

export type ScamPlace = {
  country: string;
  cities: string[];
  scams: ScamItem[];
};

export type ScamBrief = {
  summary: string;
  places: ScamPlace[];
};

export function parseScamBrief(value: unknown): ScamBrief | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const summary = text(record.summary, 400);
  if (!summary || !Array.isArray(record.places)) return null;

  const places: ScamPlace[] = [];
  for (const item of record.places) {
    const place = parsePlace(item);
    if (place) places.push(place);
    if (places.length === 8) break;
  }
  if (places.length === 0) return null;
  return { summary, places };
}

export async function scamsAgent(trip: TripContext): Promise<ScamBrief> {
  const raw = await readModelJson({
    instructions: promptFor(trip),
    schema: SCHEMA,
    schemaName: "scam_brief",
    maxOutputTokens: 4096,
    timeoutMs: 90_000,
    search: true,
  });
  const brief = raw ? parseScamBrief(raw) : null;
  if (!brief) throw new Error("model");
  return brief;
}

function promptFor(trip: TripContext) {
  const stops = trip.stops
    .map((stop) => {
      const leaves = stop.leaves ? `, leaves ${stop.leaves}` : ", open-ended";
      return `- ${stop.city}, arrives ${stop.arrives}${leaves}`;
    })
    .join("\n");

  return `You list the usual scams a tourist meets in each country on this trip.

Stops, in order:
${stops}

Search the web before you answer. Prefer a government travel advisory, police notice, or tourism-board warning. A widely repeated traveler report is allowed only when source says it is a traveler report. One entry per country. If two cities are in the same country, return that country once. Up to 5 scams per country, the ones a new arrival actually meets: taxis, fake officials, ATMs, distraction theft, payment tricks, fake tickets, look-alike visa or SIM sites.

For each scam include a short name, how it works, where it happens, the red flag, what to do instead, and an https link. Do not invent a scam, a phone number, or a link. Do not name ethnic groups. Do not call a neighbourhood unsafe. If you find nothing sourced for a country, return one scam whose name is Unverified and whose href is that country's government travel-advice page. Do not come back with an empty list.

summary is one calm sentence for the whole trip.`;
}

function parsePlace(value: unknown): ScamPlace | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const country = text(record.country, 60);
  const cities = citiesOf(record.cities);
  if (!country || cities.length === 0 || !Array.isArray(record.scams)) return null;

  const scams: ScamItem[] = [];
  for (const item of record.scams) {
    const scam = parseScam(item);
    if (scam) scams.push(scam);
    if (scams.length === 5) break;
  }
  if (scams.length === 0) return null;
  return { country, cities, scams };
}

function parseScam(value: unknown): ScamItem | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const name = text(record.name, 80);
  const how = text(record.how, 400);
  const where = text(record.where, 160);
  const redFlag = text(record.redFlag, 240);
  const instead = text(record.instead, 400);
  const source = text(record.source, 160);
  const href = httpsLink(record.href);
  if (!name || !how || !where || !redFlag || !instead || !source || !href) return null;
  return { name, how, where, redFlag, instead, source, href };
}
