/**
 * Passwort setzen - nach einer Einladung oder nach "Passwort vergessen".
 *
 * Die Seite ist nur sinnvoll, wenn zuvor ein Mail-Link ueber
 * /auth/bestaetigen eine Sitzung erzeugt hat. Ohne Sitzung sagt sie das
 * und schickt zur Anmeldung.
 */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

const MINDESTLAENGE = 10;

export default function PasswortSetzenSeite() {
  const router = useRouter();
  const [pruefe, setPruefe] = useState(true);
  const [angemeldet, setAngemeldet] = useState(false);
  const [email, setEmail] = useState("");
  const [eins, setEins] = useState("");
  const [zwei, setZwei] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState("");
  const [fertig, setFertig] = useState(false);

  useEffect(() => {
    const supabase = supabaseBrowser();
    let aufgeraeumt = false;

    // Kommt die Sitzung im Anker der Adresse (#access_token=...), liest der
    // Browser-Client sie beim Start selbst aus - das dauert aber einen
    // Moment. Ein einzelnes getUser() direkt beim Aufbau kommt zu frueh und
    // meldete den Link faelschlich als nicht verfuegbar. Deshalb: auf das
    // Ereignis hoeren UND zweimal nachfassen.
    const { data: abo } = supabase.auth.onAuthStateChange((_ereignis, sitzung) => {
      if (aufgeraeumt || !sitzung?.user) return;
      setAngemeldet(true);
      setEmail(sitzung.user.email ?? "");
      setPruefe(false);
    });

    void (async () => {
      for (const wartezeit of [0, 300, 900]) {
        if (aufgeraeumt) return;
        if (wartezeit) await new Promise((r) => setTimeout(r, wartezeit));
        const { data } = await supabase.auth.getUser();
        if (data.user) {
          setAngemeldet(true);
          setEmail(data.user.email ?? "");
          setPruefe(false);
          return;
        }
      }
      if (!aufgeraeumt) setPruefe(false);
    })();

    return () => {
      aufgeraeumt = true;
      abo.subscription.unsubscribe();
    };
  }, []);

  async function speichern(e: React.FormEvent) {
    e.preventDefault();
    setFehler("");

    if (eins.length < MINDESTLAENGE) {
      setFehler(`Bitte mindestens ${MINDESTLAENGE} Zeichen.`);
      return;
    }
    if (eins !== zwei) {
      setFehler("Die beiden Eingaben stimmen nicht ueberein.");
      return;
    }

    setLaeuft(true);
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.updateUser({ password: eins });

    if (error) {
      setLaeuft(false);
      setFehler(
        /should be different/i.test(error.message)
          ? "Das ist dein bisheriges Passwort. Bitte ein neues waehlen."
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
        ) : !angemeldet ? (
          <>
            <p className="muted mb-4 text-xs leading-relaxed">
              Dieser Link lässt sich nicht öffnen. Das hat meist einen von drei
              Gründen: er wurde schon einmal benutzt, er ist älter als eine
              Stunde, oder er wurde in einem anderen Browser geöffnet als dem,
              in dem du ihn angefordert hast. Fordere ihn einfach neu an.
            </p>
            <a className="btn btn-primary w-full text-center" href="/anmelden">
              Zur Anmeldung
            </a>
          </>
        ) : fertig ? (
          <p
            className="rounded-md px-2.5 py-2 text-xs"
            style={{ background: "#dcfce7", color: "#15803d" }}
            role="status"
          >
            Passwort gespeichert. Du wirst weitergeleitet…
          </p>
        ) : (
          <>
            <p className="muted mb-4 text-xs leading-relaxed">
              Fuer <strong>{email}</strong>. Mindestens {MINDESTLAENGE} Zeichen.
              Nimm etwas, das du nirgends sonst benutzt.
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
                  className="mb-3 rounded-md px-2.5 py-2 text-xs"
                  style={{ background: "#fee2e2", color: "#b91c1c" }}
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
