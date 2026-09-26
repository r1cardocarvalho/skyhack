"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { buttonClass, fieldClass } from "@/components/ui";

export function TicketFiles({
  action,
}: {
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [files, setFiles] = useState<File[]>([]);

  function add(list: FileList | null) {
    const picked = [...(list ?? [])];
    setFiles((current) => {
      const next = [...current];
      for (const file of picked) {
        const same = next.some(
          (item) =>
            item.name === file.name &&
            item.size === file.size &&
            item.lastModified === file.lastModified,
        );
        if (!same) next.push(file);
      }
      return next;
    });
  }

  function submit(formData: FormData) {
    formData.delete("tickets");
    for (const file of files) formData.append("tickets", file);
    return action(formData);
  }

  return (
    <form action={submit} className="panel">
      <div className="panel-head">
        <span className="icon-tile icon-tile-sm">
          <Icon name="upload" size={18} />
        </span>
        <div>
          <h2>Upload plane tickets</h2>
          <p className="hint">
            Pick the PDFs. Choosing more files adds them to this list. Tickets already on the trip stay.
          </p>
        </div>
      </div>
      <input
        name="tickets"
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className={fieldClass}
        onChange={(event) => {
          add(event.target.files);
          event.target.value = "";
        }}
      />
      {files.length > 0 ? (
        <ul className="doc-list">
          {files.map((file) => (
            <li key={`${file.name}-${file.size}-${file.lastModified}`}>
              <span>
                <Icon name="document" size={15} />
                {file.name}
              </span>
              <button
                type="button"
                className="btn-quiet"
                onClick={() => setFiles((current) => current.filter((item) => item !== file))}
              >
                <Icon name="close" size={14} />
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <button type="submit" className={`${buttonClass} btn-block`} disabled={files.length === 0}>
        Import tickets
      </button>
    </form>
  );
}
