import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
  createPublicRecord,
  prepareChallenge,
  PageUnavailableError,
  type PublicPagesConfig,
  type PublicPageConfig,
} from '@/lib/publicClient';
import { tx } from '@/i18n';

type FormState = {
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
};

const INITIAL: FormState = {
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
};

const GROESSE_OPTIONS = [
  { key: 'klein', label: 'Klein (bis 10 kg)' },
  { key: 'mittel', label: 'Mittel (10–25 kg)' },
  { key: 'gross', label: 'Groß (über 25 kg)' },
];

export default function Buchungsanfrage() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const formRef = useRef<HTMLElement | null>(null);
  const challengePrepared = useRef(false);

  useEffect(() => {
    loadPublicPagesConfig()
      .then(c => {
        setCfg(c);
        setPage(c?.pages['buchungsanfrage'] ?? null);
        setLoading(false);
      })
      .catch(err => {
        if (err instanceof PageUnavailableError) {
          setUnavailable(true);
        }
        setLoading(false);
      });
  }, []);

  const prepareOnce = () => {
    if (challengePrepared.current || !cfg || !page) return;
    challengePrepared.current = true;
    const ep = page.endpoints?.find(e => e.op === 'create');
    if (ep) {
      prepareChallenge(cfg, page, 'POST', `/apps/${ep.app_id}/records`).catch(() => {});
    }
  };

  const set = (field: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    prepareOnce();
    setForm(f => ({ ...f, [field]: e.target.value }));
    setErrors(er => ({ ...er, [field]: undefined }));
  };

  const validate = (): boolean => {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.anfrage_vorname.trim()) errs.anfrage_vorname = tx('Pflichtfeld');
    if (!form.anfrage_nachname.trim()) errs.anfrage_nachname = tx('Pflichtfeld');
    if (!form.anfrage_email.trim()) errs.anfrage_email = tx('Pflichtfeld');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.anfrage_email))
      errs.anfrage_email = tx('Bitte eine gültige E-Mail-Adresse eingeben');
    if (!form.hund_name.trim()) errs.hund_name = tx('Pflichtfeld');
    if (!form.wunsch_anreise) errs.wunsch_anreise = tx('Pflichtfeld');
    if (!form.wunsch_abreise) errs.wunsch_abreise = tx('Pflichtfeld');
    if (form.wunsch_anreise && form.wunsch_abreise && form.wunsch_abreise <= form.wunsch_anreise)
      errs.wunsch_abreise = tx('Abreise muss nach der Anreise liegen');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !cfg || !page) return;
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
      setSubmitError(tx('Die Anfrage konnte nicht gesendet werden. Bitte versuche es erneut.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || unavailable) {
    return <PublicShell loading={loading} unavailable={unavailable} />;
  }

  if (!page) {
    return <PublicShell unavailable />;
  }

  if (submitted) {
    return (
      <PublicShell title={tx('Anfrage gesendet')}>
        <div className="text-center py-10 space-y-4">
          <div className="text-5xl">🐾</div>
          <h2 className="text-xl font-semibold text-emerald-700">{tx('Vielen Dank für deine Anfrage!')}</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            {tx('Wir haben deine Buchungsanfrage erhalten und melden uns so schnell wie möglich bei dir. Du erhältst eine Bestätigung per E-Mail.')}
          </p>
          <button
            type="button"
            onClick={() => { setForm(INITIAL); setSubmitted(false); }}
            className="mt-4 inline-flex items-center px-4 py-2 rounded-lg border border-input bg-background hover:bg-accent text-sm font-medium transition-colors"
          >
            {tx('Weitere Anfrage stellen')}
          </button>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell
      title={tx('Buchungsanfrage')}
      description={tx('Unverbindliche Anfrage für einen Aufenthalt in unserer Hundepension')}
    >
      {/* Intro */}
      <div className="mb-8 p-5 rounded-xl bg-amber-50 border border-amber-100 space-y-2">
        <p className="font-semibold text-amber-900 text-sm">{tx('Herzlich willkommen in der Pfotenpension!')}</p>
        <p className="text-sm text-amber-800 leading-relaxed">
          {tx('Wir betreuen deinen Hund mit Liebe und Aufmerksamkeit — in kleiner Gruppe, familiärer Atmosphäre und mit viel Auslauf. Stelle hier eine unverbindliche Anfrage für den gewünschten Zeitraum. Wir melden uns innerhalb von 24 Stunden bei dir.')}
        </p>
      </div>

      <form
        ref={el => { formRef.current = el; }}
        onSubmit={handleSubmit}
        noValidate
        className="space-y-8"
        onFocus={prepareOnce}
      >
        {/* Kontaktdaten */}
        <fieldset className="space-y-4">
          <legend className="text-base font-semibold text-foreground mb-3">{tx('Deine Kontaktdaten')}</legend>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="anfrage_vorname" className="block text-sm font-medium text-foreground">
                {tx('Vorname')} <span className="text-destructive" aria-hidden="true">*</span>
              </label>
              <input
                id="anfrage_vorname"
                type="text"
                autoComplete="given-name"
                value={form.anfrage_vorname}
                onChange={set('anfrage_vorname')}
                placeholder={tx('z. B. Maria')}
                className={`w-full rounded-lg border px-3 py-2 text-sm bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-shadow ${errors.anfrage_vorname ? 'border-destructive' : 'border-input'}`}
              />
              {errors.anfrage_vorname && (
                <p className="text-xs text-destructive">{errors.anfrage_vorname}</p>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="anfrage_nachname" className="block text-sm font-medium text-foreground">
                {tx('Nachname')} <span className="text-destructive" aria-hidden="true">*</span>
              </label>
              <input
                id="anfrage_nachname"
                type="text"
                autoComplete="family-name"
                value={form.anfrage_nachname}
                onChange={set('anfrage_nachname')}
                placeholder={tx('z. B. Müller')}
                className={`w-full rounded-lg border px-3 py-2 text-sm bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-shadow ${errors.anfrage_nachname ? 'border-destructive' : 'border-input'}`}
              />
              {errors.anfrage_nachname && (
                <p className="text-xs text-destructive">{errors.anfrage_nachname}</p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="anfrage_email" className="block text-sm font-medium text-foreground">
              {tx('E-Mail-Adresse')} <span className="text-destructive" aria-hidden="true">*</span>
            </label>
            <input
              id="anfrage_email"
              type="email"
              autoComplete="email"
              value={form.anfrage_email}
              onChange={set('anfrage_email')}
              placeholder={tx('deine@email.de')}
              className={`w-full rounded-lg border px-3 py-2 text-sm bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-shadow ${errors.anfrage_email ? 'border-destructive' : 'border-input'}`}
            />
            {errors.anfrage_email && (
              <p className="text-xs text-destructive">{errors.anfrage_email}</p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="anfrage_telefon" className="block text-sm font-medium text-foreground">
              {tx('Telefonnummer')} <span className="text-muted-foreground text-xs font-normal ml-1">{tx('optional')}</span>
            </label>
            <input
              id="anfrage_telefon"
              type="tel"
              autoComplete="tel"
              value={form.anfrage_telefon}
              onChange={set('anfrage_telefon')}
              placeholder={tx('z. B. 0151 23456789')}
              className="w-full rounded-lg border border-input px-3 py-2 text-sm bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-shadow"
            />
          </div>
        </fieldset>

        <hr className="border-border" />

        {/* Hundedaten */}
        <fieldset className="space-y-4">
          <legend className="text-base font-semibold text-foreground mb-3">{tx('Angaben zu deinem Hund')}</legend>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="hund_name" className="block text-sm font-medium text-foreground">
                {tx('Name des Hundes')} <span className="text-destructive" aria-hidden="true">*</span>
              </label>
              <input
                id="hund_name"
                type="text"
                value={form.hund_name}
                onChange={set('hund_name')}
                placeholder={tx('z. B. Bello')}
                className={`w-full rounded-lg border px-3 py-2 text-sm bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-shadow ${errors.hund_name ? 'border-destructive' : 'border-input'}`}
              />
              {errors.hund_name && (
                <p className="text-xs text-destructive">{errors.hund_name}</p>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="hund_rasse" className="block text-sm font-medium text-foreground">
                {tx('Rasse')} <span className="text-muted-foreground text-xs font-normal ml-1">{tx('optional')}</span>
              </label>
              <input
                id="hund_rasse"
                type="text"
                value={form.hund_rasse}
                onChange={set('hund_rasse')}
                placeholder={tx('z. B. Labrador')}
                className="w-full rounded-lg border border-input px-3 py-2 text-sm bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-shadow"
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">
              {tx('Größe des Hundes')} <span className="text-muted-foreground text-xs font-normal ml-1">{tx('optional')}</span>
            </p>
            <div className="flex flex-wrap gap-3">
              {GROESSE_OPTIONS.map(opt => (
                <label
                  key={opt.key}
                  className={`flex items-center gap-2 cursor-pointer rounded-lg border px-4 py-2.5 text-sm transition-colors select-none ${
                    form.hund_groesse === opt.key
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-input bg-background hover:bg-accent text-foreground'
                  }`}
                >
                  <input
                    type="radio"
                    name="hund_groesse"
                    value={opt.key}
                    checked={form.hund_groesse === opt.key}
                    onChange={set('hund_groesse')}
                    className="sr-only"
                    onFocus={prepareOnce}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
        </fieldset>

        <hr className="border-border" />

        {/* Wunschzeitraum */}
        <fieldset className="space-y-4">
          <legend className="text-base font-semibold text-foreground mb-3">{tx('Gewünschter Zeitraum')}</legend>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="wunsch_anreise" className="block text-sm font-medium text-foreground">
                {tx('Anreise')} <span className="text-destructive" aria-hidden="true">*</span>
              </label>
              <input
                id="wunsch_anreise"
                type="date"
                value={form.wunsch_anreise}
                onChange={set('wunsch_anreise')}
                min={format(new Date(), 'yyyy-MM-dd')}
                className={`w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary transition-shadow ${errors.wunsch_anreise ? 'border-destructive' : 'border-input'}`}
              />
              {errors.wunsch_anreise && (
                <p className="text-xs text-destructive">{errors.wunsch_anreise}</p>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="wunsch_abreise" className="block text-sm font-medium text-foreground">
                {tx('Abreise')} <span className="text-destructive" aria-hidden="true">*</span>
              </label>
              <input
                id="wunsch_abreise"
                type="date"
                value={form.wunsch_abreise}
                onChange={set('wunsch_abreise')}
                min={form.wunsch_anreise || format(new Date(), 'yyyy-MM-dd')}
                className={`w-full rounded-lg border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary transition-shadow ${errors.wunsch_abreise ? 'border-destructive' : 'border-input'}`}
              />
              {errors.wunsch_abreise && (
                <p className="text-xs text-destructive">{errors.wunsch_abreise}</p>
              )}
            </div>
          </div>

          {form.wunsch_anreise && form.wunsch_abreise && form.wunsch_abreise > form.wunsch_anreise && (
            <p className="text-xs text-muted-foreground">
              {(() => {
                const a = new Date(form.wunsch_anreise);
                const b = new Date(form.wunsch_abreise);
                const nights = Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
                return tx`${nights} Nacht${nights === 1 ? '' : 'nächte'} geplant`;
              })()}
            </p>
          )}
        </fieldset>

        <hr className="border-border" />

        {/* Nachricht */}
        <div className="space-y-1">
          <label htmlFor="nachricht" className="block text-sm font-medium text-foreground">
            {tx('Nachricht / Besondere Wünsche')} <span className="text-muted-foreground text-xs font-normal ml-1">{tx('optional')}</span>
          </label>
          <textarea
            id="nachricht"
            rows={4}
            value={form.nachricht}
            onChange={set('nachricht')}
            placeholder={tx('Besonderheiten, Fragen oder Wünsche …')}
            className="w-full rounded-lg border border-input px-3 py-2 text-sm bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-shadow resize-none"
          />
        </div>

        {submitError && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
            {submitError}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
          <p className="text-xs text-muted-foreground">
            <span className="text-destructive">*</span> {tx('Pflichtfelder')}
          </p>
          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? tx('Wird gesendet …') : tx('Anfrage absenden')}
          </button>
        </div>
      </form>
    </PublicShell>
  );
}
