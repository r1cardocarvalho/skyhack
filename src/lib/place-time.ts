export type PlaceClock = {
  city: string;
  timeZone: string;
  time: string;
  offset: string;
};

type GeoPlace = {
  name?: string;
  country_code?: string;
  latitude: number;
  longitude: number;
  population?: number;
  timezone?: string;
};

type GeoResult = {
  results?: GeoPlace[];
};

type ZoneResult = {
  timeZone?: string;
  currentLocalTime?: string;
  currentUtcOffset?: { seconds?: number };
};

function offsetLabel(seconds: number) {
  const sign = seconds >= 0 ? "+" : "−";
  const abs = Math.abs(seconds);
  const hours = Math.floor(abs / 3600);
  const minutes = Math.floor((abs % 3600) / 60);
  const minuteText = minutes ? `:${String(minutes).padStart(2, "0")}` : "";
  return `UTC${sign}${hours}${minuteText}`;
}

function fold(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function bestPlace(city: string, results: GeoPlace[]) {
  const wanted = fold(city);
  const named = results.filter((place) => fold(place.name ?? "") === wanted);
  const pool = named.length > 0 ? named : results;
  return pool.reduce((best, place) =>
    (place.population ?? 0) > (best.population ?? 0) ? place : best,
  );
}

function zoneName(place: GeoPlace, fromApi: string) {
  if (place.country_code === "VN" && fromApi === "Asia/Bangkok") return "Asia/Ho_Chi_Minh";
  return place.timezone || fromApi;
}

async function clockForCity(city: string): Promise<PlaceClock | null> {
  const geoResponse = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=5&language=en&format=json`,
    { signal: AbortSignal.timeout(8000), cache: "no-store" },
  );
  if (!geoResponse.ok) return null;
  const geo = (await geoResponse.json()) as GeoResult;
  const results = geo.results ?? [];
  if (results.length === 0) return null;
  const place = bestPlace(city, results);

  const zoneResponse = await fetch(
    `https://timeapi.io/api/timezone/coordinate?latitude=${place.latitude}&longitude=${place.longitude}`,
    { signal: AbortSignal.timeout(8000), cache: "no-store" },
  );
  if (!zoneResponse.ok) return null;
  const zone = (await zoneResponse.json()) as ZoneResult;
  const time = zone.currentLocalTime?.match(/T(\d{2}:\d{2})/)?.[1];
  if (!zone.timeZone || !time || typeof zone.currentUtcOffset?.seconds !== "number") return null;

  return {
    city,
    timeZone: zoneName(place, zone.timeZone),
    time,
    offset: offsetLabel(zone.currentUtcOffset.seconds),
  };
}

export async function clocksForCities(cities: string[]) {
  const unique = [...new Set(cities.map((city) => city.trim()).filter(Boolean))];
  const clocks = await Promise.all(unique.map((city) => clockForCity(city).catch(() => null)));
  return clocks.filter((clock): clock is PlaceClock => Boolean(clock));
}
