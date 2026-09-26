import { supabase } from "@/lib/trips";

export async function saveBrief(
  tripId: string,
  kind: "sim" | "visa" | "scams" | "terminals" | "rides" | "chargers",
  payload: unknown,
) {
  const db = await supabase();
  const { error } = await db.from("trip_briefs").upsert(
    {
      trip_id: tripId,
      kind,
      payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "trip_id,kind" },
  );
  if (error) throw new Error("save");
}
