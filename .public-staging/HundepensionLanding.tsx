import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
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
import {
  IconPhone,
  IconMail,
  IconMapPin,
  IconClock,
  IconBrandInstagram,
  IconBrandFacebook,
  IconPaw,
  IconHeart,
  IconStar,
  IconCheck,
  IconChevronDown,
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
  website_url?: string;
  website_strasse?: string;
  website_hausnummer?: string;
  website_plz?: string;
  website_ort?: string;
  instagram?: string;
  facebook?: string;
}

interface FormState {
  anfrage_vorname: string;
  anfrage_nachname: string;
  anfrage_telefon: string;
  anfrage_email: string;
  hund_name: string;
  hund_rasse: string;
  hund_groesse: string;
  wunsch_anreise: string;
  wunsch_abreise: string;
  nachricht: string;
}

const EMPTY_FORM: FormState = {
  anfrage_vorname: '',
  anfrage_nachname: '',
  anfrage_telefon: '',
  anfrage_email: '',
  hund_name: '',
  hund_rasse: '',
  hund_groesse: '',
  wunsch_anreise: '',
  wunsch_abreise: '',
  nachricht: '',
};

export default function HundepensionLanding() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const [website, setWebsite] = useState<WebsiteFields | null>(null);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  const formRef = useRef<HTMLDivElement>(null);
  const challengePrepared = useRef(false);

  useEffect(() => {
    loadPublicPagesConfig()
      .then((c) => {
        setCfg(c);
        setPage(c?.pages['hundepension'] ?? null);
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof PageUnavailableError) {
          setUnavailable(true);
        }
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!cfg || !page) return;
    const ep = page.endpoints?.find((e) => e.op === 'list' && e.entity === 'website');
    if (!ep) {
      setWebsiteLoading(false);
      return;
    }
    listPublicRecords(cfg, page, { appId: ep.app_id, limit: 1 })
      .then((records) => {
        const first = records[0];
        if (first) {
          setWebsite(first.fields as WebsiteFields);
        }
      })
      .catch(() => {
        // website bleibt null → Placeholder-Text wird angezeigt
      });
  }, [cfg, page]);

  // All hooks before any early return
  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const prepareIfNeeded = () => {
    if (!cfg || !page || challengePrepared.current) return;
    const ep = page.endpoints?.find((e) => e.op === 'create');
    if (ep) {
      challengePrepared.current = true;
      prepareChallenge(cfg, page, 'POST', `/apps/${ep.app_id}/records`);
    }
  };

  const validate = (): boolean => {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.anfrage_vorname.trim()) errs.anfrage_vorname = tx('Pflichtfeld');
    if (!form.anfrage_nachname.trim()) errs.anfrage_nachname = tx('Pflichtfeld');
    if (!form.anfrage_email.trim()) errs.anfrage_email = tx('Pflichtfeld');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.anfrage_email))
      errs.anfrage_email = tx('Ungültige E-Mail-Adresse');
    if (!form.hund_name.trim()) errs.hund_name = tx('Pflichtfeld');
    if (!form.wunsch_anreise) errs.wunsch_anreise = tx('Pflichtfeld');
    if (!form.wunsch_abreise) errs.wunsch_abreise = tx('Pflichtfeld');
    else if (form.wunsch_anreise && form.wunsch_abreise <= form.wunsch_anreise)
      errs.wunsch_abreise = tx('Abreise muss nach Anreise liegen');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (!cfg || !page) return;

    const ep = page.endpoints?.find((e2) => e2.op === 'create');
    if (!ep) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const payload: Record<string, string> = {
        anfrage_vorname: form.anfrage_vorname.trim(),
        anfrage_nachname: form.anfrage_nachname.trim(),
        anfrage_email: form.anfrage_email.trim(),
        hund_name: form.hund_name.trim(),
        wunsch_anreise: form.wunsch_anreise,
        wunsch_abreise: form.wunsch_abreise,
      };
      if (form.anfrage_telefon.trim()) payload.anfrage_telefon = form.anfrage_telefon.trim();
      if (form.hund_rasse.trim()) payload.hund_rasse = form.hund_rasse.trim();
      if (form.hund_groesse) payload.hund_groesse = form.hund_groesse;
      if (form.nachricht.trim()) payload.nachricht = form.nachricht.trim();

      await createPublicRecord(cfg, page, payload);
      setSubmitted(true);
    } catch {
      setSubmitError(tx('Leider ist ein Fehler aufgetreten. Bitte versuche es erneut.'));
    } finally {
      setSubmitting(false);
    }
  };

  const setField = (key: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
    prepareIfNeeded();
  };

  if (loading) {
    return <PublicShell loading />;
  }

  if (unavailable || !cfg || !page) {
    return <PublicShell unavailable />;
  }

  // Placeholder-Werte wenn keine Website-Daten vorhanden
  const name = website?.unternehmensname ?? tx('Ihre Hundepension');
  const slogan = website?.slogan ?? tx('Liebevolle Betreuung für Ihren Vierbeiner');
  const beschreibung = website?.beschreibung ?? tx('Wir kümmern uns mit Herz und Fachwissen um Ihren Hund – damit Sie entspannt in den Urlaub fahren können.');
  const leistungen = website?.leistungen;
  const plaetze = website?.anzahl_plaetze;
  const oeffnungszeiten = website?.oeffnungszeiten;
  const tel = website?.website_telefon;
  const email = website?.website_email;
  const strasse = website?.website_strasse;
  const hausnummer = website?.website_hausnummer;
  const plz = website?.website_plz;
  const ort = website?.website_ort;
  const instagram = website?.instagram;
  const facebook = website?.facebook;

  const hasAddress = strasse || ort;

  const leistungLines: string[] = leistungen
    ? leistungen.split('\n').map((l) => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean)
    : [
        tx('Liebevolle Einzelbetreuung'),
        tx('Tägliche Spaziergänge und Freilauf'),
        tx('Veterinär-Notfallkontakt'),
        tx('Regelmäßige Updates und Fotos'),
      ];

  const today = format(new Date(), 'yyyy-MM-dd');

  return (
    <PublicShell fullBleed>
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 border-b border-amber-200">
        <div className="max-w-5xl mx-auto px-4 py-16 sm:py-24 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-amber-500 flex items-center justify-center shadow-lg">
              <IconPaw size={40} className="text-white" stroke={1.5} />
            </div>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4 leading-tight">
            {name}
          </h1>
          <p className="text-xl sm:text-2xl text-amber-700 font-medium mb-6">
            {slogan}
          </p>
          <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto mb-8 leading-relaxed whitespace-pre-line">
            {beschreibung}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={scrollToForm}
              className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl shadow-md transition-colors"
            >
              <IconHeart size={18} className="shrink-0" />
              {tx('Jetzt Buchungsanfrage stellen')}
            </button>
            {tel && (
              <a
                href={`tel:${tel}`}
                className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-xl shadow border border-gray-200 transition-colors"
              >
                <IconPhone size={18} className="shrink-0" />
                {tel}
              </a>
            )}
          </div>
          <button onClick={scrollToForm} className="mt-8 flex flex-col items-center gap-1 mx-auto text-amber-600 hover:text-amber-700 transition-colors">
            <span className="text-sm">{tx('Mehr erfahren')}</span>
            <IconChevronDown size={20} className="animate-bounce" />
          </button>
        </div>
      </div>

      {/* Leistungen & Info */}
      <div className="max-w-5xl mx-auto px-4 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {/* Leistungen */}
          <div>
            <div className="flex items-center gap-2 mb-5">
              <IconStar size={22} className="text-amber-500 shrink-0" />
              <h2 className="text-2xl font-bold text-gray-900">{tx('Unsere Leistungen')}</h2>
            </div>
            <ul className="space-y-3">
              {leistungLines.map((l, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-1 w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                    <IconCheck size={12} className="text-amber-600" />
                  </span>
                  <span className="text-gray-700 leading-snug">{l}</span>
                </li>
              ))}
            </ul>
            {plaetze != null && (
              <div className="mt-6 inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <IconPaw size={18} className="text-amber-500 shrink-0" />
                <span className="text-amber-800 font-medium">
                  {tx(`${plaetze} Plätze verfügbar`)}
                </span>
              </div>
            )}
          </div>

          {/* Kontakt & Öffnungszeiten */}
          <div className="space-y-6">
            {oeffnungszeiten && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <IconClock size={20} className="text-amber-500 shrink-0" />
                  <h3 className="text-lg font-semibold text-gray-900">{tx('Öffnungszeiten')}</h3>
                </div>
                <p className="text-gray-600 whitespace-pre-line leading-relaxed pl-7">
                  {oeffnungszeiten}
                </p>
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 mb-3">
                <IconMapPin size={20} className="text-amber-500 shrink-0" />
                <h3 className="text-lg font-semibold text-gray-900">{tx('Kontakt & Adresse')}</h3>
              </div>
              <div className="pl-7 space-y-2">
                {hasAddress && (
                  <p className="text-gray-600">
                    {strasse && hausnummer ? `${strasse} ${hausnummer}` : strasse}
                    {(strasse || hausnummer) && (plz || ort) && <br />}
                    {plz && ort ? `${plz} ${ort}` : plz ?? ort}
                  </p>
                )}
                {tel && (
                  <a
                    href={`tel:${tel}`}
                    className="flex items-center gap-2 text-amber-600 hover:text-amber-700 transition-colors"
                  >
                    <IconPhone size={16} className="shrink-0" />
                    {tel}
                  </a>
                )}
                {email && (
                  <a
                    href={`mailto:${email}`}
                    className="flex items-center gap-2 text-amber-600 hover:text-amber-700 transition-colors"
                  >
                    <IconMail size={16} className="shrink-0" />
                    {email}
                  </a>
                )}
              </div>
            </div>

            {(instagram || facebook) && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">{tx('Social Media')}</h3>
                <div className="flex gap-3 flex-wrap">
                  {instagram && (
                    <a
                      href={instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                      <IconBrandInstagram size={16} className="shrink-0" />
                      Instagram
                    </a>
                  )}
                  {facebook && (
                    <a
                      href={facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                    >
                      <IconBrandFacebook size={16} className="shrink-0" />
                      Facebook
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Buchungsanfrage-Formular */}
      <div
        ref={formRef}
        className="bg-gradient-to-br from-gray-50 to-amber-50 border-t border-gray-200"
      >
        <div className="max-w-2xl mx-auto px-4 py-14">
          <div className="text-center mb-10">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full bg-amber-500 flex items-center justify-center">
                <IconHeart size={28} className="text-white" stroke={1.5} />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              {tx('Buchungsanfrage')}
            </h2>
            <p className="text-gray-500">
              {tx('Füllen Sie das Formular aus – wir melden uns schnellstmöglich bei Ihnen.')}
            </p>
          </div>

          {submitted ? (
            <div className="bg-white rounded-2xl shadow border border-green-100 p-8 text-center">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <IconCheck size={32} className="text-green-600" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {tx('Anfrage erfolgreich gesendet!')}
              </h3>
              <p className="text-gray-600">
                {tx('Vielen Dank für Ihre Anfrage. Wir werden uns bald bei Ihnen melden.')}
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              noValidate
              className="bg-white rounded-2xl shadow border border-gray-100 p-6 sm:p-8 space-y-6"
            >
              {/* Besitzer */}
              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
                  {tx('Ihre Kontaktdaten')}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {tx('Vorname')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.anfrage_vorname}
                      onChange={(e) => setField('anfrage_vorname', e.target.value)}
                      onFocus={prepareIfNeeded}
                      className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition ${errors.anfrage_vorname ? 'border-red-400' : 'border-gray-300'}`}
                      placeholder={tx('Max')}
                    />
                    {errors.anfrage_vorname && (
                      <p className="mt-1 text-xs text-red-500">{errors.anfrage_vorname}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {tx('Nachname')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.anfrage_nachname}
                      onChange={(e) => setField('anfrage_nachname', e.target.value)}
                      onFocus={prepareIfNeeded}
                      className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition ${errors.anfrage_nachname ? 'border-red-400' : 'border-gray-300'}`}
                      placeholder={tx('Mustermann')}
                    />
                    {errors.anfrage_nachname && (
                      <p className="mt-1 text-xs text-red-500">{errors.anfrage_nachname}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {tx('E-Mail')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={form.anfrage_email}
                      onChange={(e) => setField('anfrage_email', e.target.value)}
                      onFocus={prepareIfNeeded}
                      className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition ${errors.anfrage_email ? 'border-red-400' : 'border-gray-300'}`}
                      placeholder="max@beispiel.de"
                    />
                    {errors.anfrage_email && (
                      <p className="mt-1 text-xs text-red-500">{errors.anfrage_email}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {tx('Telefon')}
                    </label>
                    <input
                      type="tel"
                      value={form.anfrage_telefon}
                      onChange={(e) => setField('anfrage_telefon', e.target.value)}
                      onFocus={prepareIfNeeded}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition"
                      placeholder="+49 123 456789"
                    />
                  </div>
                </div>
              </div>

              {/* Hund */}
              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
                  {tx('Angaben zum Hund')}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {tx('Name des Hundes')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.hund_name}
                      onChange={(e) => setField('hund_name', e.target.value)}
                      onFocus={prepareIfNeeded}
                      className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition ${errors.hund_name ? 'border-red-400' : 'border-gray-300'}`}
                      placeholder={tx('Bello')}
                    />
                    {errors.hund_name && (
                      <p className="mt-1 text-xs text-red-500">{errors.hund_name}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {tx('Rasse')}
                    </label>
                    <input
                      type="text"
                      value={form.hund_rasse}
                      onChange={(e) => setField('hund_rasse', e.target.value)}
                      onFocus={prepareIfNeeded}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition"
                      placeholder={tx('z. B. Labrador')}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {tx('Größe des Hundes')}
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {[
                        { key: 'klein', label: tx('Klein (bis 10 kg)') },
                        { key: 'mittel', label: tx('Mittel (10–25 kg)') },
                        { key: 'gross', label: tx('Groß (über 25 kg)') },
                      ].map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setField('hund_groesse', opt.key)}
                          onFocus={prepareIfNeeded}
                          className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                            form.hund_groesse === opt.key
                              ? 'bg-amber-500 border-amber-500 text-white'
                              : 'bg-white border-gray-300 text-gray-700 hover:border-amber-400'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Zeitraum */}
              <div>
                <h3 className="text-base font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-100">
                  {tx('Gewünschter Zeitraum')}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {tx('Anreise')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={form.wunsch_anreise}
                      min={today}
                      onChange={(e) => setField('wunsch_anreise', e.target.value)}
                      onFocus={prepareIfNeeded}
                      className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition ${errors.wunsch_anreise ? 'border-red-400' : 'border-gray-300'}`}
                    />
                    {errors.wunsch_anreise && (
                      <p className="mt-1 text-xs text-red-500">{errors.wunsch_anreise}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {tx('Abreise')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={form.wunsch_abreise}
                      min={form.wunsch_anreise || today}
                      onChange={(e) => setField('wunsch_abreise', e.target.value)}
                      onFocus={prepareIfNeeded}
                      className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition ${errors.wunsch_abreise ? 'border-red-400' : 'border-gray-300'}`}
                    />
                    {errors.wunsch_abreise && (
                      <p className="mt-1 text-xs text-red-500">{errors.wunsch_abreise}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Nachricht */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {tx('Nachricht / Besondere Wünsche')}
                </label>
                <textarea
                  rows={4}
                  value={form.nachricht}
                  onChange={(e) => setField('nachricht', e.target.value)}
                  onFocus={prepareIfNeeded}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 transition resize-none"
                  placeholder={tx('Allergien, Medikamente, Besonderheiten …')}
                />
              </div>

              {submitError && (
                <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                  {submitError}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-semibold rounded-xl shadow transition-colors"
              >
                {submitting ? (
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <IconPaw size={18} className="shrink-0" />
                )}
                {submitting ? tx('Wird gesendet …') : tx('Anfrage absenden')}
              </button>

              <p className="text-xs text-gray-400 text-center">
                {tx('Mit dem Absenden stimmen Sie zu, dass Ihre Daten zur Bearbeitung der Anfrage gespeichert werden.')}
              </p>
            </form>
          )}
        </div>
      </div>
    </PublicShell>
  );
}
