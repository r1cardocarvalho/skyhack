import { deleteVisaEntry, findVisa, importVisa } from "@/app/actions";
import { Icon } from "@/components/icons";
import { PanelHead } from "@/components/panel-head";
import { buttonClass, fieldClass } from "@/components/shell";
import { formatStay, type TripDocument, type VisaEntry, type VisaForm } from "@/lib/trips";

export function VisaPanel({
  tripId,
  stops,
  entries,
  passport,
  disclaimer,
  files,
  links,
}: {
  tripId: string;
  stops: number;
  entries: VisaEntry[];
  passport: string;
  disclaimer: string | null;
  files: TripDocument[];
  links: Map<string, string>;
}) {
  return (
    <div className="split">
      <div className="split-main">
        {entries.length === 0 ? (
          <div className="empty-state">
            <span className="icon-tile">
              <Icon name="visa" size={22} />
            </span>
            <strong>No visa records yet</strong>
            <p>Check each country, then upload the visa if you need one.</p>
          </div>
        ) : (
          <section className="stack">
            <h2 className="section-title">Countries</h2>
            {disclaimer ? <p className="note">{disclaimer}</p> : null}
            <ul className="card-grid">
              {entries.map((entry) => (
                <VisaCard key={entry.id} tripId={tripId} entry={entry} documentHref={entry.document_id ? links.get(entry.document_id) : undefined} />
              ))}
            </ul>
          </section>
        )}
      </div>
      <aside className="split-side">
        <form action={findVisa.bind(null, tripId)} className="panel">
          <PanelHead
            icon="visa"
            title="Check each country"
            hint="The visa agent looks up whether this passport needs a visa, then saves one record per country."
          />
          {stops === 0 ? (
            <p className="note">Add a city on Stays first.</p>
          ) : (
            <>
              <label className="field-label" htmlFor="passport">
                Passport country
              </label>
              <input
                id="passport"
                name="passport"
                className={fieldClass}
                defaultValue={passport}
                placeholder="Portugal"
                maxLength={60}
                required
              />
              <button type="submit" className={`${buttonClass} btn-block`}>
                <Icon name="sparkle" size={16} />
                {entries.length > 0 ? "Look again" : "Check visas"}
              </button>
            </>
          )}
        </form>
        <form action={importVisa.bind(null, tripId)} className="panel">
          <PanelHead
            icon="upload"
            title="Upload the visa"
            hint="Upload the PDF. The country and how many days you can stay are read from the file."
          />
          <input name="visa" type="file" accept="application/pdf,.pdf" required className={fieldClass} />
          <button type="submit" className={`${buttonClass} btn-block`}>
            Read visa
          </button>
        </form>
        {files.length > 0 ? (
          <section className="panel">
            <PanelHead icon="document" title="Saved visas" />
            <ul className="doc-list">
              {files.map((file) => {
                const href = links.get(file.id);
                return (
                  <li key={file.id}>
                    {href ? (
                      <a href={href} className="doc-link" target="_blank" rel="noreferrer">
                        <Icon name="document" size={15} />
                        {file.filename}
                      </a>
                    ) : (
                      <span>
                        <Icon name="document" size={15} />
                        {file.filename}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </aside>
    </div>
  );
}

function VisaCard({
  tripId,
  entry,
  documentHref,
}: {
  tripId: string;
  entry: VisaEntry;
  documentHref?: string;
}) {
  const where = [entry.cities.join(", "), entry.dates].filter(Boolean).join(" · ");
  const validity = formatStay(entry.valid_from, entry.valid_until);
  const forms = entry.forms.filter((form) => form.name && form.href);

  return (
    <li className="sim-card">
      <div className="trip-tile-head">
        <span className="icon-tile icon-tile-sm">
          <Icon name="visa" size={18} />
        </span>
        <span className="trip-tile-text">
          <strong>{entry.country}</strong>
          {where ? <span className="place">{where}</span> : null}
        </span>
      </div>
      <span className={entry.needed ? "pill pill-warn" : entry.needed === false ? "pill pill-accent" : "pill"}>
        {neededLabel(entry.needed)}
      </span>
      <p className="place">{entry.requirement}</p>
      {entry.stay ? <p className="place">{entry.stay}</p> : null}
      {entry.passport_rule ? <p className="place">{entry.passport_rule}</p> : null}
      {forms.map((form) => (
        <FormLine key={`${form.name}-${form.href}`} form={form} />
      ))}
      {entry.next_step ? <p className="place">{entry.next_step}</p> : null}
      {entry.source && entry.source_href ? (
        <a href={entry.source_href} className="doc-link" target="_blank" rel="noreferrer">
          <Icon name="external" size={14} />
          {entry.source}
        </a>
      ) : null}
      {entry.document_id ? (
        <div className="stack">
          <p className="kicker">From the visa</p>
          {entry.visa_type || entry.entries ? (
            <p className="place">{[entry.visa_type, entry.entries].filter(Boolean).join(" · ")}</p>
          ) : null}
          {entry.stay_days ? (
            <p className="place">
              {entry.stay_days} {entry.stay_days === 1 ? "day" : "days"} in {entry.country}
            </p>
          ) : null}
          {validity ? <p className="place">Valid {validity}</p> : null}
          {entry.document_notes ? <p className="hint">{entry.document_notes}</p> : null}
          {documentHref ? (
            <a href={documentHref} className="doc-link" target="_blank" rel="noreferrer">
              <Icon name="document" size={14} />
              Original
            </a>
          ) : null}
        </div>
      ) : null}
      <form action={deleteVisaEntry.bind(null, tripId, entry.id)}>
        <button type="submit" className="btn-quiet">
          <Icon name="close" size={14} />
          Remove
        </button>
      </form>
    </li>
  );
}

function FormLine({ form }: { form: VisaForm }) {
  return (
    <p className="place">
      {form.name}
      {form.when ? ` · ${form.when}` : ""}
      {form.note ? `. ${form.note}` : ""}{" "}
      <a href={form.href} className="doc-link" target="_blank" rel="noreferrer">
        Official form
      </a>
    </p>
  );
}

function neededLabel(needed: boolean | null) {
  if (needed === true) return "Visa needed";
  if (needed === false) return "No visa needed";
  return "Not verified";
}

export function visaEntriesFromRows(rows: unknown): VisaEntry[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const record = row as Record<string, unknown>;
    if (typeof record.id !== "string" || typeof record.country !== "string" || typeof record.requirement !== "string") {
      return [];
    }
    return [
      {
        id: record.id,
        trip_id: typeof record.trip_id === "string" ? record.trip_id : "",
        country: record.country,
        cities: stringsOf(record.cities),
        dates: textOf(record.dates),
        needed: record.needed === true ? true : record.needed === false ? false : null,
        requirement: record.requirement,
        stay: textOf(record.stay),
        passport_rule: textOf(record.passport_rule),
        forms: formsOf(record.forms),
        next_step: textOf(record.next_step),
        source: textOf(record.source),
        source_href: textOf(record.source_href),
        passport: textOf(record.passport),
        document_id: typeof record.document_id === "string" ? record.document_id : null,
        visa_type: textOf(record.visa_type),
        valid_from: textOf(record.valid_from),
        valid_until: textOf(record.valid_until),
        stay_days: daysOf(record.stay_days),
        entries: textOf(record.entries),
        document_notes: textOf(record.document_notes),
        position: typeof record.position === "number" ? record.position : 0,
      },
    ];
  });
}

function textOf(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringsOf(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => (typeof item === "string" && item.trim() ? [item.trim()] : []));
}

function daysOf(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return null;
}

function formsOf(value: unknown): VisaForm[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const form = item as Record<string, unknown>;
    const name = textOf(form.name);
    const href = textOf(form.href);
    if (!name || !href) return [];
    return [{ name, when: textOf(form.when) ?? "", href, note: textOf(form.note) ?? "" }];
  });
}
