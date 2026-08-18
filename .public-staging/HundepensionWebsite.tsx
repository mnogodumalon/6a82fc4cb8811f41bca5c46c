import { useEffect, useRef, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
  listPublicRecords,
  type PublicPagesConfig,
  type PublicPageConfig,
} from '@/lib/publicClient';
import { tx } from '@/i18n';

interface WebsiteFields {
  unternehmensname: string | null;
  slogan: string | null;
  beschreibung: string | null;
  leistungen: string | null;
  anzahl_plaetze: number | null;
  oeffnungszeiten: string | null;
  website_telefon: string | null;
  website_email: string | null;
  website_strasse: string | null;
  website_hausnummer: string | null;
  website_plz: string | null;
  website_ort: string | null;
  logo: string | null;
  titelbild: string | null;
  galerie_bilder: string | null;
  instagram: string | null;
  facebook: string | null;
}

interface WebsiteRecord {
  id: string;
  fields: WebsiteFields;
}

export default function HundepensionWebsite() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [site, setSite] = useState<WebsiteRecord | null>(null);

  const aboutRef = useRef<HTMLDivElement>(null);
  const leistungenRef = useRef<HTMLDivElement>(null);
  const kontaktRef = useRef<HTMLDivElement>(null);
  const galerieRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadPublicPagesConfig('hundepension').then(async (c) => {
      setCfg(c);
      const p = c?.pages['hundepension'] ?? null;
      setPage(p);
      if (c && p) {
        try {
          const ep = p.endpoints?.find((e) => e.op === 'list' && e.entity === 'website');
          if (ep) {
            const result = await listPublicRecords(c, p, { appId: ep.app_id, limit: 1 });
            const records = Object.values(result) as WebsiteRecord[];
            if (records.length > 0) setSite(records[0]);
          }
        } catch {
          // keine Website-Daten vorhanden
        }
      }
      setLoading(false);
    });
  }, []);

  if (loading || !cfg || !page) {
    return <PublicShell loading={loading} unavailable={!loading} />;
  }

  if (!site || !site.fields.unternehmensname) {
    return (
      <PublicShell unavailable />
    );
  }

  const f = site.fields;
  const name = f.unternehmensname ?? '';

  // Adresse zusammenbauen
  const hasAddress = f.website_strasse || f.website_plz || f.website_ort;
  const addressLine1 = [f.website_strasse, f.website_hausnummer].filter(Boolean).join(' ');
  const addressLine2 = [f.website_plz, f.website_ort].filter(Boolean).join(' ');

  // Leistungen als Liste (zeilenweise)
  const leistungenList = f.leistungen
    ? f.leistungen.split('\n').map((l) => l.trim()).filter(Boolean)
    : [];

  // Galerie: hier ist galerie_bilder ein einzelner File-Wert (kein Array in der API)
  // Wir zeigen das einzelne Bild wenn vorhanden
  const galerieBilder = f.galerie_bilder ? [f.galerie_bilder] : [];

  return (
    <PublicShell fullBleed>
      {/* Hero-Bereich */}
      <section className="relative min-h-[70vh] flex flex-col items-center justify-center overflow-hidden bg-stone-800">
        {f.titelbild && (
          <img
            src={f.titelbild}
            alt={name}
            className="absolute inset-0 w-full h-full object-cover opacity-50"
          />
        )}
        <div className="relative z-10 flex flex-col items-center text-center px-6 py-16 max-w-3xl mx-auto">
          {f.logo && (
            <img
              src={f.logo}
              alt={tx('Logo')}
              className="h-20 w-auto mb-6 rounded-xl shadow-lg object-contain bg-white/80 px-3 py-2"
            />
          )}
          <h1 className="text-4xl sm:text-5xl font-bold text-white drop-shadow-lg mb-4">
            {name}
          </h1>
          {f.slogan && (
            <p className="text-xl sm:text-2xl text-white/90 drop-shadow mb-8">
              {f.slogan}
            </p>
          )}
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={() => kontaktRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="bg-amber-500 hover:bg-amber-600 text-white font-semibold px-7 py-3 rounded-full shadow-md transition-colors text-base"
            >
              {tx('Jetzt anfragen')}
            </button>
            <button
              onClick={() => aboutRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="bg-white/20 hover:bg-white/30 text-white font-semibold px-7 py-3 rounded-full border border-white/40 transition-colors text-base"
            >
              {tx('Mehr erfahren')}
            </button>
          </div>
        </div>
        {/* Nav-Anker-Leiste */}
        <div className="relative z-10 w-full flex justify-center gap-6 pb-5 flex-wrap">
          {f.beschreibung && (
            <button
              onClick={() => aboutRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="text-white/70 hover:text-white text-sm underline-offset-4 hover:underline transition-colors"
            >
              {tx('Über uns')}
            </button>
          )}
          {leistungenList.length > 0 && (
            <button
              onClick={() => leistungenRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="text-white/70 hover:text-white text-sm underline-offset-4 hover:underline transition-colors"
            >
              {tx('Leistungen')}
            </button>
          )}
          {galerieBilder.length > 0 && (
            <button
              onClick={() => galerieRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="text-white/70 hover:text-white text-sm underline-offset-4 hover:underline transition-colors"
            >
              {tx('Galerie')}
            </button>
          )}
          <button
            onClick={() => kontaktRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="text-white/70 hover:text-white text-sm underline-offset-4 hover:underline transition-colors"
          >
            {tx('Kontakt')}
          </button>
        </div>
      </section>

      {/* Über uns / Beschreibung */}
      {f.beschreibung && (
        <section ref={aboutRef} className="py-16 bg-white">
          <div className="max-w-3xl mx-auto px-6">
            <h2 className="text-2xl font-bold text-stone-800 mb-6">{tx('Über uns')}</h2>
            <p className="text-stone-600 leading-relaxed whitespace-pre-line text-lg">
              {f.beschreibung}
            </p>
          </div>
        </section>
      )}

      {/* Leistungen + Kapazität */}
      {(leistungenList.length > 0 || f.anzahl_plaetze != null) && (
        <section ref={leistungenRef} className="py-16 bg-amber-50">
          <div className="max-w-5xl mx-auto px-6">
            <h2 className="text-2xl font-bold text-stone-800 mb-10">{tx('Unsere Leistungen')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
              {leistungenList.map((leistung, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 bg-white rounded-xl p-5 shadow-sm"
                >
                  <span className="text-amber-500 mt-0.5 shrink-0">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </span>
                  <span className="text-stone-700 text-base">{leistung}</span>
                </div>
              ))}
            </div>
            {f.anzahl_plaetze != null && (
              <div className="flex items-center gap-4 bg-amber-100 rounded-2xl px-8 py-5 w-fit">
                <span className="text-4xl font-bold text-amber-600">{f.anzahl_plaetze}</span>
                <span className="text-stone-700 text-lg font-medium">{tx('verfügbare Plätze für Ihren Hund')}</span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Galerie */}
      {galerieBilder.length > 0 && (
        <section ref={galerieRef} className="py-16 bg-stone-100">
          <div className="max-w-5xl mx-auto px-6">
            <h2 className="text-2xl font-bold text-stone-800 mb-8">{tx('Galerie')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {galerieBilder.map((url, idx) => (
                <div key={idx} className="overflow-hidden rounded-xl shadow aspect-[4/3] bg-stone-200">
                  <img
                    src={url}
                    alt={tx('Galeriebild')}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Öffnungszeiten + Kontakt */}
      <section ref={kontaktRef} className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-stone-800 mb-10">{tx('Kontakt & Öffnungszeiten')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {/* Kontaktdaten */}
            <div className="space-y-5">
              <h3 className="text-lg font-semibold text-stone-700">{tx('Kontaktdaten')}</h3>
              {hasAddress && (
                <div className="flex items-start gap-3">
                  <span className="text-amber-500 mt-0.5 shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                      <circle cx="12" cy="9" r="2.5" />
                    </svg>
                  </span>
                  <div className="text-stone-600">
                    {addressLine1 && <div>{addressLine1}</div>}
                    {addressLine2 && <div>{addressLine2}</div>}
                  </div>
                </div>
              )}
              {f.website_telefon && (
                <div className="flex items-center gap-3">
                  <span className="text-amber-500 shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.81 19.79 19.79 0 01.01 2.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
                    </svg>
                  </span>
                  <a
                    href={`tel:${f.website_telefon}`}
                    className="text-stone-600 hover:text-amber-600 transition-colors"
                  >
                    {f.website_telefon}
                  </a>
                </div>
              )}
              {f.website_email && (
                <div className="flex items-center gap-3">
                  <span className="text-amber-500 shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="M22 7l-10 7L2 7" />
                    </svg>
                  </span>
                  <a
                    href={`mailto:${f.website_email}`}
                    className="text-stone-600 hover:text-amber-600 transition-colors"
                  >
                    {f.website_email}
                  </a>
                </div>
              )}
              {/* Social Links */}
              {(f.instagram || f.facebook) && (
                <div className="flex items-center gap-4 pt-2">
                  {f.instagram && (
                    <a
                      href={f.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-stone-500 hover:text-pink-600 transition-colors text-sm font-medium"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="2" width="20" height="20" rx="5" />
                        <circle cx="12" cy="12" r="4" />
                        <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
                      </svg>
                      Instagram
                    </a>
                  )}
                  {f.facebook && (
                    <a
                      href={f.facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-stone-500 hover:text-blue-600 transition-colors text-sm font-medium"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
                      </svg>
                      Facebook
                    </a>
                  )}
                </div>
              )}
            </div>
            {/* Öffnungszeiten */}
            {f.oeffnungszeiten && (
              <div>
                <h3 className="text-lg font-semibold text-stone-700 mb-4">{tx('Öffnungszeiten')}</h3>
                <div className="bg-amber-50 rounded-xl p-5">
                  <p className="text-stone-600 leading-relaxed whitespace-pre-line">
                    {f.oeffnungszeiten}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* CTA-Block */}
          <div className="mt-14 bg-amber-500 rounded-2xl p-8 text-center text-white shadow-lg">
            <h3 className="text-2xl font-bold mb-3">{tx('Interesse geweckt?')}</h3>
            <p className="text-white/90 mb-6 text-base">
              {tx('Senden Sie uns eine Anfrage — wir melden uns schnellstmöglich bei Ihnen.')}
            </p>
            <a
              href="/#/public/buchungsanfrage"
              className="inline-block bg-white text-amber-600 font-bold px-8 py-3 rounded-full shadow hover:bg-amber-50 transition-colors text-base"
            >
              {tx('Jetzt anfragen')}
            </a>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
