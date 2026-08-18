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
  IconPaw,
  IconArrowRight,
  IconClock,
  IconStar,
} from '@tabler/icons-react';

interface WebsiteData {
  unternehmensname?: string;
  slogan?: string;
  beschreibung?: string;
  leistungen?: string;
  anzahl_plaetze?: number | null;
  oeffnungszeiten?: string;
  website_telefon?: string;
  website_email?: string;
  website_strasse?: string;
  website_hausnummer?: string;
  website_plz?: string;
  website_ort?: string;
  logo?: string | null;
  titelbild?: string | null;
  galerie_bilder?: string | null;
  instagram?: string;
  facebook?: string;
}

const SLUG = 'hundepension';

export default function Hundepension() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [website, setWebsite] = useState<WebsiteData | null>(null);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const aboutRef = useRef<HTMLDivElement>(null);
  const leistungenRef = useRef<HTMLDivElement>(null);
  const oeffnungRef = useRef<HTMLDivElement>(null);
  const galerieRef = useRef<HTMLDivElement>(null);
  const kontaktRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadPublicPagesConfig(SLUG)
      .then(async (c) => {
        setCfg(c);
        const p = c?.pages[SLUG] ?? null;
        setPage(p);
        if (!p) {
          setUnavailable(true);
          setLoading(false);
          return;
        }
        const ep = p.endpoints?.find((e) => e.op === 'list');
        if (!ep) {
          setLoading(false);
          return;
        }
        try {
          const records = await listPublicRecords(c!, p, { appId: ep.app_id, limit: 1 });
          if (records && records.length > 0) {
            const fields = records[0].fields as WebsiteData;
            setWebsite(fields);
            // galerie_bilder may be a space- or newline-separated list of URLs
            if (fields.galerie_bilder) {
              const imgs = fields.galerie_bilder
                .split(/[\s\n]+/)
                .map((s: string) => s.trim())
                .filter((s: string) => s.startsWith('http'));
              setGalleryImages(imgs);
            }
          }
        } catch {
          // no records — show placeholders
        }
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof PageUnavailableError) setUnavailable(true);
        setLoading(false);
      });
  }, []);

  // All hooks before early returns
  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth' });
  };

  if (loading || unavailable) {
    return <PublicShell loading={loading} unavailable={!loading && unavailable} />;
  }

  const name = website?.unternehmensname ?? tx('Meine Hundepension');
  const slogan = website?.slogan ?? tx('Ihr Zuhause auf Zeit für Ihren Liebling');
  const beschreibung =
    website?.beschreibung ??
    tx(
      'Willkommen in unserer liebevollen Hundepension! Wir kümmern uns um Ihren Vierbeiner wie um einen eigenen – mit viel Herz, individueller Betreuung und einem sicheren Zuhause auf Zeit.',
    );
  const leistungen =
    website?.leistungen ??
    tx('Tagesbetreuung\nÜbernachtung\nEinzelbetreuung\nSpaziergänge\nSpielsessions');
  const plaetze = website?.anzahl_plaetze;
  const oeffnungszeiten =
    website?.oeffnungszeiten ?? tx('Mo–Fr: 7:00–19:00 Uhr\nSa–So: 8:00–18:00 Uhr');

  const adresse =
    [
      website?.website_strasse && website?.website_hausnummer
        ? `${website.website_strasse} ${website.website_hausnummer}`
        : null,
      website?.website_plz && website?.website_ort
        ? `${website.website_plz} ${website.website_ort}`
        : null,
    ]
      .filter(Boolean)
      .join(', ') || null;

  const leistungenList = leistungen
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const buchungsUrl = `${window.location.hash.replace(/#.*/, '')}#/public/buchungsanfrage`;

  return (
    <PublicShell fullBleed>
      {/* ── NAV ─────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-stone-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            {website?.logo ? (
              <img
                src={website.logo}
                alt={name}
                className="h-9 w-auto object-contain shrink-0"
              />
            ) : (
              <IconPaw size={28} className="text-amber-600 shrink-0" />
            )}
            <span className="font-bold text-stone-800 truncate text-sm sm:text-base">{name}</span>
          </div>
          <div className="hidden md:flex items-center gap-5 text-sm text-stone-600 shrink-0">
            <button
              onClick={() => scrollTo(aboutRef)}
              className="hover:text-amber-700 transition-colors"
            >
              {tx('Über uns')}
            </button>
            <button
              onClick={() => scrollTo(leistungenRef)}
              className="hover:text-amber-700 transition-colors"
            >
              {tx('Leistungen')}
            </button>
            <button
              onClick={() => scrollTo(galerieRef)}
              className="hover:text-amber-700 transition-colors"
            >
              {tx('Galerie')}
            </button>
            <button
              onClick={() => scrollTo(kontaktRef)}
              className="hover:text-amber-700 transition-colors"
            >
              {tx('Kontakt')}
            </button>
          </div>
          <a
            href={buchungsUrl}
            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition-colors"
          >
            {tx('Jetzt anfragen')}
            <IconArrowRight size={15} className="shrink-0" />
          </a>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────── */}
      <section className="relative min-h-[60vh] md:min-h-[75vh] flex items-center justify-center overflow-hidden">
        {website?.titelbild ? (
          <img
            src={website.titelbild}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-amber-800 via-amber-600 to-stone-700" />
        )}
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 text-center px-4 max-w-3xl mx-auto flex flex-col items-center gap-6">
          {website?.logo && (
            <img
              src={website.logo}
              alt={name}
              className="h-20 w-auto object-contain drop-shadow-lg"
            />
          )}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white leading-tight drop-shadow-md">
            {name}
          </h1>
          {slogan && (
            <p className="text-lg sm:text-xl text-amber-100 max-w-xl">{slogan}</p>
          )}
          <a
            href={buchungsUrl}
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-amber-500 hover:bg-amber-400 text-white font-bold text-lg shadow-lg transition-colors"
          >
            {tx('Jetzt anfragen')}
            <IconArrowRight size={20} className="shrink-0" />
          </a>
          {plaetze != null && (
            <p className="text-amber-200 text-sm">
              {tx`${plaetze} gemütliche Plätze für Ihren Liebling`}
            </p>
          )}
        </div>
      </section>

      {/* ── ÜBER UNS ────────────────────────────────────────────── */}
      <section ref={aboutRef} className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <p className="text-amber-600 font-semibold uppercase tracking-widest text-xs mb-2">
                {tx('Über uns')}
              </p>
              <h2 className="text-3xl font-bold text-stone-800 mb-5">
                {tx('Ihr Liebling in guten Händen')}
              </h2>
              <p className="text-stone-600 leading-relaxed whitespace-pre-line">{beschreibung}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {plaetze != null && (
                <div className="bg-amber-50 rounded-2xl p-6 text-center">
                  <p className="text-4xl font-bold text-amber-600">{plaetze}</p>
                  <p className="text-stone-600 text-sm mt-1">{tx('Plätze')}</p>
                </div>
              )}
              <div className="bg-stone-50 rounded-2xl p-6 text-center">
                <IconPaw size={36} className="text-amber-600 mx-auto mb-1" />
                <p className="text-stone-600 text-sm">{tx('Mit Liebe')}</p>
              </div>
              <div className="bg-stone-50 rounded-2xl p-6 text-center col-span-2">
                <IconStar size={28} className="text-amber-500 mx-auto mb-1" />
                <p className="text-stone-600 text-sm">{tx('Individuelle Betreuung')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── LEISTUNGEN ──────────────────────────────────────────── */}
      <section ref={leistungenRef} className="py-16 bg-amber-50">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-10">
            <p className="text-amber-600 font-semibold uppercase tracking-widest text-xs mb-2">
              {tx('Was wir bieten')}
            </p>
            <h2 className="text-3xl font-bold text-stone-800">{tx('Unsere Leistungen')}</h2>
          </div>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {leistungenList.map((l, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-5 flex items-start gap-3 shadow-sm"
              >
                <IconPaw size={20} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-stone-700 font-medium">{l}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <a
              href={buchungsUrl}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-amber-600 hover:bg-amber-700 text-white font-semibold transition-colors"
            >
              {tx('Jetzt Anfrage stellen')}
              <IconArrowRight size={16} className="shrink-0" />
            </a>
          </div>
        </div>
      </section>

      {/* ── ÖFFNUNGSZEITEN ──────────────────────────────────────── */}
      <section ref={oeffnungRef} className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <div className="max-w-xl mx-auto text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-100 mb-4">
              <IconClock size={28} className="text-amber-600" />
            </div>
            <h2 className="text-3xl font-bold text-stone-800 mb-6">{tx('Öffnungszeiten')}</h2>
            <div className="bg-stone-50 rounded-2xl p-6">
              <p className="text-stone-700 leading-relaxed whitespace-pre-line text-left">
                {oeffnungszeiten}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── GALERIE ─────────────────────────────────────────────── */}
      {(galleryImages.length > 0 || !website) && (
        <section ref={galerieRef} className="py-16 bg-stone-100">
          <div className="max-w-5xl mx-auto px-4">
            <div className="text-center mb-10">
              <p className="text-amber-600 font-semibold uppercase tracking-widest text-xs mb-2">
                {tx('Eindrücke')}
              </p>
              <h2 className="text-3xl font-bold text-stone-800">{tx('Galerie')}</h2>
            </div>
            {galleryImages.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {galleryImages.map((src, i) => (
                  <button
                    key={i}
                    onClick={() => setLightboxIdx(i)}
                    className="aspect-square overflow-hidden rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                    aria-label={tx('Bild vergrößern')}
                  >
                    <img
                      src={src}
                      alt=""
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    />
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="aspect-square rounded-xl bg-stone-200 flex items-center justify-center"
                  >
                    <IconPaw size={32} className="text-stone-400" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── LIGHTBOX ────────────────────────────────────────────── */}
      {lightboxIdx !== null && galleryImages.length > 0 && (
        <div
          className="fixed inset-0 z-[var(--z-overlay)] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxIdx(null)}
          role="dialog"
          aria-modal="true"
          aria-label={tx('Bildvorschau')}
        >
          <img
            src={galleryImages[lightboxIdx]}
            alt=""
            className="max-h-full max-w-full rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2"
            onClick={() => setLightboxIdx(null)}
            aria-label={tx('Schließen')}
          >
            ✕
          </button>
          {galleryImages.length > 1 && (
            <>
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white bg-black/50 rounded-full p-3"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIdx((lightboxIdx - 1 + galleryImages.length) % galleryImages.length);
                }}
                aria-label={tx('Vorheriges Bild')}
              >
                ‹
              </button>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white bg-black/50 rounded-full p-3"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIdx((lightboxIdx + 1) % galleryImages.length);
                }}
                aria-label={tx('Nächstes Bild')}
              >
                ›
              </button>
            </>
          )}
        </div>
      )}

      {/* ── KONTAKT ─────────────────────────────────────────────── */}
      <section ref={kontaktRef} className="py-16 bg-amber-800 text-white">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-2">{tx('Kontakt')}</h2>
            <p className="text-amber-200">{tx('Wir freuen uns auf Ihre Nachricht!')}</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-6 mb-10">
            {website?.website_telefon && (
              <a
                href={`tel:${website.website_telefon}`}
                className="flex flex-col items-center gap-2 bg-amber-700/60 hover:bg-amber-700 rounded-2xl p-6 transition-colors text-center"
              >
                <IconPhone size={28} className="text-amber-300 shrink-0" />
                <span className="text-xs text-amber-300 uppercase tracking-widest">
                  {tx('Telefon')}
                </span>
                <span className="font-semibold">{website.website_telefon}</span>
              </a>
            )}
            {website?.website_email && (
              <a
                href={`mailto:${website.website_email}`}
                className="flex flex-col items-center gap-2 bg-amber-700/60 hover:bg-amber-700 rounded-2xl p-6 transition-colors text-center"
              >
                <IconMail size={28} className="text-amber-300 shrink-0" />
                <span className="text-xs text-amber-300 uppercase tracking-widest">
                  {tx('E-Mail')}
                </span>
                <span className="font-semibold break-all">{website.website_email}</span>
              </a>
            )}
            {adresse && (
              <div className="flex flex-col items-center gap-2 bg-amber-700/60 rounded-2xl p-6 text-center">
                <IconMapPin size={28} className="text-amber-300 shrink-0" />
                <span className="text-xs text-amber-300 uppercase tracking-widest">
                  {tx('Adresse')}
                </span>
                <span className="font-semibold">{adresse}</span>
              </div>
            )}
          </div>
          <div className="text-center">
            <a
              href={buchungsUrl}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white hover:bg-amber-50 text-amber-800 font-bold text-lg shadow-lg transition-colors"
            >
              {tx('Jetzt Buchungsanfrage stellen')}
              <IconArrowRight size={20} className="shrink-0" />
            </a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────── */}
      <footer className="bg-stone-900 text-stone-400 py-8">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <IconPaw size={18} className="text-amber-500 shrink-0" />
            <span className="text-sm">{name}</span>
          </div>
          <div className="flex items-center gap-4">
            {website?.instagram && (
              <a
                href={website.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
                aria-label="Instagram"
              >
                <IconBrandInstagram size={22} className="shrink-0" />
              </a>
            )}
            {website?.facebook && (
              <a
                href={website.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
                aria-label="Facebook"
              >
                <IconBrandFacebook size={22} className="shrink-0" />
              </a>
            )}
          </div>
          <p className="text-xs text-center sm:text-right">
            {tx('Alle Rechte vorbehalten')} · {name}
          </p>
        </div>
      </footer>
    </PublicShell>
  );
}
