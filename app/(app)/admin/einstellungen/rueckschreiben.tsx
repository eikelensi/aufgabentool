"use client";

/**
 * Die drei Schalter, die entscheiden, ob das Tool in echte CRM-Daten
 * schreibt.
 *
 * Bewusst als eigener Block mit einer eigenen Erklaerung: bis hierher
 * kann das Tool im schlimmsten Fall sich selbst durcheinanderbringen.
 * Ab hier kann es onOffice durcheinanderbringen, und dort haengt das
 * Tagesgeschaeft dran.
 *
 * Der Hauptschalter steht oben und heisst nach dem, was er bewirkt -
 * "nur lesen" - nicht nach dem Datenbankfeld. Solange er an ist, sind
 * die beiden darunter ohne Wirkung, und das sieht man ihnen auch an.
 */

import { useState, useTransition } from "react";
import { schalterSetzen, type Ergebnis, type Schalterstand } from "./rueckschreiben-aktionen";

export default function Rueckschreiben({ stand }: { stand: Schalterstand }) {
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);
  const [laeuft, starte] = useTransition();

  const gesperrt = stand.nurLesen;

  const setze = (
    welcher: "nurLesen" | "bearbeiter" | "status" | "inhalt" | "anlegen" | "asana",
    an: boolean,
  ) =>
    starte(async () => setErgebnis(await schalterSetzen(welcher, an)));

  return (
    <div className="panel mb-4 p-3">
      <h2 className="mb-1 text-sm font-semibold">Schreiben nach onOffice</h2>
      <p className="muted mb-3 max-w-[70ch] text-[11px] leading-relaxed">
        Alles andere im Tool betrifft nur das Tool. Diese drei Schalter
        entscheiden, ob es auch in onOffice hineinschreibt – und dort hängt
        das Tagesgeschäft dran. Jede Umstellung steht im Protokoll.
      </p>

      <label className="line flex items-start gap-2.5 rounded-md border p-2.5 text-xs">
        <input
          type="checkbox"
          checked={stand.nurLesen}
          disabled={laeuft}
          onChange={(e) => setze("nurLesen", e.target.checked)}
          style={{ marginTop: 2 }}
        />
        <span>
          <strong>Nur lesen.</strong> Solange das an ist, wird nach onOffice
          nichts geschrieben – ganz gleich, was darunter steht. Änderungen im
          Tool bleiben im Tool.
          {stand.nurLesen ? (
            <span className="chip ml-1.5" style={{ background: "var(--ok-bg)", color: "var(--ok-fg)" }}>
              aktiv
            </span>
          ) : (
            <span className="chip ml-1.5" style={{ background: "var(--warn-bg)", color: "var(--warn-fg)" }}>
              Schreiben freigegeben
            </span>
          )}
        </span>
      </label>

      <div className="mt-2 space-y-2" style={{ opacity: gesperrt ? 0.45 : 1 }}>
        <label className="line flex items-start gap-2.5 rounded-md border p-2.5 text-xs">
          <input
            type="checkbox"
            checked={stand.bearbeiter}
            disabled={laeuft || gesperrt}
            onChange={(e) => setze("bearbeiter", e.target.checked)}
            style={{ marginTop: 2 }}
          />
          <span>
            <strong>Bearbeiter eintragen.</strong> Wer sich eine Aufgabe aus dem
            Pool zieht, wird in onOffice als Bearbeiter eingetragen. Ein Feld,
            ein Anlass – und es war dort vorher leer.
          </span>
        </label>

        <label className="line flex items-start gap-2.5 rounded-md border p-2.5 text-xs">
          <input
            type="checkbox"
            checked={stand.status}
            disabled={laeuft || gesperrt}
            onChange={(e) => setze("status", e.target.checked)}
            style={{ marginTop: 2 }}
          />
          <span>
            <strong>Status übertragen.</strong> Ein Statuswechsel im Tool setzt
            den Status auch in onOffice. Das überschreibt eine Angabe, die dort
            schon steht – deshalb getrennt schaltbar.
            <span className="muted mt-1 block leading-relaxed">
              onOffice kennt acht Status, das Tool drei. „Zurückgestellt“,
              „Abgebrochen“ und „Sonstiges“ sehen hier alle wie „Offen“ aus.
              Übertragen wird deshalb nur, wenn sich der Status in unseren
              Begriffen wirklich geändert hat – eine zurückgestellte Aufgabe
              wird nicht stillschweigend auf „Nicht begonnen“ zurückgesetzt.
            </span>
          </span>
        </label>

        <label className="line flex items-start gap-2.5 rounded-md border p-2.5 text-xs">
          <input
            type="checkbox"
            checked={stand.inhalt}
            disabled={laeuft || gesperrt}
            onChange={(e) => setze("inhalt", e.target.checked)}
            style={{ marginTop: 2 }}
          />
          <span>
            <strong>Betreff, Text, Frist und Priorität übertragen.</strong> Wer
            eine Aufgabe im Tool bearbeitet, ändert sie damit auch in onOffice.
            <span className="muted mt-1 block leading-relaxed">
              Der tiefste der drei Eingriffe – hier wird der Inhalt eines
              fremden Datensatzes überschrieben. Ohne ihn hält eine Bearbeitung
              trotzdem nicht: bei diesen Feldern führt onOffice, der nächste
              Abgleich holt den alten Stand zurück. Entweder beides oder
              keines.
            </span>
          </span>
        </label>

        <label className="line flex items-start gap-2.5 rounded-md border p-2.5 text-xs">
          <input
            type="checkbox"
            checked={stand.anlegen}
            disabled={laeuft || gesperrt}
            onChange={(e) => setze("anlegen", e.target.checked)}
            style={{ marginTop: 2 }}
          />
          <span>
            <strong>Neue Aufgaben anlegen.</strong> Was hier entsteht, entsteht
            auch in onOffice – mit Bearbeiter und Verantwortung.
            <span className="muted mt-1 block leading-relaxed">
              Ohne das bleibt eine hier angelegte Aufgabe für immer unsichtbar
              für alle, die in onOffice arbeiten. Private Aufgaben gehen nie
              hinüber, egal wie dieser Haken steht.
            </span>
          </span>
        </label>

        <label className="line flex items-start gap-2.5 rounded-md border p-2.5 text-xs">
          <input
            type="checkbox"
            checked={stand.asana}
            disabled={laeuft || gesperrt}
            onChange={(e) => setze("asana", e.target.checked)}
            style={{ marginTop: 2 }}
          />
          <span>
            <strong>Auch die Aufgaben aus dem Asana-Bereich.</strong> Jede Karte
            der Geschäftsführung bekommt ein Gegenstück in onOffice.
            <span className="muted mt-1 block leading-relaxed">
              Steht aus Vorsicht aus: beim ersten Lauf entstehen über vierzig
              Datensätze auf einmal, die dort niemand bestellt hat. Erst
              einschalten, wenn das Board stimmt.
            </span>
          </span>
        </label>
      </div>

      {ergebnis ? (
        <p
          className="mt-3 rounded-md px-2.5 py-2 text-[11px] leading-relaxed"
          style={
            ergebnis.ok
              ? { background: "var(--ok-bg)", color: "var(--ok-fg)" }
              : { background: "var(--err-bg)", color: "var(--err-fg)" }
          }
          role="status"
        >
          {ergebnis.meldung}
        </p>
      ) : null}
    </div>
  );
}
