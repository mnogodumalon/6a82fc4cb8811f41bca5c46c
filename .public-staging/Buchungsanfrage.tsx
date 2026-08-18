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
import { IconPaw, IconUser, IconDog, IconCalendar, IconMessageCircle, IconCheck, IconChevronRight, IconChevronLeft } from '@tabler/icons-react';

// ---- Types ----------------------------------------------------------------

type Step = 1 | 2 | 3 | 4;

interface FormData {
  anfrage_vorname: string;
  anfrage_nachname: string;
  anfrage_email: string;
  anfrage_telefon: string;
  hund_name: string;
  hund_rasse: string;
  hund_groesse: '' | 'klein' | 'mittel' | 'gross';
  wunsch_anreise: string;
  wunsch_abreise: string;
  nachricht: string;
}

const INITIAL: FormData = {
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

// ---- Step metadata --------------------------------------------------------

const STEPS: { icon: React.ReactNode; label: () => string }[] = [
  { icon: <IconUser size={18} />, label: () => tx('Kontaktdaten') },
  { icon: <IconDog size={18} />, label: () => tx('Hund') },
  { icon: <IconCalendar size={18} />, label: () => tx('Zeitraum') },
  { icon: <IconMessageCircle size={18} />, label: () => tx('Nachricht') },
];

// ---- Helpers ---------------------------------------------------------------

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-medium text-foreground mb-1">
      {children}
      {required && <span className="text-destructive ml-1" aria-hidden>*</span>}
    </label>
  );
}

function Input({
  id,
  type = 'text',
  value,
  onChange,
  placeholder,
  required,
  autoComplete,
}: {
  id: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
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
      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
    />
  );
}

function RadioGroup({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (k: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {options.map(o => (
        <label
          key={o.key}
          className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
            value === o.key
              ? 'border-primary bg-primary/5 text-primary font-medium'
              : 'border-input bg-background hover:bg-muted/40'
          }`}
        >
          <input
            type="radio"
            name="hund_groesse"
            value={o.key}
            checked={value === o.key}
            onChange={() => onChange(o.key)}
            className="sr-only"
          />
          <span
            className={`h-4 w-4 shrink-0 rounded-full border-2 flex items-center justify-center ${
              value === o.key ? 'border-primary' : 'border-muted-foreground'
            }`}
          >
            {value === o.key && <span className="h-2 w-2 rounded-full bg-primary" />}
          </span>
          <span className="text-sm">{o.label}</span>
        </label>
      ))}
    </div>
  );
}

// ---- Stepper indicator ----------------------------------------------------

function StepIndicator({ current }: { current: Step }) {
  return (
    <div className="flex items-center justify-center gap-1 mb-6">
      {STEPS.map((s, i) => {
        const n = (i + 1) as Step;
        const done = n < current;
        const active = n === current;
        return (
          <div key={n} className="flex items-center">
            <div
              className={`flex items-center justify-center h-8 w-8 rounded-full text-xs font-semibold transition-colors ${
                done
                  ? 'bg-primary text-primary-foreground'
                  : active
                  ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {done ? <IconCheck size={14} /> : n}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-8 h-0.5 mx-1 ${done ? 'bg-primary' : 'bg-muted'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---- Validation -----------------------------------------------------------

function validateStep(step: Step, f: FormData): string | null {
  if (step === 1) {
    if (!f.anfrage_vorname.trim()) return tx('Bitte gib deinen Vornamen ein.');
    if (!f.anfrage_nachname.trim()) return tx('Bitte gib deinen Nachnamen ein.');
    if (!f.anfrage_email.trim()) return tx('Bitte gib deine E-Mail-Adresse ein.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.anfrage_email)) return tx('Bitte gib eine gültige E-Mail-Adresse ein.');
  }
  if (step === 2) {
    if (!f.hund_name.trim()) return tx('Bitte gib den Namen deines Hundes ein.');
  }
  if (step === 3) {
    if (!f.wunsch_anreise) return tx('Bitte wähle ein Anreisedatum.');
    if (!f.wunsch_abreise) return tx('Bitte wähle ein Abreisedatum.');
    if (f.wunsch_abreise <= f.wunsch_anreise) return tx('Die Abreise muss nach der Anreise liegen.');
  }
  return null;
}

// ---- Main component -------------------------------------------------------

export default function Buchungsanfrage() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormData>(INITIAL);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const topRef = useRef<HTMLDivElement>(null);

  // All hooks above early returns
  useEffect(() => {
    loadPublicPagesConfig('buchungsanfrage')
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

  const set = (k: keyof FormData) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const scrollTop = () => topRef.current?.scrollIntoView({ behavior: 'smooth' });

  const handleNext = () => {
    const err = validateStep(step, form);
    if (err) { setError(err); scrollTop(); return; }
    setError(null);
    setStep(s => (s < 4 ? ((s + 1) as Step) : s));
    scrollTop();
  };

  const handleBack = () => {
    setError(null);
    setStep(s => (s > 1 ? ((s - 1) as Step) : s));
    scrollTop();
  };

  const handleFirstInteraction = () => {
    if (!cfg || !page) return;
    const ep = page.endpoints?.find(e => e.op === 'create');
    if (!ep) return;
    prepareChallenge(cfg, page, 'POST', `/apps/${ep.app_id}/records`);
  };

  const handleSubmit = async () => {
    const err = validateStep(4, form);
    if (err) { setError(err); return; }
    if (!cfg || !page) return;
    setSubmitting(true);
    setError(null);
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
      scrollTop();
    } catch {
      setError(tx('Es ist ein Fehler aufgetreten. Bitte versuche es erneut.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Early returns after hooks
  if (loading || (!cfg && !loading)) {
    return <PublicShell loading={loading} unavailable={!loading} />;
  }
  if (!page) {
    return <PublicShell unavailable />;
  }

  // ---- Success screen -------------------------------------------------------
  if (submitted) {
    return (
      <PublicShell title={tx('Anfrage gesendet')} wide>
        <div className="flex flex-col items-center gap-6 py-8 text-center">
          <div className="flex items-center justify-center h-20 w-20 rounded-full bg-emerald-100">
            <IconPaw size={40} className="text-emerald-600" stroke={1.5} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {tx('Vielen Dank, ')}
              {form.anfrage_vorname}!
            </h2>
            <p className="text-muted-foreground max-w-sm mx-auto">
              {tx('Deine Buchungsanfrage für')} <strong>{form.hund_name}</strong>{' '}
              {tx('ist bei uns eingegangen. Wir melden uns so schnell wie möglich bei dir.')}
            </p>
          </div>
          <div className="w-full max-w-sm rounded-xl border bg-muted/40 p-4 text-sm text-left space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{tx('Anreise')}</span>
              <span className="font-medium">
                {format(new Date(form.wunsch_anreise + 'T12:00:00'), 'dd.MM.yyyy')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{tx('Abreise')}</span>
              <span className="font-medium">
                {format(new Date(form.wunsch_abreise + 'T12:00:00'), 'dd.MM.yyyy')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{tx('E-Mail')}</span>
              <span className="font-medium truncate max-w-[180px]">{form.anfrage_email}</span>
            </div>
          </div>
        </div>
      </PublicShell>
    );
  }

  // ---- Form -----------------------------------------------------------------
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  return (
    <PublicShell title={tx('Buchungsanfrage')} description={tx('Unverbindliche Anfrage für deinen Hund')} wide>
      <div ref={topRef} />

      <StepIndicator current={step} />

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* ---- Step 1: Kontaktdaten ---------------------------------------- */}
      {step === 1 && (
        <div className="space-y-4" onFocus={handleFirstInteraction}>
          <div className="flex items-center gap-2 mb-4">
            <IconUser size={20} className="text-primary shrink-0" />
            <h2 className="text-base font-semibold text-foreground">{tx('Deine Kontaktdaten')}</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel required>{tx('Vorname')}</FieldLabel>
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
              <FieldLabel required>{tx('Nachname')}</FieldLabel>
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
            <FieldLabel required>{tx('E-Mail-Adresse')}</FieldLabel>
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
            <FieldLabel>{tx('Telefonnummer')}</FieldLabel>
            <Input
              id="anfrage_telefon"
              type="tel"
              value={form.anfrage_telefon}
              onChange={set('anfrage_telefon')}
              placeholder={tx('+49 123 456 789')}
              autoComplete="tel"
            />
          </div>
        </div>
      )}

      {/* ---- Step 2: Hund ------------------------------------------------ */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <IconDog size={20} className="text-primary shrink-0" />
            <h2 className="text-base font-semibold text-foreground">{tx('Angaben zum Hund')}</h2>
          </div>

          <div>
            <FieldLabel required>{tx('Name des Hundes')}</FieldLabel>
            <Input
              id="hund_name"
              value={form.hund_name}
              onChange={set('hund_name')}
              placeholder={tx('Bello')}
              required
            />
          </div>

          <div>
            <FieldLabel>{tx('Rasse')}</FieldLabel>
            <Input
              id="hund_rasse"
              value={form.hund_rasse}
              onChange={set('hund_rasse')}
              placeholder={tx('z. B. Golden Retriever')}
            />
          </div>

          <div>
            <FieldLabel>{tx('Größe')}</FieldLabel>
            <RadioGroup
              options={[
                { key: 'klein', label: tx('Klein (bis 10 kg)') },
                { key: 'mittel', label: tx('Mittel (10–25 kg)') },
                { key: 'gross', label: tx('Groß (über 25 kg)') },
              ]}
              value={form.hund_groesse}
              onChange={v => setForm(f => ({ ...f, hund_groesse: v as FormData['hund_groesse'] }))}
            />
          </div>
        </div>
      )}

      {/* ---- Step 3: Zeitraum ------------------------------------------- */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <IconCalendar size={20} className="text-primary shrink-0" />
            <h2 className="text-base font-semibold text-foreground">{tx('Gewünschter Zeitraum')}</h2>
          </div>

          <div>
            <FieldLabel required>{tx('Anreise')}</FieldLabel>
            <input
              id="wunsch_anreise"
              type="date"
              value={form.wunsch_anreise}
              min={todayStr}
              onChange={e => {
                const v = e.target.value;
                setForm(f => ({
                  ...f,
                  wunsch_anreise: v,
                  wunsch_abreise: f.wunsch_abreise && f.wunsch_abreise <= v ? '' : f.wunsch_abreise,
                }));
              }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <FieldLabel required>{tx('Abreise')}</FieldLabel>
            <input
              id="wunsch_abreise"
              type="date"
              value={form.wunsch_abreise}
              min={form.wunsch_anreise || todayStr}
              onChange={e => setForm(f => ({ ...f, wunsch_abreise: e.target.value }))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {form.wunsch_anreise && form.wunsch_abreise && form.wunsch_abreise > form.wunsch_anreise && (
            <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3 text-sm text-primary">
              {(() => {
                const a = new Date(form.wunsch_anreise + 'T12:00:00');
                const b = new Date(form.wunsch_abreise + 'T12:00:00');
                const nights = Math.round((b.getTime() - a.getTime()) / 86400000);
                return nights === 1
                  ? tx('1 Übernachtung')
                  : `${nights} ${tx('Übernachtungen')}`;
              })()}
            </div>
          )}
        </div>
      )}

      {/* ---- Step 4: Nachricht ------------------------------------------ */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <IconMessageCircle size={20} className="text-primary shrink-0" />
            <h2 className="text-base font-semibold text-foreground">{tx('Nachricht (optional)')}</h2>
          </div>

          <div>
            <FieldLabel>{tx('Besondere Wünsche oder Hinweise')}</FieldLabel>
            <textarea
              id="nachricht"
              value={form.nachricht}
              onChange={e => setForm(f => ({ ...f, nachricht: e.target.value }))}
              placeholder={tx('z. B. Medikamente, Allergien, Besonderheiten …')}
              rows={5}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          {/* Summary card */}
          <div className="rounded-xl border bg-muted/30 p-4 text-sm space-y-2">
            <p className="font-semibold text-foreground mb-1">{tx('Zusammenfassung')}</p>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{tx('Name')}</span>
              <span className="font-medium truncate max-w-[200px]">
                {form.anfrage_vorname} {form.anfrage_nachname}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{tx('E-Mail')}</span>
              <span className="font-medium truncate max-w-[200px]">{form.anfrage_email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{tx('Hund')}</span>
              <span className="font-medium">{form.hund_name}{form.hund_rasse ? ` (${form.hund_rasse})` : ''}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{tx('Anreise')}</span>
              <span className="font-medium">
                {form.wunsch_anreise ? format(new Date(form.wunsch_anreise + 'T12:00:00'), 'dd.MM.yyyy') : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{tx('Abreise')}</span>
              <span className="font-medium">
                {form.wunsch_abreise ? format(new Date(form.wunsch_abreise + 'T12:00:00'), 'dd.MM.yyyy') : '—'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ---- Navigation -------------------------------------------------- */}
      <div className="flex items-center justify-between mt-8 gap-3">
        {step > 1 ? (
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-1.5 rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
          >
            <IconChevronLeft size={16} className="shrink-0" />
            {tx('Zurück')}
          </button>
        ) : (
          <span />
        )}

        {step < 4 ? (
          <button
            type="button"
            onClick={handleNext}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {tx('Weiter')}
            <IconChevronRight size={16} className="shrink-0" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {submitting ? (
              <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            ) : (
              <IconCheck size={16} className="shrink-0" />
            )}
            {tx('Anfrage absenden')}
          </button>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        {tx('* Pflichtfelder')}
      </p>
    </PublicShell>
  );
}
