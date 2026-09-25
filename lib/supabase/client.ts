/**
 * Supabase im Browser.
 *
 * Nutzt den veroeffentlichbaren Schluessel - der darf im Browser stehen.
 * Was ein angemeldeter Mensch sehen und aendern darf, entscheidet allein
 * die Zeilensicherheit in der Datenbank, nicht dieser Code.
 */
"use client";

import { createBrowserClient } from "@supabase/ssr";
import { keksOptionen } from "./keks";

export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // Nur wenn die Seite wirklich in einem fremden Rahmen laeuft -
    // im eigenen Tab bleibt alles bei der Voreinstellung. Siehe
    // keks.ts; das pauschale Umstellen hat Anmeldungen zerrissen.
    {
      cookieOptions: keksOptionen(
        typeof window !== "undefined" && window.self !== window.top,
      ),
    },
  );
}
