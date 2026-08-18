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
import {
  IconPhone,
  IconMail,
  IconMapPin,
  IconBrandInstagram,
  IconBrandFacebook,
  IconClock,
  IconPaw,
  IconArrowRight,
  IconStar,
} from '@tabler/icons-react';

interface WebsiteRecord {
  record_id: string;
  fields: {
    unternehmensname?: string;
    slogan?: string;
    beschreibung?: string;
    leistungen?: string;
    anzahl_plaetze?: number;
    oeffnungszeiten?: string;
    website_telefon?: string;
    website_email?: string;
    website_url?: string;
    website_strasse?: string;
    website_hausnummer?: string;
    website_plz?: string;
    website_ort?: string;
    logo?: string;
    titelbild?: string;
    galerie_bilder?: string;
    instagram?: string;
    facebook?: string;
  };
}

export default function Startseite() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [website, setWebsite] = useState<WebsiteRecord | null>(null);

  const leistungenRef = useRef<HTMLElement>(null);
  const galerieRef = useRef<HTMLElement>(null);
  const kontaktRef = useRef<HTMLElement>(null);

  useEffect(() => {
    loadPublicPagesConfig('startseite')
      .then(async (c) => {
        setCfg(c);
        const p = c?.pages['startseite'] ?? null;
        setPage(p);
        if (c && p) {
          const ep = p.endpoints?.find((e) => e.op === 'list');
          if (ep) {
            const result = await listPublicRecords(c, p, {
              appId: ep.app_id,
              limit: 1,
            });
            const records = Object.values(result ?? {}) as WebsiteRecord[];
            if (records.length > 0) setWebsite(records[0]);
          }
        }
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof PageUnavailableError) setUnavailable(true);
        setLoading(false);
      });
  }, []);

  if (loading || unavailable || !cfg || !page) {
    return <PublicShell loading={loading} unavailable={!loading && (unavailable || !cfg || !page)} />;
  }

  const w = website?.fields;

  const name = w?.unternehmensname ?? tx('Hundepension');
  const slogan = w?.slogan ?? tx('Ihr Zuhause auf Zeit für Ihren Vierbeiner');
  const beschreibung =
    w?.beschreibung ??
    tx(
      'Willkommen in unserer liebevoll geführten Hundepension. Hier ist Ihr Hund in den besten Händen — mit viel Liebe, Auslauf und persönlicher Betreuung.',
    );

  // Parse leistungen: one service per line
  const leistungenLines = (w?.leistungen ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  // Default services if none configured
  const defaultLeistungen = [
    tx('Übernachtungsbetreuung'),
    tx('Tagesbetreuung'),
    tx('Einzel- und Gruppenspaziergang'),
    tx('Liebesvoll eingerichtete Schlafplätze'),
    tx('Regelmäßige Updates an Besitzer'),
    tx('Notfallbetreuung'),
  ];

  const services = leistungenLines.length > 0 ? leistungenLines : defaultLeistungen;

  // Gallery images: the field stores a single URL (file type in LA)
  const galleryImages: string[] = w?.galerie_bilder
    ? [w.galerie_bilder]
    : [];

  const adresse = [
    w?.website_strasse && w?.website_hausnummer
      ? `${w.website_strasse} ${w.website_hausnummer}`
      : w?.website_strasse ?? null,
    w?.website_plz && w?.website_ort
      ? `${w.website_plz} ${w.website_ort}`
      : w?.website_ort ?? null,
  ]
    .filter(Boolean)
    .join(', ');

  const oeffnungszeiten = (w?.oeffnungszeiten ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  return (
    <PublicShell fullBleed>
      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section
        className="relative min-h-[520px] md:min-h-[640px] flex items-center justify-center overflow-hidden"
        style={
          w?.titelbild
            ? {
                backgroundImage: `url(${w.titelbild})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : {}
        }
      >
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/55" />

        {/* Content */}
        <div className="relative z-10 max-w-3xl mx-auto px-6 text-center text-white">
          {w?.logo && (
            <img
              src={w.logo}
              alt={name}
              className="h-20 w-auto mx-auto mb-6 object-contain drop-shadow-lg"
            />
          )}
          {!w?.logo && (
            <div className="flex justify-center mb-6">
              <IconPaw size={56} className="text-white/90" />
            </div>
          )}

          <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-4 drop-shadow">
            {name}
          </h1>
          <p className="text-xl md:text-2xl text-white/90 mb-8 leading-snug">
            {slogan}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="/#/public/buchungsanfrage"
              className="inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold px-7 py-3 rounded-xl transition-colors text-base"
            >
              {tx('Buchungsanfrage stellen')}
              <IconArrowRight size={18} className="shrink-0" />
            </a>
            <button
              type="button"
              onClick={() => kontaktRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="inline-flex items-center justify-center gap-2 bg-white/15 hover:bg-white/25 text-white font-semibold px-7 py-3 rounded-xl transition-colors text-base border border-white/30"
            >
              {tx('Kontakt & Anfahrt')}
            </button>
          </div>

          {w?.anzahl_plaetze != null && (
            <p className="mt-6 text-white/75 text-sm flex items-center justify-center gap-1">
              <IconStar size={14} className="shrink-0" />
              {tx`${w.anzahl_plaetze} liebevoll eingerichtete Plätze`}
            </p>
          )}
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/50">
          <button
            type="button"
            onClick={() => leistungenRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="flex flex-col items-center gap-1 hover:text-white/80 transition-colors"
            aria-label={tx('Nach unten scrollen')}
          >
            <span className="text-xs">{tx('Mehr erfahren')}</span>
            <svg width="20" height="10" viewBox="0 0 20 10" fill="none">
              <path d="M2 2 L10 8 L18 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </section>

      {/* ── ÜBER UNS ─────────────────────────────────────────────── */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
            {tx('Herzlich willkommen')}
          </h2>
          <p className="text-gray-600 text-lg leading-relaxed max-w-2xl mx-auto">
            {beschreibung}
          </p>
        </div>
      </section>

      {/* ── LEISTUNGEN ───────────────────────────────────────────── */}
      <section
        ref={leistungenRef as React.RefObject<HTMLDivElement>}
        className="py-16 bg-amber-50"
      >
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
              {tx('Unsere Leistungen')}
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              {tx('Alles, was Ihr Hund für einen entspannten Aufenthalt braucht.')}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((s, i) => (
              <div
                key={i}
                className="bg-white rounded-xl px-5 py-4 flex items-start gap-3 shadow-sm"
              >
                <IconPaw
                  size={20}
                  className="text-amber-500 shrink-0 mt-0.5"
                />
                <span className="text-gray-700 leading-snug">{s}</span>
              </div>
            ))}
          </div>

          <div className="mt-10 text-center">
            <a
              href="/#/public/buchungsanfrage"
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold px-7 py-3 rounded-xl transition-colors"
            >
              {tx('Jetzt anfragen')}
              <IconArrowRight size={18} className="shrink-0" />
            </a>
          </div>
        </div>
      </section>

      {/* ── GALERIE ──────────────────────────────────────────────── */}
      {galleryImages.length > 0 && (
        <section ref={galerieRef as React.RefObject<HTMLDivElement>} className="py-16 bg-white">
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
                {tx('Einblicke in unsere Pension')}
              </h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {galleryImages.map((src, i) => (
                <div
                  key={i}
                  className="aspect-square overflow-hidden rounded-xl bg-gray-100"
                >
                  <img
                    src={src}
                    alt={tx('Galeriebilder der Hundepension')}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Galerie-Platzhalter wenn keine Bilder */}
      {galleryImages.length === 0 && (
        <section className="py-16 bg-white">
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
                {tx('Einblicke in unsere Pension')}
              </h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="aspect-square rounded-xl bg-amber-50 flex items-center justify-center"
                >
                  <IconPaw size={36} className="text-amber-200" />
                </div>
              ))}
            </div>
            <p className="text-center text-gray-400 text-sm mt-4">
              {tx('Bilder werden bald hinzugefügt.')}
            </p>
          </div>
        </section>
      )}

      {/* ── KONTAKT & ÖFFNUNGSZEITEN ─────────────────────────────── */}
      <section
        ref={kontaktRef as React.RefObject<HTMLDivElement>}
        className="py-16 bg-gray-900 text-white"
      >
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold mb-3">
              {tx('Kontakt & Öffnungszeiten')}
            </h2>
            <p className="text-gray-400">
              {tx('Wir freuen uns auf Ihre Nachricht.')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {/* Kontaktdaten */}
            <div className="space-y-5">
              <h3 className="text-lg font-semibold text-amber-400">
                {tx('Erreichbarkeit')}
              </h3>

              {(w?.website_telefon) && (
                <a
                  href={`tel:${w.website_telefon}`}
                  className="flex items-center gap-3 text-gray-300 hover:text-white transition-colors"
                >
                  <IconPhone size={20} className="text-amber-400 shrink-0" />
                  <span>{w.website_telefon}</span>
                </a>
              )}
              {!w?.website_telefon && (
                <div className="flex items-center gap-3 text-gray-500">
                  <IconPhone size={20} className="text-amber-400/40 shrink-0" />
                  <span>{tx('Telefonnummer wird noch ergänzt')}</span>
                </div>
              )}

              {w?.website_email && (
                <a
                  href={`mailto:${w.website_email}`}
                  className="flex items-center gap-3 text-gray-300 hover:text-white transition-colors"
                >
                  <IconMail size={20} className="text-amber-400 shrink-0" />
                  <span>{w.website_email}</span>
                </a>
              )}

              {adresse && (
                <div className="flex items-start gap-3 text-gray-300">
                  <IconMapPin size={20} className="text-amber-400 shrink-0 mt-0.5" />
                  <span>{adresse}</span>
                </div>
              )}

              {/* Social Links */}
              {(w?.instagram || w?.facebook) && (
                <div className="flex gap-4 pt-2">
                  {w?.instagram && (
                    <a
                      href={w.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-gray-400 hover:text-amber-400 transition-colors"
                    >
                      <IconBrandInstagram size={22} className="shrink-0" />
                      <span className="text-sm">Instagram</span>
                    </a>
                  )}
                  {w?.facebook && (
                    <a
                      href={w.facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-gray-400 hover:text-amber-400 transition-colors"
                    >
                      <IconBrandFacebook size={22} className="shrink-0" />
                      <span className="text-sm">Facebook</span>
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Öffnungszeiten */}
            <div className="space-y-5">
              <h3 className="text-lg font-semibold text-amber-400 flex items-center gap-2">
                <IconClock size={20} className="shrink-0" />
                {tx('Öffnungszeiten')}
              </h3>

              {oeffnungszeiten.length > 0 ? (
                <ul className="space-y-2">
                  {oeffnungszeiten.map((zeile, i) => (
                    <li key={i} className="text-gray-300">
                      {zeile}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 italic">
                  {tx('Öffnungszeiten werden noch ergänzt.')}
                </p>
              )}

              {/* CTA */}
              <div className="pt-4">
                <a
                  href="/#/public/buchungsanfrage"
                  className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
                >
                  {tx('Buchungsanfrage stellen')}
                  <IconArrowRight size={18} className="shrink-0" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────── */}
      <footer className="bg-gray-950 text-gray-500 text-center py-6 text-sm">
        <p>
          &copy; {new Date().getFullYear()} {name}
          {adresse && <> &middot; {adresse}</>}
        </p>
      </footer>
    </PublicShell>
  );
}
