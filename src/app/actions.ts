"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  canonicalDestination,
  sameDestination,
  type StopDraft,
} from "@/lib/destinations";
import { flightsFromPdf, prepareFlights, staysFromFlights } from "@/lib/flights-from-pdf";
import { parseTicketText, type ParsedFlight } from "@/lib/parse-ticket";
import { textFromPdf } from "@/lib/read-pdf";
import { asTimestamp, blankToNull, supabase, type SegmentKind } from "@/lib/trips";

function fail(path: string, code: string): never {
  redirect(`${path}?error=${encodeURIComponent(code)}`);
}

function dateOrder(start: string | null, end: string | null) {
  if (start && end && end < start) return { start: end, end: start };
  return { start, end };
}

async function ensureDestinations(
  db: Awaited<ReturnType<typeof supabase>>,
  tripId: string,
  incoming: StopDraft[],
) {
  const { data: existing, error: readError } = await db
    .from("destinations")
    .select("id, name, position, starts_on, ends_on")
    .eq("trip_id", tripId)
    .order("position", { ascending: true });

  if (readError) return readError.message;

  const rows = existing ?? [];
  let next = rows.reduce((max, row) => Math.max(max, row.position), 0);

  for (const stop of incoming) {
    const label = canonicalDestination(stop.name);
    if (!label) continue;
    const match = rows.find((row) => sameDestination(row.name, label));
    if (match) {
      const startsOn = !match.starts_on || stop.startsOn < match.starts_on ? stop.startsOn : match.starts_on;
      const endsOn = !match.ends_on || stop.endsOn > match.ends_on ? stop.endsOn : match.ends_on;
      if (startsOn !== match.starts_on || endsOn !== match.ends_on) {
        const { error } = await db
          .from("destinations")
          .update({ starts_on: startsOn, ends_on: endsOn })
          .eq("id", match.id);
        if (error) return error.message;
        match.starts_on = startsOn;
        match.ends_on = endsOn;
      }
      continue;
    }
    next += 1;
    const { data, error } = await db
      .from("destinations")
      .insert({
        trip_id: tripId,
        name: label,
        position: next,
        starts_on: stop.startsOn,
        ends_on: stop.endsOn,
      })
      .select("id, name, position, starts_on, ends_on")
      .single();
    if (error || !data) return error?.message ?? "save";
    rows.push(data);
  }

  return null;
}

function dayOf(value: string | null) {
  return value ? value.slice(0, 10) : null;
}

function stopsFromSegments(
  segments: {
    startsAt: string | null;
    endsAt: string | null;
    origin: string | null;
    destination: string | null;
  }[],
): StopDraft[] {
  const sorted = [...segments].sort((a, b) =>
    (a.startsAt ?? "9999").localeCompare(b.startsAt ?? "9999"),
  );
  const byCity = new Map<string, StopDraft>();
  const order: string[] = [];

  function note(name: string | null, start: string | null, end: string | null) {
    if (!name || !start) return;
    const label = canonicalDestination(name);
    const key = label.toLowerCase();
    const finish = end && end >= start ? end : start;
    const current = byCity.get(key);
    if (!current) {
      order.push(key);
      byCity.set(key, { name: label, startsOn: start, endsOn: finish });
      return;
    }
    if (start < current.startsOn) current.startsOn = start;
    if (finish > current.endsOn) current.endsOn = finish;
  }

  for (const segment of sorted) {
    const start = dayOf(segment.startsAt);
    const end = dayOf(segment.endsAt) ?? start;
    note(segment.origin, start, start);
    if (segment.origin) note(segment.destination, end, end);
    else note(segment.destination, start, end);
  }

  return order
    .map((key) => byCity.get(key))
    .filter((stop): stop is StopDraft => Boolean(stop));
}

async function syncTripSpan(
  db: Awaited<ReturnType<typeof supabase>>,
  tripId: string,
) {
  const { data: stops } = await db
    .from("destinations")
    .select("starts_on, ends_on")
    .eq("trip_id", tripId);

  const starts = (stops ?? [])
    .map((stop) => stop.starts_on)
    .filter((day): day is string => Boolean(day))
    .sort();
  const ends = (stops ?? [])
    .map((stop) => stop.ends_on)
    .filter((day): day is string => Boolean(day))
    .sort();

  await db
    .from("trips")
    .update({
      start_date: starts[0] ?? null,
      end_date: ends[ends.length - 1] ?? null,
    })
    .eq("id", tripId);
}

export async function createTrip(formData: FormData) {
  const title = blankToNull(formData.get("title"));
  if (!title) fail("/", "title");

  const db = await supabase();
  const { data, error } = await db
    .from("trips")
    .insert({ title })
    .select("id")
    .single();

  if (error || !data) fail("/", "save");

  revalidatePath("/");
  redirect(`/trips/${data.id}`);
}

export async function addSegment(tripId: string, formData: FormData) {
  const path = `/trips/${tripId}`;
  const kind = blankToNull(formData.get("kind"));
  const title = blankToNull(formData.get("title"));
  if (kind !== "flight" && kind !== "stay" && kind !== "reservation") {
    fail(path, "save");
  }
  if (!title) fail(path, "segment-title");

  const times = dateOrder(
    asTimestamp(blankToNull(formData.get("starts_at"))),
    asTimestamp(blankToNull(formData.get("ends_at"))),
  );
  if (
    blankToNull(formData.get("starts_at")) &&
    blankToNull(formData.get("ends_at")) &&
    !times.start
  ) {
    fail(path, "dates");
  }

  const origin = blankToNull(formData.get("origin"));
  const destination = blankToNull(formData.get("destination"));
  const db = await supabase();
  const { error } = await db.from("segments").insert({
    trip_id: tripId,
    kind: kind as SegmentKind,
    title,
    starts_at: times.start,
    ends_at: times.end,
    origin: origin ? canonicalDestination(origin) : null,
    destination: destination ? canonicalDestination(destination) : null,
  });

  if (error) fail(path, "save");

  const destinationError = await ensureDestinations(
    db,
    tripId,
    stopsFromSegments([
      {
        startsAt: times.start,
        endsAt: times.end,
        origin,
        destination,
      },
    ]),
  );
  if (destinationError) fail(path, "save");

  await syncTripSpan(db, tripId);
  revalidatePath(path);
  revalidatePath("/");
  redirect(path);
}

export async function importTickets(tripId: string, formData: FormData) {
  const path = `/trips/${tripId}`;
  const files = formData
    .getAll("tickets")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (files.length === 0) fail(path, "ticket");
  if (
    files.some((file) => {
      const name = file.name.toLowerCase();
      return Boolean(file.type) && file.type !== "application/pdf" && !name.endsWith(".pdf");
    })
  ) {
    fail(path, "ticket");
  }

  const db = await supabase();
  const flights: {
    title: string;
    startsAt: string;
    endsAt: string;
    origin: string;
    destination: string;
    documentId: string;
  }[] = [];

  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const documentId = crypto.randomUUID();
    const storagePath = `${tripId}/${documentId}.pdf`;
    const filename = file.name.split(/[/\\]/).pop()?.trim() || "ticket.pdf";
    const { error: uploadError } = await db.storage
      .from("trip-documents")
      .upload(storagePath, bytes, { contentType: "application/pdf" });
    if (uploadError) fail(path, "save");

    const { error: documentError } = await db.from("documents").insert({
      id: documentId,
      trip_id: tripId,
      filename,
      storage_path: storagePath,
      content_type: "application/pdf",
    });
    if (documentError) {
      await db.storage.from("trip-documents").remove([storagePath]);
      fail(path, "save");
    }

    try {
      let read: { title: string; startsAt: string; endsAt: string; origin: string; destination: string }[] =
        [];
      try {
        read = await flightsFromPdf(bytes);
      } catch {
        // The model can be down or unconfigured. The text parser still covers a text PDF.
      }
      if (read.length === 0) read = parseTicketText(await textFromPdf(bytes));
      for (const flight of read) flights.push({ ...flight, documentId });
    } catch {
      continue;
    }
  }

  if (flights.length === 0) fail(path, "ticket");

  const { data: existingFlights, error: readFlightsError } = await db
    .from("segments")
    .select("id, title, starts_at, ends_at, origin, destination, document_id")
    .eq("trip_id", tripId)
    .eq("kind", "flight");
  if (readFlightsError) fail(path, "save");

  type StoredFlight = ParsedFlight & { id?: string; documentId?: string };
  const combined: StoredFlight[] = [
    ...(existingFlights ?? []).flatMap((row) => {
      if (!row.origin || !row.destination || !row.starts_at || !row.ends_at || !row.title) return [];
      return [
        {
          id: row.id,
          title: row.title,
          origin: row.origin,
          destination: row.destination,
          startsAt: row.starts_at,
          endsAt: row.ends_at,
          documentId: row.document_id ?? undefined,
        },
      ];
    }),
    ...flights,
  ];
  const prepared = prepareFlights(combined);
  const keptIds = new Set(prepared.flatMap((flight) => (flight.id ? [flight.id] : [])));
  const dropIds = (existingFlights ?? [])
    .map((row) => row.id)
    .filter((id) => !keptIds.has(id));

  if (dropIds.length > 0) {
    const { error: dropError } = await db.from("segments").delete().in("id", dropIds).eq("trip_id", tripId);
    if (dropError) fail(path, "save");
  }

  for (const flight of prepared) {
    if (!flight.id) continue;
    const { error: updateError } = await db
      .from("segments")
      .update({
        title: flight.title,
        origin: flight.origin,
        destination: flight.destination,
        starts_at: flight.startsAt,
        ends_at: flight.endsAt,
      })
      .eq("id", flight.id)
      .eq("trip_id", tripId);
    if (updateError) fail(path, "save");
  }

  const fresh = prepared.filter((flight) => !flight.id);
  if (fresh.length > 0) {
    const { error } = await db.from("segments").insert(
      fresh.map((flight) => ({
        trip_id: tripId,
        kind: "flight" as const,
        title: flight.title,
        starts_at: flight.startsAt,
        ends_at: flight.endsAt,
        origin: flight.origin,
        destination: flight.destination,
        document_id: flight.documentId ?? null,
      })),
    );
    if (error) fail(path, "save");
  }

  const { error: clearError } = await db.from("destinations").delete().eq("trip_id", tripId);
  if (clearError) fail(path, "save");

  const stays = staysFromFlights(prepared);
  if (stays.length > 0) {
    const { error: stayError } = await db.from("destinations").insert(
      stays.map((stop, index) => ({
        trip_id: tripId,
        name: stop.name,
        position: index + 1,
        starts_on: stop.startsOn,
        ends_on: stop.endsOn,
      })),
    );
    if (stayError) fail(path, "save");
  }

  await syncTripSpan(db, tripId);
  revalidatePath(path);
  revalidatePath("/");
  redirect(path);
}

export async function addDestination(tripId: string, formData: FormData) {
  const path = `/trips/${tripId}`;
  const name = blankToNull(formData.get("name"));
  const startsOn = blankToNull(formData.get("starts_on"));
  const endsOn = blankToNull(formData.get("ends_on"));
  if (!name || !startsOn || !endsOn) fail(path, "destination");
  if (endsOn < startsOn) fail(path, "dates");

  const db = await supabase();
  const { data: existing, error: readError } = await db
    .from("destinations")
    .select("position")
    .eq("trip_id", tripId)
    .order("position", { ascending: false })
    .limit(1);

  if (readError) fail(path, "save");

  const position = (existing?.[0]?.position ?? 0) + 1;
  const { error } = await db.from("destinations").insert({
    trip_id: tripId,
    name: canonicalDestination(name),
    position,
    starts_on: startsOn,
    ends_on: endsOn,
  });

  if (error) fail(path, "save");

  await syncTripSpan(db, tripId);
  revalidatePath(path);
  revalidatePath("/");
  redirect(path);
}

export async function deleteDestination(tripId: string, destinationId: string) {
  const db = await supabase();
  await db.from("destinations").delete().eq("id", destinationId).eq("trip_id", tripId);
  await syncTripSpan(db, tripId);
  revalidatePath(`/trips/${tripId}`);
  revalidatePath("/");
}

export async function deleteSegment(tripId: string, segmentId: string) {
  const db = await supabase();
  await db.from("segments").delete().eq("id", segmentId).eq("trip_id", tripId);
  revalidatePath(`/trips/${tripId}`);
  revalidatePath("/");
}
