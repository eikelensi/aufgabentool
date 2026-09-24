"use client";

import React, { useEffect, useState } from "react";
import { useStore } from "@/lib/store";

/**
 * Die Begruessung am ersten Tageslogin.
 *
 * Gemerkt wird das im Browser, nicht in der Datenbank: ein Datum je
 * Geraet. Das ist Absicht - wer morgens am Buero-Rechner anfaengt und
 * mittags am Laptop weitermacht, soll den Gruss am Rechner gesehen
 * haben und nicht auf dem Laptop verpasst haben. Und es ist keine
 * Angabe, die in einer Datenbank etwas verloren haette.
 *
 * Gezeigt wird erst, wenn die Zahlen stimmen. Ein Willkommen mit
 * "0 offene Aufgaben", weil noch geladen wird, waere schlimmer als
 * keins.
 */

const SCHLUESSEL = "aufgabentool-gruss";

function heute(): string {
  return new Date().toISOString().slice(0, 10);
}

function tageszeit(): string {
  const stunde = new Date().getHours();
  if (stunde < 11) return "Guten Morgen";
  if (stunde < 18) return "Hallo";
  return "Guten Abend";
}

export default function Tagesgruss() {
  const { bereit, me, visibleTasks } = useStore();
  const [offen, setOffen] = useState(false);

  useEffect(() => {
    if (!bereit) return;

    try {
      if (window.localStorage.getItem(SCHLUESSEL) === heute()) return;
      window.localStorage.setItem(SCHLUESSEL, heute());
    } catch {
      // Ohne Speicher im Browser (privates Fenster, gesperrte Seite)
      // gibt es keinen Gruss. Lieber keinen als einen bei jedem
      // Seitenwechsel.
      return;
    }

    setOffen(true);
  }, [bereit]);

  if (!offen) return null;

  const meine = visibleTasks.filter((t) => t.assigneeId === me.id);
  const meineOffen = meine.filter((t) => t.status === "offen").length;
  const meineRueckfragen = meine.filter((t) => t.status === "in_bearbeitung").length;
  const imPool = visibleTasks.filter((t) => t.isPool && !t.assigneeId).length;
  const vorname = me.fullName.trim().split(/\s+/)[0] || me.fullName;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Begrüßung"
      onClick={() => setOffen(false)}
    >
      <div
        className="panel w-full max-w-[420px] overflow-hidden p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-5 pt-5 pb-4"
          style={{
            background: "linear-gradient(135deg, var(--color-ci-400), var(--color-ci-500))",
            color: "var(--auf-akzent)",
          }}
        >
          <p className="text-[13px] font-medium opacity-90">{tageszeit()},</p>
          <h2 className="text-xl leading-tight font-bold">{vorname}</h2>
          <p className="mt-1 text-[13px] opacity-90">Willkommen in deinem Workboard</p>
        </div>

        <div className="grid grid-cols-3 gap-2 px-5 pt-4">
          {[
            { zahl: meineOffen, text: meineOffen === 1 ? "offene Aufgabe" : "offene Aufgaben" },
            {
              zahl: meineRueckfragen,
              text: meineRueckfragen === 1 ? "Rückfrage offen" : "Rückfragen offen",
            },
            { zahl: imPool, text: imPool === 1 ? "Aufgabe im Pool" : "Aufgaben im Pool" },
          ].map((k, i) => (
            <div
              key={i}
              className="line rounded-lg border px-2 py-2.5 text-center"
              style={{ background: "var(--panel-2)" }}
            >
              <div className="text-xl leading-none font-bold">{k.zahl}</div>
              <div className="muted mt-1 text-[10px] leading-tight">{k.text}</div>
            </div>
          ))}
        </div>

        <div className="px-5 pt-3 pb-4">
          <p className="muted text-xs leading-relaxed">
            {meineOffen === 0 && meineRueckfragen === 0
              ? imPool > 0
                ? "Dein Tag ist frei – im Pool wartet Arbeit, falls du magst."
                : "Dein Tag ist frei und der Pool ist leer. Gut gemacht."
              : "Wir wünschen einen angenehmen und erfolgreichen Tag."}
          </p>

          <button
            className="btn btn-primary mt-3 w-full"
            onClick={() => setOffen(false)}
            autoFocus
          >
            Los geht’s
          </button>
        </div>
      </div>
    </div>
  );
}
