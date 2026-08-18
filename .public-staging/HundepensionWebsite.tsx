import { useEffect, useRef, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
  listPublicRecords,
  PageUnavailableError,
  type PublicPagesConfig,
  type PublicPageConfig,
} from '@/lib/publicClient';
import { tx } from '@/i18n';

// Website record shape from the list endpoint
interface WebsiteRecord {
  record_id: string;
  fields: {
    unternehmensname?: string;
    slogan?: string;
    beschreibung?: string;
    leistungen?: string;
    anzahl_plaetze?: number | null;
    oeffnungszeiten?: string;
    website_telefon?: string;
    website_email?: string;
    website_url?: string;
    website_strasse?: string;
    website_hausnummer?: string;
    website_plz?: string;
    website_ort?: string;
    standort?: { lat: number; long: number; info?: string } | null;
    logo?: string | null;
    titelbild?: string | null;
    galerie_bilder?: string | null;
    instagram?: string;
    facebook?: string;
  };
}

const SLUG = 'hundepension';

export default function HundepensionWebsite() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [website, setWebsite] = useState<WebsiteRecord | null>(null);
  const [galleryOpen, setGalleryOpen] = useState<string | null>(null);

  const ueberRef = useRef<HTMLElement>(null);
  const leistungenRef = useRef<HTMLElement>(null);
  const galerieRef = useRef<HTMLElement>(null);
  const kontaktRef = useRef<HTMLElement>(null);

  useEffect(() => {
    loadPublicPagesConfig(SLUG)
      .then(async c => {
        if (!c) { setUnavailable(true); setLoading(false); return; }
        const p = c.pages[SLUG] ?? null;
        setCfg(c);
        setPage(p);
        if (!p) { setUnavailable(true); setLoading(false); return; }
        try {
          const ep = p.endpoints?.find(e => e.op === 'list');
          if (ep) {
            const records = await listPublicRecords(c, p, { appId: ep.app_id, limit: 1 });
            const first = records[0] as WebsiteRecord | undefined;
            setWebsite(first ?? null);
          }
        } catch {
          // Render what we have; website stays null
        }
        setLoading(false);
      })
      .catch(err => {
        if (err instanceof PageUnavailableError) setUnavailable(true);
        setLoading(false);
      });
  }, []);

  if (loading || unavailable || !cfg || !page) {
    return <PublicShell loading={loading} unavailable={!loading && unavailable} />;
  }

  const w = website?.fields ?? null;
  const unternehmensname = w?.unternehmensname ?? tx('Hundepension');
  const slogan = w?.slogan ?? '';
  const leistungenText = w?.leistungen ?? '';
  const leistungsListe = leistungenText
    .split('\n')
    .map(s => s.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);

  const scrollTo = (ref: React.RefObject<HTMLElement | null>) =>
    ref.current?.scrollIntoView({ behavior: 'smooth' });

  const navigateToAnfrage = () => {
    window.location.hash = '#/public/buchungsanfrage';
  };

  return (
    <PublicShell fullBleed>
      {/* ── NAV ────────────────────────────────────────── */}
      <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-stone-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            {w?.logo && (
              <img
                src={w.logo}
                alt={unternehmensname}
                className="h-9 w-auto object-contain rounded"
              />
            )}
            <span className="font-bold text-lg text-stone-800 truncate">{unternehmensname}</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-stone-600">
            <button
              className="hover:text-amber-700 transition-colors"
              onClick={() => scrollTo(ueberRef)}
            >
              {tx('Über uns')}
            </button>
            <button
              className="hover:text-amber-700 transition-colors"
              onClick={() => scrollTo(leistungenRef)}
            >
              {tx('Leistungen')}
            </button>
            <button
              className="hover:text-amber-700 transition-colors"
              onClick={() => scrollTo(galerieRef)}
            >
              {tx('Galerie')}
            </button>
            <button
              className="hover:text-amber-700 transition-colors"
              onClick={() => scrollTo(kontaktRef)}
            >
              {tx('Kontakt')}
            </button>
          </div>
          <button
            onClick={navigateToAnfrage}
            className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            {tx('Anfrage stellen')}
          </button>
        </div>
      </nav>

      {/* ── HERO ───────────────────────────────────────── */}
      <section className="relative min-h-[70vh] flex items-center justify-center text-white overflow-hidden">
        {w?.titelbild ? (
          <img
            src={w.titelbild}
            alt={unternehmensname}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-amber-800 to-stone-700" />
        )}
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 text-center max-w-3xl mx-auto px-4 py-20">
          <h1 className="text-4xl md:text-6xl font-extrabold drop-shadow-lg mb-4 leading-tight">
            {unternehmensname}
          </h1>
          {slogan && (
            <p className="text-xl md:text-2xl font-light text-amber-100 mb-8 drop-shadow">
              {slogan}
            </p>
          )}
          <button
            onClick={navigateToAnfrage}
            className="bg-amber-500 hover:bg-amber-400 text-white font-bold text-lg px-8 py-4 rounded-xl shadow-xl transition-colors"
          >
            {tx('Jetzt Buchungsanfrage stellen')}
          </button>
        </div>
      </section>

      {/* ── ÜBER UNS ───────────────────────────────────── */}
      <section ref={ueberRef} className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-amber-600 font-semibold text-sm uppercase tracking-widest">
              {tx('Über uns')}
            </span>
            <h2 className="mt-2 text-3xl font-bold text-stone-800 mb-4">
              {tx('Ihr Zuhause auf Zeit')}
            </h2>
            <p className="text-stone-600 leading-relaxed whitespace-pre-line">
              {w?.beschreibung ?? tx('Wir kümmern uns liebevoll um Ihren Hund.')}
            </p>
            {w?.anzahl_plaetze != null && (
              <div className="mt-6 inline-flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3">
                <span className="text-3xl font-extrabold text-amber-600">{w.anzahl_plaetze}</span>
                <span className="text-stone-700 font-medium">{tx('Plätze verfügbar')}</span>
              </div>
            )}
          </div>
          {w?.logo ? (
            <div className="flex justify-center">
              <img
                src={w.logo}
                alt={unternehmensname}
                className="max-h-64 w-auto object-contain rounded-2xl shadow-lg"
              />
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="w-48 h-48 rounded-full bg-amber-100 flex items-center justify-center">
                <span className="text-6xl">🐾</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── LEISTUNGEN ─────────────────────────────────── */}
      {leistungsListe.length > 0 && (
        <section ref={leistungenRef} className="py-20 bg-stone-50">
          <div className="max-w-5xl mx-auto px-4">
            <div className="text-center mb-12">
              <span className="text-amber-600 font-semibold text-sm uppercase tracking-widest">
                {tx('Was wir bieten')}
              </span>
              <h2 className="mt-2 text-3xl font-bold text-stone-800">{tx('Unsere Leistungen')}</h2>
            </div>
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {leistungsListe.map((item, i) => (
                <li
                  key={i}
                  className="bg-white border border-stone-200 rounded-2xl p-6 flex items-start gap-4 shadow-sm"
                >
                  <span className="text-amber-500 mt-0.5 shrink-0 text-xl">✓</span>
                  <span className="text-stone-700 font-medium leading-snug">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ── GALERIE ────────────────────────────────────── */}
      {w?.galerie_bilder && (
        <section ref={galerieRef} className="py-20 bg-white">
          <div className="max-w-5xl mx-auto px-4">
            <div className="text-center mb-12">
              <span className="text-amber-600 font-semibold text-sm uppercase tracking-widest">
                {tx('Einblicke')}
              </span>
              <h2 className="mt-2 text-3xl font-bold text-stone-800">{tx('Galerie')}</h2>
            </div>
            {/* galerie_bilder is a single file field — show as one featured image */}
            <div
              className="cursor-zoom-in rounded-2xl overflow-hidden shadow-lg max-w-2xl mx-auto"
              onClick={() => setGalleryOpen(w.galerie_bilder!)}
            >
              <img
                src={w.galerie_bilder}
                alt={tx('Galerie')}
                className="w-full h-80 object-cover hover:scale-105 transition-transform duration-500"
              />
            </div>
          </div>
        </section>
      )}

      {/* Lightbox */}
      {galleryOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setGalleryOpen(null)}
        >
          <img
            src={galleryOpen}
            alt={tx('Galerie')}
            className="max-w-full max-h-full object-contain rounded-xl"
            onClick={e => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 text-white text-3xl font-bold leading-none hover:text-amber-300"
            onClick={() => setGalleryOpen(null)}
            aria-label={tx('Schließen')}
          >
            ×
          </button>
        </div>
      )}

      {/* ── ÖFFNUNGSZEITEN + KONTAKT ───────────────────── */}
      <section ref={kontaktRef} className="py-20 bg-stone-50">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-12">
            <span className="text-amber-600 font-semibold text-sm uppercase tracking-widest">
              {tx('Wir sind für Sie da')}
            </span>
            <h2 className="mt-2 text-3xl font-bold text-stone-800">{tx('Kontakt & Öffnungszeiten')}</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {/* Öffnungszeiten */}
            {w?.oeffnungszeiten && (
              <div className="bg-white rounded-2xl border border-stone-200 p-8 shadow-sm">
                <h3 className="font-bold text-stone-800 text-lg mb-4 flex items-center gap-2">
                  <span className="text-amber-500">🕐</span> {tx('Öffnungszeiten')}
                </h3>
                <p className="text-stone-600 leading-relaxed whitespace-pre-line">
                  {w.oeffnungszeiten}
                </p>
              </div>
            )}

            {/* Kontaktdaten */}
            <div className="bg-white rounded-2xl border border-stone-200 p-8 shadow-sm space-y-4">
              <h3 className="font-bold text-stone-800 text-lg mb-4 flex items-center gap-2">
                <span className="text-amber-500">📍</span> {tx('So erreichen Sie uns')}
              </h3>
              {(w?.website_strasse || w?.website_ort) && (
                <div className="flex items-start gap-3 text-stone-700">
                  <span className="shrink-0 text-amber-500 mt-0.5">📬</span>
                  <address className="not-italic leading-snug">
                    {[w?.website_strasse, w?.website_hausnummer].filter(Boolean).join(' ')}
                    {(w?.website_strasse || w?.website_hausnummer) && <br />}
                    {[w?.website_plz, w?.website_ort].filter(Boolean).join(' ')}
                  </address>
                </div>
              )}
              {w?.website_telefon && (
                <div className="flex items-center gap-3 text-stone-700">
                  <span className="text-amber-500 shrink-0">📞</span>
                  <a
                    href={`tel:${w.website_telefon}`}
                    className="hover:text-amber-700 transition-colors"
                  >
                    {w.website_telefon}
                  </a>
                </div>
              )}
              {w?.website_email && (
                <div className="flex items-center gap-3 text-stone-700">
                  <span className="text-amber-500 shrink-0">✉️</span>
                  <a
                    href={`mailto:${w.website_email}`}
                    className="hover:text-amber-700 transition-colors break-all"
                  >
                    {w.website_email}
                  </a>
                </div>
              )}
              {w?.website_url && (
                <div className="flex items-center gap-3 text-stone-700">
                  <span className="text-amber-500 shrink-0">🌐</span>
                  <a
                    href={w.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-amber-700 transition-colors break-all"
                  >
                    {w.website_url}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Social-Links */}
          {(w?.instagram || w?.facebook) && (
            <div className="mt-8 flex flex-wrap gap-4 justify-center">
              {w.instagram && (
                <a
                  href={w.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-gradient-to-br from-purple-500 to-pink-500 text-white font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
                >
                  <span>📸</span> {tx('Auf Instagram folgen')}
                </a>
              )}
              {w.facebook && (
                <a
                  href={w.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-blue-600 text-white font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
                >
                  <span>👍</span> {tx('Auf Facebook folgen')}
                </a>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── CTA BANNER ─────────────────────────────────── */}
      <section className="py-20 bg-amber-600 text-white text-center">
        <div className="max-w-2xl mx-auto px-4">
          <h2 className="text-3xl font-bold mb-4">{tx('Bereit für den nächsten Urlaub?')}</h2>
          <p className="text-amber-100 mb-8 text-lg">
            {tx('Stellen Sie jetzt Ihre Buchungsanfrage — wir melden uns schnellstmöglich.')}
          </p>
          <button
            onClick={navigateToAnfrage}
            className="bg-white text-amber-700 hover:bg-amber-50 font-bold text-lg px-10 py-4 rounded-xl shadow-lg transition-colors"
          >
            {tx('Buchungsanfrage stellen')}
          </button>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────── */}
      <footer className="bg-stone-800 text-stone-400 text-sm py-8 text-center">
        <div className="max-w-5xl mx-auto px-4">
          <p>© {new Date().getFullYear()} {unternehmensname}</p>
          {w?.website_email && (
            <p className="mt-1">
              <a href={`mailto:${w.website_email}`} className="hover:text-stone-200 transition-colors">
                {w.website_email}
              </a>
            </p>
          )}
        </div>
      </footer>
    </PublicShell>
  );
}
