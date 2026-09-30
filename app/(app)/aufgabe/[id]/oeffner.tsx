"use client";

import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { TaskDetailDialog } from "@/components/dialogs";

export default function Oeffner({ id }: { id: string }) {
  const router = useRouter();
  const { tasks, bereit } = useStore();

  if (!bereit) {
    return <p className="muted p-4 text-xs">Wird geladen…</p>;
  }

  const aufgabe = tasks.find((t) => t.id === id);

  if (!aufgabe) {
    return (
      <div className="panel p-4" style={{ maxWidth: 520 }}>
        <h1 className="mb-2 text-base font-semibold">Aufgabe nicht gefunden</h1>
        <p className="muted text-xs leading-relaxed">
          Entweder gibt es diese Aufgabe nicht mehr, oder sie gehört zu einem Bereich, den
          du nicht siehst. Privat gestellte Aufgaben sieht nur ihr Urheber.
        </p>
        <button type="button" className="btn mt-3" onClick={() => router.push("/")}>
          Zur Startseite
        </button>
      </div>
    );
  }

  // Schliessen fuehrt dorthin, wo die Aufgabe zu Hause ist - zurueck
  // in die Mail waere keine Hilfe. Ein Klick im Verlauf zurueck oeffnet
  // sonst dieselbe Seite erneut.
  return (
    <TaskDetailDialog
      task={aufgabe}
      onClose={() => router.push(aufgabe.isPool ? "/pool" : "/mein-tag")}
    />
  );
}
