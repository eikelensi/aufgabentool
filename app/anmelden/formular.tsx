/**
 * Anmeldung mit E-Mail und Passwort, plus "Passwort vergessen".
 *
 * Bewusst ohne Selbstregistrierung: Zugaenge legt der Adminbereich an.
 * Fehlermeldungen bleiben absichtlich unspezifisch - sie sollen nicht
 * verraten, welche Mailadressen im Tool existieren.
 */
"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

type Modus = "anmelden" | "vergessen";

export default function AnmeldenFormular() {
  const router = useRouter();
  const params = useSearchParams();
  const weiter = params.get("weiter") || "/";

  const [modus, setModus] = useState<Modus>("anmelden");
  const [email, setEmail] = useState("");
  const [passwort, setPasswort] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState(params.get("fehler") || "");
  const [hinweis, setHinweis] = useState("");

  async function anmelden(e: React.FormEvent) {
    e.preventDefault();
    setFehler("");
    setHinweis("");
    setLaeuft(true);

    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: passwort,
    });

    if (error) {
      setLaeuft(false);
      setFehler(
        /invalid login/i.test(error.message)
          ? "E-Mail oder Passwort stimmt nicht."
          : /email not confirmed/i.test(error.message)
            ? "Dieser Zugang ist noch nicht bestaetigt. Bitte den Einladungslink aus der Mail benutzen."
            : error.message,
      );
      return;
    }

    // Vollstaendiges Neuladen, damit die Server-Komponenten die frische
    // Sitzung aus den Cookies sehen.
    router.replace(weiter);
    router.refresh();
  }

  async function passwortVergessen(e: React.FormEvent) {
    e.preventDefault();
    setFehler("");
    setHinweis("");
    setLaeuft(true);

    const supabase = supabaseBrowser();
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/bestaetigen?next=/passwort-setzen`,
    });

    // Immer dieselbe Antwort, egal ob die Adresse existiert.
    setLaeuft(false);
    setHinweis(
      "Wenn es zu dieser Adresse einen Zugang gibt, ist die Mail unterwegs. " +
        "Der Link gilt eine Stunde.",
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="panel w-full max-w-[380px] p-6">
        <div className="mb-5">
          <Image
            src="/logo.png"
            alt="4wändekanzlei"
            width={736}
            height={120}
            priority
            className="h-8 w-auto"
          />
          <div className="muted mt-2 text-[11px]">Aufgabentool</div>
        </div>

        <h1 className="mb-1 text-base font-semibold">
          {modus === "anmelden" ? "Anmelden" : "Passwort zuruecksetzen"}
        </h1>
        <p className="muted mb-4 text-xs leading-relaxed">
          {modus === "anmelden"
            ? "Mit der Mailadresse, an die die Einladung ging."
            : "Wir schicken dir einen Link, mit dem du ein neues Passwort setzt."}
        </p>

        <form onSubmit={modus === "anmelden" ? anmelden : passwortVergessen}>
          <label className="mb-1 block text-xs font-medium" htmlFor="email">
            E-Mail
          </label>
          <input
            id="email"
            className="field mb-3"
            type="email"
            autoComplete="username"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          {modus === "anmelden" ? (
            <>
              <label className="mb-1 block text-xs font-medium" htmlFor="passwort">
                Passwort
              </label>
              <input
                id="passwort"
                className="field mb-3"
                type="password"
                autoComplete="current-password"
                required
                value={passwort}
                onChange={(e) => setPasswort(e.target.value)}
              />
            </>
          ) : null}

          {fehler ? (
            <p
              className="mb-3 rounded-md px-2.5 py-2 text-xs"
              style={{ background: "#fee2e2", color: "#b91c1c" }}
              role="alert"
            >
              {fehler}
            </p>
          ) : null}

          {hinweis ? (
            <p
              className="mb-3 rounded-md px-2.5 py-2 text-xs"
              style={{ background: "#dcfce7", color: "#15803d" }}
              role="status"
            >
              {hinweis}
            </p>
          ) : null}

          <button className="btn btn-primary w-full" type="submit" disabled={laeuft}>
            {laeuft
              ? "Einen Moment…"
              : modus === "anmelden"
                ? "Anmelden"
                : "Link anfordern"}
          </button>
        </form>

        <button
          className="muted mt-3 w-full text-center text-xs underline"
          type="button"
          onClick={() => {
            setModus(modus === "anmelden" ? "vergessen" : "anmelden");
            setFehler("");
            setHinweis("");
          }}
        >
          {modus === "anmelden" ? "Passwort vergessen?" : "Zurueck zur Anmeldung"}
        </button>

        <p className="muted mt-5 border-t pt-3 text-[11px] leading-relaxed">
          Neue Zugaenge legt der Adminbereich an. Wenn du keinen hast, wende dich
          an Eike oder Markus.
        </p>
      </div>
    </div>
  );
}
