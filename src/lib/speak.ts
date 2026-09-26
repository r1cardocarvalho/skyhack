import { readModelText } from "@/lib/azure";
import { languageForCity } from "@/lib/trip-language";
import { supabase } from "@/lib/trips";

const VOICE_FALLBACK = "LLluGmOlhlzoTb9Gaz1p";

export async function audioForMessage(
  tripId: string,
  messageId: string,
  requestedLanguage: string,
) {
  const db = await supabase();
  const { data: message, error } = await db
    .from("trip_messages")
    .select("content, role")
    .eq("id", messageId)
    .eq("trip_id", tripId)
    .maybeSingle();
  if (error) throw new Error("save");
  if (!message || message.role !== "assistant") throw new Error("missing-message");

  const spoken = await spokenText(db, tripId, message.content, requestedLanguage);
  return audioForText(spoken.text, spoken.language);
}

export async function audioForText(text: string, language: string) {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  if (!key) throw new Error("missing-key");
  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim() || VOICE_FALLBACK;
  const speech = plainSpeech(text);
  if (!speech) throw new Error("missing-message");

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": key,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({
        text: speech,
        model_id: "eleven_v3",
        language_code: language,
      }),
    },
  );

  if (!response.ok) {
    if (response.status === 401) throw new Error("missing-key");
    throw new Error("voice");
  }

  return new Uint8Array(await response.arrayBuffer());
}

async function spokenText(
  db: Awaited<ReturnType<typeof supabase>>,
  tripId: string,
  content: string,
  requestedLanguage: string,
) {
  const plain = plainSpeech(content);
  if (!plain) throw new Error("missing-message");

  const { data: stops } = await db
    .from("destinations")
    .select("name, starts_on, ends_on, position")
    .eq("trip_id", tripId)
    .order("position", { ascending: true });

  const tripStops = (stops ?? [])
    .filter((stop) => stop.name && stop.starts_on)
    .map((stop) => ({
      city: stop.name as string,
      arrives: stop.starts_on as string,
      leaves: stop.ends_on,
    }));
  const allowed = new Map([["en", { code: "en", name: "English" }]]);
  for (const stop of tripStops) {
      const language = languageForCity(stop.city);
      allowed.set(language.code, language);
  }

  const language = allowed.get(requestedLanguage);
  if (!language) throw new Error("invalid-language");

  if (language.code === "en") return { text: plain, language: "en" };

  const translated = await readModelText({
    instructions: `Rewrite the note in ${language.name}. Keep place names, flight numbers, medicine names, doses, and dates unchanged. Do not add facts. Plain spoken sentences. No markdown.`,
    messages: [{ role: "user", content: plain }],
    maxOutputTokens: 1500,
    timeoutMs: 30_000,
  });
  const text = plainSpeech(translated ?? "");
  if (!text) throw new Error("model");
  return { text, language: language.code };
}

function plainSpeech(value: string) {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_`#>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2500);
}
