/**
 * Die Seite liest token_hash und type aus der Adresszeile - das geht nur
 * im Browser, deshalb steckt das Formular hinter einer Suspense-Grenze.
 */
import { Suspense } from "react";
import PasswortSetzenFormular from "./formular";

export const metadata = { title: "Passwort setzen – Aufgabentool" };

export default function PasswortSetzenSeite() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="muted text-xs">Einen Moment…</p>
        </div>
      }
    >
      <PasswortSetzenFormular />
    </Suspense>
  );
}
