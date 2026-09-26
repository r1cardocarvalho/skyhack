import { readModelJson } from "@/lib/azure";

const MAX_POLICIES = 4;

const SCHEMA = {
  type: "object",
  properties: {
    policies: {
      type: "array",
      items: {
        type: "object",
        properties: {
          insurer: {
            type: "string",
            description: "Insurance company as printed.",
          },
          plan: {
            type: "string",
            description: "Product or plan name as printed. Empty if absent.",
          },
          policyNumber: {
            type: "string",
            description: "Policy, certificate, or member number as printed. Empty if absent.",
          },
          holder: {
            type: "string",
            description: "Person the policy covers, as printed. Empty if absent.",
          },
          validFrom: {
            type: "string",
            description: "First day the cover is valid, YYYY-MM-DD. Empty if absent.",
          },
          validUntil: {
            type: "string",
            description: "Last day the cover is valid, YYYY-MM-DD. Empty if absent.",
          },
          emergencyPhone: {
            type: "string",
            description: "24-hour assistance or emergency claims phone as printed, with the country code when shown. Empty if absent.",
          },
          coverage: {
            type: "string",
            description: "Medical expenses limit as printed, including the currency. Empty if absent.",
          },
          deductible: {
            type: "string",
            description: "Deductible or excess as printed, including the currency. Empty if absent.",
          },
          territory: {
            type: "string",
            description: "Where the cover applies, as printed, such as worldwide or Europe. Empty if absent.",
          },
          notes: {
            type: "string",
            description: "One short condition printed on the policy that a traveller would need, such as a pre-authorisation rule. Empty if absent.",
          },
        },
        required: ["insurer"],
      },
    },
  },
  required: ["policies"],
};

export type ParsedPolicy = {
  insurer: string;
  plan: string | null;
  policyNumber: string | null;
  holder: string | null;
  validFrom: string | null;
  validUntil: string | null;
  emergencyPhone: string | null;
  coverage: string | null;
  deductible: string | null;
  territory: string | null;
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

export function policiesFromModelJson(raw: unknown): ParsedPolicy[] {
  if (!raw || typeof raw !== "object") return [];
  const list = (raw as { policies?: unknown }).policies;
  if (!Array.isArray(list)) return [];

  const policies: ParsedPolicy[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const insurer = clip(row.insurer, 80);
    if (!insurer) continue;
    let validFrom = dayOf(row.validFrom);
    let validUntil = dayOf(row.validUntil);
    if (validFrom && validUntil && validUntil < validFrom) {
      const earlier = validUntil;
      validUntil = validFrom;
      validFrom = earlier;
    }
    policies.push({
      insurer,
      plan: clip(row.plan, 80),
      policyNumber: clip(row.policyNumber, 40),
      holder: clip(row.holder, 80),
      validFrom,
      validUntil,
      emergencyPhone: clip(row.emergencyPhone, 40),
      coverage: clip(row.coverage, 80),
      deductible: clip(row.deductible, 80),
      territory: clip(row.territory, 120),
      notes: clip(row.notes, 400),
    });
    if (policies.length >= MAX_POLICIES) break;
  }
  return policies;
}

export async function insuranceFromPdf(bytes: Uint8Array): Promise<ParsedPolicy[]> {
  if (bytes.byteLength === 0 || bytes.byteLength > 8_000_000) throw new Error("bad-file");

  const raw = await readModelJson({
    instructions:
      "Read this travel or medical insurance certificate, policy schedule, or assistance card. Return one item per policy on the page. Copy the insurer, plan, policy number, holder, validity dates, emergency assistance phone, medical coverage limit, deductible, and territory as printed. Do not invent a company, a number, a date, or a phone that is not on the page.",
    schema: SCHEMA,
    schemaName: "insurance_policy",
    pdf: bytes,
    maxOutputTokens: 2048,
    timeoutMs: 45_000,
  });
  if (!raw) return [];
  return policiesFromModelJson(raw);
}
