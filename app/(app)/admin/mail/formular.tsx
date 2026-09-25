"use client";

/**
 * Der Versandweg und die Absender - wer schreibt, und in wessen Namen.
 *
 * Die Empfaengeradresse fuer die Pool-Meldung stand frueher unter
 * "Dateien an Aufgaben". Das war schlicht der falsche Ort; sie gehoert
 * zu dem, was verschickt wird.
 */

import { useStore } from "@/lib/store";
import { Field } from "@/components/ui";

export default function VersandFormular() {
  const { isAdmin, settings, updateSettings } = useStore();

  if (!isAdmin) return <p className="muted text-sm">Dieser Bereich ist Admins vorbehalten.</p>;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="panel p-4">
        <h3 className="mb-1 text-sm font-semibold">Weg und Absender</h3>
        <p className="muted mb-3 text-[11px] leading-relaxed">
          Über onOffice verschickt, landet die Mail auch dort im Postausgang. „Log“
          verschickt nichts und schreibt nur mit – gut zum Ausprobieren.
        </p>

        <div className="grid gap-3">
          <Field label="Versandweg">
            <select
              className="field"
              value={settings.mailProvider}
              onChange={(e) =>
                updateSettings({ mailProvider: e.target.value as typeof settings.mailProvider })
              }
            >
              <option value="onoffice">onOffice</option>
              <option value="smtp">SMTP</option>
              <option value="log">Log (nichts verschicken)</option>
            </select>
          </Field>
          <Field
            label="onOffice E-Mail-Identität"
            hint="Der Absender, den onOffice benutzt. Leer lassen nimmt die Voreinstellung des Mandanten."
          >
            <input
              className="field"
              value={settings.onofficeEmailIdentity}
              onChange={(e) => updateSettings({ onofficeEmailIdentity: e.target.value })}
            />
          </Field>
          <Field label="SMTP-Absender" hint="Greift nur, wenn der Versandweg SMTP ist.">
            <input
              className="field"
              value={settings.smtpFrom}
              onChange={(e) => updateSettings({ smtpFrom: e.target.value })}
            />
          </Field>
        </div>
      </section>

      <section className="panel p-4">
        <h3 className="mb-1 text-sm font-semibold">Wer erfährt vom Pool</h3>
        <p className="muted mb-3 text-[11px] leading-relaxed">
          Legt jemand eine Aufgabe mit Begründung zurück in den Pool, geht eine Meldung
          dorthin. Leer lassen schaltet sie ab.
        </p>
        <Field label="Empfänger der Pool-Meldung">
          <input
            className="field"
            type="email"
            value={settings.poolNotifyEmail}
            onChange={(e) => updateSettings({ poolNotifyEmail: e.target.value })}
            placeholder="hilfe@4-wk.de"
          />
        </Field>
      </section>
    </div>
  );
}
