/**
 * Supabase mit Service-Role-Schluessel.
 *
 * ACHTUNG: dieser Schluessel umgeht jede Zeilensicherheit. Er darf
 * ausschliesslich auf dem Server verwendet werden - in Serveraktionen und
 * Routen - und niemals in eine Datei, die im Browser landet.
 *
 * Gebraucht wird er nur fuer Dinge, die echte Administratorrechte
 * verlangen: Nutzer einladen, Passwort-Zuruecksetzen anstossen, Konten
 * deaktivieren. Jede Funktion, die ihn nutzt, muss vorher selbst pruefen,
 * ob die anfragende Person Admin ist.
 */
import { createClient } from "@supabase/supabase-js";

export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY fehlt. Lokal eintragen mit: npm run zugangsdaten supabase. " +
        "Auf Vercel unter Settings, Environment Variables.",
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function serviceRoleVorhanden(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
