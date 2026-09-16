/**
 * Die Anmeldeseite liest "weiter" und "fehler" aus der Adresszeile. Das
 * geht nur im Browser, deshalb steckt das Formular in einer eigenen
 * Client-Komponente hinter einer Suspense-Grenze - sonst scheitert das
 * Vorrendern beim Build.
 */
import { Suspense } from "react";
import AnmeldenFormular from "./formular";

export const metadata = { title: "Anmelden – Aufgabentool" };

export default function AnmeldenSeite() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="muted text-xs">Einen Moment…</p>
        </div>
      }
    >
      <AnmeldenFormular />
    </Suspense>
  );
}
