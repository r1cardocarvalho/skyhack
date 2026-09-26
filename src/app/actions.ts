"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  canonicalDestination,
  sameDestination,
  type StopDraft,
} from "@/lib/destinations";
import { bookingFromPdf, httpUrl } from "@/lib/booking-from-pdf";
import { flightsFromPdf, pinFlightYears, prepareFlights, staysFromFlights } from "@/lib/flights-from-pdf";
import { parseTicketText, type ParsedFlight } from "@/lib/parse-ticket";
import { insuranceFromPdf } from "@/lib/insurance-from-pdf";
import { prescriptionFromPdf } from "@/lib/prescription-from-pdf";
import { textFromPdf } from "@/lib/read-pdf";
import { briefTrip } from "@/lib/agents/briefing";
import { replyOnTrip } from "@/lib/agents/chat";
import { chargersAgent } from "@/lib/agents/chargers";
import { prepareTrip } from "@/lib/agents/prepare-trip";
import { saveBrief } from "@/lib/agents/save-brief";
import { ridesAgent } from "@/lib/agents/rides";
import { scamsAgent } from "@/lib/agents/scams";
import { terminalsAgent } from "@/lib/agents/terminals";
import { loadFlightLines, loadFlights, loadTrip } from "@/lib/agents/trip-context";
import { neededOf, visaAgent, type VisaBrief } from "@/lib/agents/visa";
import { asTimestamp, blankToNull, supabase, type SegmentKind } from "@/lib/trips";
import { visaFromPdf } from "@/lib/visa-from-pdf";

function fail(path: string, code: string): never {
  const join = path.includes("?") ? "&" : "?";
  redirect(`${path}${join}error=${encodeURIComponent(code)}`);
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
      const endsOn =
        stop.endsOn == null
          ? match.ends_on
          : !match.ends_on || stop.endsOn > match.ends_on
            ? stop.endsOn
            : match.ends_on;
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
    if (current.endsOn == null || finish > current.endsOn) current.endsOn = finish;
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
  const latestStart = starts[starts.length - 1];
  const stillThere = (stops ?? []).some((stop) => stop.starts_on === latestStart && !stop.ends_on);

  await db
    .from("trips")
    .update({
      start_date: starts[0] ?? null,
      end_date: stillThere ? null : (ends[ends.length - 1] ?? null),
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

export async function briefDestination(tripId: string) {
  const path = `/trips/${tripId}`;
  try {
    await briefTrip(tripId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "no-stops") fail(path, "brief-stops");
    if (message === "quota") fail(path, "brief-quota");
    fail(path, "brief");
  }
  revalidatePath(`/trips/${tripId}`);
  redirect(path);
}

export async function startChat(tripId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(tripId)) redirect("/");
  const path = `/trips/${tripId}?tab=chat`;
  const db = await supabase();
  const { data, error } = await db
    .from("trip_chats")
    .insert({ trip_id: tripId, title: "New chat" })
    .select("id")
    .single();
  if (error || !data) fail(path, "chat");
  revalidatePath(`/trips/${tripId}`);
  redirect(`${path}&chat=${data.id}`);
}

export async function askTrip(formData: FormData) {
  const tripId = String(formData.get("tripId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(tripId)) redirect("/");
  const message = String(formData.get("message") ?? "").trim().slice(0, 2000);
  let chatId = String(formData.get("chatId") ?? "");
  if (!message) {
    const path = chatPath(tripId, chatId);
    redirect(path);
  }

  if (!/^[0-9a-f-]{36}$/i.test(chatId)) {
    const db = await supabase();
    const { data, error } = await db
      .from("trip_chats")
      .insert({ trip_id: tripId, title: "New chat" })
      .select("id")
      .single();
    if (error || !data) fail(`/trips/${tripId}?tab=chat`, "chat");
    chatId = data.id;
  }

  const path = chatPath(tripId, chatId);
  try {
    await replyOnTrip(tripId, chatId, message);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "quota") fail(path, "chat-quota");
    if (code === "missing-key") fail(path, "chat-key");
    fail(path, "chat");
  }

  revalidatePath(`/trips/${tripId}`);
  redirect(path);
}

function chatPath(tripId: string, chatId: string) {
  const path = `/trips/${tripId}?tab=chat`;
  return /^[0-9a-f-]{36}$/i.test(chatId) ? `${path}&chat=${chatId}` : path;
}

export async function connectChannels(tripId: string, formData: FormData) {
  const requested = String(formData.get("return_tab") ?? "");
  const stay = ["stays", "bookings", "medical", "insurance", "visa", "sim", "chat", "translator"].includes(requested);
  const path = stay ? `/trips/${tripId}?tab=${requested}` : `/trips/${tripId}`;
  const whatsappRaw = String(formData.get("whatsapp") ?? "").trim();
  const telegramRaw = String(formData.get("telegram") ?? "").trim();
  if (!whatsappRaw && !telegramRaw) fail(path, "channel");

  const whatsapp = whatsappRaw ? phoneOf(whatsappRaw) : null;
  if (whatsappRaw && !whatsapp) fail(path, "whatsapp");
  const telegram = telegramRaw ? telegramOf(telegramRaw) : null;
  if (telegramRaw && !telegram) fail(path, "telegram");

  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) fail(path, "auth");

  const { error } = await db.from("user_profile").update({ whatsapp, telegram }).eq("id", user.id);
  if (error) fail(path, "save");

  revalidatePath(`/trips/${tripId}`);
  redirect(path);
}

function phoneOf(value: string) {
  const compact = value.replace(/[\s()-]/g, "");
  if (!/^\+?[0-9]{8,15}$/.test(compact)) return null;
  return compact.startsWith("+") ? compact : `+${compact}`;
}

function telegramOf(value: string) {
  const compact = value.replace(/\s/g, "");
  if (compact.startsWith("+") || /^[0-9]/.test(compact)) return phoneOf(compact);
  const handle = compact.replace(/^@/, "");
  if (!/^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(handle)) return null;
  return `@${handle}`;
}

export async function findSim(tripId: string) {
  const path = `/trips/${tripId}?tab=sim&agent=sim`;
  try {
    await prepareTrip(tripId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "no-stops") fail(path, "stops");
    if (message === "quota") fail(path, "quota");
    fail(path, "sim");
  }
  revalidatePath(`/trips/${tripId}`);
  redirect(path);
}

export async function findVisa(tripId: string, formData: FormData) {
  const path = `/trips/${tripId}?tab=visa`;
  const passport = String(formData.get("passport") ?? "").trim().slice(0, 60);
  if (passport.length < 2) fail(path, "passport");

  try {
    const trip = await loadTrip(tripId);
    if (!trip) throw new Error("missing-trip");
    if (trip.stops.length === 0) throw new Error("no-stops");
    const brief = await visaAgent(trip, passport, await loadFlightLines(tripId));
    await saveBrief(tripId, "visa", brief);
    await saveVisaEntries(tripId, brief);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "no-stops") fail(path, "visa-stops");
    if (message === "quota") fail(path, "visa-quota");
    if (message === "save") fail(path, "save");
    fail(path, "visa");
  }
  revalidatePath(`/trips/${tripId}`);
  redirect(path);
}

async function saveVisaEntries(tripId: string, brief: VisaBrief) {
  const db = await supabase();
  const { data: existing, error } = await db
    .from("visa_entries")
    .select("id, country, document_id")
    .eq("trip_id", tripId);
  if (error) throw new Error("save");

  const kept = new Set<string>();
  for (const [index, place] of brief.places.entries()) {
    const match = (existing ?? []).find(
      (row) => row.country.trim().toLowerCase() === place.country.trim().toLowerCase(),
    );
    const fields = {
      country: place.country,
      cities: place.cities,
      dates: place.dates,
      needed: neededOf(place.requirement),
      requirement: place.requirement,
      stay: place.stay,
      passport_rule: place.passportRule,
      forms: place.forms,
      next_step: place.next,
      source: place.source,
      source_href: place.href,
      passport: brief.passport,
      position: index,
    };
    if (match) {
      kept.add(match.id);
      const { error: updateError } = await db.from("visa_entries").update(fields).eq("id", match.id);
      if (updateError) throw new Error("save");
      continue;
    }
    const { data, error: insertError } = await db
      .from("visa_entries")
      .insert({ trip_id: tripId, ...fields })
      .select("id")
      .single();
    if (insertError || !data) throw new Error("save");
    kept.add(data.id);
  }

  const stale = (existing ?? []).filter((row) => !kept.has(row.id) && !row.document_id).map((row) => row.id);
  if (stale.length === 0) return;
  const { error: deleteError } = await db.from("visa_entries").delete().in("id", stale);
  if (deleteError) throw new Error("save");
}

export async function findTerminals(tripId: string) {
  const path = `/trips/${tripId}?tab=sim&agent=terminals`;
  try {
    const flights = await loadFlights(tripId);
    if (flights.length === 0) throw new Error("no-flights");
    const brief = await terminalsAgent(flights);
    await saveBrief(tripId, "terminals", brief);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "no-flights") fail(path, "terminals-flights");
    if (message === "quota") fail(path, "terminals-quota");
    if (message === "save") fail(path, "save");
    fail(path, "terminals");
  }
  revalidatePath(`/trips/${tripId}`);
  redirect(path);
}

export async function findRides(tripId: string) {
  const path = `/trips/${tripId}?tab=sim&agent=rides`;
  try {
    const trip = await loadTrip(tripId);
    if (!trip) throw new Error("missing-trip");
    if (trip.stops.length === 0) throw new Error("no-stops");
    const brief = await ridesAgent(trip, await loadFlightLines(tripId));
    await saveBrief(tripId, "rides", brief);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "no-stops") fail(path, "rides-stops");
    if (message === "quota") fail(path, "rides-quota");
    if (message === "save") fail(path, "save");
    fail(path, "rides");
  }
  revalidatePath(`/trips/${tripId}`);
  redirect(path);
}

export async function findScams(tripId: string) {
  const path = `/trips/${tripId}?tab=sim&agent=scams`;
  try {
    const trip = await loadTrip(tripId);
    if (!trip) throw new Error("missing-trip");
    if (trip.stops.length === 0) throw new Error("no-stops");
    const brief = await scamsAgent(trip);
    await saveBrief(tripId, "scams", brief);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "no-stops") fail(path, "scams-stops");
    if (message === "quota") fail(path, "scams-quota");
    if (message === "save") fail(path, "save");
    fail(path, "scams");
  }
  revalidatePath(`/trips/${tripId}`);
  redirect(path);
}

export async function findChargers(tripId: string) {
  const path = `/trips/${tripId}?tab=sim&agent=chargers`;
  try {
    const trip = await loadTrip(tripId);
    if (!trip) throw new Error("missing-trip");
    if (trip.stops.length === 0) throw new Error("no-stops");
    const brief = await chargersAgent(trip);
    await saveBrief(tripId, "chargers", brief);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "no-stops") fail(path, "chargers-stops");
    if (message === "quota") fail(path, "chargers-quota");
    if (message === "save") fail(path, "save");
    fail(path, "chargers");
  }
  revalidatePath(`/trips/${tripId}`);
  redirect(path);
}

export async function addSegment(tripId: string, formData: FormData) {
  const kind = blankToNull(formData.get("kind"));
  const tab = kind === "stay" ? "stays" : kind === "reservation" ? "bookings" : "planes";
  const path = tab === "planes" ? `/trips/${tripId}` : `/trips/${tripId}?tab=${tab}`;
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
  const url = httpUrl(blankToNull(formData.get("url")));
  const db = await supabase();
  const { error } = await db.from("segments").insert({
    trip_id: tripId,
    kind: kind as SegmentKind,
    title,
    starts_at: times.start,
    ends_at: times.end,
    origin: origin ? canonicalDestination(origin) : null,
    destination: destination ? canonicalDestination(destination) : null,
    url,
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

export async function importBooking(tripId: string, formData: FormData) {
  const forceStay = formData.get("kind") === "stay";
  const path = forceStay ? `/trips/${tripId}?tab=stays` : `/trips/${tripId}?tab=bookings`;
  const files = formData
    .getAll("booking")
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
  const bookings: {
    title: string;
    kind: "stay" | "reservation";
    destination: string | null;
    startsAt: string | null;
    endsAt: string | null;
    url: string | null;
    documentId: string;
  }[] = [];

  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const documentId = crypto.randomUUID();
    const storagePath = `${tripId}/${documentId}.pdf`;
    const filename = file.name.split(/[/\\]/).pop()?.trim() || "booking.pdf";
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
      kind: "booking",
    });
    if (documentError) {
      await db.storage.from("trip-documents").remove([storagePath]);
      fail(path, "save");
    }

    try {
      const read = await bookingFromPdf(bytes, forceStay ? "stay" : undefined);
      if (!read) continue;
      bookings.push({ ...read, documentId });
    } catch {
      continue;
    }
  }

  if (bookings.length === 0) fail(path, "ticket");

  const { error } = await db.from("segments").insert(
    bookings.map((booking) => ({
      trip_id: tripId,
      kind: booking.kind,
      title: booking.title,
      starts_at: booking.startsAt,
      ends_at: booking.endsAt,
      destination: booking.destination,
      url: booking.url,
      document_id: booking.documentId,
    })),
  );
  if (error) fail(path, "save");

  revalidatePath(`/trips/${tripId}`);
  revalidatePath("/");
  if (forceStay) redirect(path);
  const tab = bookings.every((booking) => booking.kind === "stay") ? "stays" : "bookings";
  redirect(tab === "stays" ? `/trips/${tripId}?tab=stays` : path);
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
  const { data: savedDocuments, error: documentsError } = await db
    .from("documents")
    .select("id, filename")
    .eq("trip_id", tripId)
    .eq("kind", "ticket");
  if (documentsError) fail(path, "save");
  const documentsByName = new Map(
    (savedDocuments ?? []).map((document) => [document.filename.toLowerCase(), document.id]),
  );

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
    const filename = file.name.split(/[/\\]/).pop()?.trim() || "ticket.pdf";
    let read: { title: string; startsAt: string; endsAt: string; origin: string; destination: string }[] =
      [];
    try {
      let text = "";
      try {
        text = await textFromPdf(bytes);
      } catch {
        text = "";
      }
      try {
        read = await flightsFromPdf(bytes);
      } catch {
        // The model can be down or unconfigured. The text parser still covers a text PDF.
      }
      if (read.length === 0 && text) read = parseTicketText(text);
      else if (text) read = pinFlightYears(read, text);
    } catch {
      continue;
    }
    if (read.length === 0) continue;

    let documentId = documentsByName.get(filename.toLowerCase());
    if (!documentId) {
      documentId = crypto.randomUUID();
      const storagePath = `${tripId}/${documentId}.pdf`;
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
        kind: "ticket",
      });
      if (documentError) {
        await db.storage.from("trip-documents").remove([storagePath]);
        fail(path, "save");
      }
      documentsByName.set(filename.toLowerCase(), documentId);
    }

    for (const flight of read) flights.push({ ...flight, documentId });
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

export async function setStayEnd(tripId: string, destinationId: string, formData: FormData) {
  const path = `/trips/${tripId}?tab=stays`;
  const endsOn = blankToNull(formData.get("ends_on"));
  if (!endsOn) fail(path, "dates");

  const db = await supabase();
  const { data: stop, error: readError } = await db
    .from("destinations")
    .select("starts_on")
    .eq("id", destinationId)
    .eq("trip_id", tripId)
    .maybeSingle();
  if (readError || !stop?.starts_on || endsOn < stop.starts_on) fail(path, "dates");

  const { error } = await db
    .from("destinations")
    .update({ ends_on: endsOn })
    .eq("id", destinationId)
    .eq("trip_id", tripId);
  if (error) fail(path, "save");

  await syncTripSpan(db, tripId);
  revalidatePath(path);
  revalidatePath("/");
  redirect(path);
}

export async function addDestination(tripId: string, formData: FormData) {
  const path = `/trips/${tripId}?tab=stays`;
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

export async function setTravelerConsult(tripId: string, formData: FormData) {
  const path = `/trips/${tripId}?tab=medical`;
  const answer = blankToNull(formData.get("answer"));
  if (answer !== "yes" && answer !== "no") fail(path, "save");

  const db = await supabase();
  const { error } = await db.from("trips").update({ traveler_consult: answer }).eq("id", tripId);
  if (error) fail(path, "save");

  revalidatePath(path);
  redirect(path);
}

export async function importPrescription(tripId: string, formData: FormData) {
  const path = `/trips/${tripId}?tab=medical`;
  const files = formData
    .getAll("prescription")
    .filter((value): value is File => value instanceof File && value.size > 0);
  if (files.length === 0) fail(path, "prescription");
  if (
    files.some((file) => {
      const name = file.name.toLowerCase();
      return Boolean(file.type) && file.type !== "application/pdf" && !name.endsWith(".pdf");
    })
  ) {
    fail(path, "prescription");
  }

  const db = await supabase();
  const medications: {
    name: string;
    dose: string | null;
    form: string | null;
    schedule: string | null;
    timing: "before" | "during" | "as-needed";
    quantity: string | null;
    purpose: string | null;
    notes: string | null;
    documentId: string;
  }[] = [];

  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const documentId = crypto.randomUUID();
    const storagePath = `${tripId}/${documentId}.pdf`;
    const filename = file.name.split(/[/\\]/).pop()?.trim() || "prescription.pdf";
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
      kind: "prescription",
    });
    if (documentError) {
      await db.storage.from("trip-documents").remove([storagePath]);
      fail(path, "save");
    }

    try {
      const read = await prescriptionFromPdf(bytes);
      for (const medication of read) medications.push({ ...medication, documentId });
    } catch {
      continue;
    }
  }

  if (medications.length === 0) fail(path, "prescription");

  const { data: existing, error: readError } = await db
    .from("medications")
    .select("position")
    .eq("trip_id", tripId)
    .order("position", { ascending: false })
    .limit(1);
  if (readError) fail(path, "save");

  const start = (existing?.[0]?.position ?? 0) + 1;
  const { error } = await db.from("medications").insert(
    medications.map((medication, index) => ({
      trip_id: tripId,
      document_id: medication.documentId,
      name: medication.name,
      dose: medication.dose,
      form: medication.form,
      schedule: medication.schedule,
      timing: medication.timing,
      quantity: medication.quantity,
      purpose: medication.purpose,
      notes: medication.notes,
      position: start + index,
    })),
  );
  if (error) fail(path, "save");

  revalidatePath(path);
  redirect(path);
}

export async function importVisa(tripId: string, formData: FormData) {
  const path = `/trips/${tripId}?tab=visa`;
  const files = formData
    .getAll("visa")
    .filter((value): value is File => value instanceof File && value.size > 0);
  if (files.length === 0) fail(path, "visa-file");
  if (
    files.some((file) => {
      const name = file.name.toLowerCase();
      return Boolean(file.type) && file.type !== "application/pdf" && !name.endsWith(".pdf");
    })
  ) {
    fail(path, "visa-file");
  }

  const db = await supabase();
  const read: {
    country: string;
    visaType: string | null;
    validFrom: string | null;
    validUntil: string | null;
    stayDays: number | null;
    entries: string | null;
    notes: string | null;
    documentId: string;
  }[] = [];

  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const documentId = crypto.randomUUID();
    const storagePath = `${tripId}/${documentId}.pdf`;
    const filename = file.name.split(/[/\\]/).pop()?.trim() || "visa.pdf";
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
      kind: "visa",
    });
    if (documentError) {
      await db.storage.from("trip-documents").remove([storagePath]);
      fail(path, "save");
    }

    try {
      const visas = await visaFromPdf(bytes);
      for (const visa of visas) read.push({ ...visa, documentId });
    } catch {
      continue;
    }
  }

  if (read.length === 0) fail(path, "visa-file");

  const { data: existing, error: readError } = await db
    .from("visa_entries")
    .select("id, country, position")
    .eq("trip_id", tripId);
  if (readError) fail(path, "save");

  let next = (existing ?? []).reduce((max, row) => Math.max(max, row.position), -1) + 1;
  const rows = existing ?? [];

  for (const visa of read) {
    const fields = {
      document_id: visa.documentId,
      visa_type: visa.visaType,
      valid_from: visa.validFrom,
      valid_until: visa.validUntil,
      stay_days: visa.stayDays,
      entries: visa.entries,
      document_notes: visa.notes,
    };
    const match = rows.find((row) => row.country.trim().toLowerCase() === visa.country.trim().toLowerCase());
    if (match) {
      const { error } = await db.from("visa_entries").update(fields).eq("id", match.id);
      if (error) fail(path, "save");
      continue;
    }
    const { data, error } = await db
      .from("visa_entries")
      .insert({
        trip_id: tripId,
        country: visa.country,
        needed: true,
        requirement: "visa required",
        position: next,
        ...fields,
      })
      .select("id, country, position")
      .single();
    if (error || !data) fail(path, "save");
    rows.push(data);
    next += 1;
  }

  revalidatePath(path);
  redirect(path);
}

export async function importInsurance(tripId: string, formData: FormData) {
  const path = `/trips/${tripId}?tab=insurance`;
  const files = formData
    .getAll("insurance")
    .filter((value): value is File => value instanceof File && value.size > 0);
  if (files.length === 0) fail(path, "insurance");
  if (
    files.some((file) => {
      const name = file.name.toLowerCase();
      return Boolean(file.type) && file.type !== "application/pdf" && !name.endsWith(".pdf");
    })
  ) {
    fail(path, "insurance");
  }

  const db = await supabase();
  const read: {
    insurer: string;
    plan: string | null;
    policyNumber: string | null;
    holder: string | null;
    validFrom: string | null;
    validUntil: string | null;
    emergencyPhone: string | null;
    coverage: string | null;
    deductible: string | null;
    territory: string | null;
    notes: string | null;
    documentId: string;
  }[] = [];

  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const documentId = crypto.randomUUID();
    const storagePath = `${tripId}/${documentId}.pdf`;
    const filename = file.name.split(/[/\\]/).pop()?.trim() || "insurance.pdf";
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
      kind: "insurance",
    });
    if (documentError) {
      await db.storage.from("trip-documents").remove([storagePath]);
      fail(path, "save");
    }

    try {
      const policies = await insuranceFromPdf(bytes);
      for (const policy of policies) read.push({ ...policy, documentId });
    } catch {
      continue;
    }
  }

  if (read.length === 0) fail(path, "insurance");

  const { data: existing, error: readError } = await db
    .from("insurance_policies")
    .select("id, policy_number, position")
    .eq("trip_id", tripId);
  if (readError) fail(path, "save");

  let next = (existing ?? []).reduce((max, row) => Math.max(max, row.position), -1) + 1;
  const rows = existing ?? [];

  for (const policy of read) {
    const fields = {
      document_id: policy.documentId,
      insurer: policy.insurer,
      plan: policy.plan,
      policy_number: policy.policyNumber,
      holder: policy.holder,
      valid_from: policy.validFrom,
      valid_until: policy.validUntil,
      emergency_phone: policy.emergencyPhone,
      coverage: policy.coverage,
      deductible: policy.deductible,
      territory: policy.territory,
      notes: policy.notes,
    };
    const number = policy.policyNumber?.trim().toLowerCase();
    const match = number
      ? rows.find((row) => typeof row.policy_number === "string" && row.policy_number.trim().toLowerCase() === number)
      : undefined;
    if (match) {
      const { error } = await db.from("insurance_policies").update(fields).eq("id", match.id);
      if (error) fail(path, "save");
      continue;
    }
    const { data, error } = await db
      .from("insurance_policies")
      .insert({
        trip_id: tripId,
        position: next,
        ...fields,
      })
      .select("id, policy_number, position")
      .single();
    if (error || !data) fail(path, "save");
    rows.push(data);
    next += 1;
  }

  revalidatePath(path);
  redirect(path);
}

export async function deleteInsurancePolicy(tripId: string, policyId: string) {
  const db = await supabase();
  await db.from("insurance_policies").delete().eq("id", policyId).eq("trip_id", tripId);
  revalidatePath(`/trips/${tripId}`);
}

export async function deleteVisaEntry(tripId: string, entryId: string) {
  const db = await supabase();
  await db.from("visa_entries").delete().eq("id", entryId).eq("trip_id", tripId);
  revalidatePath(`/trips/${tripId}`);
}

export async function deleteMedication(tripId: string, medicationId: string) {
  const db = await supabase();
  await db.from("medications").delete().eq("id", medicationId).eq("trip_id", tripId);
  revalidatePath(`/trips/${tripId}`);
}
