import Link from "next/link";
import { notFound } from "next/navigation";
import { addDestination, addSegment, deleteDestination, deleteSegment, importTickets } from "@/app/actions";
import { CitySelect } from "@/components/city-select";
import { NextStopDates } from "@/components/next-stop-dates";
import { routeLabel } from "@/lib/destinations";
import { ErrorNote, Shell, buttonClass, fieldClass } from "@/components/shell";
import {
  dayKey,
  formatDay,
  formatDate,
  formatWhen,
  kindLabel,
  supabase,
  type Destination,
  type Segment,
  type TripDocument,
} from "@/lib/trips";

export const dynamic = "force-dynamic";

export default async function TripPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error: errorCode } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const db = await supabase();
  const { data: trip, error } = await db
    .from("trips")
    .select("id, title, start_date, end_date, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return (
      <Shell>
        <p role="alert" className="alert">
          Could not load this trip. {error.message}
        </p>
      </Shell>
    );
  }

  if (!trip) notFound();

  const { data: segments } = await db
    .from("segments")
    .select(
      "id, trip_id, kind, title, starts_at, ends_at, origin, destination, document_id, created_at",
    )
    .eq("trip_id", id)
    .order("starts_at", { ascending: true, nullsFirst: false });

  const { data: destinations } = await db
    .from("destinations")
    .select("id, trip_id, name, position, starts_on, ends_on")
    .eq("trip_id", id)
    .order("position", { ascending: true });

  const { data: documents } = await db
    .from("documents")
    .select("id, trip_id, filename, storage_path, content_type, created_at")
    .eq("trip_id", id)
    .order("created_at", { ascending: true });

  const files = (documents ?? []) as TripDocument[];
  const documentLinks = new Map<string, string>();
  await Promise.all(
    files.map(async (file) => {
      const { data } = await db.storage
        .from("trip-documents")
        .createSignedUrl(file.storage_path, 60 * 60);
      if (data?.signedUrl) documentLinks.set(file.id, data.signedUrl);
    }),
  );

  const stops = ((destinations ?? []) as Destination[]).sort(byStart);
  const groups = groupSegments((segments ?? []) as Segment[]);
  const when = [formatDate(trip.start_date), formatDate(trip.end_date)]
    .filter(Boolean)
    .join(" – ");
  const route = stops
    .map((stop) => {
      const when = [formatDate(stop.starts_on), formatDate(stop.ends_on)]
        .filter(Boolean)
        .join("–");
      return when ? `${stop.name} ${when}` : stop.name;
    })
    .join(" → ");

  return (
    <Shell>
      <header className="stack">
        <Link href="/" className="back">
          All trips
        </Link>
        <h1 className="title">{trip.title}</h1>
        <p className="meta">{route || "No stops yet"}</p>
        {when ? <p className="meta">{when}</p> : null}
      </header>

      <ErrorNote code={errorCode} />

      <form action={importTickets.bind(null, id)} className="panel">
        <h2>Upload plane tickets</h2>
        <p className="hint">
          Upload the PDF. Every flight is saved, including a connection. Stops are only the cities where you spend the night. The file stays on the trip.
        </p>
        <input
          name="tickets"
          type="file"
          accept="application/pdf,.pdf"
          multiple
          required
          className={fieldClass}
        />
        <button type="submit" className={buttonClass}>
          Import tickets
        </button>
        {files.length > 0 ? (
          <ul className="doc-list">
            {files.map((file) => {
              const href = documentLinks.get(file.id);
              return (
                <li key={file.id}>
                  {href ? (
                    <a href={href} className="doc-link" target="_blank" rel="noreferrer">
                      {file.filename}
                    </a>
                  ) : (
                    file.filename
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}
      </form>

      <section className="panel">
        <h2>Add stops by hand</h2>
        {stops.length === 0 ? (
          <p className="empty">Add the first city and the days you are there.</p>
        ) : (
          <ol className="trip-list">
            {stops.map((stop, index) => (
              <li key={stop.id} className="trip-card">
                <span>
                  {index > 0 ? <span className="route-arrow">→ </span> : null}
                  <strong>{stop.name}</strong>
                  <span className="place">
                    {[formatDate(stop.starts_on), formatDate(stop.ends_on)]
                      .filter(Boolean)
                      .join(" – ") || "Dates not set"}
                  </span>
                </span>
                <form action={deleteDestination.bind(null, id, stop.id)}>
                  <button type="submit" className="btn-quiet">
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ol>
        )}
        <form action={addDestination.bind(null, id)} className="stack">
          <div className="dates dates-3">
            <label className="field-label">
              City
              <CitySelect name="name" required />
            </label>
            <NextStopDates previousEnd={stops.at(-1)?.ends_on ?? null} />
          </div>
          <button type="submit" className={buttonClass}>
            Add stop
          </button>
        </form>
      </section>

      <section className="stack">
        <h2 className="section-title">Timeline</h2>
        {groups.length === 0 ? (
          <p className="empty">
            No bookings yet. Add one below.
          </p>
        ) : (
          <div className="days">
            {groups.map(([day, items]) => (
              <div key={day}>
                <h3 className="day-heading">{formatDay(day)}</h3>
                <ul className="rail">
                  {items.map((segment) => (
                    <SegmentRow
                      key={segment.id}
                      tripId={id}
                      segment={segment}
                      documentHref={
                        segment.document_id
                          ? documentLinks.get(segment.document_id)
                          : undefined
                      }
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <form action={addSegment.bind(null, id)} className="panel">
        <h2>Add a booking</h2>
        <label className="field-label">
          Kind
          <select name="kind" className={fieldClass} defaultValue="flight">
            <option value="flight">Flight</option>
            <option value="stay">Stay</option>
            <option value="reservation">Reservation</option>
          </select>
        </label>
        <label className="field-label">
          Name
          <input name="title" required className={fieldClass} placeholder="Flight TP 1324" />
        </label>
        <div className="dates">
          <label className="field-label">
            From
            <CitySelect name="origin" />
          </label>
          <label className="field-label">
            To
            <CitySelect name="destination" />
          </label>
        </div>
        <p className="hint">
          A flight uses both. A stay or reservation only needs To.
        </p>
        <div className="dates">
          <label className="field-label">
            Starts
            <input name="starts_at" type="datetime-local" className={fieldClass} />
          </label>
          <label className="field-label">
            Ends
            <input name="ends_at" type="datetime-local" className={fieldClass} />
          </label>
        </div>
        <button type="submit" className={buttonClass}>
          Add booking
        </button>
      </form>
    </Shell>
  );
}

function byStart(
  a: { starts_on: string | null; position: number },
  b: { starts_on: string | null; position: number },
) {
  const start = (a.starts_on ?? "9999").localeCompare(b.starts_on ?? "9999");
  if (start !== 0) return start;
  return a.position - b.position;
}

function groupSegments(segments: Segment[]) {
  const groups = new Map<string, Segment[]>();
  for (const segment of segments) {
    const key = dayKey(segment.starts_at);
    const items = groups.get(key) ?? [];
    items.push(segment);
    groups.set(key, items);
  }
  return [...groups.entries()];
}

function SegmentRow({
  tripId,
  segment,
  documentHref,
}: {
  tripId: string;
  segment: Segment;
  documentHref?: string;
}) {
  const start = formatWhen(segment.starts_at);
  const end = formatWhen(segment.ends_at);
  const endDay = dayKey(segment.ends_at);
  const until =
    endDay !== "unscheduled" && endDay !== dayKey(segment.starts_at)
      ? formatDay(endDay)
      : null;
  const route = routeLabel(segment.origin, segment.destination);
  const [depart, arrive] = [start, end];

  return (
    <li className={`segment segment-${segment.kind}`}>
      <p className="segment-time">
        {depart || "—"}
        {arrive ? <span>{arrive}</span> : null}
      </p>
      <div className="segment-body">
        <span className="chip">{kindLabel(segment.kind)}</span>
        <strong>{segment.title}</strong>
        {route ? <p className="place">{route}</p> : null}
        {until ? <p className="until">Until {until}</p> : null}
        {documentHref ? (
          <a href={documentHref} className="doc-link" target="_blank" rel="noreferrer">
            Original
          </a>
        ) : null}
      </div>
      <form action={deleteSegment.bind(null, tripId, segment.id)}>
        <button type="submit" className="btn-quiet">
          Remove
        </button>
      </form>
    </li>
  );
}
