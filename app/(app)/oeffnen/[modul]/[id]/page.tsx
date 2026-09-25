/**
 * Die Weiche nach onOffice.
 *
 * Ein Klick auf eine Objekt- oder Adressnummer landet hier, und von
 * hier geht es weiter an die Adresse, die onOffice selbst ausstellt
 * (siehe lib/onoffice/getlink.ts). Der Umweg hat zwei Gruende:
 *
 * 1. Die Adresse muss frisch geholt werden - sie ist verschluesselt
 *    und kann sich aendern. In der Karte kann sie nicht stehen.
 * 2. Es ist eine SEITE und keine /api-Route. Die Middleware laesst
 *    /api bewusst aus, dort kommt aus der Adresszeile keine Sitzung
 *    an. Hier schon.
 *
 * Geht etwas schief, wird nicht weitergeleitet, sondern erklaert. Ein
 * Klick, der wortlos auf dem Dashboard endet, war genau das Problem.
 */
import { redirect } from "next/navigation";
import { aktuellesProfil } from "@/lib/supabase/profil";
import { onofficeConfigured } from "@/lib/onoffice/client";
import { holeDeeplink, type LinkModul } from "@/lib/onoffice/getlink";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TITEL: Record<LinkModul, string> = {
  estate: "Objekt",
  address: "Adresse",
};

function Hinweis({ text }: { text: string }) {
  return (
    <div className="panel p-4" style={{ maxWidth: 560 }}>
      <h1 className="mb-2 text-base font-semibold">onOffice konnte nicht geöffnet werden</h1>
      <p className="muted text-sm leading-relaxed">{text}</p>
      <p className="muted mt-3 text-xs">Dieses Fenster kann geschlossen werden.</p>
    </div>
  );
}

export default async function Weiche({
  params,
}: {
  params: Promise<{ modul: string; id: string }>;
}) {
  const { modul, id } = await params;

  const profil = await aktuellesProfil();
  if (!profil?.isActive) return <Hinweis text="Diese Anmeldung gilt nicht (mehr)." />;

  if (modul !== "estate" && modul !== "address") {
    return <Hinweis text={`Für „${modul}“ gibt es in onOffice keinen Direktlink.`} />;
  }
  if (!/^\d+$/.test(id)) {
    return <Hinweis text="Die Datensatznummer fehlt oder ist keine Zahl." />;
  }
  if (!onofficeConfigured()) {
    return <Hinweis text="Die onOffice-Zugangsdaten sind in dieser Umgebung nicht gesetzt." />;
  }

  let ziel: string | null = null;
  let fehler: string | null = null;
  try {
    ziel = await holeDeeplink(modul, id);
  } catch (err) {
    fehler = (err as Error).message;
  }

  if (!ziel) {
    return (
      <Hinweis
        text={
          fehler
            ? `onOffice hat den Link abgelehnt: ${fehler}`
            : `onOffice kennt ${TITEL[modul]} ${id} nicht – oder gibt dafür keinen Link heraus.`
        }
      />
    );
  }

  redirect(ziel);
}
