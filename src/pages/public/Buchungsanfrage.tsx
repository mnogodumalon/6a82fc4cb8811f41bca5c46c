import { useEffect, useRef, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig, createPublicRecord, prepareChallenge, PageUnavailableError,
  type PublicPagesConfig, type PublicPageConfig,
} from '@/lib/publicClient';
import { tx } from '@/i18n';
import { format } from 'date-fns';
import { IconArrowLeft, IconArrowRight, IconCheck, IconDog, IconCalendar, IconUser } from '@tabler/icons-react';

// ─── Typen ──────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3;

interface FormState {
  anfrage_vorname: string;
  anfrage_nachname: string;
  anfrage_telefon: string;
  anfrage_email: string;
  hund_name: string;
  hund_rasse: string;
  hund_groesse: null | 'klein' | 'mittel' | 'gross';
  wunsch_anreise: string;
  wunsch_abreise: string;
  nachricht: string;
}

const EMPTY: FormState = {
  anfrage_vorname: '',
  anfrage_nachname: '',
  anfrage_telefon: '',
  anfrage_email: '',
  hund_name: '',
  hund_rasse: '',
  hund_groesse: null,
  wunsch_anreise: '',
  wunsch_abreise: '',
  nachricht: '',
};

// ─── Hilfsfunktionen ────────────────────────────────────────────────────────

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1 text-sm text-red-600">{msg}</p>;
}

function Label({ required, children }: { required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-foreground mb-1">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

function inputClass(err?: string) {
  return `w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-primary/40 ${
    err ? 'border-red-400 bg-red-50' : 'border-border bg-background'
  }`;
}

// ─── Schrittanzeige ─────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: Step }) {
  const steps = [
    { n: 1, icon: <IconUser size={16} />, label: tx('Ihre Daten') },
    { n: 2, icon: <IconDog size={16} />, label: tx('Ihr Hund') },
    { n: 3, icon: <IconCalendar size={16} />, label: tx('Wunschzeitraum') },
  ] as const;

  return (
    <div className="flex items-center justify-between mb-8">
      {steps.map((s, i) => {
        const done = step > s.n;
        const active = step === s.n;
        return (
          <div key={s.n} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex items-center justify-center w-9 h-9 rounded-full transition-colors ${
                  done
                    ? 'bg-emerald-500 text-white'
                    : active
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {done ? <IconCheck size={16} /> : s.icon}
              </div>
              <span className={`text-xs hidden sm:block ${active ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-px mx-2 mb-5 transition-colors ${
                  step > s.n ? 'bg-emerald-400' : 'bg-border'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Hauptkomponente ─────────────────────────────────────────────────────────

export default function Buchungsanfrage() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const topRef = useRef<HTMLDivElement>(null);

  // Konfiguration laden
  useEffect(() => {
    loadPublicPagesConfig()
      .then(c => {
        setCfg(c);
        setPage(c?.pages['buchungsanfrage'] ?? null);
        setLoading(false);
      })
      .catch(err => {
        if (err instanceof PageUnavailableError) setUnavailable(true);
        else setUnavailable(true);
        setLoading(false);
      });
  }, []);

  // Challenge vorab vorbereiten beim ersten Interagieren
  const challengeReady = useRef(false);
  function ensureChallenge() {
    if (!cfg || !page || challengeReady.current) return;
    const ep = page.endpoints?.find(e => e.op === 'create');
    if (!ep) return;
    challengeReady.current = true;
    prepareChallenge(cfg, page, 'POST', `/apps/${ep.app_id}/records`);
  }

  // Felder setzen
  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: val }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: undefined }));
    ensureChallenge();
  }

  // ─── Validierung pro Schritt ─────────────────────────────────────────────

  function validateStep(s: Step): boolean {
    const errs: Partial<Record<keyof FormState, string>> = {};
    const req = tx('Pflichtfeld');

    if (s === 1) {
      if (!form.anfrage_vorname.trim()) errs.anfrage_vorname = req;
      if (!form.anfrage_nachname.trim()) errs.anfrage_nachname = req;
      if (!form.anfrage_email.trim()) {
        errs.anfrage_email = req;
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.anfrage_email)) {
        errs.anfrage_email = tx('Bitte gültige E-Mail-Adresse eingeben');
      }
    }

    if (s === 2) {
      if (!form.hund_name.trim()) errs.hund_name = req;
    }

    if (s === 3) {
      if (!form.wunsch_anreise) errs.wunsch_anreise = req;
      if (!form.wunsch_abreise) {
        errs.wunsch_abreise = req;
      } else if (form.wunsch_anreise && form.wunsch_abreise <= form.wunsch_anreise) {
        errs.wunsch_abreise = tx('Abreise muss nach der Anreise liegen');
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function next() {
    if (!validateStep(step)) return;
    setStep(prev => (prev < 3 ? (prev + 1) as Step : prev));
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  function back() {
    setStep(prev => (prev > 1 ? (prev - 1) as Step : prev));
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  // ─── Absenden ────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!validateStep(3)) return;
    if (!cfg || !page) return;

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
      topRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch {
      setSubmitError(tx('Etwas ist schiefgelaufen. Bitte versuche es erneut.'));
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading || unavailable) {
    return <PublicShell loading={loading} unavailable={!loading && unavailable} />;
  }

  if (!page) {
    return <PublicShell unavailable />;
  }

  // Erfolgsseite
  if (submitted) {
    return (
      <PublicShell>
        <div className="rounded-2xl bg-card shadow-md p-8 text-center flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
            <IconCheck size={28} className="text-emerald-600" />
          </div>
          <h2 className="text-xl font-semibold">{tx('Anfrage erhalten!')}</h2>
          <p className="text-muted-foreground max-w-sm">
            {tx('Vielen Dank! Wir haben deine Buchungsanfrage erhalten und melden uns so schnell wie möglich bei dir.')}
          </p>
          <p className="text-sm text-muted-foreground">
            {tx('Wir schreiben an')} <strong>{form.anfrage_email}</strong>
          </p>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell
      title={tx('Buchungsanfrage')}
      description={tx('Unverbindliche Anfrage — wir melden uns innerhalb von 24 Stunden.')}
    >
      <div ref={topRef} />

      {/* Schrittanzeige */}
      <StepIndicator step={step} />

      <div className="rounded-2xl bg-card shadow-md p-6 sm:p-8">
        {/* ── Schritt 1: Besitzerdaten ── */}
        {step === 1 && (
          <div className="flex flex-col gap-5">
            <h2 className="text-lg font-medium">{tx('Ihre Kontaktdaten')}</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label required>{tx('Vorname')}</Label>
                <input
                  type="text"
                  className={inputClass(errors.anfrage_vorname)}
                  value={form.anfrage_vorname}
                  onChange={e => set('anfrage_vorname', e.target.value)}
                  autoComplete="given-name"
                />
                <FieldError msg={errors.anfrage_vorname} />
              </div>
              <div>
                <Label required>{tx('Nachname')}</Label>
                <input
                  type="text"
                  className={inputClass(errors.anfrage_nachname)}
                  value={form.anfrage_nachname}
                  onChange={e => set('anfrage_nachname', e.target.value)}
                  autoComplete="family-name"
                />
                <FieldError msg={errors.anfrage_nachname} />
              </div>
            </div>

            <div>
              <Label required>{tx('E-Mail-Adresse')}</Label>
              <input
                type="email"
                className={inputClass(errors.anfrage_email)}
                value={form.anfrage_email}
                onChange={e => set('anfrage_email', e.target.value)}
                autoComplete="email"
                inputMode="email"
              />
              <FieldError msg={errors.anfrage_email} />
            </div>

            <div>
              <Label>{tx('Telefonnummer')}</Label>
              <input
                type="tel"
                className={inputClass()}
                value={form.anfrage_telefon}
                onChange={e => set('anfrage_telefon', e.target.value)}
                autoComplete="tel"
                inputMode="tel"
              />
            </div>
          </div>
        )}

        {/* ── Schritt 2: Hund beschreiben ── */}
        {step === 2 && (
          <div className="flex flex-col gap-5">
            <h2 className="text-lg font-medium">{tx('Ihr Hund')}</h2>

            <div>
              <Label required>{tx('Name des Hundes')}</Label>
              <input
                type="text"
                className={inputClass(errors.hund_name)}
                value={form.hund_name}
                onChange={e => set('hund_name', e.target.value)}
              />
              <FieldError msg={errors.hund_name} />
            </div>

            <div>
              <Label>{tx('Rasse')}</Label>
              <input
                type="text"
                className={inputClass()}
                value={form.hund_rasse}
                onChange={e => set('hund_rasse', e.target.value)}
                placeholder={tx('z. B. Labrador, Mischling')}
              />
            </div>

            <div>
              <Label>{tx('Größe des Hundes')}</Label>
              <div className="grid grid-cols-3 gap-3 mt-1">
                {([
                  ['klein', tx('Klein'), tx('bis 10 kg')],
                  ['mittel', tx('Mittel'), tx('10–25 kg')],
                  ['gross', tx('Groß'), tx('über 25 kg')],
                ] as const).map(([key, label, sub]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => set('hund_groesse', key)}
                    className={`rounded-xl border p-3 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                      form.hund_groesse === key
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background hover:bg-muted'
                    }`}
                  >
                    <div className="font-medium text-sm">{label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Schritt 3: Wunschzeitraum ── */}
        {step === 3 && (
          <div className="flex flex-col gap-5">
            <h2 className="text-lg font-medium">{tx('Wunschzeitraum')}</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label required>{tx('Gewünschte Anreise')}</Label>
                <input
                  type="date"
                  className={inputClass(errors.wunsch_anreise)}
                  value={form.wunsch_anreise}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  onChange={e => set('wunsch_anreise', e.target.value)}
                />
                <FieldError msg={errors.wunsch_anreise} />
              </div>
              <div>
                <Label required>{tx('Gewünschte Abreise')}</Label>
                <input
                  type="date"
                  className={inputClass(errors.wunsch_abreise)}
                  value={form.wunsch_abreise}
                  min={form.wunsch_anreise || format(new Date(), 'yyyy-MM-dd')}
                  onChange={e => set('wunsch_abreise', e.target.value)}
                />
                <FieldError msg={errors.wunsch_abreise} />
              </div>
            </div>

            <div>
              <Label>{tx('Nachricht / Besondere Wünsche')}</Label>
              <textarea
                className={`${inputClass()} resize-none`}
                rows={4}
                value={form.nachricht}
                onChange={e => set('nachricht', e.target.value)}
                placeholder={tx('Besonderheiten, Fragen oder sonstige Wünsche …')}
              />
            </div>

            {submitError && (
              <p className="rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
                {submitError}
              </p>
            )}
          </div>
        )}

        {/* ── Navigation ── */}
        <div className={`flex mt-8 gap-3 ${step > 1 ? 'justify-between' : 'justify-end'}`}>
          {step > 1 && (
            <button
              type="button"
              onClick={back}
              className="flex items-center gap-1.5 rounded-xl border border-border px-5 py-2.5 text-sm font-medium hover:bg-muted transition-colors"
            >
              <IconArrowLeft size={16} className="shrink-0" />
              {tx('Zurück')}
            </button>
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={next}
              className="flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              {tx('Weiter')}
              <IconArrowRight size={16} className="shrink-0" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-6 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {submitting ? (
                <span className="flex items-center gap-1.5">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  {tx('Wird gesendet …')}
                </span>
              ) : (
                <>
                  <IconCheck size={16} className="shrink-0" />
                  {tx('Anfrage absenden')}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </PublicShell>
  );
}
