/**
 * Einstellungen. Die Bedienelemente sind eine Client-Komponente; der
 * Zustand der onOffice-Anbindung wird hier auf dem Server ermittelt und
 * durchgereicht, weil er aus Datenbank und Umgebung stammt.
 */
import { serviceRoleVorhanden } from "@/lib/supabase/admin";
import { ladeAnbindung } from "./anbindung";
import EinstellungenFormular from "./formular";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = { title: "Einstellungen – Aufgabentool" };

export default async function EinstellungenSeite() {
  if (!serviceRoleVorhanden()) {
    return (
      <div className="panel p-4" style={{ maxWidth: 560 }}>
        <p className="muted text-xs">Es fehlt der Service-Role-Schlüssel.</p>
      </div>
    );
  }

  const anbindung = await ladeAnbindung();
  return <EinstellungenFormular anbindung={anbindung} />;
}
