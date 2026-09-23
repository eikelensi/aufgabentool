/**
 * Einstellungen. Die Bedienelemente sind eine Client-Komponente; der
 * Zustand der onOffice-Anbindung wird hier auf dem Server ermittelt und
 * durchgereicht, weil er aus Datenbank und Umgebung stammt.
 */
import { serviceRoleVorhanden, supabaseAdmin } from "@/lib/supabase/admin";
import { ladeAnbindung } from "./anbindung";
import EinstellungenFormular from "./formular";
import Rueckschreiben from "./rueckschreiben";

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

  const sb = supabaseAdmin();
  const [anbindung, { data: schalter }] = await Promise.all([
    ladeAnbindung(),
    sb
      .from("app_settings")
      .select("sync_read_only, sync_push_assignee, sync_push_status, sync_push_inhalt, sync_push_neu")
      .maybeSingle(),
  ]);

  return (
    <>
      {/* Steht ganz oben: es ist die folgenreichste Einstellung der Seite. */}
      <Rueckschreiben
        stand={{
          // Im Zweifel gesperrt anzeigen - so wie die Sperre selbst
          // im Zweifel sperrt.
          nurLesen: schalter?.sync_read_only !== false,
          bearbeiter: schalter?.sync_push_assignee === true,
          status: schalter?.sync_push_status === true,
          inhalt: schalter?.sync_push_inhalt === true,
          anlegen: schalter?.sync_push_neu === true,
        }}
      />
      <EinstellungenFormular anbindung={anbindung} />
    </>
  );
}
