export function ErrorNote({ code }: { code?: string }) {
  const message = code ? ERRORS[code] : null;
  if (!message) return null;
  return (
    <p role="alert" className="alert">
      {message}
    </p>
  );
}

const ERRORS: Record<string, string> = {
  title: "Give the trip a name.",
  dates: "The end has to be on or after the start.",
  save: "Could not save that. Check that Supabase is running.",
  "segment-title": "Give the booking a name.",
  destination: "Each stop needs a city and the days you are there.",
  ticket: "Could not read a flight in that PDF. The file is saved on the trip. It needs the airports and a date.",
  auth: "Check the email and password. Passwords need at least 6 characters.",
};

export const fieldClass = "field";

export const buttonClass = "btn";
