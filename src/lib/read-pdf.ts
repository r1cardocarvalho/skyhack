import { extractText, getDocumentProxy } from "unpdf";

export async function textFromPdf(bytes: Uint8Array) {
  // PDF.js may transfer and detach its input buffer. Keep the caller's bytes
  // intact so the same upload can still be sent to the model afterwards.
  const pdf = await getDocumentProxy(bytes.slice());
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}
