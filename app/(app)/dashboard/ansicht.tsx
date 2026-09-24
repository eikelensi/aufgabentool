"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Avatar } from "@/components/ui";
import type { Profile } from "@/lib/types";

/**
 * Das Dashboard: zwei Blicke auf dieselbe Arbeit.
 *
 * "Heute" ist ein Blick auf den Stand - wer hat gerade was liegen.
 * "Woche" ist ein Blick auf die Bewegung - wer hat was bekommen,
 * zurueckgestellt, fertiggemacht. Das eine beantwortet "wo stehen
 * wir", das andere "wie laeuft es". Beides auf eine Seite zu legen
 * waere bequem und wuerde beides unleserlich machen.
 *
 * Die Wochenzahlen kommen aus einer eigenen Ereignistabelle, nicht aus
 * dem Bestand: eine Aufgabe, die heute erledigt und morgen wieder
 * geoeffnet wird, hat trotzdem am Montag stattgefunden.
 */

interface WochenZeile {
  user_id: string;
  name: string;
  erhalten: number;
  zurueckgestellt: number;
  erledigt: number;
}

function montag(verschiebung: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  // Montag als Wochenanfang, wie im deutschen Kalender.
  const tag = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - tag + verschiebung * 7);
  return d;
}

function kurz(d: Date): string {
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

function Kachel({
  zahl,
  text,
  ton,
}: {
  zahl: number;
  text: string;
  ton?: "warn" | "ok" | "info";
}) {
  const farben =
    ton === "warn"
      ? { background: "var(--warn-bg)", color: "var(--warn-fg)" }
      : ton === "ok"
        ? { background: "var(--ok-bg)", color: "var(--ok-fg)" }
        : ton === "info"
          ? { background: "var(--info-bg)", color: "var(--info-fg)" }
          : { background: "var(--panel-2)" };

  return (
    <div className="line rounded-lg border px-3 py-2 text-center" style={farben}>
      <div className="text-lg leading-none font-bold">{zahl}</div>
      <div className="mt-1 text-[10px] leading-tight opacity-80">{text}</div>
    </div>
  );
}

/**
 * Der Trichter einer Person.
 *
 * Die Grenze zaehlt Aufgaben, nicht Punkte: "4" heisst vier offene
 * Aufgaben gleichzeitig. Intern zaehlt die Datenbank doppelt, damit
 * eine zurueckgestellte Aufgabe nur einen halben Platz belegt - wer
 * auf eine Rueckmeldung wartet, soll dafuer nicht den ganzen Tag
 * blockiert sein. Das muss hier niemand wissen.
 */
function Trichter({ person, wartend }: { person: Profile; wartend: number }) {
  const { trichterSetzen } = useStore();
  const [grenze, setGrenze] = useState(String(person.trichterGrenze ?? 5));
  const [laeuft, setLaeuft] = useState(false);
  const aktiv = Boolean(person.trichterAktiv);

  // Stellt jemand anders die Grenze um, soll das Feld mitgehen -
  // solange hier nicht gerade getippt wird.
  useEffect(() => {
    if (!laeuft) setGrenze(String(person.trichterGrenze ?? 5));
  }, [person.trichterGrenze, laeuft]);

  const setze = async (werte: { aktiv?: boolean; grenze?: number }) => {
    setLaeuft(true);
    await trichterSetzen(person.id, werte);
    setLaeuft(false);
  };

  const uebernehmen = () => {
    const zahl = Number(grenze);
    if (!Number.isFinite(zahl) || zahl < 1) {
      setGrenze(String(person.trichterGrenze ?? 5));
      return;
    }
    const geklemmt = Math.max(1, Math.min(50, Math.round(zahl)));
    setGrenze(String(geklemmt));
    if (geklemmt !== (person.trichterGrenze ?? 5)) void setze({ grenze: geklemmt });
  };

  return (
    <div className="line mt-2 border-t pt-2">
      <label className="flex items-center gap-2 text-[11px]">
        <input
          type="checkbox"
          checked={aktiv}
          disabled={laeuft}
          onChange={(e) => void setze({ aktiv: e.target.checked })}
        />
        <span className="font-medium">Trichter</span>
        {aktiv ? (
          <>
            <span className="muted">– zeigt höchstens</span>
            <input
              type="number"
              min={1}
              max={50}
              value={grenze}
              disabled={laeuft}
              onChange={(e) => setGrenze(e.target.value)}
              onBlur={uebernehmen}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              className="field w-14 px-1.5 py-0.5 text-center text-[11px]"
            />
            <span className="muted">Aufgaben</span>
          </>
        ) : (
          <span className="muted">– alles geht direkt durch</span>
        )}
      </label>

      <p className="muted mt-1 text-[10px] leading-tight">
        {aktiv
          ? wartend > 0
            ? `${wartend} ${wartend === 1 ? "Aufgabe wartet" : "Aufgaben warten"} im Hintergrund – die nächste rückt nach, sobald hier eine fertig wird.`
            : "Nichts im Hintergrund – alles Zugeteilte ist sichtbar."
          : "Alle zugeteilten Aufgaben sind sofort sichtbar."}
        {aktiv ? " Hohe Priorität geht immer sofort durch." : ""}
      </p>
    </div>
  );
}

export default function DashboardAnsicht() {
  const { bereit, visibleTasks, profiles, me, wartendeJePerson } = useStore();
  const [tab, setTab] = useState<"heute" | "woche">("heute");
  const [verschiebung, setVerschiebung] = useState(0);
  const [zeilen, setZeilen] = useState<WochenZeile[]>([]);
  const [pool, setPool] = useState<{ eingang: number; ausgang: number }>({
    eingang: 0,
    ausgang: 0,
  });
  const [laedt, setLaedt] = useState(false);

  const von = useMemo(() => montag(verschiebung), [verschiebung]);
  const bis = useMemo(() => {
    const d = new Date(von);
    d.setDate(d.getDate() + 7);
    return d;
  }, [von]);

  const holeWoche = useCallback(async () => {
    setLaedt(true);
    const sb = supabaseBrowser();
    const [w, p] = await Promise.all([
      sb.rpc("dashboard_woche", { von: von.toISOString(), bis: bis.toISOString() }),
      sb.rpc("dashboard_pool", { von: von.toISOString(), bis: bis.toISOString() }),
    ]);
    setZeilen((w.data as WochenZeile[]) ?? []);
    const erste = (p.data as { eingang: number; ausgang: number }[])?.[0];
    setPool({ eingang: Number(erste?.eingang ?? 0), ausgang: Number(erste?.ausgang ?? 0) });
    setLaedt(false);
  }, [von, bis]);

  useEffect(() => {
    if (tab === "woche") void holeWoche();
  }, [tab, holeWoche]);

  const imPool = visibleTasks.filter((t) => t.isPool && !t.assigneeId).length;
  // Der Store fuehrt nur aktive Profile - wer abgeschaltet ist, taucht
  // hier gar nicht erst auf.
  const aktive = profiles;
  // Die Dosierung ist Sache derer, die verteilen. Wer das Dashboard nur
  // liest, sieht die Kacheln - aber keine Schalter.
  const darfTrichtern = ["superadmin", "gf", "qm"].includes(me.role);

  if (!bereit) return <p className="muted text-xs">Lade…</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-base font-semibold">Dashboard</h1>
        <span className="ml-auto flex items-center gap-1">
          <button
            className="btn"
            style={
              tab === "heute"
                ? { background: "var(--color-ci-400)", color: "var(--auf-akzent)" }
                : undefined
            }
            onClick={() => setTab("heute")}
          >
            Aktueller Tag
          </button>
          <button
            className="btn"
            style={
              tab === "woche"
                ? { background: "var(--color-ci-400)", color: "var(--auf-akzent)" }
                : undefined
            }
            onClick={() => setTab("woche")}
          >
            Woche
          </button>
        </span>
      </div>

      {tab === "heute" ? (
        <>
          {/* Der Pool steht oben und in der Mitte: er ist die einzige
              Zahl, die alle gemeinsam betrifft. */}
          <div className="flex justify-center">
            <div
              className="panel px-8 py-4 text-center"
              style={{ background: "var(--panel-2)", minWidth: 220 }}
            >
              <div className="text-3xl leading-none font-bold">{imPool}</div>
              <div className="muted mt-1 text-[11px]">
                {imPool === 1 ? "Aufgabe im Pool" : "Aufgaben im Pool"}
              </div>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {aktive.map((p) => {
              const meine = visibleTasks.filter((t) => t.assigneeId === p.id);
              const offen = meine.filter((t) => t.status === "offen").length;
              const rueck = meine.filter((t) => t.status === "in_bearbeitung").length;
              return (
                <section key={p.id} className="panel p-3">
                  <header className="mb-2 flex items-center gap-2">
                    <Avatar profile={p} size={24} />
                    <h2 className="truncate text-[13px] font-semibold">{p.fullName}</h2>
                  </header>
                  <div className="grid grid-cols-2 gap-2">
                    <Kachel zahl={offen} text="aktuelle Aufgaben" />
                    <Kachel zahl={rueck} text="in Rückstellung" ton={rueck > 0 ? "warn" : undefined} />
                  </div>
                  {darfTrichtern ? (
                    <Trichter person={p} wartend={wartendeJePerson(p.id)} />
                  ) : null}
                </section>
              );
            })}
          </div>

          {aktive.length === 0 ? (
            <p className="muted text-xs">Noch keine aktiven Zugänge.</p>
          ) : null}
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              className="btn"
              onClick={() => setVerschiebung((v) => v - 1)}
              title="Woche zurück"
            >
              ‹
            </button>
            <span className="text-[13px] font-semibold">
              {kurz(von)} – {kurz(new Date(bis.getTime() - 864e5))}
              {verschiebung === 0 ? " (diese Woche)" : ""}
            </span>
            <button
              className="btn"
              onClick={() => setVerschiebung((v) => Math.min(0, v + 1))}
              disabled={verschiebung >= 0}
              title="Woche vor"
            >
              ›
            </button>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            <div className="panel px-6 py-3 text-center" style={{ background: "var(--panel-2)" }}>
              <div className="text-2xl leading-none font-bold">{pool.eingang}</div>
              <div className="muted mt-1 text-[11px]">Eingang in den Pool</div>
            </div>
            <div className="panel px-6 py-3 text-center" style={{ background: "var(--panel-2)" }}>
              <div className="text-2xl leading-none font-bold">{pool.ausgang}</div>
              <div className="muted mt-1 text-[11px]">Ausgang aus dem Pool</div>
            </div>
          </div>

          {laedt ? <p className="muted text-center text-xs">Lade Zahlen…</p> : null}

          <div className="scroll-x">
            <table className="w-full text-xs">
              <thead>
                <tr className="line border-b">
                  <th className="py-2 pr-3 text-left font-semibold">Mitarbeiter</th>
                  <th className="px-3 py-2 text-right font-semibold">erhalten</th>
                  <th className="px-3 py-2 text-right font-semibold">zurückgestellt</th>
                  <th className="px-3 py-2 text-right font-semibold">bearbeitet</th>
                </tr>
              </thead>
              <tbody>
                {zeilen.map((z) => (
                  <tr key={z.user_id} className="line border-b">
                    <td className="py-2 pr-3">{z.name}</td>
                    <td className="px-3 py-2 text-right">{Number(z.erhalten)}</td>
                    <td
                      className="px-3 py-2 text-right"
                      style={Number(z.zurueckgestellt) > 0 ? { color: "var(--warn-fg)" } : undefined}
                    >
                      {Number(z.zurueckgestellt)}
                    </td>
                    <td
                      className="px-3 py-2 text-right font-semibold"
                      style={Number(z.erledigt) > 0 ? { color: "var(--ok-fg)" } : undefined}
                    >
                      {Number(z.erledigt)}
                    </td>
                  </tr>
                ))}
                {zeilen.length > 0 ? (
                  <tr>
                    <td className="py-2 pr-3 font-semibold">Zusammen</td>
                    {(["erhalten", "zurueckgestellt", "erledigt"] as const).map((f) => (
                      <td key={f} className="px-3 py-2 text-right font-semibold">
                        {zeilen.reduce((s, z) => s + Number(z[f]), 0)}
                      </td>
                    ))}
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <p className="muted text-[11px] leading-relaxed">
            Gezählt werden Ereignisse, nicht Bestände: eine Aufgabe, die Montag
            erledigt und Mittwoch wieder geöffnet wurde, steht am Montag als
            bearbeitet. Private Aufgaben zählen nirgends mit. Zahlen vor dem
            24.09.2026 stammen aus der Statushistorie und kennen den damaligen
            Bearbeiter nicht – sie sind dem heutigen zugeordnet.
          </p>
        </>
      )}
    </div>
  );
}
