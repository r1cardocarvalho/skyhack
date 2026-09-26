import {
  airportCity,
  canonicalDestination,
  CITIES,
  sameDestination,
} from "@/lib/destinations";

export type ParsedFlight = {
  title: string;
  origin: string;
  destination: string;
  startsAt: string;
  endsAt: string;
  layover?: boolean;
};

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

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function iso(year: number, month: number, day: number) {
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2000 || year > 2100) {
    return null;
  }
  return `${year}-${pad(month)}-${pad(day)}`;
}

function nextDay(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, date + 1));
  return iso(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate()) ?? day;
}

type Hit = { index: number; city: string };

function citiesInOrder(text: string) {
  const hits: Hit[] = [];
  for (const match of text.matchAll(/\b([A-Za-z]{3})\b/g)) {
    const city = airportCity(match[1]);
    if (!city || match.index === undefined) continue;
    hits.push({ index: match.index, city });
  }

  const names = [...CITIES].sort((a, b) => b.length - a.length);
  for (const name of names) {
    const pattern = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    for (const match of text.matchAll(pattern)) {
      if (match.index === undefined) continue;
      hits.push({ index: match.index, city: canonicalDestination(name) });
    }
  }

  hits.sort((a, b) => a.index - b.index);
  const cities: string[] = [];
  let previousIndex = -100;
  for (const hit of hits) {
    const previous = cities[cities.length - 1];
    if (previous && sameDestination(previous, hit.city) && hit.index - previousIndex < 40) {
      previousIndex = hit.index;
      continue;
    }
    if (previous && sameDestination(previous, hit.city)) continue;
    cities.push(hit.city);
    previousIndex = hit.index;
  }
  return cities;
}

function datesInOrder(text: string) {
  const found: { index: number; day: string }[] = [];
  for (const match of text.matchAll(/\b(\d{1,2})\s*([A-Za-z]{3,9})\.?\s*(\d{4})\b/g)) {
    const month = MONTHS[match[2].slice(0, 3).toLowerCase()];
    const day = month ? iso(Number(match[3]), month, Number(match[1])) : null;
    if (day && match.index !== undefined) found.push({ index: match.index, day });
  }
  for (const match of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
    const day = iso(Number(match[1]), Number(match[2]), Number(match[3]));
    if (day && match.index !== undefined) found.push({ index: match.index, day });
  }
  for (const match of text.matchAll(/\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/g)) {
    const day = iso(Number(match[3]), Number(match[2]), Number(match[1]));
    if (day && match.index !== undefined) found.push({ index: match.index, day });
  }

  found.sort((a, b) => a.index - b.index);
  const days: string[] = [];
  let lastIndex = -100;
  for (const item of found) {
    if (item.index < lastIndex + 8) continue;
    days.push(item.day);
    lastIndex = item.index;
  }
  return days;
}

function timesInOrder(text: string) {
  return [...text.matchAll(/\b([01]\d|2[0-3]):([0-5]\d)\b/g)].map(
    (match) => `${match[1]}:${match[2]}`,
  );
}

const NOT_AN_AIRLINE = new Set(["AM", "AN", "AT", "BY", "IN", "IS", "NO", "OF", "ON", "OR", "PM", "TO"]);

function flightNumbers(text: string) {
  return [...text.matchAll(/\b([A-Za-z]{2})\s*(\d{2,4})\b/g)]
    .filter((match) => {
      const code = match[1].toUpperCase();
      const num = Number(match[2]);
      return !NOT_AN_AIRLINE.has(code) && num >= 1 && num <= 9999;
    })
    .map((match) => `${match[1].toUpperCase()} ${Number(match[2])}`);
}

export function parseTicketText(raw: string): ParsedFlight[] {
  const text = raw
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .replace(/(\d)([A-Za-z])/g, "$1 $2")
    .replace(/(\d{2}:\d{2})(\d)/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  const cities = citiesInOrder(text);
  const legs: [string, string][] = [];
  for (let i = 0; i < cities.length - 1; i += 1) {
    if (!sameDestination(cities[i], cities[i + 1])) legs.push([cities[i], cities[i + 1]]);
  }
  if (legs.length === 0) return [];

  const dates = datesInOrder(text);
  const times = timesInOrder(text);
  const numbers = flightNumbers(text);
  const flights: ParsedFlight[] = [];

  for (let i = 0; i < legs.length; i += 1) {
    let startDay: string | null = null;
    let endDay: string | null = null;
    if (dates.length >= legs.length * 2) {
      startDay = dates[i * 2];
      endDay = dates[i * 2 + 1];
    } else if (dates.length >= legs.length) {
      startDay = dates[i];
      endDay = dates[i];
    } else if (i === 0 && dates[0]) {
      startDay = dates[0];
      endDay = dates[0];
    }
    if (!startDay || !endDay) continue;

    let startTime = "00:00";
    let endTime = "00:00";
    if (times.length >= legs.length * 2) {
      startTime = times[i * 2];
      endTime = times[i * 2 + 1];
    } else if (times[i]) {
      startTime = times[i];
    }

    if (endDay === startDay && endTime !== "00:00" && endTime < startTime) {
      endDay = nextDay(endDay);
    }

    const [origin, destination] = legs[i];
    flights.push({
      title: numbers[i] ?? `${origin} to ${destination}`,
      origin,
      destination,
      startsAt: `${startDay}T${startTime}:00`,
      endsAt: `${endDay}T${endTime}:00`,
    });
  }

  return flights;
}
