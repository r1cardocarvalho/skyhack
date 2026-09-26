import { readModelText } from "@/lib/azure";
import { languagesForCities } from "@/lib/trip-language";
import { supabase } from "@/lib/trips";

export const maxDuration = 45;

export async function POST(request: Request) {
  let tripId = "";
  let text = "";
  let source = "";
  let target = "";
  try {
    const body = (await request.json()) as Record<string, unknown>;
    tripId = typeof body.tripId === "string" ? body.tripId : "";
    text = typeof body.text === "string" ? body.text.trim().slice(0, 3000) : "";
    source = typeof body.source === "string" ? body.source : "";
    target = typeof body.target === "string" ? body.target : "";
  } catch {
    return Response.json({ error: "request" }, { status: 400 });
  }

  if (!/^[0-9a-f-]{36}$/i.test(tripId) || !text) {
    return Response.json({ error: "request" }, { status: 400 });
  }

  const db = await supabase();
  const { data, error } = await db
    .from("destinations")
    .select("name")
    .eq("trip_id", tripId);
  if (error) return Response.json({ error: "trip" }, { status: 502 });

  const languages = new Map(
    languagesForCities((data ?? []).map((stop) => stop.name).filter(Boolean)).map(
      (language) => [language.code, language],
    ),
  );
  const sourceLanguage = languages.get(source);
  const targetLanguage = languages.get(target);
  if (!sourceLanguage || !targetLanguage) {
    return Response.json({ error: "language" }, { status: 400 });
  }

  if (source === target) {
    return Response.json({ text });
  }

  try {
    const translated = await readModelText({
      instructions: `Translate from ${sourceLanguage.name} to ${targetLanguage.name}. Return only the translation, with no explanation, labels, quotation marks, or markdown. Preserve names, numbers, dates, addresses, medicine names, and flight numbers exactly. Keep the original meaning and tone.`,
      messages: [{ role: "user", content: text }],
      maxOutputTokens: 2000,
      timeoutMs: 30_000,
    });
    const clean = translated?.trim().slice(0, 5000);
    if (!clean) throw new Error("model");
    return Response.json({ text: clean });
  } catch (error) {
    const code = error instanceof Error ? error.message : "model";
    const status = code === "quota" ? 429 : code === "missing-key" ? 503 : 502;
    return Response.json({ error: code }, { status });
  }
}
