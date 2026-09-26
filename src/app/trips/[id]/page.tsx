import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addDestination, addSegment, connectChannels, deleteDestination, deleteMedication, deleteSegment, importBooking, importPrescription, importTickets, setStayEnd, setTravelerConsult } from "@/app/actions";
import { parseChargerBrief } from "@/lib/agents/chargers";
import { parseRideBrief } from "@/lib/agents/rides";
import { parseScamBrief } from "@/lib/agents/scams";
import { parseSimBrief } from "@/lib/agents/sim";
import { parseTerminalBrief } from "@/lib/agents/terminals";
import { parseVisaBrief } from "@/lib/agents/visa";
import { AGENT_KEYS, AgentsPanel } from "@/components/agents-panel";
import { InsurancePanel, insurancePoliciesFromRows } from "@/components/insurance-panel";
import { CitySelect } from "@/components/city-select";
import { PanelHead } from "@/components/panel-head";
import { BrandLogo, Icon, type IconName } from "@/components/icons";
import { TicketFiles } from "@/components/ticket-files";
import { TripChat, type ChatMessage } from "@/components/trip-chat";
import { TripTranslator } from "@/components/trip-translator";
import { VisaPanel, visaEntriesFromRows } from "@/components/visa-panel";
import { NextStopDates } from "@/components/next-stop-dates";
import { clocksForCities } from "@/lib/place-time";
import { routeLabel } from "@/lib/destinations";
import { languageForCity } from "@/lib/trip-language";
import { ErrorNote, Shell, buttonClass, fieldClass } from "@/components/shell";
import {
  dayKey,
  formatDay,
  formatStay,
  formatWhen,
  kindLabel,
  supabase,
  type Destination,
  type Medication,
  type MedicationTiming,
  type Segment,
  type TripDocument,
} from "@/lib/trips";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function TripPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; tab?: string; chat?: string; agent?: string }>;
}) {
  const { id } = await params;
  const {
    error: errorCode,
    tab: requestedTab,
    chat: requestedChat,
    agent: requestedAgent,
  } = await searchParams;
  const agent = AGENT_KEYS.find((key) => key === requestedAgent) ?? null;
  const tab =
    requestedTab === "stays" ||
    requestedTab === "bookings" ||
    requestedTab === "medical" ||
    requestedTab === "insurance" ||
    requestedTab === "visa" ||
    requestedTab === "sim" ||
    requestedTab === "chat" ||
    requestedTab === "translator"
      ? requestedTab
      : "planes";
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const db = await supabase();
  const { data: trip, error } = await db
    .from("trips")
    .select("id, title, start_date, end_date, created_at, traveler_consult")
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
      "id, trip_id, kind, title, starts_at, ends_at, origin, destination, document_id, url, created_at",
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
    .select("id, trip_id, filename, storage_path, content_type, kind, created_at")
    .eq("trip_id", id)
    .order("created_at", { ascending: true });

  const { data: briefRows } = await db
    .from("trip_briefs")
    .select("kind, payload")
    .eq("trip_id", id);

  const { data: insuranceRows } = await db
    .from("insurance_policies")
    .select(
      "id, trip_id, document_id, insurer, plan, policy_number, holder, valid_from, valid_until, emergency_phone, coverage, deductible, territory, notes, position",
    )
    .eq("trip_id", id)
    .order("position", { ascending: true });

  const { data: visaRows } = await db
    .from("visa_entries")
    .select(
      "id, trip_id, country, cities, dates, needed, requirement, stay, passport_rule, forms, next_step, source, source_href, passport, document_id, visa_type, valid_from, valid_until, stay_days, entries, document_notes, position",
    )
    .eq("trip_id", id)
    .order("position", { ascending: true });

  const { data: medicationRows } = await db
    .from("medications")
    .select(
      "id, trip_id, document_id, name, dose, form, schedule, timing, quantity, purpose, notes, position, created_at",
    )
    .eq("trip_id", id)
    .order("position", { ascending: true });

  const files = (documents ?? []) as TripDocument[];
  const ticketFiles = files.filter((file) => file.kind === "ticket");
  const prescriptionFiles = files.filter((file) => file.kind === "prescription");
  const insuranceFiles = files.filter((file) => file.kind === "insurance");
  const insurancePolicies = insurancePoliciesFromRows(insuranceRows);
  const visaFiles = files.filter((file) => file.kind === "visa");
  const visaEntries = visaEntriesFromRows(visaRows);
  const medications = (medicationRows ?? []) as Medication[];
  const consult =
    trip.traveler_consult === "yes" || trip.traveler_consult === "no" ? trip.traveler_consult : null;
  const documentLinks = new Map<string, string>();
  await Promise.all(
    files.map(async (file) => {
      const { data } = await db.storage
        .from("trip-documents")
        .createSignedUrl(file.storage_path, 60 * 60);
      if (data?.signedUrl) documentLinks.set(file.id, data.signedUrl);
    }),
  );

  const sim = parseSimBrief(briefRows?.find((row) => row.kind === "sim")?.payload);
  const visa = parseVisaBrief(briefRows?.find((row) => row.kind === "visa")?.payload);
  const scams = parseScamBrief(briefRows?.find((row) => row.kind === "scams")?.payload);
  const rides = parseRideBrief(briefRows?.find((row) => row.kind === "rides")?.payload);
  const terminals = parseTerminalBrief(briefRows?.find((row) => row.kind === "terminals")?.payload);
  const chargers = parseChargerBrief(briefRows?.find((row) => row.kind === "chargers")?.payload);
  const agentCount = [sim, scams, rides, terminals, chargers].filter(Boolean).length;
  const stops = ((destinations ?? []) as Destination[]).sort(byStart);
  const rows = (segments ?? []) as Segment[];
  const flights = rows.filter((segment) => segment.kind === "flight");
  const stayRows = rows.filter((segment) => segment.kind === "stay");
  const bookings = rows.filter((segment) => segment.kind === "reservation");
  const when = formatStay(
    trip.start_date ?? stops[0]?.starts_on ?? null,
    trip.end_date ?? stops.at(-1)?.ends_on ?? null,
  );
  const route = stops.map((stop) => stop.name).join(" → ");
  const leftFrom = flights.find((flight) => flight.origin)?.origin ?? null;
  const clocks = await clocksForCities([
    ...(leftFrom ? [leftFrom] : []),
    ...stops.map((stop) => stop.name),
  ]);
  const clockByCity = new Map(clocks.map((clock) => [clock.city.toLowerCase(), clock]));
  const {
    data: { user },
  } = await db.auth.getUser();
  const { data: profile } = user
    ? await db.from("user_profile").select("whatsapp, telegram").eq("id", user.id).maybeSingle()
    : { data: null };
  const whatsapp = typeof profile?.whatsapp === "string" ? profile.whatsapp : null;
  const telegram = typeof profile?.telegram === "string" ? profile.telegram : null;

  const tabs: { key: typeof tab; label: string; icon: IconName; count: number }[] = [
    { key: "planes", label: "Planes", icon: "plane", count: flights.length },
    { key: "stays", label: "Stays", icon: "bed", count: stops.length + stayRows.length },
    { key: "bookings", label: "Bookings", icon: "ticket", count: bookings.length },
    { key: "medical", label: "Medical", icon: "medical", count: medications.length },
    { key: "insurance", label: "Insurance", icon: "shield", count: insurancePolicies.length },
    { key: "visa", label: "Visa", icon: "visa", count: visaEntries.length },
    { key: "sim", label: "Specialized Agents", icon: "sim", count: agentCount },
    { key: "chat", label: "Chat", icon: "chat", count: 0 },
    { key: "translator", label: "Translator", icon: "globe", count: 0 },
  ];

  return (
    <Shell>
      <Link href="/" className="back">
        <Icon name="back" size={16} />
        All trips
      </Link>
      <header className="trip-hero">
        <div className="trip-hero-top">
          <div className="stack">
            <p className="kicker">Your trip</p>
            <h1 className="title">{trip.title}</h1>
            <ul className="trip-facts">
              <li>
                <Icon name="pin" size={16} />
                {route || "No stops yet"}
              </li>
              {when ? (
                <li>
                  <Icon name="calendar" size={16} />
                  {when}
                </li>
              ) : null}
              <li>
                <Icon name="ticket" size={16} />
                {rows.length} {rows.length === 1 ? "booking" : "bookings"}
              </li>
            </ul>
          </div>
          <form action={connectChannels.bind(null, id)} className="hero-reach">
            <input type="hidden" name="return_tab" value={tab === "planes" ? "" : tab} />
            <p className="hint">
              {telegram || whatsapp
                ? "The agent writes first."
                : "Connect Telegram or WhatsApp. The agent writes first."}
            </p>
            <label className="reach-field">
              <span className="reach-name">
                <BrandLogo name="telegram" size={22} />
                Telegram
              </span>
              <input
                name="telegram"
                className={fieldClass}
                type="text"
                autoComplete="username"
                placeholder="@username"
                defaultValue={telegram ?? ""}
                aria-label="Telegram username"
                maxLength={32}
              />
            </label>
            <label className="reach-field">
              <span className="reach-name">
                <BrandLogo name="whatsapp" size={22} />
                WhatsApp
              </span>
              <input
                name="whatsapp"
                className={fieldClass}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+351 910 000 000"
                defaultValue={whatsapp ?? ""}
                aria-label="WhatsApp number"
              />
            </label>
            <button type="submit" className={`${buttonClass} btn-block`}>
              {telegram || whatsapp ? "Update" : "Connect"}
            </button>
          </form>
        </div>
        {clocks.length > 0 ? (
          <ul className="clocks">
            {clocks.map((clock) => (
              <li key={clock.city} className="clock">
                <span className="clock-city">
                  {leftFrom && clock.city.toLowerCase() === leftFrom.toLowerCase()
                    ? `Left from · ${clock.city}`
                    : clock.city}
                </span>
                <span className="clock-time">{clock.time}</span>
                <span className="clock-zone">
                  {clock.offset} · {clock.timeZone}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      <ErrorNote code={errorCode} />

      <nav className="tabs" aria-label="Trip sections">
        {tabs.map((item) => (
          <Link
            key={item.key}
            href={item.key === "planes" ? `/trips/${id}` : `/trips/${id}?tab=${item.key}`}
            className={tab === item.key ? "tab tab-on" : "tab"}
            aria-current={tab === item.key ? "page" : undefined}
          >
            <Icon name={item.icon} size={17} />
            {item.label}
            {item.count > 0 ? <span className="tab-count">{item.count}</span> : null}
          </Link>
        ))}
      </nav>

      {tab === "planes" ? (
        <div className="split">
          <div className="split-main">
            <SegmentGroups
              tripId={id}
              segments={flights}
              documentLinks={documentLinks}
              icon="plane"
              empty="No flights yet. Upload a ticket or add one by hand."
            />
          </div>
          <aside className="split-side">
            <TicketFiles action={importTickets.bind(null, id)} />
            <DocList title="Saved tickets" files={ticketFiles} links={documentLinks} />
            <BookingForm
              tripId={id}
              kind="flight"
              heading="Add a flight"
              namePlaceholder="Flight TP 1324"
              placeLabel={["From", "To"]}
            />
          </aside>
        </div>
      ) : null}

      {tab === "stays" ? (
        <div className="split">
          <div className="split-main">
            <section className="panel">
              <PanelHead icon="pin" title="Cities" hint="The cities on this trip and the days you are there." />
              {stops.length === 0 ? (
                <p className="empty">Add the first city and the days you are there.</p>
              ) : (
                <ol className="trip-list">
                  {stops.map((stop, index) => {
                    const clock = clockByCity.get(stop.name.toLowerCase());
                    return (
                      <li key={stop.id} className="trip-card">
                        <div className="stop-row">
                          <span className="stop-index">{index + 1}</span>
                          <span className="stop-text">
                            <strong>{stop.name}</strong>
                            <span className="place">
                              {formatStay(stop.starts_on, stop.ends_on) ?? "Dates not set"}
                            </span>
                            {clock ? (
                              <span className="place">
                                {clock.time} · {clock.offset} · {clock.timeZone}
                              </span>
                            ) : null}
                            {stop.ends_on ? null : (
                              <form action={setStayEnd.bind(null, id, stop.id)} className="inline-form">
                                <label className="field-label">
                                  Last day
                                  <input
                                    name="ends_on"
                                    type="date"
                                    required
                                    min={stop.starts_on ?? undefined}
                                    className={fieldClass}
                                  />
                                </label>
                                <button type="submit" className={buttonClass}>
                                  Save
                                </button>
                              </form>
                            )}
                          </span>
                        </div>
                        <form action={deleteDestination.bind(null, id, stop.id)}>
                          <button type="submit" className="btn-quiet">
                            <Icon name="close" size={14} />
                            Remove
                          </button>
                        </form>
                      </li>
                    );
                  })}
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
                  <Icon name="plus" size={16} />
                  Add city
                </button>
              </form>
            </section>
            <section className="stack">
              <h2 className="section-title">Places</h2>
              <SegmentGroups
                tripId={id}
                segments={stayRows}
                documentLinks={documentLinks}
                icon="bed"
                empty="No Airbnb or hotel yet. Upload a confirmation or add one by hand."
              />
            </section>
          </div>
          <aside className="split-side">
            <UploadPanel
              action={importBooking.bind(null, id)}
              title="Upload a stay"
              hint="Upload the PDF. The place, check-in, check-out, city, and link are filled in from the file."
              name="booking"
              submit="Import stay"
            >
              <input type="hidden" name="kind" value="stay" />
            </UploadPanel>
            <BookingForm
              tripId={id}
              kind="stay"
              heading="Add a stay"
              namePlaceholder="Loft in Alfama"
              placeLabel={["City"]}
            />
          </aside>
        </div>
      ) : null}

      {tab === "bookings" ? (
        <div className="split">
          <div className="split-main">
            <SegmentGroups
              tripId={id}
              segments={bookings}
              documentLinks={documentLinks}
              icon="ticket"
              empty="No bookings yet. Upload a confirmation or add one by hand."
            />
          </div>
          <aside className="split-side">
            <UploadPanel
              action={importBooking.bind(null, id)}
              title="Upload a booking"
              hint="Upload the PDF. The name, dates, city, and link are filled in from the file."
              name="booking"
              submit="Import booking"
            />
            <BookingForm
              tripId={id}
              kind="reservation"
              heading="Add a booking"
              namePlaceholder="Dinner at Cervejaria"
              placeLabel={["City"]}
            />
          </aside>
        </div>
      ) : null}

      {tab === "medical" ? (
        <div className="split">
          <div className="split-main">
            <MedicationGroups tripId={id} medications={medications} />
          </div>
          <aside className="split-side">
            <section className="panel">
              <PanelHead
                icon="medical"
                title="Consulta do viajante"
                hint="Have you already had a traveler consultation for this trip?"
              />
              <form action={setTravelerConsult.bind(null, id)} className="choices">
                <button
                  type="submit"
                  name="answer"
                  value="yes"
                  className={consult === "yes" ? "choice choice-on" : "choice"}
                >
                  Yes, I have
                </button>
                <button
                  type="submit"
                  name="answer"
                  value="no"
                  className={consult === "no" ? "choice choice-on" : "choice"}
                >
                  Not yet
                </button>
              </form>
              {consult === "no" ? (
                <p className="note">
                  Book one before you leave. The clinic checks the stops on this trip and writes the
                  prescription you upload below.
                </p>
              ) : null}
              {consult === "yes" ? (
                <p className="note">Upload the prescription from that visit below.</p>
              ) : null}
            </section>
            <UploadPanel
              action={importPrescription.bind(null, id)}
              title="Upload the prescription"
              hint="Upload the PDF. Each medicine is saved with its dose, schedule, and when you take it."
              name="prescription"
              submit="Read prescription"
            />
            <DocList title="Saved prescriptions" files={prescriptionFiles} links={documentLinks} />
          </aside>
        </div>
      ) : null}

      {tab === "insurance" ? (
        <InsurancePanel tripId={id} policies={insurancePolicies} files={insuranceFiles} links={documentLinks} />
      ) : null}
      {tab === "visa" ? (
        <VisaPanel
          tripId={id}
          stops={stops.length}
          entries={visaEntries}
          passport={visa?.passport ?? visaEntries.find((entry) => entry.passport)?.passport ?? ""}
          disclaimer={visa?.disclaimer ?? null}
          files={visaFiles}
          links={documentLinks}
        />
      ) : null}
      {tab === "sim" ? (
        <AgentsPanel
          tripId={id}
          agent={agent}
          stops={stops.length}
          flights={flights.length}
          results={{ sim, scams, rides, terminals, chargers }}
        />
      ) : null}
      {tab === "chat" ? (
        <ChatPanel tripId={id} chatId={requestedChat} stops={stops.map((stop) => stop.name)} />
      ) : null}
      {tab === "translator" ? (
        <TripTranslator tripId={id} languages={languageOptionsForStops(stops.map((stop) => stop.name))} />
      ) : null}
    </Shell>
  );
}

async function ChatPanel({
  tripId,
  chatId,
  stops,
}: {
  tripId: string;
  chatId?: string;
  stops: string[];
}) {
  const db = await supabase();
  const { data: chatRows, error } = await db
    .from("trip_chats")
    .select("id, title, updated_at")
    .eq("trip_id", tripId)
    .order("updated_at", { ascending: false });

  if (error) {
    return (
      <p role="alert" className="alert">
        Could not load these chats. {error.message}
      </p>
    );
  }

  const chats = (chatRows ?? []).flatMap((row) =>
    row.id && row.title ? [{ id: row.id, title: row.title }] : [],
  );
  const selected = chats.find((chat) => chat.id === chatId) ?? chats[0] ?? null;
  let messages: ChatMessage[] = [];
  if (selected) {
    const { data, error: messageError } = await db
      .from("trip_messages")
      .select("id, role, content, created_at")
      .eq("chat_id", selected.id)
      .order("created_at", { ascending: true });
    if (messageError) {
      return (
        <p role="alert" className="alert">
          Could not load this conversation. {messageError.message}
        </p>
      );
    }
    messages = (data ?? []).flatMap((row) =>
      row.role === "user" || row.role === "assistant"
        ? [{ id: row.id, role: row.role, content: row.content }]
        : [],
    );
  }

  return (
    <TripChat
      tripId={tripId}
      chatId={selected?.id ?? null}
      chats={chats}
      messages={messages}
      languages={languageOptionsForStops(stops)}
    />
  );
}

function languageOptionsForStops(stops: string[]) {
  const byLanguage = new Map<string, { code: string; name: string; cities: string[] }>([
    ["en", { code: "en", name: "English", cities: [] }],
  ]);
  for (const city of stops) {
    const language = languageForCity(city);
    const current = byLanguage.get(language.code);
    if (current) current.cities.push(city);
    else byLanguage.set(language.code, { ...language, cities: [city] });
  }
  return [...byLanguage.values()];
}

const TIMINGS: MedicationTiming[] = ["before", "during", "as-needed"];

function timingLabel(timing: MedicationTiming) {
  if (timing === "before") return "Before you leave";
  if (timing === "during") return "While you are away";
  return "If you need it";
}

function MedicationGroups({
  tripId,
  medications,
}: {
  tripId: string;
  medications: Medication[];
}) {
  if (medications.length === 0) {
    return (
      <div className="empty-state">
        <span className="icon-tile">
          <Icon name="medical" size={22} />
        </span>
        <strong>No medicines yet</strong>
        <p>Upload the prescription and each medicine shows up here.</p>
      </div>
    );
  }

  return (
    <div className="days">
      {TIMINGS.map((timing) => {
        const items = medications.filter((medication) => medication.timing === timing);
        if (items.length === 0) return null;
        return (
          <div key={timing}>
            <h3 className="day-heading">{timingLabel(timing)}</h3>
            <ul className="trip-list">
              {items.map((medication) => (
                <li key={medication.id} className="segment segment-reservation">
                  <span className="icon-tile">
                    <Icon name="medical" size={20} />
                  </span>
                  <div className="segment-body">
                    <strong>{medication.name}</strong>
                    <MedicineLines medication={medication} />
                  </div>
                  <form action={deleteMedication.bind(null, tripId, medication.id)}>
                    <button type="submit" className="btn-quiet">
                      <Icon name="close" size={14} />
                      Remove
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function MedicineLines({ medication }: { medication: Medication }) {
  const how = [medication.dose, medication.form, medication.schedule].filter(Boolean).join(" · ");
  const about = [medication.purpose, medication.quantity].filter(Boolean).join(" · ");
  return (
    <>
      {how ? <p className="place">{how}</p> : null}
      {about ? <p className="place">{about}</p> : null}
      {medication.notes ? <p className="hint">{medication.notes}</p> : null}
    </>
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

function UploadPanel({
  action,
  title,
  hint,
  name,
  submit,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  title: string;
  hint: string;
  name: string;
  submit: string;
  children?: ReactNode;
}) {
  return (
    <form action={action} className="panel">
      <PanelHead icon="upload" title={title} hint={hint} />
      {children}
      <input name={name} type="file" accept="application/pdf,.pdf" required className={fieldClass} />
      <button type="submit" className={`${buttonClass} btn-block`}>
        {submit}
      </button>
    </form>
  );
}

function DocList({
  title,
  files,
  links,
}: {
  title: string;
  files: TripDocument[];
  links: Map<string, string>;
}) {
  if (files.length === 0) return null;
  return (
    <section className="panel">
      <PanelHead icon="document" title={title} />
      <ul className="doc-list">
        {files.map((file) => {
          const href = links.get(file.id);
          return (
            <li key={file.id}>
              {href ? (
                <a href={href} className="doc-link" target="_blank" rel="noreferrer">
                  <Icon name="document" size={15} />
                  {file.filename}
                </a>
              ) : (
                <span>
                  <Icon name="document" size={15} />
                  {file.filename}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function SegmentGroups({
  tripId,
  segments,
  documentLinks,
  icon,
  empty,
}: {
  tripId: string;
  segments: Segment[];
  documentLinks: Map<string, string>;
  icon: IconName;
  empty: string;
}) {
  const groups = groupSegments(segments);
  if (groups.length === 0) {
    return (
      <div className="empty-state">
        <span className="icon-tile">
          <Icon name={icon} size={22} />
        </span>
        <strong>Nothing here yet</strong>
        <p>{empty}</p>
      </div>
    );
  }
  return (
    <div className="days">
      {groups.map(([day, items]) => (
        <div key={day}>
          <h3 className="day-heading">{formatDay(day)}</h3>
          <ul className="rail">
            {items.map((segment) => (
              <SegmentRow
                key={segment.id}
                tripId={tripId}
                segment={segment}
                documentHref={
                  segment.document_id ? documentLinks.get(segment.document_id) : undefined
                }
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function BookingForm({
  tripId,
  kind,
  heading,
  namePlaceholder,
  placeLabel,
}: {
  tripId: string;
  kind: "flight" | "stay" | "reservation";
  heading: string;
  namePlaceholder: string;
  placeLabel: ["From", "To"] | ["City"];
}) {
  const startLabel = kind === "stay" ? "Check-in" : "Starts";
  const endLabel = kind === "stay" ? "Check-out" : "Ends";
  return (
    <form action={addSegment.bind(null, tripId)} className="panel">
      <PanelHead icon="plus" title={heading} hint="No PDF? Type it in." />
      <input type="hidden" name="kind" value={kind} />
      <label className="field-label">
        Name
        <input name="title" required className={fieldClass} placeholder={namePlaceholder} />
      </label>
      {placeLabel.length === 2 ? (
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
      ) : (
        <label className="field-label">
          City
          <CitySelect name="destination" />
        </label>
      )}
      <div className="dates">
        <label className="field-label">
          {startLabel}
          <input name="starts_at" type="datetime-local" className={fieldClass} />
        </label>
        <label className="field-label">
          {endLabel}
          <input name="ends_at" type="datetime-local" className={fieldClass} />
        </label>
      </div>
      <label className="field-label">
        Link
        <input name="url" type="url" className={fieldClass} placeholder="https://" />
      </label>
      <button type="submit" className={`${buttonClass} btn-block`}>
        {heading}
      </button>
    </form>
  );
}

const KIND_ICONS: Record<Segment["kind"], IconName> = {
  flight: "plane",
  stay: "bed",
  reservation: "ticket",
};

function linkLabel(value: string) {
  try {
    return new URL(value).host.replace(/^www\./, "");
  } catch {
    return "Link";
  }
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
      <span className="icon-tile">
        <Icon name={KIND_ICONS[segment.kind]} size={20} />
      </span>
      <div className="segment-body">
        <span className="chip">{kindLabel(segment.kind)}</span>
        <strong>{segment.title}</strong>
        {route ? <p className="place">{route}</p> : null}
        {until ? <p className="until">Until {until}</p> : null}
        {segment.url || documentHref ? (
          <div className="segment-links">
            {segment.url ? (
              <a href={segment.url} className="link-pill" target="_blank" rel="noreferrer">
                <Icon name="external" size={13} />
                {linkLabel(segment.url)}
              </a>
            ) : null}
            {documentHref ? (
              <a href={documentHref} className="link-pill" target="_blank" rel="noreferrer">
                <Icon name="document" size={13} />
                Original
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="segment-side">
        {depart ? (
          <p className="segment-time">
            {depart}
            {arrive ? <span>to {arrive}</span> : null}
          </p>
        ) : null}
        <form action={deleteSegment.bind(null, tripId, segment.id)}>
          <button type="submit" className="btn-quiet">
            <Icon name="close" size={14} />
            Remove
          </button>
        </form>
      </div>
    </li>
  );
}
