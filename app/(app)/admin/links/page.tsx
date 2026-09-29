import Seitenkopf from "../seitenkopf";
import LinkFormular from "./formular";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verlinkungen – Aufgabentool" };

export default function LinkVerwaltung() {
  return (
    <>
      <Seitenkopf
        titel="Verlinkungen"
        text="Die übrigen Anwendungen des Hauses und der Name, unter dem der Bereich im Menü steht. Abschalten blendet einen Eintrag aus, ohne ihn wegzuwerfen; Adressen werden beim Verlassen des Feldes gespeichert."
      />
      <LinkFormular />
    </>
  );
}
