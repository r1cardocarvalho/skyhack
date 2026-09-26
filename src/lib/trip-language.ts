const LANGUAGES: Record<string, { code: string; name: string }> = {
  "abu dhabi": { code: "ar", name: "Arabic" },
  amsterdam: { code: "nl", name: "Dutch" },
  athens: { code: "el", name: "Greek" },
  bali: { code: "id", name: "Indonesian" },
  bangkok: { code: "th", name: "Thai" },
  "bandar seri begawan": { code: "ms", name: "Malay" },
  barcelona: { code: "es", name: "Spanish" },
  beijing: { code: "zh", name: "Chinese" },
  bengaluru: { code: "hi", name: "Hindi" },
  berlin: { code: "de", name: "German" },
  "bogotá": { code: "es", name: "Spanish" },
  brussels: { code: "fr", name: "French" },
  budapest: { code: "hu", name: "Hungarian" },
  busan: { code: "ko", name: "Korean" },
  cebu: { code: "fil", name: "Filipino" },
  chengdu: { code: "zh", name: "Chinese" },
  chennai: { code: "ta", name: "Tamil" },
  "chiang mai": { code: "th", name: "Thai" },
  copenhagen: { code: "da", name: "Danish" },
  "da nang": { code: "vi", name: "Vietnamese" },
  delhi: { code: "hi", name: "Hindi" },
  dubai: { code: "ar", name: "Arabic" },
  florence: { code: "it", name: "Italian" },
  frankfurt: { code: "de", name: "German" },
  goa: { code: "hi", name: "Hindi" },
  guangzhou: { code: "zh", name: "Chinese" },
  hanoi: { code: "vi", name: "Vietnamese" },
  helsinki: { code: "fi", name: "Finnish" },
  "ho chi minh city": { code: "vi", name: "Vietnamese" },
  "hong kong": { code: "zh", name: "Chinese" },
  hyderabad: { code: "hi", name: "Hindi" },
  istanbul: { code: "tr", name: "Turkish" },
  jakarta: { code: "id", name: "Indonesian" },
  kaohsiung: { code: "zh", name: "Chinese" },
  kochi: { code: "hi", name: "Hindi" },
  kolkata: { code: "hi", name: "Hindi" },
  "kota kinabalu": { code: "ms", name: "Malay" },
  "koh samui": { code: "th", name: "Thai" },
  "kuala lumpur": { code: "ms", name: "Malay" },
  kunming: { code: "zh", name: "Chinese" },
  langkawi: { code: "ms", name: "Malay" },
  lima: { code: "es", name: "Spanish" },
  lisbon: { code: "pt", name: "Portuguese" },
  madrid: { code: "es", name: "Spanish" },
  manila: { code: "fil", name: "Filipino" },
  marrakech: { code: "ar", name: "Arabic" },
  "mexico city": { code: "es", name: "Spanish" },
  montreal: { code: "fr", name: "French" },
  mumbai: { code: "hi", name: "Hindi" },
  munich: { code: "de", name: "German" },
  naples: { code: "it", name: "Italian" },
  oslo: { code: "no", name: "Norwegian" },
  paris: { code: "fr", name: "French" },
  penang: { code: "ms", name: "Malay" },
  "phu quoc": { code: "vi", name: "Vietnamese" },
  phuket: { code: "th", name: "Thai" },
  porto: { code: "pt", name: "Portuguese" },
  prague: { code: "cs", name: "Czech" },
  "rio de janeiro": { code: "pt", name: "Portuguese" },
  rome: { code: "it", name: "Italian" },
  santiago: { code: "es", name: "Spanish" },
  seoul: { code: "ko", name: "Korean" },
  shanghai: { code: "zh", name: "Chinese" },
  shenzhen: { code: "zh", name: "Chinese" },
  surabaya: { code: "id", name: "Indonesian" },
  taipei: { code: "zh", name: "Chinese" },
  tokyo: { code: "ja", name: "Japanese" },
  venice: { code: "it", name: "Italian" },
  vienna: { code: "de", name: "German" },
  warsaw: { code: "pl", name: "Polish" },
  yogyakarta: { code: "id", name: "Indonesian" },
  zurich: { code: "de", name: "German" },
};

const ENGLISH = { code: "en", name: "English" };

const COUNTRY_WORDS: Record<string, string[]> = {
  ar: ["arabic"],
  de: ["german"],
  es: ["spanish"],
  fr: ["french"],
  id: ["indonesia", "indonesian"],
  it: ["italian"],
  ja: ["japanese"],
  ko: ["korean"],
  ms: ["malay", "malaysia"],
  pt: ["portuguese"],
  th: ["thailand", "thai"],
  vi: ["vietnam", "vietnamese"],
  zh: ["chinese"],
};

export type SpokenLanguage = { code: string; name: string };

export function languageForCity(city: string): SpokenLanguage {
  return LANGUAGES[city.trim().toLowerCase()] ?? ENGLISH;
}

export function languagesForCities(cities: string[]): SpokenLanguage[] {
  const languages = new Map<string, SpokenLanguage>([["en", ENGLISH]]);
  for (const city of cities) {
    const language = languageForCity(city);
    languages.set(language.code, language);
  }
  return [...languages.values()];
}

export function languageForTrip(
  stops: { city: string; arrives: string; leaves: string | null }[],
  text: string,
  today: string,
): SpokenLanguage {
  const mentioned = stops.find((stop) => mentionsStop(text, stop.city));
  const stop = mentioned ?? stopForDay(stops, today) ?? stops.at(-1);
  if (!stop) return ENGLISH;
  return languageForCity(stop.city);
}

function mentionsStop(text: string, city: string) {
  const haystack = text.toLowerCase();
  if (haystack.includes(city.toLowerCase())) return true;
  const words = COUNTRY_WORDS[languageForCity(city).code] ?? [];
  return words.some((word) => haystack.includes(word));
}

function stopForDay(
  stops: { city: string; arrives: string; leaves: string | null }[],
  today: string,
) {
  const current = stops.find(
    (stop) => stop.arrives <= today && (stop.leaves == null || stop.leaves >= today),
  );
  if (current) return current;
  return stops.find((stop) => stop.arrives > today) ?? null;
}
