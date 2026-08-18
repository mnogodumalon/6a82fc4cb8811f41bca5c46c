import { useEffect, useRef, useState } from 'react';
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
import { format } from 'date-fns';
import { IconPaw, IconUser, IconCalendar, IconCheck, IconAlertCircle } from '@tabler/icons-react';

const SLUG = 'buchungsanfrage';

// Lookup-Optionen für hund_groesse (statisch — vom Schema)
const HUND_GROESSE_OPTIONS = [
  { key: 'klein', label: tx('Klein (bis 10 kg)') },
  { key: 'mittel', label: tx('Mittel (10–25 kg)') },
  { key: 'gross', label: tx('Groß (über 25 kg)') },
];

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

const EMPTY_FORM: FormState = {
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

export default function Buchungsanfrage() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const challengePrepared = useRef(false);

  useEffect(() => {
    loadPublicPagesConfig(SLUG).then(c => {
      if (!c) {
        setUnavailable(true);
        setLoading(false);
        return;
      }
      setCfg(c);
      setPage(c.pages[SLUG] ?? null);
      if (!c.pages[SLUG]) setUnavailable(true);
      setLoading(false);
    });
  }, []);

  // Challenge vorbereiten beim ersten Formular-Interact
  function ensureChallenge() {
    if (challengePrepared.current || !cfg || !page) return;
    const ep = page.endpoints?.find(e => e.op === 'create');
    if (!ep) return;
    challengePrepared.current = true;
    prepareChallenge(cfg, page, 'POST', `/apps/${ep.app_id}/records`);
  }

  function set(key: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      ensureChallenge();
      setForm(f => ({ ...f, [key]: e.target.value }));
      setErrors(prev => ({ ...prev, [key]: undefined }));
    };
  }

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.anfrage_vorname.trim()) next.anfrage_vorname = tx('Pflichtfeld');
    if (!form.anfrage_nachname.trim()) next.anfrage_nachname = tx('Pflichtfeld');
    if (!form.anfrage_email.trim()) next.anfrage_email = tx('Pflichtfeld');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.anfrage_email))
      next.anfrage_email = tx('Ungültige E-Mail-Adresse');
    if (!form.hund_name.trim()) next.hund_name = tx('Pflichtfeld');
    if (!form.wunsch_anreise) next.wunsch_anreise = tx('Pflichtfeld');
    if (!form.wunsch_abreise) next.wunsch_abreise = tx('Pflichtfeld');
    if (form.wunsch_anreise && form.wunsch_abreise && form.wunsch_abreise <= form.wunsch_anreise)
      next.wunsch_abreise = tx('Abreise muss nach der Anreise liegen');
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cfg || !page) return;
    if (!validate()) return;

    const ep = page.endpoints?.find(ep => ep.op === 'create');
    if (!ep) {
      setSubmitError(tx('Seite ist derzeit nicht verfügbar.'));
      return;
    }

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
    } catch (err) {
      if (err instanceof PageUnavailableError) {
        setUnavailable(true);
      } else {
        setSubmitError(tx('Die Anfrage konnte nicht gesendet werden. Bitte versuche es erneut.'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || unavailable) {
    return <PublicShell loading={loading} unavailable={!loading && unavailable} />;
  }

  if (submitted) {
    return (
      <PublicShell title={tx('Buchungsanfrage')}>
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100">
            <IconCheck size={36} className="text-emerald-600" />
          </div>
          <h2 className="text-xl font-semibold">{tx('Vielen Dank für deine Anfrage!')}</h2>
          <p className="text-muted-foreground max-w-sm">
            {tx('Wir melden uns so schnell wie möglich bei dir. Du erhältst eine Bestätigung per E-Mail.')}
          </p>
          <p className="text-sm text-muted-foreground">
            {tx('Anfrage für')} <strong>{form.hund_name}</strong>{' '}
            {tx('vom')} <strong>{form.wunsch_anreise}</strong>{' '}
            {tx('bis')} <strong>{form.wunsch_abreise}</strong>
          </p>
        </div>
      </PublicShell>
    );
  }

  // Heute als min-Datum für Datumfelder
  const today = format(new Date(), 'yyyy-MM-dd');

  return (
    <PublicShell
      title={page?.title ?? tx('Buchungsanfrage')}
      description={page?.description ?? tx('Stelle eine unverbindliche Anfrage für einen Aufenthalt in unserer Pfotenpension.')}
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-8">

        {/* Sektion 1: Kontaktdaten */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b pb-2">
            <IconUser size={18} className="shrink-0 text-muted-foreground" />
            <h2 className="font-semibold text-base">{tx('Deine Kontaktdaten')}</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label={tx('Vorname')}
              required
              error={errors.anfrage_vorname}
            >
              <input
                type="text"
                id="anfrage_vorname"
                autoComplete="given-name"
                value={form.anfrage_vorname}
                onChange={set('anfrage_vorname')}
                className={inputCls(!!errors.anfrage_vorname)}
                placeholder={tx('Max')}
              />
            </Field>

            <Field
              label={tx('Nachname')}
              required
              error={errors.anfrage_nachname}
            >
              <input
                type="text"
                id="anfrage_nachname"
                autoComplete="family-name"
                value={form.anfrage_nachname}
                onChange={set('anfrage_nachname')}
                className={inputCls(!!errors.anfrage_nachname)}
                placeholder={tx('Mustermann')}
              />
            </Field>
          </div>

          <Field
            label={tx('E-Mail-Adresse')}
            required
            error={errors.anfrage_email}
          >
            <input
              type="email"
              id="anfrage_email"
              autoComplete="email"
              value={form.anfrage_email}
              onChange={set('anfrage_email')}
              className={inputCls(!!errors.anfrage_email)}
              placeholder={tx('max@beispiel.de')}
            />
          </Field>

          <Field
            label={tx('Telefonnummer')}
            error={errors.anfrage_telefon}
          >
            <input
              type="tel"
              id="anfrage_telefon"
              autoComplete="tel"
              value={form.anfrage_telefon}
              onChange={set('anfrage_telefon')}
              className={inputCls(false)}
              placeholder={tx('+49 170 1234567')}
            />
          </Field>
        </section>

        {/* Sektion 2: Hund */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b pb-2">
            <IconPaw size={18} className="shrink-0 text-muted-foreground" />
            <h2 className="font-semibold text-base">{tx('Angaben zum Hund')}</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label={tx('Name des Hundes')}
              required
              error={errors.hund_name}
            >
              <input
                type="text"
                id="hund_name"
                value={form.hund_name}
                onChange={set('hund_name')}
                className={inputCls(!!errors.hund_name)}
                placeholder={tx('Bello')}
              />
            </Field>

            <Field
              label={tx('Rasse')}
              error={errors.hund_rasse}
            >
              <input
                type="text"
                id="hund_rasse"
                value={form.hund_rasse}
                onChange={set('hund_rasse')}
                className={inputCls(false)}
                placeholder={tx('z. B. Labrador')}
              />
            </Field>
          </div>

          <Field
            label={tx('Größe des Hundes')}
            error={errors.hund_groesse}
          >
            <div className="flex flex-wrap gap-3">
              {HUND_GROESSE_OPTIONS.map(opt => (
                <label
                  key={opt.key}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors select-none
                    ${form.hund_groesse === opt.key
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border bg-background hover:border-primary/50'
                    }`}
                >
                  <input
                    type="radio"
                    name="hund_groesse"
                    value={opt.key}
                    checked={form.hund_groesse === opt.key}
                    onChange={() => {
                      ensureChallenge();
                      setForm(f => ({ ...f, hund_groesse: opt.key }));
                    }}
                    className="sr-only"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </Field>
        </section>

        {/* Sektion 3: Wunschzeitraum + Nachricht */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b pb-2">
            <IconCalendar size={18} className="shrink-0 text-muted-foreground" />
            <h2 className="font-semibold text-base">{tx('Wunschzeitraum')}</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label={tx('Gewünschte Anreise')}
              required
              error={errors.wunsch_anreise}
            >
              <input
                type="date"
                id="wunsch_anreise"
                min={today}
                value={form.wunsch_anreise}
                onChange={e => {
                  ensureChallenge();
                  setForm(f => ({ ...f, wunsch_anreise: e.target.value }));
                  setErrors(prev => ({ ...prev, wunsch_anreise: undefined }));
                }}
                className={inputCls(!!errors.wunsch_anreise)}
              />
            </Field>

            <Field
              label={tx('Gewünschte Abreise')}
              required
              error={errors.wunsch_abreise}
            >
              <input
                type="date"
                id="wunsch_abreise"
                min={form.wunsch_anreise || today}
                value={form.wunsch_abreise}
                onChange={e => {
                  ensureChallenge();
                  setForm(f => ({ ...f, wunsch_abreise: e.target.value }));
                  setErrors(prev => ({ ...prev, wunsch_abreise: undefined }));
                }}
                className={inputCls(!!errors.wunsch_abreise)}
              />
            </Field>
          </div>

          <Field
            label={tx('Nachricht / Besondere Wünsche')}
            error={errors.nachricht}
          >
            <textarea
              id="nachricht"
              value={form.nachricht}
              onChange={set('nachricht')}
              rows={4}
              className={`${inputCls(false)} resize-none`}
              placeholder={tx('Allergien, Medikamente, besondere Gewohnheiten …')}
            />
          </Field>
        </section>

        {/* Fehleranzeige */}
        {submitError && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <IconAlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{submitError}</span>
          </div>
        )}

        {/* Submit */}
        <div className="flex flex-col gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto sm:self-end inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity disabled:opacity-60"
          >
            {submitting ? tx('Wird gesendet …') : tx('Anfrage absenden')}
          </button>
          <p className="text-xs text-muted-foreground text-center sm:text-right">
            {tx('Unverbindlich — wir melden uns in Kürze.')}
          </p>
        </div>
      </form>
    </PublicShell>
  );
}

// ---------------------------------------------------------------------------
// Hilfskomponenten
// ---------------------------------------------------------------------------

function inputCls(hasError: boolean) {
  return [
    'w-full rounded-lg border px-3 py-2 text-sm bg-background',
    'placeholder:text-muted-foreground',
    'focus:outline-none focus:ring-2 focus:ring-primary/40',
    hasError ? 'border-destructive' : 'border-border',
  ].join(' ');
}

interface FieldProps {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}

function Field({ label, required, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-1 text-destructive" aria-hidden>*</span>}
      </label>
      {children}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
