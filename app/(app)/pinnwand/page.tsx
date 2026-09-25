/**
 * Die Pinnwand - was frueher das Teamboard war.
 *
 * Ein eigenes Projekt mit eigener Anmeldung, eigener Datenbank und
 * eigener Adresse, fuer eine Handvoll Notizzettel. Jetzt ein Bereich
 * wie jeder andere: dieselbe Anmeldung, dieselben Rollen, dasselbe
 * Protokoll.
 */
import Brett from "./brett";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pinnwand – Aufgabentool" };

export default function PinnwandSeite() {
  return <Brett />;
}
