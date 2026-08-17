import { useEffect, useState } from 'react';
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
  IconBrandInstagram,
  IconBrandFacebook,
  IconPaw,
  IconArrowRight,
} from '@tabler/icons-react';

interface WebsiteFields {
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
}

interface WebsiteRecord {
  record_id: string;
  fields: WebsiteFields;
}

export default function Startseite() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [website, setWebsite] = useState<WebsiteRecord | null>(null);

  useEffect(() => {
    loadPublicPagesConfig()
      .then(async (c) => {
        setCfg(c);
        const p = c?.pages['startseite'] ?? null;
        setPage(p);
        if (!p) {
          setUnavailable(true);
          setLoading(false);
          return;
        }
        if (!c) { setLoading(false); return; }
        const records = await listPublicRecords(c, p, {
          appId: p.endpoints?.find((e) => e.op === 'list')?.app_id ?? '',
          limit: 1,
        });
        const entries = Object.values(records);
        if (entries.length > 0) {
          setWebsite(entries[0] as unknown as WebsiteRecord);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof PageUnavailableError) {
          setUnavailable(true);
        }
        setLoading(false);
      });
  }, []);

  if (loading || unavailable || !cfg || !page) {
    return <PublicShell loading={loading} unavailable={!loading && (unavailable || !page)} />;
  }

  const w = website?.fields ?? {};
  const name = w.unternehmensname ?? tx('Hundepension');
  const adresse =
    w.website_strasse && w.website_ort
      ? `${w.website_strasse}${w.website_hausnummer ? ' ' + w.website_hausnummer : ''}, ${w.website_plz ? w.website_plz + ' ' : ''}${w.website_ort}`
      : null;

  const leistungszeilen: string[] = w.leistungen
    ? w.leistungen.split('\n').map((l) => l.trim()).filter(Boolean)
    : [];

  return (
    <PublicShell fullBleed>
      {/* Hero */}
      <section className="bg-amber-950 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none select-none flex items-center justify-center">
          <IconPaw size={480} stroke={0.5} />
        </div>
        <div className="relative max-w-4xl mx-auto px-6 py-20 text-center">
          <div className="inline-flex items-center gap-2 bg-amber-800/60 text-amber-200 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
            <IconPaw size={14} />
            <span>{tx('Professionelle Hundebetreuung')}</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4 leading-tight">
            {name}
          </h1>
          {w.slogan && (
            <p className="text-xl text-amber-200 mb-8 max-w-xl mx-auto">
              {w.slogan}
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => { window.location.hash = '/public/buchungsanfrage'; }}
              className="inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-amber-950 font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              {tx('Jetzt Buchungsanfrage stellen')}
              <IconArrowRight size={18} />
            </button>
            {w.website_telefon && (
              <a
                href={`tel:${w.website_telefon}`}
                className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-medium px-6 py-3 rounded-xl transition-colors"
              >
                <IconPhone size={18} />
                {w.website_telefon}
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Über uns */}
      {w.beschreibung && (
        <section className="bg-white py-16">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{tx('Über uns')}</h2>
            <p className="text-gray-600 leading-relaxed whitespace-pre-line text-lg">
              {w.beschreibung}
            </p>
            {w.anzahl_plaetze != null && (
              <div className="mt-8 inline-flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-6 py-4">
                <IconPaw size={28} className="text-amber-600 shrink-0" />
                <div className="text-left">
                  <div className="text-2xl font-bold text-amber-700">{w.anzahl_plaetze}</div>
                  <div className="text-sm text-amber-600">{tx('verfügbare Plätze')}</div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Leistungen */}
      {leistungszeilen.length > 0 && (
        <section className="bg-amber-50 py-16">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">
              {tx('Unsere Leistungen')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {leistungszeilen.map((zeile, i) => (
                <div
                  key={i}
                  className="bg-white rounded-xl border border-amber-100 px-5 py-4 flex items-start gap-3 shadow-sm"
                >
                  <IconPaw size={18} className="text-amber-500 shrink-0 mt-0.5" />
                  <span className="text-gray-700 text-sm leading-snug">{zeile}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Öffnungszeiten & Kontakt */}
      <section className="bg-white py-16">
        <div className="max-w-4xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">
            {tx('Öffnungszeiten & Kontakt')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Öffnungszeiten */}
            {w.oeffnungszeiten && (
              <div className="bg-amber-50 rounded-2xl p-6 border border-amber-100">
                <div className="flex items-center gap-2 mb-4">
                  <IconClock size={20} className="text-amber-600 shrink-0" />
                  <h3 className="font-semibold text-gray-900">{tx('Öffnungszeiten')}</h3>
                </div>
                <p className="text-gray-600 text-sm whitespace-pre-line leading-relaxed">
                  {w.oeffnungszeiten}
                </p>
              </div>
            )}

            {/* Kontaktdaten */}
            <div className="space-y-4">
              {adresse && (
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(adresse)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 group"
                >
                  <IconMapPin size={20} className="text-amber-600 shrink-0 mt-0.5" />
                  <span className="text-gray-600 text-sm group-hover:text-amber-700 transition-colors">
                    {adresse}
                  </span>
                </a>
              )}
              {w.website_telefon && (
                <a
                  href={`tel:${w.website_telefon}`}
                  className="flex items-center gap-3 group"
                >
                  <IconPhone size={20} className="text-amber-600 shrink-0" />
                  <span className="text-gray-600 text-sm group-hover:text-amber-700 transition-colors">
                    {w.website_telefon}
                  </span>
                </a>
              )}
              {w.website_email && (
                <a
                  href={`mailto:${w.website_email}`}
                  className="flex items-center gap-3 group"
                >
                  <IconMail size={20} className="text-amber-600 shrink-0" />
                  <span className="text-gray-600 text-sm group-hover:text-amber-700 transition-colors">
                    {w.website_email}
                  </span>
                </a>
              )}
              {(w.instagram || w.facebook) && (
                <div className="flex gap-3 pt-2">
                  {w.instagram && (
                    <a
                      href={w.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-gray-500 hover:text-pink-600 transition-colors"
                    >
                      <IconBrandInstagram size={20} className="shrink-0" />
                      <span>{tx('Instagram')}</span>
                    </a>
                  )}
                  {w.facebook && (
                    <a
                      href={w.facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 transition-colors"
                    >
                      <IconBrandFacebook size={20} className="shrink-0" />
                      <span>{tx('Facebook')}</span>
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* CTA-Banner */}
      <section className="bg-amber-900 text-white py-16">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <IconPaw size={40} className="text-amber-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-3">{tx('Ihr Hund ist bei uns in guten Pfoten')}</h2>
          <p className="text-amber-200 mb-8 text-lg">
            {tx('Stellen Sie jetzt eine unverbindliche Buchungsanfrage — wir melden uns schnellstmöglich bei Ihnen.')}
          </p>
          <button
            onClick={() => { window.location.hash = '/public/buchungsanfrage'; }}
            className="inline-flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-amber-950 font-bold px-8 py-4 rounded-xl text-lg transition-colors"
          >
            {tx('Buchungsanfrage stellen')}
            <IconArrowRight size={20} />
          </button>
        </div>
      </section>

    </PublicShell>
  );
}
