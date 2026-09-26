import Link from "next/link";
import { findChargers, findRides, findScams, findSim, findTerminals } from "@/app/actions";
import { Icon, type IconName } from "@/components/icons";
import { PanelHead } from "@/components/panel-head";
import { buttonClass } from "@/components/shell";
import type { ChargerBrief } from "@/lib/agents/chargers";
import type { RideBrief, RideVerdict } from "@/lib/agents/rides";
import type { ScamBrief } from "@/lib/agents/scams";
import type { SimBrief } from "@/lib/agents/sim";
import type { TerminalBrief } from "@/lib/agents/terminals";
export const AGENT_KEYS = ["sim", "scams", "rides", "terminals", "chargers"] as const;

export type AgentKey = (typeof AGENT_KEYS)[number];

type Results = {
  sim: SimBrief | null;
  scams: ScamBrief | null;
  rides: RideBrief | null;
  terminals: TerminalBrief | null;
  chargers: ChargerBrief | null;
};

const AGENTS: { key: AgentKey; title: string; icon: IconName; hint: string }[] = [
  { key: "sim", title: "SIM or eSIM", icon: "sim", hint: "The local SIM travelers recommend in each country." },
  { key: "scams", title: "Usual scams", icon: "pin", hint: "The scams a new arrival usually meets." },
  { key: "rides", title: "Getting around", icon: "car", hint: "Leaving the airport and moving around town." },
  { key: "terminals", title: "Departure terminals", icon: "plane", hint: "The terminal each flight leaves from." },
  { key: "chargers", title: "Plugs & chargers", icon: "plug", hint: "Socket types, voltage, frequency, adapters, and converters." },
];

export function AgentsPanel({
  tripId,
  agent,
  stops,
  flights,
  results,
}: {
  tripId: string;
  agent: AgentKey | null;
  stops: number;
  flights: number;
  results: Results;
}) {
  const current = AGENTS.find((item) => item.key === agent);

  if (!current) {
    return (
      <section className="agents">
        <div className="agents-head">
          <p className="kicker">Specialized Agents</p>
          <h2 className="section-title">Pick an agent</h2>
          <p className="hint">Each agent looks up one thing for this trip. Open one to run it and read the answer.</p>
        </div>
        <ul className="trip-grid">
          {AGENTS.map((item) => {
            const ready = Boolean(results[item.key]);
            return (
              <li key={item.key}>
                <Link href={`/trips/${tripId}?tab=sim&agent=${item.key}`} className="trip-tile agent-tile">
                  <div className="trip-tile-head">
                    <span className="icon-tile">
                      <Icon name={item.icon} size={22} />
                    </span>
                    <span className="trip-tile-text">
                      <strong>{item.title}</strong>
                      <span className="place">{item.hint}</span>
                    </span>
                  </div>
                  <span className={ready ? "pill pill-accent" : "pill"}>{ready ? "Answer ready" : "Not run yet"}</span>
                  <span className={buttonClass}>Open</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  return (
    <section className="stack">
      <Link href={`/trips/${tripId}?tab=sim`} className="back">
        <Icon name="back" size={16} />
        All agents
      </Link>
      <div className="split">
        <div className="split-main">
          <AgentResult agent={current.key} results={results} />
        </div>
        <aside className="split-side">
          <AgentForm
            tripId={tripId}
            agent={current.key}
            title={current.title}
            icon={current.icon}
            stops={stops}
            flights={flights}
            results={results}
          />
        </aside>
      </div>
    </section>
  );
}

function AgentForm({
  tripId,
  agent,
  title,
  icon,
  stops,
  flights,
  results,
}: {
  tripId: string;
  agent: AgentKey;
  title: string;
  icon: IconName;
  stops: number;
  flights: number;
  results: Results;
}) {
  const again = Boolean(results[agent]);

  if (agent === "terminals") {
    return (
      <form action={findTerminals.bind(null, tripId)} className="panel">
        <PanelHead icon={icon} title={title} hint="For each flight, looks up the terminal you leave from." />
        {flights === 0 ? (
          <p className="note">Add a flight on Planes first.</p>
        ) : (
          <RunButton label={again ? "Look again" : "Find terminals"} />
        )}
      </form>
    );
  }

  const byAgent = {
    sim: {
      action: findSim,
      hint: "For each country, looks up the local SIM travelers recommend on Reddit. A price is shown only when a thread names one.",
      label: "Find a SIM",
    },
    scams: {
      action: findScams,
      hint: "For each country, lists the scams a new arrival usually meets.",
      label: "Check usual scams",
    },
    rides: {
      action: findRides,
      hint: "For each country, compares Bolt, Uber, taxis, and tuk-tuks, at the airport and around town.",
      label: "Find rides",
    },
    chargers: {
      action: findChargers,
      hint: "For each country, checks plug types, voltage, frequency, adapters, and voltage converters.",
      label: "Check plugs",
    },
  }[agent];

  return (
    <form action={byAgent.action.bind(null, tripId)} className="panel">
      <PanelHead icon={icon} title={title} hint={byAgent.hint} />
      {stops === 0 ? (
        <p className="note">Add a city on Stays first.</p>
      ) : (
        <RunButton label={again ? "Look again" : byAgent.label} />
      )}
    </form>
  );
}

function RunButton({ label }: { label: string }) {
  return (
    <button type="submit" className={`${buttonClass} btn-block`}>
      <Icon name="sparkle" size={16} />
      {label}
    </button>
  );
}

function AgentResult({ agent, results }: { agent: AgentKey; results: Results }) {
  if (agent === "sim") return <SimResult brief={results.sim} />;
  if (agent === "scams") return <ScamResult brief={results.scams} />;
  if (agent === "rides") return <RideResult brief={results.rides} />;
  if (agent === "chargers") return <ChargerResult brief={results.chargers} />;
  return <TerminalResult brief={results.terminals} />;
}

function Empty({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return (
    <div className="empty-state">
      <span className="icon-tile">
        <Icon name={icon} size={22} />
      </span>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

function Source({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className="doc-link" target="_blank" rel="noreferrer">
      <Icon name="external" size={14} />
      {label}
    </a>
  );
}

function SimResult({ brief }: { brief: SimBrief | null }) {
  if (!brief) {
    return <Empty icon="sim" title="No SIM picks yet" text="Run the lookup to see what travelers recommend for each country." />;
  }
  return (
    <section className="stack">
      <h2>SIM or eSIM</h2>
      <p>{brief.summary}</p>
      <p className="note">{brief.buyBefore}</p>
      <ul className="card-grid">
        {brief.places.map((place) => (
          <li key={`${place.country}-${place.provider}`} className="sim-card">
            <div className="trip-tile-head">
              <span className="icon-tile icon-tile-sm">
                <Icon name="sim" size={18} />
              </span>
              <span className="trip-tile-text">
                <strong>{place.provider}</strong>
                <span className="place">
                  {place.country} · {place.cities.join(", ")}
                </span>
              </span>
            </div>
            <div className="sim-tags">
              <span className="pill pill-accent">{place.type === "esim" ? "eSIM" : "Local SIM"}</span>
              <span className="pill">{place.data}</span>
              <span className="pill">{place.validity}</span>
              {place.price ? <span className="pill">{place.price}</span> : null}
              <span className="pill">{place.hotspot ? "Hotspot" : "No hotspot"}</span>
              <span className="pill">{place.sms ? "SMS" : "Data only"}</span>
            </div>
            <p className="place">{place.why}</p>
            <Source href={place.href} label={place.source} />
          </li>
        ))}
      </ul>
      <p className="hint">{brief.keepHomeSim}</p>
    </section>
  );
}

function ScamResult({ brief }: { brief: ScamBrief | null }) {
  if (!brief) {
    return <Empty icon="pin" title="No scam notes yet" text="Run the lookup for the usual scams in each country." />;
  }
  return (
    <section className="stack">
      <h2>Usual scams</h2>
      <p>{brief.summary}</p>
      {brief.places.map((place) => (
        <div key={place.country}>
          <h3 className="day-heading">{place.country}</h3>
          <p className="note">{place.cities.join(", ")}</p>
          <ul className="card-grid">
            {place.scams.map((scam) => (
              <li key={`${place.country}-${scam.name}`} className="sim-card">
                <strong>{scam.name}</strong>
                <p className="place">{scam.where}</p>
                <p className="place">{scam.how}</p>
                <p className="place">Red flag: {scam.redFlag}</p>
                <p className="place">{scam.instead}</p>
                <Source href={scam.href} label={scam.source} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function RideResult({ brief }: { brief: RideBrief | null }) {
  if (!brief) {
    return (
      <Empty
        icon="car"
        title="No ride notes yet"
        text="Run the lookup to see how to leave the airport and get around in each country."
      />
    );
  }
  return (
    <section className="stack">
      <h2>Getting around</h2>
      <p>{brief.summary}</p>
      {brief.places.map((place) => (
        <div key={place.country}>
          <h3 className="day-heading">{place.country}</h3>
          <p className="note">{place.cities.join(", ")}</p>
          <ul className="card-grid">
            <li className="sim-card">
              <div className="trip-tile-head">
                <span className="icon-tile icon-tile-sm">
                  <Icon name="plane" size={18} />
                </span>
                <span className="trip-tile-text">
                  <strong>From the airport: {place.airport.best}</strong>
                  <span className="place">{place.country}</span>
                </span>
              </div>
              <p className="place">{place.airport.how}</p>
              <p className="place">Skip: {place.airport.skip}</p>
              <Source href={place.airport.href} label={place.airport.source} />
            </li>
            <li className="sim-card">
              <div className="trip-tile-head">
                <span className="icon-tile icon-tile-sm">
                  <Icon name="car" size={18} />
                </span>
                <span className="trip-tile-text">
                  <strong>Around town: {place.around.best}</strong>
                  <span className="place">{place.around.pay}</span>
                </span>
              </div>
              <div className="sim-tags">
                {place.around.options.map((option) => (
                  <span key={option.name} className={option.verdict === "best" ? "pill pill-accent" : "pill"}>
                    {option.name} · {verdictLabel(option.verdict)}
                  </span>
                ))}
              </div>
              {place.around.options.map((option) => (
                <p key={`${option.name}-note`} className="place">
                  {option.name}: {option.note}
                </p>
              ))}
              <Source href={place.around.href} label={place.around.source} />
            </li>
          </ul>
        </div>
      ))}
    </section>
  );
}

function TerminalResult({ brief }: { brief: TerminalBrief | null }) {
  if (!brief) {
    return (
      <Empty icon="plane" title="No terminals yet" text="Run the lookup to see which terminal each flight leaves from." />
    );
  }
  return (
    <section className="stack">
      <h2>Departure terminals</h2>
      <p>{brief.summary}</p>
      <ul className="card-grid">
        {brief.flights.map((flight) => (
          <li key={`${flight.title}-${flight.departs}`} className="sim-card">
            <div className="trip-tile-head">
              <span className="icon-tile icon-tile-sm">
                <Icon name="plane" size={18} />
              </span>
              <span className="trip-tile-text">
                <strong>{flight.terminal}</strong>
                <span className="place">
                  {flight.title} · {flight.route}
                </span>
              </span>
            </div>
            <p className="place">{flight.airport}</p>
            <p className="place">{flight.departs}</p>
            <p className="place">{flight.note}</p>
            <Source href={flight.href} label={flight.source} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ChargerResult({ brief }: { brief: ChargerBrief | null }) {
  if (!brief) {
    return (
      <Empty
        icon="plug"
        title="No plug notes yet"
        text="Run the lookup to check sockets, voltage, and frequency in each country."
      />
    );
  }
  return (
    <section className="stack">
      <h2>Plugs & chargers</h2>
      <p>{brief.summary}</p>
      <ul className="card-grid">
        {brief.places.map((place) => (
          <li key={place.country} className="sim-card">
            <div className="trip-tile-head">
              <span className="icon-tile icon-tile-sm">
                <Icon name="plug" size={18} />
              </span>
              <span className="trip-tile-text">
                <strong>{place.country}</strong>
                <span className="place">{place.cities.join(", ")}</span>
              </span>
            </div>
            <div className="sim-tags">
              {place.plugTypes.map((plug) => (
                <span key={plug} className="pill pill-accent">
                  Type {plug}
                </span>
              ))}
              <span className="pill">{place.voltage}</span>
              <span className="pill">{place.frequency}</span>
            </div>
            <p className="place">
              <strong>Adapter:</strong> {place.adapter}
            </p>
            <p className="place">
              <strong>Voltage:</strong> {place.converter}
            </p>
            <p className="note">{place.safety}</p>
            <Source href={place.href} label={place.source} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function verdictLabel(verdict: RideVerdict) {
  if (verdict === "best") return "Best";
  if (verdict === "works") return "Works";
  if (verdict === "skip") return "Skip";
  return "Not here";
}
