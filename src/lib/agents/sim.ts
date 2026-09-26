import { readModelJson } from "@/lib/azure";
import type { TripContext } from "@/lib/agents/trip-context";

const SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", description: "One sentence on how to get data for this trip." },
    buyBefore: {
      type: "string",
      description: "When to buy or install, such as the day before on home Wi-Fi.",
    },
    places: {
      type: "array",
      description: "One local pick per country. Cities in the same country share one entry.",
      items: {
        type: "object",
        properties: {
          country: { type: "string" },
          cities: { type: "array", items: { type: "string" } },
          provider: {
            type: "string",
            description: "The local carrier travelers recommend for this country, such as Viettel in Vietnam.",
          },
          type: { type: "string", enum: ["esim", "local_sim"] },
          data: { type: "string", description: "Data amount travelers mention, such as 10 GB." },
          validity: { type: "string", description: "How long the plan lasts." },
          price: { type: "string", description: "Price travelers mention. Omit if the threads do not name one." },
          hotspot: { type: "boolean" },
          sms: { type: "boolean" },
          why: { type: "string", description: "Why travelers prefer this carrier, from the threads." },
          href: { type: "string", description: "https link to the Reddit thread or the carrier page the threads point to." },
          source: { type: "string", description: "The Reddit thread or forum post. Label it as a traveler report." },
        },
        required: ["country", "cities", "provider", "type", "data", "validity", "hotspot", "sms", "why", "href", "source"],
      },
    },
    keepHomeSim: {
      type: "string",
      description: "Why the home SIM should stay on for codes, in one or two sentences.",
    },
  },
  required: ["summary", "buyBefore", "places", "keepHomeSim"],
};

export type SimPlace = {
  country: string;
  cities: string[];
  provider: string;
  type: "esim" | "local_sim";
  data: string;
  validity: string;
  price: string | null;
  hotspot: boolean;
  sms: boolean;
  why: string;
  href: string;
  source: string;
};

export type SimBrief = {
  summary: string;
  buyBefore: string;
  places: SimPlace[];
  keepHomeSim: string;
};

const SHORTENERS = new Set(["bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly"]);

export function parseSimBrief(value: unknown): SimBrief | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const summary = text(record.summary, 400);
  const buyBefore = text(record.buyBefore, 240);
  const keepHomeSim = text(record.keepHomeSim, 400);
  if (!summary || !buyBefore || !keepHomeSim || !Array.isArray(record.places)) return null;

  const places: SimPlace[] = [];
  for (const item of record.places) {
    const place = parsePlace(item);
    if (place) places.push(place);
    if (places.length === 8) break;
  }
  if (places.length === 0) return null;

  return { summary, buyBefore, places, keepHomeSim };
}

export async function simAgent(trip: TripContext): Promise<SimBrief> {
  const raw = await readModelJson({
    instructions: promptFor(trip),
    schema: SCHEMA,
    schemaName: "sim_brief",
    maxOutputTokens: 4096,
    timeoutMs: 90_000,
    search: { allowedDomains: ["reddit.com"] },
  });
  const brief = raw ? parseSimBrief(raw) : null;
  if (!brief) throw new Error("model");
  return brief;
}

function promptFor(trip: TripContext) {
  const stops = trip.stops
    .map((stop) => {
      const leaves = stop.leaves ? `, leaves ${stop.leaves}` : "";
      return `- ${stop.city}, arrives ${stop.arrives}${leaves}`;
    })
    .join("\n");

  return `You help a traveller pick a local SIM or eSIM for each country on this trip.

Stops, in order:
${stops}

Search Reddit for each country before you answer. Use the country subreddit and travel threads. Recommend the local carrier those threads agree on. One pick per country. If two cities are in the same country, return that country once and list both cities.

A regional or global travel eSIM (Airalo, Holafly, Nomad, Saily, and similar) is not the pick, unless the threads say the local carrier is a poor choice. In Vietnam, travelers usually say Viettel. Use that kind of local answer for every country.

For each country include the carrier, whether it is an esim or a local_sim, a data amount, how long it lasts, hotspot, SMS, and why travelers prefer it. Always return one place per country. source names what you found on Reddit and says it is a traveler report. href is an https link to a Reddit thread when you have one, otherwise a Reddit search for that carrier in that country. Include a price only when a result states it. Do not invent a price. Do not come back with an empty list.

Assume the phone is unlocked. keepHomeSim tells the traveller to keep their home SIM on for bank and app codes, because a local data SIM often has no SMS. summary is one sentence. buyBefore says to buy the local SIM on arrival, or install a local eSIM the day before on home Wi-Fi when the threads say that works.`;
}

function parsePlace(value: unknown): SimPlace | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const provider = text(record.provider, 80);
  const type = record.type === "esim" || record.type === "local_sim" ? record.type : null;
  const data = text(record.data, 80);
  const validity = text(record.validity, 80);
  const href = httpsLink(record.href);
  const source = text(record.source, 160);
  const hotspot = record.hotspot === true;
  const sms = record.sms === true;
  const country = text(record.country, 60);
  const why = text(record.why, 400);
  const cities = Array.isArray(record.cities)
    ? record.cities.flatMap((city) => {
        const name = text(city, 60);
        return name ? [name] : [];
      })
    : [];
  if (!country || !provider || !type || !data || !validity || !why || !href || !source || cities.length === 0) {
    return null;
  }
  return {
    country,
    cities,
    provider,
    type,
    data,
    validity,
    price: record.price == null || record.price === "" ? null : text(record.price, 80),
    hotspot,
    sms,
    why,
    href,
    source,
  };
}

function httpsLink(value: unknown) {
  if (typeof value !== "string") return null;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^www\./, "");
  if (SHORTENERS.has(host)) return null;
  return url.toString();
}

function text(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}
