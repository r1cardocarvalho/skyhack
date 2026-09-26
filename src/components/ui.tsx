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
  stops: "Add a city on Stays before looking up a SIM.",
  sim: "Could not look up a SIM for this trip. Try again in a moment.",
  quota: "The model quota is used up, so the SIM lookup could not run.",
  passport: "Say which passport you travel on before checking visas.",
  visa: "Could not check visas for this trip. Try again in a moment.",
  "visa-stops": "Add a city on Stays before checking visas.",
  "visa-quota": "The model quota is used up, so the visa check could not run.",
  "visa-file": "Could not read a visa in that PDF. The file is saved on the trip. It needs the country.",
  scams: "Could not look up usual scams for this trip. Try again in a moment.",
  "scams-stops": "Add a city on Stays before looking up scams.",
  "scams-quota": "The model quota is used up, so the scam lookup could not run.",
  rides: "Could not look up rides for this trip. Try again in a moment.",
  "rides-stops": "Add a city on Stays before looking up rides.",
  "rides-quota": "The model quota is used up, so the ride lookup could not run.",
  chargers: "Could not look up plugs and chargers for this trip. Try again in a moment.",
  "chargers-stops": "Add a city on Stays before checking plugs and chargers.",
  "chargers-quota": "The model quota is used up, so the charger lookup could not run.",
  terminals: "Could not look up departure terminals for this trip. Try again in a moment.",
  "terminals-flights": "Add a flight on Planes before looking up terminals.",
  "terminals-quota": "The model quota is used up, so the terminal lookup could not run.",
  "brief-stops": "Add a city on Stays before the briefing.",
  brief: "Could not write the briefing. Try again in a moment.",
  "brief-quota": "The model quota is used up, so the briefing could not run.",
  chat: "Could not answer that. Try again in a moment.",
  "chat-quota": "The model quota is used up, so the chat could not answer.",
  "chat-key": "The model key is missing, so the chat could not answer.",
  ticket: "Could not read a flight in that PDF. The file is saved on the trip. It needs the airports and a date.",
  prescription: "Could not find a medicine in that PDF. The file is saved on the trip.",
  insurance: "Could not read an insurance policy in that PDF. The file is saved on the trip. It needs the insurer.",
  channel: "Add a Telegram username or a WhatsApp number.",
  whatsapp: "Use a WhatsApp number with the country code, such as +351 910 000 000.",
  telegram: "Use a Telegram username, such as @ricardo, or a phone number with the country code.",
  auth: "Check the email and password. Passwords need at least 6 characters.",
};

export const fieldClass = "field";

export const buttonClass = "btn";
