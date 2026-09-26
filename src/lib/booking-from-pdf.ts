import { readModelJson } from "@/lib/azure";
import { canonicalDestination } from "@/lib/destinations";

const SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "The name of the booking, such as the hotel or the restaurant." },
    kind: {
      type: "string",
      enum: ["stay", "reservation"],
      description: "stay for a hotel or apartment. reservation for a train, dinner, tour, or ticket.",
    },
    city: { type: "string", description: "The city. Empty if it is not on the document." },
    startsOn: { type: "string", description: "Start date YYYY-MM-DD. Copy the year on the document." },
    startsAt: { type: "string", description: "Start time HH:MM, 24-hour. Empty if unknown." },
    endsOn: { type: "string", description: "End date YYYY-MM-DD. Empty if there is no end." },
    endsAt: { type: "string", description: "End time HH:MM, 24-hour. Empty if unknown." },
    url: { type: "string", description: "The http or https address printed on the document. Empty if there is none." },
  },
  required: ["title", "kind"],
};

export type ParsedBooking = {
  title: string;
  kind: "stay" | "reservation";
  destination: string | null;
  startsAt: string | null;
  endsAt: string | null;
  url: string | null;
};

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function checkedDay(year: number, month: number, date: number) {
  if (month < 1 || month > 12 || date < 1 || date > 31 || year < 2000 || year > 2100) return null;
  const check = new Date(Date.UTC(year, month - 1, date));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== date) {
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
  if (typeof value !== "string") return "00:00";
  const match = value.trim().match(/^([01]\d|2[0-3]):([0-5]\d)/);
  return match ? `${match[1]}:${match[2]}` : "00:00";
}

function stamp(day: string | null, time: unknown) {
  if (!day) return null;
  return `${day}T${clockOf(time)}:00`;
}

export function httpUrl(value: unknown) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function bookingFromModelJson(raw: unknown): ParsedBooking | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const title = typeof item.title === "string" ? item.title.replace(/\s+/g, " ").trim().slice(0, 80) : "";
  if (!title) return null;
  const city = typeof item.city === "string" ? canonicalDestination(item.city).slice(0, 80) : "";
  const startsOn = dayOf(item.startsOn);
  let endsOn = dayOf(item.endsOn);
  if (startsOn && endsOn && endsOn < startsOn) endsOn = startsOn;
  return {
    title,
    kind: item.kind === "stay" ? "stay" : "reservation",
    destination: city || null,
    startsAt: stamp(startsOn, item.startsAt),
    endsAt: stamp(endsOn, item.endsAt),
    url: httpUrl(item.url),
  };
}

export async function bookingFromPdf(
  bytes: Uint8Array,
  expect?: "stay",
): Promise<ParsedBooking | null> {
  if (bytes.byteLength === 0 || bytes.byteLength > 8_000_000) throw new Error("bad-file");

  const raw = await readModelJson({
    instructions:
      expect === "stay"
        ? "Read this hotel or apartment confirmation. Return the place name, the city, the check-in and check-out dates, and the web address printed on the page."
        : "Read this booking confirmation. It is a hotel, train, dinner, tour, or ticket, not a plane itinerary. Return the name, whether it is a stay or a reservation, the city, the dates, and the web address printed on the page.",
    schema: SCHEMA,
    schemaName: "booking",
    pdf: bytes,
    maxOutputTokens: 512,
    timeoutMs: 25_000,
  });
  if (!raw) return null;
  const booking = bookingFromModelJson(raw);
  if (booking && expect === "stay") booking.kind = "stay";
  return booking;
}
