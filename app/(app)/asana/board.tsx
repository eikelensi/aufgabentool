"use client";

import React, { useState } from "react";
import { useStore } from "@/lib/store";
import TaskCard from "@/components/TaskCard";
import { TaskDetailDialog } from "@/components/dialogs";
import { EmptyState } from "@/components/ui";
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
  const { asanaSpalten, asanaTasks, neuLaden, bereit } = useStore();
  const [offen, setOffen] = useState<Task | null>(null);
  const [zieht, setZieht] = useState<Task | null>(null);
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
        <span className="muted text-[11px]">
          Asana führt: Titel, Text, Zuständigkeit und Spalte kommen von dort. Jede Aufgabe
          steht zusätzlich in onOffice.
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

      <div className="scroll-x flex items-start gap-3 pb-2" style={{ opacity: laeuft ? 0.6 : 1 }}>
        {asanaSpalten.map((spalte) => {
          const karten = asanaTasks.filter((t) => t.asanaSectionGid === spalte.gid);
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
    </div>
  );
}
