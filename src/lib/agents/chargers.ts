import { readModelJson } from "@/lib/azure";
import { citiesOf, httpsLink, text } from "@/lib/agents/fields";
import type { TripContext } from "@/lib/agents/trip-context";

const SCHEMA = {
  type: "object",
  properties: {
    summary: {
      type: "string",
      description: "One sentence summarizing the plug situation across the trip.",
    },
    places: {
      type: "array",
      description: "One entry per destination country.",
      items: {
        type: "object",
        properties: {
          country: { type: "string" },
          cities: { type: "array", items: { type: "string" } },
          plugTypes: {
            type: "array",
            items: { type: "string" },
            description: "IEC plug letters used in the country, such as A, C, or G.",
          },
          voltage: { type: "string", description: "Nominal mains voltage, with V." },
          frequency: { type: "string", description: "Mains frequency, with Hz." },
          adapter: {
            type: "string",
            description: "How to decide whether a plug adapter is needed.",
          },
          converter: {
            type: "string",
            description: "How to decide whether a voltage converter is needed.",
          },
          safety: { type: "string", description: "One short electrical-safety note." },
          source: { type: "string" },
          href: { type: "string" },
        },
        required: [
          "country",
          "cities",
          "plugTypes",
          "voltage",
          "frequency",
          "adapter",
          "converter",
          "safety",
          "source",
          "href",
        ],
      },
    },
  },
  required: ["summary", "places"],
};

export type ChargerPlace = {
  country: string;
  cities: string[];
  plugTypes: string[];
  voltage: string;
  frequency: string;
  adapter: string;
  converter: string;
  safety: string;
  source: string;
  href: string;
};

export type ChargerBrief = {
  summary: string;
  places: ChargerPlace[];
};

export async function chargersAgent(trip: TripContext): Promise<ChargerBrief> {
  const raw = await readModelJson({
    instructions: promptFor(trip),
    schema: SCHEMA,
    schemaName: "charger_brief",
    maxOutputTokens: 4096,
    timeoutMs: 90_000,
    search: true,
  });
  const brief = raw ? parseChargerBrief(raw) : null;
  if (!brief) throw new Error("model");
  return brief;
}

export function parseChargerBrief(value: unknown): ChargerBrief | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const summary = text(record.summary, 400);
  if (!summary || !Array.isArray(record.places)) return null;

  const places: ChargerPlace[] = [];
  for (const item of record.places) {
    const place = parsePlace(item);
    if (place) places.push(place);
    if (places.length === 8) break;
  }
  if (places.length === 0) return null;
  return { summary, places };
}

function promptFor(trip: TripContext) {
  const stops = trip.stops
    .map((stop) => {
      const leaves = stop.leaves ? `, leaves ${stop.leaves}` : ", open-ended";
      return `- ${stop.city}, arrives ${stop.arrives}${leaves}`;
    })
    .join("\n");

  return `You research wall sockets and electricity for a traveller's device chargers.

Stops, in order:
${stops}

Search the web for every destination country before answering. Return one entry per country and list all trip cities in that country. Prefer the national electrical or standards authority, the IEC World Plugs data, or an official tourism or government page. Use a reputable standards reference only when no official page is available. Cross-check the final plug-letter list against IEC World Plugs. Include newer country-specific standards even when hotels also accept older plug types. Thailand's official TIS 166-2549 Type O must appear in plugTypes alongside the commonly accepted types; do not return only A, B, and C.

For each country provide:
- every common IEC plug letter used there
- nominal mains voltage
- mains frequency
- adapter: explain that an adapter is needed only when the traveller's home plug does not fit; the home plug is unknown, so never claim yes or no
- converter: tell the traveller to read the charger's INPUT label. If it covers the destination voltage (many phone and laptop chargers say 100–240V, 50/60Hz), a voltage converter is not needed. Otherwise, do not use it without the correct converter. Never assume their device is universal-voltage
- one short safety note that an adapter changes plug shape, not voltage
- the source name and a direct https source link

Do not invent plug letters, voltage, frequency, or links. Do not recommend a specific commercial adapter. Keep each field short and practical. summary is one sentence for the whole trip.`;
}

function parsePlace(value: unknown): ChargerPlace | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const country = text(record.country, 60);
  const cities = citiesOf(record.cities);
  const plugTypes = plugTypesOf(record.plugTypes);
  const voltage = text(record.voltage, 80);
  const frequency = text(record.frequency, 80);
  const adapter = text(record.adapter, 400);
  const converter = text(record.converter, 500);
  const safety = text(record.safety, 300);
  const source = text(record.source, 160);
  const href = httpsLink(record.href);
  if (
    !country ||
    cities.length === 0 ||
    plugTypes.length === 0 ||
    !voltage ||
    !frequency ||
    !adapter ||
    !converter ||
    !safety ||
    !source ||
    !href
  ) {
    return null;
  }
  return {
    country,
    cities,
    plugTypes,
    voltage,
    frequency,
    adapter,
    converter,
    safety,
    source,
    href,
  };
}

function plugTypesOf(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.flatMap((item) => {
        const plug = text(item, 2)?.toUpperCase();
        return plug && /^[A-O]$/.test(plug) ? [plug] : [];
      }),
    ),
  ].slice(0, 8);
}
