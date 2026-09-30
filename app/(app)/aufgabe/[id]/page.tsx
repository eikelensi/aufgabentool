/**
 * Eine einzelne Aufgabe, direkt aufrufbar.
 *
 * Es gab bisher keine Adresse, unter der EINE Aufgabe liegt - Aufgaben
 * leben in Listen, und eine Mail konnte deshalb nur sagen "steht im
 * Tool", nicht "hier". Wer eine Meldung bekam, suchte danach im Pool
 * oder im Team-Bereich.
 *
 * Die Pruefung, wer sie sehen darf, macht die Datenbank: die Zeile
 * kommt ueber dieselben Regeln wie in jeder Liste. Steht sie nicht im
 * Bestand dieses Menschen, sagt die Seite das - sie erfindet keine
 * Aufgabe und behauptet auch nicht, es gaebe keine.
 */
import Oeffner from "./oeffner";

export const dynamic = "force-dynamic";
export const metadata = { title: "Aufgabe – Aufgabentool" };

export default async function AufgabenSeite({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Oeffner id={id} />;
}
