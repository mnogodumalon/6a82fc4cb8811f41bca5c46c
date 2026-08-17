import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  IconDog,
  IconBrandInstagram,
  IconBrandFacebook,
  IconArrowRight,
  IconStar,
  IconHeart,
  IconShield,
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
    instagram?: string;
    facebook?: string;
  };
}

function parseLeistungen(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split('\n')
    .map(l => l.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);
}

const LEISTUNG_ICONS = [IconStar, IconHeart, IconShield, IconDog, IconClock, IconMapPin];

export default function Hundepension() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [site, setSite] = useState<WebsiteRecord | null>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadPublicPagesConfig()
      .then(async c => {
        const p = c?.pages['hundepension'] ?? null;
        setCfg(c);
        setPage(p);

        if (!c || !p) {
          setUnavailable(true);
          setLoading(false);
          return;
        }

        const ep = p.endpoints?.find(e => e.op === 'list');
        if (!ep) {
          setUnavailable(true);
          setLoading(false);
          return;
        }

        try {
          const records = await listPublicRecords(c, p, { appId: ep.app_id, limit: 1 });
          setSite((records[0] as WebsiteRecord) ?? null);
        } catch (err) {
          if (err instanceof PageUnavailableError) setUnavailable(true);
        } finally {
          setLoading(false);
        }
      })
      .catch(() => {
        setUnavailable(true);
        setLoading(false);
      });
  }, []);

  const scrollToCta = () => {
    ctaRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  if (loading || unavailable || !cfg || !page) {
    return <PublicShell loading={loading} unavailable={!loading && unavailable} />;
  }

  const f = site?.fields ?? {};
  const name = f.unternehmensname ?? tx('Hundepension');
  const slogan = f.slogan;
  const beschreibung = f.beschreibung;
  const leistungen = parseLeistungen(f.leistungen);
  const anzahlPlaetze = f.anzahl_plaetze;
  const oeffnungszeiten = f.oeffnungszeiten;
  const telefon = f.website_telefon;
  const email = f.website_email;
  const strasse = f.website_strasse;
  const hausnummer = f.website_hausnummer;
  const plz = f.website_plz;
  const ort = f.website_ort;
  const instagram = f.instagram;
  const facebook = f.facebook;

  const adresseVollstaendig =
    strasse || hausnummer || plz || ort
      ? [
          [strasse, hausnummer].filter(Boolean).join(' '),
          [plz, ort].filter(Boolean).join(' '),
        ]
          .filter(Boolean)
          .join(', ')
      : null;

  const defaultLeistungen = [
    tx('Liebevolle Einzelbetreuung'),
    tx('Tägliche Spaziergänge'),
    tx('Tiergerechte Unterbringung'),
    tx('Regelmäßige Fütterung nach Ihren Wünschen'),
    tx('Notfallkontakt rund um die Uhr'),
    tx('Tägliche Foto-Updates'),
  ];
  const leistungenAnzeigen = leistungen.length > 0 ? leistungen : defaultLeistungen;

  return (
    <PublicShell fullBleed>
      {/* Hero */}
      <section
        className="relative flex flex-col items-center justify-center text-center px-4 py-24 sm:py-36"
        style={{
          background: 'linear-gradient(135deg, #7c5cbf 0%, #c084fc 50%, #f0abfc 100%)',
          minHeight: '60vh',
        }}
      >
        <div className="relative z-10 max-w-2xl mx-auto flex flex-col items-center gap-6">
          <div
            className="flex items-center justify-center w-20 h-20 rounded-full mb-2"
            style={{ background: 'rgba(255,255,255,0.2)' }}
          >
            <IconDog size={44} className="text-white" stroke={1.5} />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight drop-shadow">
            {name}
          </h1>
          {slogan && (
            <p className="text-xl sm:text-2xl text-white/90 font-medium italic">
              {slogan}
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <button
              onClick={() => navigate('/#/public/buchungsanfrage')}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-lg font-bold shadow-lg transition-transform hover:scale-105 active:scale-95"
              style={{ background: 'white', color: '#7c5cbf' }}
            >
              {tx('Jetzt Anfrage stellen')}
              <IconArrowRight size={20} />
            </button>
            <button
              onClick={scrollToCta}
              className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-lg font-semibold border-2 border-white text-white transition-opacity hover:opacity-80"
            >
              {tx('Mehr erfahren')}
            </button>
          </div>
        </div>
        {/* Decorative wave */}
        <div
          className="absolute bottom-0 left-0 right-0 h-12 sm:h-20"
          style={{
            background: 'white',
            clipPath: 'ellipse(55% 100% at 50% 100%)',
          }}
        />
      </section>

      {/* Über uns */}
      {beschreibung && (
        <section className="max-w-4xl mx-auto px-4 py-16 sm:py-20 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-6" style={{ color: '#7c5cbf' }}>
            {tx('Über uns')}
          </h2>
          <p className="text-base sm:text-lg leading-relaxed text-gray-700 whitespace-pre-line">
            {beschreibung}
          </p>
        </section>
      )}

      {/* Leistungen */}
      <section
        className="py-16 sm:py-20"
        style={{ background: 'linear-gradient(180deg, #fdf4ff 0%, #fff 100%)' }}
      >
        <div className="max-w-5xl mx-auto px-4">
          <h2
            className="text-2xl sm:text-3xl font-bold text-center mb-10"
            style={{ color: '#7c5cbf' }}
          >
            {tx('Unsere Leistungen')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {leistungenAnzeigen.map((leistung, i) => {
              const Icon = LEISTUNG_ICONS[i % LEISTUNG_ICONS.length];
              return (
                <div
                  key={i}
                  className="flex items-start gap-4 rounded-2xl p-5 shadow-sm border"
                  style={{ background: 'white', borderColor: '#e9d5ff' }}
                >
                  <div
                    className="flex-shrink-0 flex items-center justify-center w-11 h-11 rounded-xl"
                    style={{ background: '#f3e8ff' }}
                  >
                    <Icon size={22} style={{ color: '#7c5cbf' }} stroke={1.5} />
                  </div>
                  <p className="text-sm sm:text-base font-medium text-gray-800 leading-snug pt-2">
                    {leistung}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Infobox: Plätze & Öffnungszeiten */}
      {(anzahlPlaetze != null || oeffnungszeiten) && (
        <section className="max-w-4xl mx-auto px-4 py-12 sm:py-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {anzahlPlaetze != null && (
              <div
                className="rounded-2xl p-7 text-center shadow-sm border"
                style={{ background: '#fdf4ff', borderColor: '#e9d5ff' }}
              >
                <IconDog size={36} style={{ color: '#7c5cbf' }} stroke={1.5} className="mx-auto mb-3" />
                <div className="text-5xl font-extrabold mb-2" style={{ color: '#7c5cbf' }}>
                  {anzahlPlaetze}
                </div>
                <div className="text-base font-semibold text-gray-700">
                  {tx('Plätze für Ihren Liebling')}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {tx('Liebevolle Betreuung in kleiner Runde')}
                </p>
              </div>
            )}
            {oeffnungszeiten && (
              <div
                className="rounded-2xl p-7 shadow-sm border"
                style={{ background: '#fdf4ff', borderColor: '#e9d5ff' }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <IconClock size={24} style={{ color: '#7c5cbf' }} stroke={1.5} />
                  <h3 className="text-lg font-bold" style={{ color: '#7c5cbf' }}>
                    {tx('Öffnungszeiten')}
                  </h3>
                </div>
                <p className="text-sm sm:text-base text-gray-700 leading-relaxed whitespace-pre-line">
                  {oeffnungszeiten}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* CTA-Banner Mitte */}
      <section
        className="py-14 sm:py-20"
        style={{ background: 'linear-gradient(135deg, #7c5cbf 0%, #c084fc 100%)' }}
        ref={ctaRef}
      >
        <div className="max-w-2xl mx-auto px-4 text-center">
          <IconHeart size={40} className="text-white/80 mx-auto mb-4" stroke={1.5} />
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
            {tx('Ihr Hund ist bei uns in guten Pfoten!')}
          </h2>
          <p className="text-white/85 text-base sm:text-lg mb-8">
            {tx('Senden Sie uns eine Anfrage – wir melden uns schnellstmöglich bei Ihnen.')}
          </p>
          <button
            onClick={() => navigate('/#/public/buchungsanfrage')}
            className="inline-flex items-center gap-2 px-10 py-4 rounded-full text-lg font-bold shadow-xl transition-transform hover:scale-105 active:scale-95"
            style={{ background: 'white', color: '#7c5cbf' }}
          >
            {tx('Jetzt Anfrage stellen')}
            <IconArrowRight size={20} />
          </button>
        </div>
      </section>

      {/* Kontakt */}
      {(telefon || email || adresseVollstaendig) && (
        <section className="max-w-4xl mx-auto px-4 py-16 sm:py-20">
          <h2
            className="text-2xl sm:text-3xl font-bold text-center mb-10"
            style={{ color: '#7c5cbf' }}
          >
            {tx('Kontakt')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {telefon && (
              <a
                href={`tel:${telefon}`}
                className="flex items-center gap-4 rounded-2xl p-5 border shadow-sm transition-shadow hover:shadow-md"
                style={{ background: 'white', borderColor: '#e9d5ff', textDecoration: 'none' }}
              >
                <div
                  className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-xl"
                  style={{ background: '#f3e8ff' }}
                >
                  <IconPhone size={22} style={{ color: '#7c5cbf' }} stroke={1.5} />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                    {tx('Telefon')}
                  </div>
                  <div className="font-semibold text-gray-800">{telefon}</div>
                </div>
              </a>
            )}
            {email && (
              <a
                href={`mailto:${email}`}
                className="flex items-center gap-4 rounded-2xl p-5 border shadow-sm transition-shadow hover:shadow-md"
                style={{ background: 'white', borderColor: '#e9d5ff', textDecoration: 'none' }}
              >
                <div
                  className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-xl"
                  style={{ background: '#f3e8ff' }}
                >
                  <IconMail size={22} style={{ color: '#7c5cbf' }} stroke={1.5} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                    {tx('E-Mail')}
                  </div>
                  <div className="font-semibold text-gray-800 truncate">{email}</div>
                </div>
              </a>
            )}
            {adresseVollstaendig && (
              <div
                className="flex items-center gap-4 rounded-2xl p-5 border shadow-sm"
                style={{ background: 'white', borderColor: '#e9d5ff' }}
              >
                <div
                  className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-xl"
                  style={{ background: '#f3e8ff' }}
                >
                  <IconMapPin size={22} style={{ color: '#7c5cbf' }} stroke={1.5} />
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">
                    {tx('Adresse')}
                  </div>
                  <div className="font-semibold text-gray-800 leading-snug">
                    {[strasse, hausnummer].filter(Boolean).join(' ')}
                    {(strasse || hausnummer) && (plz || ort) ? <br /> : null}
                    {[plz, ort].filter(Boolean).join(' ')}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Social Media */}
      {(instagram || facebook) && (
        <section
          className="py-12 sm:py-16"
          style={{ background: '#fdf4ff' }}
        >
          <div className="max-w-xl mx-auto px-4 text-center">
            <h2 className="text-xl font-bold mb-6" style={{ color: '#7c5cbf' }}>
              {tx('Folgen Sie uns')}
            </h2>
            <div className="flex justify-center gap-4 flex-wrap">
              {instagram && (
                <a
                  href={instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-white text-sm transition-opacity hover:opacity-85"
                  style={{ background: 'linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)' }}
                >
                  <IconBrandInstagram size={20} stroke={1.5} />
                  Instagram
                </a>
              )}
              {facebook && (
                <a
                  href={facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-white text-sm transition-opacity hover:opacity-85"
                  style={{ background: '#1877f2' }}
                >
                  <IconBrandFacebook size={20} stroke={1.5} />
                  Facebook
                </a>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Footer-CTA */}
      <section className="max-w-2xl mx-auto px-4 py-14 sm:py-20 text-center">
        <p className="text-gray-500 text-sm mb-4">
          {tx('Bereit für einen entspannten Urlaub — auch für Ihren Hund?')}
        </p>
        <button
          onClick={() => navigate('/#/public/buchungsanfrage')}
          className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-base font-bold shadow-lg transition-transform hover:scale-105 active:scale-95"
          style={{ background: 'linear-gradient(135deg, #7c5cbf, #c084fc)', color: 'white' }}
        >
          {tx('Jetzt Anfrage stellen')}
          <IconArrowRight size={18} />
        </button>
      </section>
    </PublicShell>
  );
}
