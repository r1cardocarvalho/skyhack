import { readModelText } from "@/lib/azure";
import { parseDestinationBrief } from "@/lib/agents/briefing";
import { parseChargerBrief } from "@/lib/agents/chargers";
import { parseRideBrief } from "@/lib/agents/rides";
import { parseScamBrief } from "@/lib/agents/scams";
import { parseTerminalBrief } from "@/lib/agents/terminals";
import { parseSimBrief } from "@/lib/agents/sim";
import { parseVisaBrief } from "@/lib/agents/visa";
import { supabase, type MedicationTiming, type SegmentKind } from "@/lib/trips";

const HISTORY = 20;

export async function replyOnTrip(tripId: string, chatId: string, question: string) {
  const db = await supabase();
  const instructions = await instructionsFor(db, tripId);
  if (!instructions) throw new Error("missing-trip");

  const { data: chat, error: chatError } = await db
    .from("trip_chats")
    .select("id, title")
    .eq("id", chatId)
    .eq("trip_id", tripId)
    .maybeSingle();
  if (chatError || !chat) throw new Error("save");

  const { data: earlier, error: historyError } = await db
    .from("trip_messages")
    .select("role, content, created_at")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: false })
    .limit(HISTORY);

  if (historyError) throw new Error("save");

  const history = (earlier ?? [])
    .reverse()
    .flatMap((row) =>
      row.role === "user" || row.role === "assistant"
        ? [{ role: row.role, content: clip(row.content, 4000) }]
        : [],
    );

  const answer = await readModelText({
    instructions,
    messages: [...history, { role: "user", content: question }],
    maxOutputTokens: 2000,
    timeoutMs: 90_000,
    search: true,
  });
  if (!answer) throw new Error("model");

  const now = Date.now();
  const { error } = await db.from("trip_messages").insert([
    {
      trip_id: tripId,
      chat_id: chatId,
      role: "user",
      content: question,
      created_at: new Date(now).toISOString(),
    },
    {
      trip_id: tripId,
      chat_id: chatId,
      role: "assistant",
      content: clip(answer, 4000),
      created_at: new Date(now + 1).toISOString(),
    },
  ]);
  if (error) throw new Error("save");

  const title = chat.title === "New chat" ? clip(question, 48) : chat.title;
  const { error: touchError } = await db
    .from("trip_chats")
    .update({ title: title || "New chat", updated_at: new Date(now).toISOString() })
    .eq("id", chatId);
  if (touchError) throw new Error("save");
}

async function instructionsFor(db: Awaited<ReturnType<typeof supabase>>, tripId: string) {
  const [tripRes, stopRes, segmentRes, medicationRes, briefRes, documentRes, visaRes, insuranceRes] = await Promise.all([
    db
      .from("trips")
      .select("title, start_date, end_date, traveler_consult")
      .eq("id", tripId)
      .maybeSingle(),
    db
      .from("destinations")
      .select("name, starts_on, ends_on, position")
      .eq("trip_id", tripId)
      .order("position", { ascending: true }),
    db
      .from("segments")
      .select("kind, title, starts_at, ends_at, origin, destination")
      .eq("trip_id", tripId)
      .order("starts_at", { ascending: true, nullsFirst: false }),
    db
      .from("medications")
      .select("name, dose, form, schedule, timing, quantity, purpose, notes")
      .eq("trip_id", tripId)
      .order("position", { ascending: true }),
    db.from("trip_briefs").select("kind, payload").eq("trip_id", tripId),
    db.from("documents").select("filename, kind").eq("trip_id", tripId).order("created_at", { ascending: true }),
    db
      .from("visa_entries")
      .select("country, needed, requirement, stay_days, valid_from, valid_until, visa_type, entries")
      .eq("trip_id", tripId)
      .order("position", { ascending: true }),
    db
      .from("insurance_policies")
      .select(
        "insurer, plan, policy_number, holder, valid_from, valid_until, emergency_phone, coverage, deductible, territory, notes",
      )
      .eq("trip_id", tripId)
      .order("position", { ascending: true }),
  ]);

  const trip = tripRes.data;
  if (tripRes.error || !trip) return null;

  const lines: string[] = [
    "You are the assistant for one trip. The record below is the source for this traveller's flights, stays, bookings, medicines, medical insurance, dates, and files. Do not invent those. You can search the web. Search before you answer whenever the record does not cover the question: scams, events, entry, weather, local practicalities, or when they ask you to research. Do not say you lack research access. Prefer an official page for phone numbers, entry rules, and health notices. For scams and local tips, a government warning or a reputable travel page is enough. Cite each outside fact as a markdown link. If search does not support a number or a visa outcome, say so instead of guessing. Remind them of a saved medicine schedule when they ask. When they ask about insurance, quote the saved policy number and assistance phone. Do not give a new diagnosis or legal advice. Keep the answer short. Use markdown: bold for names and times, and lists when there are several items.",
    "",
    `Trip: ${clip(trip.title, 120)}`,
    `Dates: ${trip.start_date ?? "unknown"} to ${trip.end_date ?? "unknown"}`,
    `Traveler consultation: ${trip.traveler_consult === "yes" || trip.traveler_consult === "no" ? trip.traveler_consult : "unknown"}`,
  ];

  const stops = (stopRes.data ?? [])
    .filter((stop) => stop.name)
    .map((stop) => `- ${clip(stop.name, 80)}: ${stop.starts_on ?? "unscheduled"} to ${stop.ends_on ?? "open"}`);
  lines.push("", "Stops:", ...(stops.length > 0 ? stops : ["- none"]));

  const segments = segmentRes.data ?? [];
  lines.push("", "Flights:", ...segmentLines(segments, "flight"));
  lines.push("", "Stays:", ...segmentLines(segments, "stay"));
  lines.push("", "Bookings:", ...segmentLines(segments, "reservation"));

  const medications = (medicationRes.data ?? []).map((item) => {
    const bits = [
      clip(item.name, 80),
      item.dose,
      item.form,
      timingLabel(item.timing),
      item.schedule,
      item.quantity ? `quantity ${item.quantity}` : null,
      item.purpose,
      item.notes,
    ]
      .map((bit) => clip(bit, 160))
      .filter(Boolean);
    return `- ${bits.join(", ")}`;
  });
  lines.push("", "Medications:", ...(medications.length > 0 ? medications : ["- none"]));

  const policies = (insuranceRes.data ?? []).map((policy) => {
    const valid = [policy.valid_from, policy.valid_until].filter(Boolean).join(" to ");
    const bits = [
      clip(policy.insurer, 80),
      policy.plan,
      policy.policy_number ? `policy ${policy.policy_number}` : null,
      policy.holder,
      valid ? `valid ${valid}` : null,
      policy.territory,
      policy.coverage ? `medical cover ${policy.coverage}` : null,
      policy.deductible ? `excess ${policy.deductible}` : null,
      policy.emergency_phone ? `assistance ${policy.emergency_phone}` : null,
      policy.notes,
    ]
      .map((bit) => clip(bit, 160))
      .filter(Boolean);
    return `- ${bits.join(", ")}`;
  });
  lines.push("", "Medical insurance:", ...(policies.length > 0 ? policies : ["- none"]));

  const files = (documentRes.data ?? []).map(
    (file) => `- ${file.kind}: ${clip(file.filename, 120)}`,
  );
  lines.push("", "Uploaded files:", ...(files.length > 0 ? files : ["- none"]));

  const briefs = briefRes.data ?? [];
  const sim = parseSimBrief(briefs.find((row) => row.kind === "sim")?.payload);
  if (sim) {
    lines.push(
      "",
      "SIM notes:",
      clip(sim.summary, 400),
      `Buy before: ${clip(sim.buyBefore, 240)}`,
      ...sim.places.map(
        (place) =>
          `- ${place.country} (${place.cities.join(", ")}): ${place.provider}, ${place.type}, ${place.data}, ${place.validity}${place.price ? `, ${place.price}` : ""}. ${clip(place.why, 200)}`,
      ),
      clip(sim.keepHomeSim, 400),
    );
  }

  const visa = parseVisaBrief(briefs.find((row) => row.kind === "visa")?.payload);
  if (visa) {
    lines.push("", `Visa notes for a ${clip(visa.passport, 60)} passport:`, clip(visa.disclaimer, 400));
    for (const place of visa.places) {
      const forms = place.forms.map((form) => form.name).join("; ");
      lines.push(
        `- ${place.country} (${place.cities.join(", ")}): ${clip(place.requirement, 160)}. ${clip(place.next, 200)}${forms ? ` Forms: ${clip(forms, 200)}.` : ""}`,
      );
    }
  }

  const visaRecords = (visaRes.data ?? []).map((entry) => {
    const need = entry.needed === true ? "visa needed" : entry.needed === false ? "no visa needed" : "not verified";
    const stay = typeof entry.stay_days === "number" ? `${entry.stay_days} days on the visa` : null;
    const valid = [entry.valid_from, entry.valid_until].filter(Boolean).join(" to ");
    return `- ${clip(entry.country, 60)}: ${need}, ${clip(entry.requirement, 80)}${entry.visa_type ? `, ${clip(entry.visa_type, 40)}` : ""}${stay ? `, ${stay}` : ""}${valid ? `, valid ${valid}` : ""}${entry.entries ? `, ${clip(entry.entries, 40)}` : ""}`;
  });
  if (visaRecords.length > 0) lines.push("", "Saved visa records:", ...visaRecords);

  const scams = parseScamBrief(briefs.find((row) => row.kind === "scams")?.payload);
  if (scams) {
    lines.push("", "Usual scams:", clip(scams.summary, 400));
    for (const place of scams.places) {
      lines.push(
        ...place.scams.map(
          (scam) => `- ${place.country}: ${scam.name}. ${clip(scam.instead, 200)}`,
        ),
      );
    }
  }

  const rides = parseRideBrief(briefs.find((row) => row.kind === "rides")?.payload);
  if (rides) {
    lines.push("", "Getting around:", clip(rides.summary, 400));
    for (const place of rides.places) {
      const options = place.around.options
        .map((option) => `${option.name} (${option.verdict})`)
        .join(", ");
      lines.push(
        `- ${place.country} (${place.cities.join(", ")}): airport ${place.airport.best}. Around town ${place.around.best}. ${options}. ${clip(place.around.pay, 160)}`,
      );
    }
  }

  const terminals = parseTerminalBrief(briefs.find((row) => row.kind === "terminals")?.payload);
  if (terminals) {
    lines.push("", "Departure terminals:", clip(terminals.summary, 400));
    for (const flight of terminals.flights) {
      lines.push(
        `- ${flight.title}, ${flight.route}: ${flight.terminal} at ${clip(flight.airport, 120)}. ${clip(flight.note, 200)}`,
      );
    }
  }

  const chargers = parseChargerBrief(briefs.find((row) => row.kind === "chargers")?.payload);
  if (chargers) {
    lines.push("", "Plugs and chargers:", clip(chargers.summary, 400));
    for (const place of chargers.places) {
      lines.push(
        `- ${place.country} (${place.cities.join(", ")}): plug ${place.plugTypes.join("/")}, ${place.voltage}, ${place.frequency}. ${clip(place.adapter, 220)} ${clip(place.converter, 260)}`,
      );
    }
  }

  const briefing = parseDestinationBrief(briefs.find((row) => row.kind === "briefing")?.payload);
  if (briefing) {
    lines.push("", `Destination briefing, retrieved ${briefing.retrieved}. ${clip(briefing.profile, 300)}`);
    for (const country of briefing.countries) {
      lines.push(
        `${country.country} (${country.cities.join(", ")}, ${country.dates})`,
        ...country.headline.map((line) => `- ${clip(line, 280)}`),
      );
      for (const section of country.sections) {
        lines.push(`${section.label}: ${clip(section.text, 500)}`);
      }
    }
  }

  return lines.join("\n");
}

function segmentLines(
  segments: {
    kind: string;
    title: string;
    starts_at: string | null;
    ends_at: string | null;
    origin: string | null;
    destination: string | null;
  }[],
  kind: SegmentKind,
) {
  const rows = segments
    .filter((segment) => segment.kind === kind)
    .map((segment) => {
      const route = [segment.origin, segment.destination].filter(Boolean).join(" → ");
      const when = [segment.starts_at, segment.ends_at].filter(Boolean).join(" to ");
      return `- ${[clip(segment.title, 120), route, when].filter(Boolean).join(", ")}`;
    });
  return rows.length > 0 ? rows : ["- none"];
}

function timingLabel(timing: string) {
  const known: Record<MedicationTiming, string> = {
    before: "before the trip",
    during: "during the trip",
    "as-needed": "as needed",
  };
  return timing in known ? known[timing as MedicationTiming] : timing;
}

function clip(value: string | null | undefined, max: number) {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
