export const maxDuration = 60;

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  if (!key) {
    return Response.json({ error: "missing-key" }, { status: 503 });
  }

  let audio: File | null = null;
  try {
    const incoming = await request.formData();
    const value = incoming.get("audio");
    audio = value instanceof File ? value : null;
  } catch {
    return Response.json({ error: "audio" }, { status: 400 });
  }

  if (!audio || audio.size === 0 || audio.size > MAX_AUDIO_BYTES) {
    return Response.json({ error: "audio" }, { status: 400 });
  }

  const form = new FormData();
  form.append("model_id", "scribe_v1");
  form.append("file", audio, audio.name || "recording.webm");
  form.append("tag_audio_events", "false");
  form.append("diarize", "false");

  try {
    const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": key },
      body: form,
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok) {
      return Response.json({ error: "transcription" }, { status: 502 });
    }

    const result = (await response.json()) as {
      text?: unknown;
      language_code?: unknown;
    };
    const text = typeof result.text === "string" ? result.text.trim().slice(0, 2000) : "";
    if (!text) {
      return Response.json({ error: "no-speech" }, { status: 422 });
    }

    return Response.json({
      text,
      language:
        typeof result.language_code === "string"
          ? normalizeLanguage(result.language_code)
          : null,
    });
  } catch {
    return Response.json({ error: "transcription" }, { status: 502 });
  }
}

const LANGUAGE_CODES: Record<string, string> = {
  ara: "ar",
  ces: "cs",
  dan: "da",
  deu: "de",
  ell: "el",
  eng: "en",
  fil: "fil",
  fin: "fi",
  fra: "fr",
  hin: "hi",
  hun: "hu",
  ind: "id",
  ita: "it",
  jpn: "ja",
  kor: "ko",
  msa: "ms",
  nld: "nl",
  nor: "no",
  pol: "pl",
  por: "pt",
  spa: "es",
  tam: "ta",
  tha: "th",
  tur: "tr",
  vie: "vi",
  zho: "zh",
};

function normalizeLanguage(value: string) {
  const code = value.trim().toLowerCase();
  return LANGUAGE_CODES[code] ?? code;
}
