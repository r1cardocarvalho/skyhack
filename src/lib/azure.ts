const ENDPOINT = "https://unbubdev-resource.services.ai.azure.com/openai/v1/responses";

type Schema = Record<string, unknown>;

export async function readModelJson(options: {
  instructions: string;
  schema: Schema;
  schemaName: string;
  pdf?: Uint8Array;
  maxOutputTokens: number;
  timeoutMs: number;
  search?: boolean | { allowedDomains: string[] };
}): Promise<unknown | null> {
  const key = process.env.AZURE_OPENAI_API_KEY?.trim();
  if (!key) throw new Error("missing-key");
  const model = process.env.AZURE_OPENAI_MODEL?.trim() || "gpt-5.6-terra";

  const content: Array<Record<string, string>> = [
    { type: "input_text", text: options.instructions },
  ];
  if (options.pdf) {
    content.push({
      type: "input_file",
      filename: "upload.pdf",
      file_data: `data:application/pdf;base64,${Buffer.from(options.pdf).toString("base64")}`,
    });
  }

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": key,
    },
    signal: AbortSignal.timeout(options.timeoutMs),
    body: JSON.stringify({
      model,
      input: [{ role: "user", content }],
      max_output_tokens: options.maxOutputTokens,
      ...(options.search
        ? {
            tools: [
              {
                type: "web_search",
                search_context_size: "high",
                ...(typeof options.search === "object"
                  ? { filters: { allowed_domains: options.search.allowedDomains } }
                  : {}),
              },
            ],
            tool_choice: { type: "web_search" },
          }
        : {}),
      text: {
        format: {
          type: "json_schema",
          name: options.schemaName,
          schema: options.schema,
          strict: false,
        },
      },
    }),
  });

  if (!response.ok) {
    if (response.status === 429) throw new Error("quota");
    throw new Error("model");
  }

  const payload = (await response.json()) as {
    output_text?: string;
    output?: { content?: { text?: string }[] }[];
  };
  const fromParts = (payload.output ?? [])
    .flatMap((item) => item.content ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();
  const text = payload.output_text?.trim() || fromParts;
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse((fenced?.[1] ?? text).trim()) as unknown;
}

export async function readModelText(options: {
  instructions: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxOutputTokens: number;
  timeoutMs: number;
  search?: boolean;
}): Promise<string | null> {
  const key = process.env.AZURE_OPENAI_API_KEY?.trim();
  if (!key) throw new Error("missing-key");
  const model = process.env.AZURE_OPENAI_MODEL?.trim() || "gpt-5.6-terra";

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": key,
    },
    signal: AbortSignal.timeout(options.timeoutMs),
    body: JSON.stringify({
      model,
      instructions: options.instructions,
      input: options.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      max_output_tokens: options.maxOutputTokens,
      ...(options.search
        ? {
            tools: [{ type: "web_search", search_context_size: "high" }],
          }
        : {}),
    }),
  });

  if (!response.ok) {
    if (response.status === 429) throw new Error("quota");
    throw new Error("model");
  }

  const payload = (await response.json()) as {
    output_text?: string;
    output?: { content?: { text?: string }[] }[];
  };
  const fromParts = (payload.output ?? [])
    .flatMap((item) => item.content ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();
  const text = payload.output_text?.trim() || fromParts;
  return text || null;
}
