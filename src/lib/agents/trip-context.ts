import { supabase } from "@/lib/trips";

export type TripStop = {
  city: string;
  arrives: string;
  leaves: string | null;
};

export type TripContext = {
  tripId: string;
  stops: TripStop[];
};

export async function loadTrip(tripId: string): Promise<TripContext | null> {
  const db = await supabase();
  const { data, error } = await db
    .from("destinations")
    .select("name, starts_on, ends_on, position")
    .eq("trip_id", tripId);

  if (error || !data) return null;

  const stops = data
    .filter((row) => row.name && row.starts_on)
    .sort(byStart)
    .map((row) => ({
      city: row.name,
      arrives: row.starts_on as string,
      leaves: row.ends_on,
    }));

  return { tripId, stops };
}

export type TripFlight = {
  title: string;
  origin: string;
  destination: string;
  departs: string;
  arrives: string;
};

export async function loadFlights(tripId: string): Promise<TripFlight[]> {
  const db = await supabase();
  const { data, error } = await db
    .from("segments")
    .select("title, starts_at, ends_at, origin, destination")
    .eq("trip_id", tripId)
    .eq("kind", "flight")
    .order("starts_at", { ascending: true, nullsFirst: false });

  if (error || !data) return [];
  return data.flatMap((row) => {
    if (!row.title || !row.origin || !row.destination || !row.starts_at) return [];
    return [
      {
        title: row.title,
        origin: row.origin,
        destination: row.destination,
        departs: row.starts_at,
        arrives: row.ends_at ?? "",
      },
    ];
  });
}

export async function loadFlightLines(tripId: string): Promise<string[]> {
  const db = await supabase();
  const { data, error } = await db
    .from("segments")
    .select("title, starts_at, ends_at, origin, destination")
    .eq("trip_id", tripId)
    .eq("kind", "flight")
    .order("starts_at", { ascending: true, nullsFirst: false });

  if (error || !data) return [];
  return data.map((row) => {
    const route = [row.origin, row.destination].filter(Boolean).join(" → ");
    const when = [row.starts_at, row.ends_at].filter(Boolean).join(" to ");
    return [row.title, route, when].filter(Boolean).join(", ");
  });
}

function byStart(
  a: { starts_on: string | null; position: number },
  b: { starts_on: string | null; position: number },
) {
  const start = (a.starts_on ?? "9999").localeCompare(b.starts_on ?? "9999");
  if (start !== 0) return start;
  return a.position - b.position;
}
