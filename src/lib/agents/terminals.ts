import { readModelJson } from "@/lib/azure";
import { httpsLink, text } from "@/lib/agents/fields";
import type { TripFlight } from "@/lib/agents/trip-context";

const SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", description: "One sentence naming the departure terminal of each flight." },
    flights: {
      type: "array",
      description: "One row per flight, in the same order as the trip.",
      items: {
        type: "object",
        properties: {
          title: { type: "string", description: "Flight number, copied from the trip." },
          route: { type: "string", description: "Origin city to destination city." },
          departs: { type: "string", description: "Departure date and time from the trip." },
          airport: { type: "string", description: "Departure airport name." },
          terminal: {
            type: "string",
            description: "Departure terminal, such as Terminal 1. Not assigned yet if the airport has not published one.",
          },
          note: { type: "string", description: "One sentence on how this was found, or that it is not assigned yet." },
          source: { type: "string" },
          href: { type: "string" },
        },
        required: ["title", "route", "departs", "airport", "terminal", "note", "source", "href"],
      },
    },
  },
  required: ["summary", "flights"],
};

export type TerminalFlight = {
  title: string;
  route: string;
  departs: string;
  airport: string;
  terminal: string;
  note: string;
  source: string;
  href: string;
};

export type TerminalBrief = {
  summary: string;
  flights: TerminalFlight[];
};

export function parseTerminalBrief(value: unknown): TerminalBrief | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const summary = text(record.summary, 400);
  if (!summary || !Array.isArray(record.flights)) return null;

  const flights: TerminalFlight[] = [];
  for (const item of record.flights) {
    const flight = parseFlight(item);
    if (flight) flights.push(flight);
    if (flights.length === 12) break;
  }
  if (flights.length === 0) return null;
  return { summary, flights };
}

export async function terminalsAgent(flights: TripFlight[]): Promise<TerminalBrief> {
  const raw = await readModelJson({
    instructions: promptFor(flights),
    schema: SCHEMA,
    schemaName: "terminal_brief",
    maxOutputTokens: 4096,
    timeoutMs: 90_000,
    search: true,
  });
  const brief = raw ? parseTerminalBrief(raw) : null;
  if (!brief) throw new Error("model");
  return brief;
}

function promptFor(flights: TripFlight[]) {
  const lines = flights
    .map(
      (flight) =>
        `- ${flight.title}: ${flight.origin} → ${flight.destination}, departs ${flight.departs}, arrives ${flight.arrives}`,
    )
    .join("\n");

  return `You find the departure terminal for every flight on this trip.

Flights, in order:
${lines}

Search the web before you answer. Use the airline's flight page or the departure airport's official page for that flight number and date. Return one row per flight, in the same order, and copy the flight number into title.

airport is the departure airport. terminal is the terminal that flight departs from, such as Terminal 1 or Terminal 2. If the airport has a single terminal, say so. If the terminal is not published yet, set terminal to "Not assigned yet". note is one sentence. source names the page. href is that https page.

Do not invent a terminal. Do not guess from a different date or a different flight number. Do not come back with an empty list. summary is one sentence that names the departure terminal of each flight.`;
}

function parseFlight(value: unknown): TerminalFlight | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const title = text(record.title, 80);
  const route = text(record.route, 120);
  const departs = text(record.departs, 80);
  const airport = text(record.airport, 120);
  const terminal = text(record.terminal, 80);
  const note = text(record.note, 400);
  const source = text(record.source, 160);
  const href = httpsLink(record.href);
  if (!title || !route || !departs || !airport || !terminal || !note || !source || !href) return null;
  return { title, route, departs, airport, terminal, note, source, href };
}
