import Link from "next/link";
import { createTrip } from "@/app/actions";
import { ErrorNote, Shell, buttonClass, fieldClass } from "@/components/shell";
import { formatDate, supabase } from "@/lib/trips";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error: errorCode } = await searchParams;
  const db = await supabase();
  const { data, error } = await db
    .from("trips")
    .select(
      "id, title, start_date, end_date, created_at, segments(id), destinations(name, position, starts_on, ends_on)",
    )
    .order("created_at", { ascending: false });

  return (
    <Shell>
      <header className="stack">
        <p className="kicker">Your trips</p>
        <h1 className="title">Where you are going</h1>
        <p className="lede">
          Name the trip. On the next page, add the stops yourself or upload the
          plane tickets.
        </p>
      </header>

      <ErrorNote code={errorCode} />

      {error ? (
        <p role="alert" className="alert">
          Could not load trips. {error.message}
        </p>
      ) : (
        <ul className="trip-list">
          {(data ?? []).length === 0 ? (
            <li className="empty">No trips yet.</li>
          ) : (
            data?.map((trip) => {
              const count = Array.isArray(trip.segments) ? trip.segments.length : 0;
              const route = routeOf(trip.destinations);
              return (
                <li key={trip.id}>
                  <Link href={`/trips/${trip.id}`} className="trip-card">
                    <span>
                      <strong>{trip.title}</strong>
                      <span className="place">{route || "No stops yet"}</span>
                    </span>
                    <span>
                      {count} {count === 1 ? "booking" : "bookings"}
                    </span>
                  </Link>
                </li>
              );
            })
          )}
        </ul>
      )}

      <form action={createTrip} className="panel">
        <h2>Create a trip</h2>
        <label className="field-label">
          Name
          <input name="title" required className={fieldClass} placeholder="September trip" />
        </label>
        <button type="submit" className={buttonClass}>
          Create trip
        </button>
      </form>
    </Shell>
  );
}

function routeOf(
  value: { name: string; position: number; starts_on: string | null; ends_on: string | null }[] | null,
) {
  if (!Array.isArray(value) || value.length === 0) return null;
  return [...value]
    .sort(byStart)
    .map((stop) => {
      const when = [formatDate(stop.starts_on), formatDate(stop.ends_on)]
        .filter(Boolean)
        .join("–");
      return when ? `${stop.name} ${when}` : stop.name;
    })
    .join(" → ");
}

function byStart(
  a: { starts_on: string | null; position: number },
  b: { starts_on: string | null; position: number },
) {
  const start = (a.starts_on ?? "9999").localeCompare(b.starts_on ?? "9999");
  if (start !== 0) return start;
  return a.position - b.position;
}
