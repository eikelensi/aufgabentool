import Seitenkopf from "../seitenkopf";
import PinThemenFormular from "./formular";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pinnwand – Aufgabentool" };

export default function PinnwandVerwaltung() {
  return (
    <>
      <Seitenkopf
        titel="Pinnwand"
        text="Die Themen der Pinnwand und ihre Farben. Ein Thema zu löschen entfernt keine Pins – sie stehen danach ohne Thema da."
      />
      <PinThemenFormular />
    </>
  );
}
