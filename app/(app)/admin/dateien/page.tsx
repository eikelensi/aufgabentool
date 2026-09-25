import Seitenkopf from "../seitenkopf";
import DateienFormular from "./formular";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dateien – Aufgabentool" };

export default function DateienSeite() {
  return (
    <>
      <Seitenkopf
        titel="Dateien an Aufgaben"
        text="Wie groß ein Anhang sein darf und ob er zusätzlich in onOffice landet."
      />
      <DateienFormular />
    </>
  );
}
