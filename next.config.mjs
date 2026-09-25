/**
 * @type {import('next').NextConfig}
 *
 * Die Kopfzeilen hier haben einen einzigen Zweck: das Tool laesst sich
 * in onOffice als Dashboard-Kachel einhaengen. Damit ein Browser das
 * zulaesst, muss die Seite sagen, WER sie einrahmen darf - sonst
 * verweigert er es (oder tut es, was noch schlechter waere).
 *
 * "frame-ancestors" ist bewusst eng: wir selbst und onOffice. Keine
 * Sternchen-Erlaubnis; eine Seite, die eine fremde in den Rahmen
 * nimmt, kann Klicks abfangen.
 */
const RAHMEN = [
  "'self'",
  "https://*.onoffice.de",
  "https://*.onoffice.com",
].join(" ");

/**
 * Die alte Teamboard-Adresse.
 *
 * Das Teamboard ist jetzt die Pinnwand im Aufgabentool. Wer die alte
 * Adresse im Lesezeichen hat oder sie jemandem weitergegeben hat, soll
 * dort landen, wo die Zettel wirklich haengen - und nicht auf der
 * Startseite, wo er erst suchen muesste.
 *
 * Bewusst KEINE dauerhafte Weiterleitung (308): die merkt sich der
 * Browser und laesst sich spaeter nur schwer wieder loswerden. Solange
 * niemand weiss, ob die Adresse einmal etwas anderes tun soll, ist
 * eine vorlaeufige ehrlicher.
 */
const ALTE_TEAMBOARD_ADRESSE = "teamboard.4-wk.de";
const PINNWAND = "https://task.4waendekanzlei.de/pinnwand";

const nextConfig = {
  eslint: { ignoreDuringBuilds: true },

  async redirects() {
    return [
      {
        source: "/:pfad*",
        has: [{ type: "host", value: ALTE_TEAMBOARD_ADRESSE }],
        destination: PINNWAND,
        permanent: false,
      },
    ];
  },

  async headers() {
    return [
      {
        source: "/:pfad*",
        headers: [
          // Bewusst NUR frame-ancestors und kein X-Frame-Options:
          // das kennt nur "gar nicht" oder "genau eine Adresse" und
          // wuerde diese Erlaubnis in manchen Browsern wieder
          // aufheben.
          { key: "Content-Security-Policy", value: `frame-ancestors ${RAHMEN};` },
        ],
      },
    ];
  },
};

export default nextConfig;
