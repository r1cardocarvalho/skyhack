import { readModelJson } from "@/lib/azure";

const MAX_MEDICATIONS = 30;

const SCHEMA = {
  type: "object",
  properties: {
    medications: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Medicine name as printed, brand or generic.",
          },
          dose: {
            type: "string",
            description: "Strength as printed, such as 250 mg/100 mg. Empty if absent.",
          },
          form: {
            type: "string",
            description: "Form as printed, such as tablet, capsule, or cream. Empty if absent.",
          },
          schedule: {
            type: "string",
            description: "How often to take it, as printed. Empty if absent.",
          },
          timing: {
            type: "string",
            enum: ["before", "during", "as-needed"],
            description:
              "before when it must start before departure, even if it continues on the trip. during when it is taken on a schedule only while away. as-needed when it is only if symptoms appear.",
          },
          quantity: {
            type: "string",
            description: "How much was prescribed, as printed. Empty if absent.",
          },
          purpose: {
            type: "string",
            description: "What it is for, as printed. Empty if absent.",
          },
          notes: {
            type: "string",
            description: "Extra instructions as printed, such as when to start or stop. Empty if absent.",
          },
        },
        required: ["name", "timing"],
      },
    },
  },
  required: ["medications"],
};

export type MedicationTiming = "before" | "during" | "as-needed";

export type ParsedMedication = {
  name: string;
  dose: string | null;
  form: string | null;
  schedule: string | null;
  timing: MedicationTiming;
  quantity: string | null;
  purpose: string | null;
  notes: string | null;
};

const TIMING_ORDER: Record<MedicationTiming, number> = {
  before: 0,
  during: 1,
  "as-needed": 2,
};

function clip(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : null;
}

function timingOf(value: unknown): MedicationTiming {
  if (typeof value !== "string") return "during";
  const text = value.trim().toLowerCase().replace(/[\s_]+/g, "-");
  if (text === "before" || text === "pre-trip") return "before";
  if (text === "as-needed" || text === "asneeded" || text === "prn" || text === "sos") {
    return "as-needed";
  }
  return "during";
}

export function medicationsFromModelJson(raw: unknown): ParsedMedication[] {
  if (!raw || typeof raw !== "object") return [];
  const list = (raw as { medications?: unknown }).medications;
  if (!Array.isArray(list)) return [];

  const medications: ParsedMedication[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const name = clip(row.name, 120);
    if (!name) continue;
    medications.push({
      name,
      dose: clip(row.dose, 80),
      form: clip(row.form, 40),
      schedule: clip(row.schedule, 160),
      timing: timingOf(row.timing),
      quantity: clip(row.quantity, 80),
      purpose: clip(row.purpose, 160),
      notes: clip(row.notes, 400),
    });
    if (medications.length >= MAX_MEDICATIONS) break;
  }

  return medications
    .map((medication, index) => ({ medication, index }))
    .sort((a, b) => {
      const rank = TIMING_ORDER[a.medication.timing] - TIMING_ORDER[b.medication.timing];
      return rank === 0 ? a.index - b.index : rank;
    })
    .map((entry) => entry.medication);
}

export async function prescriptionFromPdf(bytes: Uint8Array): Promise<ParsedMedication[]> {
  if (bytes.byteLength === 0 || bytes.byteLength > 8_000_000) throw new Error("bad-file");

  const raw = await readModelJson({
    instructions:
      "Read this medical prescription from a consulta do viajante, a travel-medicine visit. Return every medicine on the page. Copy names, doses, quantities, and instructions as printed. Do not translate them and do not add a medicine that is not on the page. Mark timing as before when it must start before departure, during when it is taken on a schedule while away, and as-needed when it is only if symptoms appear.",
    schema: SCHEMA,
    schemaName: "prescription",
    pdf: bytes,
    maxOutputTokens: 2048,
    timeoutMs: 25_000,
  });
  if (!raw) return [];
  return medicationsFromModelJson(raw);
}
