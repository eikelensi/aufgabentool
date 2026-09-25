/**
 * "Einstellungen" gibt es nicht mehr als Seite.
 *
 * Es war eine Sammelstelle: Kategorien, Fristen, Dateien, Mailvorlagen
 * und der onOffice-Zustand untereinander auf 460 Zeilen. Der Inhalt
 * liegt jetzt in eigenen Seiten unter "Aufgaben", "Mitteilungen" und
 * "onOffice".
 *
 * Diese Weiche bleibt, damit alte Lesezeichen nicht ins Leere laufen.
 */
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function EinstellungenAlt() {
  redirect("/admin/kategorien");
}
