"use client";

/**
 * Alles, was mit Zeit zu tun hat: wann erinnert wird, wann eskaliert
 * wird, wann Erledigtes verschwindet - und ab wann eine Aufgabe im
 * Pool auffaellt.
 *
 * Die vier Werte gehoeren zusammen, weil sie sich gegenseitig
 * bedingen: eine Eskalation vor der Erinnerung ergibt keinen Sinn,
 * ein roter Rand vor dem orangen auch nicht. Deshalb stehen sie auf
 * einer Seite und nicht verteilt.
 */

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Field } from "@/components/ui";

export default function FristenFormular() {
  const { isAdmin, settings, updateSettings, runEscalationJob } = useStore();
  const [lauf, setLauf] = useState<string | null>(null);

  if (!isAdmin) return <p className="muted text-sm">Dieser Bereich ist Admins vorbehalten.</p>;

  const reihenfolgeStimmt =
    settings.poolAlarmMinuten === 0 ||
    settings.poolWarnMinuten === 0 ||
    settings.poolAlarmMinuten > settings.poolWarnMinuten;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="panel p-4">
        <h3 className="mb-1 text-sm font-semibold">Erinnerung und Eskalation</h3>
        <p className="muted mb-3 text-[11px] leading-relaxed">
          Ein täglicher Lauf sieht die offenen Aufgaben durch. Sobald eine Aufgabe erledigt
          oder auf „Rückfragen offen“ gesetzt wird, hört die Eskalation sofort auf.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Erinnerung an den Bearbeiter nach (Tagen)">
            <input
              type="number"
              min={1}
              className="field"
              value={settings.reminderDays}
              onChange={(e) => updateSettings({ reminderDays: Number(e.target.value) })}
            />
          </Field>
          <Field label="Eskalation an Ersteller und Admin nach (Tagen)">
            <input
              type="number"
              min={1}
              className="field"
              value={settings.escalationDays}
              onChange={(e) => updateSettings({ escalationDays: Number(e.target.value) })}
            />
          </Field>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            className="btn btn-primary"
            onClick={async () => {
              setLauf("Läuft…");
              const r = await runEscalationJob();
              setLauf(
                r.meldung ??
                  `${r.reminders} Erinnerung(en) und ${r.escalations} Eskalationsmail(s) versendet. ` +
                    "Schon versendete Anlässe wurden übersprungen.",
              );
            }}
          >
            Täglichen Lauf jetzt starten
          </button>
          {lauf ? <p className="muted text-[11px]">{lauf}</p> : null}
        </div>
      </section>

      <section className="panel p-4">
        <h3 className="mb-1 text-sm font-semibold">Erledigtes ausblenden</h3>
        <p className="muted mb-3 text-[11px] leading-relaxed">
          Wie lange eine erledigte Aufgabe noch im Board stehen bleibt. Lange genug, um einen
          Fehlklick zu bemerken – kurz genug, dass das Board nicht zuwächst.
        </p>
        <Field label="Erledigte ausblenden nach (Stunden)">
          <input
            type="number"
            min={0}
            className="field"
            value={settings.doneHideAfterHours}
            onChange={(e) => updateSettings({ doneHideAfterHours: Number(e.target.value) })}
          />
        </Field>
      </section>

      <section className="panel p-4 lg:col-span-2">
        <h3 className="mb-1 text-sm font-semibold">Wartezeit im Pool</h3>
        <p className="muted mb-3 text-[11px] leading-relaxed">
          Aufgaben im Pool stehen nach Alter sortiert – die älteste links. Wer zu lange
          liegt, bekommt einen Rand: erst orange, dann rot. In Minuten, damit sich auch
          „nach 90 Minuten“ einstellen lässt.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Orange umranden nach (Minuten)" hint="0 schaltet die Stufe ab.">
            <input
              type="number"
              min={0}
              className="field"
              value={settings.poolWarnMinuten}
              onChange={(e) => updateSettings({ poolWarnMinuten: Number(e.target.value) })}
            />
          </Field>
          <Field label="Rot umranden nach (Minuten)" hint="0 schaltet die Stufe ab.">
            <input
              type="number"
              min={0}
              className="field"
              value={settings.poolAlarmMinuten}
              onChange={(e) => updateSettings({ poolAlarmMinuten: Number(e.target.value) })}
            />
          </Field>
        </div>

        {/* Lieber hier sagen als im Betrieb wundern. */}
        {!reihenfolgeStimmt ? (
          <p
            className="mt-3 rounded px-2 py-1 text-[11px] leading-relaxed"
            style={{ background: "var(--warn-bg)", color: "var(--warn-fg)" }}
          >
            Der rote Wert liegt nicht über dem orangen – so wird nie etwas orange.
          </p>
        ) : null}
      </section>
    </div>
  );
}
