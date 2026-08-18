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
import {
  IconPhone,
  IconMail,
  IconMapPin,
  IconClock,
  IconStar,
  IconPaw,
  IconChevronRight,
  IconBrandInstagram,
  IconBrandFacebook,
  IconCheck,
  IconX,
} from '@tabler/icons-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface WebsiteRecord {
  id: string;
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

interface FormData {
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

const EMPTY_FORM: FormData = {
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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Startseite() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const [website, setWebsite] = useState<WebsiteRecord | null>(null);
  const [galleryOpen, setGalleryOpen] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const formRef = useRef<HTMLDivElement>(null);
  const challengePrepared = useRef(false);

  // Load config + data
  useEffect(() => {
    loadPublicPagesConfig('hundepension')
      .then(async (c) => {
        setCfg(c);
        const p = c?.pages['hundepension'] ?? null;
        setPage(p);
        if (!p) { setUnavailable(true); setLoading(false); return; }

        const websiteEp = p.endpoints?.find((e) => e.op === 'list' && e.app_id);
        if (websiteEp) {
          const result = await listPublicRecords(c, p, { appId: websiteEp.app_id, limit: 1 });
          const entries = Object.values(result) as WebsiteRecord[];
          if (entries.length > 0) setWebsite(entries[0]);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof PageUnavailableError) setUnavailable(true);
        setLoading(false);
      });
  }, []);

  if (loading || unavailable || !cfg || !page) {
    return <PublicShell loading={loading} unavailable={!loading && unavailable} />;
  }

  const ws = website?.fields;
  const name = ws?.unternehmensname || tx('Unsere Hundepension');
  const slogan = ws?.slogan || tx('Ihr Zuhause für Ihren Hund');
  const beschreibung = ws?.beschreibung || tx('Wir kümmern uns liebevoll um Ihren Hund.');
  const createEp = page.endpoints?.find((e) => e.op === 'create');

  // ─── Helpers ─────────────────────────────────────────────────────────────

  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  function prepareIfNeeded() {
    if (!challengePrepared.current && createEp) {
      challengePrepared.current = true;
      prepareChallenge(cfg, page, 'POST', `/apps/${createEp.app_id}/records`);
    }
  }

  function updateField<K extends keyof FormData>(key: K, value: string) {
    prepareIfNeeded();
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((e) => ({ ...e, [key]: undefined }));
  }

  function validateStep(s: number): boolean {
    const errs: Partial<Record<keyof FormData, string>> = {};
    if (s === 1) {
      if (!form.anfrage_vorname.trim()) errs.anfrage_vorname = tx('Bitte Vorname angeben');
      if (!form.anfrage_nachname.trim()) errs.anfrage_nachname = tx('Bitte Nachname angeben');
      if (!form.anfrage_email.trim()) errs.anfrage_email = tx('Bitte E-Mail angeben');
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.anfrage_email))
        errs.anfrage_email = tx('Keine gültige E-Mail-Adresse');
    }
    if (s === 2) {
      if (!form.hund_name.trim()) errs.hund_name = tx('Bitte Namen des Hundes angeben');
    }
    if (s === 3) {
      if (!form.wunsch_anreise) errs.wunsch_anreise = tx('Bitte Anreisedatum wählen');
      if (!form.wunsch_abreise) errs.wunsch_abreise = tx('Bitte Abreisedatum wählen');
      if (form.wunsch_anreise && form.wunsch_abreise && form.wunsch_abreise <= form.wunsch_anreise)
        errs.wunsch_abreise = tx('Abreise muss nach der Anreise liegen');
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function nextStep() {
    if (validateStep(step)) setStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : s));
  }

  function prevStep() {
    setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s));
  }

  async function handleSubmit() {
    if (!validateStep(3) || !createEp) return;
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
      setSubmitError(tx('Es ist ein Fehler aufgetreten. Bitte versuche es erneut.'));
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Leistungen parsen ────────────────────────────────────────────────────
  const leistungenList = ws?.leistungen
    ? ws.leistungen.split('\n').map((l) => l.trim()).filter(Boolean)
    : [
        tx('Individuelle Betreuung'),
        tx('Tägliche Spaziergänge'),
        tx('Liebevolle Pflege'),
        tx('Regelmäßige Updates'),
      ];

  // ─── Render ───────────────────────────────────────────────────────────────
  const today = format(new Date(), 'yyyy-MM-dd');

  return (
    <PublicShell fullBleed>
      {/* ── Hero ── */}
      <section className="relative min-h-[420px] flex items-end overflow-hidden bg-amber-900">
        {ws?.titelbild && (
          <img
            src={ws.titelbild}
            alt={name}
            className="absolute inset-0 w-full h-full object-cover object-center opacity-50"
          />
        )}
        <div className="relative z-10 w-full bg-gradient-to-t from-black/70 via-black/30 to-transparent pt-24 pb-12 px-4">
          <div className="max-w-4xl mx-auto flex items-center gap-5">
            {ws?.logo && (
              <img
                src={ws.logo}
                alt={tx('Logo')}
                className="w-20 h-20 rounded-2xl object-contain bg-white/10 p-2 shrink-0 hidden sm:block"
              />
            )}
            <div>
              <h1 className="text-3xl sm:text-5xl font-bold text-white leading-tight">{name}</h1>
              {slogan && (
                <p className="mt-2 text-lg sm:text-xl text-amber-200 font-medium">{slogan}</p>
              )}
              {ws?.anzahl_plaetze && (
                <p className="mt-1 text-sm text-white/70">
                  {/* i18n-exempt: dynamic number + unit */}
                  {ws.anzahl_plaetze} {tx('Plätze für Ihren Liebling')}
                </p>
              )}
            </div>
          </div>
          <div className="max-w-4xl mx-auto mt-8 flex flex-wrap gap-3">
            <button
              onClick={scrollToForm}
              className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-semibold text-base transition-colors shrink-0"
            >
              {tx('Jetzt anfragen')} <IconChevronRight size={18} className="inline-block ml-1 shrink-0" />
            </button>
            {ws?.website_telefon && (
              <a
                href={`tel:${ws.website_telefon}`}
                className="px-5 py-3 rounded-xl bg-white/20 hover:bg-white/30 text-white font-medium text-base transition-colors flex items-center gap-2 shrink-0"
              >
                <IconPhone size={18} className="shrink-0" /> {ws.website_telefon}
              </a>
            )}
          </div>
        </div>
      </section>

      {/* ── Über uns ── */}
      <section className="bg-white py-14">
        <div className="max-w-4xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-10 items-start">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">{tx('Über uns')}</h2>
              <p className="text-gray-700 leading-relaxed whitespace-pre-line">{beschreibung}</p>
            </div>
            <div className="space-y-4">
              {ws?.oeffnungszeiten && (
                <div className="flex gap-3 p-4 rounded-xl bg-amber-50 border border-amber-100">
                  <IconClock size={22} className="shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-900 mb-1">{tx('Öffnungszeiten')}</p>
                    <p className="text-gray-700 text-sm whitespace-pre-line">{ws.oeffnungszeiten}</p>
                  </div>
                </div>
              )}
              {(ws?.website_strasse || ws?.website_ort) && (
                <div className="flex gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <IconMapPin size={22} className="shrink-0 text-gray-500 mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-900 mb-1">{tx('Adresse')}</p>
                    <p className="text-gray-700 text-sm">
                      {[ws.website_strasse, ws.website_hausnummer].filter(Boolean).join(' ')}
                      {(ws.website_plz || ws.website_ort) && (
                        <>
                          <br />
                          {[ws.website_plz, ws.website_ort].filter(Boolean).join(' ')}
                        </>
                      )}
                    </p>
                  </div>
                </div>
              )}
              {ws?.website_email && (
                <div className="flex gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
                  <IconMail size={22} className="shrink-0 text-gray-500 mt-0.5" />
                  <div>
                    <p className="font-semibold text-gray-900 mb-1">{tx('E-Mail')}</p>
                    <a href={`mailto:${ws.website_email}`} className="text-amber-700 text-sm hover:underline">
                      {ws.website_email}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Leistungen ── */}
      <section className="bg-amber-50 py-14">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">{tx('Unsere Leistungen')}</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {leistungenList.map((leistung, i) => (
              <div key={i} className="flex items-start gap-3 bg-white rounded-xl p-4 shadow-sm border border-amber-100">
                <div className="mt-0.5 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center shrink-0">
                  <IconPaw size={14} className="text-white" />
                </div>
                <p className="text-gray-800 text-sm leading-snug">{leistung}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Galerie ── */}
      {ws?.galerie_bilder && (
        <section className="bg-white py-14">
          <div className="max-w-4xl mx-auto px-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">{tx('Impressionen')}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {/* galerie_bilder is a single file field — show as one image */}
              <button
                onClick={() => setGalleryOpen(ws.galerie_bilder!)}
                className="aspect-square rounded-xl overflow-hidden bg-gray-100"
              >
                <img
                  src={ws.galerie_bilder}
                  alt={tx('Galeriebild')}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── Galerie Lightbox ── */}
      {galleryOpen && (
        <div
          className="fixed inset-0 z-[var(--z-overlay)] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setGalleryOpen(null)}
        >
          <button
            onClick={() => setGalleryOpen(null)}
            className="absolute top-4 right-4 text-white p-2 rounded-full bg-white/20 hover:bg-white/30"
          >
            <IconX size={24} />
          </button>
          <img
            src={galleryOpen}
            alt={tx('Galeriebild')}
            className="max-w-full max-h-full object-contain rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* ── Social ── */}
      {(ws?.instagram || ws?.facebook) && (
        <section className="bg-amber-800 py-8">
          <div className="max-w-4xl mx-auto px-4 flex flex-wrap gap-4 justify-center items-center">
            <p className="text-amber-200 font-medium">{tx('Folge uns auf Social Media')}</p>
            {ws.instagram && (
              <a
                href={ws.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-colors text-sm font-medium"
              >
                <IconBrandInstagram size={18} className="shrink-0" /> Instagram
              </a>
            )}
            {ws.facebook && (
              <a
                href={ws.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-colors text-sm font-medium"
              >
                <IconBrandFacebook size={18} className="shrink-0" /> Facebook
              </a>
            )}
          </div>
        </section>
      )}

      {/* ── Buchungsanfrage ── */}
      <section className="bg-gray-50 py-14" ref={formRef}>
        <div className="max-w-2xl mx-auto px-4">
          <div className="text-center mb-8">
            <IconStar size={32} className="text-amber-500 mx-auto mb-3" />
            <h2 className="text-2xl font-bold text-gray-900">{tx('Buchungsanfrage stellen')}</h2>
            <p className="text-gray-600 mt-2 text-sm">
              {tx('Wir melden uns innerhalb von 24 Stunden bei Ihnen.')}
            </p>
          </div>

          {submitted ? (
            /* ── Erfolg ── */
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <IconCheck size={32} className="text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{tx('Anfrage eingegangen!')}</h3>
              <p className="text-gray-600 text-sm">
                {tx('Vielen Dank! Wir haben Ihre Buchungsanfrage erhalten und melden uns bald bei Ihnen.')}
              </p>
              <button
                onClick={() => { setSubmitted(false); setForm(EMPTY_FORM); setStep(1); }}
                className="mt-6 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-medium text-sm transition-colors"
              >
                {tx('Neue Anfrage stellen')}
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              {/* Step indicator */}
              <div className="flex border-b border-gray-100">
                {([1, 2, 3] as const).map((s) => (
                  <div
                    key={s}
                    className={`flex-1 py-3 text-center text-xs font-semibold border-b-2 transition-colors ${
                      step === s
                        ? 'border-amber-500 text-amber-700'
                        : step > s
                        ? 'border-green-400 text-green-600'
                        : 'border-transparent text-gray-400'
                    }`}
                  >
                    {step > s ? <IconCheck size={14} className="inline-block mr-1 shrink-0" /> : null}
                    {s === 1 ? tx('Kontaktdaten') : s === 2 ? tx('Hund') : tx('Zeitraum')}
                  </div>
                ))}
              </div>

              <div className="p-6 space-y-4">
                {/* ── Step 1: Kontaktdaten ── */}
                {step === 1 && (
                  <>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <FormField
                        label={tx('Vorname')}
                        required
                        error={fieldErrors.anfrage_vorname}
                      >
                        <input
                          type="text"
                          value={form.anfrage_vorname}
                          onChange={(e) => updateField('anfrage_vorname', e.target.value)}
                          placeholder={tx('Max')}
                          className={inputCls(!!fieldErrors.anfrage_vorname)}
                        />
                      </FormField>
                      <FormField
                        label={tx('Nachname')}
                        required
                        error={fieldErrors.anfrage_nachname}
                      >
                        <input
                          type="text"
                          value={form.anfrage_nachname}
                          onChange={(e) => updateField('anfrage_nachname', e.target.value)}
                          placeholder={tx('Mustermann')}
                          className={inputCls(!!fieldErrors.anfrage_nachname)}
                        />
                      </FormField>
                    </div>
                    <FormField
                      label={tx('E-Mail-Adresse')}
                      required
                      error={fieldErrors.anfrage_email}
                    >
                      <input
                        type="email"
                        value={form.anfrage_email}
                        onChange={(e) => updateField('anfrage_email', e.target.value)}
                        placeholder="max@beispiel.de" /* i18n-exempt: email placeholder */
                        className={inputCls(!!fieldErrors.anfrage_email)}
                      />
                    </FormField>
                    <FormField label={tx('Telefonnummer')} error={fieldErrors.anfrage_telefon}>
                      <input
                        type="tel"
                        value={form.anfrage_telefon}
                        onChange={(e) => updateField('anfrage_telefon', e.target.value)}
                        placeholder={tx('+49 123 456789')}
                        className={inputCls(!!fieldErrors.anfrage_telefon)}
                      />
                    </FormField>
                  </>
                )}

                {/* ── Step 2: Hund ── */}
                {step === 2 && (
                  <>
                    <FormField
                      label={tx('Name des Hundes')}
                      required
                      error={fieldErrors.hund_name}
                    >
                      <input
                        type="text"
                        value={form.hund_name}
                        onChange={(e) => updateField('hund_name', e.target.value)}
                        placeholder={tx('Bello')}
                        className={inputCls(!!fieldErrors.hund_name)}
                      />
                    </FormField>
                    <FormField label={tx('Rasse')} error={fieldErrors.hund_rasse}>
                      <input
                        type="text"
                        value={form.hund_rasse}
                        onChange={(e) => updateField('hund_rasse', e.target.value)}
                        placeholder={tx('z. B. Labrador')}
                        className={inputCls(false)}
                      />
                    </FormField>
                    <FormField label={tx('Größe des Hundes')} error={fieldErrors.hund_groesse}>
                      <div className="grid grid-cols-3 gap-2">
                        {([
                          { key: 'klein', label: tx('Klein') + '\n(bis 10 kg)' },
                          { key: 'mittel', label: tx('Mittel') + '\n(10–25 kg)' },
                          { key: 'gross', label: tx('Groß') + '\n(über 25 kg)' },
                        ] as const).map((opt) => (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => updateField('hund_groesse', opt.key)}
                            className={`py-3 px-2 rounded-xl border-2 text-xs font-medium text-center transition-colors whitespace-pre-line leading-snug ${
                              form.hund_groesse === opt.key
                                ? 'border-amber-500 bg-amber-50 text-amber-800'
                                : 'border-gray-200 text-gray-600 hover:border-amber-300'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </FormField>
                  </>
                )}

                {/* ── Step 3: Zeitraum ── */}
                {step === 3 && (
                  <>
                    <FormField
                      label={tx('Gewünschte Anreise')}
                      required
                      error={fieldErrors.wunsch_anreise}
                    >
                      <input
                        type="date"
                        value={form.wunsch_anreise}
                        min={today}
                        onChange={(e) => updateField('wunsch_anreise', e.target.value)}
                        className={inputCls(!!fieldErrors.wunsch_anreise)}
                      />
                    </FormField>
                    <FormField
                      label={tx('Gewünschte Abreise')}
                      required
                      error={fieldErrors.wunsch_abreise}
                    >
                      <input
                        type="date"
                        value={form.wunsch_abreise}
                        min={form.wunsch_anreise || today}
                        onChange={(e) => updateField('wunsch_abreise', e.target.value)}
                        className={inputCls(!!fieldErrors.wunsch_abreise)}
                      />
                    </FormField>
                    <FormField label={tx('Nachricht / Besondere Wünsche')} error={fieldErrors.nachricht}>
                      <textarea
                        value={form.nachricht}
                        onChange={(e) => updateField('nachricht', e.target.value)}
                        rows={4}
                        placeholder={tx('Besonderheiten, Medikamente, spezielle Wünsche ...')}
                        className={inputCls(false) + ' resize-none'}
                      />
                    </FormField>

                    {submitError && (
                      <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-red-700 text-sm">
                        {submitError}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Navigation */}
              <div className="flex justify-between items-center px-6 pb-6 gap-3">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={prevStep}
                    className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
                  >
                    {tx('Zurück')}
                  </button>
                ) : (
                  <span />
                )}
                {step < 3 ? (
                  <button
                    type="button"
                    onClick={nextStep}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-semibold text-sm transition-colors flex items-center gap-2"
                  >
                    {tx('Weiter')} <IconChevronRight size={16} className="shrink-0" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-semibold text-sm transition-colors flex items-center gap-2"
                  >
                    {submitting ? tx('Wird gesendet …') : tx('Anfrage absenden')}
                    {!submitting && <IconCheck size={16} className="shrink-0" />}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-gray-900 py-8 text-center text-gray-400 text-sm px-4">
        <p className="font-semibold text-white mb-1">{name}</p>
        {(ws?.website_strasse || ws?.website_ort) && (
          <p className="text-gray-400 text-xs">
            {[ws.website_strasse, ws.website_hausnummer, ws.website_plz, ws.website_ort]
              .filter(Boolean)
              .join(', ')}
          </p>
        )}
        <div className="flex flex-wrap justify-center gap-4 mt-3 text-xs">
          {ws?.website_telefon && (
            <a href={`tel:${ws.website_telefon}`} className="hover:text-white transition-colors flex items-center gap-1">
              <IconPhone size={12} className="shrink-0" /> {ws.website_telefon}
            </a>
          )}
          {ws?.website_email && (
            <a href={`mailto:${ws.website_email}`} className="hover:text-white transition-colors flex items-center gap-1">
              <IconMail size={12} className="shrink-0" /> {ws.website_email}
            </a>
          )}
        </div>
      </footer>
    </PublicShell>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function inputCls(hasError: boolean) {
  return [
    'w-full rounded-xl border px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 transition-colors',
    hasError
      ? 'border-red-300 bg-red-50 focus:ring-red-300'
      : 'border-gray-200 bg-gray-50 focus:ring-amber-400 focus:border-amber-400',
  ].join(' ');
}

function FormField({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
