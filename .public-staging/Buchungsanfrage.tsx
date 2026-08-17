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
import { IconCheck, IconChevronLeft, IconChevronRight, IconDog, IconCalendar, IconUser, IconSend } from '@tabler/icons-react';
import { format } from 'date-fns';

// Step indices
const STEP_KONTAKT = 0;
const STEP_HUND = 1;
const STEP_ZEITRAUM = 2;
const STEP_DANKE = 3;

type HundGroesse = 'klein' | 'mittel' | 'gross' | '';

interface FormState {
  anfrage_vorname: string;
  anfrage_nachname: string;
  anfrage_email: string;
  anfrage_telefon: string;
  hund_name: string;
  hund_rasse: string;
  hund_groesse: HundGroesse;
  wunsch_anreise: string;
  wunsch_abreise: string;
  nachricht: string;
}

const INITIAL_FORM: FormState = {
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

const GROESSE_OPTIONS: { key: HundGroesse; label: string }[] = [
  { key: 'klein', label: 'Klein (bis 10 kg)' },
  { key: 'mittel', label: 'Mittel (10–25 kg)' },
  { key: 'gross', label: 'Groß (über 25 kg)' },
];

function StepIndicator({ step }: { step: number }) {
  const steps = [
    { icon: <IconUser size={16} />, label: tx('Kontakt') },
    { icon: <IconDog size={16} />, label: tx('Hund') },
    { icon: <IconCalendar size={16} />, label: tx('Zeitraum') },
  ];
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={[
                'w-9 h-9 rounded-full flex items-center justify-center transition-colors',
                i < step
                  ? 'bg-primary text-primary-foreground'
                  : i === step
                  ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                  : 'bg-muted text-muted-foreground',
              ].join(' ')}
            >
              {i < step ? <IconCheck size={16} /> : s.icon}
            </div>
            <span
              className={[
                'text-xs mt-1 font-medium',
                i === step ? 'text-primary' : 'text-muted-foreground',
              ].join(' ')}
            >
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={[
                'w-12 h-0.5 mb-4 mx-1 transition-colors',
                i < step ? 'bg-primary' : 'bg-border',
              ].join(' ')}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function FieldLabel({ htmlFor, required, children }: { htmlFor?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground mb-1">
      {children}
      {required && <span className="text-destructive ml-1">*</span>}
    </label>
  );
}

function Input({ id, type = 'text', value, onChange, placeholder, required, autoComplete }: {
  id: string; type?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; required?: boolean; autoComplete?: string;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      autoComplete={autoComplete}
      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
    />
  );
}

export default function Buchungsanfrage() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(STEP_KONTAKT);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vorname, setVorname] = useState('');
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadPublicPagesConfig()
      .then(c => {
        setCfg(c);
        setPage(c?.pages['buchungsanfrage'] ?? null);
        setLoading(false);
      })
      .catch(err => {
        if (err instanceof PageUnavailableError) {
          setLoading(false);
        }
      });
  }, []);

  // Warm up challenge on first form interaction
  const challengeWarmed = useRef(false);
  const warmChallenge = () => {
    if (challengeWarmed.current || !cfg || !page) return;
    challengeWarmed.current = true;
    const ep = page.endpoints?.find(e => e.op === 'create');
    if (ep?.app_id) {
      prepareChallenge(cfg, page, 'POST', `/apps/${ep.app_id}/records`).catch(() => {});
    }
  };

  const set = (key: keyof FormState) => (value: string) => {
    warmChallenge();
    setForm(f => ({ ...f, [key]: value }));
  };

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: 'smooth' });

  const validateStep = (): string | null => {
    if (step === STEP_KONTAKT) {
      if (!form.anfrage_vorname.trim()) return tx('Bitte gib deinen Vornamen ein.');
      if (!form.anfrage_nachname.trim()) return tx('Bitte gib deinen Nachnamen ein.');
      if (!form.anfrage_email.trim()) return tx('Bitte gib deine E-Mail-Adresse ein.');
    }
    if (step === STEP_HUND) {
      if (!form.hund_name.trim()) return tx('Bitte gib den Namen deines Hundes ein.');
    }
    if (step === STEP_ZEITRAUM) {
      if (!form.wunsch_anreise) return tx('Bitte wähle ein Anreisedatum.');
      if (!form.wunsch_abreise) return tx('Bitte wähle ein Abreisedatum.');
      if (form.wunsch_anreise >= form.wunsch_abreise) return tx('Das Abreisedatum muss nach dem Anreisedatum liegen.');
    }
    return null;
  };

  const handleNext = () => {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError(null);
    setStep(s => s + 1);
    scrollTop();
  };

  const handleBack = () => {
    setError(null);
    setStep(s => s - 1);
    scrollTop();
  };

  const handleSubmit = async () => {
    const err = validateStep();
    if (err) { setError(err); return; }
    if (!cfg || !page) return;
    setError(null);
    setSubmitting(true);
    try {
      const payload: Record<string, string> = {
        anfrage_vorname: form.anfrage_vorname.trim(),
        anfrage_nachname: form.anfrage_nachname.trim(),
        anfrage_email: form.anfrage_email.trim(),
        wunsch_anreise: form.wunsch_anreise,
        wunsch_abreise: form.wunsch_abreise,
        hund_name: form.hund_name.trim(),
      };
      if (form.anfrage_telefon.trim()) payload.anfrage_telefon = form.anfrage_telefon.trim();
      if (form.hund_rasse.trim()) payload.hund_rasse = form.hund_rasse.trim();
      if (form.hund_groesse) payload.hund_groesse = form.hund_groesse;
      if (form.nachricht.trim()) payload.nachricht = form.nachricht.trim();

      await createPublicRecord(cfg, page, payload);
      setVorname(form.anfrage_vorname.trim());
      setStep(STEP_DANKE);
      scrollTop();
    } catch {
      setError(tx('Es ist ein Fehler aufgetreten. Bitte versuche es erneut.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <PublicShell loading />;
  if (!cfg || !page) return <PublicShell unavailable />;

  // Success screen
  if (step === STEP_DANKE) {
    return (
      <PublicShell title={tx('Buchungsanfrage')} description={tx('Unverbindliche Anfrage für die Hundepension')}>
        <div ref={topRef} className="flex flex-col items-center text-center py-8 gap-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <IconCheck size={32} className="text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              {tx('Vielen Dank')}{vorname ? `, ${vorname}` : ''}!
            </h2>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              {tx('Deine Anfrage ist bei uns eingegangen. Wir melden uns in Kürze bei dir, um den Aufenthalt deines Hundes zu bestätigen.')}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/40 px-6 py-4 text-sm text-left w-full max-w-sm">
            <div className="font-medium text-foreground mb-2">{tx('Zusammenfassung')}</div>
            <dl className="space-y-1">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{tx('Name')}</dt>
                <dd className="text-foreground font-medium truncate">{form.anfrage_vorname} {form.anfrage_nachname}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{tx('Hund')}</dt>
                <dd className="text-foreground font-medium truncate">{form.hund_name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{tx('Anreise')}</dt>
                <dd className="text-foreground font-medium">{form.wunsch_anreise ? format(new Date(form.wunsch_anreise + 'T12:00'), 'dd.MM.yyyy') : '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{tx('Abreise')}</dt>
                <dd className="text-foreground font-medium">{form.wunsch_abreise ? format(new Date(form.wunsch_abreise + 'T12:00'), 'dd.MM.yyyy') : '—'}</dd>
              </div>
            </dl>
          </div>
          <a
            href="/#/public/hundepension"
            className="text-sm text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
          >
            {tx('Zurück zur Hundepension')}
          </a>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell title={tx('Buchungsanfrage')} description={tx('Unverbindliche Anfrage für die Hundepension')}>
      <div ref={topRef} />
      <StepIndicator step={step} />

      {error && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Step 1: Kontakt */}
      {step === STEP_KONTAKT && (
        <div className="space-y-4">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-foreground">{tx('Deine Kontaktdaten')}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{tx('Damit wir deine Anfrage bearbeiten und dich kontaktieren können.')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel htmlFor="anfrage_vorname" required>{tx('Vorname')}</FieldLabel>
              <Input
                id="anfrage_vorname"
                value={form.anfrage_vorname}
                onChange={set('anfrage_vorname')}
                placeholder={tx('Max')}
                required
                autoComplete="given-name"
              />
            </div>
            <div>
              <FieldLabel htmlFor="anfrage_nachname" required>{tx('Nachname')}</FieldLabel>
              <Input
                id="anfrage_nachname"
                value={form.anfrage_nachname}
                onChange={set('anfrage_nachname')}
                placeholder={tx('Mustermann')}
                required
                autoComplete="family-name"
              />
            </div>
          </div>
          <div>
            <FieldLabel htmlFor="anfrage_email" required>{tx('E-Mail-Adresse')}</FieldLabel>
            <Input
              id="anfrage_email"
              type="email"
              value={form.anfrage_email}
              onChange={set('anfrage_email')}
              placeholder={tx('max@beispiel.de')}
              required
              autoComplete="email"
            />
          </div>
          <div>
            <FieldLabel htmlFor="anfrage_telefon">{tx('Telefonnummer')}</FieldLabel>
            <Input
              id="anfrage_telefon"
              type="tel"
              value={form.anfrage_telefon}
              onChange={set('anfrage_telefon')}
              placeholder={tx('+49 123 456789')}
              autoComplete="tel"
            />
          </div>
        </div>
      )}

      {/* Step 2: Hund */}
      {step === STEP_HUND && (
        <div className="space-y-4">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-foreground">{tx('Angaben zum Hund')}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{tx('Damit wir den besten Platz für deinen Vierbeiner reservieren können.')}</p>
          </div>
          <div>
            <FieldLabel htmlFor="hund_name" required>{tx('Name des Hundes')}</FieldLabel>
            <Input
              id="hund_name"
              value={form.hund_name}
              onChange={set('hund_name')}
              placeholder={tx('Bello')}
              required
            />
          </div>
          <div>
            <FieldLabel htmlFor="hund_rasse">{tx('Rasse')}</FieldLabel>
            <Input
              id="hund_rasse"
              value={form.hund_rasse}
              onChange={set('hund_rasse')}
              placeholder={tx('z. B. Labrador, Mischling …')}
            />
          </div>
          <div>
            <FieldLabel>{tx('Größe')}</FieldLabel>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {GROESSE_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => { warmChallenge(); set('hund_groesse')(opt.key); }}
                  className={[
                    'rounded-lg border px-4 py-3 text-sm font-medium text-left transition-colors',
                    form.hund_groesse === opt.key
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-foreground hover:border-primary/50',
                  ].join(' ')}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Zeitraum */}
      {step === STEP_ZEITRAUM && (
        <div className="space-y-4">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-foreground">{tx('Gewünschter Zeitraum')}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{tx('Deine Wunschdaten – wir prüfen die Verfügbarkeit und melden uns bei dir.')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel htmlFor="wunsch_anreise" required>{tx('Anreise')}</FieldLabel>
              <input
                id="wunsch_anreise"
                type="date"
                value={form.wunsch_anreise}
                onChange={e => set('wunsch_anreise')(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                required
              />
            </div>
            <div>
              <FieldLabel htmlFor="wunsch_abreise" required>{tx('Abreise')}</FieldLabel>
              <input
                id="wunsch_abreise"
                type="date"
                value={form.wunsch_abreise}
                min={form.wunsch_anreise || undefined}
                onChange={e => set('wunsch_abreise')(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                required
              />
            </div>
          </div>
          <div>
            <FieldLabel htmlFor="nachricht">{tx('Nachricht / Besondere Wünsche')}</FieldLabel>
            <textarea
              id="nachricht"
              value={form.nachricht}
              onChange={e => set('nachricht')(e.target.value)}
              rows={4}
              placeholder={tx('Gibt es etwas Wichtiges, das wir wissen sollten?')}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent resize-none"
            />
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8 pt-4 border-t border-border">
        {step > STEP_KONTAKT ? (
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <IconChevronLeft size={16} className="shrink-0" />
            {tx('Zurück')}
          </button>
        ) : (
          <div />
        )}

        {step < STEP_ZEITRAUM ? (
          <button
            type="button"
            onClick={handleNext}
            className="flex items-center gap-1.5 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {tx('Weiter')}
            <IconChevronRight size={16} className="shrink-0" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-1.5 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            <IconSend size={16} className="shrink-0" />
            {submitting ? tx('Wird gesendet …') : tx('Anfrage absenden')}
          </button>
        )}
      </div>
    </PublicShell>
  );
}
