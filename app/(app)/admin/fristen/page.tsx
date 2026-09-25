import Seitenkopf from "../seitenkopf";
import FristenFormular from "./formular";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fristen und Pool – Aufgabentool" };

export default function FristenSeite() {
  return (
    <>
      <Seitenkopf
        titel="Fristen und Pool"
        text="Wann das Tool von sich aus nachhakt und ab wann eine Aufgabe auffällt, die zu lange liegt."
      />
      <FristenFormular />
    </>
  );
}
