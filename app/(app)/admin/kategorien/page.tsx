import Seitenkopf from "../seitenkopf";
import KategorienFormular from "./formular";

export const dynamic = "force-dynamic";
export const metadata = { title: "Kategorien – Aufgabentool" };

export default function KategorienSeite() {
  return (
    <>
      <Seitenkopf
        titel="Kategorien"
        text="Frei anlegbar, umbenennbar, farblich änderbar, sortierbar und löschbar – jederzeit. Diese Kategorien bleiben im Haus und werden nicht nach onOffice übertragen."
      />
      <KategorienFormular />
    </>
  );
}
