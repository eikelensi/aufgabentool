import Seitenkopf from "../seitenkopf";
import VersandFormular from "./formular";

export const dynamic = "force-dynamic";
export const metadata = { title: "Versand – Aufgabentool" };

export default function VersandSeite() {
  return (
    <>
      <Seitenkopf
        titel="Versand"
        text="Über welchen Weg das Tool Mails verschickt, in wessen Namen, und wer die Meldung aus dem Pool bekommt."
      />
      <VersandFormular />
    </>
  );
}
