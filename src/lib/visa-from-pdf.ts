import { readModelJson } from "@/lib/azure";

const MAX_VISAS = 8;

const SCHEMA = {
  type: "object",
  properties: {
    visas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          country: {
            type: "string",
            description: "Country this visa is for, as printed.",
          },
          visaType: {
            type: "string",
            description: "Visa type as printed, such as tourist. Empty if absent.",
          },
          validFrom: {
            type: "string",
            description: "First day the visa is valid, YYYY-MM-DD. Empty if absent.",
          },
          validUntil: {
            type: "string",
            description: "Last day the visa is valid, YYYY-MM-DD. Empty if absent.",
          },
          stayDays: {
            type: "integer",
            description: "How many days the holder may stay in the country, as printed. Omit if the page does not state a number of days.",
          },
          entries: {
            type: "string",
            description: "Single or multiple entry, as printed. Empty if absent.",
          },
          notes: {
            type: "string",
            description: "Other stay conditions printed on the visa. Empty if absent.",
          },
        },
        required: ["country"],
      },
    },
  },
  required: ["visas"],
};

export type ParsedVisa = {
  country: string;
  visaType: string | null;
  validFrom: string | null;
  validUntil: string | null;
  stayDays: number | null;
  entries: string | null;
  notes: string | null;
};

function clip(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : null;
}

function dayOf(value: unknown) {
  const text = clip(value, 20);
  if (!text) return null;
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function daysOf(value: unknown) {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : NaN;
  if (!Number.isInteger(number) || number < 1 || number > 3999) return null;
  return number;
}

export function visasFromModelJson(raw: unknown): ParsedVisa[] {
  if (!raw || typeof raw !== "object") return [];
  const list = (raw as { visas?: unknown }).visas;
  if (!Array.isArray(list)) return [];

  const visas: ParsedVisa[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const country = clip(row.country, 60);
    if (!country) continue;
    let validFrom = dayOf(row.validFrom);
    let validUntil = dayOf(row.validUntil);
    if (validFrom && validUntil && validUntil < validFrom) {
      const earlier = validUntil;
      validUntil = validFrom;
      validFrom = earlier;
    }
    visas.push({
      country,
      visaType: clip(row.visaType, 80),
      validFrom,
      validUntil,
      stayDays: daysOf(row.stayDays),
      entries: clip(row.entries, 40),
      notes: clip(row.notes, 400),
    });
    if (visas.length >= MAX_VISAS) break;
  }
  return visas;
}

export async function visaFromPdf(bytes: Uint8Array): Promise<ParsedVisa[]> {
  if (bytes.byteLength === 0 || bytes.byteLength > 8_000_000) throw new Error("bad-file");

  const raw = await readModelJson({
    instructions:
      "Read this visa, visa grant, or entry permit. Return one item per country named on the page. Copy the visa type, validity dates, number of entries, and the number of days the holder may stay, as printed. stayDays is that stay length in days, such as 15 or 90. If the page gives dates but not a day count, leave stayDays empty. Do not invent a country, a date, or a number of days that is not on the page.",
    schema: SCHEMA,
    schemaName: "visa_document",
    pdf: bytes,
    maxOutputTokens: 2048,
    timeoutMs: 45_000,
  });
  if (!raw) return [];
  return visasFromModelJson(raw);
}
