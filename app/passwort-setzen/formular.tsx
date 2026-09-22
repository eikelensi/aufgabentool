"use client";

/**
 * Passwort setzen - nach einer Einladung oder nach "Passwort vergessen".
 *
 * WICHTIG, und der Grund fuer den Umbau: der Token wird NICHT beim Aufbau
 * der Seite eingeloest, sondern erst wenn der Mensch auf "Speichern"
 * drueckt.
 *
 * Mailserver pruefen Links, indem sie sie aufrufen. Ein Einmal-Token ist
 * damit verbraucht, bevor der Empfaenger ueberhaupt klickt - in den
 * Protokollen war der Link sechs Sekunden nach dem Versand geoeffnet und
 * zweiundzwanzig Sekunden spaeter beim echten Klick schon ungueltig. Ein
 * Scanner fuellt aber kein Formular aus und drueckt keinen Knopf.
 */

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase/client";

const MINDESTLAENGE = 10;

export default function PasswortSetzenFormular() {
  const router = useRouter();
  const params = useSearchParams();

  const tokenHash = params.get("token_hash");
  const typ = (params.get("type") as EmailOtpType | null) ?? "recovery";
  const code = params.get("code");

  const [pruefe, setPruefe] = useState(true);
  const [sitzung, setSitzung] = useState(false);
  const [email, setEmail] = useState("");
  const [eins, setEins] = useState("");
  const [zwei, setZwei] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState("");
  const [fertig, setFertig] = useState(false);

  // Beim Aufbau nur nachsehen, ob ohnehin schon eine Sitzung besteht -
  // etwa weil der Anker der Adresse eine mitgebracht hat. Kein Einloesen.
  useEffect(() => {
    const supabase = supabaseBrowser();
    let weg = false;

    const { data: abo } = supabase.auth.onAuthStateChange((_e, s) => {
      if (weg || !s?.user) return;
      setSitzung(true);
      setEmail(s.user.email ?? "");
      setPruefe(false);
    });

    void (async () => {
      for (const warte of [0, 250, 700]) {
        if (weg) return;
        if (warte) await new Promise((r) => setTimeout(r, warte));
        const { data } = await supabase.auth.getUser();
        if (data.user) {
          setSitzung(true);
          setEmail(data.user.email ?? "");
          setPruefe(false);
          return;
        }
      }
      if (!weg) setPruefe(false);
    })();

    return () => {
      weg = true;
      abo.subscription.unsubscribe();
    };
  }, []);

  /** Etwas, womit sich ein Passwort setzen laesst? */
  const verwendbar = sitzung || Boolean(tokenHash) || Boolean(code);

  async function speichern(e: React.FormEvent) {
    e.preventDefault();
    setFehler("");

    if (eins.length < MINDESTLAENGE) {
      setFehler(`Bitte mindestens ${MINDESTLAENGE} Zeichen.`);
      return;
    }
    if (eins !== zwei) {
      setFehler("Die beiden Eingaben stimmen nicht überein.");
      return;
    }

    setLaeuft(true);
    const supabase = supabaseBrowser();

    // Erst jetzt einloesen - ausgeloest durch den Knopfdruck.
    if (!sitzung && tokenHash) {
      const { error } = await supabase.auth.verifyOtp({ type: typ, token_hash: tokenHash });
      if (error) {
        setLaeuft(false);
        setFehler(
          /expired|not found|invalid/i.test(error.message)
            ? "Dieser Link ist nicht mehr gültig. Bitte fordere einen neuen an."
            : error.message,
        );
        return;
      }
    } else if (!sitzung && code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        setLaeuft(false);
        setFehler(
          "Dieser Link lässt sich in diesem Browser nicht öffnen. Fordere ihn " +
            "bitte in dem Browser an, in dem du ihn auch öffnest.",
        );
        return;
      }
    }

    const { error } = await supabase.auth.updateUser({ password: eins });
    if (error) {
      setLaeuft(false);
      setFehler(
        /should be different/i.test(error.message)
          ? "Das ist dein bisheriges Passwort. Bitte ein neues wählen."
          : error.message,
      );
      return;
    }

    setFertig(true);
    setLaeuft(false);
    setTimeout(() => {
      router.replace("/");
      router.refresh();
    }, 1200);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="panel w-full max-w-[380px] p-6">
        <h1 className="mb-1 text-base font-semibold">Passwort setzen</h1>

        {pruefe ? (
          <p className="muted text-xs">Einen Moment…</p>
        ) : !verwendbar ? (
          <>
            <p className="muted mb-4 text-xs leading-relaxed">
              Diese Seite wurde ohne gültigen Link aufgerufen. Fordere über
              „Passwort vergessen?“ einen neuen an.
            </p>
            <a className="btn btn-primary w-full text-center" href="/anmelden">
              Zur Anmeldung
            </a>
          </>
        ) : fertig ? (
          <p
            className="rounded-md px-2.5 py-2 text-xs"
            style={{ background: "var(--ok-bg)", color: "var(--ok-fg)" }}
            role="status"
          >
            Passwort gespeichert. Du wirst weitergeleitet…
          </p>
        ) : (
          <>
            <p className="muted mb-4 text-xs leading-relaxed">
              {email ? (
                <>
                  Für <strong>{email}</strong>. Mindestens {MINDESTLAENGE} Zeichen.
                </>
              ) : (
                <>
                  Mindestens {MINDESTLAENGE} Zeichen. Nimm etwas, das du nirgends
                  sonst benutzt.
                </>
              )}
            </p>
            <form onSubmit={speichern}>
              <label className="mb-1 block text-xs font-medium" htmlFor="eins">
                Neues Passwort
              </label>
              <input
                id="eins"
                className="field mb-3"
                type="password"
                autoComplete="new-password"
                required
                autoFocus
                value={eins}
                onChange={(e) => setEins(e.target.value)}
              />

              <label className="mb-1 block text-xs font-medium" htmlFor="zwei">
                Noch einmal
              </label>
              <input
                id="zwei"
                className="field mb-3"
                type="password"
                autoComplete="new-password"
                required
                value={zwei}
                onChange={(e) => setZwei(e.target.value)}
              />

              {fehler ? (
                <p
                  className="mb-3 rounded-md px-2.5 py-2 text-xs leading-relaxed"
                  style={{ background: "var(--err-bg)", color: "var(--err-fg)" }}
                  role="alert"
                >
                  {fehler}
                </p>
              ) : null}

              <button className="btn btn-primary w-full" type="submit" disabled={laeuft}>
                {laeuft ? "Speichere…" : "Passwort speichern"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
