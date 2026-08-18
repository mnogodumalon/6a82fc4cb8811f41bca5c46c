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
import { IconPhone, IconMail, IconMapPin, IconClock, IconBrandInstagram, IconBrandFacebook, IconPaw, IconSend, IconCheck } from '@tabler/icons-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

interface FormState {
  anfrage_vorname: string;
  anfrage_nachname: string;
  anfrage_email: string;
  anfrage_telefon: string;
  hund_name: string;
  hund_rasse: string;
  hund_groesse: string;
  wunsch_anreise: string;
  wunsch_abreise: string;
  nachricht: string;
}

// ---------------------------------------------------------------------------
// Helper: split textarea lines into bullet list
// ---------------------------------------------------------------------------
function LinesToBullets({ text, className }: { text: string; className?: string }) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  return (
    <ul className={`space-y-2 ${className ?? ''}`}>
      {lines.map((line, i) => (
        <li key={i} className="flex items-start gap-2">
          <IconPaw size={16} className="shrink-0 mt-0.5 text-amber-600" />
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------
export default function HundepensionWebsite() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [website, setWebsite] = useState<WebsiteRecord | null>(null);

  const [form, setForm] = useState<FormState>({
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
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [challengeReady, setChallengeReady] = useState(false);

  const anfrageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadPublicPagesConfig('hundepension').then(async c => {
      setCfg(c);
      const p = c?.pages['hundepension'] ?? null;
      setPage(p);

      if (c && p) {
        try {
          const websiteEp = p.endpoints?.find(e => e.op === 'list' && e.entity === 'website');
          if (websiteEp) {
            const records = await listPublicRecords(c, p, { appId: websiteEp.app_id, limit: 1 });
            const first = records[0] as WebsiteRecord | undefined;
            if (first) setWebsite(first);
          }
        } catch {
          // no website record — page still shows fallback design
        }
      }
      setLoading(false);
    });
  }, []);

  // Pre-warm challenge on first form interaction
  const handleFormFocus = () => {
    if (challengeReady || !cfg || !page) return;
    const createEp = page.endpoints?.find(e => e.op === 'create' && e.entity === 'buchungsanfragen');
    if (createEp) {
      prepareChallenge(cfg, page, 'POST', `/apps/${createEp.app_id}/records`).then(() =>
        setChallengeReady(true)
      );
    }
  };

  const scrollToAnfrage = () => {
    anfrageRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const validate = (): boolean => {
    const errors: Partial<Record<keyof FormState, string>> = {};
    if (!form.anfrage_vorname.trim()) errors.anfrage_vorname = tx('Pflichtfeld');
    if (!form.anfrage_nachname.trim()) errors.anfrage_nachname = tx('Pflichtfeld');
    if (!form.anfrage_email.trim()) errors.anfrage_email = tx('Pflichtfeld');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.anfrage_email)) errors.anfrage_email = tx('Ungültige E-Mail-Adresse');
    if (!form.hund_name.trim()) errors.hund_name = tx('Pflichtfeld');
    if (!form.wunsch_anreise) errors.wunsch_anreise = tx('Pflichtfeld');
    if (!form.wunsch_abreise) errors.wunsch_abreise = tx('Pflichtfeld');
    if (form.wunsch_anreise && form.wunsch_abreise && form.wunsch_abreise <= form.wunsch_anreise) {
      errors.wunsch_abreise = tx('Abreise muss nach der Anreise liegen');
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cfg || !page) return;
    if (!validate()) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const payload: Record<string, unknown> = {
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

      await createPublicRecord(cfg, page, payload);
      setSubmitted(true);
    } catch (err) {
      if (err instanceof PageUnavailableError) {
        setSubmitError(tx('Diese Seite ist momentan nicht verfügbar. Bitte versuche es später erneut.'));
      } else {
        setSubmitError(tx('Deine Anfrage konnte nicht gesendet werden. Bitte versuche es erneut oder kontaktiere uns direkt.'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Shell states
  // -------------------------------------------------------------------------
  if (loading) return <PublicShell loading />;
  if (!cfg || !page) return <PublicShell unavailable />;

  const w = website?.fields;
  const name = w?.unternehmensname ?? tx('Hundepension');
  const today = format(new Date(), 'yyyy-MM-dd');

  // -------------------------------------------------------------------------
  // Gallery images (file field can be single URL or comma-separated)
  // -------------------------------------------------------------------------
  const galleryUrls: string[] = w?.galerie_bilder
    ? w.galerie_bilder.split(',').map(u => u.trim()).filter(Boolean)
    : [];

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <PublicShell fullBleed>
      {/* ===== HERO ===== */}
      <section
        className="relative min-h-[480px] md:min-h-[560px] flex items-center justify-center overflow-hidden"
        style={
          w?.titelbild
            ? { backgroundImage: `url(${w.titelbild})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : undefined
        }
      >
        {/* Overlay */}
        <div className={`absolute inset-0 ${w?.titelbild ? 'bg-black/50' : 'bg-gradient-to-br from-amber-800 to-amber-600'}`} />

        <div className="relative z-10 text-center px-4 max-w-3xl mx-auto">
          {w?.logo && (
            <img
              src={w.logo}
              alt={name}
              className="h-20 w-auto mx-auto mb-4 object-contain drop-shadow-lg"
            />
          )}
          <h1 className="text-3xl sm:text-5xl font-bold text-white drop-shadow-lg mb-3">
            {name}
          </h1>
          {w?.slogan && (
            <p className="text-lg sm:text-2xl text-white/90 drop-shadow mb-6">
              {w.slogan}
            </p>
          )}
          <button
            type="button"
            onClick={scrollToAnfrage}
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white font-semibold px-7 py-3 rounded-full text-lg shadow-lg transition-colors"
          >
            <IconPaw size={20} />
            {tx('Anfrage stellen')}
          </button>
        </div>
      </section>

      {/* ===== ÜBER UNS ===== */}
      <section className="py-14 bg-background">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <h2 className="text-2xl font-semibold mb-4">{tx('Über uns')}</h2>
              {w?.beschreibung ? (
                <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                  {w.beschreibung}
                </p>
              ) : (
                <p className="text-muted-foreground">{tx('Ihre liebevolle Unterkunft für Hunde.')}</p>
              )}
            </div>
            <div className="flex justify-center md:justify-end">
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center shadow-sm">
                <div className="text-5xl font-bold text-amber-600 mb-1">
                  {w?.anzahl_plaetze ?? '—'}
                </div>
                <div className="text-sm text-muted-foreground uppercase tracking-wide">
                  {tx('Plätze')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== LEISTUNGEN ===== */}
      {w?.leistungen && (
        <section className="py-14 bg-amber-50">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-2xl font-semibold mb-6 text-center">{tx('Unsere Leistungen')}</h2>
            <div className="max-w-xl mx-auto">
              <LinesToBullets text={w.leistungen} className="text-base text-foreground" />
            </div>
          </div>
        </section>
      )}

      {/* ===== GALERIE ===== */}
      {galleryUrls.length > 0 && (
        <section className="py-14 bg-background">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-2xl font-semibold mb-6 text-center">{tx('Galerie')}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {galleryUrls.map((url, i) => (
                <div key={i} className="aspect-square overflow-hidden rounded-xl bg-muted">
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

      {/* ===== KONTAKT ===== */}
      <section className="py-14 bg-muted/40">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-2xl font-semibold mb-8 text-center">{tx('Kontakt & Öffnungszeiten')}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Adresse */}
            {(w?.website_strasse || w?.website_ort) && (
              <div className="bg-background rounded-2xl p-5 shadow-sm flex gap-3">
                <IconMapPin size={20} className="shrink-0 text-amber-600 mt-0.5" />
                <div className="text-sm leading-relaxed">
                  {w?.website_strasse && (
                    <div>{w.website_strasse} {w?.website_hausnummer}</div>
                  )}
                  {(w?.website_plz || w?.website_ort) && (
                    <div>{w?.website_plz} {w?.website_ort}</div>
                  )}
                </div>
              </div>
            )}
            {/* Telefon */}
            {w?.website_telefon && (
              <div className="bg-background rounded-2xl p-5 shadow-sm flex gap-3 items-center">
                <IconPhone size={20} className="shrink-0 text-amber-600" />
                <a href={`tel:${w.website_telefon}`} className="text-sm hover:underline">
                  {w.website_telefon}
                </a>
              </div>
            )}
            {/* E-Mail */}
            {w?.website_email && (
              <div className="bg-background rounded-2xl p-5 shadow-sm flex gap-3 items-center">
                <IconMail size={20} className="shrink-0 text-amber-600" />
                <a href={`mailto:${w.website_email}`} className="text-sm hover:underline break-all">
                  {w.website_email}
                </a>
              </div>
            )}
            {/* Öffnungszeiten */}
            {w?.oeffnungszeiten && (
              <div className="bg-background rounded-2xl p-5 shadow-sm flex gap-3 sm:col-span-2 lg:col-span-3">
                <IconClock size={20} className="shrink-0 text-amber-600 mt-0.5" />
                <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">{w.oeffnungszeiten}</pre>
              </div>
            )}
            {/* Social Links */}
            {(w?.instagram || w?.facebook) && (
              <div className="bg-background rounded-2xl p-5 shadow-sm flex gap-4 items-center sm:col-span-2 lg:col-span-3">
                {w.instagram && (
                  <a
                    href={w.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-pink-600 hover:underline"
                  >
                    <IconBrandInstagram size={20} />
                    Instagram
                  </a>
                )}
                {w.facebook && (
                  <a
                    href={w.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                  >
                    <IconBrandFacebook size={20} />
                    Facebook
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ===== BUCHUNGSANFRAGE ===== */}
      <section ref={anfrageRef} id="anfrage" className="py-16 bg-background">
        <div className="max-w-2xl mx-auto px-4">
          <h2 className="text-2xl font-semibold mb-2 text-center">{tx('Buchungsanfrage stellen')}</h2>
          <p className="text-muted-foreground text-center mb-8 text-sm">
            {tx('Wir melden uns so schnell wie möglich bei dir.')}
          </p>

          {submitted ? (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-8 text-center">
              <div className="flex justify-center mb-4">
                <div className="rounded-full bg-emerald-500 p-3">
                  <IconCheck size={28} className="text-white" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-emerald-800 mb-2">
                {tx('Anfrage erfolgreich gesendet!')}
              </h3>
              <p className="text-emerald-700 text-sm">
                {tx('Vielen Dank! Wir haben deine Buchungsanfrage erhalten und werden uns bald bei dir melden.')}
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              onFocus={handleFormFocus}
              className="bg-card border rounded-2xl shadow-sm p-6 sm:p-8 space-y-6"
              noValidate
            >
              {/* Kontaktdaten */}
              <fieldset>
                <legend className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                  {tx('Deine Kontaktdaten')}
                </legend>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" htmlFor="anfrage_vorname">
                      {tx('Vorname')} <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="anfrage_vorname"
                      type="text"
                      value={form.anfrage_vorname}
                      onChange={e => setForm(f => ({ ...f, anfrage_vorname: e.target.value }))}
                      className={`w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-500 ${formErrors.anfrage_vorname ? 'border-destructive' : 'border-input'}`}
                      placeholder={tx('Max')}
                    />
                    {formErrors.anfrage_vorname && (
                      <p className="text-xs text-destructive mt-1">{formErrors.anfrage_vorname}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" htmlFor="anfrage_nachname">
                      {tx('Nachname')} <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="anfrage_nachname"
                      type="text"
                      value={form.anfrage_nachname}
                      onChange={e => setForm(f => ({ ...f, anfrage_nachname: e.target.value }))}
                      className={`w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-500 ${formErrors.anfrage_nachname ? 'border-destructive' : 'border-input'}`}
                      placeholder={tx('Mustermann')}
                    />
                    {formErrors.anfrage_nachname && (
                      <p className="text-xs text-destructive mt-1">{formErrors.anfrage_nachname}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" htmlFor="anfrage_email">
                      {tx('E-Mail-Adresse')} <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="anfrage_email"
                      type="email"
                      value={form.anfrage_email}
                      onChange={e => setForm(f => ({ ...f, anfrage_email: e.target.value }))}
                      className={`w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-500 ${formErrors.anfrage_email ? 'border-destructive' : 'border-input'}`}
                      placeholder={tx('max@beispiel.de')}
                    />
                    {formErrors.anfrage_email && (
                      <p className="text-xs text-destructive mt-1">{formErrors.anfrage_email}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" htmlFor="anfrage_telefon">
                      {tx('Telefonnummer')}
                    </label>
                    <input
                      id="anfrage_telefon"
                      type="tel"
                      value={form.anfrage_telefon}
                      onChange={e => setForm(f => ({ ...f, anfrage_telefon: e.target.value }))}
                      className="w-full rounded-lg border border-input px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder={tx('+49 123 456789')}
                    />
                  </div>
                </div>
              </fieldset>

              {/* Hund */}
              <fieldset>
                <legend className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                  {tx('Angaben zu deinem Hund')}
                </legend>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" htmlFor="hund_name">
                      {tx('Name des Hundes')} <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="hund_name"
                      type="text"
                      value={form.hund_name}
                      onChange={e => setForm(f => ({ ...f, hund_name: e.target.value }))}
                      className={`w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-500 ${formErrors.hund_name ? 'border-destructive' : 'border-input'}`}
                      placeholder={tx('Bello')}
                    />
                    {formErrors.hund_name && (
                      <p className="text-xs text-destructive mt-1">{formErrors.hund_name}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" htmlFor="hund_rasse">
                      {tx('Rasse')}
                    </label>
                    <input
                      id="hund_rasse"
                      type="text"
                      value={form.hund_rasse}
                      onChange={e => setForm(f => ({ ...f, hund_rasse: e.target.value }))}
                      className="w-full rounded-lg border border-input px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-500"
                      placeholder={tx('z.B. Labrador')}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium mb-2">
                      {tx('Größe des Hundes')}
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {[
                        { key: 'klein', label: tx('Klein (bis 10 kg)') },
                        { key: 'mittel', label: tx('Mittel (10–25 kg)') },
                        { key: 'gross', label: tx('Groß (über 25 kg)') },
                      ].map(opt => (
                        <label
                          key={opt.key}
                          className={`flex items-center gap-2 px-4 py-2 rounded-full border cursor-pointer text-sm transition-colors ${
                            form.hund_groesse === opt.key
                              ? 'border-amber-500 bg-amber-50 text-amber-800'
                              : 'border-input hover:border-amber-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="hund_groesse"
                            value={opt.key}
                            checked={form.hund_groesse === opt.key}
                            onChange={e => setForm(f => ({ ...f, hund_groesse: e.target.value }))}
                            className="sr-only"
                          />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </fieldset>

              {/* Zeitraum */}
              <fieldset>
                <legend className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                  {tx('Gewünschter Zeitraum')}
                </legend>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" htmlFor="wunsch_anreise">
                      {tx('Anreise')} <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="wunsch_anreise"
                      type="date"
                      min={today}
                      value={form.wunsch_anreise}
                      onChange={e => setForm(f => ({ ...f, wunsch_anreise: e.target.value }))}
                      className={`w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-500 ${formErrors.wunsch_anreise ? 'border-destructive' : 'border-input'}`}
                    />
                    {formErrors.wunsch_anreise && (
                      <p className="text-xs text-destructive mt-1">{formErrors.wunsch_anreise}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" htmlFor="wunsch_abreise">
                      {tx('Abreise')} <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="wunsch_abreise"
                      type="date"
                      min={form.wunsch_anreise || today}
                      value={form.wunsch_abreise}
                      onChange={e => setForm(f => ({ ...f, wunsch_abreise: e.target.value }))}
                      className={`w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-500 ${formErrors.wunsch_abreise ? 'border-destructive' : 'border-input'}`}
                    />
                    {formErrors.wunsch_abreise && (
                      <p className="text-xs text-destructive mt-1">{formErrors.wunsch_abreise}</p>
                    )}
                  </div>
                </div>
              </fieldset>

              {/* Nachricht */}
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="nachricht">
                  {tx('Nachricht / Besondere Wünsche')}
                </label>
                <textarea
                  id="nachricht"
                  value={form.nachricht}
                  onChange={e => setForm(f => ({ ...f, nachricht: e.target.value }))}
                  rows={4}
                  className="w-full rounded-lg border border-input px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                  placeholder={tx('Medikamente, Fütterungshinweise, besondere Bedürfnisse …')}
                />
              </div>

              {submitError && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
                  {submitError}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-semibold px-6 py-3 rounded-full text-base transition-colors"
              >
                {submitting ? (
                  <>
                    <span className="animate-spin inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    {tx('Wird gesendet …')}
                  </>
                ) : (
                  <>
                    <IconSend size={18} />
                    {tx('Anfrage absenden')}
                  </>
                )}
              </button>

              <p className="text-xs text-muted-foreground text-center">
                {tx('Mit dem Absenden stimmst du zu, dass wir deine Angaben zur Bearbeitung der Anfrage nutzen.')}
              </p>
            </form>
          )}
        </div>
      </section>
    </PublicShell>
  );
}
