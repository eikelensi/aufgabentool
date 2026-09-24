"use client";

/** Die interaktiven Teile der Nutzerverwaltung: Formular und Zeilenaktionen. */

import { useState, useTransition } from "react";
import {
  aktivSetzen,
  aufgabenSynchronisieren,
  einladungErneutSenden,
  nutzerEinladen,
  onofficeNameSetzen,
  passwortZuruecksetzen,
  rolleAendern,
  type Ergebnis,
  type SyncMeldung,
} from "./aktionen";
import { ROLLE_LABEL, type AppRole } from "@/lib/types";

export interface NutzerZeile {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
  isActive: boolean;
  onofficeUsername: string | null;
  onofficeDisplayName: string | null;
  phone: string | null;
  invitedAt: string | null;
  hatSichAngemeldet: boolean;
}

function Meldung({ ergebnis }: { ergebnis: Ergebnis | null }) {
  if (!ergebnis) return null;
  return (
    <p
      className="mb-3 rounded-md px-2.5 py-2 text-xs leading-relaxed"
      style={
        ergebnis.ok
          ? { background: "var(--ok-bg)", color: "var(--ok-fg)" }
          : { background: "var(--err-bg)", color: "var(--err-fg)" }
      }
      role={ergebnis.ok ? "status" : "alert"}
    >
      {ergebnis.meldung}
      {ergebnis.linkZumWeitergeben ? (
        <>
          <br />
          <span className="mt-1 block break-all font-mono text-[10px]">
            {ergebnis.linkZumWeitergeben}
          </span>
          <span className="mt-1 block text-[10px]">
            Diesen Link persönlich weitergeben – über Telefon oder Chat, nicht
            per Mail. Er gilt einmal.
          </span>
        </>
      ) : null}
    </p>
  );
}

export function EinladenFormular({ darfSuperadmin }: { darfSuperadmin: boolean }) {
  const [offen, setOffen] = useState(false);
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);
  const [laeuft, starte] = useTransition();

  return (
    <div className="panel mb-4 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Nutzer einladen</h2>
          <p className="muted text-[11px]">
            Die Person bekommt eine Mail mit einem Link und setzt ihr Passwort selbst.
          </p>
        </div>
        <button className="btn btn-ghost" onClick={() => setOffen((o) => !o)}>
          {offen ? "Schließen" : "+ Neuer Nutzer"}
        </button>
      </div>

      {offen ? (
        <form
          className="line mt-3 border-t pt-3"
          action={(formData) =>
            starte(async () => {
              const r = await nutzerEinladen(formData);
              setErgebnis(r);
              if (r.ok) setOffen(false);
            })
          }
        >
          <Meldung ergebnis={ergebnis} />

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium" htmlFor="full_name">
                Name
              </label>
              <input id="full_name" name="full_name" className="field" required
                placeholder="Raschke, Janin" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" htmlFor="email">
                E-Mail
              </label>
              <input id="email" name="email" type="email" className="field" required
                placeholder="name@4-wk.de" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" htmlFor="role">
                Rolle
              </label>
              <select id="role" name="role" className="field" defaultValue="user">
                <option value="user">Mitarbeiter – eigene Aufgaben und der Pool</option>
                <option value="qm">Qualitätsmanagement – dazu Dashboard, Team und Verwaltung</option>
                <option value="gf">Geschäftsführung – alles, einschließlich Asana</option>
                {darfSuperadmin ? (
                  <option value="superadmin">Superadmin – zusätzlich alle Einstellungen</option>
                ) : null}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" htmlFor="onoffice_username">
                onOffice-Benutzername <span className="muted font-normal">(optional)</span>
              </label>
              <input id="onoffice_username" name="onoffice_username" className="field"
                placeholder="BaufiLensinger" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium" htmlFor="phone">
                Telefon <span className="muted font-normal">(optional)</span>
              </label>
              <input id="phone" name="phone" className="field" />
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button className="btn btn-primary" type="submit" disabled={laeuft}>
              {laeuft ? "Lade ein…" : "Einladen"}
            </button>
            <span className="muted text-[11px]">
              Es wird kein Passwort erzeugt und keines verschickt.
            </span>
          </div>
        </form>
      ) : (
        <Meldung ergebnis={ergebnis} />
      )}
    </div>
  );
}

export function NutzerTabelle({
  nutzer,
  eigeneId,
  eigeneRolle,
}: {
  nutzer: NutzerZeile[];
  eigeneId: string;
  eigeneRolle: AppRole;
}) {
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);
  const [laeuft, starte] = useTransition();

  const fuehreAus = (fn: () => Promise<Ergebnis>) =>
    starte(async () => setErgebnis(await fn()));

  const darfSuperadmin = eigeneRolle === "superadmin";

  return (
    <>
      <Meldung ergebnis={ergebnis} />

      <div className="panel scroll-x">
        <table className="w-full text-left text-[13px]">
          <thead className="muted text-[11px] uppercase tracking-wide">
            <tr className="line border-b">
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">E-Mail</th>
              <th className="px-3 py-2 font-medium">Rolle</th>
              <th className="px-3 py-2 font-medium">
                Name in onOffice
                <span className="block font-normal normal-case tracking-normal">
                  entscheidet, welche Aufgaben kommen
                </span>
              </th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {nutzer.map((n) => {
              const selbst = n.id === eigeneId;
              const gesperrtFuerMich = n.role === "superadmin" && !darfSuperadmin;
              const unantastbar = selbst || gesperrtFuerMich;

              return (
                <tr key={n.id} className="line border-b last:border-0">
                  <td className="px-3 py-2">
                    {n.fullName}
                    {selbst ? <span className="muted ml-1.5 text-[11px]">(du)</span> : null}
                  </td>
                  <td className="muted px-3 py-2 text-[12px]">{n.email}</td>
                  <td className="px-3 py-2">
                    {unantastbar ? (
                      <span className="text-[12px]">{ROLLE_LABEL[n.role]}</span>
                    ) : (
                      <select
                        className="field"
                        style={{ width: "auto", padding: "0.2rem 0.4rem", fontSize: "0.72rem" }}
                        value={n.role}
                        disabled={laeuft}
                        onChange={(e) =>
                          fuehreAus(() => rolleAendern(n.id, e.target.value as AppRole))
                        }
                      >
                        <option value="user">Mitarbeiter</option>
                        <option value="qm">Qualitätsmanagement</option>
                        <option value="gf">Geschäftsführung</option>
                        {darfSuperadmin ? <option value="superadmin">Superadmin</option> : null}
                      </select>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <OnofficeNameFeld
                      id={n.id}
                      wert={n.onofficeDisplayName}
                      gesperrt={laeuft}
                      onFertig={setErgebnis}
                    />
                  </td>
                  <td className="px-3 py-2">
                    {!n.isActive ? (
                      <span className="chip" style={{ background: "var(--err-bg)", color: "var(--err-fg)" }}>
                        gesperrt
                      </span>
                    ) : n.hatSichAngemeldet ? (
                      <span className="chip" style={{ background: "var(--ok-bg)", color: "var(--ok-fg)" }}>
                        aktiv
                      </span>
                    ) : (
                      <span className="chip" style={{ background: "var(--warn-bg)", color: "var(--warn-fg)" }}>
                        eingeladen
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize: 11 }}
                        disabled={laeuft}
                        onClick={() =>
                          fuehreAus(() =>
                            n.hatSichAngemeldet
                              ? passwortZuruecksetzen(n.email)
                              : einladungErneutSenden(n.email),
                          )
                        }
                      >
                        {n.hatSichAngemeldet ? "Passwort zurücksetzen" : "Einladung erneut"}
                      </button>
                      {unantastbar ? null : (
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: 11 }}
                          disabled={laeuft}
                          onClick={() => fuehreAus(() => aktivSetzen(n.id, !n.isActive))}
                        >
                          {n.isActive ? "Sperren" : "Freigeben"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

/**
 * Der onOffice-Anzeigename einer Person. Genau dieser String muss in den
 * onOffice-Feldern Bearbeiter oder Verantwortung stehen, sonst wird die
 * Aufgabe nicht geholt. Deshalb hier zum Abtippen und nicht geraten.
 */
function OnofficeNameFeld({
  id,
  wert,
  gesperrt,
  onFertig,
}: {
  id: string;
  wert: string | null;
  gesperrt: boolean;
  onFertig: (e: Ergebnis) => void;
}) {
  const [text, setText] = useState(wert ?? "");
  const [laeuft, starte] = useTransition();
  const geaendert = text.trim() !== (wert ?? "").trim();

  return (
    <div className="flex items-center gap-1.5">
      <input
        className="field"
        style={{ width: 168, padding: "0.2rem 0.4rem", fontSize: "0.72rem" }}
        placeholder="Nachname, Vorname (kz)"
        value={text}
        disabled={gesperrt || laeuft}
        onChange={(e) => setText(e.target.value)}
      />
      {geaendert ? (
        <button
          className="btn btn-primary"
          style={{ fontSize: 11 }}
          disabled={laeuft}
          onClick={() => starte(async () => onFertig(await onofficeNameSetzen(id, text)))}
        >
          {laeuft ? "…" : "Speichern"}
        </button>
      ) : text.trim() ? (
        <span className="muted text-[11px]">✓</span>
      ) : (
        <span className="muted text-[11px]" title="Ohne Zuordnung werden fuer diese Person keine Aufgaben geholt.">
          fehlt
        </span>
      )}
    </div>
  );
}

/**
 * Aufgaben aus onOffice holen und zeigen, welche Namen dabei vorkamen.
 *
 * Diese Liste ist das Werkzeug fuer die Zuordnung: jeder Name, der in
 * einer geholten Aufgabe als Bearbeiter oder Verantwortung stand, laesst
 * sich hier mit einem Griff einem Nutzer zuweisen. Abtippen waere die
 * eine Stelle, an der ein Tippfehler den ganzen Abgleich still
 * lahmlegt - der Name muss auf das Zeichen genau stimmen.
 *
 * Laeuft der Abgleich, bevor ueberhaupt jemand zugeordnet ist, holt er
 * trotzdem und uebernimmt nur nichts. Sonst haette man die Namen, die
 * man braucht, nirgends stehen.
 */
export function SyncBereich({
  unbekannteNamen,
  nutzer,
}: {
  unbekannteNamen: { name: string; aufgaben: number }[];
  nutzer: { id: string; fullName: string; onofficeDisplayName: string | null }[];
}) {
  const [ergebnis, setErgebnis] = useState<SyncMeldung | null>(null);
  const [laeuft, starte] = useTransition();

  // Was der letzte Lauf gefunden hat, sonst der Bestand aus der Ansicht.
  const gefunden =
    ergebnis?.gefundeneNamen?.length
      ? ergebnis.gefundeneNamen
      : unbekannteNamen.map((u) => ({ name: u.name, anzahl: u.aufgaben }));

  const zugeordnet = new Map(
    nutzer
      .filter((n) => n.onofficeDisplayName)
      .map((n) => [n.onofficeDisplayName!.trim().toLowerCase(), n.fullName]),
  );

  return (
    <div className="panel mb-4 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Aufgaben aus onOffice holen</h2>
          <p className="muted text-[11px] leading-relaxed">
            Übernommen wird nur, was einen Nutzer als Bearbeiter oder als
            Verantwortung hat. Alles andere bleibt im CRM.
          </p>
        </div>
        <button
          className="btn btn-primary"
          disabled={laeuft}
          onClick={() => starte(async () => setErgebnis(await aufgabenSynchronisieren()))}
        >
          {laeuft ? "Hole…" : "Jetzt abgleichen"}
        </button>
      </div>

      {ergebnis ? (
        <p
          className="mt-3 rounded-md px-2.5 py-2 text-[11px] leading-relaxed"
          style={
            !ergebnis.ok
              ? { background: "var(--err-bg)", color: "var(--err-fg)" }
              : ergebnis.erkundung
                ? { background: "var(--info-bg)", color: "var(--info-fg)" }
                : { background: "var(--ok-bg)", color: "var(--ok-fg)" }
          }
          role="status"
        >
          {ergebnis.meldung}
        </p>
      ) : null}

      {gefunden.length ? (
        <div className="line mt-3 border-t pt-3">
          <h3 className="mb-1.5 text-xs font-medium">
            Namen aus onOffice ({gefunden.length})
          </h3>
          <div className="space-y-1">
            {gefunden.map((g) => (
              <NamensZeile
                key={g.name}
                name={g.name}
                anzahl={g.anzahl}
                gehoertZu={zugeordnet.get(g.name.trim().toLowerCase()) ?? null}
                nutzer={nutzer}
                gesperrt={laeuft}
                onFertig={(e) => setErgebnis({ ...e })}
              />
            ))}
          </div>
          <p className="muted mt-2 text-[11px] leading-relaxed">
            So schreibt onOffice die Namen – auf das Zeichen genau. Wähle rechts
            die Person, zu der ein Name gehört; wer nicht ins Tool soll, bleibt
            einfach ohne Zuordnung. Danach noch einmal abgleichen.
          </p>
        </div>
      ) : null}
    </div>
  );
}

/** Ein onOffice-Name mit der Person, der er gehört. */
function NamensZeile({
  name,
  anzahl,
  gehoertZu,
  nutzer,
  gesperrt,
  onFertig,
}: {
  name: string;
  anzahl: number;
  gehoertZu: string | null;
  nutzer: { id: string; fullName: string; onofficeDisplayName: string | null }[];
  gesperrt: boolean;
  onFertig: (e: Ergebnis) => void;
}) {
  const [laeuft, starte] = useTransition();

  return (
    <div className="line flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5">
      <code className="text-[12px]">{name}</code>
      <span className="muted text-[11px]">
        {anzahl} {anzahl === 1 ? "Aufgabe" : "Aufgaben"}
      </span>
      <div className="ml-auto flex items-center gap-1.5">
        {gehoertZu ? (
          <span className="chip" style={{ background: "var(--ok-bg)", color: "var(--ok-fg)" }}>
            ✓ {gehoertZu}
          </span>
        ) : (
          <select
            className="field"
            style={{ width: "auto", padding: "0.2rem 0.4rem", fontSize: "0.72rem" }}
            defaultValue=""
            disabled={gesperrt || laeuft}
            onChange={(e) => {
              const id = e.target.value;
              if (!id) return;
              starte(async () => onFertig(await onofficeNameSetzen(id, name)));
            }}
          >
            <option value="">zuordnen zu …</option>
            {nutzer
              .filter((n) => !n.onofficeDisplayName)
              .map((n) => (
                <option key={n.id} value={n.id}>
                  {n.fullName}
                </option>
              ))}
          </select>
        )}
      </div>
    </div>
  );
}
