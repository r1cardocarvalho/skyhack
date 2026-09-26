import {
  airportCity,
  canonicalDestination,
  sameDestination,
  type StopDraft,
} from "@/lib/destinations";
import type { ParsedFlight } from "@/lib/parse-ticket";

const MODEL = "gemini-3.5-flash-lite";
const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MAX_FLIGHTS = 20;
const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const SCHEMA = {
  type: "object",
  properties: {
    flights: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string", description: "Airline and flight number, such as TP 1324." },
          origin: { type: "string", description: "Departure city. Use the city name, not the airport code." },
          destination: { type: "string", description: "Arrival city. Use the city name, not the airport code." },
          departsOn: { type: "string", description: "Local departure date, YYYY-MM-DD." },
          departsAt: { type: "string", description: "Local departure time, HH:MM, 24-hour. Empty if unknown." },
          arrivesOn: { type: "string", description: "Local arrival date, YYYY-MM-DD. Copy the year printed on the ticket." },
          arrivesAt: { type: "string", description: "Local arrival time, HH:MM, 24-hour. Empty if unknown." },
          layover: {
            type: "boolean",
            description: "True when the destination is only a plane change and the passenger does not spend a night there.",
          },
        },
        required: ["origin", "destination", "departsOn", "arrivesOn"],
      },
    },
  },
  required: ["flights"],
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function nextDay(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, date + 1));
  return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
}

function placeName(value: unknown) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim().slice(0, 80);
  const coded = trimmed.match(/\(([A-Za-z]{3})\)|\b([A-Za-z]{3})\b/);
  const code = coded?.[1] ?? coded?.[2];
  if (code) {
    const city = airportCity(code);
    if (city) return city;
  }
  const cleaned = trimmed.split(",")[0]?.replace(/\([^)]*\)/g, "").trim() ?? "";
  return cleaned ? canonicalDestination(cleaned).slice(0, 80) : "";
}

function checkedDay(year: number, month: number, date: number) {
  if (month < 1 || month > 12 || date < 1 || date > 31 || year < 2000 || year > 2100) return null;
  const check = new Date(Date.UTC(year, month - 1, date));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== date
  ) {
    return null;
  }
  return `${year}-${pad(month)}-${pad(date)}`;
}

function dayOf(value: unknown) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return checkedDay(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const named = text.match(/^(\d{1,2})\s*([A-Za-z]{3,9})\.?\s*(\d{4})/);
  if (named) {
    const month = MONTHS[named[2].slice(0, 3).toLowerCase()];
    if (month) return checkedDay(Number(named[3]), month, Number(named[1]));
  }
  const numeric = text.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})/);
  if (numeric) return checkedDay(Number(numeric[3]), Number(numeric[2]), Number(numeric[1]));
  return null;
}

function clockOf(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "00:00";
  const match = value.trim().match(CLOCK);
  return match ? `${match[1]}:${match[2]}` : null;
}

function titleOf(value: unknown, origin: string, destination: string) {
  const fallback = `${origin} to ${destination}`;
  if (typeof value !== "string") return fallback;
  const cleaned = value.replace(/[^\w ./-]/g, "").trim().slice(0, 40);
  return cleaned || fallback;
}

export function flightsFromModelJson(raw: unknown): ParsedFlight[] {
  const record = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  const rows = record && Array.isArray(record.flights) ? record.flights.slice(0, MAX_FLIGHTS) : [];
  const flights: ParsedFlight[] = [];

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const origin = placeName(item.origin);
    const destination = placeName(item.destination);
    const departsOn = dayOf(item.departsOn);
    let arrivesOn = dayOf(item.arrivesOn) ?? departsOn;
    const departsAt = clockOf(item.departsAt);
    const arrivesAt = clockOf(item.arrivesAt);
    if (!origin || !destination || !departsOn || !arrivesOn || !departsAt || !arrivesAt) continue;
    if (sameDestination(origin, destination)) continue;
    if (arrivesOn < departsOn) arrivesOn = departsOn;
    if (arrivesOn === departsOn && arrivesAt !== "00:00" && arrivesAt < departsAt) {
      arrivesOn = nextDay(arrivesOn);
    }
    flights.push({
      title: titleOf(item.title, origin, destination),
      origin,
      destination,
      startsAt: `${departsOn}T${departsAt}:00`,
      endsAt: `${arrivesOn}T${arrivesAt}:00`,
      layover: item.layover === true,
    });
  }

  return flights;
}

function daysBetween(start: string, end: string) {
  const a = Date.parse(`${start.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${end.slice(0, 10)}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

function hoursBetween(start: string, end: string) {
  const a = Date.parse(`${start.slice(0, 19)}Z`);
  const b = Date.parse(`${end.slice(0, 19)}Z`);
  return (b - a) / 3_600_000;
}

function clockKnown(value: string) {
  return !value.includes("T00:00");
}

function shiftYear(value: string, year: number) {
  return `${year}${value.slice(4)}`;
}

export function alignFlightYears<T extends ParsedFlight>(flights: T[]): T[] {
  if (flights.length === 0) return [];
  const ordered = [...flights].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const anchor = Number(ordered[0].startsAt.slice(0, 4));
  let previous = ordered[0].startsAt.slice(0, 10);

  return ordered.map((flight, index) => {
    if (index === 0) return flight;
    const startYear = Number(flight.startsAt.slice(0, 4));
    if (startYear === anchor) {
      previous = flight.startsAt.slice(0, 10);
      return flight;
    }
    const shiftedStart = shiftYear(flight.startsAt, anchor);
    const shiftedEnd =
      Number(flight.endsAt.slice(0, 4)) === startYear ? shiftYear(flight.endsAt, anchor) : flight.endsAt;
    const startDay = shiftedStart.slice(0, 10);
    if (startDay >= previous && daysBetween(previous, startDay) <= 120) {
      previous = startDay;
      return { ...flight, startsAt: shiftedStart, endsAt: shiftedEnd };
    }
    previous = flight.startsAt.slice(0, 10);
    return flight;
  });
}

export function prepareFlights<T extends ParsedFlight>(flights: T[]): T[] {
  const named = flights.map((flight) => ({
    ...flight,
    origin: canonicalDestination(flight.origin),
    destination: canonicalDestination(flight.destination),
  }));
  const sorted = alignFlightYears(named);
  const seen = new Set<string>();
  return sorted.filter((flight) => {
    const key = [flight.origin, flight.destination, flight.startsAt, flight.title].join("|").toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function staysFromFlights(flights: ParsedFlight[]): StopDraft[] {
  const unique = prepareFlights(flights);
  if (unique.length === 0) return [];

  const home = unique[0].origin;
  const stays: StopDraft[] = [];

  for (let index = 0; index < unique.length; index += 1) {
    const flight = unique[index];
    const city = flight.destination;
    const arrivedOn = flight.endsAt.slice(0, 10);
    const next = unique.slice(index + 1).find((item) => sameDestination(item.origin, city));
    if (!next) {
      if (sameDestination(city, home)) continue;
      stays.push({ name: city, startsOn: arrivedOn, endsOn: arrivedOn });
      continue;
    }
    const leftOn = next.startsAt.slice(0, 10);
    if (leftOn <= arrivedOn) continue;
    const gap = hoursBetween(flight.endsAt, next.startsAt);
    if (gap < 18 && clockKnown(flight.endsAt) && clockKnown(next.startsAt)) continue;
    if (flight.layover && gap < 36) continue;
    stays.push({ name: city, startsOn: arrivedOn, endsOn: leftOn });
  }

  const merged: StopDraft[] = [];
  for (const stay of stays) {
    const last = merged[merged.length - 1];
    if (last && sameDestination(last.name, stay.name)) {
      if (stay.startsOn < last.startsOn) last.startsOn = stay.startsOn;
      if (stay.endsOn > last.endsOn) last.endsOn = stay.endsOn;
      continue;
    }
    merged.push({ ...stay });
  }
  return merged;
}

function jsonFromModelText(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced?.[1] ?? text).trim();
  return JSON.parse(body) as unknown;
}

export async function flightsFromPdf(bytes: Uint8Array): Promise<ParsedFlight[]> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("missing-key");
  if (bytes.byteLength === 0 || bytes.byteLength > 8_000_000) throw new Error("bad-file");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      signal: AbortSignal.timeout(25_000),
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: "Read this plane ticket. Return every flight leg, including connections. A connection is a city where the passenger only changes planes and does not stay the night, such as Abu Dhabi between Lisbon and Hanoi. Use the city, never the airport: Ngurah Rai and Denpasar are Bali, Don Mueang is Bangkok, Ha Noi is Hanoi. Copy the year printed on the ticket.",
              },
              {
                inline_data: {
                  mime_type: "application/pdf",
                  data: Buffer.from(bytes).toString("base64"),
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 1024,
          thinkingConfig: { thinkingLevel: "minimal" },
          responseMimeType: "application/json",
          responseJsonSchema: SCHEMA,
        },
      }),
    },
  );

  if (!response.ok) throw new Error("model");

  const payload = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = (payload.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();
  if (!text) return [];
  return flightsFromModelJson(jsonFromModelText(text));
}
