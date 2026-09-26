const AIRPORTS: Record<string, string> = {
  AMS: "Amsterdam",
  AUH: "Abu Dhabi",
  ATH: "Athens",
  AKL: "Auckland",
  BCN: "Barcelona",
  BER: "Berlin",
  BKK: "Bangkok",
  BKI: "Kota Kinabalu",
  BLR: "Bengaluru",
  BNE: "Brisbane",
  BOG: "Bogotá",
  BOM: "Mumbai",
  BRU: "Brussels",
  BUD: "Budapest",
  BWN: "Bandar Seri Begawan",
  CAN: "Guangzhou",
  CCU: "Kolkata",
  CDG: "Paris",
  CEB: "Cebu",
  CGK: "Jakarta",
  CMB: "Colombo",
  CNX: "Chiang Mai",
  COK: "Kochi",
  CPH: "Copenhagen",
  CPT: "Cape Town",
  CTU: "Chengdu",
  DAC: "Dhaka",
  DAD: "Da Nang",
  DEL: "Delhi",
  DMK: "Bangkok",
  DPS: "Bali",
  DUB: "Dublin",
  DXB: "Dubai",
  EWR: "New York",
  FCO: "Rome",
  FLR: "Florence",
  FRA: "Frankfurt",
  GIG: "Rio de Janeiro",
  GMP: "Seoul",
  GOI: "Goa",
  GRU: "São Paulo",
  HAN: "Hanoi",
  HEL: "Helsinki",
  HKG: "Hong Kong",
  HKT: "Phuket",
  HND: "Tokyo",
  HYD: "Hyderabad",
  ICN: "Seoul",
  IST: "Istanbul",
  JFK: "New York",
  JNB: "Johannesburg",
  JOG: "Yogyakarta",
  KHH: "Kaohsiung",
  KMG: "Kunming",
  KTM: "Kathmandu",
  KUL: "Kuala Lumpur",
  LAX: "Los Angeles",
  LCY: "London",
  LGK: "Langkawi",
  LGW: "London",
  LHR: "London",
  LIM: "Lima",
  LIS: "Lisbon",
  LPQ: "Luang Prabang",
  LTN: "London",
  MAA: "Chennai",
  MAD: "Madrid",
  MEL: "Melbourne",
  MEX: "Mexico City",
  MIA: "Miami",
  MLE: "Malé",
  MNL: "Manila",
  MUC: "Munich",
  NAP: "Naples",
  NBO: "Nairobi",
  NRT: "Tokyo",
  OPO: "Porto",
  ORD: "Chicago",
  ORY: "Paris",
  OSL: "Oslo",
  PEK: "Beijing",
  PEN: "Penang",
  PKX: "Beijing",
  PNH: "Phnom Penh",
  PQC: "Phu Quoc",
  PRG: "Prague",
  PUS: "Busan",
  PVG: "Shanghai",
  RAK: "Marrakech",
  REP: "Siem Reap",
  RGN: "Yangon",
  SCL: "Santiago",
  SFO: "San Francisco",
  SGN: "Ho Chi Minh City",
  SHA: "Shanghai",
  SIN: "Singapore",
  STN: "London",
  SUB: "Surabaya",
  SYD: "Sydney",
  SZX: "Shenzhen",
  TPE: "Taipei",
  USM: "Koh Samui",
  VCE: "Venice",
  VIE: "Vienna",
  VTE: "Vientiane",
  WAW: "Warsaw",
  YIA: "Yogyakarta",
  YUL: "Montreal",
  YVR: "Vancouver",
  YYZ: "Toronto",
  ZRH: "Zurich",
};

export const CITIES = [...new Set(Object.values(AIRPORTS))].sort((a, b) =>
  a.localeCompare(b, "en"),
);

export function airportCity(code: string) {
  return AIRPORTS[code.trim().toUpperCase()] ?? null;
}

const CITY_ALIASES: [RegExp, string][] = [
  [/\bha\s*noi\b/i, "Hanoi"],
  [/\bngurah\s*rai\b|\bdenpasar\b/i, "Bali"],
  [/\bdon\s*mue?ang\b|\bdonmuang\b|\bsuvarnabhumi\b/i, "Bangkok"],
  [/\babu\s*dhabi\b/i, "Abu Dhabi"],
  [/\bho\s*chi\s*minh\b|\bsaigon\b|\bsai\s*gon\b/i, "Ho Chi Minh City"],
];

export function canonicalDestination(name: string) {
  const trimmed = name.trim().replace(/\s+/g, " ");
  const code = trimmed.toUpperCase();
  if (/^[A-Z]{3}$/.test(code) && AIRPORTS[code]) return AIRPORTS[code];
  for (const [pattern, city] of CITY_ALIASES) {
    if (pattern.test(trimmed)) return city;
  }
  return trimmed;
}

export function sameDestination(a: string, b: string) {
  return canonicalDestination(a).toLowerCase() === canonicalDestination(b).toLowerCase();
}

export type StopDraft = {
  name: string;
  startsOn: string;
  endsOn: string;
};

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function parseStopList(value: string): StopDraft[] | null {
  const trimmed = value.trim();
  if (!trimmed) return [];

  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    return null;
  }

  if (!Array.isArray(raw)) return null;

  const stops: StopDraft[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const record = item as Record<string, unknown>;
    const name = typeof record.name === "string" ? canonicalDestination(record.name) : "";
    const startsOn = typeof record.startsOn === "string" ? record.startsOn : "";
    const endsOn = typeof record.endsOn === "string" ? record.endsOn : "";
    if (!name || !ISO_DAY.test(startsOn) || !ISO_DAY.test(endsOn) || endsOn < startsOn) {
      return null;
    }
    stops.push({ name, startsOn, endsOn });
  }

  return stops;
}

export function routeLabel(origin: string | null, destination: string | null) {
  const from = origin ? canonicalDestination(origin) : null;
  const to = destination ? canonicalDestination(destination) : null;
  if (from && to && !sameDestination(from, to)) return `${from} → ${to}`;
  return to ?? from;
}
