"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import TaskCard from "@/components/TaskCard";
import { TaskDetailDialog } from "@/components/dialogs";
import { EmptyState, Field, Modal } from "@/components/ui";
import type { Task } from "@/lib/types";

/**
 * Das Board der Geschaeftsfuehrung.
 *
 * Eine Spalte je Abschnitt in Asana, in derselben Reihenfolge. Karten
 * lassen sich ziehen; das schreibt nach Asana zurueck, denn ein Board,
 * dessen Karten festkleben, ist ein Bild.
 *
 * Die Pool-Spalte ist hervorgehoben und heisst, was sie tut: was dort
 * landet, verlaesst diesen Bereich. Das soll niemand aus Versehen tun
 * und hinterher raten, wo die Aufgabe geblieben ist.
 */
export default function AsanaBoard() {
  const { asanaSpalten, asanaTasks, asanaNutzer, asanaAnlegen, neuLaden, bereit } = useStore();
  const [offen, setOffen] = useState<Task | null>(null);
  const [zieht, setZieht] = useState<Task | null>(null);
  const leiste = useRef<HTMLDivElement>(null);
  const [neueIn, setNeueIn] = useState<string | null>(null);
  // Erledigtes verstopft ein Board, das zum Arbeiten da ist - es ist
  // einen Klick entfernt, aber nicht im Weg.
  const [zeigeFertige, setZeigeFertige] = useState(false);
  const [holt, setHolt] = useState(false);

  /**
   * Bei Asana nachfragen, nicht warten.
   *
   * Der Zeitplan auf dem Server laeuft im Minutentakt - fuer jemanden,
   * der drueben gerade eine Aufgabe angelegt hat, ist eine Minute
   * lang. Wer diese Seite offen hat, fragt deshalb selbst: beim
   * Oeffnen, beim Zurueckkommen zum Tab und alle halbe Minute,
   * solange man hinsieht. Im Hintergrund nicht - ein Tab, den
   * niemand ansieht, braucht kein frisches Board.
   */
  const holen = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    setHolt(true);
    try {
      await fetch("/api/sync/asana", { method: "POST" });
      await neuLaden();
    } catch {
      /* dann eben beim naechsten Mal */
    }
    setHolt(false);
  }, [neuLaden]);

  useEffect(() => {
    void holen();

    const beiRueckkehr = () => {
      if (document.visibilityState === "visible") void holen();
    };
    document.addEventListener("visibilitychange", beiRueckkehr);
    window.addEventListener("focus", beiRueckkehr);
    const takt = setInterval(() => void holen(), 30_000);

    return () => {
      document.removeEventListener("visibilitychange", beiRueckkehr);
      window.removeEventListener("focus", beiRueckkehr);
      clearInterval(takt);
    };
  }, [holen]);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  const verschiebe = async (task: Task, sectionGid: string) => {
    if (task.asanaSectionGid === sectionGid) return;
    setLaeuft(true);
    setMeldung(null);
    try {
      const res = await fetch("/api/asana/verschieben", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id, sectionGid }),
      });
      const json = await res.json().catch(() => ({}));
      setMeldung(json.meldung ?? json.fehler ?? null);
    } catch {
      setMeldung("Asana war gerade nicht erreichbar – die Karte blieb, wo sie war.");
    }
    setLaeuft(false);
    await neuLaden();
  };

  if (!bereit) return <p className="muted text-xs">Lade…</p>;

  if (asanaSpalten.length === 0) {
    return (
      <EmptyState text="Noch keine Spalten – der Abgleich mit Asana läuft alle fünf Minuten und war noch nicht dran." />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <h1 className="text-base font-semibold">Buchhaltung und HR</h1>
        {/* Elf Spalten passen auf keinen Bildschirm. Wischen geht auf
            dem Trackpad, aber nicht jeder arbeitet an einem - also
            zwei Knoepfe, die dasselbe tun. */}
        <span className="ml-auto flex items-center gap-1">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setNeueIn(asanaSpalten.find((sp) => !sp.istPool)?.gid ?? "")}
          >
            + Aufgabe
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void holen()}
            disabled={holt}
            title="Jetzt bei Asana nachfragen"
          >
            {holt ? "…" : "↻"}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setZeigeFertige((z) => !z)}
            title="Erledigte Aufgaben ein- oder ausblenden"
          >
            {zeigeFertige ? "Erledigte aus" : "Erledigte an"}
          </button>
          <button
            type="button"
            className="btn"
            title="Nach links"
            aria-label="Board nach links scrollen"
            onClick={() => leiste.current?.scrollBy({ left: -320, behavior: "smooth" })}
          >
            ◀
          </button>
          <button
            type="button"
            className="btn"
            title="Nach rechts"
            aria-label="Board nach rechts scrollen"
            onClick={() => leiste.current?.scrollBy({ left: 320, behavior: "smooth" })}
          >
            ▶
          </button>
        </span>
        <span className="muted text-[11px]">
          Asana führt: Titel, Text, Zuständigkeit und Spalte kommen von dort. Diese Seite
          fragt beim Öffnen und alle 30 Sekunden nach{holt ? " – gerade jetzt" : ""}.
        </span>
      </div>

      {meldung ? (
        <p
          className="rounded-md px-2.5 py-2 text-[11px]"
          style={{ background: "var(--panel-2)", color: "var(--muted)" }}
          role="status"
        >
          {meldung}
        </p>
      ) : null}

      <div
        ref={leiste}
        className="scroll-x flex items-start gap-3 pb-2"
        style={{ opacity: laeuft ? 0.6 : 1 }}
      >
        {asanaSpalten.map((spalte) => {
          const karten = asanaTasks.filter(
            (t) =>
              t.asanaSectionGid === spalte.gid &&
              (zeigeFertige || t.status !== "erledigt"),
          );
          return (
            <section
              key={spalte.gid}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (zieht) void verschiebe(zieht, spalte.gid);
                setZieht(null);
              }}
              className="panel flex w-[290px] shrink-0 flex-col gap-2 p-2.5"
              style={
                spalte.istPool
                  ? { background: "var(--info-bg)", borderColor: "var(--color-ci-400)" }
                  : { background: "var(--panel-2)" }
              }
            >
              <header className="flex items-baseline justify-between gap-2">
                <h2 className="text-[13px] font-semibold">{spalte.name}</h2>
                <span className="muted text-[11px]">{karten.length}</span>
                {!spalte.istPool ? (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: 11, padding: "0 0.35rem" }}
                    title={`Aufgabe in „${spalte.name}“ anlegen`}
                    onClick={() => setNeueIn(spalte.gid)}
                  >
                    +
                  </button>
                ) : null}
              </header>

              {spalte.istPool ? (
                <p className="muted text-[11px] leading-relaxed">
                  Hierher gezogen heißt: abgegeben. Die Aufgabe geht in den Aufgabenpool,
                  verschwindet hier und meldet sich bei Geschäftsführung und
                  Qualitätsmanagement.
                </p>
              ) : null}

              <div className="flex flex-col gap-2">
                {karten.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    onOpen={setOffen}
                    onDragStart={setZieht}
                    showAssignee
                    compact
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {offen ? <TaskDetailDialog task={offen} onClose={() => setOffen(null)} /> : null}

      {neueIn !== null ? (
        <NeueAsanaAufgabe
          spalteGid={neueIn}
          onClose={() => setNeueIn(null)}
          onAnlegen={asanaAnlegen}
          spalten={asanaSpalten.filter((sp) => !sp.istPool)}
          nutzer={asanaNutzer}
        />
      ) : null}
    </div>
  );
}

/**
 * Neue Aufgabe im Asana-Bereich.
 *
 * Angelegt wird sie in Asana, nicht hier - sonst gaebe es fuer einen
 * Moment zwei Wahrheiten. Der Umweg kostet ein paar Sekunden, dafuer
 * muss nie geraten werden, welche die richtige ist.
 */
function NeueAsanaAufgabe({
  spalteGid,
  spalten,
  nutzer,
  onAnlegen,
  onClose,
}: {
  spalteGid: string;
  spalten: { gid: string; name: string }[];
  nutzer: { gid: string; name: string }[];
  onAnlegen: (werte: {
    titel: string;
    beschreibung?: string;
    sectionGid?: string;
    assigneeGid?: string | null;
    dueOn?: string | null;
  }) => Promise<{ ok: boolean; error?: string }>;
  onClose: () => void;
}) {
  const [titel, setTitel] = useState("");
  const [beschreibung, setBeschreibung] = useState("");
  const [spalte, setSpalte] = useState(spalteGid || (spalten[0]?.gid ?? ""));
  const [wer, setWer] = useState("");
  const [faellig, setFaellig] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const speichern = async () => {
    if (!titel.trim()) {
      setFehler("Ohne Titel geht es nicht.");
      return;
    }
    setLaeuft(true);
    const res = await onAnlegen({
      titel,
      beschreibung,
      sectionGid: spalte || undefined,
      assigneeGid: wer || null,
      dueOn: faellig || null,
    });
    setLaeuft(false);
    if (!res.ok) {
      setFehler(res.error ?? "Asana hat die Aufgabe nicht angenommen.");
      return;
    }
    onClose();
  };

  return (
    <Modal title="Neue Aufgabe in Asana" onClose={onClose}>
      <div className="flex flex-col gap-3">
        <Field label="Titel *">
          <input
            className="field"
            autoFocus
            value={titel}
            onChange={(e) => setTitel(e.target.value)}
            placeholder="Was ist zu tun?"
          />
        </Field>

        <Field label="Beschreibung">
          <textarea
            className="field min-h-[100px]"
            value={beschreibung}
            onChange={(e) => setBeschreibung(e.target.value)}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Spalte">
            <select className="field" value={spalte} onChange={(e) => setSpalte(e.target.value)}>
              {spalten.map((sp) => (
                <option key={sp.gid} value={sp.gid}>
                  {sp.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Zuständig">
            <select className="field" value={wer} onChange={(e) => setWer(e.target.value)}>
              <option value="">– niemand –</option>
              {nutzer.map((n) => (
                <option key={n.gid} value={n.gid}>
                  {n.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Fällig">
            <input
              type="date"
              className="field"
              value={faellig}
              onChange={(e) => setFaellig(e.target.value)}
            />
          </Field>
        </div>

        <p className="muted text-[11px] leading-relaxed">
          Die Aufgabe entsteht in Asana und wird sofort hierher geholt. Ist das Anlegen in
          onOffice eingeschaltet, bekommt sie dort auch ein Gegenstück.
        </p>

        {fehler ? (
          <p className="text-[11px]" style={{ color: "var(--err-fg)" }}>
            {fehler}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-primary" onClick={speichern} disabled={laeuft}>
            {laeuft ? "Legt an…" : "Aufgabe anlegen"}
          </button>
          <button type="button" className="btn" onClick={onClose} disabled={laeuft}>
            Abbrechen
          </button>
        </div>
      </div>
    </Modal>
  );
}
