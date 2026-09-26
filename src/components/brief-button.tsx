"use client";

import { useFormStatus } from "react-dom";
import { briefDestination } from "@/app/actions";
import { buttonClass } from "@/components/ui";

export function BriefButton({
  tripId,
  ready,
  again,
}: {
  tripId: string;
  ready: boolean;
  again: boolean;
}) {
  return (
    <form action={briefDestination.bind(null, tripId)} className="brief-call">
      <BriefSubmit ready={ready} again={again} />
    </form>
  );
}

function BriefSubmit({ ready, again }: { ready: boolean; again: boolean }) {
  const { pending } = useFormStatus();

  if (!ready) {
    return <p className="hint">Add a city on Stays first.</p>;
  }

  return (
    <>
      <button type="submit" className={buttonClass} disabled={pending}>
        {pending ? "Getting the briefing…" : again ? "Brief again" : "Get the briefing"}
      </button>
      {pending ? (
        <p className="hint">Sending this trip and the prompts. This can take a couple of minutes.</p>
      ) : null}
    </>
  );
}
