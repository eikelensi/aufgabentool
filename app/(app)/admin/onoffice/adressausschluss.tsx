"use client";

/**
 * Die Adressen, die nie ein Kunde sind.
 *
 * onOffice haengt an fast jede Aufgabe die eigene Firmenadresse
 * (bei uns hilfe@, Kundennummer 11, Datensatz 59305). Die Verknuepfung
 * stimmt - sie bedeutet nur nichts, und im Tool stand sie bei 44
 * Aufgaben als "Kunde" und verdeckte den echten.
 *
 * Fest verdrahtet waere das beim naechsten Mandanten wieder falsch,
 * deshalb steht es hier.
 */

import { useStore } from "@/lib/store";
import { Field } from "@/components/ui";

export default function Adressausschluss() {
  const { isAdmin, settings, updateSettings } = useStore();
  if (!isAdmin) return null;

  return (
    <section className="panel p-4">
      <h3 className="mb-1 text-sm font-semibold">Adressen, die kein Kunde sind</h3>
      <p className="muted mb-3 text-[11px] leading-relaxed">
        onOffice hängt an fast jede Aufgabe die eigene Firmenadresse. Steht ihre
        Datensatznummer hier, wird sie beim Abgleich übersprungen und stattdessen die
        nächste verknüpfte Adresse genommen – also der echte Kunde.
      </p>
      <Field label="Datensatznummern, mit Komma getrennt">
        <input
          className="field"
          placeholder="z. B. 59305"
          value={settings.onofficeAdressAusschluss}
          onChange={(e) => updateSettings({ onofficeAdressAusschluss: e.target.value })}
        />
      </Field>

      {/* Der Schalter, den man nach einer Freischaltung durch onOffice
          umlegt - und keine Sekunde frueher. */}
      <h3 className="mb-1 mt-4 text-sm font-semibold">Feld „Tags“ mitlesen</h3>
      <p className="muted mb-2 text-[11px] leading-relaxed">
        Gemessen am 28.09.2026: onOffice weist jede Leseanfrage zurück, in der „tags“
        steht – das Feld existiert in der Feldkonfiguration, wird aber nicht
        herausgegeben. Eingeschaltet wird deshalb jede Aufgabe zweimal geholt: einmal
        abgelehnt, einmal ohne das Feld. Erst einschalten, wenn der onOffice-Support es
        freigeschaltet hat.
      </p>
      <label className="flex items-start gap-2 text-xs leading-relaxed">
        <input
          type="checkbox"
          checked={settings.onofficeTagsLesen}
          onChange={(e) => updateSettings({ onofficeTagsLesen: e.target.checked })}
        />
        <span>
          „tags“ beim Lesen mitfragen – füllt „Auftrag von“ automatisch, sobald onOffice
          das Feld herausgibt.
        </span>
      </label>
    </section>
  );
}
