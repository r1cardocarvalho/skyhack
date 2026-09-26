"use client";

import { useState } from "react";
import { fieldClass } from "@/components/ui";

export function NextStopDates({ previousEnd }: { previousEnd: string | null }) {
  const [startsOn, setStartsOn] = useState(previousEnd ?? "");
  const [endsOn, setEndsOn] = useState("");

  return (
    <>
      <label className="field-label">
        From
        <input
          name="starts_on"
          type="date"
          required
          value={startsOn}
          min={previousEnd ?? undefined}
          onChange={(event) => {
            const next = event.target.value;
            setStartsOn(next);
            if (endsOn && next && endsOn < next) setEndsOn("");
          }}
          className={fieldClass}
        />
      </label>
      <label className="field-label">
        To
        <input
          name="ends_on"
          type="date"
          required
          value={endsOn}
          min={startsOn || previousEnd || undefined}
          onChange={(event) => setEndsOn(event.target.value)}
          className={fieldClass}
        />
      </label>
    </>
  );
}
