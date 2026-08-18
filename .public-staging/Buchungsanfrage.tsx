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
import { IconCheck, IconDog, IconCalendar, IconUser, IconArrowLeft } from '@tabler/icons-react';

const SLUG = 'buchungsanfrage';

type Size = 'klein' | 'mittel' | 'gross';

interface FormState {
  anfrage_vorname: string;
  anfrage_nachname: string;
  anfrage_email: string;
  anfrage_telefon: string;
  hund_name: string;
  hund_rasse: string;
  hund_groesse: Size | '';
  wunsch_anreise: string;
  wunsch_abreise: string;
  nachricht: string;
}

const EMPTY: FormState = {
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

function SectionHeading({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-primary shrink-0">{icon}</span>
      <h2 className="text-base font-semibold text-foreground">{label}</h2>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  'w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0 disabled:opacity-50';

export default function Buchungsanfrage() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const challengePrepared = useRef(false);

  useEffect(() => {
    loadPublicPagesConfig(SLUG)
      .then(c => {
        setCfg(c);
        setPage(c?.pages[SLUG] ?? null);
        setLoading(false);
      })
      .catch(err => {
        if (err instanceof PageUnavailableError) {
          setLoading(false);
        }
      });
  }, []);

  const appId = page?.endpoints?.find(e => e.op === 'create')?.app_id ?? '';

  function handleFocus() {
    if (!challengePrepared.current && cfg && page && appId) {
      challengePrepared.current = true;
      prepareChallenge(cfg, page, 'POST', `/apps/${appId}/records`).catch(() => undefined);
    }
  }

  function set(field: keyof FormState, value: string) {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => ({ ...e, [field]: undefined }));
  }

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.anfrage_vorname.trim()) next.anfrage_vorname = tx('Pflichtfeld');
    if (!form.anfrage_nachname.trim()) next.anfrage_nachname = tx('Pflichtfeld');
    if (!form.anfrage_email.trim()) next.anfrage_email = tx('Pflichtfeld');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.anfrage_email)) next.anfrage_email = tx('Ungültige E-Mail-Adresse');
    if (!form.hund_name.trim()) next.hund_name = tx('Pflichtfeld');
    if (!form.wunsch_anreise) next.wunsch_anreise = tx('Pflichtfeld');
    if (!form.wunsch_abreise) next.wunsch_abreise = tx('Pflichtfeld');
    else if (form.wunsch_anreise && form.wunsch_abreise <= form.wunsch_anreise) {
      next.wunsch_abreise = tx('Abreise muss nach der Anreise liegen');
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
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
      setSubmitError(tx('Leider ist ein Fehler aufgetreten. Bitte versuche es erneut.'));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || (!loading && !page)) {
    return <PublicShell loading={loading} unavailable={!loading && !page} />;
  }

  const today = format(new Date(), 'yyyy-MM-dd');

  if (submitted) {
    return (
      <PublicShell title={tx('Buchungsanfrage')} description={tx('Hundepension')}>
        <div className="flex flex-col items-center gap-6 py-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <IconCheck size={36} className="text-emerald-600" />
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold text-foreground">{tx('Vielen Dank!')}</h2>
            <p className="text-muted-foreground max-w-sm">
              {tx('Wir haben deine Anfrage erhalten und melden uns bald bei dir.')}
            </p>
          </div>
          <a
            href="#/public/startseite"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <IconArrowLeft size={16} className="shrink-0" />
            {tx('Zurück zur Startseite')}
          </a>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell title={tx('Buchungsanfrage')} description={tx('Unverbindliche Anfrage stellen')}>
      <div className="mb-4">
        <a
          href="#/public/startseite"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <IconArrowLeft size={14} className="shrink-0" />
          {tx('Zurück zur Hundepension')}
        </a>
      </div>

      <p className="text-sm text-muted-foreground mb-6">
        {tx('Stelle hier eine unverbindliche Anfrage. Wir prüfen deine Wunschtermine und melden uns schnellstmöglich bei dir.')}
      </p>

      <form onSubmit={handleSubmit} onFocus={handleFocus} noValidate className="flex flex-col gap-6">
        {/* Abschnitt 1: Kontaktdaten */}
        <section>
          <SectionHeading icon={<IconUser size={18} />} label={tx('Ihre Kontaktdaten')} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={tx('Vorname')} required>
              <input
                type="text"
                className={inputCls}
                value={form.anfrage_vorname}
                onChange={e => set('anfrage_vorname', e.target.value)}
                placeholder={tx('Max')}
                autoComplete="given-name"
              />
              {errors.anfrage_vorname && <span className="text-xs text-destructive">{errors.anfrage_vorname}</span>}
            </Field>
            <Field label={tx('Nachname')} required>
              <input
                type="text"
                className={inputCls}
                value={form.anfrage_nachname}
                onChange={e => set('anfrage_nachname', e.target.value)}
                placeholder={tx('Mustermann')}
                autoComplete="family-name"
              />
              {errors.anfrage_nachname && <span className="text-xs text-destructive">{errors.anfrage_nachname}</span>}
            </Field>
            <Field label={tx('E-Mail-Adresse')} required>
              <input
                type="email"
                className={inputCls}
                value={form.anfrage_email}
                onChange={e => set('anfrage_email', e.target.value)}
                placeholder={tx('max@beispiel.de')}
                autoComplete="email"
              />
              {errors.anfrage_email && <span className="text-xs text-destructive">{errors.anfrage_email}</span>}
            </Field>
            <Field label={tx('Telefon')}>
              <input
                type="tel"
                className={inputCls}
                value={form.anfrage_telefon}
                onChange={e => set('anfrage_telefon', e.target.value)}
                placeholder={tx('+49 123 456789')}
                autoComplete="tel"
              />
            </Field>
          </div>
        </section>

        {/* Abschnitt 2: Hund */}
        <section>
          <SectionHeading icon={<IconDog size={18} />} label={tx('Ihr Hund')} />
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={tx('Name des Hundes')} required>
                <input
                  type="text"
                  className={inputCls}
                  value={form.hund_name}
                  onChange={e => set('hund_name', e.target.value)}
                  placeholder={tx('Bello')}
                />
                {errors.hund_name && <span className="text-xs text-destructive">{errors.hund_name}</span>}
              </Field>
              <Field label={tx('Rasse')}>
                <input
                  type="text"
                  className={inputCls}
                  value={form.hund_rasse}
                  onChange={e => set('hund_rasse', e.target.value)}
                  placeholder={tx('z.B. Labrador')}
                />
              </Field>
            </div>
            <Field label={tx('Größe')}>
              <div className="flex flex-wrap gap-2">
                {([
                  ['klein', tx('Klein (bis 10 kg)')],
                  ['mittel', tx('Mittel (10–25 kg)')],
                  ['gross', tx('Groß (über 25 kg)')],
                ] as [Size, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => set('hund_groesse', form.hund_groesse === key ? '' : key)}
                    className={[
                      'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                      form.hund_groesse === key
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-foreground hover:bg-accent',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </section>

        {/* Abschnitt 3: Wunschzeitraum */}
        <section>
          <SectionHeading icon={<IconCalendar size={18} />} label={tx('Wunschzeitraum')} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label={tx('Gewünschte Anreise')} required>
              <input
                type="date"
                className={inputCls}
                value={form.wunsch_anreise}
                min={today}
                onChange={e => set('wunsch_anreise', e.target.value)}
              />
              {errors.wunsch_anreise && <span className="text-xs text-destructive">{errors.wunsch_anreise}</span>}
            </Field>
            <Field label={tx('Gewünschte Abreise')} required>
              <input
                type="date"
                className={inputCls}
                value={form.wunsch_abreise}
                min={form.wunsch_anreise || today}
                onChange={e => set('wunsch_abreise', e.target.value)}
              />
              {errors.wunsch_abreise && <span className="text-xs text-destructive">{errors.wunsch_abreise}</span>}
            </Field>
          </div>
        </section>

        {/* Nachricht */}
        <Field label={tx('Nachricht oder besondere Wünsche')}>
          <textarea
            className={`${inputCls} min-h-[100px] resize-y`}
            value={form.nachricht}
            onChange={e => set('nachricht', e.target.value)}
            placeholder={tx('Gibt es etwas, das wir wissen sollten? Besonderheiten, Allergien, Medikamente …')}
            rows={4}
          />
        </Field>

        {submitError && (
          <p className="text-sm text-destructive rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
            {submitError}
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          {tx('Mit dem Absenden stimmst du zu, dass wir deine Daten zur Bearbeitung deiner Anfrage verwenden. Es handelt sich um eine unverbindliche Anfrage.')}
        </p>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-60 transition-colors"
        >
          {submitting ? tx('Wird gesendet …') : tx('Anfrage absenden')}
        </button>
      </form>
    </PublicShell>
  );
}
