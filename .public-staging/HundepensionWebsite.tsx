import { useEffect, useRef, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
  listPublicRecords,
  createPublicRecord,
  prepareChallenge,
  PageUnavailableError,
  type PublicPagesConfig,
  type PublicPageConfig,
} from '@/lib/publicClient';
import { tx } from '@/i18n';
import { format } from 'date-fns';

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

const GROESSE_LABELS: Record<string, string> = {
  klein: 'Klein (bis 10 kg)',
  mittel: 'Mittel (10–25 kg)',
  gross: 'Groß (über 25 kg)',
};

function HeroSection({
  website,
  onBuchungClick,
}: {
  website: WebsiteRecord;
  onBuchungClick: () => void;
}) {
  const f = website.fields;
  return (
    <div
      className="relative min-h-[420px] md:min-h-[540px] flex flex-col items-center justify-center text-center overflow-hidden"
      style={
        f.titelbild
          ? { backgroundImage: `url(${f.titelbild})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : { background: 'linear-gradient(135deg, #78350f 0%, #b45309 50%, #d97706 100%)' }
      }
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative z-10 px-4 py-16 max-w-3xl mx-auto">
        {f.logo && (
          <img
            src={f.logo}
            alt={f.unternehmensname ?? 'Logo'}
            className="h-16 md:h-20 mx-auto mb-6 object-contain drop-shadow-lg"
          />
        )}
        <h1 className="text-3xl md:text-5xl font-bold text-white drop-shadow mb-3">
          {f.unternehmensname ?? tx('Hundepension')}
        </h1>
        {f.slogan && (
          <p className="text-lg md:text-2xl text-amber-200 font-medium mb-6 drop-shadow">
            {f.slogan}
          </p>
        )}
        {f.anzahl_plaetze != null && (
          <p className="text-white/80 text-sm mb-6">
            {tx`${f.anzahl_plaetze} Plätze für dein Lieblingstier`}
          </p>
        )}
        <button
          onClick={onBuchungClick}
          className="inline-block bg-amber-500 hover:bg-amber-400 text-white font-semibold px-8 py-3 rounded-full shadow-lg transition-colors text-lg"
        >
          {tx('Jetzt anfragen')}
        </button>
      </div>
    </div>
  );
}

function UeberUnsSection({ website }: { website: WebsiteRecord }) {
  const f = website.fields;
  if (!f.beschreibung) return null;
  return (
    <section className="py-14 bg-white">
      <div className="max-w-5xl mx-auto px-4">
        <h2 className="text-2xl md:text-3xl font-bold text-stone-800 mb-4">{tx('Über uns')}</h2>
        <p className="text-stone-600 leading-relaxed whitespace-pre-line text-base md:text-lg max-w-3xl">
          {f.beschreibung}
        </p>
      </div>
    </section>
  );
}

function LeistungenSection({ website }: { website: WebsiteRecord }) {
  const f = website.fields;
  if (!f.leistungen) return null;

  const lines = f.leistungen.split('\n').filter(l => l.trim().length > 0);

  return (
    <section className="py-14 bg-amber-50">
      <div className="max-w-5xl mx-auto px-4">
        <h2 className="text-2xl md:text-3xl font-bold text-stone-800 mb-8">{tx('Unsere Leistungen')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {lines.map((leistung, i) => (
            <div
              key={i}
              className="bg-white rounded-xl p-5 shadow-sm border border-amber-100 flex items-start gap-3"
            >
              <span className="text-amber-500 text-xl shrink-0 mt-0.5">🐾</span>
              <span className="text-stone-700 font-medium">{leistung.replace(/^[-•*]\s*/, '')}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function GalerieSection({ website }: { website: WebsiteRecord }) {
  const f = website.fields;
  if (!f.galerie_bilder) return null;

  const urls = f.galerie_bilder.split ? [f.galerie_bilder] : [];
  if (urls.length === 0) return null;

  return (
    <section className="py-14 bg-white">
      <div className="max-w-5xl mx-auto px-4">
        <h2 className="text-2xl md:text-3xl font-bold text-stone-800 mb-8">{tx('Galerie')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {urls.map((url, i) => (
            <div key={i} className="aspect-square rounded-xl overflow-hidden shadow-sm">
              <img src={url} alt={tx('Galeriebild')} className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function BuchungsFormular({
  cfg,
  page,
  onSuccess,
}: {
  cfg: PublicPagesConfig;
  page: PublicPageConfig;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    anfrage_vorname: '',
    anfrage_nachname: '',
    anfrage_email: '',
    anfrage_telefon: '',
    hund_name: '',
    hund_rasse: '',
    hund_groesse: '',
    wunsch_anreise: '',
    wunsch_abreise: '',
    nachricht: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const ep = page.endpoints?.find(e => e.op === 'create');

  const handleFocus = () => {
    if (!touched && ep) {
      setTouched(true);
      prepareChallenge(cfg, page, 'POST', `/apps/${ep.app_id}/records`);
    }
  };

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload: Record<string, string> = {
      anfrage_vorname: form.anfrage_vorname,
      anfrage_nachname: form.anfrage_nachname,
      anfrage_email: form.anfrage_email,
      hund_name: form.hund_name,
      wunsch_anreise: form.wunsch_anreise,
      wunsch_abreise: form.wunsch_abreise,
    };
    if (form.anfrage_telefon) payload.anfrage_telefon = form.anfrage_telefon;
    if (form.hund_rasse) payload.hund_rasse = form.hund_rasse;
    if (form.hund_groesse) payload.hund_groesse = form.hund_groesse;
    if (form.nachricht) payload.nachricht = form.nachricht;

    try {
      await createPublicRecord(cfg, page, payload);
      onSuccess();
    } catch {
      setError(tx('Beim Absenden ist ein Fehler aufgetreten. Bitte versuche es erneut.'));
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'w-full border border-stone-300 rounded-lg px-4 py-2.5 text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-colors bg-white';
  const labelClass = 'block text-sm font-medium text-stone-700 mb-1.5';

  const today = format(new Date(), 'yyyy-MM-dd');

  return (
    <form onSubmit={handleSubmit} onFocus={handleFocus} className="space-y-6">
      {/* Kontaktdaten */}
      <div>
        <h3 className="text-lg font-semibold text-stone-800 mb-4">{tx('Ihre Kontaktdaten')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>
              {tx('Vorname')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.anfrage_vorname}
              onChange={e => handleChange('anfrage_vorname', e.target.value)}
              placeholder={tx('Max')}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>
              {tx('Nachname')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.anfrage_nachname}
              onChange={e => handleChange('anfrage_nachname', e.target.value)}
              placeholder={tx('Mustermann')}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>
              {tx('E-Mail-Adresse')} <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              required
              value={form.anfrage_email}
              onChange={e => handleChange('anfrage_email', e.target.value)}
              placeholder={tx('max@beispiel.de')}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>{tx('Telefon (optional)')}</label>
            <input
              type="tel"
              value={form.anfrage_telefon}
              onChange={e => handleChange('anfrage_telefon', e.target.value)}
              placeholder={tx('+49 123 456789')}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Angaben zum Hund */}
      <div>
        <h3 className="text-lg font-semibold text-stone-800 mb-4">{tx('Angaben zum Hund')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>
              {tx('Name des Hundes')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.hund_name}
              onChange={e => handleChange('hund_name', e.target.value)}
              placeholder={tx('Bello')}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>{tx('Rasse (optional)')}</label>
            <input
              type="text"
              value={form.hund_rasse}
              onChange={e => handleChange('hund_rasse', e.target.value)}
              placeholder={tx('z. B. Golden Retriever')}
              className={inputClass}
            />
          </div>
        </div>
        <div className="mt-4">
          <label className={labelClass}>{tx('Größe des Hundes')}</label>
          <div className="flex flex-wrap gap-3">
            {Object.entries(GROESSE_LABELS).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => handleChange('hund_groesse', form.hund_groesse === key ? '' : key)}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  form.hund_groesse === key
                    ? 'bg-amber-500 border-amber-500 text-white'
                    : 'bg-white border-stone-300 text-stone-700 hover:border-amber-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Zeitraum */}
      <div>
        <h3 className="text-lg font-semibold text-stone-800 mb-4">{tx('Gewünschter Aufenthalt')}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>
              {tx('Anreise')} <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              min={today}
              value={form.wunsch_anreise}
              onChange={e => handleChange('wunsch_anreise', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>
              {tx('Abreise')} <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              min={form.wunsch_anreise || today}
              value={form.wunsch_abreise}
              onChange={e => handleChange('wunsch_abreise', e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Nachricht */}
      <div>
        <label className={labelClass}>{tx('Nachricht / Besondere Wünsche (optional)')}</label>
        <textarea
          rows={4}
          value={form.nachricht}
          onChange={e => handleChange('nachricht', e.target.value)}
          placeholder={tx('Besonderheiten, Medikamente, Fütterungshinweise …')}
          className={`${inputClass} resize-none`}
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-white font-semibold px-10 py-3 rounded-full shadow transition-colors text-base"
      >
        {submitting ? tx('Wird gesendet …') : tx('Anfrage absenden')}
      </button>

      <p className="text-xs text-stone-400">
        {tx('Mit dem Absenden stimmst du zu, dass deine Daten zur Bearbeitung der Anfrage gespeichert werden.')}
      </p>
    </form>
  );
}

function KontaktSection({ website }: { website: WebsiteRecord }) {
  const f = website.fields;
  const hasAddress = f.website_strasse || f.website_plz || f.website_ort;
  const hasContact = f.website_telefon || f.website_email;
  const hasSocial = f.instagram || f.facebook;

  if (!hasAddress && !hasContact && !f.oeffnungszeiten && !hasSocial) return null;

  return (
    <section className="py-14 bg-stone-800 text-white">
      <div className="max-w-5xl mx-auto px-4">
        <h2 className="text-2xl md:text-3xl font-bold mb-10">{tx('Kontakt & Anfahrt')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {(hasAddress || hasContact) && (
            <div>
              <h3 className="text-amber-400 font-semibold mb-3 uppercase tracking-wide text-sm">
                {tx('Kontakt')}
              </h3>
              {hasAddress && (
                <p className="text-stone-300 leading-loose">
                  {f.website_strasse && f.website_hausnummer
                    ? `${f.website_strasse} ${f.website_hausnummer}`
                    : f.website_strasse ?? ''}
                  {hasAddress && <br />}
                  {f.website_plz && f.website_ort ? `${f.website_plz} ${f.website_ort}` : ''}
                </p>
              )}
              {f.website_telefon && (
                <a
                  href={`tel:${f.website_telefon}`}
                  className="block text-stone-300 hover:text-amber-400 transition-colors mt-2"
                >
                  {f.website_telefon}
                </a>
              )}
              {f.website_email && (
                <a
                  href={`mailto:${f.website_email}`}
                  className="block text-stone-300 hover:text-amber-400 transition-colors mt-1 break-all"
                >
                  {f.website_email}
                </a>
              )}
            </div>
          )}
          {f.oeffnungszeiten && (
            <div>
              <h3 className="text-amber-400 font-semibold mb-3 uppercase tracking-wide text-sm">
                {tx('Öffnungszeiten')}
              </h3>
              <p className="text-stone-300 whitespace-pre-line leading-relaxed">
                {f.oeffnungszeiten}
              </p>
            </div>
          )}
          {hasSocial && (
            <div>
              <h3 className="text-amber-400 font-semibold mb-3 uppercase tracking-wide text-sm">
                {tx('Social Media')}
              </h3>
              <div className="flex flex-col gap-2">
                {f.instagram && (
                  <a
                    href={f.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-stone-300 hover:text-amber-400 transition-colors flex items-center gap-2"
                  >
                    <span>📸</span>
                    <span>{tx('Instagram')}</span>
                  </a>
                )}
                {f.facebook && (
                  <a
                    href={f.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-stone-300 hover:text-amber-400 transition-colors flex items-center gap-2"
                  >
                    <span>👍</span>
                    <span>{tx('Facebook')}</span>
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default function HundepensionWebsite() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [website, setWebsite] = useState<WebsiteRecord | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadPublicPagesConfig()
      .then(async c => {
        setCfg(c);
        const p = c?.pages['hundepension'] ?? null;
        setPage(p);

        if (c && p) {
          const websiteEp = p.endpoints?.find(e => e.op === 'list' && e.entity === 'website');
          if (websiteEp) {
            try {
              const records = await listPublicRecords(c, p, { appId: websiteEp.app_id, limit: 1 });
              const first = records[0] ?? null;
              setWebsite(first as WebsiteRecord | null);
            } catch {
              // Website data unavailable — page renders without it
            }
          }
        }
        setLoading(false);
      })
      .catch(err => {
        if (err instanceof PageUnavailableError) {
          setUnavailable(true);
        }
        setLoading(false);
      });
  }, []);

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSuccess = () => {
    setSubmitted(true);
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  if (loading || (!loading && !cfg && !unavailable)) {
    return <PublicShell loading={loading} />;
  }

  if (unavailable || !cfg || !page) {
    return <PublicShell unavailable />;
  }

  return (
    <PublicShell fullBleed>
      {/* Hero */}
      {website ? (
        <HeroSection website={website} onBuchungClick={scrollToForm} />
      ) : (
        <div className="min-h-[320px] flex flex-col items-center justify-center bg-gradient-to-br from-amber-800 to-amber-500 text-white text-center px-4 py-16">
          <h1 className="text-3xl md:text-5xl font-bold mb-3">{tx('Hundepension')}</h1>
          <p className="text-amber-200 text-lg mb-6">{tx('Ihr Zuhause auf Zeit')}</p>
          <button
            onClick={scrollToForm}
            className="bg-white text-amber-700 font-semibold px-8 py-3 rounded-full shadow hover:bg-amber-50 transition-colors text-lg"
          >
            {tx('Jetzt anfragen')}
          </button>
        </div>
      )}

      {/* Über uns */}
      {website && <UeberUnsSection website={website} />}

      {/* Leistungen */}
      {website && <LeistungenSection website={website} />}

      {/* Galerie */}
      {website && <GalerieSection website={website} />}

      {/* Buchungsanfrage */}
      <section className="py-14 bg-amber-50" ref={formRef}>
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-stone-800 mb-2">
            {tx('Buchungsanfrage')}
          </h2>
          <p className="text-stone-500 mb-8">
            {tx('Füll das Formular aus — wir melden uns so schnell wie möglich bei dir.')}
          </p>

          {submitted ? (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
              <div className="text-5xl mb-4">🐾</div>
              <h3 className="text-xl font-bold text-green-800 mb-2">
                {tx('Anfrage erfolgreich gesendet!')}
              </h3>
              <p className="text-green-700">
                {tx('Wir haben deine Anfrage erhalten und melden uns bald bei dir. Wir freuen uns auf deinen Hund!')}
              </p>
              <button
                onClick={() => setSubmitted(false)}
                className="mt-6 text-sm text-green-600 hover:underline"
              >
                {tx('Neue Anfrage stellen')}
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-stone-100 p-6 md:p-8">
              <BuchungsFormular cfg={cfg} page={page} onSuccess={handleSuccess} />
            </div>
          )}
        </div>
      </section>

      {/* Kontakt & Footer */}
      {website && <KontaktSection website={website} />}

      <div className="bg-stone-900 text-stone-500 text-center text-xs py-4 px-4">
        {website?.fields.unternehmensname
          ? tx`© ${website.fields.unternehmensname}`
          : tx('© Hundepension')}
      </div>
    </PublicShell>
  );
}
