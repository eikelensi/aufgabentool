"use client";

/**
 * Anhaenge an Aufgaben: wie gross, und ob sie zusaetzlich nach
 * onOffice gehen.
 */

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Field } from "@/components/ui";

export default function DateienFormular() {
  const { isAdmin, settings, updateSettings, runAttachmentSync } = useStore();
  const [lauf, setLauf] = useState<string | null>(null);

  if (!isAdmin) return <p className="muted text-sm">Dieser Bereich ist Admins vorbehalten.</p>;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="panel p-4">
        <h3 className="mb-1 text-sm font-semibold">Grenzen</h3>
        <p className="muted mb-3 text-[11px] leading-relaxed">
          Dateien liegen in einem privaten Speicher; heruntergeladen wird über Links mit
          kurzer Laufzeit.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Obergrenze je Datei (MB)">
            <input
              type="number"
              min={1}
              max={200}
              className="field"
              value={settings.attachmentMaxMb}
              onChange={(e) => updateSettings({ attachmentMaxMb: Number(e.target.value) })}
            />
          </Field>
          <Field
            label="Dateityp in onOffice"
            hint="Womit die Datei drüben beschriftet wird, z. B. „Dokument“."
          >
            <input
              className="field"
              value={settings.attachmentDefaultArt}
              onChange={(e) => updateSettings({ attachmentDefaultArt: e.target.value })}
            />
          </Field>
        </div>
      </section>

      <section className="panel p-4">
        <h3 className="mb-1 text-sm font-semibold">Weitergabe nach onOffice</h3>
        <label className="mt-1 flex items-start gap-2 text-xs leading-relaxed">
          <input
            type="checkbox"
            checked={settings.attachmentPushOnoffice}
            onChange={(e) => updateSettings({ attachmentPushOnoffice: e.target.checked })}
          />
          <span>
            Neue Dateien zusätzlich an die onOffice-Aufgabe hängen. Ausgeschaltet bleiben
            Anhänge ausschließlich im Aufgabentool.
          </span>
        </label>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            className="btn btn-primary"
            onClick={async () => {
              setLauf("Läuft…");
              const r = await runAttachmentSync();
              setLauf(
                r.meldung ??
                  (r.pushed === 0
                    ? "Keine Datei in der Warteschlange."
                    : `${r.pushed} Datei(en) nach onOffice übertragen.`),
              );
            }}
          >
            Warteschlange jetzt übertragen
          </button>
          {lauf ? <p className="muted text-[11px]">{lauf}</p> : null}
        </div>
      </section>

      <section
        className="line rounded-lg border p-3 text-[11px] leading-relaxed lg:col-span-2"
        style={{ background: "var(--panel-2)" }}
      >
        <p className="mb-1 font-semibold">Eine Grenze, die nicht an uns liegt</p>
        <p className="muted">
          Hochladen und Löschen von Aufgaben-Dateien kann die onOffice-Schnittstelle. Lesen
          und Herunterladen nicht – für Objekte und Adressen gibt es solche Aufrufe, für
          Aufgaben nicht. Dateien, die jemand direkt in onOffice an die Aufgabe hängt,
          erscheinen deshalb als „nur in onOffice“ und ohne Inhalt.
        </p>
      </section>
    </div>
  );
}
