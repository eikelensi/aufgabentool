/**
 * Supabase auf dem Server - liest die Sitzung aus den Cookies.
 *
 * Auch hier gilt die Zeilensicherheit: dieser Client handelt im Namen des
 * angemeldeten Menschen, nicht als Administrator.
 */
import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { imFremdenRahmen, mitKeksOptionen } from "./keks";

export async function supabaseServer() {
  const store = await cookies();
  // Nur im fremden Rahmen bekommen die Kekse Sonderrechte - sonst
  // liegen zwei Keksfamilien nebeneinander und die Anmeldung faellt
  // ohne Grund auseinander. Siehe keks.ts.
  const imRahmen = imFremdenRahmen(await headers());

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return store.getAll();
        },
        setAll(liste) {
          // In Server-Komponenten ist Schreiben nicht erlaubt; dort erneuert
          // die Middleware die Sitzung. Deshalb bewusst stillschweigend.
          try {
            for (const { name, value, options } of liste)
              store.set(name, value, mitKeksOptionen(options, imRahmen));
          } catch {
            /* absichtlich leer */
          }
        },
      },
    },
  );
}
