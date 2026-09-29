import Seitenkopf from "../seitenkopf";
import LinkFormular from "./formular";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verlinkungen – Aufgabentool" };

export default function LinkVerwaltung() {
  return (
    <>
      <Seitenkopf
        titel="Verlinkungen"
        text="Die übrigen Anwendungen des Hauses, wie sie im Bereich „Verlinkungen“ erscheinen. Abschalten blendet einen Eintrag aus, ohne ihn wegzuwerfen."
      />
      <LinkFormular />
    </>
  );
}
