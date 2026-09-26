import Image from "next/image";
import Link from "next/link";
import { createTrip } from "@/app/actions";
import { Icon } from "@/components/icons";
import { ErrorNote, Shell, buttonClass, fieldClass } from "@/components/shell";
import { formatStay, supabase } from "@/lib/trips";

export const dynamic = "force-dynamic";

type Stop = { name: string; position: number; starts_on: string | null; ends_on: string | null };

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

  const trips = data ?? [];

  return (
    <Shell>
      <section className="hero">
        <div className="hero-copy">
          <p className="kicker">Your trips</p>
          <h1 className="title">
            Your trip.
            <br />
            All together.
          </h1>
          <p className="lede">
            Name the trip. On the next page, add the stops yourself or upload the plane tickets.
            Flights, stays and plans in one place.
          </p>
          <form action={createTrip} className="hero-form">
            <input
              name="title"
              required
              aria-label="Trip name"
              className={fieldClass}
              placeholder="Name your trip, e.g. Lisbon weekend"
            />
            <button type="submit" className={buttonClass}>
              <Icon name="plus" size={16} />
              Create trip
            </button>
          </form>
          <ErrorNote code={errorCode} />
          <ul className="hero-points">
            <li>
              <Icon name="ticket" size={16} />
              Bookings
            </li>
            <li>
              <Icon name="medical" size={16} />
              Medical
            </li>
            <li>
              <Icon name="globe" size={16} />
              Briefings
            </li>
            <li>
              <Icon name="sim" size={16} />
              SIM
            </li>
          </ul>
        </div>
        <div className="hero-media">
          <Image
            src="/brand/hero.jpg"
            alt="A traveler checking her trip on her phone at the airport"
            fill
            priority
            sizes="(max-width: 860px) 100vw, 50vw"
          />
        </div>
      </section>

      {error ? (
        <p role="alert" className="alert">
          Could not load trips. {error.message}
        </p>
      ) : (
        <section className="stack">
          <div className="section-head">
            <h2 className="section-title">Where you are going</h2>
            {trips.length > 0 ? (
              <span className="count">
                {trips.length} {trips.length === 1 ? "trip" : "trips"}
              </span>
            ) : null}
          </div>
          {trips.length === 0 ? (
            <div className="empty-state">
              <span className="icon-tile">
                <Icon name="plane" size={22} />
              </span>
              <strong>No trips yet</strong>
              <p>Name your first trip above to get started.</p>
            </div>
          ) : (
            <ul className="trip-grid">
              {trips.map((trip) => {
                const count = Array.isArray(trip.segments) ? trip.segments.length : 0;
                const stops = sortedStops(trip.destinations);
                const route = stops.map((stop) => stop.name).join(" → ");
                const when = formatStay(
                  stops[0]?.starts_on ?? trip.start_date,
                  stops.at(-1)?.ends_on ?? trip.end_date,
                );
                return (
                  <li key={trip.id}>
                    <Link href={`/trips/${trip.id}`} className="trip-tile">
                      <div className="trip-tile-head">
                        <span className="icon-tile">
                          <Icon name="plane" size={22} />
                        </span>
                        <span className="trip-tile-text">
                          <strong>{trip.title}</strong>
                          <span className="place">{when ?? "Dates not set"}</span>
                        </span>
                        <span className={count > 0 ? "pill pill-accent" : "pill"}>
                          {count} {count === 1 ? "booking" : "bookings"}
                        </span>
                      </div>
                      <span className="trip-tile-route">{route || "No stops yet"}</span>
                      <span className={buttonClass}>View trip</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </Shell>
  );
}

function sortedStops(value: Stop[] | null) {
  if (!Array.isArray(value)) return [];
  return [...value].sort(byStart);
}

function byStart(
  a: { starts_on: string | null; position: number },
  b: { starts_on: string | null; position: number },
) {
  const start = (a.starts_on ?? "9999").localeCompare(b.starts_on ?? "9999");
  if (start !== 0) return start;
  return a.position - b.position;
}
