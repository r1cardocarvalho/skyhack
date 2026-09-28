# SKYHACK 2026

[skyhack.lxlaunch.com](https://skyhack.lxlaunch.com/)

Sep 26, 2026 · Impact Hub Lisbon · 10 hours · 50 hackers

**Tracks:** Healthcare · AI Agents

**Freeze:** 19:00 · **Demos:** 20:00

**Prizes:** €1,500 / €500 per track, plus €500 overall

## What we're building

An AI-native [TripIt](https://www.tripit.com/web/free).

TripIt turns booking emails into one itinerary. We do the same with an agent: drop in confirmations, and it builds the trip, keeps it current, and answers "what's next?"

**Now:** Next.js + Supabase. **AI:** later, if there's time.

## Ideas

Travel agent assistant:

- Different time zones
- Flights and reservations
- SIM card
- Chargers up front
- Interests
- Events happening around you
- Common scams
- Personalised documents
- Visa information
- Days spent in a country
- Flight delays and terminal info

## Cursor skill

Destination intel (SIM, plugs, scams, visas, emergencies) lives in [`.cursor/skills/destination-briefing/`](.cursor/skills/destination-briefing/). Fill `#USERINFO` in that folder (or User Rules) so briefings follow the traveler's passport and diet. See [`AGENTS.md`](AGENTS.md).

## Run it locally

You need [Node.js](https://nodejs.org), [Docker Desktop](https://www.docker.com/products/docker-desktop/) (open and running), and the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started).

```bash
git clone git@github.com:r1cardocarvalho/skyhack.git
cd skyhack
npm install
cp .env.example .env.local
supabase start
```

`supabase start` prints the local keys. Paste them into `.env.local`:

- `API_URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `PUBLISHABLE_KEY` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SECRET_KEY` → `SUPABASE_SECRET_KEY`

Plane tickets, bookings, and prescriptions are read with an Azure OpenAI key in `AZURE_OPENAI_API_KEY`. `AZURE_OPENAI_MODEL` is the deployment name, `gpt-5.6-terra` unless the portal shows a different one. Without that key, a text PDF still falls back to the text parser.

Then:

```bash
npm run dev
```

App: http://localhost:3000

Supabase Studio: http://127.0.0.1:57323

Next time, Docker and `supabase start` are enough before `npm run dev`. Stop the database with `supabase stop`.
