/**
 * Supabase im Browser.
 *
 * Nutzt den veroeffentlichbaren Schluessel - der darf im Browser stehen.
 * Was ein angemeldeter Mensch sehen und aendern darf, entscheidet allein
 * die Zeilensicherheit in der Datenbank, nicht dieser Code.
 */
"use client";

import { createBrowserClient } from "@supabase/ssr";
import { KEKS_OPTIONEN } from "./keks";

export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // Damit der Keks auch gilt, wenn die Seite in einem fremden
    // Rahmen laeuft - siehe keks.ts.
    { cookieOptions: KEKS_OPTIONEN },
  );
}
