/**
 * Endpunkt fuer Links aus Mails: Einladung, Passwort vergessen,
 * Mailadresse bestaetigen.
 *
 * Supabase schickt je nach Vorlage und Ablauf drei verschiedene Formen,
 * und genau daran ist der erste Versuch gescheitert - er kannte nur eine:
 *
 *   1. ?code=...                 PKCE. Der Code wird gegen eine Sitzung
 *                                getauscht; der Pruefwert dazu liegt als
 *                                Cookie bei uns.
 *   2. ?token_hash=...&type=...  Token-Hash-Vorlage, direkt pruefbar.
 *   3. #access_token=...         Die Sitzung steckt im Anker der Adresse.
 *                                Der Server sieht Anker nie - also einfach
 *                                weiterleiten, die Seite dort liest ihn
 *                                selbst aus.
 *
 * Deshalb ist der letzte Fall kein Fehler mehr, sondern der Normalfall
 * ohne erkennbare Parameter.
 */
import { redirect } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ziel(weiter: string, fehler?: string): string {
  if (!fehler) return weiter;
  return "/anmelden?fehler=" + encodeURIComponent(fehler);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const weiter = searchParams.get("next") ?? "/passwort-setzen";

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  // Supabase kann den Fehler auch schon selbst mitschicken.
  const fehlerCode = searchParams.get("error_code");
  const fehlerText = searchParams.get("error_description");
  if (fehlerCode || fehlerText) {
    redirect(
      ziel(
        weiter,
        /expired|invalid/i.test(`${fehlerCode} ${fehlerText}`)
          ? "Der Link ist abgelaufen oder wurde schon benutzt. Bitte neu anfordern."
          : (fehlerText ?? "Der Link wurde abgelehnt."),
      ),
    );
  }

  const supabase = await supabaseServer();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      redirect(
        ziel(
          weiter,
          "Der Link ist abgelaufen oder wurde in einem anderen Browser geöffnet. " +
            "Bitte im selben Browser neu anfordern.",
        ),
      );
    }
    redirect(weiter);
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) {
      redirect(
        ziel(weiter, "Der Link ist abgelaufen oder wurde schon benutzt. Bitte neu anfordern."),
      );
    }
    redirect(weiter);
  }

  // Dritter Fall: die Sitzung steckt im Anker. Weiterleiten und die Seite
  // dort auslesen lassen - der Anker bleibt beim Weiterleiten erhalten.
  redirect(weiter);
}
