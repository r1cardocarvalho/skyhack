import { deleteInsurancePolicy, importInsurance } from "@/app/actions";
import { Icon } from "@/components/icons";
import { PanelHead } from "@/components/panel-head";
import { buttonClass, fieldClass } from "@/components/shell";
import { formatStay, type InsurancePolicy, type TripDocument } from "@/lib/trips";

export function InsurancePanel({
  tripId,
  policies,
  files,
  links,
}: {
  tripId: string;
  policies: InsurancePolicy[];
  files: TripDocument[];
  links: Map<string, string>;
}) {
  return (
    <div className="split">
      <div className="split-main">
        {policies.length === 0 ? (
          <div className="empty-state">
            <span className="icon-tile">
              <Icon name="shield" size={22} />
            </span>
            <strong>No insurance yet</strong>
            <p>Upload the medical insurance PDF and the policy details are saved here.</p>
          </div>
        ) : (
          <section className="stack">
            <h2 className="section-title">Policies</h2>
            <ul className="card-grid">
              {policies.map((policy) => (
                <PolicyCard
                  key={policy.id}
                  tripId={tripId}
                  policy={policy}
                  documentHref={policy.document_id ? links.get(policy.document_id) : undefined}
                />
              ))}
            </ul>
          </section>
        )}
      </div>
      <aside className="split-side">
        <form action={importInsurance.bind(null, tripId)} className="panel">
          <PanelHead
            icon="upload"
            title="Upload medical insurance"
            hint="Upload the PDF. The insurer, policy number, dates, and assistance phone are read from the file."
          />
          <input name="insurance" type="file" accept="application/pdf,.pdf" required className={fieldClass} />
          <button type="submit" className={`${buttonClass} btn-block`}>
            Read policy
          </button>
        </form>
        {files.length > 0 ? (
          <section className="panel">
            <PanelHead icon="document" title="Saved policies" />
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

function PolicyCard({
  tripId,
  policy,
  documentHref,
}: {
  tripId: string;
  policy: InsurancePolicy;
  documentHref?: string;
}) {
  const validity = formatStay(policy.valid_from, policy.valid_until);
  const title = policy.plan ? `${policy.insurer} · ${policy.plan}` : policy.insurer;

  return (
    <li className="sim-card">
      <div className="trip-tile-head">
        <span className="icon-tile icon-tile-sm">
          <Icon name="shield" size={18} />
        </span>
        <span className="trip-tile-text">
          <strong>{title}</strong>
          {policy.holder ? <span className="place">{policy.holder}</span> : null}
        </span>
      </div>
      {policy.policy_number ? <p className="place">Policy {policy.policy_number}</p> : null}
      {validity ? <p className="place">Covered {validity}</p> : null}
      {policy.territory ? <p className="place">{policy.territory}</p> : null}
      {policy.coverage ? <p className="place">Medical cover {policy.coverage}</p> : null}
      {policy.deductible ? <p className="place">Excess {policy.deductible}</p> : null}
      {policy.emergency_phone ? <p className="place">Assistance {policy.emergency_phone}</p> : null}
      {policy.notes ? <p className="hint">{policy.notes}</p> : null}
      {documentHref ? (
        <a href={documentHref} className="doc-link" target="_blank" rel="noreferrer">
          <Icon name="document" size={14} />
          Original
        </a>
      ) : null}
      <form action={deleteInsurancePolicy.bind(null, tripId, policy.id)}>
        <button type="submit" className="btn-quiet">
          <Icon name="close" size={14} />
          Remove
        </button>
      </form>
    </li>
  );
}

export function insurancePoliciesFromRows(rows: unknown): InsurancePolicy[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const record = row as Record<string, unknown>;
    if (typeof record.id !== "string" || typeof record.insurer !== "string") return [];
    return [
      {
        id: record.id,
        trip_id: typeof record.trip_id === "string" ? record.trip_id : "",
        document_id: typeof record.document_id === "string" ? record.document_id : null,
        insurer: record.insurer,
        plan: textOf(record.plan),
        policy_number: textOf(record.policy_number),
        holder: textOf(record.holder),
        valid_from: textOf(record.valid_from),
        valid_until: textOf(record.valid_until),
        emergency_phone: textOf(record.emergency_phone),
        coverage: textOf(record.coverage),
        deductible: textOf(record.deductible),
        territory: textOf(record.territory),
        notes: textOf(record.notes),
        position: typeof record.position === "number" ? record.position : 0,
      },
    ];
  });
}

function textOf(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
