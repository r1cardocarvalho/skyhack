import { audioForMessage } from "@/lib/speak";

export const maxDuration = 60;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return Response.json({ error: "trip" }, { status: 404 });
  }

  let messageId = "";
  let language = "";
  try {
    const body = (await request.json()) as { messageId?: unknown; language?: unknown };
    messageId = typeof body.messageId === "string" ? body.messageId : "";
    language = typeof body.language === "string" ? body.language : "";
  } catch {
    return Response.json({ error: "message" }, { status: 400 });
  }
  if (!/^[0-9a-f-]{36}$/i.test(messageId)) {
    return Response.json({ error: "message" }, { status: 400 });
  }
  if (!/^[a-z]{2,3}$/.test(language)) {
    return Response.json({ error: "language" }, { status: 400 });
  }

  try {
    const audio = await audioForMessage(id, messageId, language);
    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "voice";
    const status = code === "missing-message" ? 404 : code === "missing-key" ? 503 : 502;
    return Response.json({ error: code }, { status });
  }
}
