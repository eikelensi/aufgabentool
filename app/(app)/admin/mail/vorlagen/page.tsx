import Seitenkopf from "../../seitenkopf";
import VorlagenFormular from "./formular";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mailvorlagen – Aufgabentool" };

export default function VorlagenSeite() {
  return (
    <>
      <Seitenkopf
        titel="Vorlagen"
        text="Betreff und Text jeder Mail, die das Tool von sich aus verschickt. Eine Vorlage lässt sich einzeln abschalten."
      />
      <VorlagenFormular />
    </>
  );
}
