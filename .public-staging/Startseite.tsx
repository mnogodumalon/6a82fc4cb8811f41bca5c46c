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
  IconClock,
  IconUsers,
  IconBrandInstagram,
  IconBrandFacebook,
  IconPaw,
  IconHeart,
  IconShield,
  IconStar,
  IconArrowRight,
  IconChevronLeft,
  IconChevronRight,
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

function parseLeistungen(text: string): string[] {
  return text
    .split(/\n|,|;/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

const SERVICE_ICONS = [
  <IconPaw size={24} className="shrink-0 text-amber-600" />,
  <IconHeart size={24} className="shrink-0 text-amber-600" />,
  <IconShield size={24} className="shrink-0 text-amber-600" />,
  <IconStar size={24} className="shrink-0 text-amber-600" />,
  <IconUsers size={24} className="shrink-0 text-amber-600" />,
  <IconClock size={24} className="shrink-0 text-amber-600" />,
];

export default function Startseite() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [site, setSite] = useState<WebsiteRecord | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const buchungRef = useRef<HTMLElement | null>(null);
  const leistungenRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    loadPublicPagesConfig()
      .then(async c => {
        setCfg(c);
        const p = c?.pages['startseite'] ?? null;
        setPage(p);
        if (p) {
          const ep = p.endpoints?.find(e => e.op === 'list');
          if (ep) {
            const records = await listPublicRecords(c!, p, { appId: ep.app_id, limit: 1 });
            if (records && records.length > 0) {
              setSite(records[0] as WebsiteRecord);
            }
          }
        }
        setLoading(false);
      })
      .catch(err => {
        if (err instanceof PageUnavailableError) setUnavailable(true);
        setLoading(false);
      });
  }, []);

  const galleryImages: string[] = site?.fields.galerie_bilder
    ? site.fields.galerie_bilder.split ? [site.fields.galerie_bilder] : [site.fields.galerie_bilder]
    : [];

  if (loading || unavailable || !cfg || !page) {
    return <PublicShell loading={loading} unavailable={!loading && (unavailable || !page)} />;
  }

  const f = site?.fields ?? {};
  const name = f.unternehmensname ?? tx('Hundepension');
  const leistungenList = f.leistungen ? parseLeistungen(f.leistungen) : [];
  const adresse = [
    f.website_strasse && f.website_hausnummer
      ? `${f.website_strasse} ${f.website_hausnummer}`
      : f.website_strasse,
    f.website_plz && f.website_ort
      ? `${f.website_plz} ${f.website_ort}`
      : f.website_ort,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <PublicShell fullBleed>
      {/* Hero */}
      <section
        className="relative min-h-[70vh] flex flex-col items-center justify-center text-center overflow-hidden"
        style={
          f.titelbild
            ? {
                backgroundImage: `url(${f.titelbild})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : { background: 'linear-gradient(135deg, #92400e 0%, #b45309 50%, #d97706 100%)' }
        }
      >
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 max-w-3xl mx-auto px-6 py-20">
          {f.logo && (
            <img
              src={f.logo}
              alt={name}
              className="mx-auto mb-6 h-20 w-auto object-contain rounded-full bg-white/10 p-2"
            />
          )}
          {!f.logo && (
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white/20">
              <IconPaw size={48} className="text-white" />
            </div>
          )}
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4 leading-tight">
            {name}
          </h1>
          {f.slogan && (
            <p className="text-xl sm:text-2xl text-amber-200 mb-8 font-medium italic">
              {f.slogan}
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold px-8 py-4 rounded-full text-lg transition-colors shadow-lg"
              onClick={() => {
                // navigate to booking page via hash route
                window.location.hash = '/public/hundepension';
              }}
            >
              <IconPaw size={20} />
              {tx('Jetzt Platz anfragen')}
              <IconArrowRight size={20} />
            </button>
            <button
              className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white font-semibold px-8 py-4 rounded-full text-lg transition-colors border border-white/40"
              onClick={() => leistungenRef.current?.scrollIntoView({ behavior: 'smooth' })}
            >
              {tx('Unsere Leistungen')}
            </button>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-stone-50 to-transparent" />
      </section>

      {/* Über uns */}
      {f.beschreibung && (
        <section className="bg-stone-50 py-16 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="flex justify-center mb-4">
              <IconHeart size={32} className="text-amber-500" />
            </div>
            <h2 className="text-3xl font-bold text-stone-800 mb-6">{tx('Über uns')}</h2>
            <p className="text-lg text-stone-600 leading-relaxed whitespace-pre-line">
              {f.beschreibung}
            </p>
          </div>
        </section>
      )}

      {/* Leistungen */}
      {leistungenList.length > 0 && (
        <section
          ref={el => { leistungenRef.current = el; }}
          className="bg-white py-16 px-4"
        >
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <div className="flex justify-center mb-4">
                <IconStar size={32} className="text-amber-500" />
              </div>
              <h2 className="text-3xl font-bold text-stone-800">{tx('Unsere Leistungen')}</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {leistungenList.map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-5 rounded-2xl bg-amber-50 border border-amber-100"
                >
                  {SERVICE_ICONS[i % SERVICE_ICONS.length]}
                  <span className="text-stone-700 font-medium leading-snug">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Kapazität + Öffnungszeiten + Kontakt */}
      <section className="bg-amber-50 py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-stone-800 text-center mb-10">
            {tx('Infos & Kontakt')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Plätze */}
            {f.anzahl_plaetze != null && (
              <div className="bg-white rounded-2xl p-6 flex flex-col items-center text-center shadow-sm border border-amber-100">
                <IconUsers size={36} className="text-amber-500 mb-3" />
                <p className="text-4xl font-bold text-stone-800 mb-1">{f.anzahl_plaetze}</p>
                <p className="text-stone-500 text-sm">{tx('Plätze für eure Hunde')}</p>
              </div>
            )}
            {/* Öffnungszeiten */}
            {f.oeffnungszeiten && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-amber-100">
                <div className="flex items-center gap-2 mb-3">
                  <IconClock size={20} className="text-amber-500 shrink-0" />
                  <h3 className="font-semibold text-stone-800">{tx('Öffnungszeiten')}</h3>
                </div>
                <p className="text-stone-600 text-sm whitespace-pre-line leading-relaxed">
                  {f.oeffnungszeiten}
                </p>
              </div>
            )}
            {/* Kontakt */}
            {(f.website_telefon || f.website_email || adresse) && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-amber-100">
                <div className="flex items-center gap-2 mb-3">
                  <IconMapPin size={20} className="text-amber-500 shrink-0" />
                  <h3 className="font-semibold text-stone-800">{tx('Kontakt & Adresse')}</h3>
                </div>
                <div className="flex flex-col gap-2">
                  {f.website_telefon && (
                    <a
                      href={`tel:${f.website_telefon}`}
                      className="flex items-center gap-2 text-stone-600 hover:text-amber-600 text-sm transition-colors"
                    >
                      <IconPhone size={16} className="shrink-0 text-amber-400" />
                      {f.website_telefon}
                    </a>
                  )}
                  {f.website_email && (
                    <a
                      href={`mailto:${f.website_email}`}
                      className="flex items-center gap-2 text-stone-600 hover:text-amber-600 text-sm transition-colors"
                    >
                      <IconMail size={16} className="shrink-0 text-amber-400" />
                      {f.website_email}
                    </a>
                  )}
                  {adresse && (
                    <p className="flex items-start gap-2 text-stone-600 text-sm">
                      <IconMapPin size={16} className="shrink-0 text-amber-400 mt-0.5" />
                      {adresse}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Galerie */}
      {galleryImages.length > 0 && (
        <section className="bg-white py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-stone-800 text-center mb-8">
              {tx('Impressionen')}
            </h2>
            <div className="relative">
              <div className="overflow-hidden rounded-2xl aspect-video bg-stone-100">
                <img
                  src={galleryImages[galleryIndex]}
                  alt={tx('Galeriebild')}
                  className="w-full h-full object-cover"
                />
              </div>
              {galleryImages.length > 1 && (
                <>
                  <button
                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-stone-700 rounded-full p-2 shadow transition-colors"
                    onClick={() => setGalleryIndex(i => (i - 1 + galleryImages.length) % galleryImages.length)}
                    aria-label={tx('Vorheriges Bild')}
                  >
                    <IconChevronLeft size={20} />
                  </button>
                  <button
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-stone-700 rounded-full p-2 shadow transition-colors"
                    onClick={() => setGalleryIndex(i => (i + 1) % galleryImages.length)}
                    aria-label={tx('Nächstes Bild')}
                  >
                    <IconChevronRight size={20} />
                  </button>
                  <div className="flex justify-center gap-1.5 mt-3">
                    {galleryImages.map((_, i) => (
                      <button
                        key={i}
                        className={`w-2 h-2 rounded-full transition-colors ${i === galleryIndex ? 'bg-amber-500' : 'bg-stone-300'}`}
                        onClick={() => setGalleryIndex(i)}
                        aria-label={tx('Bild auswählen')}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Social Links */}
      {(f.instagram || f.facebook) && (
        <section className="bg-stone-100 py-10 px-4">
          <div className="max-w-xl mx-auto text-center">
            <p className="text-stone-500 text-sm mb-4">{tx('Folge uns auf Social Media')}</p>
            <div className="flex justify-center gap-4">
              {f.instagram && (
                <a
                  href={f.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-white hover:bg-amber-50 text-stone-700 font-medium px-5 py-2.5 rounded-full border border-stone-200 shadow-sm transition-colors text-sm"
                >
                  <IconBrandInstagram size={18} className="text-pink-500" />
                  Instagram
                </a>
              )}
              {f.facebook && (
                <a
                  href={f.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-white hover:bg-amber-50 text-stone-700 font-medium px-5 py-2.5 rounded-full border border-stone-200 shadow-sm transition-colors text-sm"
                >
                  <IconBrandFacebook size={18} className="text-blue-500" />
                  Facebook
                </a>
              )}
            </div>
          </div>
        </section>
      )}

      {/* CTA Buchungsanfrage */}
      <section
        ref={el => { buchungRef.current = el; }}
        className="bg-gradient-to-br from-amber-600 to-amber-800 py-20 px-4"
      >
        <div className="max-w-2xl mx-auto text-center">
          <IconPaw size={48} className="text-white/80 mx-auto mb-6" stroke={1.5} />
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            {tx('Ihr Hund ist bei uns in guten Pfoten!')}
          </h2>
          <p className="text-amber-100 text-lg mb-8">
            {tx('Schickt uns eine Buchungsanfrage — wir melden uns schnell zurück.')}
          </p>
          <button
            className="inline-flex items-center gap-3 bg-white hover:bg-amber-50 text-amber-700 font-bold px-10 py-5 rounded-full text-xl shadow-xl transition-colors"
            onClick={() => {
              window.location.hash = '/public/hundepension';
            }}
          >
            <IconPaw size={24} />
            {tx('Jetzt Buchungsanfrage stellen')}
            <IconArrowRight size={24} />
          </button>
        </div>
      </section>
    </PublicShell>
  );
}
