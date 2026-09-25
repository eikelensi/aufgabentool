"use client";

/** Die interaktiven Teile der Mitarbeiterverwaltung. */

import { useId, useState, useTransition } from "react";
import {
  ausOnofficeHolen,
  kollegeAktivSetzen,
  kollegeEntfernen,
  kollegeSpeichern,
  type Ergebnis,
} from "./aktionen";

export interface KollegeZeile {
  id: string;
  displayName: string;
  shortCode: string | null;
  /** Wert des Feldes "tags" an einer onOffice-Aufgabe, der diesen Kollegen meint. */
  onofficeTag: string | null;
  email: string;
  phone: string | null;
  extension: string | null;
  location: string | null;
  onofficeUserId: string | null;
  profileId: string | null;
  syncSource: string;
  isActive: boolean;
  aufgaben: number;
}

export interface NutzerOption {
  id: string;
  fullName: string;
  email: string;
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
    </p>
  );
}

/**
 * Ein Feld dieses Formulars.
 *
 * Gesteuert, nicht "uncontrolled": was hier steht, steht auch im
 * Zustand, und was gespeichert wird, ist genau das. Vorher wurden die
 * Werte erst beim Absenden aus dem Formular gelesen - und wenn dieser
 * Weg klemmt, tippt man in Felder, die niemand ausliest.
 */
function Eingabe({
  label,
  wert,
  setzen,
  platzhalter,
  typ = "text",
  breit = false,
  hinweis,
  pflicht = false,
  kennung,
}: {
  label: string;
  wert: string;
  setzen: (v: string) => void;
  platzhalter?: string;
  typ?: string;
  breit?: boolean;
  hinweis?: string;
  pflicht?: boolean;
  kennung: string;
}) {
  return (
    <div className={breit ? "sm:col-span-2" : undefined}>
      <label className="mb-1 block text-xs font-medium" htmlFor={kennung}>
        {label}
        {pflicht ? <span style={{ color: "var(--err-fg)" }}> *</span> : null}
      </label>
      <input
        id={kennung}
        type={typ}
        className="field"
        value={wert}
        onChange={(e) => setzen(e.target.value)}
        placeholder={platzhalter}
      />
      {hinweis ? <p className="muted mt-1 text-[11px] leading-relaxed">{hinweis}</p> : null}
    </div>
  );
}

/**
 * Kollegen anlegen und bearbeiten.
 *
 * KEIN <form action={...}> mehr. Das Speichern kam auf diesem Weg nie
 * beim Server an - nicht ein einziges Mal, seit es die Tabelle gibt,
 * und ohne Fehlermeldung. Woran es lag, liess sich von aussen nicht
 * feststellen; also nimmt diese Seite jetzt denselben Weg wie die
 * Einstellungen, der nachweislich traegt: ein Knopf, ein Aufruf, die
 * Werte aus dem Zustand.
 */
function KollegeFormular({
  kollege,
  nutzer,
  onFertig,
  onAbbruch,
}: {
  kollege?: KollegeZeile;
  nutzer: NutzerOption[];
  onFertig: (e: Ergebnis) => void;
  onAbbruch: () => void;
}) {
  const [laeuft, starte] = useTransition();
  const [fehler, setFehler] = useState<Ergebnis | null>(null);
  const praefix = useId();

  const [werte, setWerte] = useState({
    display_name: kollege?.displayName ?? "",
    email: kollege?.email ?? "",
    short_code: kollege?.shortCode ?? "",
    onoffice_tag: kollege?.onofficeTag ?? "",
    onoffice_user_id: kollege?.onofficeUserId ?? "",
    phone: kollege?.phone ?? "",
    extension: kollege?.extension ?? "",
    location: kollege?.location ?? "",
    profile_id: kollege?.profileId ?? "",
  });

  const setze = (feld: keyof typeof werte) => (v: string) =>
    setWerte((alt) => ({ ...alt, [feld]: v }));

  const speichern = () =>
    starte(async () => {
      // FormData von Hand: die Serveraktion liest weiter FormData,
      // damit sie unveraendert bleibt - nur der Weg dorthin ist neu.
      const daten = new FormData();
      if (kollege) daten.set("id", kollege.id);
      for (const [feld, wert] of Object.entries(werte)) daten.set(feld, wert);

      const r = await kollegeSpeichern(daten);
      setFehler(r.ok ? null : r);
      onFertig(r);
      if (r.ok) onAbbruch();
    });

  return (
    <div className="line mt-3 border-t pt-3">
      <Meldung ergebnis={fehler} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Eingabe
          kennung={`${praefix}-display_name`}
          label="Name"
          pflicht
          wert={werte.display_name}
          setzen={setze("display_name")}
          platzhalter="Weis, Markus"
        />
        <Eingabe
          kennung={`${praefix}-email`}
          label="E-Mail"
          typ="email"
          pflicht
          wert={werte.email}
          setzen={setze("email")}
        />
        <Eingabe
          kennung={`${praefix}-short_code`}
          label="Kürzel"
          wert={werte.short_code}
          setzen={setze("short_code")}
          platzhalter="mw"
        />
        <Eingabe
          kennung={`${praefix}-onoffice_tag`}
          label="onOffice-Tag"
          wert={werte.onoffice_tag}
          setzen={setze("onoffice_tag")}
          platzhalter="Weis"
          hinweis="Was in onOffice im Aufgabenfeld „tags“ steht, wenn die Aufgabe für ihn ist. Daraus wird hier „Auftrag von“ – und umgekehrt."
        />
        <Eingabe
          kennung={`${praefix}-onoffice_user_id`}
          label="onOffice-Benutzer-ID"
          wert={werte.onoffice_user_id}
          setzen={setze("onoffice_user_id")}
        />
        <Eingabe
          kennung={`${praefix}-phone`}
          label="Telefon"
          wert={werte.phone}
          setzen={setze("phone")}
          platzhalter="06233 000000"
        />
        <Eingabe
          kennung={`${praefix}-extension`}
          label="Durchwahl"
          wert={werte.extension}
          setzen={setze("extension")}
          platzhalter="12"
        />
        <Eingabe
          kennung={`${praefix}-location`}
          label="Standort"
          wert={werte.location}
          setzen={setze("location")}
          platzhalter="Frankenthal"
          breit
        />

        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium" htmlFor={`${praefix}-profile_id`}>
            Gehört zu einem Nutzer des Tools <span className="muted font-normal">(optional)</span>
          </label>
          <select
            id={`${praefix}-profile_id`}
            className="field"
            value={werte.profile_id}
            onChange={(e) => setze("profile_id")(e.target.value)}
          >
            <option value="">— kein Zugang, nur zuordenbar —</option>
            {nutzer.map((n) => (
              <option key={n.id} value={n.id}>
                {n.fullName} ({n.email})
              </option>
            ))}
          </select>
          <p className="muted mt-1 text-[11px] leading-relaxed">
            Verknüpft beide Register, wenn dieselbe Person hier als Kollege und
            drüben als Nutzer steht. Einen Zugang legt das nicht an – das
            passiert in der Nutzerverwaltung.
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button className="btn btn-primary" type="button" onClick={speichern} disabled={laeuft}>
          {laeuft ? "Speichere…" : kollege ? "Änderungen speichern" : "Anlegen"}
        </button>
        <button className="btn btn-ghost" type="button" onClick={onAbbruch} disabled={laeuft}>
          Abbrechen
        </button>
      </div>
    </div>
  );
}

export function KollegenBereich({
  kollegen,
  nutzer,
  unbekannteNamen,
}: {
  kollegen: KollegeZeile[];
  nutzer: NutzerOption[];
  unbekannteNamen: string[];
}) {
  const [ergebnis, setErgebnis] = useState<Ergebnis | null>(null);
  const [neu, setNeu] = useState(false);
  const [bearbeite, setBearbeite] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();

  const fuehreAus = (fn: () => Promise<Ergebnis>) =>
    starte(async () => setErgebnis(await fn()));

  const unvollstaendig = kollegen.filter(
    (k) => k.isActive && (!k.phone || !k.location),
  ).length;

  return (
    <>
      <div className="panel mb-4 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Kollegen aus onOffice übernehmen</h2>
            <p className="muted text-[11px] leading-relaxed">
              Holt die Mailadressen der onOffice-Benutzer. Mehr gibt deine
              Benutzerliste nicht her – Namen, Telefon, Durchwahl und Standort
              pflegst du hier.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className="btn btn-ghost"
              disabled={laeuft}
              onClick={() => fuehreAus(ausOnofficeHolen)}
            >
              {laeuft ? "…" : "Aus onOffice holen"}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                setNeu((n) => !n);
                setBearbeite(null);
              }}
            >
              {neu ? "Schließen" : "+ Kollege"}
            </button>
          </div>
        </div>

        {neu ? (
          <KollegeFormular
            nutzer={nutzer}
            onFertig={setErgebnis}
            onAbbruch={() => setNeu(false)}
          />
        ) : null}

        {unbekannteNamen.length ? (
          <div className="line mt-3 border-t pt-3">
            <h3 className="mb-1.5 text-xs font-medium">
              Namen aus echten onOffice-Aufgaben ({unbekannteNamen.length})
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {unbekannteNamen.map((n) => (
                <span
                  key={n}
                  className="chip"
                  style={{ background: "var(--panel-2)", color: "var(--muted)" }}
                >
                  {n}
                </span>
              ))}
            </div>
            <p className="muted mt-2 text-[11px] leading-relaxed">
              So stehen diese Personen in den Feldern Bearbeiter und
              Verantwortung. Übernimm die Schreibweise beim Anlegen, dann passt
              die Zuordnung später von selbst.
            </p>
          </div>
        ) : null}
      </div>

      <Meldung ergebnis={ergebnis} />

      {kollegen.length === 0 ? (
        <div className="muted line rounded-lg border border-dashed px-3 py-8 text-center text-xs">
          Noch keine Kollegen. „Aus onOffice holen“ ist der schnellste Anfang.
        </div>
      ) : (
        <>
          {unvollstaendig ? (
            <p
              className="mb-3 rounded-md px-2.5 py-2 text-xs"
              style={{ background: "var(--warn-bg)", color: "var(--warn-fg)" }}
            >
              Bei {unvollstaendig} {unvollstaendig === 1 ? "Kollegen fehlt" : "Kollegen fehlen"}{" "}
              Telefon oder Standort.
            </p>
          ) : null}

          <div className="panel scroll-x">
            <table className="w-full text-left text-[13px]">
              <thead className="muted text-[11px] uppercase tracking-wide">
                <tr className="line border-b">
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">E-Mail</th>
                  <th className="px-3 py-2 font-medium">Telefon</th>
                  <th className="px-3 py-2 font-medium">Durchwahl</th>
                  <th className="px-3 py-2 font-medium">Standort</th>
                  <th className="px-3 py-2 font-medium">Zugang</th>
                  <th className="px-3 py-2 font-medium">Aufgaben</th>
                  <th className="px-3 py-2 font-medium">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {kollegen.map((k) => {
                  const nutzerDazu = nutzer.find((n) => n.id === k.profileId);
                  return (
                    <tr key={k.id} className="line border-b last:border-0">
                      <td className="px-3 py-2">
                        {k.displayName}
                        {k.shortCode ? (
                          <span className="muted ml-1.5 text-[11px]">({k.shortCode})</span>
                        ) : null}
                        {k.onofficeTag ? (
                          <span
                            className="chip ml-1.5"
                            style={{ background: "var(--panel-2)", color: "var(--muted)" }}
                            title="onOffice-Tag"
                          >
                            #{k.onofficeTag}
                          </span>
                        ) : null}
                        {!k.isActive ? (
                          <span
                            className="chip ml-1.5"
                            style={{ background: "var(--err-bg)", color: "var(--err-fg)" }}
                          >
                            ausgeblendet
                          </span>
                        ) : null}
                      </td>
                      <td className="muted px-3 py-2 text-[12px]">{k.email}</td>
                      <td className="muted px-3 py-2 text-[12px]">{k.phone || "–"}</td>
                      <td className="muted px-3 py-2 text-[12px]">{k.extension || "–"}</td>
                      <td className="muted px-3 py-2 text-[12px]">{k.location || "–"}</td>
                      <td className="muted px-3 py-2 text-[12px]">
                        {nutzerDazu ? nutzerDazu.fullName : "–"}
                      </td>
                      <td className="muted px-3 py-2 text-[12px]">{k.aufgaben || "–"}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            className="btn btn-ghost"
                            style={{ fontSize: 11 }}
                            onClick={() => {
                              setBearbeite(bearbeite === k.id ? null : k.id);
                              setNeu(false);
                            }}
                          >
                            {bearbeite === k.id ? "Zu" : "Bearbeiten"}
                          </button>
                          <button
                            className="btn btn-ghost"
                            style={{ fontSize: 11 }}
                            disabled={laeuft}
                            onClick={() => fuehreAus(() => kollegeAktivSetzen(k.id, !k.isActive))}
                          >
                            {k.isActive ? "Ausblenden" : "Einblenden"}
                          </button>
                          <button
                            className="btn btn-ghost"
                            style={{ fontSize: 11 }}
                            disabled={laeuft}
                            onClick={() => fuehreAus(() => kollegeEntfernen(k.id))}
                          >
                            Löschen
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {bearbeite ? (
            <div className="panel mt-3 p-3">
              <h2 className="text-sm font-semibold">
                {kollegen.find((k) => k.id === bearbeite)?.displayName} bearbeiten
              </h2>
              {/* key: ohne das behaelt React beim Wechsel auf einen
                  anderen Kollegen die Eingabefelder des vorigen -
                  defaultValue wirkt nur beim ersten Aufbau. Die
                  versteckte Kennung wechselt aber sehr wohl. Man
                  bearbeitete also B und speicherte die Werte von A
                  darueber. */}
              <KollegeFormular
                key={bearbeite}
                kollege={kollegen.find((k) => k.id === bearbeite)}
                nutzer={nutzer}
                onFertig={setErgebnis}
                onAbbruch={() => setBearbeite(null)}
              />
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
