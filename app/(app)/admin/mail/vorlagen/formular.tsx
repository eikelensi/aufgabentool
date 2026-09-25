"use client";

/**
 * Betreff und Text jeder Mail, die das Tool von sich aus verschickt.
 */

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Field } from "@/components/ui";
import { NOTIFY_LABEL, type NotifyKind } from "@/lib/types";

const PLATZHALTER = [
  "{{titel}}",
  "{{empfaenger}}",
  "{{bearbeiter}}",
  "{{ersteller}}",
  "{{notiz}}",
  "{{objekt}}",
  "{{datum}}",
  "{{tage}}",
];

export default function VorlagenFormular() {
  const { isAdmin, templates, updateTemplate } = useStore();
  const [offen, setOffen] = useState<NotifyKind | null>(null);

  if (!isAdmin) return <p className="muted text-sm">Dieser Bereich ist Admins vorbehalten.</p>;

  return (
    <section className="panel p-4" style={{ maxWidth: 820 }}>
      <p className="muted mb-3 text-[11px] leading-relaxed">
        Platzhalter werden beim Verschicken ersetzt:{" "}
        {PLATZHALTER.map((p, i) => (
          <span key={p}>
            {i > 0 ? " · " : ""}
            <code>{p}</code>
          </span>
        ))}
      </p>

      <ul className="space-y-2">
        {templates.map((t) => (
          <li key={t.key} className="line rounded-lg border p-2">
            <div className="flex items-center gap-2">
              <button
                className="btn btn-ghost"
                onClick={() => setOffen(offen === t.key ? null : t.key)}
                aria-expanded={offen === t.key}
              >
                {offen === t.key ? "▾" : "▸"}
              </button>
              <span className="flex-1 text-[13px] font-medium">{NOTIFY_LABEL[t.key]}</span>
              <label className="muted flex items-center gap-1 text-[11px]">
                <input
                  type="checkbox"
                  checked={t.isActive}
                  onChange={(e) => updateTemplate(t.key, { isActive: e.target.checked })}
                />
                aktiv
              </label>
            </div>
            {offen === t.key ? (
              <div className="mt-2 grid gap-2">
                <Field label="Betreff">
                  <input
                    className="field"
                    value={t.subject}
                    onChange={(e) => updateTemplate(t.key, { subject: e.target.value })}
                  />
                </Field>
                <Field label="Text">
                  <textarea
                    className="field"
                    rows={7}
                    value={t.body}
                    onChange={(e) => updateTemplate(t.key, { body: e.target.value })}
                  />
                </Field>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
