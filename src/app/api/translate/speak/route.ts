import { audioForText } from "@/lib/speak";
import { languagesForCities } from "@/lib/trip-language";
import { supabase } from "@/lib/trips";

export const maxDuration = 60;

export async function POST(request: Request) {
  let tripId = "";
  let text = "";
  let language = "";
  try {
    const body = (await request.json()) as Record<string, unknown>;
    tripId = typeof body.tripId === "string" ? body.tripId : "";
    text = typeof body.text === "string" ? body.text.trim().slice(0, 3000) : "";
    language = typeof body.language === "string" ? body.language : "";
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

  const allowed = languagesForCities(
    (data ?? []).map((stop) => stop.name).filter(Boolean),
  ).some((item) => item.code === language);
  if (!allowed) return Response.json({ error: "language" }, { status: 400 });

  try {
    const audio = await audioForText(text, language);
    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "voice";
    const status = code === "missing-key" ? 503 : 502;
    return Response.json({ error: code }, { status });
  }
}
