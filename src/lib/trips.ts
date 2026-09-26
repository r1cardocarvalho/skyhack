import { createClient } from "@/lib/supabase/server";

export type SegmentKind = "flight" | "stay" | "reservation";

export type Destination = {
  id: string;
  trip_id: string;
  name: string;
  position: number;
  starts_on: string | null;
  ends_on: string | null;
};

export type Trip = {
  id: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
};

export type TripDocument = {
  id: string;
  trip_id: string;
  filename: string;
  storage_path: string;
  content_type: string;
  created_at: string;
};

export type Segment = {
  id: string;
  trip_id: string;
  kind: SegmentKind;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
  origin: string | null;
  destination: string | null;
  document_id: string | null;
  created_at: string;
};

export async function supabase() {
  return createClient();
}

export function blankToNull(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

export function asTimestamp(value: string | null) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T00:00:00`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return `${value}:00`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value)) return value;
  return null;
}

export function dayKey(value: string | null) {
  if (!value) return "unscheduled";
  return value.slice(0, 10);
}

export function formatDay(key: string) {
  if (key === "unscheduled") return "Unscheduled";
  const [year, month, day] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatWhen(value: string | null) {
  if (!value) return null;
  const match = value.match(/T(\d{2}):(\d{2})/);
  if (!match || (match[1] === "00" && match[2] === "00")) return null;
  return `${match[1]}:${match[2]}`;
}

export function formatDate(value: string | null) {
  if (!value) return null;
  return formatDay(value.slice(0, 10));
}

export function kindLabel(kind: SegmentKind) {
  if (kind === "flight") return "Flight";
  if (kind === "stay") return "Stay";
  return "Reservation";
}
