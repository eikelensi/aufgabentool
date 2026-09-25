"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { NewTaskDialog } from "./dialogs";
import Meldungen from "./Meldungen";
import Tagesgruss from "./Tagesgruss";
import { ROLLE_LABEL, darfSehen, type AppRole, type Bereich, type Bereichsrechte } from "@/lib/types";

export interface ShellProfil {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
}

/**
 * Das Hauptmenue - in drei Klassen, nicht in einer Reihe.
 *
 * Wer alles sehen darf, sah bisher auch alles: neun Punkte, jeder mit
 * einem Symbol, dazu Logo, Knoepfe und Name. Das war keine Navigation
 * mehr, sondern eine Wand. Ein Menuepunkt, den man einmal im Monat
 * braucht, verdient keinen Platz neben einem, den man stuendlich
 * braucht.
 *
 * OBEN steht das Tagesgeschaeft. Unter "Mehr" das, was man gezielt
 * aufsucht. Die Verwaltung sitzt rechts als Zahnrad bei den anderen
 * Werkzeugen - sie ist kein Ort, an dem man arbeitet.
 *
 * Ohne Symbole: neun verschiedene Emojis machen eine Leiste bunt,
 * nicht verstaendlich. Die Woerter tun die Arbeit.
 */
interface Menuepunkt {
  href: string;
  label: string;
  bereich: Bereich;
}

const HAUPT: Menuepunkt[] = [
  { href: "/dashboard", label: "Dashboard", bereich: "dashboard" },
  { href: "/team", label: "Team", bereich: "uebersicht" },
  { href: "/mein-tag", label: "Mein Tag", bereich: "mein_tag" },
  { href: "/pool", label: "Aufgabenpool", bereich: "pool" },
  { href: "/asana", label: "Asana", bereich: "asana" },
];

const WEITERE: Menuepunkt[] = [
  { href: "/verteilt", label: "Verteilt", bereich: "verteilt" },
  { href: "/pinnwand", label: "Pinnwand", bereich: "pinnwand" },
  { href: "/archiv", label: "Archiv", bereich: "archiv" },
];

const VERWALTUNG: Menuepunkt = {
  href: "/admin",
  label: "Verwaltung",
  bereich: "verwaltung",
};

function initialen(name: string): string {
  const teile = name.trim().split(/\s+/).filter(Boolean);
  if (!teile.length) return "?";
  if (teile.length === 1) return teile[0].slice(0, 2).toUpperCase();
  return (teile[0][0] + teile[teile.length - 1][0]).toUpperCase();
}

export default function Shell({
  children,
  profil,
  rechte,
}: {
  children: React.ReactNode;
  profil: ShellProfil;
  /** Welche Rolle welchen Bereich sieht - kommt vom Server. */
  rechte: Bereichsrechte;
}) {
  const { neuLaden, bereit } = useStore();
  const pathname = usePathname();
  const [dark, setDark] = useState(false);
  const [newTask, setNewTask] = useState(false);
  const [menuOffen, setMenuOffen] = useState(false);
  const [mehrOffen, setMehrOffen] = useState(false);

  const isAdmin = profil.role === "gf" || profil.role === "superadmin";

  // Gesetzt hat den Modus schon das Skript im Kopf, bevor das erste Bild
  // stand. Hier wird er nur noch abgelesen, damit der Knopf das richtige
  // Zeichen zeigt - nicht noch einmal entschieden.
  //
  // Beobachtet wird er ausserdem: die Farbeinstellung im Adminbereich
  // schaltet die Seite um, damit man sieht, was man einstellt. Ohne das
  // zeigte der Knopf danach die Sonne, waehrend es dunkel ist, und der
  // naechste Druck ginge in die falsche Richtung.
  // Ein Klappmenue, das nach dem Klick offen bleibt, verdeckt genau
  // die Seite, zu der man gerade wollte.
  useEffect(() => {
    setMehrOffen(false);
    setMenuOffen(false);
  }, [pathname]);

  // Und eines, das nur der eigene Knopf schliesst, faengt Klicks ab,
  // die woanders hinsollten.
  useEffect(() => {
    if (!mehrOffen && !menuOffen) return;
    const zu = () => {
      setMehrOffen(false);
      setMenuOffen(false);
    };
    window.addEventListener("click", zu);
    return () => window.removeEventListener("click", zu);
  }, [mehrOffen, menuOffen]);

  useEffect(() => {
    const wurzel = document.documentElement;
    const lies = () => setDark(wurzel.dataset.theme === "dark");
    lies();
    const beobachter = new MutationObserver(lies);
    beobachter.observe(wurzel, { attributes: true, attributeFilter: ["data-theme"] });
    return () => beobachter.disconnect();
  }, []);

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try {
      window.localStorage.setItem("aufgabentool-theme", next ? "dark" : "light");
    } catch {
      /* nicht wichtig genug, um darueber zu stolpern */
    }
  };

  // Was jemand sieht, steht in der Verwaltung und nicht im Code - bis
  // auf den Superadmin, der immer alles sieht.
  const sichtbar = (p: Menuepunkt) => darfSehen(profil.role, p.bereich, rechte);
  const haupt = HAUPT.filter(sichtbar);
  const weitere = WEITERE.filter(sichtbar);
  const darfVerwaltung = sichtbar(VERWALTUNG);
  const inWeiteren = weitere.some((p) => pathname.startsWith(p.href));

  return (
    <div className="min-h-screen">
      <header
        className="line sticky top-0 z-40 border-b"
        style={{ background: "var(--panel)" }}
      >
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-3 px-4 py-2.5">
          <Link href="/" className="flex items-center gap-2.5" title="Aufgabentool">
            <Image
              src="/logo.png"
              alt="4wändekanzlei"
              width={736}
              height={120}
              priority
              className="h-6 w-auto"
            />
            <span className="line muted border-l pl-2.5 text-[13px] font-medium">
              Aufgabentool
            </span>
          </Link>

          {/* Das Tagesgeschaeft, und nur das. "/" ist nur die Weiche
              und traegt keinen eigenen Punkt: wer dort landet, wird
              eine Umleitung spaeter auf seiner Startseite stehen. */}
          <nav className="flex flex-wrap items-center gap-1">
            {haupt.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="btn"
                aria-current={pathname.startsWith(n.href) ? "page" : undefined}
                style={
                  pathname.startsWith(n.href)
                    ? {
                        background: "var(--color-ci-400)",
                        borderColor: "var(--color-ci-400)",
                        color: "var(--auf-akzent)",
                        fontWeight: 600,
                      }
                    : { background: "transparent", borderColor: "transparent" }
                }
              >
                {n.label}
              </Link>
            ))}

            {weitere.length ? (
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="btn"
                  aria-haspopup="menu"
                  aria-expanded={mehrOffen}
                  onClick={() => setMehrOffen((o) => !o)}
                  style={
                    inWeiteren
                      ? {
                          background: "var(--color-ci-400)",
                          borderColor: "var(--color-ci-400)",
                          color: "var(--auf-akzent)",
                          fontWeight: 600,
                        }
                      : { background: "transparent", borderColor: "transparent" }
                  }
                >
                  Mehr ▾
                </button>

                {mehrOffen ? (
                  <div className="panel absolute left-0 z-50 mt-1 w-[190px] p-1.5" role="menu">
                    {weitere.map((n) => (
                      <Link
                        key={n.href}
                        href={n.href}
                        role="menuitem"
                        className="block rounded px-2 py-1.5 text-[13px] hover:underline"
                        style={
                          pathname.startsWith(n.href)
                            ? { color: "var(--color-ci-500)", fontWeight: 600 }
                            : undefined
                        }
                      >
                        {n.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button className="btn btn-primary" onClick={() => setNewTask(true)}>
              + Aufgabe
            </button>
            <button className="btn btn-ghost" onClick={toggleTheme} title="Design umschalten">
              {dark ? "☀️" : "🌙"}
            </button>

            {/* Die Verwaltung ist kein Ort, an dem man arbeitet -
                sie steht bei den Werkzeugen und nicht im Tagesmenue.
                Auffaellig wird sie nur, wenn man darin ist. */}
            {darfVerwaltung ? (
              <Link
                href="/admin"
                className="btn btn-ghost"
                title="Verwaltung"
                aria-label="Verwaltung"
                aria-current={pathname.startsWith("/admin") ? "page" : undefined}
                style={
                  pathname.startsWith("/admin")
                    ? {
                        background: "var(--color-ci-400)",
                        borderColor: "var(--color-ci-400)",
                        color: "var(--auf-akzent)",
                      }
                    : undefined
                }
              >
                ⚙️
              </Link>
            ) : null}

            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                className="flex items-center gap-1.5 rounded-md px-1 py-0.5"
                onClick={() => setMenuOffen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={menuOffen}
                title={profil.email}
              >
                <span
                  className="flex h-[26px] w-[26px] items-center justify-center rounded-full text-[10px] font-bold"
                  style={{ background: "var(--color-ci-400)", color: "var(--auf-akzent)" }}
                >
                  {initialen(profil.fullName)}
                </span>
                <span className="muted hidden text-[12px] sm:inline">
                  {profil.fullName}
                </span>
              </button>

              {menuOffen ? (
                <div
                  className="panel absolute right-0 z-50 mt-1 w-[230px] p-2 text-[12px]"
                  role="menu"
                >
                  <div className="line mb-2 border-b pb-2">
                    <div className="font-medium">{profil.fullName}</div>
                    <div className="muted text-[11px]">{profil.email}</div>
                    <div className="muted text-[11px]">{ROLLE_LABEL[profil.role]}</div>
                  </div>
                  <Link
                    href="/passwort-setzen"
                    className="block rounded px-1.5 py-1 hover:underline"
                    onClick={() => setMenuOffen(false)}
                  >
                    Passwort ändern
                  </Link>
                  <form action="/auth/abmelden" method="post">
                    <button
                      className="mt-0.5 w-full rounded px-1.5 py-1 text-left hover:underline"
                      type="submit"
                    >
                      Abmelden
                    </button>
                  </form>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div
          className="line border-t px-4 py-1 text-[11px]"
          style={{ background: "var(--panel-2)", color: "var(--muted)" }}
        >
          <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-2">
            <strong style={{ color: "var(--color-ci-500)" }}>Live</strong>
            <span>
              {bereit
                ? "Echte Daten. Aufgaben kommen aus onOffice, sobald Bearbeiter oder Verantwortung ein Nutzer ist."
                : "Lade Daten…"}
            </span>
            <button
              className="btn btn-ghost ml-auto"
              style={{ fontSize: 11 }}
              onClick={() => void neuLaden()}
            >
              Neu laden
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-4 py-5">{children}</main>

      {newTask ? <NewTaskDialog onClose={() => setNewTask(false)} /> : null}

      {/* Steht ueber allem und ist trotzdem still, solange nichts
          anliegt. */}
      <Meldungen />

      {/* Einmal am Tag, beim ersten Aufmachen. */}
      <Tagesgruss />
    </div>
  );
}
