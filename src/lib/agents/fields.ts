const SHORTENERS = new Set(["bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly"]);

export function text(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

export function httpsLink(value: unknown) {
  if (typeof value !== "string") return null;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^www\./, "");
  if (SHORTENERS.has(host)) return null;
  return url.toString();
}

export function citiesOf(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((city) => {
    const name = text(city, 60);
    return name ? [name] : [];
  });
}
