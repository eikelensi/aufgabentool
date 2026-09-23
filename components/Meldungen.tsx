"use client";

import React, { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { TaskDetailDialog } from "./dialogs";
import { formatDateTime } from "./ui";

/**
 * Das schwebende Zeichen unten rechts.
 *
 * Es meldet sich nur, wenn es etwas zu melden gibt - ohne ungelesene
 * Notizen bleibt es still und unauffaellig. Der Zaehler ist die einzige
 * Stelle im Tool, die von sich aus um Aufmerksamkeit bittet; deshalb
 * zaehlt er nur Notizen und nicht jede Statusaenderung, sonst gewoehnt
 * man sich die rote Zahl ab.
 */
export default function Meldungen() {
  const { meldungen, ungelesen, meldungGelesen, alleMeldungenGelesen, tasks } = useStore();
  const [offen, setOffen] = useState(false);
  const [aufgabeId, setAufgabeId] = useState<string | null>(null);
  const [darfKlingeln, setDarfKlingeln] = useState(false);
  const gesehen = useRef<Set<string>>(new Set());

  // Einmal merken, ob der Browser Benachrichtigungen erlaubt. Gefragt
  // wird nicht von allein - ein Fenster, das ungefragt um Erlaubnis
  // bittet, wird weggeklickt.
  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setDarfKlingeln(Notification.permission === "granted");
    }
  }, []);

  /**
   * Neue Meldung, Tab im Hintergrund: eine Benachrichtigung des
   * Systems. Liegt das Tool im Vordergrund, genuegt der Zaehler -
   * zweimal dasselbe zu melden ist laestig.
   *
   * Das gilt, solange das Tool in einem Tab offen ist. Fuer eine
   * Meldung bei geschlossenem Browser braeuchte es einen Service
   * Worker und einen Push-Dienst; das ist ein eigener Schritt.
   */
  useEffect(() => {
    if (!darfKlingeln || typeof Notification === "undefined") return;

    for (const m of meldungen) {
      if (m.readAt || gesehen.current.has(m.id)) continue;
      gesehen.current.add(m.id);

      // Beim ersten Laden nicht nachtraeglich klingeln: was gestern
      // geschrieben wurde, ist keine Neuigkeit.
      const alter = Date.now() - new Date(m.createdAt).getTime();
      if (alter > 60_000) continue;
      if (document.visibilityState === "visible") continue;

      try {
        new Notification(m.titel, { body: m.text ?? "", tag: m.id });
      } catch {
        /* manche Browser verbieten das ausserhalb einer Geste */
      }
    }
  }, [meldungen, darfKlingeln]);

  const erlaubnisHolen = async () => {
    if (typeof Notification === "undefined") return;
    const antwort = await Notification.requestPermission();
    setDarfKlingeln(antwort === "granted");
  };

  const oeffneAufgabe = async (meldungId: string, taskId: string | null) => {
    await meldungGelesen(meldungId);
    if (taskId && tasks.some((t) => t.id === taskId)) {
      setAufgabeId(taskId);
      setOffen(false);
    }
  };

  const aufgabe = tasks.find((t) => t.id === aufgabeId);

  return (
    <>
      <div className="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-2">
        {offen ? (
          <div
            className="panel flex max-h-[60vh] w-[320px] flex-col overflow-hidden p-0 text-xs"
            role="dialog"
            aria-label="Benachrichtigungen"
          >
            <div className="line flex items-center justify-between gap-2 border-b px-3 py-2">
              <strong className="text-[13px]">Nachrichten</strong>
              {ungelesen > 0 ? (
                <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={alleMeldungenGelesen}>
                  Alle gelesen
                </button>
              ) : null}
            </div>

            {meldungen.length === 0 ? (
              <p className="muted px-3 py-4 text-center text-[11px]">
                Noch nichts. Notizen an deinen Aufgaben erscheinen hier.
              </p>
            ) : (
              <ul className="flex-1 overflow-y-auto">
                {meldungen.map((m) => (
                  <li key={m.id}>
                    <button
                      className="line w-full border-b px-3 py-2 text-left"
                      style={{ background: m.readAt ? "transparent" : "var(--panel-2)" }}
                      onClick={() => oeffneAufgabe(m.id, m.taskId)}
                    >
                      <span className="flex items-baseline gap-2">
                        {!m.readAt ? (
                          <span
                            aria-hidden
                            className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ background: "var(--color-ci-500)" }}
                          />
                        ) : null}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{m.titel}</span>
                          {m.text ? (
                            <span className="muted line-clamp-2 block text-[11px]">{m.text}</span>
                          ) : null}
                          <span className="muted block text-[10px]">
                            {formatDateTime(m.createdAt)}
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {!darfKlingeln && typeof Notification !== "undefined" ? (
              <div className="line border-t px-3 py-2">
                <button className="btn" style={{ fontSize: 11 }} onClick={erlaubnisHolen}>
                  Auch außerhalb des Tabs benachrichtigen
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          className="relative flex h-12 w-12 items-center justify-center rounded-full shadow-lg"
          style={{ background: "var(--color-ci-400)", color: "var(--auf-akzent)" }}
          onClick={() => setOffen((o) => !o)}
          aria-label={ungelesen ? `${ungelesen} ungelesene Nachrichten` : "Nachrichten"}
          title={ungelesen ? `${ungelesen} ungelesen` : "Nachrichten"}
        >
          <span aria-hidden style={{ fontSize: 20, lineHeight: 1 }}>
            💬
          </span>
          {ungelesen > 0 ? (
            <span
              className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[11px] font-bold"
              style={{ background: "var(--err-fg)", color: "#fff" }}
            >
              {ungelesen > 99 ? "99+" : ungelesen}
            </span>
          ) : null}
        </button>
      </div>

      {aufgabe ? (
        <TaskDetailDialog task={aufgabe} onClose={() => setAufgabeId(null)} />
      ) : null}
    </>
  );
}
