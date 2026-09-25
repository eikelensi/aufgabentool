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

const nextConfig = {
  eslint: { ignoreDuringBuilds: true },

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
