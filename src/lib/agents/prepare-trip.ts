import { simAgent } from "@/lib/agents/sim";
import { loadTrip } from "@/lib/agents/trip-context";
import { supabase } from "@/lib/trips";

export async function prepareTrip(tripId: string) {
  const trip = await loadTrip(tripId);
  if (!trip) throw new Error("missing-trip");
  if (trip.stops.length === 0) throw new Error("no-stops");

  const brief = await simAgent(trip);
  const db = await supabase();
  const { error } = await db.from("trip_briefs").upsert(
    {
      trip_id: tripId,
      kind: "sim",
      payload: brief,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "trip_id,kind" },
  );

  if (error) throw new Error("save");
  return brief;
}
